import { ApiError, handleApi, readJson } from "../_lib/http.js";
import { deviceJson, verifySignedDeviceRequest } from "../_lib/sync.js";
import {
  createPairing,
  PAIRING_POLL_INTERVAL_SECONDS,
  PAIRING_TTL_SECONDS
} from "../_lib/pairing.js";

// POST /api/devices/pair
//   -> { device_code, user_code, verification_uri, verification_uri_complete,
//        expires_in, interval }
//
// The slug-less front door. `autovault link` with no argument lands here: the
// CLI has a keypair and nothing else -- no slug, no account, no token -- and
// this hands back a code the owner will confirm in a browser that IS
// authenticated. The session decides the vault; the human never types a slug.
//
// Signed by the key it is pairing, exactly like /v/<slug>/devices. That
// self-attestation is what makes the key an identity rather than a claim, and
// it is what binds the later token poll: a stolen device_code cannot be
// redeemed without the secret half.
//
// This path must never redirect. The CLI fetches with `redirect: "manual"` and
// throws on any 3xx -- see tests/publicSurface.test.ts, which pins it.
export async function onRequestPost(context) {
  return handleApi(async () => {
    const { request, env } = context;
    const publicKey = await verifySignedDeviceRequest(request);

    const body = await readJson(request, 8_000);
    // Same rule as enrollment: the signature proves possession of the header
    // key, so a body naming a different key is a caller trying to pair
    // something it cannot sign for.
    if (typeof body.public_key !== "string" || body.public_key !== publicKey) {
      throw new ApiError(400, "Pairing body must carry the same public key that signed the request.");
    }

    const hostname = typeof body.hostname === "string" && body.hostname.trim()
      ? body.hostname.trim().slice(0, 120)
      : null;

    const { deviceCode, userCode } = await createPairing(env, { publicKey, hostname });

    // Absolute, and on this origin. The CLI opens `verification_uri_complete`
    // only after `isCloudOriginUrl` agrees it belongs to the configured Cloud
    // origin, so a relative path or a foreign host silently stops the browser
    // ever opening -- the owner would see a code and no way to confirm it.
    const origin = new URL(request.url).origin;
    const verificationUri = `${origin}/cloud/pair`;

    return deviceJson({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
      expires_in: PAIRING_TTL_SECONDS,
      interval: PAIRING_POLL_INTERVAL_SECONDS
    });
  });
}
