import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkMocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
  getUser: vi.fn()
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: clerkMocks.createClerkClient
}));

import { onRequestPost as checkoutHostedVault } from "../functions/api/checkout/hosted-vault.js";
import { onRequestGet as getMe } from "../functions/api/me.js";

describe("Clerk-backed Pages Function auth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clerkMocks.authenticateRequest.mockReset();
    clerkMocks.createClerkClient.mockReset();
    clerkMocks.getUser.mockReset();
    clerkMocks.createClerkClient.mockReturnValue({
      authenticateRequest: clerkMocks.authenticateRequest,
      users: { getUser: clerkMocks.getUser }
    });
    clerkMocks.getUser.mockResolvedValue({
      id: "user_123",
      primaryEmailAddress: { emailAddress: "jack@example.com" },
      emailAddresses: [{ emailAddress: "jack@example.com" }],
      fullName: "Jack Arturo",
      firstName: "Jack",
      lastName: "Arturo",
      username: "jack",
      imageUrl: "https://img.clerk.com/avatar"
    });
  });

  it("returns anonymous state when Clerk mode is configured but no token is present", async () => {
    clerkMocks.authenticateRequest.mockResolvedValue(clerkRequestState(null));

    const env = createClerkEnv();
    const response = await getMe({ request: new Request("https://autovault.dev/api/me"), env });
    const payload = await response.json() as { user: unknown; subscription: unknown; vault: unknown };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ user: null, subscription: null, vault: null });
  });

  it("maps a valid Clerk Bearer token into /api/me state", async () => {
    clerkMocks.authenticateRequest.mockResolvedValue(clerkRequestState("user_123"));

    const env = createClerkEnv();
    const response = await getMe({
      request: new Request("https://autovault.dev/api/me", {
        headers: { authorization: "Bearer valid-session-token" }
      }),
      env
    });
    const payload = await response.json() as { user: { id: string; email: string; name: string } };

    expect(response.status).toBe(200);
    expect(payload.user).toMatchObject({
      id: "clerk_user_123",
      email: "jack@example.com",
      name: "Jack Arturo"
    });
    expect(env.state.users.get("clerk_user_123")?.provider).toBe("clerk");
  });

  it("rejects an invalid Clerk Bearer token instead of silently returning anonymous", async () => {
    clerkMocks.authenticateRequest.mockResolvedValue(clerkRequestState(null));

    const response = await getMe({
      request: new Request("https://autovault.dev/api/me", {
        headers: { authorization: "Bearer invalid-session-token" }
      }),
      env: createClerkEnv()
    });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/invalid clerk session/i);
  });

  it("recognizes invalid Bearer tokens with case-insensitive schemes and extra whitespace", async () => {
    clerkMocks.authenticateRequest.mockResolvedValue(clerkRequestState(null));

    const response = await getMe({
      request: new Request("https://autovault.dev/api/me", {
        headers: { authorization: "bearer    invalid-session-token" }
      }),
      env: createClerkEnv()
    });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/invalid clerk session/i);
  });

  it("creates checkout for the authenticated Clerk-backed user", async () => {
    clerkMocks.authenticateRequest.mockResolvedValue(clerkRequestState("user_123"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "cs_test_clerk",
      url: "https://checkout.stripe.com/c/test_clerk"
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const env = createClerkEnv();
    const response = await checkoutHostedVault({
      request: new Request("https://autovault.dev/api/checkout/hosted-vault", {
        method: "POST",
        headers: { authorization: "Bearer valid-session-token", "content-type": "application/json" },
        body: JSON.stringify({ source: "deploy" })
      }),
      env
    });
    const payload = await response.json() as { url: string };
    // Find the Checkout POST rather than assuming it is the first call. The
    // route now asks Stripe about prior subscriptions before building the
    // session, so call 0 is a GET with no body and this read used to return
    // the string "undefined" and fail on the wrong thing.
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls as unknown as Array<[string, { body?: unknown }]>;
    const checkoutCall = calls.find(
      (call) => String(call[0]) === "https://api.stripe.com/v1/checkout/sessions"
    );
    if (!checkoutCall) throw new Error("no Checkout Session request was made");
    const checkoutBody = String(checkoutCall[1].body);

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://checkout.stripe.com/c/test_clerk");
    expect(checkoutBody).toContain("client_reference_id=clerk_user_123");
    expect(checkoutBody).toContain("metadata%5Buser_id%5D=clerk_user_123");
  });
});

function clerkRequestState(userId: string | null) {
  return {
    isAuthenticated: Boolean(userId),
    toAuth: () => ({ userId })
  };
}

function createClerkEnv() {
  const trialClaims = new Set<string>();
  const state = {
    users: new Map<string, { id: string; email: string | null; name: string | null; avatar_url: string | null; provider: string }>(),
    subscriptions: new Map<string, { status: string; stripe_subscription_id: string; price_id: string }>(),
    vaults: [] as Array<Record<string, unknown>>
  };

  return {
    state,
    CLERK_SECRET_KEY: "sk_test_mock",
    VITE_CLERK_PUBLISHABLE_KEY: "pk_test_mock",
    STRIPE_SECRET_KEY: "rk_test",
    AUTOVAULT_HOSTED_PRICE_ID: "price_hosted_vault",
    // Per-env, so each test starts eligible.
    AUTOVAULT_DB: {
      prepare(sql: string) {
        return {
          bind(...binds: unknown[]) {
            return {
              async first() {
                // The trial claim is an insert-with-returning, so it answers
                // through first(): a row back means this call won the claim.
                // Modelled here because the route now asks D1 to arbitrate
                // eligibility, and a stub that always answers null would report
                // every caller as having lost.
                if (sql.includes("trial_claims")) {
                  const userId = String(binds[0]);
                  if (sql.includes("insert into trial_claims")) {
                    if (trialClaims.has(userId)) return null;
                    trialClaims.add(userId);
                    return { user_id: userId };
                  }
                  return trialClaims.has(userId) ? { user_id: userId, session_id: null } : null;
                }
                if (sql.includes("where provider = ? and provider_user_id = ?")) {
                  return state.users.get(`${binds[0]}_${binds[1]}`) ?? null;
                }
                if (sql.includes("from subscriptions")) {
                  return state.subscriptions.get(String(binds[0])) ?? null;
                }
                if (sql.includes("from vaults")) {
                  return state.vaults.find((vault) => vault.user_id === binds[0]) ?? null;
                }
                return null;
              },
              async run() {
                if (sql.includes("insert into users")) {
                  const id = String(binds[0]);
                  state.users.set(id, {
                    id,
                    email: binds[3] as string | null,
                    name: binds[4] as string | null,
                    avatar_url: binds[5] as string | null,
                    provider: String(binds[1])
                  });
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
