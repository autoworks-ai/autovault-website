import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { denyRows } from "../.vitepress/theme/data/security";
import config from "../.vitepress/config";

const securityPage = readFileSync(
  new URL("../.vitepress/theme/components/SecurityPage.vue", import.meta.url),
  "utf-8"
);

describe("public surface", () => {
  it("excludes internal markdown from the VitePress build", () => {
    // VitePress globs every .md in the repo as a page. Without these, the
    // internal design spec under docs/ (which documents the paid dashboard as
    // a mock), the internal README, and a duplicate HTML rendering of every
    // hosted skill bundle all build and land in the sitemap.
    const excluded = config.srcExclude ?? [];
    for (const pattern of ["docs/**", "README.md", "public/**", "CLAUDE.md", "AGENTS.md"]) {
      expect(excluded).toContain(pattern);
    }
  });
});

describe("security page claims", () => {
  it("mirrors the CLI denylist rather than inventing entries", () => {
    expect(denyRows.length).toBeGreaterThan(0);
    for (const row of denyRows) {
      expect(row.id).toBeTruthy();
      expect(row.pat).toBeTruthy();
      expect(row.reason).toBeTruthy();
      // The previous fixture carried invented CVE identifiers and researcher
      // handles under a heading inviting the reader to audit them.
      expect(row.id).not.toMatch(/^CVE-/i);
      expect(row.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("does not advertise commitments absent from the published policy", () => {
    // .github/SECURITY.md in autoworks-ai/autovault is authoritative: GitHub
    // Security Advisories, 3 business days, coordinated disclosure. No bounty,
    // no PGP key, no 48h/7-day SLA, no scheduled external audit.
    for (const claim of [
      "security@autoworks-ai",
      "0xC4F9 7E10 A2C8 1B3D",
      "max $5k",
      "Q3 2026",
      "CycloneDX",
      "within 48 hours"
    ]) {
      expect(securityPage).not.toContain(claim);
    }
    expect(securityPage).toContain("security/advisories/new");
  });

  it("only references CLI commands that exist", () => {
    // `autovault verify` was rendered as an interactive command on this page
    // and in the provenance caption; the real integrity check is
    // `autovault doctor`.
    expect(securityPage).not.toContain("autovault verify");
  });

  it("does not present doctor as an enforcing gate", () => {
    // TroubleshootingPage.vue's own documented behavior: "the doctor logs
    // mismatches but does not enforce; future versions may reject mismatched
    // signatures at load time." The provenance widget previously simulated a
    // "Rejected." verdict and captioned the section "any link broken = full
    // rejection," both overstating what `doctor` actually does today.
    expect(securityPage).not.toContain("full rejection");
    expect(securityPage).not.toContain('"Rejected."');
  });

  it("does not suggest repairing a tampered or remote signature mismatch", () => {
    // --repair only re-signs unsigned LOCAL skills; it refuses tampered
    // metadata and remote sources (TroubleshootingPage.vue:70), which is
    // exactly the forged-skill scenario this widget simulates. Telling the
    // reader to "repair... it yourself" for that case advertises a
    // remediation doctor won't actually perform.
    expect(securityPage).not.toMatch(/repair or reject it yourself/i);
  });
});
