import { ApiError, safeReturnTo } from "./http.js";
import { first, nowIso, run } from "./db.js";
import { hmacSha256Hex, timingSafeEqualHex } from "./crypto.js";

export const STRIPE_API_VERSION = "2026-02-25.clover";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function isPaidStatus(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status || "");
}

/**
 * Trial length in days, or 0 for no trial.
 *
 * One resolver, read by both the Checkout builder and /api/pricing, so the
 * number a visitor is shown is the number Stripe is asked for. A trial written
 * into copy that Checkout does not send is the exact failure this codebase
 * keeps auditing itself for, and a page cannot drift from a value it reads at
 * runtime from the same function.
 *
 * Env-driven rather than a constant, so the trial can be turned off in one
 * place without a deploy of new copy. Anything unparseable or negative reads
 * as no trial, because the safe failure here is charging normally rather than
 * silently granting free months.
 */
export function hostedTrialDays(env) {
  // Whole string or nothing. parseInt would read "1e9999" as 1 and "14 days"
  // as 14, so a typo in an env var turns into a real trial length that nobody
  // typed. A value this decides billing on should refuse to guess.
  const text = (env.AUTOVAULT_HOSTED_TRIAL_DAYS ?? "").trim();
  if (!/^\d+$/.test(text)) return 0;
  const raw = Number(text);
  if (!Number.isSafeInteger(raw) || raw <= 0) return 0;
  // Stripe's own ceiling on trial_period_days. Past it Checkout errors, which
  // would take the whole funnel down rather than just the trial.
  return Math.min(raw, 730);
}

export function buildHostedVaultCheckoutParams({
  request,
  env,
  user,
  source = "hosted-vault",
  // The Stripe customer this session belongs to, resolved by the caller.
  // Passing an id rather than customer_email is what makes a session findable
  // afterwards: with customer_email Stripe mints a fresh Customer per
  // completed checkout, so one account accumulates several and none of them
  // can be listed against to see what is already outstanding.
  customerId = null,
  // One trial per account. Stripe does not remember that a customer already
  // had one, and "cancel" at trial end leaves them free to check out again, so
  // without this a 14-day trial is a renewable subscription that never bills.
  // The caller owns the eligibility question because it is the half with a
  // database; this function only refuses to offer what it was told not to.
  allowTrial = true,
}) {
  if (!env.AUTOVAULT_HOSTED_PRICE_ID)
    throw new ApiError(503, "AUTOVAULT_HOSTED_PRICE_ID is not configured.");

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
  // No card during a trial: payment_method_collection below is "if_required",
  // and Stripe reads a trial as "nothing due now". The subscription comes back
  // status=trialing, which ACTIVE_SUBSCRIPTION_STATUSES already counts as
  // paid, so provisioning and the sync routes need no change to let a trialing
  // customer reserve a namespace and pull bundles.
  //
  // Trial end is stated, not inherited. Stripe's default here is
  // "create_invoice", and a test clock advanced past day 14 shows that landing
  // on status=past_due, which ACTIVE_SUBSCRIPTION_STATUSES excludes, so
  // entitlement does stop on its own. It stops by dunning somebody for an
  // invoice against a card they were told they did not have to give.
  //
  // "cancel" is the behaviour the copy already promises. No card up front means
  // there is nothing to collect, so the honest end of an unconverted trial is
  // the subscription ending, not an unpaid bill and a sequence of Stripe emails
  // about it. Writing it down also stops a money decision from resting on a
  // default that Stripe is free to change.
  const trialDays = allowTrial ? hostedTrialDays(env) : 0;
  if (trialDays > 0) {
    params.set("subscription_data[trial_period_days]", String(trialDays));
    params.set(
      "subscription_data[trial_settings][end_behavior][missing_payment_method]",
      "cancel",
    );
    // Stamped on the session itself, not just the subscription, because the
    // session is the only object that exists while the trial is merely offered.
    // findOutstandingTrialSession reads this to recognise an offer that is
    // still open, which is what stops a second one being made.
    params.set("metadata[trial_days]", String(trialDays));
  }
  params.set("submit_type", env.STRIPE_CHECKOUT_SUBMIT_TYPE || "subscribe");
  // Lets a customer type a Stripe promotion code on Checkout. Coupons without
  // a promotion code still have to be applied in the Dashboard.
  params.set("allow_promotion_codes", "true");
  // 100% coupons would still demand a card without this. Paid totals still
  // collect a payment method; $0 after a promo does not.
  params.set("payment_method_collection", "if_required");
  if (customerId) params.set("customer", customerId);
  else if (user.email) params.set("customer_email", user.email);

  applyBranding(params, env);
  applyCustomText(params, env, allowTrial);
  return params;
}

