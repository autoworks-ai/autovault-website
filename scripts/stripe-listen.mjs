#!/usr/bin/env node
/**
 * Forward live Stripe test events to the local webhook, authenticating from
 * .dev.vars rather than from `stripe login`.
 *
 * Why not just `stripe listen`: that relies on the CLI's own stored
 * credentials, whose test_mode_api_key Stripe expires 90 days after login.
 * When it lapses the failure is remote from its cause -- checkout starts
 * returning "Expired API Key provided: sk_test_***" mid-funnel, and nothing
 * points at the CLI. Reading the same key the app uses means there is one
 * credential to keep valid instead of two, and a dashboard secret key does
 * not expire at all.
 *
 * The key is passed through the environment, never as an argv flag, so it
 * cannot leak into `ps` output or a shell history file.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const FORWARD_TO = "http://localhost:8788/api/billing/webhook";

function readDevVar(name) {
  let contents;
  try {
    contents = readFileSync(new URL("../.dev.vars", import.meta.url), "utf-8");
  } catch {
    return null;
  }
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== name) continue;
    return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const apiKey = process.env.STRIPE_API_KEY || readDevVar("STRIPE_SECRET_KEY");

if (!apiKey) {
  console.error(
    [
      "No Stripe key found.",
      "",
      "Add STRIPE_SECRET_KEY to .dev.vars — Stripe Dashboard > Developers >",
      "API keys > Secret key (test mode). Do not use the key from",
      "`stripe config --list`: Stripe expires that one 90 days after login.",
    ].join("\n")
  );
  process.exit(1);
}

if (!apiKey.startsWith("sk_test_") && !apiKey.startsWith("rk_test_")) {
  // A live key here would forward real events at a local webhook that writes
  // to the dev database. Refuse rather than warn.
  console.error(`Refusing to run: STRIPE_SECRET_KEY is not a test-mode key (starts with "${apiKey.slice(0, 8)}").`);
  process.exit(1);
}

const child = spawn("stripe", ["listen", "--forward-to", FORWARD_TO], {
  stdio: "inherit",
  env: { ...process.env, STRIPE_API_KEY: apiKey },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (error) => {
  console.error(`Could not start the Stripe CLI: ${error.message}`);
  process.exit(1);
});
