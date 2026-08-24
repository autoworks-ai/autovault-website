import { first, run, nowIso, isoAfter } from "./db.js";
import { ApiError } from "./http.js";
import { randomToken } from "./crypto.js";

// RFC 8628 §6.1: a user code the owner reads off a terminal and types or
// matches in a browser, so the alphabet drops every pair a human confuses --
// no 0/O, no 1/I/L, no vowels at all, which also means no code can spell a
// word. Twenty letters, eight characters: ~2.6e10 codes.
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
const USER_CODE_GROUP = 4;
const USER_CODE_GROUPS = 2;

// Fifteen minutes. Long enough to walk to another machine and sign in, short
// enough that an abandoned code on a shared screen stops meaning anything.
export const PAIRING_TTL_SECONDS = 900;

// What the CLI is TOLD to sleep between polls, and it obeys it -- see
// completeCloudPairing in the client. Pages Functions bill per request, and
// the reference test server advertises `interval: 0`, which would be a tight
// loop for the entire fifteen minutes. Five seconds is ~180 polls per pairing
// worst case, and the owner never perceives it because the confirm click and
// the next poll are at most five seconds apart.
export const PAIRING_POLL_INTERVAL_SECONDS = 5;

// How long a confirmed pairing stays redeemable past its own expiry. Generous
// on purpose: the cost of keeping a spent row is one dead SQLite row, and the
// cost of dropping it early is telling someone their machine failed to link
// when it is sitting admitted in their console.
export const PAIRING_REDEEM_GRACE_SECONDS = 86_400;

// A slug-less, self-signed endpoint is a global mint surface: anybody with a
// keypair can create rows. Cap live pairings per KEY rather than per vault,
// because at mint time there is no vault yet. Confirming, denying or expiring
// frees a slot, and a caller who wants more only ever floods themselves.
//
// This is NOT a rate limit and must not be read as one. Generating a keypair is
// free, so anyone flooding the mint surface simply uses a fresh key per request
// and never trips this cap. What it actually buys is that a single well-behaved
// CLI cannot pile up rows by re-running `autovault link`. Bounding the mint
// surface itself needs an edge rule -- the same gap MAX_PENDING_DEVICES_PER_VAULT
// in _lib/sync.js already notes for enrollment.
export const MAX_LIVE_PAIRINGS_PER_KEY = 5;

export function generateUserCode() {
  const bytes = new Uint8Array(USER_CODE_GROUP * USER_CODE_GROUPS);
  crypto.getRandomValues(bytes);
  const groups = [];
  for (let g = 0; g < USER_CODE_GROUPS; g += 1) {
    let group = "";
    for (let i = 0; i < USER_CODE_GROUP; i += 1) {
      // Modulo bias over a 20-letter alphabet from 256 values is under 0.4% on
      // the last four letters. It is not a secret -- the device_code is -- so
      // the property that matters is legibility, not uniformity.
      group += USER_CODE_ALPHABET[bytes[g * USER_CODE_GROUP + i] % USER_CODE_ALPHABET.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}

// Codes are retired by deletion rather than by a partial index, because a
// partial index cannot express "expired" -- a time comparison is not immutable
// and SQLite will not index one. Runs on the mint path, which is the only
// place that needs a free code.
export async function prunePairings(env, publicKey) {
  // Unconfirmed codes die at expiry. Confirmed ones deliberately outlive it:
  // the CLI can still be mid-poll when the TTL lapses, and deleting the row out
  // from under it would report a machine that IS admitted as a failed link.
  // They are retired on the owning key's next mint just below, with the
  // retention window as the backstop for a key that never mints again.
  await run(env, "delete from device_pairings where expires_at <= ? and confirmed_at is null", nowIso());
  await run(
    env,
    "delete from device_pairings where confirmed_at is not null and expires_at <= ?",
    isoAfter(-PAIRING_REDEEM_GRACE_SECONDS)
  );
  if (publicKey) {
    await run(
      env,
      "delete from device_pairings where public_key = ? and (confirmed_at is not null or denied_at is not null)",
      publicKey
    );
  }
}

export async function countLivePairings(env, publicKey) {
  const row = await first(
    env,
    "select count(*) as live from device_pairings where public_key = ? and expires_at > ?",
    publicKey,
    nowIso()
  );
  return Number(row?.live ?? 0);
}

export async function createPairing(env, { publicKey, hostname }) {
  await prunePairings(env, publicKey);
  if ((await countLivePairings(env, publicKey)) >= MAX_LIVE_PAIRINGS_PER_KEY) {
    throw new ApiError(429, "Too many pairing attempts for this device. Wait for the current code to expire.");
  }

  const deviceCode = randomToken(32);
  const expiresAt = isoAfter(PAIRING_TTL_SECONDS);
  // Retry on the unique index rather than pre-checking: a SELECT then INSERT
  // is a race, and at ~2.6e10 codes a second attempt is already unlikely.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userCode = generateUserCode();
    try {
      await run(
        env,
        `insert into device_pairings
           (device_code, user_code, public_key, hostname, created_at, expires_at)
         values (?, ?, ?, ?, ?, ?)`,
        deviceCode,
        userCode,
        publicKey,
        hostname ?? null,
        nowIso(),
        expiresAt
      );
      return { deviceCode, userCode, expiresAt };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new ApiError(503, "Could not allocate a pairing code. Try again.");
}

function isUniqueViolation(error) {
  return /unique constraint/i.test(String(error?.message ?? error));
}

export async function getPairingByDeviceCode(env, deviceCode) {
  return first(
    env,
    `select device_code, user_code, public_key, hostname, created_at, expires_at,
            confirmed_at, denied_at, vault_id, device_id
     from device_pairings where device_code = ?`,
    deviceCode
  );
}

export async function getPairingByUserCode(env, userCode) {
  return first(
    env,
    `select device_code, user_code, public_key, hostname, created_at, expires_at,
            confirmed_at, denied_at, vault_id, device_id
     from device_pairings where user_code = ?`,
    userCode
  );
}

// The owner typed or clicked this; accept the shape they actually produce --
// lowercase, spaces, a missing separator -- and normalise to storage form.
export function normalizeUserCode(value) {
  const cleaned = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== USER_CODE_GROUP * USER_CODE_GROUPS) return null;
  const groups = [];
  for (let i = 0; i < cleaned.length; i += USER_CODE_GROUP) {
    groups.push(cleaned.slice(i, i + USER_CODE_GROUP));
  }
  return groups.join("-");
}

export function pairingIsExpired(pairing) {
  return Date.parse(pairing.expires_at) <= Date.now();
}

// One shape for "what state is this pairing in", so the browser route and the
// token route cannot disagree about it.
export function pairingState(pairing) {
  if (!pairing) return "unknown";
  if (pairing.denied_at) return "denied";
  // Confirmed outranks expired, and the order is the whole point. The TTL
  // bounds how long an UNCONFIRMED code stays live; once the owner has
  // admitted the machine the grant is real and the device row exists. Checking
  // expiry first meant a confirm landing inside the last polling interval
  // admitted an active device and then told the CLI `expired_token` -- the two
  // ends disagreeing about whether the machine is linked, which is the one
  // outcome this flow must never produce.
  if (pairing.confirmed_at) return "confirmed";
  if (pairingIsExpired(pairing)) return "expired";
  return "pending";
}
