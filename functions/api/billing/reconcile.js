import { requireUser } from "../_lib/auth.js";
import { apiError, handleApi, json, readJson } from "../_lib/http.js";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  asId,
  currentPeriodEndFor,
  priceIdForSubscription,
  retrieveCheckoutSession,
  upsertCustomer,
  upsertSubscription
} from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    // Captured before the Stripe round-trip, not after the D1 write below.
    // This value stands in for "as of when I asked Stripe for this", a
    // conservative lower bound on how fresh `session` actually is. Stamping
    // with the write-time timestamp instead would be wrong: if a real webhook
    // (e.g. a cancellation) lands and is applied *during* this request — after
    // our read, before our write — its event.created is earlier than our
    // write-time clock but reflects newer truth than our now-stale read, and
    // the stale read would incorrectly win the out-of-order comparison.
    // Timestamping at read-start keeps that webhook's watermark ahead of ours.
    const reconcileStartedAt = Math.floor(Date.now() / 1000);
    const user = await requireUser(request, env);
    const body = await readJson(request);
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
    if (!sessionId) return apiError(400, "session_id is required.");

    const session = await retrieveCheckoutSession(env, sessionId);
    // Sessions created by this app always carry the owner's id, so treat a
    // missing identifier the same as a mismatch — an unbound or leaked session
    // ID must not be claimable by the current account (fail closed).
    const sessionUserId = session.client_reference_id || session.metadata?.user_id || null;
    if (sessionUserId !== user.id) {
      return apiError(403, "Checkout session does not belong to current user.");
    }

    const customerId = asId(session.customer);
    if (!customerId) return apiError(422, "Checkout session has no customer.");

    await upsertCustomer(env, { userId: user.id, customerId });

    const subscription = session.subscription;
    let reconciledSubscription = null;
    if (subscription && typeof subscription === "object" && subscription.id) {
      await upsertSubscription(env, {
        userId: user.id,
        subscriptionId: subscription.id,
        customerId,
        status: subscription.status,
        priceId: priceIdForSubscription(subscription),
        currentPeriodEnd: currentPeriodEndFor(subscription),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        // This is a live, authoritative read straight from Stripe, not a
        // replayed webhook — so it has no `event.created` of its own. Stamp
        // it with the read-start time captured above rather than leaving the
        // watermark null: null would satisfy upsertSubscription's
        // out-of-order guard unconditionally, wiping the real webhook
        // watermark and reopening the door for an already-superseded stale
        // webhook (e.g. a delayed "active" arriving after a "deleted") to
        // resurrect paid access.
        eventCreated: reconcileStartedAt
      });
      reconciledSubscription = {
        active: ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status || ""),
        status: subscription.status || null,
        stripe_subscription_id: subscription.id,
        price_id: priceIdForSubscription(subscription),
        current_period_end: currentPeriodEndFor(subscription)
      };
    }

    return json({
      reconciled: true,
      payment_status: session.payment_status || null,
      subscription: reconciledSubscription
    });
  });
}
