import { requireUser } from "../_lib/auth.js";
import { ApiError, handleApi, json, readJson } from "../_lib/http.js";
import {
  buildHostedVaultCheckoutParams,
  CHECKOUT_CREATE_TIMEOUT_MS,
  createCheckoutSession,
  findOutstandingTrialSession,
  hasPriorStripeSubscription,
  hostedTrialDays,
  resolveStripeCustomerId,
  retrieveCheckoutSession
} from "../_lib/stripe.js";
import {
  attachTrialSession,
  claimTrial,
  getTrialClaim,
  isTrialClaimInFlight,
  releaseTrialClaim
} from "../_lib/trials.js";
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

    // Resolve the customer BEFORE deciding anything. Everything below needs a
    // stable id: with customer_email, Stripe mints a fresh Customer per
    // completed checkout, so one account accumulates several and none of them
    // can be listed against to see what is already outstanding.
    const customerId = await resolveStripeCustomerId(env, {
      userId: user.id,
      email: user.email
    });

    // Eligibility comes from Stripe, not from here.
    //
    // The local `subscriptions` row is a fine short-circuit when it is
    // present: it is keyed on user_id and upserted, so it survives
    // cancellation, and reading it costs nothing. What it cannot do is answer
    // the question in time. It is written by the billing webhook or by
    // /api/billing/reconcile, both of which run after a Checkout Session
    // completes.
    //
    // Stripe knows about a subscription the moment one exists, under any
    // status, including the canceled ones that are the entire route back for a
    // second free trial.
    const hadTrialBefore =
      Boolean(subscription?.status) ||
      (await hasPriorStripeSubscription(env, { customerId, email: user.email }));

    // The other half, and the one a subscription lookup structurally cannot
    // see: a trial that has been OFFERED and not yet taken. A first-time
    // account could open several sessions before finishing any, and every one
    // of them carried a trial, because no subscription existed for any check
    // to find. The open session is the only object that exists in that window.
    //
    // Reuse rather than refuse. Sending somebody back to the session they
    // already have is both the fix and the better behaviour: a second session
    // would strand the first, and Stripe keeps them open for 24 hours.
    let allowTrial = false;

    // No trial configured means no claim. The claim exists to arbitrate an
    // offer, and there is no offer: claiming anyway records a full-price
    // session as the one this account's trial was spent on, so switching the
    // trial on later would hand an eligible first-timer their own old
    // non-trial checkout back through the reuse path.
    if (!hadTrialBefore && hostedTrialDays(env) > 0) {
      // An offer that has already been made and not yet resolved. Reuse rather
      // than refuse: a second session would strand the first, and Stripe keeps
      // them open for 24 hours.
      const outstanding = await findOutstandingTrialSession(env, customerId);
      if (outstanding) return json({ url: outstanding.url, id: outstanding.id, reused: true });

      // A claim with no session attached, made moments ago, is another request
      // still talking to Stripe. Not stale, and deleting it is exactly how the
      // race gets back in: that request will create a trial session the instant
      // it returns, and this one would create a second.
      const claim = await getTrialClaim(env, user.id);
      const inFlight = isTrialClaimInFlight(claim);

      // Only past that, and only after asking Stripe about the claim's own
      // session by id rather than inferring from the customer.
      //
      // The inference does not hold. Two first-time requests can both find no
      // Stripe customer and each create one, so the winner's session sits under
      // cus_A while a later `customers?email=` lookup resolves cus_B. The
      // outstanding-session search then finds nothing, and releasing on that
      // basis throws away a claim whose session is open the whole time, under a
      // customer this request never looked at. A session id is unambiguous
      // where a customer id is a guess.
      if (claim && !inFlight) {
        let recorded = null;
        if (claim.session_id) {
          try {
            recorded = await retrieveCheckoutSession(env, claim.session_id);
          } catch (error) {
            // A 404 is an answer: Stripe has no such session, so the claim
            // names nothing and may be released. Anything else is Stripe being
            // unreachable, and `.catch(() => null)` here read that as "the
            // session is gone", released a claim whose session was very likely
            // still open, and issued a second trial off the back of a 429.
            // Only a positive result releases a claim.
            if (error?.status !== 404) {
              throw new ApiError(
                503,
                "Could not confirm your existing checkout with Stripe. Try again in a moment."
              );
            }
          }
        }
        if (recorded?.status === "open" && recorded.url) {
          return json({ url: recorded.url, id: recorded.id, reused: true });
        }
        // Released against this exact claim, so a claim made since is never
        // thrown away.
        await releaseTrialClaim(env, user.id, claim);
      }

      // The atomic step, and the only one in this sequence that is. Everything
      // above is a check-then-act against Stripe, so two overlapping requests
      // could both reach here believing they are the first. Exactly one of them
      // wins the insert.
      allowTrial = inFlight ? false : await claimTrial(env, user.id);

      if (!allowTrial) {
        // Lost the race by milliseconds. The winner may not have created its
        // session yet, so look once more before deciding anything.
        const justCreated = await findOutstandingTrialSession(env, customerId);
        if (justCreated)
          return json({ url: justCreated.url, id: justCreated.id, reused: true });
        throw new ApiError(
          409,
          "A checkout session is already being created for this account. Try again in a moment."
        );
      }
    }

    const params = buildHostedVaultCheckoutParams({
      request,
      env,
      user,
      customerId,
      source: body.source === "playground" ? "playground" : "deploy",
      allowTrial
    });
    // Bounded only on the trial path, because only that path holds a claim
    // whose window has to outlast this call. Aborting loses a session Stripe
    // may already have created; the retry finds it under the account's one
    // customer and reuses it, which is strictly better than a second trial.
    const session = await createCheckoutSession(
      env,
      params,
      fetch,
      allowTrial ? AbortSignal.timeout(CHECKOUT_CREATE_TIMEOUT_MS) : null
    );
    // Which session the claim was spent on, so a later request can tell a claim
    // waiting on a live checkout from one whose checkout is gone.
    if (allowTrial) await attachTrialSession(env, user.id, session.id);
    return json({ url: session.url, id: session.id });
  });
}