// How long a trial-bearing session creation is allowed to take.
//
// Bound rather than advisory, and deliberately well under IN_FLIGHT_MS. A trial
// claim is treated as still being worked on for that long, and a claim window
// is only sound if it outlasts every request it covers: an owner still inside
// this call when the window expires would have its claim released and a second
// trial session created behind it. Cutting the call short makes the window an
// upper bound instead of a guess. If Stripe created the session anyway before
// the abort landed, the retry finds it under the account's one customer and
// reuses it, which is what the stable customer id bought.
export const CHECKOUT_CREATE_TIMEOUT_MS = 30_000;

/**
 * @param {Record<string, unknown>} env
 * @param {URLSearchParams} params
 * @param {typeof fetch} [fetcher]
 * @param {AbortSignal | null} [signal]
 */
export async function createCheckoutSession(env, params, fetcher = fetch, signal = null) {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": STRIPE_API_VERSION,
      },
      body: params,
      ...(signal ? { signal } : {}),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.url)
    throw new ApiError(
      502,
      payload.error?.message || "Stripe Checkout Session creation failed.",
    );
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
  const row = await first(
    env,
    "select stripe_customer_id from customers where user_id = ?",
    userId,
  );
  return row?.stripe_customer_id ?? null;
}

// Has Stripe ever created a subscription for this person, in any state?
//
// The trial is once per account, and the check that enforced it read the local
// `subscriptions` row. That row is written by the webhook or by
// /api/billing/reconcile, both of which run AFTER a Checkout Session
// completes, so it answers a question about the past with data that arrives
// late. Stripe is the system that actually owns this fact, so ask Stripe.
//
// Two lookups, because two things can be missing. The known customer id is the
// exact handle and needs one call. When there is none, because a webhook never
// landed or a customer was reassigned away, the email finds Stripe customers
// this account created under a different id, which is precisely the case a
// local-only check gets wrong. Capped at five, because this is on the checkout
// path and an unbounded fan-out there is a worse bug than the one it prevents.
//
// Takes the customer id rather than resolving it: this file's other Stripe
// helpers do not read D1, and a function that talks to one system is the one
// you can test against a stubbed fetch alone.
//
// Throws rather than guessing on a Stripe failure. Guessing false hands out a
// second trial; guessing true silently charges somebody who was promised one,
// and they find out on the statement. A 502 is visible and retryable, and
// createCheckoutSession would have thrown one moments later anyway.
export async function hasPriorStripeSubscription(
  env,
  { customerId, email },
  fetcher = fetch,
) {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");

  const get = (path) => stripeGet(env, path, fetcher);

  const seen = new Set();
  const anyFor = async (customerId) => {
    if (!customerId || seen.has(customerId)) return false;
    seen.add(customerId);
    // status=all so a canceled subscriber counts. Cancelling is the whole way
    // somebody comes back for a second trial.
    const list = await get(
      `subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=1`,
    );
    return Array.isArray(list.data) && list.data.length > 0;
  };

  if (await anyFor(customerId)) return true;

  if (email) {
    const customers = await get(
      `customers?email=${encodeURIComponent(email)}&limit=5`,
    );
    for (const customer of customers.data ?? []) {
      if (await anyFor(asId(customer))) return true;
    }
  }

  return false;
}

