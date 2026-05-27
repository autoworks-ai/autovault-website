#!/usr/bin/env node

const args = process.argv.slice(2);
const startUrlArg = args.find((arg) => !arg.startsWith("--")) || "https://autovault.dev/";
const verifyFapi = args.includes("--verify-fapi");
const startUrl = new URL(startUrlArg);
const CLERK_JS_PATH = "/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
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

  const response = await fetch(url);

  if (!response.ok) {
    findings.push(`${key} returned ${response.status}`);
    continue;
  }

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
