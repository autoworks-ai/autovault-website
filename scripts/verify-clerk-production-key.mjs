#!/usr/bin/env node

const target = normalizeTarget(process.argv[2] || process.env.CLERK_DEPLOY_TARGET || process.env.AUTOVAULT_DEPLOY_ENV || "preview");
const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "";

const result = validatePublishableKey({ publishableKey, target });

if (!result.ok) {
  console.error(result.message);
  process.exit(1);
}

console.log(`Clerk ${target} publishable key verified for ${result.frontendApi}.`);

function validatePublishableKey({ publishableKey, target }) {
  if (!publishableKey) {
    return {
      ok: false,
      message: `Missing VITE_CLERK_PUBLISHABLE_KEY for Clerk ${target} deploy.`
    };
  }

  const parsed = parsePublishableKey(publishableKey);

  if (!parsed) {
    return {
      ok: false,
      message: "VITE_CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key."
    };
  }

  if (target === "production" && parsed.mode !== "live") {
    return {
      ok: false,
      message: "Production Clerk deploys require a pk_live_ publishable key. Refusing to build a live artifact with a development/test Clerk key."
    };
  }

  if (target === "preview" && parsed.mode !== "test") {
    return {
      ok: false,
      message: "Preview Clerk deploys require a pk_test_ publishable key so PR artifacts cannot point at live Clerk."
    };
  }

  if (target === "production" && parsed.frontendApi.includes("accounts.dev")) {
    return {
      ok: false,
      message: `Production Clerk deploys cannot target accounts.dev (${parsed.frontendApi}). Use the production Clerk instance publishable key.`
    };
  }

  return { ok: true, frontendApi: parsed.frontendApi };
}

function parsePublishableKey(publishableKey) {
  const match = publishableKey.match(/^pk_(test|live)_(.+)$/);

  if (!match) return null;

  const [, mode, encodedFrontendApi] = match;

  try {
    const frontendApi = Buffer.from(encodedFrontendApi, "base64url").toString("utf8").replace(/\$$/, "");

    if (!frontendApi || frontendApi.includes("\u0000")) {
      return null;
    }

    return { mode, frontendApi };
  } catch {
    return null;
  }
}

function normalizeTarget(value) {
  const normalized = value.toLowerCase();

  if (normalized === "prod" || normalized === "production") return "production";
  if (normalized === "pr" || normalized === "preview" || normalized === "development" || normalized === "dev") return "preview";

  console.error(
    `Unknown CLERK_DEPLOY_TARGET "${value}". Valid values: production, prod, preview, pr, development, dev.`
  );
  process.exit(1);
}