// The Stripe customer to bill this user as, creating one if Stripe has never
// seen them.
//
// Deliberately does NOT write to `customers`. That table's absence of a row is
// what /api/billing/portal reads to mean "no billing relationship has ever
// existed", and somebody who opens Checkout and walks away has not started
// one. The billing webhook still writes the row when a session completes. Here
// the row is only ever read, and Stripe's own customer list is the fallback,
// which is also what stops an abandoned checkout leaving a fresh orphan
// customer behind on every attempt.
export async function resolveStripeCustomerId(
  env,
  { userId, email },
  fetcher = fetch,
) {
  const known = await getStripeCustomerId(env, userId);
  if (known) return known;

  if (email) {
    const existing = await stripeGet(env, `customers?email=${encodeURIComponent(email)}&limit=1`, fetcher);
    const found = asId(existing.data?.[0]);
    if (found) return found;
  }

  // Last resort before creating, and only that. Customer search is eventually
  // consistent: measured against real Stripe, a customer created seconds ago
  // was still not indexed 24 seconds later. It finds an older customer whose
  // email has since changed, which no other lookup here can, and it is not
  // load-bearing for anything recent.
  const byUser = await searchCustomerByUserId(env, userId, fetcher);
  if (byUser) return byUser;

  // Idempotent per user, which is load-bearing rather than tidy. Two first-time
  // requests can reach here at the same moment and each create a customer, and
  // from then on the two halves of this feature look at different ones: the
  // winner's Checkout Session sits under one while a later email lookup
  // resolves the other, so an open session goes unseen and a live trial claim
  // reads as stale. One customer per account removes that divergence at the
  // root. The body is stable per user, which is what makes an idempotency key
  // safe here and not on the Checkout Session, whose params vary by source and
  // origin.
  const key = `av-customer-${userId}`;
  // Email deliberately NOT in the keyed body. Stripe refuses a key reused with
  // different parameters, so including a mutable field means somebody who edits
  // their address inside the retention window is blocked from checking out, and
  // once the key ages out they get the second customer this key exists to
  // prevent. A body of nothing but the user id cannot vary, which is what makes
  // the key a guarantee rather than a hope. The address is set immediately
  // after, off the keyed path.
  const body = { "metadata[user_id]": userId };
  try {
    const customerId = asId(await stripePost(env, "customers", body, fetcher, key));
    if (customerId && email) await setCustomerEmail(env, customerId, email, fetcher);
    return customerId || null;
  } catch (error) {
    // Verified against Stripe rather than assumed: two requests using one key at
    // the same instant do NOT serialise. The second is refused with
    // "another in-progress request using this Idempotent Key". That is the key
    // doing its job, and it means the other request is creating the customer
    // right now, so read it back rather than reporting a 502 at somebody
    // trying to pay.
    // Two shapes, one recovery. The in-progress refusal means another request
    // is creating this customer right now. The changed-parameters refusal means
    // the key was already spent on a create whose body differed, which happens
    // when somebody edits their email inside the retention window. In both
    // cases the customer either exists or is about to, so look rather than
    // fail: the alternative is a 502 at somebody trying to pay, or worse, a
    // second customer once the key ages out.
    const recoverable =
      /in-progress request using this Idempotent Key/i.test(error?.message ?? "") ||
      /can only be used with the same parameters/i.test(error?.message ?? "");
    if (!recoverable) throw error;
    const raced =
      (await searchCustomerByUserId(env, userId, fetcher)) ||
      asId(
        (await stripeGet(env, `customers?email=${encodeURIComponent(email)}&limit=1`, fetcher))
          .data?.[0],
      );
    if (raced) return raced;
    throw new ApiError(
      503,
      "Your checkout is already being set up. Try again in a moment."
    );
  }
}

