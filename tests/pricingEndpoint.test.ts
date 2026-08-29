import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { onRequestGet as pricing } from "../functions/api/pricing.js";
import { formatPriceLabel } from "../.vitepress/theme/utils/money";
import { buildHostedVaultCheckoutParams } from "../functions/api/_lib/stripe.js";

const ENV = { STRIPE_SECRET_KEY: "sk_test_x", AUTOVAULT_HOSTED_PRICE_ID: "price_hosted" };

function stubPrice(body: Record<string, unknown>, status = 200) {
  const mock = vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" }
  }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("pricing endpoint", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the configured plan's real price from Stripe", async () => {
    stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });
    const response = await pricing({ env: ENV });
    expect(await response.json()).toEqual({ amount: 1500, currency: "usd", interval: "month", trial_days: 0 });

    // 0, not absent. The page renders every trial line off this number, so an
    // endpoint that simply omitted the field when no trial is configured would
    // be indistinguishable from an older deploy that did not know about
    // trials, and "no trial" is the answer that has to be unambiguous.
  });

  it("is cacheable — the price is identical for every visitor", async () => {
    // The shared json() helper hardcodes `no-store`, which is right for the
    // per-user responses it was written for and wrong here: without a cache
    // header every funnel render costs a Stripe round trip.
    stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });
    const response = await pricing({ env: ENV });
    // Assert the header the endpoint actually sends, not the text of the
    // source -- the value is built from a constant now, so a source match
    // would have gone vacuous without anything failing.
    const cacheControl = response.headers.get("cache-control") ?? "";
    // The edge holds it; the browser does not. A shared cache is what spares
    // Stripe the call, and it is invalidated by the config fingerprint on the
    // key. A browser copy cannot be invalidated at all, so a retired trial
    // would have gone on being advertised for the rest of its max-age to
    // precisely the people already looking at the page.
    expect(cacheControl).toMatch(/\bs-maxage=\d+/);
    expect(cacheControl).toMatch(/\bmax-age=0\b/);
    expect(cacheControl).toContain("public");

    const source = readFileSync(new URL("../functions/api/pricing.js", import.meta.url), "utf-8");
    // Anchor on the import, not the word: the comment explaining why json()
    // is avoided necessarily contains "json(".
    expect(source).not.toMatch(/import \{[^}]*\bjson\b[^}]*\} from/);
  });

  it("requires no auth, so the price can render before sign-in", async () => {
    // The whole point: a visitor sees what it costs before committing.
    stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });
    const response = await pricing({ env: ENV });
    expect(response.status).toBe(200);
  });

  it("reports misconfiguration as 503 and a Stripe failure as 502", async () => {
    stubPrice({});
    expect((await pricing({ env: { ...ENV, STRIPE_SECRET_KEY: "" } })).status).toBe(503);
    expect((await pricing({ env: { ...ENV, AUTOVAULT_HOSTED_PRICE_ID: "" } })).status).toBe(503);

    stubPrice({ error: { message: "No such price" } }, 404);
    expect((await pricing({ env: ENV })).status).toBe(502);
  });

  it("stores the public price in the edge cache, not just the browser's", () => {
    // cache-control alone only reaches the browser that asked, so every fresh
    // visitor still costs one authenticated Stripe call -- and the endpoint
    // needs no auth, so anyone can repeat it and burn the same rate limit
    // checkout depends on. Cloudflare does not store a dynamically generated
    // Functions response on its own.
    const store = new Map<string, Response>();
    const cache = {
      match: async (key: Request) => store.get(key.url)?.clone(),
      put: async (key: Request, value: Response) => void store.set(key.url, value)
    };
    vi.stubGlobal("caches", { default: cache });
    const stripe = stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });

    return (async () => {
      const request = new Request("https://autovault.dev/api/pricing");
      const first = await pricing({ request, env: ENV });
      expect(await first.json()).toEqual({ amount: 1500, currency: "usd", interval: "month", trial_days: 0 });
      expect(stripe).toHaveBeenCalledTimes(1);

      const second = await pricing({ request, env: ENV });
      expect(await second.json()).toEqual({ amount: 1500, currency: "usd", interval: "month", trial_days: 0 });
      // The point of the whole exercise: no second Stripe call.
      expect(stripe).toHaveBeenCalledTimes(1);
    })();
  });

  it("cannot be walked around with a query string", async () => {
    // An unauthenticated endpoint keyed on the full URL would let ?n=1, ?n=2
    // ... miss the cache every time and proxy straight through to Stripe.
    const store = new Map<string, Response>();
    vi.stubGlobal("caches", {
      default: {
        match: async (key: Request) => store.get(key.url)?.clone(),
        put: async (key: Request, value: Response) => void store.set(key.url, value)
      }
    });
    const stripe = stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });

    await pricing({ request: new Request("https://autovault.dev/api/pricing"), env: ENV });
    await pricing({ request: new Request("https://autovault.dev/api/pricing?bust=1"), env: ENV });
    await pricing({ request: new Request("https://autovault.dev/api/pricing?bust=2"), env: ENV });

    expect(stripe).toHaveBeenCalledTimes(1);
    // One key, and it is the server's, not the caller's: the `config` suffix is
    // built from env rather than from anything in the request.
    expect([...store.keys()]).toEqual([
      "https://autovault.dev/api/pricing?config=price_hosted%3A0"
    ]);
  });

  it("stops serving the old trial the moment the trial changes", async () => {
    // The body carries trial_days now, so a key that ignores the config leaves
    // a 300 second window where the cached page promises a trial that a session
    // created in the same second no longer grants. Shortening or switching the
    // trial off has to invalidate, not wait out the TTL.
    const store = new Map<string, Response>();
    vi.stubGlobal("caches", {
      default: {
        match: async (key: Request) => store.get(key.url)?.clone(),
        put: async (key: Request, value: Response) => void store.set(key.url, value)
      }
    });
    const stripe = stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });
    const request = new Request("https://autovault.dev/api/pricing");

    const withTrial = await pricing({
      request,
      env: { ...ENV, AUTOVAULT_HOSTED_TRIAL_DAYS: "14" }
    });
    expect((await withTrial.json()).trial_days).toBe(14);

    const retired = await pricing({
      request,
      env: { ...ENV, AUTOVAULT_HOSTED_TRIAL_DAYS: "0" }
    });
    expect((await retired.json()).trial_days).toBe(0);

    // A second Stripe call, because the second request could not hit the first
    // entry. Both keys survive; the stale one is simply unreachable.
    expect(stripe).toHaveBeenCalledTimes(2);
    expect([...store.keys()].sort()).toEqual([
      "https://autovault.dev/api/pricing?config=price_hosted%3A0",
      "https://autovault.dev/api/pricing?config=price_hosted%3A14"
    ]);
  });

  it("never hardcodes a price in the funnel UI", () => {
    // A literal drifts silently the moment the price changes in Stripe.
    const cloudPage = readFileSync(
      new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url), "utf-8"
    );
    expect(cloudPage).toContain("/api/pricing");
    expect(cloudPage).not.toMatch(/\$\d+\s*\/\s*(mo|month)/);
  });
});

