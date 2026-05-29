-- Progressive onboarding state for the hosted-vault dashboard.
-- Both columns are nullable timestamps; null means "step not yet taken".
-- They drive the post-vault dashboard stages (connect CLI -> explore -> all set)
-- and persist progress so the correct stage renders on every visit, not just
-- in the current session.
alter table vaults add column cli_linked_at text;
alter table vaults add column early_access_at text;
