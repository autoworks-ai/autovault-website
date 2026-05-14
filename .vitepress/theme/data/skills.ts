export type AgentId = "cc" | "cx" | "aj";
export type SkillCategory = "setup" | "authoring" | "meta" | "provenance" | "transforms" | "security";
export type SkillSourceKind = "first-party" | "trusted-provider";
export type SkillAdmissionStatus = "hosted-example" | "provenance-example";

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
  sourceKind: SkillSourceKind;
  providerName: string;
  trustLabel: string;
  admissionStatus: SkillAdmissionStatus;
  provenanceNote: string;
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
  { id: "meta" as const, label: "Meta" },
  { id: "provenance" as const, label: "Provenance" },
  { id: "transforms" as const, label: "Transforms" },
  { id: "security" as const, label: "Security" }
];

export const orgs = [
  { id: "autoworks-ai", label: "autoworks-ai" },
  { id: "autovault.dev", label: "autovault.dev" },
  { id: "anthropic", label: "Anthropic" }
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
    install: "add_skill({ source: \"github\", identifier: \"autoworks-ai/autovault-website@457f238d0fd49425ac01ad7dad58c726624f1eaa:public/skills/autovault-bootstrap/SKILL.md\" })",
    detailPath: "/skill/autovault-bootstrap",
    rawPath: "/skills/autovault-bootstrap/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault-website/blob/main/public/skills/autovault-bootstrap/SKILL.md",
    sourceLabel: "public/skills/autovault-bootstrap/SKILL.md",
    sourceKind: "first-party",
    providerName: "AutoVault",
    trustLabel: "First-party hosted example",
    admissionStatus: "hosted-example",
    provenanceNote: "Hosted by autovault.dev and parsed by the website catalog test before being shown.",
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
    install: "add_skill({ source: \"github\", identifier: \"autoworks-ai/autovault@85cea7424bfbc37901752600adf5eaab87e6b85a:skills/skill-author/SKILL.md\" })",
    detailPath: "/skill/skill-author",
    rawPath: "/skills/skill-author/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault/blob/main/skills/skill-author/SKILL.md",
    sourceLabel: "autoworks-ai/autovault/skills/skill-author/SKILL.md",
    sourceKind: "first-party",
    providerName: "autoworks-ai",
    trustLabel: "First-party source skill",
    admissionStatus: "hosted-example",
    provenanceNote: "Published from the AutoVault source tree and mirrored here as a hosted SKILL.md example.",
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
    install: "add_skill({ source: \"github\", identifier: \"autoworks-ai/autovault@85cea7424bfbc37901752600adf5eaab87e6b85a:skills/autovault-skill/SKILL.md\" })",
    detailPath: "/skill/autovault-skill",
    rawPath: "/skills/autovault-skill/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault/blob/main/skills/autovault-skill/SKILL.md",
    sourceLabel: "autoworks-ai/autovault/skills/autovault-skill/SKILL.md",
    sourceKind: "first-party",
    providerName: "autoworks-ai",
    trustLabel: "First-party source skill",
    admissionStatus: "hosted-example",
    provenanceNote: "Published from the AutoVault source tree and mirrored here as a hosted SKILL.md example.",
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
  },
  {
    name: "trusted-skill-import",
    org: "anthropic",
    icon: "TP",
    category: "provenance",
    agents: ["cc", "cx"],
    desc: "Review a skill obtained from a trusted external provider before admitting it to a local AutoVault.",
    v: "0.1.0",
    references: 3,
    license: "MIT",
    size: "1,774 B",
    install: "add_skill({ source: \"url\", identifier: \"https://autovault.dev/skills/trusted-skill-import/SKILL.md\" })",
    detailPath: "/skill/trusted-skill-import",
    rawPath: "/skills/trusted-skill-import/SKILL.md",
    sourceUrl: "https://docs.claude.com/en/docs/agents-and-tools/agent-skills",
    sourceLabel: "docs.claude.com/agents-and-tools/agent-skills",
    sourceKind: "trusted-provider",
    providerName: "Anthropic",
    trustLabel: "Trusted provider provenance example",
    admissionStatus: "provenance-example",
    provenanceNote: "Models a trusted-provider review flow using Anthropic's public skills guidance without making the catalog a marketplace.",
    frontmatter: [
      "name: trusted-skill-import",
      "version: 0.1.0",
      "description: Review a skill obtained from a trusted external provider before admitting it to a local AutoVault.",
      "source.provider: Anthropic",
      "capabilities.filesystem: readonly",
      "tools_required: Read"
    ],
    overview: [
      "Shows how AutoVault can represent a trusted external provider source while still requiring local review.",
      "Keeps install behavior explicit: users copy the MCP add_skill call or stage the file locally before running the admission gate."
    ],
    useCases: [
      "A user brings a skill from a trusted external provider.",
      "The source URL and local copy need provenance review before admission.",
      "A team wants to show third-party trust context without operating a marketplace."
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none during local review" },
      { kind: "ok", label: "filesystem", scope: "readonly SKILL.md inspection" },
      { kind: "warn", label: "provider", scope: "trust label still requires local admission" }
    ],
    related: ["autovault-skill", "skill-author"]
  },
  {
    name: "multi-agent-transform",
    org: "autoworks-ai",
    icon: "MT",
    category: "transforms",
    agents: ["cc", "cx", "aj"],
    desc: "Demonstrate a single canonical skill rendered into Claude Code, Codex, and AutoJack tool vocabularies.",
    v: "0.1.0",
    references: 2,
    license: "MIT",
    size: "1,508 B",
    install: "add_skill({ source: \"github\", identifier: \"autoworks-ai/autovault-website@457f238d0fd49425ac01ad7dad58c726624f1eaa:public/skills/multi-agent-transform/SKILL.md\" })",
    detailPath: "/skill/multi-agent-transform",
    rawPath: "/skills/multi-agent-transform/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault-website/blob/main/public/skills/multi-agent-transform/SKILL.md",
    sourceLabel: "public/skills/multi-agent-transform/SKILL.md",
    sourceKind: "first-party",
    providerName: "autoworks-ai",
    trustLabel: "First-party transform example",
    admissionStatus: "hosted-example",
    provenanceNote: "Demonstrates transform metadata for Claude Code, Codex, and AutoJack from one canonical skill source.",
    frontmatter: [
      "name: multi-agent-transform",
      "version: 0.1.0",
      "description: Demonstrate a single canonical skill rendered into Claude Code, Codex, and AutoJack tool vocabularies.",
      "transformations: claude-code, codex, autojack",
      "capabilities.filesystem: readwrite",
      "tools_required: fs.read, fs.write, shell.run"
    ],
    overview: [
      "Shows how canonical capabilities can render into each supported agent's tool vocabulary.",
      "Uses one reviewed SKILL.md so per-agent copies do not drift."
    ],
    useCases: [
      "A workflow needs to run across Claude Code, Codex, and AutoJack.",
      "A reviewer wants to inspect transform metadata before profile sync.",
      "A team wants to demonstrate more complex AutoVault capability rendering."
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none" },
      { kind: "ok", label: "filesystem", scope: "read/write demo scope" },
      { kind: "ok", label: "transforms", scope: "three agent renderers declared" }
    ],
    related: ["autovault-skill", "skill-author"]
  },
  {
    name: "secret-safe-setup",
    org: "autoworks-ai",
    icon: "SS",
    category: "security",
    agents: ["cc", "cx"],
    desc: "Guide a user through secret-safe setup where credentials stay in host secret stores, not in SKILL.md.",
    v: "0.1.0",
    references: 2,
    license: "MIT",
    size: "2,157 B",
    install: "add_skill({ source: \"github\", identifier: \"autoworks-ai/autovault-website@457f238d0fd49425ac01ad7dad58c726624f1eaa:public/skills/secret-safe-setup/SKILL.md\" })",
    detailPath: "/skill/secret-safe-setup",
    rawPath: "/skills/secret-safe-setup/SKILL.md",
    sourceUrl: "https://github.com/autoworks-ai/autovault-website/blob/main/public/skills/secret-safe-setup/SKILL.md",
    sourceLabel: "public/skills/secret-safe-setup/SKILL.md",
    sourceKind: "first-party",
    providerName: "autoworks-ai",
    trustLabel: "First-party secret-safe example",
    admissionStatus: "hosted-example",
    provenanceNote: "Shows `requires-secrets` and signed setup actions while keeping secret values outside the skill and vault.",
    frontmatter: [
      "name: secret-safe-setup",
      "version: 0.1.0",
      "description: Guide a user through secret-safe setup where credentials stay in host secret stores, not in SKILL.md.",
      "requires-secrets: PROVIDER_PROFILE",
      "bin: setup, verify",
      "capabilities.filesystem: readonly"
    ],
    overview: [
      "Documents how skills should refer to credentials by name without storing secret values.",
      "Demonstrates signed user-run setup and verify actions for out-of-band configuration."
    ],
    useCases: [
      "A workflow needs a provider token, SSH key, or CLI profile.",
      "The user wants setup guidance without exposing credentials to the agent transcript.",
      "A reviewer wants to see `requires-secrets` and `bin` metadata in context."
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none" },
      { kind: "ok", label: "filesystem", scope: "readonly metadata inspection" },
      { kind: "warn", label: "secrets", scope: "host-managed profile names only" }
    ],
    related: ["skill-author", "trusted-skill-import"]
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
    const matchesQuery = !query || [skill.name, skill.org, skill.desc, skill.category, skill.providerName, skill.trustLabel, skill.provenanceNote].some((field) => field.toLowerCase().includes(query));
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
