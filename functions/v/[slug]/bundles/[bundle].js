import { ApiError, handleApi } from "../../../api/_lib/http.js";
import { authenticateDeviceRequest, bundleKey, touchDevice } from "../../../api/_lib/sync.js";
import { getSubscription } from "../../../api/_lib/vault.js";

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

    // Bundle content is the paid thing, and device status alone does not carry
    // entitlement: when Stripe marks a subscription canceled the webhook
    // updates `subscriptions` and nothing touches the devices, so an admitted
    // device would go on downloading for ever. Provisioning and pending-skills
    // already require this; content is a stranger place to omit it than either.
    //
    // Gated here and not on the catalog: reading the catalog is how a device
    // pins the publishing key and how the CLI reports what it *would* pull, and
    // a lapsed subscriber losing that reads as breakage rather than billing.
    const subscription = await getSubscription(env, vault.user_id);
    if (!subscription.active) {
      throw new ApiError(402, "This vault's hosted subscription is not active.");
    }

    const match = /^([a-f0-9]{64})\.json$/.exec(params.bundle ?? "");
    if (!match) throw new ApiError(404, "Bundles are addressed as <bundle_hash>.json.");

    if (!env.AUTOVAULT_VAULT_OBJECTS) {
      throw new ApiError(503, "AUTOVAULT_VAULT_OBJECTS binding is not configured.");
    }
    // arrayBuffer, not the default text. KV's text mode UTF-8-decodes,
    // and re-encoding that string into a Response can emit different
    // bytes than were stored -- a BOM or a lone surrogate is enough. The
    // whole contract here is byte-for-byte fidelity, because the hash and
    // the signature are over the bytes.
    const bundle = await env.AUTOVAULT_VAULT_OBJECTS.get(bundleKey(vault.id, match[1]), "arrayBuffer");
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
