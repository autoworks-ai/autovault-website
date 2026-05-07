import { apiError, handleApi, json } from "../_lib/http.js";
import { handleStripeEvent, verifyStripeSignature } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    if (!env.STRIPE_WEBHOOK_SECRET) return apiError(503, "STRIPE_WEBHOOK_SECRET is not configured.");
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature") || "";
    const valid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return apiError(400, "Invalid Stripe webhook signature.");

    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      return apiError(400, "Invalid Stripe webhook payload.");
    }
    const result = await handleStripeEvent(env, event);
    return json({ received: true, ...result });
  });
}
