import { ApiError, handleApi } from "../../api/_lib/http.js";
import { authenticateDeviceRequest, catalogKey, touchDevice } from "../../api/_lib/sync.js";

// GET /v/<slug>/catalog.json  ->  the owner's signed catalog, verbatim
//
// Readable by a PENDING device as well as an active one, and that is not a
// leniency -- it is required. `autovault link` enrols, then immediately reads
// the catalog to pin `public_key` before the owner has admitted anything. A
// device that cannot read the catalog while pending can never pin the key it
// will later verify releases against.
//
// Revoked devices are refused. Unknown keys never reach here in the real
// flow, because enrollment happens first.
export async function onRequestGet(context) {
  return handleApi(async () => {
    const { request, env, params } = context;
    const { vault, device } = await authenticateDeviceRequest(request, env, params.slug);

    if (!device) throw new ApiError(403, "Enrol this device before reading the catalog.");
    if (device.status === "revoked") throw new ApiError(403, "This device has been revoked.");

    if (!env.AUTOVAULT_VAULT_OBJECTS) {
      throw new ApiError(503, "AUTOVAULT_VAULT_OBJECTS binding is not configured.");
    }
    const catalog = await env.AUTOVAULT_VAULT_OBJECTS.get(catalogKey(vault.id));
    if (!catalog) throw new ApiError(404, "This vault has no published catalog yet.");

    await touchDevice(env, device);

    // Served byte-for-byte as the owner signed it. Re-serialising would change
    // the bytes and every release signature in it would stop verifying.
    return new Response(catalog, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff"
      }
    });
  });
}
