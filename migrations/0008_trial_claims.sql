-- One row per account that has been OFFERED a trial, written when the Checkout
-- Session is issued rather than when it completes.
--
-- Everything else that answers "has this account had a trial" learns too late.
-- The subscriptions row is written by the billing webhook after a session
-- completes; Stripe has no subscription until then either. Between issuing a
-- session and finishing it there was nothing to find, so two overlapping
-- requests both saw an eligible account and both got a trial.
--
-- The primary key is the claim. `insert ... on conflict do nothing` makes D1
-- arbitrate, which is the one place in this stack that can do it atomically.
--
-- session_id and claimed_at exist so a claim can be RELEASED rather than being
-- a life sentence: a session that expired without completing means the trial
-- was offered and never taken, and that account should be able to try again.
create table if not exists trial_claims (
  user_id text primary key references users(id) on delete cascade,
  session_id text,
  claimed_at text not null
);
