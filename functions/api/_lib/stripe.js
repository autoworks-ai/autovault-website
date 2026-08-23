import { ApiError, safeReturnTo } from "./http.js";
import { first, nowIso, run } from "./db.js";
import { hmacSha256Hex, timingSafeEqualHex } from "./crypto.js";

export const STRIPE_API_VERSION = "2026-02-25.clover";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function isPaidStatus(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status || "");
}

export function buildHostedVaultCheckoutParams({ request, env, user, source = "hosted-vault" }) {
  if (!env.AUTOVAULT_HOSTED_PRICE_ID) throw new ApiError(503, "AUTOVAULT_HOSTED_PRICE_ID is not configured.");

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/cloud?hosted=success&session_id={CHECKOUT_SESSION_ID}#launch-path`;
  const cancelUrl = `${origin}/cloud?hosted=cancelled#launch-path`;
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("client_reference_id", user.id);
  params.set("line_items[0][price]", env.AUTOVAULT_HOSTED_PRICE_ID);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("metadata[user_id]", user.id);
  params.set("metadata[source]", source);
  params.set("subscription_data[metadata][user_id]", user.id);
  params.set("subscription_data[metadata][source]", source);
  params.set("submit_type", env.STRIPE_CHECKOUT_SUBMIT_TYPE || "subscribe");
  if (user.email) params.set("customer_email", user.email);

  applyBranding(params, env);
  applyCustomText(params, env);
  return params;
}

export async function createCheckoutSession(env, params, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION
    },
    body: params
  });
  const payload = await response.json();
  if (!response.ok || !payload.url) throw new ApiError(502, payload.error?.message || "Stripe Checkout Session creation failed.");
  return payload;
}

// The Stripe customer id for a user, or null when they have never had a
// billing relationship.
//
// This reads `customers` and DELIBERATELY does not fall back to
// `subscriptions.stripe_customer_id`, even though that column often holds the
// same value. When a Stripe customer is reassigned between users,
// upsertCustomer (below) revokes the stale owner by forcing their
// subscriptions.status to 'canceled' -- which leaves their
// subscriptions.stripe_customer_id populated -- and then deletes their
// `customers` row. A fallback would therefore hand a revoked owner a live
// billing-portal session for a Stripe customer that now belongs to somebody
// else: their invoices, their saved cards, and the ability to cancel their
// subscription. `customers` is the only table whose ABSENCE of a row
// correctly means "no live billing relationship".
export async function getStripeCustomerId(env, userId) {
  if (!userId) return null;
  const row = await first(env, "select stripe_customer_id from customers where user_id = ?", userId);
  return row?.stripe_customer_id ?? null;
}

export function buildBillingPortalParams({ request, env, customerId, returnTo }) {
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set("customer", customerId);
  // safeReturnTo pins to autovault.dev and hands back a PATH; re-basing that
  // path on the live request origin is what keeps the return correct on
  // *.pages.dev previews and on 127.0.0.1:8788 as well as in production.
  params.set("return_url", new URL(safeReturnTo(returnTo), origin).toString());
  if (env.STRIPE_PORTAL_CONFIGURATION_ID) {
    params.set("configuration", env.STRIPE_PORTAL_CONFIGURATION_ID);
  }
  return params;
}

export async function createBillingPortalSession(env, params, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION
    },
    body: params
  });
  const payload = await response.json();
  if (!response.ok || !payload.url) {
    throw new ApiError(502, payload.error?.message || "Stripe billing portal session creation failed.");
  }
  return payload;
}

