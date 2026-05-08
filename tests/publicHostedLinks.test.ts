import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scannedRoots = [
  ".vitepress/config.ts",
  ".vitepress/theme/components",
  "public/_redirects",
  "about.md",
  "api.md",
  "authoring.md",
  "changelog.md",
  "compare.md",
  "deploy.md",
  "index.md",
  "quick-start.md",
  "security.md",
  "skill-detail.md",
  "skills-directory.md"
];

const allowedCloudLinkFiles = new Set([
  "public/_redirects"
]);

const cloudHrefPattern = /\bhref\s*[:=]\s*["']\/cloud(?:["'#?\/])/g;

describe("public hosted route links", () => {
  it("does not publicly link to the unlisted hosted cloud route", () => {
    const offenders = scanFiles(scannedRoots)
      .flatMap((file) => matchesForFile(file))
      .filter((match) => !allowedCloudLinkFiles.has(match.file));

    expect(offenders).toEqual([]);
  });

  it("does not expose the hosted route through local search copy", () => {
    const docsShell = readFileSync(resolve(repoRoot, ".vitepress/theme/components/DocsShell.vue"), "utf8");

    expect(docsShell).not.toContain("Cloud launch");
    expect(docsShell).not.toContain('href: "/cloud"');
  });
});

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

function matchesForFile(file: string) {
  const rel = relative(repoRoot, file);
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(cloudHrefPattern)].map((match) => ({
    file: rel,
    match: match[0],
    line: lineForOffset(text, match.index ?? 0)
  }));
}

function lineForOffset(text: string, offset: number) {
  return text.slice(0, offset).split("\n").length;
}
