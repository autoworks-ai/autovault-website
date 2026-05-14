export type ReleaseKind = "major" | "minor" | "patch" | "security" | "preview";
export type ReleaseSectionKind =
  | "added"
  | "changed"
  | "fixed"
  | "removed"
  | "security";

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
    version: "0.3.0",
    date: "May 14, 2026",
    ago: "current",
    type: "minor",
    tag: "minor",
    codename: "Cleanup",
    featured: true,
    title: "Remove cleanup, profile filters, and installer polish",
    summary:
      "The current source release adds vaulted skill removal, doctor repair, tag-filtered profiles, migration hardening, and smoother setup/serve UX.",
    sections: [
      {
        kind: "added",
        items: [
          "autovault remove deletes vaulted skills, vault-local transforms, and AutoVault-managed profile symlinks with default native profile discovery",
          "autovault doctor --repair can re-sign unsigned local skills while refusing tampered metadata and remote sources",
          "Tag-filtered project profiles can narrow generated profile symlinks by local policy",
        ],
      },
      {
        kind: "fixed",
        items: [
          "Installer TTY, Node version, and setup wizard friction are smoothed for agent-mediated installs",
          "Onboarding setup and remote serve messaging now distinguish local setup from shared MCP deployment",
        ],
      },
      {
        kind: "security",
        items: [
          "v1 migration imports are hardened and signature warnings are deduped for clearer operator review",
        ],
      },
    ],
    commit: "v0.3.0",
    author: "jack",
    contributors: 4,
  },
  {
    version: "0.2.0",
    date: "Apr 19, 2026",
    ago: "2 weeks ago",
    type: "minor",
    tag: "minor",
    title: "Focused TypeScript MCP server",
    summary:
      "First implementation release of the local stdio MCP server, filesystem skill storage, source adapters, validation, provenance sidecars, resource reads, and update checks.",
    sections: [
      {
        kind: "added",
        items: [
          "MCP tools for list_skills, search_skills, get_skill, propose_skill, install_skill, read_skill_resource, and check_updates",
          "Filesystem-backed skill storage with .autovault-source.json provenance sidecars",
          "GitHub, agentskills, and HTTPS source adapters",
          "Validation pipeline with frontmatter repair, schema checks, denylist scanning, and duplicate detection",
        ],
      },
      {
        kind: "changed",
        items: [
          "Replaced the previous skill-manager / skill-importer scaffold with a focused TypeScript MCP server",
          "Standardized on a stdio-first local deployment story",
        ],
      },
      {
        kind: "security",
        items: [
          "Tool boundaries validate skill names to block traversal attempts",
          "propose_skill pre-validates resource paths before writes",
          "Invalid config values fail fast at startup",
        ],
      },
    ],
    commit: "0.2.0",
    author: "jack",
    contributors: 4,
  },
  {
    version: "0.1.0",
    date: "early 2026",
    ago: "prototype",
    type: "minor",
    tag: "preview",
    title: "Initial vault prototype",
    summary:
      "Initial local vault prototype, profile-rendering experiment, and compatibility planning around the SKILL.md format.",
    sections: [
      {
        kind: "added",
        items: [
          "Canonical skill storage",
          "Profile render directories",
          "First bridge skill experiment",
        ],
      },
    ],
    commit: "09ac21d",
    author: "jack",
    contributors: 2,
  },
];

export const releaseFilters = [
  { id: "all", label: "All", match: () => true },
  {
    id: "minor",
    label: "Minor",
    match: (release: Release) => release.tag === "minor",
  },
  {
    id: "patch",
    label: "Patch",
    match: (release: Release) => release.tag === "patch",
  },
  {
    id: "security",
    label: "Security",
    match: (release: Release) =>
      release.sections.some((section) => section.kind === "security"),
  },
  {
    id: "preview",
    label: "Preview",
    match: (release: Release) => release.tag === "preview",
  },
] as const;

export type ReleaseFilter = (typeof releaseFilters)[number]["id"];

export function filterReleases(
  input: Release[],
  filter: ReleaseFilter,
  query = "",
): Release[] {
  const filterConfig =
    releaseFilters.find((item) => item.id === filter) ?? releaseFilters[0];
  const q = query.trim().toLowerCase();
  return input.filter((release) => {
    const matchesFilter = filterConfig.match(release);
    const searchable = [
      release.version,
      release.title,
      release.summary,
      release.codename ?? "",
      ...release.sections.flatMap((section) => section.items),
    ]
      .join(" ")
      .toLowerCase();
    return matchesFilter && (!q || searchable.includes(q));
  });
}

export function countReleaseFilters(
  input: Release[],
): Record<ReleaseFilter, number> {
  return releaseFilters.reduce(
    (counts, filter) => {
      counts[filter.id] = input.filter(filter.match).length;
      return counts;
    },
    {} as Record<ReleaseFilter, number>,
  );
}
