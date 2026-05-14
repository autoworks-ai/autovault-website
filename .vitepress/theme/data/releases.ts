export type ReleaseKind = "major" | "minor" | "patch" | "security" | "preview";
export type ReleaseSectionKind = "added" | "changed" | "fixed" | "removed" | "security";

export interface ReleaseSection {
  kind: ReleaseSectionKind;
  items: string[];
}

export interface Release {
  version: string;
  date: string;
  ago: string;
  type: "minor" | "patch";
  tag: ReleaseKind;
  codename?: string | null;
  featured?: boolean;
  title: string;
  summary: string;
  sections: ReleaseSection[];
  commit: string;
  author: string;
  contributors: number;
}

export const releases: Release[] = [
  {
    version: "Unreleased",
    date: "May 2026",
    ago: "in progress",
    type: "minor",
    tag: "preview",
    codename: "Bootstrap",
    featured: true,
    title: "Bundled skills, local installers, and remote polish",
    summary: "The current source branch documents the post-0.2 work: bundled skills, bootstrap installs, add-local, vendor installer routing, remote Streamable HTTP MCP with OAuth, resource reads, transforms, and drift checks.",
    sections: [
      { kind: "added", items: ["Bundled skills: autovault-skill, commit-message, and skill-author", "scripts/bootstrap-skills.mjs seeds bundled skills through the real install_skill validation path", "autovault add-local installs local skill bundles from third-party installers with local provenance", "autovault remove deletes vaulted skills, vault-local transforms, and AutoVault-managed profile symlinks with default native profile discovery", "AUTOVAULT_SKILL_INSTALL controls AutoVault-first, native-first, both, native-only, and off routing", "Remote Streamable HTTP MCP at /mcp with OAuth discovery, login, token issuance, and role-aware skill visibility"] },
      { kind: "changed", items: ["Profile sync materializes transform overlays into rendered per-agent directories before linking native roots", "README and INSTALL now document Claude Code, Cursor, Codex, Docker, Railway, and remote MCP setup"] },
      { kind: "security", items: ["Expanded capability-declaration cross-checks and denylist coverage; Ed25519 sidecars are written for installed skills"] }
    ],
    commit: "main",
    author: "jack",
    contributors: 4
  },
  {
    version: "0.2.0",
    date: "Apr 19, 2026",
    ago: "2 weeks ago",
    type: "minor",
    tag: "minor",
    title: "Focused TypeScript MCP server",
    summary: "First implementation release of the local stdio MCP server, filesystem skill storage, source adapters, validation, provenance sidecars, resource reads, and update checks.",
    sections: [
      { kind: "added", items: ["MCP tools for list_skills, search_skills, get_skill, propose_skill, install_skill, read_skill_resource, and check_updates", "Filesystem-backed skill storage with .autovault-source.json provenance sidecars", "GitHub, agentskills, and HTTPS source adapters", "Validation pipeline with frontmatter repair, schema checks, denylist scanning, and duplicate detection"] },
      { kind: "changed", items: ["Replaced the previous skill-manager / skill-importer scaffold with a focused TypeScript MCP server", "Standardized on a stdio-first local deployment story"] },
      { kind: "security", items: ["Tool boundaries validate skill names to block traversal attempts", "propose_skill pre-validates resource paths before writes", "Invalid config values fail fast at startup"] }
    ],
    commit: "0.2.0",
    author: "jack",
    contributors: 4
  },
  {
    version: "0.1.0",
    date: "early 2026",
    ago: "prototype",
    type: "minor",
    tag: "preview",
    title: "Initial vault prototype",
    summary: "Initial local vault prototype, profile-rendering experiment, and compatibility planning around the SKILL.md format.",
    sections: [
      { kind: "added", items: ["Canonical skill storage", "Profile render directories", "First bridge skill experiment"] }
    ],
    commit: "09ac21d",
    author: "jack",
    contributors: 2
  }
];

export const releaseFilters = [
  { id: "all", label: "All", match: () => true },
  { id: "minor", label: "Minor", match: (release: Release) => release.tag === "minor" },
  { id: "patch", label: "Patch", match: (release: Release) => release.tag === "patch" },
  { id: "security", label: "Security", match: (release: Release) => release.sections.some((section) => section.kind === "security") },
  { id: "preview", label: "Preview", match: (release: Release) => release.tag === "preview" }
] as const;

export type ReleaseFilter = (typeof releaseFilters)[number]["id"];

export function filterReleases(input: Release[], filter: ReleaseFilter, query = ""): Release[] {
  const filterConfig = releaseFilters.find((item) => item.id === filter) ?? releaseFilters[0];
  const q = query.trim().toLowerCase();
  return input.filter((release) => {
    const matchesFilter = filterConfig.match(release);
    const searchable = [release.version, release.title, release.summary, release.codename ?? "", ...release.sections.flatMap((section) => section.items)].join(" ").toLowerCase();
    return matchesFilter && (!q || searchable.includes(q));
  });
}

export function countReleaseFilters(input: Release[]): Record<ReleaseFilter, number> {
  return releaseFilters.reduce((counts, filter) => {
    counts[filter.id] = input.filter(filter.match).length;
    return counts;
  }, {} as Record<ReleaseFilter, number>);
}