// An unfinished Checkout Session for this customer that already carries a
// trial, or null.
//
// This is the half hasPriorStripeSubscription cannot answer. That one asks
// whether a trial was ever TAKEN, and a subscription only exists once a
// session completes; between issuing a session and finishing it there is
// nothing for it to find, so a first-time account could open several and each
// one carried a trial. The session is the object that exists during exactly
// that window, so the session is what has to be looked at.
export async function findOutstandingTrialSession(env, customerId, fetcher = fetch) {
  if (!customerId) return null;
  const list = await stripeGet(
    env,
    `checkout/sessions?customer=${encodeURIComponent(customerId)}&status=open&limit=20`,
    fetcher,
  );
  return (
    (list.data ?? []).find(
      (session) => Number(session.metadata?.trial_days) > 0 && session.url,
    ) || null
  );
}

// Best effort, and off the idempotent path on purpose. A customer with no email
// still bills correctly and Checkout collects one anyway; a customer that could
// not be created at all does not. Failing here must not fail the checkout.
async function setCustomerEmail(env, customerId, email, fetcher = fetch) {
  try {
    await stripePost(env, `customers/${encodeURIComponent(customerId)}`, { email }, fetcher);
  } catch {
    // Left for the webhook and the next resolve to sort out.
  }
}

// The stable handle for an account's Stripe customer. Written at creation and
// never edited, unlike the email.
async function searchCustomerByUserId(env, userId, fetcher = fetch) {
  if (!userId) return null;
  const query = encodeURIComponent(`metadata['user_id']:'${userId}'`);
  try {
    const found = await stripeGet(env, `customers/search?query=${query}&limit=1`, fetcher);
    return asId(found.data?.[0]) || null;
  } catch {
    // Search is a convenience here, not the contract: the local row and the
    // email lookup still answer, and a search outage must not stop checkout.
    return null;
  }
}

async function stripeGet(env, path, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "stripe-version": STRIPE_API_VERSION,
    },
  });
  const payload = await response.json();
  if (!response.ok)
    throw new ApiError(502, payload.error?.message || "Stripe lookup failed.");
  return payload;
}

async function stripePost(env, path, body, fetcher = fetch, idempotencyKey = null) {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: new URLSearchParams(body).toString(),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new ApiError(502, payload.error?.message || "Stripe request failed.");
  return payload;
}

export function buildBillingPortalParams({
  request,
  env,
  customerId,
  returnTo,
}) {
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
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher(
    "https://api.stripe.com/v1/billing_portal/sessions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": STRIPE_API_VERSION,
      },
      body: params,
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.url) {
    throw new ApiError(
      502,
      payload.error?.message ||
        "Stripe billing portal session creation failed.",
    );
  }
  return payload;
}

export async function verifyStripeSignature(
  payload,
  signatureHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
) {
  if (!signatureHeader || !secret) return false;
  const parts = parseStripeSignatureHeader(signatureHeader);
  if (!parts.timestamp || parts.signatures.length === 0) return false;
  if (Math.abs(nowSeconds - parts.timestamp) > toleranceSeconds) return false;

  const expected = await hmacSha256Hex(secret, `${parts.timestamp}.${payload}`);
  return parts.signatures.some((signature) =>
    timingSafeEqualHex(signature, expected),
  );
}

// Stripe guarantees at-least-once delivery, so the same event id can arrive
// several times.
export async function isStripeEventClaimed(env, event) {
  if (!event?.id) return false;
  const row = await first(
    env,
    "select 1 from stripe_events where event_id = ?",
    event.id,
  );
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
  const result = await run(
    env,
    `
    insert into stripe_events (event_id, event_type, created, received_at)
    values (?, ?, ?, ?)
    on conflict(event_id) do nothing
  `,
    event.id,
    event.type || "unknown",
    Number(event.created) || 0,
    nowIso(),
  );
  return (result?.meta?.changes ?? 0) > 0;
}

