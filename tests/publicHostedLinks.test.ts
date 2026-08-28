import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pageDocs } from "../.vitepress/shared/pageDocs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Derive markdown files from pageDocs so newly added pages are automatically covered.
const scannedRoots = [
  ".vitepress/config.ts",
  ".vitepress/theme/components",
  ".vitepress/theme/index.ts",
  "public/_redirects",
  ...pageDocs.map((doc) => doc.file)
];

const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

/**
 * This file used to enforce the opposite rule: /cloud was unlisted while the
 * hosted vault was a name you reserved, and nothing public was allowed to link
 * it. Sync shipped, so the rule inverted. What did NOT change is that the
 * hosted route has an anchor -- clerkBrand.cloudPath is "/cloud#launch-path",
 * and Clerk's signInFallbackRedirectUrl is the same constant -- so a second
 * copy written as a bare literal sends half the visitors to a different scroll
 * position than the sign-in bounce does.
 *
 * A note for whoever inverts this next. The old scan ran a regex that required
 * a quote straight after `href:`, so `href: clerkBrand.cloudPath` never matched
 * it. Flipping the posture without rewriting these cases would have left the
 * file green and guarding nothing at all.
 */
describe("public hosted route links", () => {
  it("links Cloud from the public nav, signed in or not", () => {
    const topbar = read(".vitepress/theme/components/AvTopbar.vue");

    expect(topbar).toContain('{ label: "Cloud", href: clerkBrand.cloudPath }');
    // In the array itself, not pushed on behind an auth check. /cloud is where
    // sign-up happens, so gating it on being signed in hid it from precisely
    // the people it is for.
    expect(topbar).not.toContain("isClerkSignedIn.value");
    expect(topbar).not.toContain("useClerkApiAuth");
  });

  it("links Cloud from the docs sidebar", () => {
    const docsShell = read(".vitepress/theme/components/DocsShell.vue");

    expect(docsShell).toContain('{ label: "Cloud", href: clerkBrand.cloudPath }');
    expect(docsShell).toContain('import { clerkBrand } from "../clerk";');
  });

  it("writes the hosted route through clerkBrand, never as a bare literal", () => {
    // The inverse of the rule this file used to hold, and the reason the scan
    // survived the flip: exactly one file gets to spell the path out.
    const offenders = scanFiles(scannedRoots)
      .flatMap((file) => matchesForFile(file))
      .filter((match) => !allowedCloudLinkFiles.has(match.file));

    expect(offenders).toEqual([]);
  });

  it("still does not publicly link the pairing endpoint", () => {
    // /cloud/pair is addressed by a one-time code the CLI prints. It is out of
    // the sitemap and out of local search, and nothing in the nav should walk a
    // visitor to a form they have no code for.
    const offenders = scanFiles(scannedRoots)
      .flatMap((file) => matchesForFile(file, pairHrefPattern))
      .filter((match) => !allowedCloudLinkFiles.has(match.file));

    expect(offenders).toEqual([]);
  });

  it("keeps the retired launch copy out of local search", () => {
    expect(read(".vitepress/theme/components/DocsShell.vue")).not.toContain("Cloud launch");
  });
});

const allowedCloudLinkFiles = new Set([
  "public/_redirects"
]);

const cloudHrefPattern = /\bhref\s*[:=]\s*["']\/cloud(?:["'#?])/g;
const pairHrefPattern = /\bhref\s*[:=]\s*["']\/cloud\/pair/g;

function scanFiles(paths: string[]): string[] {
  return paths.flatMap((path) => {
    const absolute = resolve(repoRoot, path);
    const stat = statSync(absolute);
    if (stat.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = resolve(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) return walk(absolute);
    return [absolute];
  }).filter((file) => [".md", ".ts", ".vue"].includes(extname(file)));
}

function matchesForFile(file: string, pattern = cloudHrefPattern) {
  const rel = relative(repoRoot, file);
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(pattern)].map((match) => ({
    file: rel,
    match: match[0],
    line: lineForOffset(text, match.index ?? 0)
  }));
}

function lineForOffset(text: string, offset: number) {
  return text.slice(0, offset).split("\n").length;
}
