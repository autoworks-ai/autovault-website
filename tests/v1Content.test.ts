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
    expect(PRODUCT_VERSION).toBe("v0.3.0");
    expect(PRODUCT_STATUS).toBe("pre-1.0");
    expect(PRODUCT_VERSION_BADGE).toContain(PRODUCT_VERSION);
    expect(PRODUCT_VERSION_BADGE).not.toContain("Unreleased May 2026");
    expect(pageDocs.find((doc) => doc.key === "changelog")?.markdown).toContain("## v0.3.0");
    expect(pageDocs.find((doc) => doc.key === "changelog")?.markdown).not.toContain("## Unreleased");

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
    const [authoring, security, docsMarkdown] = [
      ".vitepress/theme/components/AuthoringPage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/shared/pageDocs.ts"
    ].map((path) => read(path));

    expect(authoring).toContain("AutoVault is a skill vault, not a credential vault");
    expect(authoring).toContain("requires-secrets");
    expect(authoring).toContain("SSH agent");
    expect(authoring).toContain("Keychain");
    expect(authoring).toContain("Do not bundle <code>.env</code> files, SSH private keys, access tokens, or copied dashboard secrets.");
    expect(security).toContain("A <code>.env</code> file or private key inside a skill bundle is content, not protected secret storage.");
    expect(docsMarkdown).toContain("Do not bundle .env files, SSH private keys, API tokens, or copied dashboard secrets");
  });

  it("keeps current API, storage, and remote-mode docs aligned to v0 surfaces", () => {
    const api = read(".vitepress/theme/components/ApiReferencePage.vue");
    const quickStart = read(".vitepress/theme/components/QuickStartPage.vue");
    const deploy = read(".vitepress/theme/components/DeployPage.vue");
    const authoring = read(".vitepress/theme/components/AuthoringPage.vue");
    const apiCurrentSurface = [
      sliceBetween(api, "<section class=\"api-hero", "</section>"),
      sliceBetween(api, "const nav: NavItem[] = [", "function endpoint")
    ].join("\n");
    const vaultAnatomy = sliceBetween(quickStart, "<h2 id=\"vault-anatomy\">", "const ACCESS_ROWS");
    const remoteModeCopy = sliceBetween(deploy, "<section id=\"hosts\"", "const providers");
    const authoringSchemaIntro = sliceBetween(authoring, "<h2 id=\"schema\">", "<div class=\"schema final-schema\"");
    const apiMarkdown = pageDocs.find((doc) => doc.key === "api")?.markdown ?? "";
    const deployMarkdown = pageDocs.find((doc) => doc.key === "deploy")?.markdown ?? "";

    expect(apiCurrentSurface).toContain("Current v0.3.0 surfaces");
    expect(apiCurrentSurface).toContain("MCP tools are the agent-facing API");
    expect(apiCurrentSurface).toContain("autovault add-local");
    expect(apiCurrentSurface).not.toMatch(/@autovault\/sdk|\/api\/v1|autovault init|MCP 2024-11-05/);
    expect(api).not.toContain('v-html="line"');
    expect(api).toContain("line.text");
    expect(api).toContain("autovault add-local <skill-dir> --source <repo-or-url>");
    expect(api).toContain("autovault add-local ./skills/skill-author --source vendor/skills");
    expect(api).not.toContain("autovault add-local ./my-skill/SKILL.md");
    expect(apiMarkdown).toContain("autovault add-local ./skills/skill-author --source vendor/skills");
    expect(apiMarkdown).not.toContain("autovault add-local ./my-skill/SKILL.md");

    expect(vaultAnatomy).toContain("current implementation layout");
    expect(vaultAnatomy).toContain(".signing-key.json");
    expect(vaultAnatomy).toContain(".autovault-source.json");
    expect(vaultAnatomy).toContain(".autovault-manifest");
    expect(vaultAnatomy).not.toMatch(/keys\/|ed25519\.priv|manifest\.json|SKILL\.md\.sig/);

    expect(remoteModeCopy).toContain("Remote mode cannot create symlinks on client machines");
    expect(remoteModeCopy).toContain("Remote clients should discover and read skills through <code>get_skill</code>");
    expect(remoteModeCopy).not.toContain("install signed skills without ever touching a local filesystem");

    expect(authoringSchemaIntro).toContain("Open Agent Skills fields");
    expect(authoringSchemaIntro).toContain("AutoVault extensions");
    expect(authoringSchemaIntro).toContain("<code>name</code> and <code>description</code> remain the portable core");
    expect(deployMarkdown).toContain("Remote mode cannot create symlinks on client machines");
    expect(apiMarkdown).toContain("Current v0.3.0 surfaces");
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
      "SkillClone",
      "ClawHub docs",
      "Cloudflare obfuscation docs"
    ]);
    expect(comparisonSources.every((source) => source.href.startsWith("https://"))).toBe(true);
    expect(homepageComparisonRows.some((row) => row[1] === "partial")).toBe(true);
    expect(homepageComparisonRows.every((row) => row.length === comparisonPlayers.length + 1)).toBe(true);
  });

  it("keeps compare-page positioning focused on no-fork transforms and admission-time dedup", () => {
    const compare = read(".vitepress/theme/components/ComparePage.vue");

    expect(compare).toContain("transforms instead of forks");
    expect(compare).toContain("workspace-local deltas");
    // Admission-time dedup positioning — exact copy may evolve, key tokens must stay
    expect(compare).toMatch(/Admission-time dedup stops a duplicate from becoming local infrastructure/);
    expect(compare).toContain("SkillClone");
    expect(compare).toContain("https://arxiv.org/abs/2603.22447");
    // SkillClone metrics — values matter, surrounding prose may change
    expect(compare).toMatch(/75%/);
    expect(compare).toMatch(/3\.5x/);
    expect(compare).toMatch(/5,642/);
    expect(compare).toMatch(/41%/);
  });

  it("keeps compare discoverable in top navigation, search, and markdown export", () => {
    const topbar = read(".vitepress/theme/components/AvTopbar.vue");
    const searchResultsSource = read(".vitepress/theme/data/searchResults.ts");
    const pageDocsSource = read(".vitepress/shared/pageDocs.ts");
    const compareMarkdown = pageDocs.find((doc) => doc.key === "compare")?.markdown ?? "";

    expect(topbar).toContain('{ label: "Compare", href: "/compare" }');
    expect(searchResultsSource).toContain("transforms instead of forks");
    expect(searchResultsSource).toContain("skillclone");
    expect(compareMarkdown).toContain("transforms instead of forks");
    expect(compareMarkdown).toContain("workspace-local deltas");
    expect(compareMarkdown).toContain("Admission-time dedup");
    expect(compareMarkdown).toContain("https://arxiv.org/abs/2603.22447");
    expect(pageDocsSource).toContain("SkillClone");
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

function sliceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0) {
    throw new Error(`Missing slice start marker: ${start}`);
  }

  if (endIndex <= startIndex) {
    throw new Error(`Missing slice end marker after "${start}": ${end}`);
  }

  return source.slice(startIndex, endIndex);
}