describe("price label", () => {
  // Locale is pinned so grouping and decimal separators do not depend on the
  // machine running the suite. Production passes no locale, on purpose.
  const label = (amount: number | null, currency: string | null) =>
    formatPriceLabel(amount, currency, "month", "en-US");

  it("converts from the currency's own minor unit, not from cents", () => {
    // The bug this replaces divided every amount by 100. Stripe amounts are in
    // minor units, and the count per major unit varies by currency.
    expect(label(1500, "usd")).toBe("$15 / month");
    // Zero-decimal: 1500 is fifteen hundred yen, not fifteen.
    expect(label(1500, "jpy")).toBe("¥1,500 / month");
    // Three-decimal: 1500 fils is one and a half dinar, not fifteen hundred.
    // Matched loosely because Intl separates the code with U+00A0, not a space.
    expect(label(1500, "kwd")).toContain("1.500");
    expect(label(1500, "kwd")).not.toContain("15.00");
  });

  it("keeps real fractions and trims empty ones", () => {
    expect(label(1550, "usd")).toBe("$15.50 / month");
    expect(label(1500, "eur")).toBe("€15 / month");
  });

  it("follows Stripe's billing unit, not Intl's display unit, where they differ", () => {
    // Stripe's own special-cases table: ISK and UGX became zero-decimal but
    // backward compatibility means Stripe still takes them in hundredths, so
    // amount 500 is 5 ISK -- Stripe's own worked example. Intl reports zero
    // digits for both, so deriving the divisor from Intl alone was still wrong.
    expect(label(500, "isk")).toContain("5");
    expect(label(500, "isk")).not.toContain("500");
    expect(label(500, "ugx")).toContain("5");
    expect(label(500, "ugx")).not.toContain("500");

    // HUF is the mirror image: Stripe's zero-decimal handling is payouts-only
    // and charges are two-decimal (its stated minimum charge is 175.00 HUF),
    // while Intl reports zero digits. 175000 is 1,750 HUF, not 175,000.
    expect(label(175000, "huf")).toContain("1,750");
    expect(label(175000, "huf")).not.toContain("175,000");
  });

  it("renders nothing rather than a broken price when Stripe said nothing", () => {
    expect(label(null, "usd")).toBeNull();
    expect(label(1500, null)).toBeNull();
    expect(formatPriceLabel(1500, "usd", null, "en-US")).toBe("$15");
  });

  it("reports the same trial Checkout would send", async () => {
    // The one guarantee that keeps "14 days free" on the page honest. This
    // endpoint is where the funnel learns the trial length, and
    // buildHostedVaultCheckoutParams is what Stripe is actually asked for.
    // Both read hostedTrialDays, so this asserts they cannot disagree.
    stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });
    const env = { ...ENV, AUTOVAULT_HOSTED_TRIAL_DAYS: "14" };
    const body = await (await pricing({ env })).json() as { trial_days: number };

    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/cloud"),
      env,
      user: { id: "user_1", email: "jack@example.com" }
    });

    expect(body.trial_days).toBe(14);
    expect(params.get("subscription_data[trial_period_days]")).toBe(String(body.trial_days));
  });

  it("advertises no trial when Checkout would send none", async () => {
    stubPrice({ unit_amount: 1500, currency: "usd", recurring: { interval: "month" } });
    const body = await (await pricing({ env: ENV })).json() as { trial_days: number };
    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/cloud"),
      env: ENV,
      user: { id: "user_1", email: "jack@example.com" }
    });

    expect(body.trial_days).toBe(0);
    expect(params.get("subscription_data[trial_period_days]")).toBeNull();
  });
});
