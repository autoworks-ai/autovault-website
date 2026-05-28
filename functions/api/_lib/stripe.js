import { ApiError } from "./http.js";
import { nowIso, run } from "./db.js";
import { hmacSha256Hex, timingSafeEqualHex } from "./crypto.js";

export const STRIPE_API_VERSION = "2026-02-25.clover";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function isPaidStatus(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status || "");
}

export function buildHostedVaultCheckoutParams({ request, env, user, source = "hosted-vault" }) {
  if (!env.AUTOVAULT_HOSTED_PRICE_ID) throw new ApiError(503, "AUTOVAULT_HOSTED_PRICE_ID is not configured.");

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/cloud?hosted=success&session_id={CHECKOUT_SESSION_ID}#launch-path`;
  const cancelUrl = `${origin}/cloud?hosted=cancelled#launch-path`;
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("client_reference_id", user.id);
  params.set("line_items[0][price]", env.AUTOVAULT_HOSTED_PRICE_ID);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("metadata[user_id]", user.id);
  params.set("metadata[source]", source);
  params.set("subscription_data[metadata][user_id]", user.id);
  params.set("subscription_data[metadata][source]", source);
  params.set("submit_type", env.STRIPE_CHECKOUT_SUBMIT_TYPE || "subscribe");
  if (user.email) params.set("customer_email", user.email);

  applyBranding(params, env);
  applyCustomText(params, env);
  return params;
}

export async function createCheckoutSession(env, params, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  const response = await fetcher("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION
    },
    body: params
  });
  const payload = await response.json();
  if (!response.ok || !payload.url) throw new ApiError(502, payload.error?.message || "Stripe Checkout Session creation failed.");
  return payload;
}

export async function verifyStripeSignature(payload, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;
  const parts = parseStripeSignatureHeader(signatureHeader);
  if (!parts.timestamp || parts.signatures.length === 0) return false;
  if (Math.abs(nowSeconds - parts.timestamp) > toleranceSeconds) return false;

  const expected = await hmacSha256Hex(secret, `${parts.timestamp}.${payload}`);
  return parts.signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

export async function handleStripeEvent(env, event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.client_reference_id || session?.metadata?.user_id;
    if (!userId || !session?.customer) return { stored: false };

    await upsertCustomer(env, { userId, customerId: asId(session.customer) });
    return { stored: true };
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created" || event.type === "customer.subscription.deleted") {
    const subscription = event.data?.object;
    const userId = subscription?.metadata?.user_id || await userIdForCustomer(env, asId(subscription?.customer));
    if (!userId || !subscription?.id) return { stored: false };

    await upsertSubscription(env, {
      userId,
      subscriptionId: subscription.id,
      customerId: asId(subscription.customer),
      status: subscription.status,
      priceId: priceIdForSubscription(subscription),
      currentPeriodEnd: subscription.current_period_end || null
    });
    return { stored: true };
  }

  return { stored: false };
}

export async function upsertCustomer(env, { userId, customerId }) {
  if (!userId || !customerId) return false;
  await run(env, `
    insert into customers (user_id, stripe_customer_id, created_at, updated_at)
    values (?, ?, ?, ?)
    on conflict(user_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      updated_at = excluded.updated_at
  `, userId, customerId, nowIso(), nowIso());
  return true;
}

export async function upsertSubscription(env, { userId, subscriptionId, customerId, status, priceId, currentPeriodEnd }) {
  if (!userId || !subscriptionId) return false;
  await run(env, `
    insert into subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, price_id, current_period_end, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do update set
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_customer_id = excluded.stripe_customer_id,
      status = excluded.status,
      price_id = excluded.price_id,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `, userId, subscriptionId, customerId || null, status || null, priceId || null, currentPeriodEnd || null, nowIso(), nowIso());
  return true;
}

export async function retrieveCheckoutSession(env, sessionId, fetcher = fetch) {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, "STRIPE_SECRET_KEY is not configured.");
  if (!sessionId) throw new ApiError(400, "session_id is required.");

  const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  url.searchParams.append("expand[]", "subscription");
  url.searchParams.append("expand[]", "customer");

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "stripe-version": STRIPE_API_VERSION
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(response.status === 404 ? 404 : 502, payload.error?.message || "Stripe session lookup failed.");
  return payload;
}

export { asId, priceIdForSubscription };

function applyBranding(params, env) {
  params.set("branding_settings[display_name]", env.STRIPE_BRAND_DISPLAY_NAME || "AutoVault");
  params.set("branding_settings[background_color]", env.STRIPE_BRAND_BACKGROUND_COLOR || "#0b1014");
  params.set("branding_settings[button_color]", env.STRIPE_BRAND_BUTTON_COLOR || "#5ad6c0");
  params.set("branding_settings[border_style]", env.STRIPE_BRAND_BORDER_STYLE || "rounded");
  params.set("branding_settings[font_family]", env.STRIPE_BRAND_FONT_FAMILY || "inter");
  if (env.STRIPE_BRAND_ICON_URL) {
    params.set("branding_settings[icon][type]", "url");
    params.set("branding_settings[icon][url]", env.STRIPE_BRAND_ICON_URL);
  }
  if (env.STRIPE_BRAND_LOGO_URL) {
    params.set("branding_settings[logo][type]", "url");
    params.set("branding_settings[logo][url]", env.STRIPE_BRAND_LOGO_URL);
  }
}

function applyCustomText(params, env) {
  if (env.STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT) {
    params.set("custom_text[submit][message]", env.STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT);
  }
  if (env.STRIPE_CHECKOUT_CUSTOM_TEXT_AFTER_SUBMIT) {
    params.set("custom_text[after_submit][message]", env.STRIPE_CHECKOUT_CUSTOM_TEXT_AFTER_SUBMIT);
  }
}

function parseStripeSignatureHeader(header) {
  const parts = { timestamp: 0, signatures: [] };
  for (const pair of header.split(",")) {
    const [key, value] = pair.split("=");
    if (key === "t") parts.timestamp = Number(value);
    if (key === "v1" && value) parts.signatures.push(value);
  }
  return parts;
}

async function userIdForCustomer(env, customerId) {
  if (!customerId) return null;
  const row = await env.AUTOVAULT_DB.prepare("select user_id from customers where stripe_customer_id = ?").bind(customerId).first();
  return row?.user_id ?? null;
}

function asId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

function priceIdForSubscription(subscription) {
  return subscription.items?.data?.[0]?.price?.id || null;
}
