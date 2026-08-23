import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { onRequestGet as pricing } from "../functions/api/pricing.js";
import { formatPriceLabel } from "../.vitepress/theme/utils/money";

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
    expect(await response.json()).toEqual({ amount: 1500, currency: "usd", interval: "month" });
  });

  it("is cacheable — the price is identical for every visitor", () => {
    // The shared json() helper hardcodes `no-store`, which is right for the
    // per-user responses it was written for and wrong here: without a cache
    // header every funnel render costs a Stripe round trip.
    const source = readFileSync(new URL("../functions/api/pricing.js", import.meta.url), "utf-8");
    expect(source).toContain("public, max-age=300");
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

  it("renders nothing rather than a broken price when Stripe said nothing", () => {
    expect(label(null, "usd")).toBeNull();
    expect(label(1500, null)).toBeNull();
    expect(formatPriceLabel(1500, "usd", null, "en-US")).toBe("$15");
  });
});
