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
    `insert into trial_claims (user_id, session_id, claimed_at)
     values (?, ?, ?)
     on conflict(user_id) do nothing
     returning user_id`,
    userId,
    sessionId,
    nowIso(),
  );
  return Boolean(row);
}

export async function getTrialClaim(env, userId) {
  if (!userId) return null;
  return first(
    env,
    "select user_id, session_id, claimed_at from trial_claims where user_id = ?",
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

// A claim is only released once the caller has established that the offer
// lapsed: no subscription anywhere and no open session carrying it. Releasing
// on any weaker evidence would hand out a second trial, which is the whole
// thing this table exists to prevent.
export async function releaseTrialClaim(env, userId) {
  if (!userId) return;
  await run(env, "delete from trial_claims where user_id = ?", userId);
}
