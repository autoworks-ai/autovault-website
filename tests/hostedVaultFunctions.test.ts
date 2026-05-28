import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession } from "../functions/api/_lib/auth.js";
import { onRequestGet as authStart } from "../functions/api/auth/start.js";
import { onRequestPost as checkoutHostedVault } from "../functions/api/checkout/hosted-vault.js";
import { onRequestPost as reconcileBilling } from "../functions/api/billing/reconcile.js";
import { onRequestPost as savePendingSkill } from "../functions/api/vaults/current/pending-skills.js";
import { onRequestPost as provisionHostedVault } from "../functions/api/vaults/provision.js";

describe("hosted vault Pages Function smoke tests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts unauthenticated playground auth through GitHub legacy fallback", async () => {
    const env = createPagesEnv({ subscriptionStatus: null });
    const request = new Request(`https://autovault.dev/api/auth/start?provider=github&return_to=${encodeURIComponent("/authoring.html#playground")}`);
    const response = await authStart({ request, env });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://github.com/login/oauth/authorize");
    expect(env.state.oauthStates[0].return_to).toBe("/authoring.html#playground");
  });

  it("sends an authenticated unpaid user to Stripe Checkout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/test_123"
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const env = createPagesEnv({ subscriptionStatus: null });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    const request = new Request("https://autovault.dev/api/checkout/hosted-vault", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ source: "playground" })
    });

    const response = await checkoutHostedVault({ request, env });
    const payload = await response.json() as { url: string };

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://checkout.stripe.com/c/test_123");
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers["stripe-version"]).toBe("2026-02-25.clover");
  });

  it("rejects checkout for anonymous users", async () => {
    const env = createPagesEnv({ subscriptionStatus: null });
    const request = new Request("https://autovault.dev/api/checkout/hosted-vault", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "deploy" })
    });

    const response = await checkoutHostedVault({ request, env });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/authentication required/i);
  });

  it("provisions a namespace for a paid user", async () => {
    const env = createPagesEnv({ subscriptionStatus: "active" });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    const request = new Request("https://autovault.dev/api/vaults/provision", { method: "POST", headers: { cookie } });

    const response = await provisionHostedVault({ request, env });
    const payload = await response.json() as { vault: { slug: string; public_url: string; status: string } };

    expect(response.status).toBe(200);
    expect(payload.vault.slug).toMatch(/^jack-[a-f0-9]{6}$/);
    expect(payload.vault.status).toBe("reserved");
    expect(payload.vault.public_url).toBe(`https://vault.autovault.dev/${payload.vault.slug}`);
  });

  it("saves a pending playground skill after checkout return provisioning", async () => {
    const env = createPagesEnv({ subscriptionStatus: "active" });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    await provisionHostedVault({
      request: new Request("https://autovault.dev/api/vaults/provision", { method: "POST", headers: { cookie } }),
      env
    });

    const request = new Request("https://autovault.dev/api/vaults/current/pending-skills", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        skill_name: "weather",
        source_text: "---\nname: weather\n---\n# Weather",
        queued_skills: ["extract-pdf"]
      })
    });
    const response = await savePendingSkill({ request, env });
    const payload = await response.json() as { pending: { name: string; queued_skills: string[] } };

    expect(response.status).toBe(200);
    expect(payload.pending.name).toBe("weather");
    expect(payload.pending.queued_skills).toEqual(["extract-pdf"]);
    expect(env.state.pendingSkills).toHaveLength(1);
  });

  it("reconciles a checkout session into customer + subscription rows", async () => {
    const fetchMock = stubStripeSession({
      id: "cs_test_recon",
      client_reference_id: "github_1",
      customer: "cus_test_recon",
      payment_status: "paid",
      subscription: {
        id: "sub_test_recon",
        status: "active",
        current_period_end: 1893456000,
        items: { data: [{ price: { id: "price_hosted_vault" } }] }
      }
    });

    const env = createPagesEnv({ subscriptionStatus: null });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    const request = new Request("https://autovault.dev/api/billing/reconcile", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_recon" })
    });

    const response = await reconcileBilling({ request, env });
    const payload = await response.json() as {
      reconciled: boolean;
      subscription: { active: boolean; status: string; stripe_subscription_id: string; price_id: string };
    };

    expect(response.status).toBe(200);
    expect(payload.reconciled).toBe(true);
    expect(payload.subscription.active).toBe(true);
    expect(payload.subscription.status).toBe("active");
    expect(payload.subscription.stripe_subscription_id).toBe("sub_test_recon");
    expect(env.state.customers).toEqual([
      expect.objectContaining({ user_id: "github_1", stripe_customer_id: "cus_test_recon" })
    ]);
    expect(env.state.subscriptions).toEqual([
      expect.objectContaining({
        user_id: "github_1",
        stripe_subscription_id: "sub_test_recon",
        stripe_customer_id: "cus_test_recon",
        status: "active",
        price_id: "price_hosted_vault"
      })
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/checkout/sessions/cs_test_recon");
    expect(url).toContain("expand%5B%5D=subscription");
    expect(url).toContain("expand%5B%5D=customer");
    expect((init.headers as Record<string, string>)["stripe-version"]).toBe("2026-02-25.clover");
  });

  it("is idempotent — reconciling the same session twice keeps a single subscription row", async () => {
    stubStripeSession({
      id: "cs_test_idem",
      client_reference_id: "github_1",
      customer: "cus_test_idem",
      subscription: {
        id: "sub_test_idem",
        status: "active",
        current_period_end: 1893456000,
        items: { data: [{ price: { id: "price_hosted_vault" } }] }
      }
    });

    const env = createPagesEnv({ subscriptionStatus: null });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    const buildRequest = () => new Request("https://autovault.dev/api/billing/reconcile", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_idem" })
    });

    const first = await reconcileBilling({ request: buildRequest(), env });
    const second = await reconcileBilling({ request: buildRequest(), env });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(env.state.customers).toHaveLength(1);
    expect(env.state.subscriptions).toHaveLength(1);
  });

  it("rejects reconcile attempts for anonymous users", async () => {
    const env = createPagesEnv({ subscriptionStatus: null });
    const request = new Request("https://autovault.dev/api/billing/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: "cs_anything" })
    });

    const response = await reconcileBilling({ request, env });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/authentication required/i);
  });

  it("rejects reconcile when session_id is missing", async () => {
    const env = createPagesEnv({ subscriptionStatus: null });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    const request = new Request("https://autovault.dev/api/billing/reconcile", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({})
    });

    const response = await reconcileBilling({ request, env });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/session_id is required/i);
  });

  it("rejects reconcile when the session belongs to another user", async () => {
    stubStripeSession({
      id: "cs_test_foreign",
      client_reference_id: "github_2",
      customer: "cus_foreign",
      subscription: {
        id: "sub_foreign",
        status: "active",
        current_period_end: 1893456000,
        items: { data: [{ price: { id: "price_hosted_vault" } }] }
      }
    });

    const env = createPagesEnv({ subscriptionStatus: null });
    const cookie = await createSession(new Request("https://autovault.dev"), env, "github_1");
    const request = new Request("https://autovault.dev/api/billing/reconcile", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_foreign" })
    });

    const response = await reconcileBilling({ request, env });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/does not belong/i);
    expect(env.state.customers).toEqual([]);
    expect(env.state.subscriptions).toEqual([]);
  });
});

