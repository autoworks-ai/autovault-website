import { requireUser } from "../_lib/auth.js";
import { apiError, handleApi, json, readJson } from "../_lib/http.js";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  asId,
  priceIdForSubscription,
  retrieveCheckoutSession,
  upsertCustomer,
  upsertSubscription
} from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
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
        currentPeriodEnd: subscription.current_period_end || null
      });
      reconciledSubscription = {
        active: ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status || ""),
        status: subscription.status || null,
        stripe_subscription_id: subscription.id,
        price_id: priceIdForSubscription(subscription),
        current_period_end: subscription.current_period_end || null
      };
    }

    return json({
      reconciled: true,
      payment_status: session.payment_status || null,
      subscription: reconciledSubscription
    });
  });
}
