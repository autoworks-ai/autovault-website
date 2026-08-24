import { requireUser } from "../../_lib/auth.js";
import { nowIso, run } from "../../_lib/db.js";
import { ApiError, handleApi, json, readJson } from "../../_lib/http.js";
import { deviceFingerprint, getDeviceByKey } from "../../_lib/sync.js";
import { getCurrentVault, getSubscription } from "../../_lib/vault.js";
import {
  getPairingByUserCode,
  normalizeUserCode,
  pairingState
} from "../../_lib/pairing.js";

// GET  /api/devices/pairings/<user_code>  -> what the confirm screen renders
// POST /api/devices/pairings/<user_code>  -> { action: "confirm" | "deny" }
//
// The browser half of the device grant, and the ONLY place a device is bound to
// a vault. Clerk-authenticated rather than device-signed: the entire security
// property is that the session -- a human who is already signed in -- decides
// which vault a machine joins, and that they did it while looking at a code and
// a key fingerprint the terminal printed at the same time.
//
// Nothing here trusts the device. The vault comes from the session's own row;
// the code only identifies which pending claim is being answered.
export async function onRequestGet(context) {
  return handleApi(async () => {
    const { request, env, params } = context;
    const user = await requireUser(request, env);
    const { pairing, state } = await loadPairing(env, params.code);
    const vault = await getCurrentVault(env, user.id);

    // A key this owner has already revoked can still pair -- they are the one
    // confirming it -- but they have to be TOLD, or an owner who revoked a
    // stolen laptop re-admits it by reflex. Device-initiated enrollment still
    // cannot resurrect a revoked key; only this deliberate, authenticated
    // confirmation can.
    const existing = vault ? await getDeviceByKey(env, vault.id, pairing.public_key) : null;

    return json({
      user_code: pairing.user_code,
      // First4…last4 of the base64url key -- byte-identical to what the CLI
      // prints beside the code. Matching BOTH is the "confirm at both ends"
      // property; the code alone only proves somebody read the screen.
      fingerprint: deviceFingerprint(pairing.public_key),
      hostname: pairing.hostname,
      expires_at: pairing.expires_at,
      state,
      previously_revoked: existing?.status === "revoked",
      // Deny marks the pairing; it does NOT revoke a device that is already
      // enrolled. Any non-revoked row counts, not just an active one: v/<slug>/
      // catalog.json refuses ONLY revoked devices, so a key still sitting
      // pending from `autovault link <slug>` is reading the catalog too. Saying
      // "it never had access" to that owner is false in the direction that
      // matters.
      already_enrolled: Boolean(existing) && existing.status !== "revoked",
      vault: vault ? { slug: vault.slug } : null
    });
  });
}

export async function onRequestPost(context) {
  return handleApi(async () => {
    const { request, env, params } = context;
    const user = await requireUser(request, env);
    const body = await readJson(request, 8_000);
    const action = body.action === "deny" ? "deny" : body.action === "confirm" ? "confirm" : null;
    if (!action) throw new ApiError(400, "Action must be confirm or deny.");

    // The limit of what this route can promise. "confirm" means an authenticated
    // owner asked for this code to be bound to their vault -- that session check
    // is the entire server-side guarantee, and it is what makes a leaked code
    // useless on its own. The both-ends-match property (RFC 8628 s5.4) is
    // enforced by the confirm page: the fingerprint is deliberately absent from
    // the link, so ticking that it matches the terminal is what turns a click
    // into a confirmation. The server cannot verify a human looked, so a caller
    // hitting this route directly skips that tick. Do not read the checkbox as
    // a server-side guarantee, and do not remove it believing one exists.

    const { pairing, state } = await loadPairing(env, params.code);
    if (state !== "pending") throw new ApiError(409, refusalFor(state), state);

    if (action === "deny") {
      const refused = await run(
        env,
        `update device_pairings set denied_at = ?
           where device_code = ? and confirmed_at is null and denied_at is null`,
        nowIso(),
        pairing.device_code
      );
      if (!refused?.meta?.changes) await throwLostRace(env, params.code);
      return json({ state: "denied" });
    }

    const vault = await getCurrentVault(env, user.id);
    // Reachable in ordinary use: someone can run `autovault link` before they
    // have reserved a namespace. Refuse rather than inventing a vault, and
    // leave the pairing pending -- the CLI keeps polling, so reserving a
    // namespace in another tab and confirming again just works, with no new
    // code and no restart.
    if (!vault) {
      throw new ApiError(409, "Reserve your namespace first, then confirm this code.", "no-vault");
    }

    // Admission is the grant, so it follows entitlement -- the identical rule
    // the owner console enforces in vaults/current/devices/[device].js. Pairing
    // is a second front door onto that one operation, and a door that skips the
    // check lets a lapsed account pre-authorize machines that light up the
    // moment billing resumes. Denying above stays ungated on purpose: refusing
    // a machine is safety, not a grant, and paywalling it would be a security
    // regression dressed as billing.
    const subscription = await getSubscription(env, user.id);
    if (!subscription.active) {
      throw new ApiError(402, "Reactivate the hosted subscription before admitting new machines.", "inactive-subscription");
    }

    // Claim the decision before acting on it. The state check above is a read,
    // and two sessions can both pass it -- the same owner double-clicking, a
    // confirm racing a deny in another tab, or two different owners who both
    // hold the code. Without this claim each would call admitDevice, leaving an
    // active device row in BOTH vaults and letting whichever write lands last
    // decide the slug the CLI is told. Making confirm and deny compete for one
    // conditional update means exactly one of them ever has side effects.
    // `expires_at > ?` is load-bearing, not belt-and-braces. The state check
    // above is a read, and loading the vault and subscription takes time, so a
    // confirm that arrived just before the TTL can land just after it. Because
    // a confirmed pairing outranks an expired one by design, that late write
    // would resurrect a dead code and keep it redeemable for the whole grace
    // window. Re-checking expiry here is what keeps the TTL authoritative.
    const claimed = await run(
      env,
      `update device_pairings set confirmed_at = ?, vault_id = ?
         where device_code = ? and confirmed_at is null and denied_at is null
           and expires_at > ?`,
      nowIso(),
      vault.id,
      pairing.device_code,
      nowIso()
    );
    if (!claimed?.meta?.changes) await throwLostRace(env, params.code);

    // Only now is admission safe, because this session owns the decision. If
    // this throws, the pairing stays confirmed with a null device_id and the
    // CLI is told `expired_token` -- fail-closed, and recoverable by running
    // `autovault link` again. That is the right direction to fail for an
    // authorization transition.
    const device = await admitDevice(env, vault, pairing);
    await run(env, "update device_pairings set device_id = ? where device_code = ?", device.id, pairing.device_code);

    return json({ state: "confirmed", slug: vault.slug, device_id: device.id, status: device.status });
  });
}

