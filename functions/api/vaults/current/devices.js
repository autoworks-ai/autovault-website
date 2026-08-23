import { requireUser } from "../../_lib/auth.js";
import { all } from "../../_lib/db.js";
import { ApiError, handleApi, json } from "../../_lib/http.js";
import { deviceFingerprint } from "../../_lib/sync.js";

// Applies to settled history ONLY -- see the query below. Denying prunes old
// tombstones at the source, so this is the second line of defence on payload
// and DOM size rather than the only one.
const MAX_LISTED_HISTORY = 100;
import { getCurrentVault } from "../../_lib/vault.js";

// GET /api/vaults/current/devices
//
// The owner console. Deliberately NOT gated on an active subscription: someone
// whose billing has lapsed still needs to see, and revoke, the machines that
// hold their catalog. Losing that view is a security regression, not a
// paywall.
export async function onRequestGet({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const vault = await getCurrentVault(env, user.id);
    if (!vault) throw new ApiError(404, "No hosted vault yet.");

    // Live devices are never capped; only settled history is.
    //
    // A single capped query looked fine and was not: with more than the cap in
    // live devices it starts omitting the oldest ACTIVE rows, and this response
    // is the console's only source of device ids and revoke controls -- so an
    // admitted key would become unrevocable through the UI. Whatever else a cap
    // does, it must never make a key harder to take away.
    const live = await all(env, `
      select id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at, revoked_at
      from sync_devices
      where vault_id = ? and status in ('pending', 'active')
      order by case status when 'pending' then 0 else 1 end, first_seen_at desc
    `, vault.id);

    const history = await all(env, `
      select id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at, revoked_at
      from sync_devices
      where vault_id = ? and status not in ('pending', 'active')
      order by first_seen_at desc
      limit ?
    `, vault.id, MAX_LISTED_HISTORY);

    const results = [...(live.results ?? []), ...(history.results ?? [])];

    return json({
      slug: vault.slug,
      devices: results.map((device) => ({
        id: device.id,
        // The console never renders a whole public key. The owner is matching
        // what their terminal printed, and that is the short form.
        fingerprint: deviceFingerprint(device.public_key),
        status: device.status,
        hostname: device.hostname,
        first_seen_at: device.first_seen_at,
        last_seen_at: device.last_seen_at,
        admitted_at: device.admitted_at,
        revoked_at: device.revoked_at
      }))
    });
  });
}
