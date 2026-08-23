import { requireUser } from "../_lib/auth.js";
import { ApiError, handleApi, json, readJson } from "../_lib/http.js";
import { buildHostedVaultCheckoutParams, createCheckoutSession } from "../_lib/stripe.js";
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

    const body = await readJson(request, 8_000);
    const params = buildHostedVaultCheckoutParams({
      request,
      env,
      user,
      source: body.source === "playground" ? "playground" : "deploy"
    });
    const session = await createCheckoutSession(env, params);
    return json({ url: session.url, id: session.id });
  });
}
