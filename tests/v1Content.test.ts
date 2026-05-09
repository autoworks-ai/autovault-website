import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRODUCT_STATUS, PRODUCT_VERSION, PRODUCT_VERSION_BADGE, PRODUCT_VERSION_SHORT } from "../.vitepress/theme/data/product";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("v1 content guardrails", () => {
  it("keeps primary product version copy centralized", () => {
    expect(PRODUCT_VERSION).toBe(`v${PRODUCT_VERSION_SHORT}`);
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

    expect(deploy).toContain('name: "Railway"');
    expect(deploy).toContain('name: "Docker"');
    expect(deploy).toContain("Min 12 chars");
    expect(deploy).not.toMatch(/\bRender\b|Fly\.io|officially-tested|24 chars|render\.yaml|fly\.toml|LiteFS/);
  });

  it("keeps hidden hosted copy reservation-only", () => {
    const hostedCopy = [
      ".vitepress/theme/components/CloudPage.vue",
      ".vitepress/theme/components/HostedVaultFunnel.vue",
      ".vitepress/shared/pageDocs.ts"
    ].map(read).join("\n");

    expect(hostedCopy).toContain("Cloud sync is not enabled yet");
    expect(hostedCopy).toContain("Reserve a paid hosted AutoVault namespace");
    expect(hostedCopy).not.toMatch(/cloud sync is enabled|enabled cloud sync|sync now/i);
  });
});

function read(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}
