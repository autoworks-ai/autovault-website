import { requireUser } from "../../_lib/auth.js";
import { all } from "../../_lib/db.js";
import { ApiError, handleApi, json } from "../../_lib/http.js";
import { deviceFingerprint } from "../../_lib/sync.js";

// Belt and braces alongside deny-removes-the-row: this response is polled, and
// an unbounded list would grow both the payload and the rendered DOM. Ordered
// pending-first, so a cap can only ever hide the oldest settled history --
// never a device waiting on a decision.
const MAX_LISTED_DEVICES = 100;
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

    const { results } = await all(env, `
      select id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at, revoked_at
      from sync_devices
      where vault_id = ?
      order by
        case status when 'pending' then 0 when 'active' then 1 else 2 end,
        first_seen_at desc
      limit ?
    `, vault.id, MAX_LISTED_DEVICES);

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
