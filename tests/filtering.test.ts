import { describe, expect, it } from "vitest";
import { filterReleases, countReleaseFilters, releases } from "../.vitepress/theme/data/releases";
import { filterSkills, skills, sortSkills } from "../.vitepress/theme/data/skills";

describe("skill examples helpers", () => {
  it("filters by query, agent, category, and org", () => {
    const result = filterSkills(skills, {
      query: "preserves headings",
      agents: ["cx"],
      categories: ["files"],
      orgs: ["autoworks-ai"]
    });

    expect(result.map((skill) => skill.name)).toEqual(["extract-pdf"]);
  });

  it("sorts reference counts without mutating the original input", () => {
    const input = skills.slice(0, 4);
    const sorted = sortSkills(input, "references");

    expect(sorted[0].references).toBeGreaterThanOrEqual(sorted[1].references);
    expect(input.map((skill) => skill.name)).toEqual(skills.slice(0, 4).map((skill) => skill.name));
  });

  it("sorts recent versions numerically", () => {
    const sorted = sortSkills([
      { ...skills[0], name: "older", v: "1.9.0" },
      { ...skills[0], name: "newer", v: "1.10.0" }
    ], "recent");

    expect(sorted[0].name).toBe("newer");
  });
});

describe("changelog helpers", () => {
  it("counts release filter buckets", () => {
    const counts = countReleaseFilters(releases);

    expect(counts.all).toBe(releases.length);
    expect(counts.security).toBeGreaterThan(0);
    expect(counts.patch).toBe(0);
  });

  it("filters releases by security section and query", () => {
    const result = filterReleases(releases, "security", "OAuth");

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe("Unreleased");
  });

  it("returns preview releases only when requested", () => {
    const result = filterReleases(releases, "preview");

    expect(result.every((release) => release.tag === "preview")).toBe(true);
  });
});
