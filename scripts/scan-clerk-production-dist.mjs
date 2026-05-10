#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const distDir = resolve(process.argv[2] || ".vitepress/dist");
const extensions = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".svg", ".txt", ".xml"]);
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

if (!existsSync(distDir)) {
  console.error(`Missing production dist directory: ${distDir}`);
  process.exit(1);
}

const matches = [];

for (const file of walk(distDir)) {
  if (!shouldScan(file)) continue;

  const content = readFileSync(file, "utf8");
  const marker = markerPatterns.find((candidate) => {
    candidate.pattern.lastIndex = 0;
    return candidate.pattern.test(content);
  });

  if (marker) {
    matches.push(`${relative(distDir, file)} contains development Clerk marker "${marker.label}"`);
  }
}

if (matches.length > 0) {
  console.error(`Found development Clerk marker in production assets:\n${matches.join("\n")}`);
  process.exit(1);
}

console.log(`Scanned ${distDir}; no development Clerk markers found.`);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      yield* walk(path);
    } else if (stat.isFile()) {
      yield path;
    }
  }
}

function shouldScan(file) {
  return extensions.has(file.slice(file.lastIndexOf(".")));
}
