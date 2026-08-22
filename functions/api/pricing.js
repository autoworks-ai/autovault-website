import { handleApi } from "./_lib/http.js";
import { retrieveHostedPrice } from "./_lib/stripe.js";

// Public on purpose: the price belongs on the page before anyone signs in,
// not behind auth. Nothing here is user-specific.
//
// Deliberately does NOT use the shared json() helper, which hardcodes
// `cache-control: no-store` -- correct for the per-user responses it was
// written for, wrong for a value that is identical for every visitor and
// changes about once a year. Without a cache header every funnel render
// costs a Stripe round trip.
export async function onRequestGet({ env }) {
  return handleApi(async () => {
    const price = await retrieveHostedPrice(env);
    return new Response(JSON.stringify(price), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  });
}