// Create or admit the sync_devices row for this key. A machine that already
// enrolled the old way (`autovault link <slug>`) and is sitting pending is
// admitted rather than duplicated -- the unique index on (vault_id, public_key)
// makes that the only correct outcome.
async function admitDevice(env, vault, pairing) {
  const existing = await getDeviceByKey(env, vault.id, pairing.public_key);
  if (existing) {
    // Conditional on the status that was READ. Re-admitting a revoked key is
    // allowed here -- it is the owner doing it, and the page warns them first
    // -- but only when revoked is the state they were shown. Without the
    // predicate, a revocation landing between that read and this write is
    // silently undone: the owner revokes a stolen laptop in one tab while
    // confirming an unrelated-looking code in another, and the confirm
    // resurrects it with no warning ever displayed.
    const readmitted = await run(
      env,
      `update sync_devices set status = 'active', admitted_at = ?, revoked_at = null,
              hostname = coalesce(?, hostname)
         where id = ? and status = ?`,
      nowIso(),
      pairing.hostname,
      existing.id,
      existing.status
    );
    if (!readmitted?.meta?.changes) {
      throw new ApiError(
        409,
        "That machine's status changed while you were confirming. Check it in your console and try again.",
        "device-changed"
      );
    }
    return { id: existing.id, status: "active" };
  }

  const id = `device-${crypto.randomUUID()}`;
  // The WHERE on DO UPDATE is the same guard as the branch above, for the case
  // where getDeviceByKey found nothing: another enrollment can insert this key
  // and the owner revoke it, both between that read and this write. Without the
  // clause the conflict path reactivates a revoked row -- the identical silent
  // resurrection, reached down the other side of the branch.
  await run(env, `
    insert into sync_devices (id, vault_id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at)
    values (?, ?, ?, 'active', ?, ?, ?, ?)
    on conflict(vault_id, public_key) do update set
      status = 'active', admitted_at = excluded.admitted_at, revoked_at = null
    where sync_devices.status != 'revoked'
  `, id, vault.id, pairing.public_key, pairing.hostname, nowIso(), nowIso(), nowIso());

  // Read back rather than assuming the insert won -- two confirms racing on
  // the same code must agree on one device id, or the CLI polls for one the
  // console will never show.
  const stored = await getDeviceByKey(env, vault.id, pairing.public_key);
  if (!stored) throw new ApiError(500, "Device pairing did not persist.");
  // A revoked row here means the guard above declined to reactivate it, which
  // is a lost race and not an admission. Reporting it as one would tell the
  // owner a machine is linked while every catalog request it makes is refused.
  if (stored.status !== "active") {
    throw new ApiError(
      409,
      "That machine's status changed while you were confirming. Check it in your console and try again.",
      "device-changed"
    );
  }
  return { id: stored.id, status: stored.status };
}

// No pending-device cap here, unlike /v/<slug>/devices. That cap exists because
// enrollment is unauthenticated first contact anybody can flood; this path
// requires the vault owner's own session and one deliberate click per device.
async function loadPairing(env, rawCode) {
  const userCode = normalizeUserCode(decodeURIComponent(rawCode ?? ""));
  if (!userCode) throw new ApiError(404, "That code is not a pairing code.", "unknown");
  const pairing = await getPairingByUserCode(env, userCode);
  if (!pairing) throw new ApiError(404, "That pairing code is not valid.", "unknown");
  return { pairing, state: pairingState(pairing) };
}

// A claim that changed no rows means another session decided this pairing
// first. Re-read so the refusal names what actually happened rather than
// guessing, and so the confirm page renders the real outcome. Always throws.
async function throwLostRace(env, rawCode) {
  const { state } = await loadPairing(env, rawCode);
  throw new ApiError(409, refusalFor(state), state);
}

function refusalFor(state) {
  if (state === "confirmed") return "That code was already confirmed.";
  if (state === "denied") return "That code was already refused.";
  if (state === "expired") return "That code expired. Run autovault link again.";
  return "That pairing code is not valid.";
}