export async function verifyStripeSignature(payload, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;
  const parts = parseStripeSignatureHeader(signatureHeader);
  if (!parts.timestamp || parts.signatures.length === 0) return false;
  if (Math.abs(nowSeconds - parts.timestamp) > toleranceSeconds) return false;

  const expected = await hmacSha256Hex(secret, `${parts.timestamp}.${payload}`);
  return parts.signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

// Stripe guarantees at-least-once delivery, so the same event id can arrive
// several times.
export async function isStripeEventClaimed(env, event) {
  if (!event?.id) return false;
  const row = await first(env, "select 1 from stripe_events where event_id = ?", event.id);
  return Boolean(row);
}

// Insert-or-ignore. Called only AFTER the corresponding state write succeeds
// (see handleStripeEvent) so a transient D1 failure mid-write cannot leave an
// event permanently marked "claimed" with its effect never applied — Stripe's
// retry would otherwise see the claim, skip reprocessing, and the subscription/
// customer state loss would be permanent. `on conflict do nothing` still
// matters here: two concurrent deliveries of the same event can both pass the
// claimed-check, both apply the same idempotent write, and then race on this
// insert; the second is a harmless no-op rather than an error.
export async function claimStripeEvent(env, event) {
  if (!event?.id) return false;
  const result = await run(env, `
    insert into stripe_events (event_id, event_type, created, received_at)
    values (?, ?, ?, ?)
    on conflict(event_id) do nothing
  `, event.id, event.type || "unknown", Number(event.created) || 0, nowIso());
  return (result?.meta?.changes ?? 0) > 0;
}

export async function handleStripeEvent(env, event) {
  if (await isStripeEventClaimed(env, event)) return { stored: false, duplicate: true };

  let stored = false;

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.client_reference_id || session?.metadata?.user_id;
    if (userId && session?.customer) {
      await upsertCustomer(env, { userId, customerId: asId(session.customer) });
      stored = true;
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created" || event.type === "customer.subscription.deleted") {
    const subscription = event.data?.object;
    // `customers` is our live, current-owner mapping; `subscription.metadata`
    // is baked in once at creation and never updated. If a Stripe customer is
    // later reassigned to a different user (see upsertCustomer), the OLD
    // subscription object keeps pointing at the ORIGINAL user forever via its
    // metadata -- preferring metadata here would let any later event for that
    // same subscription silently re-associate it with the old owner and undo
    // the reassignment's revoke. The customer mapping is checked first for
    // that reason; metadata is only the bootstrap fallback for the moment a
    // brand-new subscription's webhook can race ahead of its own
    // checkout.session.completed writing the customers row.
    const userId = await userIdForCustomer(env, asId(subscription?.customer)) || subscription?.metadata?.user_id;
    if (userId && subscription?.id) {
      await upsertSubscription(env, {
        userId,
        subscriptionId: subscription.id,
        customerId: asId(subscription.customer),
        status: subscription.status,
        priceId: priceIdForSubscription(subscription),
        currentPeriodEnd: currentPeriodEndFor(subscription),
        eventCreated: Number(event.created) || null
      });
      stored = true;
    }
  }

  // Claim only after the write above has actually landed. If upsertCustomer/
  // upsertSubscription throws, we never reach this line, the event stays
  // unclaimed, and Stripe's retry reprocesses it correctly instead of hitting
  // a permanently "already handled" no-op.
  await claimStripeEvent(env, event);
  return { stored };
}

export async function upsertCustomer(env, { userId, customerId }) {
  if (!userId || !customerId) return false;
  // customers.stripe_customer_id is UNIQUE, but the upsert below resolves
  // conflicts on user_id. If this Stripe customer is currently mapped to a
  // DIFFERENT user row (duplicate Stripe customer, account switch, test/live
  // crossover) the UNIQUE constraint raises an uncaught D1 error, handleApi
  // turns it into a 500, and Stripe retries the webhook against the same 500
  // forever. The incoming event is authoritative about who owns this
  // customer now, so the old mapping has to go -- but revoke the old
  // owner's subscription first (below), not after.
  const stale = await first(env, "select user_id from customers where stripe_customer_id = ? and user_id <> ?", customerId, userId);
  if (stale?.user_id) {
    // Revoke BEFORE releasing the stale mapping below, not after. A
    // transient D1 failure between the two would otherwise leave the
    // customers row deleted but the old owner's subscription untouched — on
    // retry, this `select` finds nothing (the row is already gone), so
    // revocation is silently skipped and paid access survives indefinitely.
    // Revoking first means a failure between these two statements leaves the
    // stale customers row in place, so a retry's `select` still finds it and
    // re-applies the (idempotent) revoke.
    await run(
      env,
      "update subscriptions set status = 'canceled', updated_at = ? where user_id = ? and stripe_customer_id = ?",
      nowIso(),
      stale.user_id,
      customerId
    );
  }
  await run(
    env,
    "delete from customers where stripe_customer_id = ? and user_id <> ?",
    customerId,
    userId
  );
  await run(env, `
    insert into customers (user_id, stripe_customer_id, created_at, updated_at)
    values (?, ?, ?, ?)
    on conflict(user_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      updated_at = excluded.updated_at
  `, userId, customerId, nowIso(), nowIso());
  return true;
}

export async function upsertSubscription(env, { userId, subscriptionId, customerId, status, priceId, currentPeriodEnd, eventCreated = null }) {
  if (!userId || !subscriptionId) return false;
  // The `where` on the conflict clause is the out-of-order guard. Stripe can
  // deliver a stale `subscription.updated` (status "active") after a
  // `subscription.deleted`; applying it would silently restore paid access to
  // a cancelled account, because every 402 gate reads subscriptions.status.
  // Rows written before 0003 have a null last_event_created and accept the
  // next event of any age exactly once, then order normally from there.
  //
  // Strictly newer always wins; strictly older always loses. A genuine tie
  // (Stripe's `created` has only second-level precision, so two DIFFERENT
  // events for the same subscription — e.g. a cancellation and a stale
  // reactivation retry — can share a timestamp) cannot be ordered by time
  // alone, so break it on status instead of arrival order: a non-paid
  // incoming status is allowed through (fail closed — prefer revoking access
  // on ambiguity), a paid incoming status is rejected (does not grant access
  // on ambiguity). A first plain "or" on time was tried and rejected here:
  // unconditionally dropping every tie just moves the bug — a genuine
  // same-second cancellation arriving after a same-second "active" would
  // then itself be dropped, leaving the account wrongly active.
  const incomingIsPaid = isPaidStatus(status) ? 1 : 0;
  await run(env, `
    insert into subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, price_id, current_period_end, last_event_created, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do update set
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_customer_id = excluded.stripe_customer_id,
      status = excluded.status,
      price_id = excluded.price_id,
      current_period_end = excluded.current_period_end,
      last_event_created = excluded.last_event_created,
      updated_at = excluded.updated_at
    where excluded.last_event_created is null
       or subscriptions.last_event_created is null
       or excluded.last_event_created > subscriptions.last_event_created
       or (excluded.last_event_created = subscriptions.last_event_created and ? = 0)
  `, userId, subscriptionId, customerId || null, status || null, priceId || null, currentPeriodEnd || null, eventCreated, nowIso(), nowIso(), incomingIsPaid);
  return true;
}

export async function retrieveCheckoutSession(env, sessionId, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  if (!sessionId) throw new ApiError(400, "session_id is required.");

  const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  url.searchParams.append("expand[]", "subscription");
  url.searchParams.append("expand[]", "customer");

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "stripe-version": STRIPE_API_VERSION
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(response.status === 404 ? 404 : 502, payload.error?.message || "Stripe session lookup failed.");
  return payload;
}

export { asId, currentPeriodEndFor, priceIdForSubscription };

function applyBranding(params, env) {
  params.set("branding_settings[display_name]", env.STRIPE_BRAND_DISPLAY_NAME || "AutoVault");
  params.set("branding_settings[background_color]", env.STRIPE_BRAND_BACKGROUND_COLOR || "#0b1014");
  params.set("branding_settings[button_color]", env.STRIPE_BRAND_BUTTON_COLOR || "#5ad6c0");
  params.set("branding_settings[border_style]", env.STRIPE_BRAND_BORDER_STYLE || "rounded");
  params.set("branding_settings[font_family]", env.STRIPE_BRAND_FONT_FAMILY || "inter");
  if (env.STRIPE_BRAND_ICON_URL) {
    params.set("branding_settings[icon][type]", "url");
    params.set("branding_settings[icon][url]", env.STRIPE_BRAND_ICON_URL);
  }
  if (env.STRIPE_BRAND_LOGO_URL) {
    params.set("branding_settings[logo][type]", "url");
    params.set("branding_settings[logo][url]", env.STRIPE_BRAND_LOGO_URL);
  }
}

function applyCustomText(params, env) {
  if (env.STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT) {
    params.set("custom_text[submit][message]", env.STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT);
  }
  if (env.STRIPE_CHECKOUT_CUSTOM_TEXT_AFTER_SUBMIT) {
    params.set("custom_text[after_submit][message]", env.STRIPE_CHECKOUT_CUSTOM_TEXT_AFTER_SUBMIT);
  }
}

function parseStripeSignatureHeader(header) {
  const parts = { timestamp: 0, signatures: [] };
  for (const pair of header.split(",")) {
    const [key, value] = pair.split("=");
    if (key === "t") parts.timestamp = Number(value);
    if (key === "v1" && value) parts.signatures.push(value);
  }
  return parts;
}

async function userIdForCustomer(env, customerId) {
  if (!customerId) return null;
  const row = await first(env, "select user_id from customers where stripe_customer_id = ?", customerId);
  return row?.user_id ?? null;
}

function asId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

// Stripe moved `current_period_end` off the subscription and onto each
// subscription item. Read the item first and fall back to the legacy
// top-level field so this works either side of that migration; returning null
// silently (the previous behaviour) meant every subscriber stored a null
// period end with nothing to notice it.
function currentPeriodEndFor(subscription) {
  const fromItem = subscription?.items?.data?.[0]?.current_period_end;
  return fromItem ?? subscription?.current_period_end ?? null;
}

function priceIdForSubscription(subscription) {
  return subscription.items?.data?.[0]?.price?.id || null;
}
