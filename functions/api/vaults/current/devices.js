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

    // One statement, so live rows and history come from one snapshot.
    //
    // This was two queries -- live uncapped, history capped -- which fixed the
    // cap hiding revocable devices and bought a new problem: another tab
    // revoking between them puts the same id in both halves, once stale and
    // once revoked. The console then renders duplicate v-for keys and offers a
    // revoke control for a device already gone.
    //
    // The union keeps what the split was for. Live devices are still never
    // capped -- an admitted key that falls off the list is a key that cannot be
    // taken away -- and the limit still applies only to settled history.
    const { results } = await all(env, `
      select id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at, revoked_at,
             -- The whole sort rank has to live in a column: a compound
             -- SELECT's ORDER BY can only reference result columns, not an
             -- expression over them. 0/1 here, 2 for history below.
             case status when 'pending' then 0 else 1 end as sort_group
      from sync_devices
      where vault_id = ? and status in ('pending', 'active')

      union all

      select * from (
        select id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at, revoked_at,
               2 as sort_group
        from sync_devices
        where vault_id = ? and status not in ('pending', 'active')
        order by coalesce(revoked_at, first_seen_at) desc
        limit ?
      )

      order by sort_group, first_seen_at desc
    `, vault.id, vault.id, MAX_LISTED_HISTORY);

    return json({
      slug: vault.slug,
      devices: (results ?? []).map((device) => ({
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
