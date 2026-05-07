import { describe, expect, it } from "vitest";
import { parseCookies, SESSION_COOKIE } from "../functions/api/_lib/auth.js";
import { hmacSha256Hex } from "../functions/api/_lib/crypto.js";
import { safeReturnTo } from "../functions/api/_lib/http.js";
import { buildHostedVaultCheckoutParams, STRIPE_API_VERSION, verifyStripeSignature } from "../functions/api/_lib/stripe.js";
import { provisionVault, savePendingSkill } from "../functions/api/_lib/vault.js";

describe("hosted vault auth helpers", () => {
  it("parses session cookies and constrains return paths", () => {
    expect((parseCookies(`${SESSION_COOKIE}=abc123; theme=dark`) as Record<string, string>)[SESSION_COOKIE]).toBe("abc123");
    expect(safeReturnTo("/authoring.html#playground")).toBe("/authoring.html#playground");
    expect(safeReturnTo("https://evil.example/callback")).toBe("/deploy.html#hosts");
  });
});

describe("hosted vault Stripe checkout", () => {
  it("builds a subscription Checkout Session request with server-side price and branding", () => {
    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/deploy.html"),
      env: {
        AUTOVAULT_HOSTED_PRICE_ID: "price_hosted_vault",
        STRIPE_BRAND_DISPLAY_NAME: "AutoVault Test"
      },
      user: { id: "github_1", email: "jack@example.com" },
      source: "playground"
    });

    expect(STRIPE_API_VERSION).toBe("2026-02-25.clover");
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("line_items[0][price]")).toBe("price_hosted_vault");
    expect(params.get("amount")).toBeNull();
    expect(params.get("metadata[user_id]")).toBe("github_1");
    expect(params.get("branding_settings[display_name]")).toBe("AutoVault Test");
    expect(params.get("success_url")).toContain("{CHECKOUT_SESSION_ID}");
  });

  it("rejects checkout creation when the hosted price is not configured", () => {
    expect(() => buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/deploy.html"),
      env: {},
      user: { id: "github_1" }
    })).toThrow("AUTOVAULT_HOSTED_PRICE_ID");
  });

  it("verifies Stripe webhook signatures with the expected HMAC payload", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const timestamp = 1_800_000_000;
    const secret = "whsec_test";
    const signature = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
    const header = `t=${timestamp},v1=${signature}`;

    await expect(verifyStripeSignature(payload, header, secret, timestamp)).resolves.toBe(true);
    await expect(verifyStripeSignature(payload, header.replace(signature, "00"), secret, timestamp)).resolves.toBe(false);
  });
});

describe("hosted vault provisioning", () => {
  it("requires an active subscription before provisioning a namespace", async () => {
    const env = createFakeEnv({ subscriptionStatus: "past_due" });

    await expect(provisionVault(env, { id: "github_1", email: "jack@example.com" })).rejects.toMatchObject({ status: 402 });
  });

  it("provisions a shared static namespace and stores pending imports", async () => {
    const env = createFakeEnv({ subscriptionStatus: "active" });
    const user = { id: "github_1", email: "jack@example.com" };
    const vault = await provisionVault(env, user);
    const pending = await savePendingSkill(env, user, vault, {
      skill_name: "Weather App",
      version: "0.1.0",
      source_label: "browser playground",
      source_text: "---\nname: weather\n---\n# Weather",
      queued_skills: ["extract-pdf"]
    });

    expect(vault.slug).toMatch(/^jack-[a-f0-9]{6}$/);
    expect(vault.public_url).toBe(`https://vault.autovault.dev/${vault.slug}`);
    expect(pending.name).toBe("weather-app");
    expect(env.state.pendingSkills).toHaveLength(1);
    expect(env.state.kvWrites[0].key).toMatch(/^vaults\/.+\/pending\/.+\.md$/);
  });
});

function createFakeEnv({ subscriptionStatus }: { subscriptionStatus: string }) {
  const state = {
    vaults: [] as Array<Record<string, unknown>>,
    pendingSkills: [] as Array<Record<string, unknown>>,
    kvWrites: [] as Array<{ key: string; value: string }>
  };

  return {
    state,
    AUTOVAULT_VAULT_OBJECTS: {
      async put(key: string, value: string) {
        state.kvWrites.push({ key, value });
      }
    },
    AUTOVAULT_DB: {
      prepare(sql: string) {
        return {
          bind(...binds: unknown[]) {
            return {
              async first() {
                if (sql.includes("from subscriptions")) {
                  return subscriptionStatus ? { status: subscriptionStatus, stripe_subscription_id: "sub_1", price_id: "price_1" } : null;
                }
                if (sql.includes("from vaults")) {
                  return state.vaults.find((vault) => vault.user_id === binds[0]) ?? null;
                }
                return null;
              },
              async run() {
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
                    source_hash: binds[6],
                    source_text: binds[7],
                    queued_skills_json: binds[9]
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
