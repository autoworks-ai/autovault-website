import { handleApi } from "./_lib/http.js";
import { hostedTrialDays, retrieveHostedPrice } from "./_lib/stripe.js";

const CACHE_SECONDS = 300;

// Public on purpose: the price belongs on the page before anyone signs in,
// not behind auth. Nothing here is user-specific.
//
// Deliberately does NOT use the shared json() helper, which hardcodes
// `cache-control: no-store` -- correct for the per-user responses it was
// written for, wrong for a value that is identical for every visitor and
// changes about once a year.
//
// A cache-control header alone is not enough. It only reaches the browser
// that asked, so every fresh visitor still costs one authenticated Stripe
// call -- and since this endpoint needs no auth, anyone can repeat it and
// burn the same Stripe rate limit that checkout depends on. Cloudflare does
// not store a dynamically generated Functions response by itself, so the
// result goes in the edge cache explicitly.
//
// The key is rebuilt from the pathname alone, so a query string cannot be
// used to walk around the cache. It then carries a fingerprint of the config
// this response is derived from, computed server-side from env and never from
// anything the caller sends, so a visitor still cannot pick their own key.
//
// Without that fingerprint the 300 second window is a window where the page
// and Checkout disagree about money: shorten or switch off
// AUTOVAULT_HOSTED_TRIAL_DAYS and a cached body keeps promising the old trial
// while a session created in the same second already uses the new one. Making
// the key move with the config means a change invalidates instead of waiting
// out the TTL.
// request/waitUntil default so a caller can supply just { env } -- the
// endpoint then simply skips the edge cache instead of throwing.
/**
 * @param {{
 *   request?: Request | null,
 *   env: Record<string, string>,
 *   waitUntil?: ((promise: Promise<unknown>) => void) | null
 * }} context
 */
export async function onRequestGet({ request = null, env, waitUntil = null }) {
  return handleApi(async () => {
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const fingerprint = encodeURIComponent(
      `${env.AUTOVAULT_HOSTED_PRICE_ID || ""}:${hostedTrialDays(env)}`,
    );
    const cacheKey = request
      ? new Request(
          `${new URL(request.url).origin}/api/pricing?config=${fingerprint}`,
        )
      : null;

    if (cache && cacheKey) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    const price = await retrieveHostedPrice(env);
    const response = new Response(JSON.stringify(price), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // s-maxage for the edge, max-age=0 for the browser. The fingerprint
        // above only moves the key this Worker reads; a browser holding the
        // body under max-age=300 never asks again, so a retired trial kept
        // being advertised for five minutes to exactly the people already on
        // the page. Revalidating costs a Worker invocation, not a Stripe call,
        // because the edge entry is what this endpoint was cached to protect.
        "cache-control": `public, max-age=0, s-maxage=${CACHE_SECONDS}`
      }
    });

    if (cache && cacheKey) {
      const store = cache.put(cacheKey, response.clone());
      if (waitUntil) waitUntil(store); else await store;
    }
    return response;
  });
}
