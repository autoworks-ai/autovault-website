-- Slug-less device pairing (RFC 8628-shaped device authorization grant).
--
-- `autovault link <slug>` requires the owner to know and type a slug, and the
-- only thing standing between a stranger's enrollment and a wrongly-admitted
-- machine is the owner eyeballing an ed25519 fingerprint. Pairing replaces
-- both: the CLI mints a code against a slug-less endpoint, the owner confirms
-- that code in an already-authenticated browser, and the SESSION -- not a
-- typed string -- decides which vault the device lands on.
--
-- This cannot live in sync_devices: that table's vault_id is `not null`, and a
-- pairing exists precisely during the window where no vault is known yet. A
-- pairing is a claim; sync_devices is the grant it eventually produces.

create table if not exists device_pairings (
  -- The CLI's polling handle. Opaque, high-entropy, never shown to a human.
  device_code text primary key,
  -- The short string the human matches across terminal and browser. Unique
  -- globally rather than among live rows, because a partial index cannot
  -- reference "expired" (a time comparison is not immutable) -- so codes are
  -- retired by the prune in _lib/pairing.js instead.
  user_code text not null,
  -- base64url ed25519 public key, verbatim from X-AutoVault-Device, exactly as
  -- sync_devices stores it. The pairing is bound to the key that signed for
  -- it, so a stolen device_code is useless without the secret key.
  public_key text not null,
  hostname text,
  created_at text not null,
  expires_at text not null,
  -- Set when the owner confirms in the browser. Until then every token poll
  -- answers authorization_pending.
  confirmed_at text,
  -- An explicit refusal, which is NOT the same as expiry: the CLI is told
  -- access_denied and stops, rather than spinning to the deadline.
  denied_at text,
  -- Resolved at confirm time from the confirming user's own vault, never from
  -- anything the device sent.
  vault_id text references vaults(id) on delete cascade,
  device_id text references sync_devices(id) on delete set null
);

create unique index if not exists idx_device_pairings_user_code
  on device_pairings(user_code);

-- The token poll's lookup: by device_code, then matched against the signing
-- key. Covered by the primary key already; this one serves the mint-side cap
-- and prune, which count live pairings for one key.
create index if not exists idx_device_pairings_public_key
  on device_pairings(public_key, expires_at);
