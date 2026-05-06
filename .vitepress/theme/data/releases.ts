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
    version: "0.4.1",
    date: "May 2, 2026",
    ago: "4 days ago",
    type: "patch",
    tag: "patch",
    codename: "Hempseed",
    title: "Source adapter timeout fix · denylist refresh",
    summary: "Quick patch following last week's 0.4 release. Fixes a hang in the GitHub source adapter when fetching skills from rate-limited orgs, and ships an updated denylist with three new exfiltration patterns reported by community researchers.",
    sections: [
      { kind: "fixed", items: ["GitHub source adapter could hang for 30s on rate-limited fetches; now fails fast with a clear retry message (#412)", "Drift check on shell startup occasionally double-counted symlinked profiles on macOS", "Permissions fs_scope with relative paths now resolves against the calling agent's CWD, not the vault"] },
      { kind: "security", items: ["Denylist update: three new exfil patterns matching data:text/plain;base64 abuse paths reported by @elvissun"] }
    ],
    commit: "a3f9e21",
    author: "jack",
    contributors: 3
  },
  {
    version: "0.4.0",
    date: "Apr 28, 2026",
    ago: "1 week ago",
    type: "minor",
    tag: "minor",
    codename: "Front Door",
    featured: true,
    title: "Per-caller transformation manifest · MCP-native tool surface",
    summary: "The headline release. Skills now declare a transformation manifest in their frontmatter, and AutoVault renders a per-caller view at delivery time. Same skill, three rendered views; written once, no forks.",
    sections: [
      { kind: "added", items: ["Transformation manifest in skill frontmatter maps canonical capability names to per-agent tool names", "Native MCP tools: list_skills, search_skills, get_skill, read_skill_resource, install_skill, propose_skill, check_updates", "Progressive disclosure returns metadata first, full body on demand, reducing cold-start token load", "Bridge skill autovault-skill for non-MCP agents"] },
      { kind: "changed", items: ["Skill resolution caches rendered views per caller; first hit around 4ms, subsequent hits under 1ms", "CLI flag --agent now accepts comma-separated lists for multi-agent scoping"] },
      { kind: "removed", items: ["Deprecated autovault sync alias removed; use autovault refresh"] }
    ],
    commit: "f4e2c81",
    author: "jack",
    contributors: 7
  },
  {
    version: "0.3.2",
    date: "Apr 14, 2026",
    ago: "3 weeks ago",
    type: "patch",
    tag: "patch",
    title: "Dedup tuning · CI runner mode",
    summary: "Tuned the V1 text-similarity dedup threshold based on private beta data: too aggressive on near-paraphrases, too lenient on actual duplicates.",
    sections: [
      { kind: "added", items: ["autovault --runner-mode for ephemeral CI environments"] },
      { kind: "fixed", items: ["Dedup threshold tuned: 94% true-positive, 0.8% false-positive", "Sign step occasionally produced non-canonical YAML output for deeply nested transformations"] }
    ],
    commit: "b7d1a04",
    author: "jack",
    contributors: 2
  },
  {
    version: "0.3.0",
    date: "Apr 1, 2026",
    ago: "5 weeks ago",
    type: "minor",
    tag: "minor",
    codename: "Quartermaster",
    title: "Four-axis permission scoping · cloud mode preview",
    summary: "Every skill request now carries a four-axis context: agent, device, project, tool/user. The vault filters per-caller and opens the private preview of cloud-mode self-host.",
    sections: [
      { kind: "added", items: ["Four-axis permission scoping", "Private preview of cloud-mode self-host", "Project-scoped profile generation"] },
      { kind: "changed", items: ["Profile dirs are now generated from canonical vault state rather than copied skill files"] }
    ],
    commit: "8f41bc2",
    author: "jack",
    contributors: 5
  },
  {
    version: "0.2.0",
    date: "Mar 12, 2026",
    ago: "8 weeks ago",
    type: "minor",
    tag: "preview",
    title: "Validation gate private beta",
    summary: "First private beta of the gate: YAML auto-repair, security denylist, capability/behavior checks, dedup, and Ed25519 signing.",
    sections: [
      { kind: "added", items: ["Five-stage validation pipeline", "Signed vault artifact format", "GitHub and local path source adapters"] }
    ],
    commit: "3d0c8a9",
    author: "jack",
    contributors: 4
  },
  {
    version: "0.1.0",
    date: "Feb 18, 2026",
    ago: "11 weeks ago",
    type: "minor",
    tag: "preview",
    title: "Initial vault prototype",
    summary: "Initial local vault prototype and profile-rendering experiment.",
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
