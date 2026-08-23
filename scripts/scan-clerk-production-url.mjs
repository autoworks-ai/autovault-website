#!/usr/bin/env node

const args = process.argv.slice(2);
const startUrlArg = args.find((arg) => !arg.startsWith("--")) || "https://autovault.dev/";
const verifyFapi = args.includes("--verify-fapi");
const startUrl = parseStartUrl(startUrlArg);
const CLERK_JS_PATH = "/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
// A fresh Cloudflare Pages deployment URL can 404 for a few seconds after the
// deploy step reports success. Without this wait the scan reports a propagation
// race as a Clerk finding, which is how a real guard gets ignored or disabled.
const READY_TIMEOUT_MS = numericFlag("--ready-timeout-ms", 60_000);
const READY_INTERVAL_MS = numericFlag("--ready-interval-ms", 2_000);
const READY_REQUEST_TIMEOUT_MS = 10_000;
// Floor so the attempt that lands on the deadline still has time to report the
// deployment's real status instead of aborting mid-flight and hiding it.
const MIN_READY_ATTEMPT_MS = 250;
// Assets are crawled inside the same propagation window as the page that links
// them, so they get the same treatment on a much shorter budget: once the entry
// point is live, a hashed asset that is still 404ing is nearly always a race.
const ASSET_TIMEOUT_MS = 5_000;
const ASSET_INTERVAL_MS = 500;
const markerPatterns = [
  {
    label: "pk_test_ publishable key",
    pattern: /pk_test_[A-Za-z0-9_.\-$]{12,}/g
  },
  {
    label: "Clerk accounts.dev frontend API",
    pattern: /[a-z0-9-]+\.clerk\.accounts\.dev/g
  }
];

const seen = new Set();
const queue = [startUrl];
const findings = [];
const productionClerkKeys = new Set();

while (queue.length > 0) {
  const url = queue.shift();
  const key = url.toString();

  if (seen.has(key)) continue;
  seen.add(key);

  const isEntryPoint = key === startUrl.toString();
  const attempt = await fetchUntilReachable(url, {
    timeoutMs: isEntryPoint ? READY_TIMEOUT_MS : ASSET_TIMEOUT_MS,
    intervalMs: isEntryPoint ? READY_INTERVAL_MS : ASSET_INTERVAL_MS
  });

  if (!attempt.ok) {
    // An entry point that never comes up is a propagation failure, not a Clerk
    // finding, and saying so is the difference between a guard people act on and
    // one they learn to ignore.
    if (isEntryPoint) {
      console.error(
        `Deployment did not become reachable: ${key} ` +
          `(${attempt.attempts} attempt(s) over ${(attempt.elapsedMs / 1000).toFixed(1)}s, last outcome: ${attempt.lastOutcome}).`
      );
      process.exit(1);
    }

    findings.push(`${key} ${attempt.lastOutcome}`);
    continue;
  }

  const response = attempt.response;
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  scanText(key, text);
  collectProductionClerkKeys(text);

  if (contentType.includes("text/html")) {
    for (const asset of extractAssets(text, url)) {
      if (asset.origin === startUrl.origin && !seen.has(asset.toString())) {
        queue.push(asset);
      }
    }
  }
}

if (verifyFapi) {
  if (productionClerkKeys.size === 0) {
    findings.push(`${startUrl} did not contain a production Clerk publishable key to verify.`);
  }

  for (const publishableKey of productionClerkKeys) {
    const parsed = parsePublishableKey(publishableKey);
    if (!parsed) continue;
    await verifyClerkFrontendApi(parsed.frontendApi);
  }
}

if (findings.length > 0) {
  console.error(`Found Clerk production deployment issue in deployed assets:\n${findings.join("\n")}`);
  process.exit(1);
}

const fapiSuffix = verifyFapi ? ` Clerk Frontend API host(s) verified: ${productionClerkKeys.size}.` : "";
console.log(`Scanned ${seen.size} deployed asset(s) from ${startUrl.origin}; no development Clerk markers found.${fapiSuffix}`);

