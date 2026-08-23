#!/usr/bin/env node
/**
 * Set one key in .dev.vars from the clipboard (or stdin), without the value
 * ever appearing in a command line.
 *
 *   node scripts/set-dev-var.mjs STRIPE_SECRET_KEY
 *   pbpaste | node scripts/set-dev-var.mjs STRIPE_WEBHOOK_SECRET
 *
 * Why this exists rather than a sed one-liner: a one-liner puts the secret in
 * argv, where it lands in shell history, `ps` output, and any transcript of
 * the session that ran it. Reading from the clipboard keeps the value in
 * exactly two places -- the clipboard and .dev.vars -- and lets an agent set
 * a credential it is not supposed to have seen.
 *
 * Prints only a masked confirmation. Refuses live-mode Stripe keys outright.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEV_VARS = fileURLToPath(new URL("../.dev.vars", import.meta.url));

const ALLOWED = new Set([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AUTOVAULT_HOSTED_PRICE_ID",
  "STRIPE_PORTAL_CONFIGURATION_ID",
  "CLERK_SECRET_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "SESSION_SECRET",
]);

const name = process.argv[2];

if (!name || !ALLOWED.has(name)) {
  console.error(
    `Usage: node scripts/set-dev-var.mjs <NAME>\n\nAllowed: ${[...ALLOWED].join(", ")}`
  );
  process.exit(1);
}

function readSecret() {
  if (!process.stdin.isTTY) {
    const piped = readFileSync(0, "utf-8").trim();
    if (piped) return piped;
  }
  try {
    return execFileSync("pbpaste", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

const value = readSecret();

if (!value) {
  console.error("Nothing on the clipboard and nothing piped in. Copy the value first.");
  process.exit(1);
}

if (/\s/.test(value)) {
  console.error("Value contains whitespace — that is almost certainly not the credential you meant to copy.");
  process.exit(1);
}

// A live key here would point local development at real money.
if (/^(sk|rk)_live_/.test(value)) {
  console.error("Refusing: that is a LIVE Stripe key. .dev.vars is for test mode only.");
  process.exit(1);
}

if (name === "STRIPE_SECRET_KEY" && !/^(sk|rk)_test_/.test(value)) {
  console.error("Refusing: STRIPE_SECRET_KEY must be a test-mode key (sk_test_… or rk_test_…).");
  process.exit(1);
}

if (!existsSync(DEV_VARS)) {
  console.error(".dev.vars does not exist. Copy .dev.vars.example to .dev.vars first.");
  process.exit(1);
}

const contents = readFileSync(DEV_VARS, "utf-8");
const line = `${name}=${value}`;
const pattern = new RegExp(`^${name}=.*$`, "m");
const updated = pattern.test(contents)
  ? contents.replace(pattern, line)
  : `${contents.replace(/\n*$/, "")}\n${line}\n`;

writeFileSync(DEV_VARS, updated);

const masked = value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : "…";
console.log(`${name} set in .dev.vars (${masked}, ${value.length} chars).`);
