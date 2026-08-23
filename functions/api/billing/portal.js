import { requireUser } from "../_lib/auth.js";
import { ApiError, handleApi, json, readJson } from "../_lib/http.js";
import {
  buildBillingPortalParams,
  createBillingPortalSession,
  getStripeCustomerId
} from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const body = await readJson(request, 8_000);

    // The only input this endpoint accepts is a return path. The customer id
    // is resolved server-side from the session user and is never taken from
    // the request -- otherwise anyone signed in could open a portal session
    // against somebody else's Stripe customer.
    const customerId = await getStripeCustomerId(env, user.id);
    if (!customerId) {
      // 409, not 402: 402 means "pay up" and is already what provisionVault
      // and the progress endpoint return for a lapsed subscription. This is a
      // different situation -- no billing relationship has ever existed, so
      // there is nothing for the portal to show.
      throw new ApiError(409, "No billing account yet. Start a hosted vault subscription first.");
    }

    // Deliberately NOT gated on isPaidStatus: a canceled subscriber still has
    // a customers row and is exactly who needs the portal most -- to pull
    // final invoices, update a dead card, or resubscribe.
    const params = buildBillingPortalParams({ request, env, customerId, returnTo: body.return_to });
    const session = await createBillingPortalSession(env, params);
    return json({ url: session.url });
  });
}
