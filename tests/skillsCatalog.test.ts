import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import { skills } from "../.vitepress/theme/data/skills";
import { extractFrontmatter } from "../.vitepress/theme/utils/skillGate";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("skills catalog integrity", () => {
  it("only lists skills backed by hosted raw SKILL.md files", () => {
    const names = new Set<string>();
    const detailPaths = new Set<string>();

    for (const skill of skills) {
      expect(names.has(skill.name)).toBe(false);
      expect(detailPaths.has(skill.detailPath)).toBe(false);
      names.add(skill.name);
      detailPaths.add(skill.detailPath);

      expect(skill.detailPath).toBe(`/skill/${skill.name}`);
      expect(skill.rawPath).toBe(`/skills/${skill.name}/SKILL.md`);
      expect(skill.install).toContain(skill.rawPath);
      expect(skill.sourceUrl).toMatch(/^https:\/\//);
      expect(skill.sourceUrl).not.toContain("autoworks-ai/skills/");
      expect(skill.sourceKind).toMatch(/^(first-party|trusted-provider)$/);
      expect(skill.providerName.length).toBeGreaterThan(2);
      expect(skill.trustLabel.length).toBeGreaterThan(6);
      expect(skill.admissionStatus).toMatch(/^(hosted-example|provenance-example)$/);
      expect(skill.provenanceNote.length).toBeGreaterThan(20);

      const rawFile = resolve(repoRoot, "public", skill.rawPath.replace(/^\//, ""));
      expect(existsSync(rawFile), `${skill.name} rawPath does not exist`).toBe(true);
      const detailFile = resolve(repoRoot, `${skill.detailPath.replace(/^\//, "")}.md`);
      expect(existsSync(detailFile), `${skill.name} detailPath does not have a static page`).toBe(true);

      const source = readFileSync(rawFile, "utf8");
      const frontmatter = readFrontmatter(source);
      expect(frontmatter.name).toBe(skill.name);
      expect(frontmatter.description).toBeTypeOf("string");
      expect(skill.desc).toContain(String(frontmatter.description).slice(0, 18));
      expect(readVersion(frontmatter)).toBe(skill.v);
      expect(frontmatter.license).toBe(skill.license);
    }
  });

  it("includes provenance, transform, and secret-safe showcase variations", () => {
    expect(skills.map((skill) => skill.name)).toEqual(expect.arrayContaining([
      "trusted-skill-import",
      "multi-agent-transform",
      "secret-safe-setup"
    ]));

    const trusted = skills.find((skill) => skill.name === "trusted-skill-import");
    expect(trusted?.sourceKind).toBe("trusted-provider");
    expect(trusted?.providerName).toBe("Anthropic");
    expect(trusted?.admissionStatus).toBe("provenance-example");

    const transform = skills.find((skill) => skill.name === "multi-agent-transform");
    expect(transform?.provenanceNote).toContain("transform");
    expect(transform?.agents.length).toBeGreaterThanOrEqual(3);

    const secretSafe = skills.find((skill) => skill.name === "secret-safe-setup");
    expect(secretSafe?.provenanceNote).toContain("secret");
    expect(secretSafe?.permissions.some((row) => row.label === "secrets")).toBe(true);
  });

  it("makes the skill detail install CTA visibly copy the CLI command", () => {
    const detail = readFileSync(resolve(repoRoot, ".vitepress/theme/components/SkillDetailPage.vue"), "utf8");

    expect(detail).toContain("Copy add command");
    expect(detail).toContain('aria-live="polite"');
    expect(detail).toContain("copyText(currentSkill.value.install)");
    expect(detail).not.toContain("/api/vaults/current/pending-skills");
  });

  it("keeps fake historical example skills out of the public catalog", () => {
    const catalogText = [
      readFileSync(resolve(repoRoot, ".vitepress/theme/data/skills.ts"), "utf8"),
      readFileSync(resolve(repoRoot, ".vitepress/theme/components/SkillsDirectoryPage.vue"), "utf8"),
      readFileSync(resolve(repoRoot, ".vitepress/theme/components/SkillDetailPage.vue"), "utf8"),
      readFileSync(resolve(repoRoot, ".vitepress/theme/components/AuthorProfilePage.vue"), "utf8"),
      readFileSync(resolve(repoRoot, ".vitepress/theme/components/ApiReferencePage.vue"), "utf8"),
      readFileSync(resolve(repoRoot, ".vitepress/shared/pageDocs.ts"), "utf8")
    ].join("\n");

    expect(catalogText).not.toMatch(/extract-pdf|summarize-doc|github-issues|ocr-image|extract-table/);
  });
});

function readFrontmatter(source: string): Record<string, unknown> {
  const extracted = extractFrontmatter(source);
  expect(extracted.ok).toBe(true);
  if (!extracted.ok) return {};

  const document = parseDocument(extracted.frontmatter, { prettyErrors: false });
  expect(document.errors).toEqual([]);
  const parsed = document.toJS({ mapAsMap: false });
  expect(parsed && typeof parsed === "object" && !Array.isArray(parsed)).toBe(true);
  return parsed as Record<string, unknown>;
}

function readVersion(frontmatter: Record<string, unknown>): string {
  if (typeof frontmatter.version === "string" || typeof frontmatter.version === "number") {
    return String(frontmatter.version);
  }
  const metadata = frontmatter.metadata;
  if (metadata && typeof metadata === "object" && "version" in metadata) {
    return String((metadata as { version: unknown }).version);
  }
  return "";
}
