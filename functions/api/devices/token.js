import { first } from "../_lib/db.js";
import { handleApi, readJson } from "../_lib/http.js";
import { deviceJson, verifySignedDeviceRequest } from "../_lib/sync.js";
import { getPairingByDeviceCode, pairingState } from "../_lib/pairing.js";

// The grant type the CLI sends verbatim. It is `DEVICE_CODE_GRANT_TYPE` in
// src/sync/contract.ts; anything else is a client that is not speaking this
// protocol.
const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

// How long after confirmation a pairing with no device row is still treated as
// in progress rather than dead. Far longer than any admission request, far
// shorter than the code's own lifetime.
const ADMISSION_SETTLE_SECONDS = 60;

// POST /api/devices/token  ->  { slug, catalog_url, device_id, status }
//                          or  400 { error: "<rfc 8628 code>" }
//
// The CLI polls this every `interval` seconds until the owner confirms the code
// in the browser, then learns its own slug from the answer -- which is the
// whole point: the slug stops being something a human types.
//
// Errors are RFC 8628 codes in an `{ "error": ... }` body with a 4xx status,
// because that is what the client parses (`rfcDeviceError`). Only
// `authorization_pending` and `slow_down` are non-fatal there; every other code
// stops the CLI, so returning the wrong one strands a user in a spinner.
//
// Deliberately idempotent, not single-use. The client retries -- a dropped
// response, a resumed poll -- and a one-shot token would turn an ordinary
// retry into a permanent failure with the device already enrolled.
export async function onRequestPost(context) {
  return handleApi(async () => {
    const { request, env } = context;
    const publicKey = await verifySignedDeviceRequest(request);
    const body = await readJson(request, 8_000);

    if (body.grant_type !== DEVICE_CODE_GRANT_TYPE) {
      return rfcError("unsupported_grant_type");
    }
    if (typeof body.device_code !== "string" || !body.device_code) {
      return rfcError("invalid_grant");
    }

    const pairing = await getPairingByDeviceCode(env, body.device_code);
    // An unknown code and a code belonging to a DIFFERENT key are the same
    // answer on purpose. Distinguishing them would turn this endpoint into an
    // oracle for which device codes exist, and the caller has no legitimate
    // use for the difference.
    if (!pairing || pairing.public_key !== publicKey) {
      return rfcError("invalid_grant");
    }

    switch (pairingState(pairing)) {
      case "denied":
        return rfcError("access_denied");
      case "expired":
        return rfcError("expired_token");
      case "pending":
        return rfcError("authorization_pending");
      default:
        break;
    }

    // Confirmed. The vault and device were resolved from the confirming
    // owner's SESSION at confirm time and written onto the pairing, so nothing
    // here is derived from anything the device sent.
    const device = pairing.device_id
      ? await first(env, `
          select sync_devices.id, sync_devices.status, vaults.slug
          from sync_devices join vaults on vaults.id = sync_devices.vault_id
          where sync_devices.id = ?
        `, pairing.device_id)
      : null;

    // Confirmed, but no device row yet. TWO situations look identical here and
    // they need opposite answers: the browser is between claiming the pairing
    // and writing device_id (ordinary, milliseconds wide, and a poll lands in
    // it whenever the timing aligns), or admission genuinely failed and nothing
    // is coming. Answering `expired_token` for the first told the CLI the link
    // failed while the browser was busy succeeding.
    //
    // So a freshly confirmed pairing stays NON-terminal: keep polling, the next
    // one resolves it. Past the window no in-flight request can still be
    // running, so the honest answer is that this code no longer buys anything.
    if (!device || !device.slug) {
      const settling = Date.now() - Date.parse(pairing.confirmed_at) < ADMISSION_SETTLE_SECONDS * 1000;
      return rfcError(settling ? "authorization_pending" : "expired_token");
    }

    // Revoked between the browser confirming and this poll. Reporting it as
    // `pending` (which the ternary below would) hands the CLI an authorized
    // pairing whose every catalog request is then refused -- a linked machine
    // that does not work. Revocation is the owner refusing, so say so with a
    // terminal code instead.
    if (device.status === "revoked") {
      return rfcError("access_denied");
    }

    const origin = new URL(request.url).origin;
    return deviceJson({
      slug: device.slug,
      catalog_url: `${origin}/v/${device.slug}/catalog.json`,
      device_id: device.id,
      status: device.status === "active" ? "active" : "pending"
    });
  });
}

// 400 rather than 401: this is a protocol-level refusal about the grant, not a
// rejected signature. A 401 here would read as "your key is wrong" to anything
// inspecting the exchange, and the key was already verified above.
function rfcError(code) {
  return deviceJson({ error: code }, 400);
}