export async function handleStripeEvent(env, event) {
  if (await isStripeEventClaimed(env, event))
    return { stored: false, duplicate: true };

  let stored = false;

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.client_reference_id || session?.metadata?.user_id;
    if (userId && session?.customer) {
      await upsertCustomer(env, { userId, customerId: asId(session.customer) });
      stored = true;
    }
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.deleted"
  ) {
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
    const userId =
      (await userIdForCustomer(env, asId(subscription?.customer))) ||
      subscription?.metadata?.user_id;
    if (userId && subscription?.id) {
      await upsertSubscription(env, {
        userId,
        subscriptionId: subscription.id,
        customerId: asId(subscription.customer),
        status: subscription.status,
        priceId: priceIdForSubscription(subscription),
        currentPeriodEnd: currentPeriodEndFor(subscription),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        eventCreated: Number(event.created) || null,
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
  const stale = await first(
    env,
    "select user_id from customers where stripe_customer_id = ? and user_id <> ?",
    customerId,
    userId,
  );
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
      customerId,
    );
  }
  await run(
    env,
    "delete from customers where stripe_customer_id = ? and user_id <> ?",
    customerId,
    userId,
  );
  await run(
    env,
    `
    insert into customers (user_id, stripe_customer_id, created_at, updated_at)
    values (?, ?, ?, ?)
    on conflict(user_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      updated_at = excluded.updated_at
  `,
    userId,
    customerId,
    nowIso(),
    nowIso(),
  );
  return true;
}

export async function upsertSubscription(
  env,
  {
    userId,
    subscriptionId,
    customerId,
    status,
    priceId,
    currentPeriodEnd,
    // Stripe's cancel_at_period_end. Stored because status cannot carry it: a
    // subscription cancelled from the portal keeps its status until the period
    // actually closes, so this is the only field that distinguishes "will
    // renew" from "will end" on an otherwise healthy row.
    cancelAtPeriodEnd = false,
    eventCreated = null,
  },
) {
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
  // on ambiguity), and a paid incoming status that is newly CANCELLING is
  // allowed through for the same reason the non-paid one is: it takes access
  // away, just on a schedule. A first plain "or" on time was tried and rejected here:
  // unconditionally dropping every tie just moves the bug — a genuine
  // same-second cancellation arriving after a same-second "active" would
  // then itself be dropped, leaving the account wrongly active.
  const incomingIsPaid = isPaidStatus(status) ? 1 : 0;
  await run(
    env,
    `
    insert into subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, price_id, current_period_end, cancel_at_period_end, last_event_created, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do update set
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_customer_id = excluded.stripe_customer_id,
      status = excluded.status,
      price_id = excluded.price_id,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      last_event_created = excluded.last_event_created,
      updated_at = excluded.updated_at
    where excluded.last_event_created is null
       or subscriptions.last_event_created is null
       or excluded.last_event_created > subscriptions.last_event_created
       or (
            excluded.last_event_created = subscriptions.last_event_created
            and (
              ? = 0
              -- Same rule, one rung down. The tie-break above prefers the event
              -- that takes access away, and a scheduled cancellation is exactly
              -- that even though its status is still paid: Stripe leaves the
              -- status alone until the period closes. Without this clause an
              -- "active" and a portal cancellation created in the same second
              -- leave cancel_at_period_end at 0, and the dashboard goes back to
              -- telling somebody who just cancelled that they renew.
              --
              -- The stored-status condition is not optional. Without it a
              -- delayed paid event carrying cancel_at_period_end=1 could win a
              -- tie against a stored canceled row, overwrite it with active,
              -- and hand hosted access back to a subscription Stripe has
              -- already ended: the precise resurrection the outer rule exists
              -- to prevent, re-entered one rung down. A tie may add a scheduled
              -- cancellation to a live subscription. It may never revive a dead
              -- one.
              or (
                excluded.cancel_at_period_end = 1
                and subscriptions.cancel_at_period_end = 0
                and subscriptions.status in ('active', 'trialing')
              )
            )
          )
  `,
    userId,
    subscriptionId,
    customerId || null,
    status || null,
    priceId || null,
    currentPeriodEnd || null,
    cancelAtPeriodEnd ? 1 : 0,
    eventCreated,
    nowIso(),
    nowIso(),
    incomingIsPaid,
  );
  return true;
}

export async function retrieveCheckoutSession(env, sessionId, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  if (!sessionId) throw new ApiError(400, "session_id is required.");

  const url = new URL(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
  url.searchParams.append("expand[]", "subscription");
  url.searchParams.append("expand[]", "customer");

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "stripe-version": STRIPE_API_VERSION,
    },
  });
  const payload = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status === 404 ? 404 : 502,
      payload.error?.message || "Stripe session lookup failed.",
    );
  return payload;
}

