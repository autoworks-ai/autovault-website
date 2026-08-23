import { ApiError, handleApi } from "../../../api/_lib/http.js";
import { authenticateDeviceRequest, bundleKey, touchDevice } from "../../../api/_lib/sync.js";

// GET /v/<slug>/bundles/<bundle_hash>.json  ->  the signed bundle, verbatim
//
// ACTIVE devices only. The catalog is readable while pending so a device can
// pin the publishing key; actual content is what admission gates.
//
// `bundle_path` lives inside the release signature and the client re-derives
// the URL as bundles/<bundle_hash>.json relative to catalog.json, refusing
// anything that resolves elsewhere. So this route cannot redirect, cannot
// serve a differently-named object, and cannot move the bundle to another
// host -- the client would reject all three, and rightly.
export async function onRequestGet(context) {
  return handleApi(async () => {
    const { request, env, params } = context;
    const { vault, device } = await authenticateDeviceRequest(request, env, params.slug);

    if (!device) throw new ApiError(403, "Enrol this device before downloading bundles.");
    if (device.status !== "active") {
      throw new ApiError(403, "This device is not admitted to that vault yet.");
    }

    const match = /^([a-f0-9]{64})\.json$/.exec(params.bundle ?? "");
    if (!match) throw new ApiError(404, "Bundles are addressed as <bundle_hash>.json.");

    if (!env.AUTOVAULT_VAULT_OBJECTS) {
      throw new ApiError(503, "AUTOVAULT_VAULT_OBJECTS binding is not configured.");
    }
    const bundle = await env.AUTOVAULT_VAULT_OBJECTS.get(bundleKey(vault.id, match[1]));
    if (!bundle) throw new ApiError(404, "No such bundle in this vault.");

    await touchDevice(env, device);

    return new Response(bundle, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff"
      }
    });
  });
}
