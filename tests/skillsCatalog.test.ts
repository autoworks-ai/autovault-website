import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import { categories, skills } from "../.vitepress/theme/data/skills";
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
      expect(skill.install).toContain(skill.rawPath.replace(/^\//, ""));
      expect(skill.install).toContain("add_skill({");
      expect(skill.install).not.toContain("add-local");
      if (skill.cliInstall) {
        expect(skill.cliInstall, `${skill.name} CLI install should use canonical add`).toMatch(/^autovault add \S+/);
        expect(skill.cliInstall, `${skill.name} CLI install must not use compatibility alias`).not.toContain("add-local");
      }
      if (skill.install.includes('source: "github"')) {
        expect(skill.install, `${skill.name} should use compact GitHub identifiers`).not.toContain("https://github.com/");
        const pinnedRef = skill.install.match(/@[0-9a-f]{40}:/)?.[0]?.slice(1, -1);
        expect(pinnedRef, `${skill.name} should pin GitHub source refs`).toBeTruthy();
        expect(skill.sourceUrl, `${skill.name} sourceUrl should match the pinned install ref`).toContain(`/blob/${pinnedRef}/`);
        expect(skill.cliInstall, `${skill.name} github skill should expose a canonical CLI add command`).toMatch(/^autovault add \S+ --sync-profiles$/);
      }
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

      const bin = frontmatter.bin;
      if (bin && typeof bin === "object" && !Array.isArray(bin)) {
        expect(skill.install, `${skill.name} has bin resources, so raw URL install is incomplete`).toContain('source: "github"');
        for (const action of Object.values(bin as Record<string, unknown>)) {
          if (!action || typeof action !== "object") continue;
          const command = (action as { command?: unknown }).command;
          if (typeof command === "string") {
            expect(existsSync(resolve(dirname(rawFile), command)), `${skill.name} missing bin command ${command}`).toBe(true);
          }
        }
      }

      const resources = frontmatter.resources;
      if (Array.isArray(resources)) {
        expect(Array.isArray(skill.resources), `${skill.name} declares resources but has no catalog resource metadata`).toBe(true);
        const catalogResources = new Set((skill.resources ?? []).map((resource) => resource.path));
        for (const resource of resources) {
          expect(resource && typeof resource === "object", `${skill.name} has invalid resource entry`).toBe(true);
          const path = (resource as { path?: unknown }).path;
          const type = (resource as { type?: unknown }).type;
          expect(type, `${skill.name} resource ${String(path)} should be a file`).toBe("file");
          expect(typeof path, `${skill.name} resource path should be a string`).toBe("string");
          expect(existsSync(resolve(dirname(rawFile), path as string)), `${skill.name} missing resource ${String(path)}`).toBe(true);
          expect(catalogResources.has(path as string), `${skill.name} resource ${String(path)} is missing from catalog metadata`).toBe(true);
        }

        for (const resource of skill.resources ?? []) {
          expect(resource.path.length, `${skill.name} resource path should be populated`).toBeGreaterThan(0);
          expect(resource.title.length, `${skill.name} resource ${resource.path} title should be populated`).toBeGreaterThan(0);
          expect(resource.summary.length, `${skill.name} resource ${resource.path} summary should be populated`).toBeGreaterThan(12);
          expect(resource.group.length, `${skill.name} resource ${resource.path} group should be populated`).toBeGreaterThan(0);
          expect(resource.kind).toMatch(/^(markdown|svg|css|ascii|yaml|script|file)$/);
        }
      }
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

  it("includes the AutoVault brand-system showcase skill with bundled assets", () => {
    expect(categories.map((category) => category.id)).toContain("brand");
    expect(skills.map((skill) => skill.name)).toContain("autovault-brand-system");

    const brand = skills.find((skill) => skill.name === "autovault-brand-system");
    expect(brand?.category).toBe("brand");
    expect(brand?.sourceKind).toBe("first-party");
    expect(brand?.admissionStatus).toBe("hosted-example");
    expect(brand?.permissions.some((row) => row.label === "resources")).toBe(true);
    expect(brand?.install).toBe('add_skill({ source: "url", identifier: "https://autovault.dev/skills/autovault-brand-system/SKILL.md" })');
    expect(brand?.cliInstall).toBe("autovault add https://autovault.dev/skills/autovault-brand-system/SKILL.md --source url --sync-profiles");

    const rawFile = resolve(repoRoot, "public", "skills", "autovault-brand-system", "SKILL.md");
    const frontmatter = readFrontmatter(readFileSync(rawFile, "utf8"));
    const resources = Array.isArray(frontmatter.resources) ? frontmatter.resources : [];
    expect(resources.map((entry) => (entry as { path?: string }).path)).toEqual(expect.arrayContaining([
      "agents/openai.yaml",
      "references/identity.md",
      "references/motion.md",
      "references/surface-adaptation.md",
      "assets/brand-mark.svg",
      "assets/brand-mark-animated.svg",
      "assets/autovault-brand.css",
      "assets/ascii-vault.txt",
      "assets/mascot-prompt.md",
      "assets/usage-examples.md"
    ]));
  });

  it("shows copyable CLI and MCP install command rows", () => {
    const detail = readFileSync(resolve(repoRoot, ".vitepress/theme/components/SkillDetailPage.vue"), "utf8");

    expect(detail).toContain("installRows");
    expect(detail).toContain('label: "CLI"');
    expect(detail).toContain('label: "MCP"');
    expect(detail).toContain("Copy CLI install command");
    expect(detail).toContain("Copy MCP install command");
    expect(detail).toContain('installRows.length > 1 ? "CLI + MCP" : "MCP"');
    expect(detail).toContain('aria-live="polite"');
    expect(detail).toContain("copyInstall(row.command, row.mode)");
    expect(detail).not.toContain("installMode = ref");
    expect(detail).not.toContain("autovault add-local");
    expect(detail).not.toContain("/api/vaults/current/pending-skills");
  });

  it("keeps static skill detail pages aligned with curated catalog entries", () => {
    const staticPages = readdirSync(resolve(repoRoot, "skill"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(/\.md$/, ""))
      .sort();
    const catalogPages = skills.map((skill) => skill.name).sort();

    expect(staticPages).toEqual(catalogPages);
  });

  it("keeps hosted skill asset headers scoped by extension", () => {
    const headers = readFileSync(resolve(repoRoot, "public", "_headers"), "utf8");

    expect(headers).not.toMatch(/^\/skills\/\*\s*$/m);
    expect(headers).toContain("/skills/*.md");
    expect(headers).toContain("Content-Type: text/markdown; charset=utf-8");
    expect(headers).toContain("/skills/*.svg");
    expect(headers).toContain("Content-Type: image/svg+xml; charset=utf-8");
  });

  it("renders bundled skill resources as an inspectable bundle", () => {
    const detail = readFileSync(resolve(repoRoot, ".vitepress/theme/components/SkillDetailPage.vue"), "utf8");

    expect(detail).toContain("Hosted skill bundle");
    expect(detail).toContain("Bundle files");
    expect(detail).toContain("Bundle");
    expect(detail).toContain("bundleGroups");
    expect(detail).toContain("resourcePreview");
    expect(detail).toContain("resourceHref(resource)");
    expect(detail).toContain("sd-asset-strip");
    expect(detail).toContain("sd-resource-tree");
    expect(detail).toContain("sd-resource-preview");
  });

  it("keeps bundled resource kind labels readable", () => {
    const styles = readFileSync(resolve(repoRoot, ".vitepress/theme/styles.css"), "utf8");

    expect(styles).toContain("grid-template-columns: minmax(76px, auto) minmax(0, 1fr) auto;");
    expect(styles).toContain("grid-template-columns: minmax(76px, auto) minmax(0, 1fr);");
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