function parseStartUrl(value) {
  try {
    return new URL(value);
  } catch {
    // The workflow builds this from the Pages deploy output, and flags only take
    // the --flag=value form, so a bad value here is a misconfiguration worth naming.
    console.error(`Invalid deployment URL to scan: ${value}`);
    process.exit(1);
  }
}

function numericFlag(name, fallback) {
  const prefix = `${name}=`;
  const flag = args.find((arg) => arg.startsWith(prefix));
  if (!flag) return fallback;

  const value = Number(flag.slice(prefix.length));
  if (!Number.isFinite(value) || value < 0) {
    console.error(`Invalid ${name} value: ${flag.slice(prefix.length)}`);
    process.exit(1);
  }

  return value;
}

// Transport-only readiness: this waits for a 2xx and nothing else. The Clerk
// assertions stay strict and run on the body afterwards, so a deployment that is
// live but ships a preview key still fails loudly instead of timing out here.
async function fetchUntilReachable(url, { timeoutMs, intervalMs }) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const maxIntervalMs = intervalMs * 4;
  let currentIntervalMs = intervalMs;
  let attempts = 0;
  let lastOutcome = "no response";

  for (;;) {
    attempts += 1;
    const requestTimeoutMs = Math.min(READY_REQUEST_TIMEOUT_MS, Math.max(MIN_READY_ATTEMPT_MS, deadline - Date.now()));
    const attempt = await fetchOnce(url, requestTimeoutMs);

    if (attempt.ok) {
      if (attempts > 1) {
        console.log(`${url} became reachable after ${attempts} attempt(s) over ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
      }
      return { ok: true, response: attempt.response };
    }

    lastOutcome = attempt.outcome;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    const waitMs = Math.min(currentIntervalMs, remainingMs);
    console.log(`${url} is not live yet (${lastOutcome}); retrying in ${waitMs}ms.`);
    await sleep(waitMs);
    currentIntervalMs = Math.min(currentIntervalMs * 2, maxIntervalMs);
  }

  return { ok: false, attempts, elapsedMs: Date.now() - startedAt, lastOutcome };
}

async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (response.ok) return { ok: true, response };

    await response.arrayBuffer().catch(() => {});
    return { ok: false, outcome: `returned ${response.status}` };
  } catch (error) {
    return { ok: false, outcome: `request failed: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    // Cleared before the response is handed back, so reading the body later
    // cannot be aborted by this timer.
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scanText(url, text) {
  for (const marker of markerPatterns) {
    marker.pattern.lastIndex = 0;
    if (marker.pattern.test(text)) {
      findings.push(`${url} contains development Clerk marker "${marker.label}"`);
    }
  }
}

function collectProductionClerkKeys(text) {
  for (const match of text.matchAll(/pk_live_[A-Za-z0-9_.\-$]{12,}/g)) {
    productionClerkKeys.add(match[0]);
  }
}

function parsePublishableKey(publishableKey) {
  const match = publishableKey.match(/^pk_(test|live)_(.+)$/);
  if (!match) return null;

  try {
    const frontendApi = Buffer.from(match[2], "base64url").toString("utf8").replace(/\$$/, "");
    if (!frontendApi || frontendApi.includes("\u0000")) return null;
    return { mode: match[1], frontendApi };
  } catch {
    return null;
  }
}

async function verifyClerkFrontendApi(frontendApi) {
  const url = new URL(CLERK_JS_PATH, `https://${frontendApi}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/javascript,text/javascript,*/*" }
    });

    if (!response.ok) {
      findings.push(`Clerk Frontend API ${url} returned ${response.status}.`);
    }
  } catch (error) {
    findings.push(`Clerk Frontend API ${url} could not be fetched: ${error instanceof Error ? error.message : String(error)}.`);
  } finally {
    clearTimeout(timeout);
  }
}

function extractAssets(html, baseUrl) {
  const urls = [];
  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const candidate = match[1];

    if (!candidate || candidate.startsWith("#") || candidate.startsWith("mailto:") || candidate.startsWith("tel:")) {
      continue;
    }

    const asset = new URL(candidate, baseUrl);

    if (/\.(?:css|html|js|json|mjs|txt|xml)(?:$|\?)/.test(asset.pathname)) {
      urls.push(asset);
    }
  }

  return urls;
}
