-- Give every claim written under 0008 a token.
--
-- 0009 added claim_token as nullable, because a column added to an existing
-- table has to be. releaseTrialClaim refuses to act without one, on purpose: a
-- release that cannot identify its target is how a live claim gets deleted. But
-- that refusal is permanent for a row that predates the column, and the
-- consequence is not a stuck trial, it is a stuck account. The claim can never
-- be released, the next claimTrial conflicts on user_id, and checkout answers
-- 409 for that user forever.
--
-- randomblob is SQLite's own source: no application code has to run for this,
-- and the backfill lands with the migration rather than depending on a deploy.
update trial_claims
set claim_token = lower(hex(randomblob(16)))
where claim_token is null;
