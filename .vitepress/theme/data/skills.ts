export type AgentId = "cc" | "cx" | "aj";
export type SkillCategory = "setup" | "authoring" | "meta";

export interface Skill {
  name: string;
  org: string;
  icon: string;
  category: SkillCategory;
  agents: AgentId[];
  desc: string;
  v: string;
  references: number;
  license: string;
  size: string;
  install: string;
  detailPath: string;
  rawPath: string;
  sourceUrl: string;
  sourceLabel: string;
  frontmatter: string[];
  overview: string[];
  useCases: string[];
  permissions: Array<{ label: string; scope: string; kind: "ok" | "no" | "warn" }>;
  related: string[];
  featured?: boolean;
}

export const agents = [
  { id: "cc" as const, label: "Claude Code", color: "#d6a85a" },
  { id: "cx" as const, label: "Codex", color: "#5a9dd6" },
  { id: "aj" as const, label: "AutoJack", color: "#5ad6c0" }
];

export const categories = [
  { id: "setup" as const, label: "Setup" },
  { id: "authoring" as const, label: "Authoring" },
  { id: "meta" as const, label: "Meta" }
];

export const orgs = [
  { id: "autoworks-ai", label: "autoworks-ai" },
  { id: "autovault.dev", label: "autovault.dev" }
];

export const skills: Skill[] = [
  {
    name: "autovault-bootstrap",
    org: "autovault.dev",
    icon: "AB",
    category: "setup",
    agents: ["cc", "cx"],
    desc: "Audit, install, verify, and sync AutoVault for the current agent profile.",
    v: "0.1.0",
    references: 6,
    license: "MIT",
    size: "3,078 B",
    install: "autovault add url:https://autovault.dev/skills/autovault-bootstrap/SKILL.md",
    detailPath: "/skill/autovault-bootstrap",
    rawPath: "/skills/autovault-bootstrap/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault-website/blob/main/public/skills/autovault-bootstrap/SKILL.md",
    sourceLabel: "public/skills/autovault-bootstrap/SKILL.md",
    frontmatter: [
      "name: autovault-bootstrap",
      "version: 0.1.0",
      "description: Audit, install, verify, and sync AutoVault for the current agent profile.",
      "tools_required: http.fetch, shell.run, fs.read, fs.write",
      "permissions.network: true",
      "agents: claude-code, codex"
    ],
    overview: [
      "Stages the AutoVault installer into a temporary file for inspection before execution.",
      "Runs doctor and profile sync after explicit approval, then reports the working local state."
    ],
    useCases: [
      "A user asks an agent to install or repair AutoVault.",
      "The current agent profile needs its own audited bootstrap path.",
      "You need to verify that AutoVault and profile sync are healthy."
    ],
    permissions: [
      { kind: "ok", label: "network", scope: "allowlisted AutoVault installer URLs" },
      { kind: "ok", label: "filesystem", scope: "$TMPDIR, ~/.autovault, current agent skill path" },
      { kind: "warn", label: "shell", scope: "installer execution requires explicit approval" }
    ],
    related: ["autovault-skill", "skill-author"],
    featured: true
  },
  {
    name: "skill-author",
    org: "autoworks-ai",
    icon: "SA",
    category: "authoring",
    agents: ["cc", "cx", "aj"],
    desc: "Author a well-formed SKILL.md with valid AutoVault frontmatter, descriptions, and capability declarations.",
    v: "1.0.0",
    references: 5,
    license: "MIT",
    size: "9,406 B",
    install: "autovault add url:https://autovault.dev/skills/skill-author/SKILL.md",
    detailPath: "/skill/skill-author",
    rawPath: "/skills/skill-author/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault/blob/main/skills/skill-author/SKILL.md",
    sourceLabel: "autoworks-ai/autovault/skills/skill-author/SKILL.md",
    frontmatter: [
      "name: skill-author",
      "version: 1.0.0",
      "description: Author a well-formed SKILL.md with valid AutoVault frontmatter.",
      "category: meta",
      "capabilities.filesystem: readwrite",
      "tools: Read, Edit, Write"
    ],
    overview: [
      "Guides an author through creating a SKILL.md that passes AutoVault validation on the first submission.",
      "Covers required and recommended frontmatter, capability declarations, bin actions, OAuth setup UX, and pre-submission checks."
    ],
    useCases: [
      "The user wants to create a new skill from scratch.",
      "An existing workflow should become a reusable SKILL.md.",
      "An agent is preparing content for propose_skill."
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none" },
      { kind: "ok", label: "filesystem", scope: "read/write for skill drafting" },
      { kind: "ok", label: "tools", scope: "Read, Edit, Write" }
    ],
    related: ["autovault-skill", "autovault-bootstrap"],
    featured: true
  },
  {
    name: "autovault-skill",
    org: "autoworks-ai",
    icon: "AV",
    category: "meta",
    agents: ["cc", "cx", "aj"],
    desc: "Understand AutoVault-managed skills and when synced filesystem skills can be used without an MCP server.",
    v: "1.0.0",
    references: 4,
    license: "MIT",
    size: "6,709 B",
    install: "autovault add url:https://autovault.dev/skills/autovault-skill/SKILL.md",
    detailPath: "/skill/autovault-skill",
    rawPath: "/skills/autovault-skill/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault/blob/main/skills/autovault-skill/SKILL.md",
    sourceLabel: "autoworks-ai/autovault/skills/autovault-skill/SKILL.md",
    frontmatter: [
      "name: autovault-skill",
      "version: 1.0.0",
      "description: Understand AutoVault-managed skills.",
      "category: meta",
      "capabilities.filesystem: readonly",
      "tools: none"
    ],
    overview: [
      "Explains that AutoVault syncs skills into normal agent skill directories as filesystem links.",
      "Documents the optional MCP compatibility tools and when agents should use synced skills directly."
    ],
    useCases: [
      "A user asks why an AutoVault-managed skill is visible.",
      "An agent needs to decide whether MCP tools are required.",
      "You are debugging stale profile sync or skill links."
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none" },
      { kind: "ok", label: "filesystem", scope: "readonly profile inspection" },
      { kind: "no", label: "tools", scope: "none" }
    ],
    related: ["skill-author", "autovault-bootstrap"],
    featured: true
  }
];

export interface SkillFilters {
  query?: string;
  agents?: Iterable<AgentId>;
  categories?: Iterable<SkillCategory>;
  orgs?: Iterable<string>;
}

export type SkillSort = "references" | "recent" | "name";

export function findSkillByName(name: string | undefined): Skill {
  return skills.find((skill) => skill.name === name) ?? skills[0];
}

export function filterSkills(input: Skill[], filters: SkillFilters): Skill[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  const agentSet = new Set(filters.agents ?? []);
  const categorySet = new Set(filters.categories ?? []);
  const orgSet = new Set(filters.orgs ?? []);

  return input.filter((skill) => {
    const matchesQuery = !query || [skill.name, skill.org, skill.desc, skill.category].some((field) => field.toLowerCase().includes(query));
    const matchesAgents = agentSet.size === 0 || skill.agents.some((agent) => agentSet.has(agent));
    const matchesCategories = categorySet.size === 0 || categorySet.has(skill.category);
    const matchesOrgs = orgSet.size === 0 || orgSet.has(skill.org);
    return matchesQuery && matchesAgents && matchesCategories && matchesOrgs;
  });
}

export function sortSkills(input: Skill[], sort: SkillSort): Skill[] {
  const copy = [...input];
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "recent") return copy.sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }));
  return copy.sort((a, b) => b.references - a.references);
}
