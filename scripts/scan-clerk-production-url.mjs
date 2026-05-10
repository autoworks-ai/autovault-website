#!/usr/bin/env node

const startUrl = new URL(process.argv[2] || "https://autovault.dev/");
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

  if (contentType.includes("text/html")) {
    for (const asset of extractAssets(text, url)) {
      if (asset.origin === startUrl.origin && !seen.has(asset.toString())) {
        queue.push(asset);
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`Found development Clerk marker in deployed assets:\n${findings.join("\n")}`);
  process.exit(1);
}

console.log(`Scanned ${seen.size} deployed asset(s) from ${startUrl.origin}; no development Clerk markers found.`);

function scanText(url, text) {
  for (const marker of markerPatterns) {
    marker.pattern.lastIndex = 0;
    if (marker.pattern.test(text)) {
      findings.push(`${url} contains development Clerk marker "${marker.label}"`);
    }
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
