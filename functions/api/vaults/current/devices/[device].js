import { requireUser } from "../../../_lib/auth.js";
import { first, nowIso, run } from "../../../_lib/db.js";
import { ApiError, handleApi, json, readJson } from "../../../_lib/http.js";
import { getCurrentVault, getSubscription } from "../../../_lib/vault.js";

// POST /api/vaults/current/devices/<device_id>  { action: "admit" | "revoke" }
//
// The decision the whole enrollment flow exists to capture. Scoped to the
// caller's own vault by the where clause, not by trusting the id: device ids
// are server-generated but they travel through a CLI and a browser, and an id
// alone must never be enough to admit a device on somebody else's vault.
// How many denied-and-never-admitted devices stay visible per vault. Enough
// that a real denial is still reported to the machine that asked, small enough
// that spam cannot accumulate.
const MAX_DENIED_TOMBSTONES = 25;

const ACTIONS = {
  admit: { status: "active", stamp: "admitted_at" },
  revoke: { status: "revoked", stamp: "revoked_at" }
};

export async function onRequestPost({ request, env, params }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const vault = await getCurrentVault(env, user.id);
    if (!vault) throw new ApiError(404, "No hosted vault yet.");

    const body = await readJson(request, 4_000);
    const action = ACTIONS[body.action];
    if (!action) throw new ApiError(400, "Action must be 'admit' or 'revoke'.");

    // Admission is the grant, so it follows entitlement. Listing and revoking
    // deliberately do not: someone whose billing lapsed still needs to see and
    // remove the machines holding their catalog, and taking that away would be
    // a security regression dressed as a paywall. Granting new access on a
    // lapsed account is the opposite case.
    if (body.action === "admit") {
      const subscription = await getSubscription(env, user.id);
      if (!subscription.active) {
        throw new ApiError(402, "Reactivate the hosted subscription before admitting new machines.");
      }
    }

    const device = await first(env, `
      select id, status, admitted_at from sync_devices where id = ? and vault_id = ?
    `, params.device, vault.id);
    if (!device) throw new ApiError(404, "No such device on this vault.");

    // Admitting a revoked device would quietly undo a revocation. Revoking is
    // the deliberate end of a device's life here; getting back in means
    // running `autovault link` again with a new key, which lands as a fresh
    // pending row the owner can see.
    if (body.action === "admit" && device.status === "revoked") {
      throw new ApiError(409, "This device was revoked. Re-link it from that machine to enrol a new key.");
    }

    // Denying keeps a tombstone, and prunes old ones. Deleting the row
    // outright was the obvious way to stop denied devices accumulating, and it
    // broke the machine on the other end: `autovault link` polls
    // devices/current, and a missing row 404s, so the CLI dumps a raw HTTP
    // error instead of its clean "device was revoked" exit. Verified against
    // the real CLI, not assumed.
    //
    // Marking revoked frees the pending slot (the cap counts `pending`), lets
    // the CLI hear what happened, and blocks the key. Growth is bounded below
    // instead.

    // Conditional on the state we read, not just on the id.
    //
    // The guard above is a check-then-act, and two tabs are enough to lose the
    // race: admit reads `pending`, revoke commits, then the admit writes
    // `active` over it and a revoked key has bundle access again. Narrowing
    // the update to the status we saw makes the transition atomic in SQLite,
    // so the loser of the race changes nothing.
    const result = await run(env, `
      update sync_devices set status = ?, ${action.stamp} = ?
      where id = ? and vault_id = ? and status = ?
    `, action.status, nowIso(), device.id, vault.id, device.status);

    if (!result?.meta?.changes) {
      throw new ApiError(409, "That device changed while you were deciding. Reload and try again.");
    }

    // Bound the tombstones. Denying frees a pending slot, so without this a
    // spam-and-clear loop grows this table for ever -- the finding the delete
    // was meant to fix. Only never-admitted rows are pruned, and only the
    // oldest beyond the keep-window: a device that was genuinely admitted and
    // then revoked keeps its tombstone permanently, because that one is a
    // security record rather than queue litter.
    if (action.status === "revoked") {
      await run(env, `
        delete from sync_devices
        where vault_id = ? and status = 'revoked' and admitted_at is null
          and id not in (
            select id from sync_devices
            where vault_id = ? and status = 'revoked' and admitted_at is null
            -- Ordered by when it was DENIED, not when it first showed up.
            -- first_seen_at is the enrollment time, so a machine that sat
            -- pending for a while and was then denied looks old the instant it
            -- is written and gets pruned by its own denial -- which hands its
            -- waiting CLI the 404 this tombstone exists to prevent, and frees
            -- the key to enrol again. coalesce covers rows written before the
            -- stamp existed.
            order by coalesce(revoked_at, first_seen_at) desc
            limit ?
          )
      `, vault.id, vault.id, MAX_DENIED_TOMBSTONES);
    }

    return json({ device: { id: device.id, status: action.status } });
  });
}
