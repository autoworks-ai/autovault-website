-- Stripe delivers webhooks at-least-once and out-of-order.
--
-- Without dedupe, a retried event is applied twice. Worse, without ordering,
-- a delayed `customer.subscription.updated` carrying status "active" can
-- arrive AFTER a `customer.subscription.deleted` and silently re-grant paid
-- access to a cancelled subscriber, because every gate keys off
-- subscriptions.status.
--
-- `stripe_events` closes the first hole: the primary key is Stripe's own
-- event id, so a replay is a no-op insert we can detect and skip.
create table if not exists stripe_events (
  event_id text primary key,
  event_type text not null,
  created integer not null,
  received_at text not null
);

-- Closes the second hole. `subscriptions` is keyed by user_id, so we cannot
-- rely on row identity to order updates; we store the `created` timestamp of
-- the event that last wrote the row and refuse to apply anything older.
-- Nullable so existing rows (written before this migration) accept the next
-- event of any age exactly once, then start ordering normally.
alter table subscriptions add column last_event_created integer;

create index if not exists idx_stripe_events_received_at on stripe_events(received_at);

-- The GitHub/Google OAuth routes that populated this table were removed: their
-- `state` was never bound to the requesting browser (no nonce cookie was set at
-- /api/auth/start or compared at the callback), so the parameter provided no
-- CSRF protection at all. Clerk is the only sign-in path now. Verified empty in
-- production before dropping.
drop table if exists oauth_states;