// The configured plan's real price, read from Stripe rather than hardcoded.
// The funnel showed no price at all before sending people to Checkout; a
// literal in the UI would be worse, because it drifts silently the moment
// the price changes in Stripe.
export async function retrieveHostedPrice(env, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  if (!env.AUTOVAULT_HOSTED_PRICE_ID)
    throw new ApiError(503, "AUTOVAULT_HOSTED_PRICE_ID is not configured.");

  const url = `https://api.stripe.com/v1/prices/${encodeURIComponent(env.AUTOVAULT_HOSTED_PRICE_ID)}`;
  const response = await fetcher(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "stripe-version": STRIPE_API_VERSION,
    },
  });
  const payload = await response.json();
  if (!response.ok)
    throw new ApiError(
      502,
      payload.error?.message || "Stripe price lookup failed.",
    );

  return {
    amount: payload.unit_amount ?? null,
    currency: payload.currency ?? null,
    interval: payload.recurring?.interval ?? null,
    // Same resolver the Checkout builder reads. The page renders "14 days
    // free" from this field or says nothing at all, so it cannot advertise a
    // trial that Checkout is not configured to grant.
    trial_days: hostedTrialDays(env),
  };
}

export { asId, currentPeriodEndFor, priceIdForSubscription };

function applyBranding(params, env) {
  params.set(
    "branding_settings[display_name]",
    env.STRIPE_BRAND_DISPLAY_NAME || "AutoVault",
  );
  params.set(
    "branding_settings[background_color]",
    env.STRIPE_BRAND_BACKGROUND_COLOR || "#0b1014",
  );
  params.set(
    "branding_settings[button_color]",
    env.STRIPE_BRAND_BUTTON_COLOR || "#5ad6c0",
  );
  params.set(
    "branding_settings[border_style]",
    env.STRIPE_BRAND_BORDER_STYLE || "rounded",
  );
  params.set(
    "branding_settings[font_family]",
    env.STRIPE_BRAND_FONT_FAMILY || "inter",
  );
  if (env.STRIPE_BRAND_ICON_URL) {
    params.set("branding_settings[icon][type]", "url");
    params.set("branding_settings[icon][url]", env.STRIPE_BRAND_ICON_URL);
  }
  if (env.STRIPE_BRAND_LOGO_URL) {
    params.set("branding_settings[logo][type]", "url");
    params.set("branding_settings[logo][url]", env.STRIPE_BRAND_LOGO_URL);
  }
}

function applyCustomText(params, env, allowTrial = true) {
  // The trial sentence is generated here rather than written into
  // STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT, because a configured "14 days free"
  // would be a second copy of AUTOVAULT_HOSTED_TRIAL_DAYS, and this copy is the
  // one a buyer reads while deciding to pay. Retire the trial and the sentence
  // leaves with it.
  const trialDays = allowTrial ? hostedTrialDays(env) : 0;
  const submitMessage = [
    trialDays > 0
      ? `Your first ${trialDays} days are free and no card is collected today. Cancel before the trial ends and you are not charged.`
      : "",
    env.STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT || "",
  ]
    .filter(Boolean)
    .join(" ");
  if (submitMessage) {
    // Stripe rejects a submit message over 1200 characters, and a rejected
    // Checkout session takes the whole funnel down rather than one sentence.
    params.set("custom_text[submit][message]", submitMessage.slice(0, 1200));
  }
  if (env.STRIPE_CHECKOUT_CUSTOM_TEXT_AFTER_SUBMIT) {
    params.set(
      "custom_text[after_submit][message]",
      env.STRIPE_CHECKOUT_CUSTOM_TEXT_AFTER_SUBMIT,
    );
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
  const row = await first(
    env,
    "select user_id from customers where stripe_customer_id = ?",
    customerId,
  );
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
