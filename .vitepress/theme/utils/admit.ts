/**
 * The browser half of the CLI admit handshake.
 *
 * `autovault link` enrols a machine and then opens
 * `/cloud?admit=<url-encoded fingerprint>`, so the owner lands on the exact row
 * that is waiting on them instead of hunting for it. This is GitHub's
 * `verification_uri_complete` pattern: the URL carries the code, and a human
 * still clicks.
 *
 * The fingerprint IS the code. There is no second table and no separate
 * user_code to keep in sync, so everything here is pure string work over the
 * device list the page already loads.
 *
 * What this deliberately does NOT do is admit anything. The param selects a
 * row; only the owner's click on Admit changes a device's status. A URL that
 * admitted on load would make any link the CLI printed — or anything that
 * copied it — a working credential.
 */

export const ADMIT_PARAM = "admit";

export interface AdmitCandidate {
  id: string;
  fingerprint: string;
  status: string;
}

/**
 * `idle`    — no handshake in progress.
 * `waiting` — the CLI told us a fingerprint, but its row has not arrived yet.
 *             Expected: the CLI enrols and *then* opens the browser, so the
 *             page frequently wins that race by a poll interval or two.
 * `ready`   — the matching row is pending and is the one to highlight.
 * `settled` — a device with that fingerprint exists and is no longer pending.
 *             Either it was just admitted or it was denied; both mean stop
 *             nagging, and neither is an error.
 */
export type AdmitState = "idle" | "waiting" | "ready" | "settled";

/**
 * Pull the fingerprint out of a `location.search`.
 *
 * `URLSearchParams` percent-decodes for us, which is what the contract asks
 * for. Its one divergence from `decodeURIComponent` — turning `+` into a
 * space — cannot bite here: a fingerprint is base64url either side of U+2026,
 * and the base64url alphabet has no `+`.
 */
export function readAdmitFingerprint(search: string): string | null {
  if (!search) return null;
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get(ADMIT_PARAM);
  } catch {
    return null;
  }
  const fingerprint = raw?.trim() ?? "";
  return fingerprint ? fingerprint : null;
}

/**
 * The pending device this handshake is for, or null.
 *
 * Pending only, and exact-match only. Two machines can sit pending at once and
 * admitting the wrong one hands vault access to whichever box the owner did
 * not mean — so an unrecognised fingerprint selects nothing rather than
 * falling back to "the one that is waiting".
 */
export function findAdmitTarget(
  devices: readonly AdmitCandidate[],
  fingerprint: string | null
): AdmitCandidate | null {
  if (!fingerprint) return null;
  return (
    devices.find(
      (device) => device.status === "pending" && device.fingerprint?.trim() === fingerprint
    ) ?? null
  );
}

export function admitHandshakeState(
  devices: readonly AdmitCandidate[],
  fingerprint: string | null
): AdmitState {
  if (!fingerprint) return "idle";
  if (findAdmitTarget(devices, fingerprint)) return "ready";
  const known = devices.some((device) => device.fingerprint?.trim() === fingerprint);
  return known ? "settled" : "waiting";
}

/**
 * Carry `?admit=` across a sign-in round trip.
 *
 * A signed-out owner following the CLI's link gets sent to Clerk and back, and
 * the return URL is a constant — so without this the fingerprint is dropped
 * exactly once, at the only moment it was needed, and the handshake silently
 * degrades to "go find the row yourself".
 *
 * The path may carry a hash (`/cloud#launch-path` is the shipped default, and
 * Stripe's return URLs target it), so the query has to be spliced in ahead of
 * the fragment rather than appended.
 */
export function withAdmitParam(path: string, search: string): string {
  const fingerprint = readAdmitFingerprint(search);
  if (!fingerprint) return path;

  const hashAt = path.indexOf("#");
  const base = hashAt === -1 ? path : path.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : path.slice(hashAt);
  const separator = base.includes("?") ? "&" : "?";

  return `${base}${separator}${ADMIT_PARAM}=${encodeURIComponent(fingerprint)}${hash}`;
}
