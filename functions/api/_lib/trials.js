import { first, nowIso, run } from "./db.js";

// Trial eligibility, claimed at the moment a trial is OFFERED.
//
// Everything else that can answer "has this account had a trial" learns too
// late. The local subscriptions row is written by the billing webhook after a
// Checkout Session completes, and Stripe has no subscription until then either,
// so between issuing a session and finishing it there was nothing to find and
// two overlapping requests both got one.
//
// The primary key on trial_claims is the arbiter. `on conflict do nothing` plus
// `returning` makes the answer unambiguous: a row back means this call won.

// True when this call is the one that claimed the trial.
/**
 * @param {Record<string, unknown>} env
 * @param {string} userId
 * @param {string | null} [sessionId]
 */
export async function claimTrial(env, userId, sessionId = null) {
  const row = await first(
    env,
    `insert into trial_claims (user_id, session_id, claimed_at, claim_token)
     values (?, ?, ?, ?)
     on conflict(user_id) do nothing
     returning user_id`,
    userId,
    sessionId,
    nowIso(),
    crypto.randomUUID(),
  );
  return Boolean(row);
}

export async function getTrialClaim(env, userId) {
  if (!userId) return null;
  // claim_token is the identity. Two weaker ones were tried and both collide:
  // claimed_at repeats when two claims land inside the same millisecond, and
  // SQLite reuses a rowid once the row it belonged to is deleted, which is
  // exactly the delete-then-insert this path performs.
  return first(
    env,
    "select user_id, session_id, claimed_at, claim_token from trial_claims where user_id = ?",
    userId,
  );
}

// Records which session the claim was spent on, so a later reader can tell a
// claim that is waiting on an open checkout from one whose checkout is gone.
export async function attachTrialSession(env, userId, sessionId) {
  if (!userId || !sessionId) return;
  await run(
    env,
    "update trial_claims set session_id = ? where user_id = ?",
    sessionId,
    userId,
  );
}

// How long a claim with no session attached is treated as still being worked
// on. Creating a Stripe Checkout Session is one network call; two minutes is
// generous for it and short enough that a request which died mid-create only
// blocks that account briefly rather than for good.
export const IN_FLIGHT_MS = 120_000;

// A claim that has been made but whose session does not exist yet, because the
// request that won it is still talking to Stripe.
//
// This distinction is the whole correctness of the release path. The first
// version released any claim it found once it had established there was no
// subscription and no open session, and called that claim provably stale. It
// was not: request A inserts its claim and pauses to create a session, so
// request B sees no session in Stripe, deletes A's claim as stale, claims for
// itself, and both hand out a trial. The delete defeated the primary key it
// was there to respect.
export function isTrialClaimInFlight(claim, now = Date.now()) {
  if (!claim || claim.session_id) return false;
  const claimedAt = Date.parse(claim.claimed_at ?? "");
  if (Number.isNaN(claimedAt)) return false;
  return now - claimedAt < IN_FLIGHT_MS;
}

// Released only against the exact claim the caller looked at.
//
// If anything re-claimed in between, the rowid differs and this deletes nothing
// rather than throwing away a live claim it never saw. An unconditional delete
// here is how the race got back in.
export async function releaseTrialClaim(env, userId, claim) {
  if (!userId || !claim) return;

  // A row written under 0008, before claim_token existed. Refusing outright was
  // the first version and it strands the account rather than the claim: the
  // release becomes a permanent no-op, the next claimTrial conflicts on
  // user_id, and checkout answers 409 for that user forever. 0010 backfills
  // these, so this branch should find nothing; it stays because a database that
  // has not run 0010 yet must not brick an account either.
  //
  // `claim_token is null` is an exact match despite carrying no token, because
  // user_id is the primary key: there is one row per account, and any claim
  // made since this one was read carries a token and cannot be hit by it.
  if (!claim.claim_token) {
    await run(
      env,
      "delete from trial_claims where user_id = ? and claim_token is null",
      userId,
    );
    return;
  }

  await run(
    env,
    "delete from trial_claims where user_id = ? and claim_token = ?",
    userId,
    claim.claim_token,
  );
}
