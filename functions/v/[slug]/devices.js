import { nowIso, run } from "../../api/_lib/db.js";
import { ApiError, handleApi, readJson } from "../../api/_lib/http.js";
import {
  authenticateDeviceRequest,
  deviceJson,
  getDeviceByKey,
  MAX_PENDING_DEVICES_PER_VAULT
} from "../../api/_lib/sync.js";

// POST /v/<slug>/devices  ->  { device_id, status }
//
// First contact. `autovault link <slug>` generates an ed25519 keypair, posts
// the public half here, and only then reads the catalog -- so this is the one
// device route that accepts a key it has never seen.
//
// The request is signed by the very key it is enrolling. That is deliberate
// self-attestation: it proves the caller holds the secret half, which is the
// only thing that makes the key an identity rather than a claim.
export async function onRequestPost(context) {
  return handleApi(async () => {
    const { request, env, params } = context;
    const { vault, device, publicKey } = await authenticateDeviceRequest(request, env, params.slug);

    const body = await readJson(request, 8_000);
    // The signature proves possession of the header key. If the body names a
    // different key, the caller is trying to enrol something it cannot sign
    // for -- refuse rather than quietly trusting one of the two.
    if (typeof body.public_key !== "string" || body.public_key !== publicKey) {
      throw new ApiError(400, "Enrollment body must carry the same public key that signed the request.");
    }

    // Re-running `autovault link` is normal -- the CLI does it whenever the
    // local enrollment is lost. Return the existing row rather than creating a
    // second one, and never resurrect a revoked device into pending: that
    // would make revocation a speed bump instead of a decision.
    if (device) {
      return deviceJson({ device_id: device.id, status: device.status });
    }

    const hostname = typeof body.hostname === "string" && body.hostname.trim()
      ? body.hostname.trim().slice(0, 120)
      : null;

    // The cap is a predicate ON the insert, not a count before it.
    //
    // As two statements this was a check-then-act, and first contact is
    // unauthenticated: a parallel burst can have every request observe fewer
    // than the cap and then every insert succeed, burying the owner's queue
    // far past the number this claims to enforce. One statement, so the
    // count and the write cannot be interleaved.
    //
    // Reached only when the device is new -- an already-enrolled one returned
    // above -- so a full queue never locks out a machine that is already
    // known, and admitting or denying any of the queue frees a slot.
    const id = `device-${crypto.randomUUID()}`;
    const inserted = await run(env, `
      insert into sync_devices (id, vault_id, public_key, status, hostname, first_seen_at, last_seen_at)
      select ?, ?, ?, 'pending', ?, ?, ?
      where (
        select count(*) from sync_devices where vault_id = ? and status = 'pending'
      ) < ?
      on conflict(vault_id, public_key) do nothing
    `, id, vault.id, publicKey, hostname, nowIso(), nowIso(), vault.id, MAX_PENDING_DEVICES_PER_VAULT);

    // Read back rather than assuming the insert won. Two `autovault link` runs
    // racing on the same key both reach the insert; the loser must report the
    // winner's device_id, or the CLI polls devices/current for an id that the
    // console will never admit.
    const stored = await getDeviceByKey(env, vault.id, publicKey);
    if (!stored) {
      // Nothing written and nothing to read back: the only way that happens is
      // the cap predicate excluding the row.
      if (!inserted?.meta?.changes) {
        throw new ApiError(429, "This vault has too many devices waiting to be admitted. Clear the queue and try again.");
      }
      throw new ApiError(500, "Device enrollment did not persist.");
    }
    return deviceJson({ device_id: stored.id, status: stored.status });
  });
}
