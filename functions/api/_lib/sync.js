import { first, nowIso, run } from "./db.js";
import { ApiError } from "./http.js";

// Header names are fixed by the CLI (SYNC_DEVICE_HEADERS in the client's
// sync/contract.ts). Lower-cased because Headers.get is case-insensitive but
// the constants are read by tests that compare against the client's spelling.
export const DEVICE_HEADERS = {
  device: "x-autovault-device",
  timestamp: "x-autovault-timestamp",
  signature: "x-autovault-signature"
};

// The signed message covers a timestamp and nothing else that expires, so
// without a window a captured header set is a permanent bearer token for that
// exact method and path. Five minutes absorbs real clock drift on a laptop
// while keeping a stolen header short-lived.
//
// This bounds replay, it does not prevent it: the same signature replays
// freely inside the window. Closing that needs a seen-nonce store, which is
// deliberately out of beta scope -- noted here rather than half-built.
export const DEVICE_TIMESTAMP_SKEW_SECONDS = 300;

const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

// Matches the CLI's own rendering (`shortKey` in cli/link.ts) exactly, U+2026
// included. The owner reads this off their terminal and matches it against the
// console, so a different abbreviation makes the two unmatchable.
export function deviceFingerprint(publicKey) {
  if (typeof publicKey !== "string" || publicKey.length < 10) return publicKey ?? "";
  return `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
}

export function decodeBase64Url(value, expectedBytes) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  if (expectedBytes !== undefined && binary.length !== expectedBytes) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

// The exact bytes the CLI signs: "<METHOD>\n<pathname>\n<unix-seconds>".
export function deviceRequestMessage(method, pathname, timestamp) {
  return `${method.toUpperCase()}\n${pathname}\n${timestamp}`;
}

export async function verifyDeviceSignature(publicKey, message, signature) {
  const keyBytes = decodeBase64Url(publicKey, ED25519_PUBLIC_KEY_BYTES);
  const signatureBytes = decodeBase64Url(signature, ED25519_SIGNATURE_BYTES);
  if (!keyBytes || !signatureBytes) return false;
  try {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );
  } catch {
    return false;
  }
}

// Character class only, with a generous length bound.
//
// This started as the CLI's own CLOUD_SLUG_PATTERN, which caps at 63 -- but
// vaultSlugForUser can mint longer slugs (it appends "-" plus six characters
// without truncating the base), so that cap would have 404'd every sync route
// for those users. The query is parameterised, so the length bound is only
// here to stop an absurd path segment reaching D1, not to define validity.
//
// The real defect is upstream: provisioning can create a slug the CLI cannot
// type. Tracked separately -- it predates this route and is not fixed by
// loosening a regex here.
const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]{0,199}$/;

export async function getVaultBySlug(env, slug) {
  if (typeof slug !== "string" || !SLUG_SHAPE.test(slug)) return null;
  return first(env, `
    select id, user_id, slug, status, public_url
    from vaults
    where slug = ?
  `, slug);
}

// First contact is unauthenticated by design -- it has to be, the machine has
// no credential yet and the slug is public. That means anyone who knows a slug
// can mint keypairs in a loop and insert a row per key, growing D1 without
// bound and burying the owner's real pending device in noise.
//
// A cap is the blunt version of a rate limiter and it is what beta gets: it
// bounds the damage to something the owner can clear, and it cannot lock out a
// legitimate machine, because admitting or denying anything frees a slot. A
// real limiter belongs at the edge, not in a D1 count.
export const MAX_PENDING_DEVICES_PER_VAULT = 20;

export async function countPendingDevices(env, vaultId) {
  const row = await first(env, `
    select count(*) as pending from sync_devices where vault_id = ? and status = 'pending'
  `, vaultId);
  return Number(row?.pending ?? 0);
}

export async function getDeviceByKey(env, vaultId, publicKey) {
  return first(env, `
    select id, vault_id, public_key, status, hostname, first_seen_at, last_seen_at, admitted_at, revoked_at
    from sync_devices
    where vault_id = ? and public_key = ?
  `, vaultId, publicKey);
}

/**
 * Verify the signature on a device request and resolve which vault and device
 * it belongs to. Does NOT decide whether that device may proceed -- each route
 * applies its own status rule, because they differ: enrollment accepts an
 * unknown key, the catalog accepts pending or active, a bundle accepts only
 * active.
 *
 * @returns {Promise<{ vault: any, device: any | null, publicKey: string }>}
 */
export async function authenticateDeviceRequest(request, env, slug) {
  const publicKey = request.headers.get(DEVICE_HEADERS.device);
  const timestamp = request.headers.get(DEVICE_HEADERS.timestamp);
  const signature = request.headers.get(DEVICE_HEADERS.signature);
  if (!publicKey || !timestamp || !signature) {
    throw new ApiError(401, "Device signature headers are missing.");
  }

  if (!/^\d{1,15}$/.test(timestamp)) {
    throw new ApiError(401, "Device timestamp must be whole seconds since the epoch.");
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (skew > DEVICE_TIMESTAMP_SKEW_SECONDS) {
    throw new ApiError(401, "Device timestamp is outside the accepted window.");
  }

  // Sign over the pathname the client actually requested, read back off the
  // request. Rebuilding it from the route params would diverge the instant
  // anything rewrites, normalises a trailing slash, or re-encodes a segment --
  // and the failure would look like a bad signature rather than a bad path.
  const pathname = new URL(request.url).pathname;
  const message = deviceRequestMessage(request.method, pathname, timestamp);
  if (!(await verifyDeviceSignature(publicKey, message, signature))) {
    throw new ApiError(401, "Device signature is not valid for this request.");
  }

  const vault = await getVaultBySlug(env, slug);
  if (!vault) throw new ApiError(404, "No such vault.");

  return { vault, device: await getDeviceByKey(env, vault.id, publicKey), publicKey };
}

// One D1 write per poll would be a write every 1.5s for the whole time the CLI
// spinner is up. Coarse to the minute instead: the console only needs "seen
// recently", not a millisecond.
const LAST_SEEN_RESOLUTION_MS = 60_000;

export async function touchDevice(env, device) {
  if (!device) return;
  const last = device.last_seen_at ? Date.parse(device.last_seen_at) : 0;
  if (Number.isFinite(last) && Date.now() - last < LAST_SEEN_RESOLUTION_MS) return;
  await run(env, "update sync_devices set last_seen_at = ? where id = ?", nowIso(), device.id);
}

// Authorized, per-device content. Never `public` -- an edge cache keyed on URL
// alone would hand one device's catalog to a device that is not admitted.
export function deviceJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff"
    }
  });
}

export function catalogKey(vaultId) {
  return `sync:${vaultId}:catalog`;
}

export function bundleKey(vaultId, bundleHash) {
  return `sync:${vaultId}:bundle:${bundleHash}`;
}