function stubStripeSession(session: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(session), {
    status: 200,
    headers: { "content-type": "application/json" }
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function createPagesEnv({ subscriptionStatus }: { subscriptionStatus: string | null }) {
  const state = {
    users: new Map<string, { id: string; email: string; name: string; avatar_url: string | null; provider: string }>([
      ["github_1", { id: "github_1", email: "jack@example.com", name: "Jack", avatar_url: null, provider: "github" }],
      ["github_2", { id: "github_2", email: "other@example.com", name: "Other", avatar_url: null, provider: "github" }]
    ]),
    sessions: new Map<string, string>(),
    oauthStates: [] as Array<Record<string, unknown>>,
    vaults: [] as Array<Record<string, unknown>>,
    pendingSkills: [] as Array<Record<string, unknown>>,
    customers: [] as Array<Record<string, unknown>>,
    subscriptions: [] as Array<Record<string, unknown>>
  };

  return {
    state,
    SESSION_SECRET: "test-session-secret",
    GITHUB_CLIENT_ID: "gh_client",
    GITHUB_CLIENT_SECRET: "gh_secret",
    STRIPE_SECRET_KEY: "rk_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    AUTOVAULT_HOSTED_PRICE_ID: "price_hosted_vault",
    AUTOVAULT_VAULT_OBJECTS: { async put() {} },
    AUTOVAULT_DB: {
      prepare(sql: string) {
        return {
          bind(...binds: unknown[]) {
            return {
              async first() {
                if (sql.includes("from sessions")) {
                  const userId = state.sessions.get(String(binds[0]));
                  return userId ? state.users.get(userId) : null;
                }
                if (sql.includes("from subscriptions")) {
                  return subscriptionStatus ? { status: subscriptionStatus, stripe_subscription_id: "sub_1", price_id: "price_1" } : null;
                }
                if (sql.includes("from vaults")) {
                  return state.vaults.find((vault) => vault.user_id === binds[0]) ?? null;
                }
                return null;
              },
              async run() {
                if (sql.includes("insert into sessions")) {
                  state.sessions.set(String(binds[0]), String(binds[1]));
                }
                if (sql.includes("insert into oauth_states")) {
                  state.oauthStates.push({ state: binds[0], provider: binds[1], return_to: binds[2] });
                }
                if (sql.includes("insert into vaults")) {
                  state.vaults.push({
                    id: binds[0],
                    user_id: binds[1],
                    slug: binds[2],
                    status: binds[3],
                    public_url: binds[4],
                    created_at: binds[5],
                    provisioned_at: binds[6]
                  });
                }
                if (sql.includes("insert into pending_skills")) {
                  state.pendingSkills.push({
                    id: binds[0],
                    vault_id: binds[1],
                    user_id: binds[2],
                    name: binds[3],
                    source_text: binds[7],
                    queued_skills_json: binds[9]
                  });
                }
                if (sql.includes("insert into customers")) {
                  const userId = String(binds[0]);
                  const customerId = String(binds[1]);
                  const existing = state.customers.find((row) => row.user_id === userId);
                  if (existing) {
                    existing.stripe_customer_id = customerId;
                    existing.updated_at = binds[3];
                  } else {
                    state.customers.push({ user_id: userId, stripe_customer_id: customerId, created_at: binds[2], updated_at: binds[3] });
                  }
                }
                if (sql.includes("insert into subscriptions")) {
                  const userId = String(binds[0]);
                  const existing = state.subscriptions.find((row) => row.user_id === userId);
                  const next = {
                    user_id: userId,
                    stripe_subscription_id: binds[1],
                    stripe_customer_id: binds[2],
                    status: binds[3],
                    price_id: binds[4],
                    current_period_end: binds[5],
                    updated_at: binds[7]
                  };
                  if (existing) {
                    Object.assign(existing, next);
                  } else {
                    state.subscriptions.push({ ...next, created_at: binds[6] });
                  }
                }
                return { success: true };
              }
            };
          }
        };
      }
    }
  };
}
