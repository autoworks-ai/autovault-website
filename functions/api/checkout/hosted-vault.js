import { requireUser } from "../_lib/auth.js";
import { ApiError, handleApi, json, readJson } from "../_lib/http.js";
import {
  buildHostedVaultCheckoutParams,
  createCheckoutSession,
  getStripeCustomerId,
  hasPriorStripeSubscription
} from "../_lib/stripe.js";
import { getSubscription } from "../_lib/vault.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);

    // A paying subscriber never needs a second subscription, and nothing here
    // used to stop one being created. The client only had to disagree with
    // itself about the current state -- one failed /api/me while the shell had
    // a good one -- to render "Open checkout" to somebody already paying, and
    // Stripe takes a second subscription-mode session without complaint. The
    // UI defect that exposed it is fixed separately; a money path should not
    // depend on the UI being right.
    //
    // Only an ACTIVE subscription is refused. A canceled or lapsed subscriber
    // is exactly who should be able to check out again.
    const subscription = await getSubscription(env, user.id);
    if (subscription?.active) {
      throw new ApiError(
        409,
        "You already have an active hosted vault subscription. Reload the page to carry on setting it up."
      );
    }

    // Eligibility comes from Stripe, not from here.
    //
    // The local `subscriptions` row is a fine short-circuit when it is
    // present: it is keyed on user_id and upserted, so it survives
    // cancellation, and reading it costs nothing. What it cannot do is answer
    // the question in time. It is written by the billing webhook or by
    // /api/billing/reconcile, both of which run after a Checkout Session
    // completes, so between opening a session and finishing it there is no
    // local record that a trial was ever offered. Several sessions opened back
    // to back all read an empty table and all carried a trial.
    //
    // Stripe knows. It has the subscription the moment one exists, under any
    // status, including the canceled ones that are the entire route back for a
    // second free trial. One extra call on a path that already talks to Stripe
    // twice.
    const firstSubscription =
      !subscription?.status &&
      !(await hasPriorStripeSubscription(env, {
        customerId: await getStripeCustomerId(env, user.id),
        email: user.email
      }));

    const body = await readJson(request, 8_000);
    const params = buildHostedVaultCheckoutParams({
      request,
      env,
      user,
      source: body.source === "playground" ? "playground" : "deploy",
      allowTrial: firstSubscription
    });
    const session = await createCheckoutSession(env, params);
    return json({ url: session.url, id: session.id });
  });
}
