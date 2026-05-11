import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANUAL_GHCR_IMAGE, RAILWAY_TEMPLATE_URL } from "../.vitepress/shared/deploy";
import { pageDocs } from "../.vitepress/shared/pageDocs";
import { comparisonPlayers, comparisonSources, homepageComparisonRows, homepageGateMetrics } from "../.vitepress/theme/data/marketing";
import { PRODUCT_STATUS, PRODUCT_VERSION, PRODUCT_VERSION_BADGE, PRODUCT_VERSION_SHORT } from "../.vitepress/theme/data/product";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("v1 content guardrails", () => {
  it("keeps primary product version copy centralized", () => {
    expect(PRODUCT_VERSION).toBe(`v${PRODUCT_VERSION_SHORT}`);
    expect(PRODUCT_VERSION).toBe("v0.2.1");
    expect(PRODUCT_STATUS).toBe("pre-1.0");
    expect(PRODUCT_VERSION_BADGE).toContain(PRODUCT_VERSION);
    expect(PRODUCT_VERSION_BADGE).not.toContain("Unreleased May 2026");

    const primarySurfaces = [
      ".vitepress/theme/components/AvTopbar.vue",
      ".vitepress/theme/components/DocsShell.vue",
      ".vitepress/theme/components/QuickStartPage.vue",
      ".vitepress/theme/components/ApiReferencePage.vue",
      ".vitepress/theme/components/ComparePage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/theme/components/DeployPage.vue"
    ].map(read).join("\n");

    expect(primarySurfaces).not.toContain("Unreleased May 2026");
    expect(primarySurfaces).not.toMatch(/\bv0\.2\.0\b/);
  });

  it("frames the compatibility route as examples instead of a marketplace directory", () => {
    const examplesSurfaces = [
      ".vitepress/theme/components/SkillsDirectoryPage.vue",
      ".vitepress/theme/components/SkillDetailPage.vue",
      ".vitepress/theme/components/AuthorProfilePage.vue",
      ".vitepress/theme/data/skills.ts",
      ".vitepress/shared/pageDocs.ts"
    ].map(read).join("\n");

    expect(examplesSurfaces).toContain("Vault inventory preview");
    expect(examplesSurfaces).toContain("not a live marketplace score");
    expect(examplesSurfaces).not.toMatch(/Skills directory|skills directory|Most installed|Total installs|Active vaults|Reference uses|CDN mirror|mirrored to CDN/);
    expect(examplesSurfaces).not.toMatch(/installs:|\.installs|SkillSort = "installs"|sort === "installs"/);
  });

  it("keeps deploy claims limited to verified v1 providers", () => {
    const deploy = read(".vitepress/theme/components/DeployPage.vue");
    const deployMarkdown = pageDocs.find((doc) => doc.key === "deploy")?.markdown ?? "";

    expect(deploy).toContain('name: "Railway"');
    expect(deploy).toContain('name: "Docker"');
    expect(deploy).toContain("RAILWAY_TEMPLATE_URL");
    expect(deployMarkdown).toContain(RAILWAY_TEMPLATE_URL);
    expect(deploy).toContain("MANUAL_GHCR_IMAGE");
    expect(deployMarkdown).toContain(MANUAL_GHCR_IMAGE);
    expect(deploy).toContain("Manual image deploy");
    expect(deploy).toContain("Min 12 chars");
    expect(deploy).not.toMatch(/\bRender\b|Fly\.io|officially-tested|24 chars|render\.yaml|fly\.toml|LiteFS/);
  });

  it("documents that AutoVault is not a credential vault", () => {
    const secretDocs = [
      ".vitepress/theme/components/AuthoringPage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/shared/pageDocs.ts"
    ].map(read).join("\n");

    expect(secretDocs).toContain("AutoVault is a skill vault, not a credential vault");
    expect(secretDocs).toContain("requires-secrets");
    expect(secretDocs).toContain("SSH agent");
    expect(secretDocs).toContain("Keychain");
    expect(secretDocs).toContain(".env");
    expect(secretDocs).toMatch(/Do not (?:put|bundle).*SSH private keys|Do not bundle \\.env files, SSH private keys/s);
  });

  it("keeps hidden hosted copy reservation-only", () => {
    const hostedCopy = [
      ".vitepress/theme/components/CloudPage.vue",
      ".vitepress/theme/components/HostedVaultFunnel.vue",
      ".vitepress/shared/pageDocs.ts"
    ].map(read).join("\n");

    expect(hostedCopy).toContain("Cloud sync is not enabled yet");
    expect(hostedCopy).toContain("Reserve a paid hosted AutoVault namespace");
    expect(hostedCopy).toContain("pending provisioning");
    expect(hostedCopy).toContain("Managed vault dashboard");
    expect(hostedCopy).toContain("coming soon");
    expect(hostedCopy).toContain("reserved");
    expect(hostedCopy).toContain("prototype mode");
    expect(hostedCopy).toContain("Simulate MCP ping");
    expect(hostedCopy).toContain("Simulate pending import");
    expect(hostedCopy).not.toMatch(/cloud sync is enabled|enabled cloud sync|sync now/i);
    expect(hostedCopy).not.toMatch(/live vault|provisioned runtime/i);
  });

  it("keeps homepage comparison credible and linked", () => {
    const homepageCopy = [
      ".vitepress/theme/components/AvComparison.vue",
      ".vitepress/theme/components/AvSpecHero.vue",
      ".vitepress/theme/components/AvProblems.vue",
      ".vitepress/theme/components/AvValidationGate.vue"
    ].map(read).join("\n");

    expect(homepageCopy).not.toMatch(/ClawdHub|TLC registry|credential stealers|shipping malware|11\.4%|820ms/);
    expect(comparisonPlayers.map((player) => player.name)).toEqual([
      "AutoVault",
      "Skillfish",
      "Tessl",
      "SkillKit / Agent Skills",
      "Manual"
    ]);
    expect(comparisonSources.map((source) => source.label)).toEqual([
      "Skill.Fish",
      "Tessl docs",
      "Agent Skills GitHub",
      "SkillKit",
      "ClawHub docs",
      "Cloudflare obfuscation docs"
    ]);
    expect(comparisonSources.every((source) => source.href.startsWith("https://"))).toBe(true);
    expect(homepageComparisonRows.some((row) => row[1] === "partial")).toBe(true);
    expect(homepageComparisonRows.every((row) => row.length === comparisonPlayers.length + 1)).toBe(true);
  });

  it("keeps homepage gate metrics labeled as fixtures", () => {
    expect(homepageGateMetrics.reject).toEqual({
      value: "~1 in 9",
      label: "held in the demo fixture"
    });
    expect(homepageGateMetrics.latency).toEqual({
      value: "<1s",
      label: "local validation fixture"
    });
  });

  it("keeps rendered social assets aligned with current positioning", () => {
    const socialSurfaces = [
      "scripts/social-assets/source/og-1200x630.html",
      "scripts/social-assets/source/twitter-1200x600.html",
      "scripts/social-assets/source/github-1280x640.html",
      "scripts/social-assets/source/square-1200x1200.html",
      "scripts/social-assets/manifest.json",
      "public/social-card.svg",
      ".vitepress/config.ts"
    ].map(read).join("\n");

    expect(socialSurfaces).toContain("Local-first skill vault");
    expect(socialSurfaces).toContain("/og-1200x630.png");
    expect(socialSurfaces).toContain("/twitter-1200x600.png");
    expect(socialSurfaces).not.toMatch(/The skill registry|registry with a gate|11\.4%|820ms|v1\.0|github:org\/skills\/extract-pdf/);

    for (const asset of [
      "og-1200x630.png",
      "twitter-1200x600.png",
      "github-1280x640.png",
      "square-1200x1200.png",
      "favicon-512.png",
      "apple-touch-icon.png",
      "favicon-32.png"
    ]) {
      expect(existsSync(resolve(repoRoot, "public", asset))).toBe(true);
    }
  });

  it("avoids Cloudflare email-obfuscation traps in visible demos", () => {
    const demoSurfaces = [
      ".vitepress/theme/components/AvSpecHero.vue",
      ".vitepress/theme/components/AvValidationGate.vue",
      ".vitepress/theme/components/AvFolderHero.vue",
      ".vitepress/theme/components/AvQuickStart.vue",
      ".vitepress/theme/components/QuickStartPage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/theme/components/ApiReferencePage.vue",
      ".vitepress/theme/components/AuthorProfilePage.vue",
      ".vitepress/theme/components/SkillDetailPage.vue"
    ].map(read).join("\n");

    expect(demoSurfaces).not.toMatch(/[A-Za-z0-9._%+/-]+@[0-9]+(?:\.[0-9]+)+/);
  });
});

function read(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}
