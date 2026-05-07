create table if not exists users (
  id text primary key,
  provider text not null,
  provider_user_id text not null,
  email text,
  name text,
  avatar_url text,
  created_at text not null,
  updated_at text not null,
  unique(provider, provider_user_id)
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at text not null,
  created_at text not null
);

create table if not exists oauth_states (
  state text primary key,
  provider text not null,
  return_to text not null,
  expires_at text not null,
  created_at text not null
);

create table if not exists customers (
  user_id text primary key references users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at text not null,
  updated_at text not null
);

create table if not exists subscriptions (
  user_id text primary key references users(id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_customer_id text,
  status text not null,
  price_id text,
  current_period_end integer,
  created_at text not null,
  updated_at text not null
);

create table if not exists vaults (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  slug text not null unique,
  status text not null,
  public_url text not null,
  created_at text not null,
  provisioned_at text
);

create table if not exists pending_skills (
  id text primary key,
  vault_id text not null references vaults(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  version text,
  source_label text,
  source_hash text,
  source_text text,
  signature text,
  queued_skills_json text not null default '[]',
  created_at text not null
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_oauth_states_expires_at on oauth_states(expires_at);
create index if not exists idx_pending_skills_vault_id on pending_skills(vault_id);
