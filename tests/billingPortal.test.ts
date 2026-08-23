import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createTestEnv, seedUser } from "./support/d1.js";
import { createSession } from "../functions/api/_lib/auth.js";
import { buildBillingPortalParams, upsertCustomer, upsertSubscription } from "../functions/api/_lib/stripe.js";
import { onRequestPost as billingPortal } from "../functions/api/billing/portal.js";

const PORTAL_URL = "https://billing.stripe.com/session/test_123";

function stubStripePortal(overrides: Record<string, unknown> = {}) {
  const mock = vi.fn(async () =>
    new Response(JSON.stringify({ id: "bps_test", url: PORTAL_URL, ...overrides }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function portalRequest(cookie: string, body: Record<string, unknown> = {}) {
  return new Request("https://autovault.dev/api/billing/portal", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function seedPaidCustomer(userId = "clerk_1", customerId = "cus_test") {
  const { db, env } = createTestEnv();
  seedUser(db, { id: userId });
  await upsertCustomer(env, { userId, customerId });
  await upsertSubscription(env, {
    userId,
    subscriptionId: "sub_test",
    customerId,
    status: "active",
    priceId: "price_hosted_vault",
    currentPeriodEnd: 1893456000
  });
  const cookie = await createSession(new Request("https://autovault.dev"), env, userId);
  return { db, env, cookie };
}

describe("billing portal endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects anonymous callers", async () => {
    const { env } = createTestEnv();
    const fetchMock = stubStripePortal();
    const request = new Request("https://autovault.dev/api/billing/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });

    const response = await billingPortal({ request, env });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the user has no billing relationship at all", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);
    const fetchMock = stubStripePortal();
    const cookie = await createSession(new Request("https://autovault.dev"), env, "clerk_1");

    const response = await billingPortal({ request: portalRequest(cookie), env });
    const payload = await response.json() as { error: string };

    // 409, not 402 -- 402 means "pay up" and is what provisionVault returns.
    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/billing account/i);
    // Must not burn a Stripe call to discover we have no customer id.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the portal for a CANCELED subscriber", async () => {
    const { env, cookie } = await seedPaidCustomer();
    // A canceled subscriber is exactly who needs the portal -- final
    // invoices, updating a dead card, resubscribing. Gating this endpoint on
    // isPaidStatus would lock them out of their own billing history.
    await upsertSubscription(env, {
      userId: "clerk_1",
      subscriptionId: "sub_test",
      customerId: "cus_test",
      status: "canceled",
      priceId: "price_hosted_vault",
      currentPeriodEnd: 1893456000
    });
    stubStripePortal();

    const response = await billingPortal({ request: portalRequest(cookie), env });
    const payload = await response.json() as { url: string };

    expect(response.status).toBe(200);
    expect(payload.url).toBe(PORTAL_URL);
  });

  it("refuses the PREVIOUS owner of a reassigned Stripe customer", async () => {
    // This is the headline case. upsertCustomer handles reassignment by
    // revoking the stale owner's subscription (status -> 'canceled', which
    // LEAVES subscriptions.stripe_customer_id populated) and deleting their
    // customers row. If getStripeCustomerId ever "helpfully" falls back to
    // subscriptions.stripe_customer_id, user_a gets a live portal session for
    // a Stripe customer that now belongs to user_b -- their invoices, their
    // saved cards, and the power to cancel their subscription.
    const { db, env } = createTestEnv();
    seedUser(db, { id: "user_a", email: "a@example.com" });
    seedUser(db, { id: "user_b", email: "b@example.com" });

    await upsertCustomer(env, { userId: "user_a", customerId: "cus_shared" });
    await upsertSubscription(env, {
      userId: "user_a",
      subscriptionId: "sub_shared",
      customerId: "cus_shared",
      status: "active",
      priceId: null,
      currentPeriodEnd: null
    });
    await upsertCustomer(env, { userId: "user_b", customerId: "cus_shared" });

    // Sanity: user_a's subscriptions row still carries the customer id, which
    // is precisely what makes a fallback tempting and wrong.
    const stale = db
      .prepare("select stripe_customer_id, status from subscriptions where user_id = ?")
      .get("user_a") as { stripe_customer_id: string; status: string };
    expect(stale.stripe_customer_id).toBe("cus_shared");
    expect(stale.status).toBe("canceled");

    stubStripePortal();

    const cookieB = await createSession(new Request("https://autovault.dev"), env, "user_b");
    const okResponse = await billingPortal({ request: portalRequest(cookieB), env });
    expect(okResponse.status).toBe(200);

    const cookieA = await createSession(new Request("https://autovault.dev"), env, "user_a");
    const deniedResponse = await billingPortal({ request: portalRequest(cookieA), env });
    expect(deniedResponse.status).toBe(409);
  });

  it("sends a correctly shaped Stripe request", async () => {
    const { env, cookie } = await seedPaidCustomer();
    const fetchMock = stubStripePortal();

    await billingPortal({ request: portalRequest(cookie, { return_to: "/cloud#launch-path" }), env });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^Bearer /);
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["stripe-version"]).toBe("2026-02-25.clover");

    const body = new URLSearchParams(String(init.body));
    expect(body.get("customer")).toBe("cus_test");
    expect(body.get("return_url")).toBe("https://autovault.dev/cloud#launch-path");
  });

  it("refuses to bounce the user to an attacker-supplied return_url", async () => {
    const { env, cookie } = await seedPaidCustomer();
    const fetchMock = stubStripePortal();

    await billingPortal({ request: portalRequest(cookie, { return_to: "https://evil.example/x" }), env });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get("return_url")).toBe("https://autovault.dev/cloud#launch-path");
  });

  it("pins the portal configuration only when one is configured", async () => {
    const { env, cookie } = await seedPaidCustomer();
    const fetchMock = stubStripePortal();

    await billingPortal({ request: portalRequest(cookie), env });
    let body = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.get("configuration")).toBeNull();

    await billingPortal({
      request: portalRequest(cookie),
      env: { ...env, STRIPE_PORTAL_CONFIGURATION_ID: "bpc_test" }
    });
    body = new URLSearchParams(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(body.get("configuration")).toBe("bpc_test");
  });

  it("reports a missing Stripe key as 503 and a Stripe rejection as 502", async () => {
    const { env, cookie } = await seedPaidCustomer();

    stubStripePortal();
    const noKey = await billingPortal({
      request: portalRequest(cookie),
      env: { ...env, STRIPE_SECRET_KEY: "" }
    });
    expect(noKey.status).toBe(503);

    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "No configuration provided." } }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    ));
    const rejected = await billingPortal({ request: portalRequest(cookie), env });
    const payload = await rejected.json() as { error: string };
    expect(rejected.status).toBe(502);
    // Stripe's own wording survives, so an unconfigured portal is diagnosable
    // rather than looking like a generic outage.
    expect(payload.error).toMatch(/No configuration provided/);
  });

  it("keeps the handler free of console output", () => {
    // CLAUDE.md: no console.* in functions/api/*.js -- they emit to
    // Cloudflare logs indiscriminately.
    const source = readFileSync(new URL("../functions/api/billing/portal.js", import.meta.url), "utf-8");
    expect(source).not.toMatch(/console\./);
  });
});

describe("buildBillingPortalParams", () => {
  it("re-bases the return path on the live request origin", () => {
    // Preview deploys land on *.pages.dev and local dev on 127.0.0.1:8788;
    // safeReturnTo pins to autovault.dev and returns a path, so the origin
    // has to come from the request or every preview bounces to production.
    const params = buildBillingPortalParams({
      request: new Request("https://preview.autovault-website.pages.dev/api/billing/portal"),
      env: {},
      customerId: "cus_x",
      returnTo: "/cloud#launch-path"
    });
    expect(params.get("return_url")).toBe("https://preview.autovault-website.pages.dev/cloud#launch-path");
  });

  it("falls back to the cloud anchor when no return path is given", () => {
    const params = buildBillingPortalParams({
      request: new Request("https://autovault.dev/api/billing/portal"),
      env: {},
      customerId: "cus_x",
      returnTo: undefined
    });
    expect(params.get("return_url")).toBe("https://autovault.dev/cloud#launch-path");
  });
});
