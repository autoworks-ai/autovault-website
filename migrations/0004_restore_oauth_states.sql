-- 0003 dropped `oauth_states` in the same migration batch that its CI run
-- also deploys the Functions removing the legacy OAuth routes. Migrations are
-- immutable once committed (AGENTS.md: "never edit existing migration
-- files"), so the fix for the resulting rollback-safety gap cannot be an edit
-- to 0003 -- it has to be a forward migration.
--
-- Recreating the table here closes the gap 0003 opened: if the Pages deploy
-- in that same CI run fails or gets rolled back after the migration step
-- succeeded, production would otherwise be serving the OLD Functions (which
-- still query oauth_states) against a schema where the table no longer
-- exists, turning every hit on the dead legacy routes into a database error.
-- With this migration applied immediately after 0003 (same `wrangler d1
-- migrations apply` run, same order every time), the net schema change from
-- this release is a no-op for oauth_states: it never actually disappears.
--
-- The table is still empty and still unused by any route in this release.
-- Drop it for good in a later migration once the route removal has been live
-- and stable for a while -- not bundled with the same deploy that removes the
-- code that reads it.
create table if not exists oauth_states (
  state text primary key,
  provider text not null,
  return_to text not null,
  expires_at text not null,
  created_at text not null
);

create index if not exists idx_oauth_states_expires_at on oauth_states(expires_at);
