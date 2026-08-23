-- Device enrollment for HTTPS catalog sync.
--
-- Replaces the honour-system `vaults.cli_linked_at` checkbox with real
-- enrollment: a machine running `autovault link <slug>` posts its ed25519
-- public key, lands here as `pending`, and the vault owner admits it from the
-- Cloud console. The key is the identity -- there is no shared secret and no
-- bearer token, so every later request is signed with it.
--
-- Beta scope is deliberately devices, not members: pending / active / revoked
-- on one owner's vault. No roles, no invitations.

create table if not exists sync_devices (
  id text primary key,
  vault_id text not null references vaults(id) on delete cascade,
  -- base64url-encoded ed25519 public key, exactly as the CLI sends it in
  -- X-AutoVault-Device. Stored verbatim so the header can be matched without
  -- re-encoding, which is where encoding bugs hide.
  public_key text not null,
  status text not null default 'pending',
  -- The CLI does not send a hostname today; the column exists so it can start
  -- doing so without a migration, and the console renders it only when set.
  hostname text,
  first_seen_at text not null,
  last_seen_at text,
  admitted_at text,
  revoked_at text
);

-- One row per key per vault. Re-running `autovault link` with the same key
-- must find the existing row rather than pile up duplicates, and admitting a
-- device must be unambiguous.
create unique index if not exists idx_sync_devices_vault_key
  on sync_devices(vault_id, public_key);

-- The console lists pending devices for one vault, newest first.
create index if not exists idx_sync_devices_vault_status
  on sync_devices(vault_id, status, first_seen_at);
