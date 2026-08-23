import { requireUser } from "../../../_lib/auth.js";
import { first, nowIso, run } from "../../../_lib/db.js";
import { ApiError, handleApi, json, readJson } from "../../../_lib/http.js";
import { getCurrentVault } from "../../../_lib/vault.js";

// POST /api/vaults/current/devices/<device_id>  { action: "admit" | "revoke" }
//
// The decision the whole enrollment flow exists to capture. Scoped to the
// caller's own vault by the where clause, not by trusting the id: device ids
// are server-generated but they travel through a CLI and a browser, and an id
// alone must never be enough to admit a device on somebody else's vault.
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

    const device = await first(env, `
      select id, status from sync_devices where id = ? and vault_id = ?
    `, params.device, vault.id);
    if (!device) throw new ApiError(404, "No such device on this vault.");

    // Admitting a revoked device would quietly undo a revocation. Revoking is
    // the deliberate end of a device's life here; getting back in means
    // running `autovault link` again with a new key, which lands as a fresh
    // pending row the owner can see.
    if (body.action === "admit" && device.status === "revoked") {
      throw new ApiError(409, "This device was revoked. Re-link it from that machine to enrol a new key.");
    }

    await run(env, `
      update sync_devices set status = ?, ${action.stamp} = ? where id = ? and vault_id = ?
    `, action.status, nowIso(), device.id, vault.id);

    return json({ device: { id: device.id, status: action.status } });
  });
}
