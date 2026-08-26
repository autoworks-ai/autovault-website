export type AgentId = "cc" | "cx" | "aj" | "cu";
export type SkillCategory = "setup" | "authoring" | "brand" | "meta" | "provenance" | "transforms" | "security";
export type SkillSourceKind = "first-party" | "trusted-provider";
export type SkillAdmissionStatus = "hosted-example" | "provenance-example";
export type SkillResourceKind = "markdown" | "svg" | "css" | "ascii" | "yaml" | "script" | "file";

export interface SkillResource {
  path: string;
  kind: SkillResourceKind;
  group: string;
  title: string;
  summary: string;
}

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
  cliInstall?: string;
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
  resources?: SkillResource[];
  permissions: Array<{ label: string; scope: string; kind: "ok" | "no" | "warn" }>;
  related: string[];
  featured?: boolean;
}

export const agents = [
  { id: "cc" as const, label: "Claude Code", color: "#d6a85a" },
  { id: "cx" as const, label: "Codex", color: "#5a9dd6" },
  { id: "aj" as const, label: "AutoJack", color: "#5ad6c0" },
  { id: "cu" as const, label: "Cursor", color: "#9aa5b1" }
];

export const categories = [
  { id: "setup" as const, label: "Setup" },
  { id: "authoring" as const, label: "Authoring" },
  { id: "brand" as const, label: "Brand" },
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

const AUTOVAULT_WEBSITE_SKILL_REF = "457f238d0fd49425ac01ad7dad58c726624f1eaa";
const AUTOVAULT_SOURCE_SKILL_REF = "85cea7424bfbc37901752600adf5eaab87e6b85a";

function githubSkillSource(repo: string, ref: string, path: string) {
  return {
    install: `add_skill({ source: "github", identifier: "${repo}@${ref}:${path}" })`,
    cliInstall: `autovault add ${repo}@${ref}:${path} --sync-profiles`,
    sourceUrl: `https://github.com/${repo}/blob/${ref}/${path}`
  };
}

function hostedUrlSkillSource(url: string) {
  return {
    install: `add_skill({ source: "url", identifier: "${url}" })`,
    cliInstall: `autovault add ${url} --source url --sync-profiles`,
    sourceUrl: url
  };
}

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
    ...githubSkillSource("autoworks-ai/autovault-website", AUTOVAULT_WEBSITE_SKILL_REF, "public/skills/autovault-bootstrap/SKILL.md"),
    detailPath: "/skill/autovault-bootstrap",
    rawPath: "/skills/autovault-bootstrap/SKILL.md",
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
    name: "autovault-brand-system",
    org: "autovault.dev",
    icon: "BS",
    category: "brand",
    agents: ["cc", "cx", "aj"],
    desc: "Apply the AutoVault brand system across web SVG, terminal ASCII, illustrated mascot, social asset, and video-oriented surfaces.",
    v: "0.1.0",
    references: 10,
    license: "MIT",
    size: "4,517 B",
    ...hostedUrlSkillSource("https://autovault.dev/skills/autovault-brand-system/SKILL.md"),
    detailPath: "/skill/autovault-brand-system",
    rawPath: "/skills/autovault-brand-system/SKILL.md",
    sourceLabel: "public/skills/autovault-brand-system/SKILL.md",
    sourceKind: "first-party",
    providerName: "AutoVault",
    trustLabel: "First-party brand-system example",
    admissionStatus: "hosted-example",
    provenanceNote: "Shows how a skill can bundle brand identity, motion rules, SVG/CSS/ASCII assets, and raster prompt recipes as reusable AutoVault resources.",
    frontmatter: [
      "name: autovault-brand-system",
      "version: 0.1.0",
      "description: Apply the AutoVault brand system across web SVG, terminal ASCII, illustrated mascot, social asset, and video-oriented surfaces.",
      "category: brand",
      "resources: references, SVG, CSS, ASCII, prompt, OpenAI metadata",
      "capabilities.filesystem: readwrite"
    ],
    overview: [
      "Codifies AutoVault's current visual identity, mark anatomy, type, palette, motion states, and reduced-motion behavior.",
      "Bundles reusable assets and adaptation notes for web SVG, terminal ASCII, mascot/raster, social, and video-style surfaces."
    ],
    useCases: [
      "A surface needs to use the AutoVault mark, colors, type, or interaction states consistently.",
      "An agent is adapting the vault brand between SVG, terminal, raster, and video constraints.",
      "A showcase skill should demonstrate that AutoVault can ship rich reference material and assets, not just instructions."
    ],
    resources: [
      {
        path: "agents/openai.yaml",
        kind: "yaml",
        group: "agents",
        title: "OpenAI agent metadata",
        summary: "Interface labels, icon paths, brand color, and invocation policy for agent hosts."
      },
      {
        path: "references/identity.md",
        kind: "markdown",
        group: "references",
        title: "Identity reference",
        summary: "Canonical brand scope, palette, type, mark anatomy, voice, layout, and accessibility rules."
      },
      {
        path: "references/motion.md",
        kind: "markdown",
        group: "references",
        title: "Motion reference",
        summary: "Motion tokens, scan/admit/lock states, interaction triggers, reduced motion, and video timing."
      },
      {
        path: "references/surface-adaptation.md",
        kind: "markdown",
        group: "references",
        title: "Surface adaptation",
        summary: "How to translate the brand across SVG, CSS, terminal, TUI, mascot, social, video, and checkout surfaces."
      },
      {
        path: "assets/brand-mark.svg",
        kind: "svg",
        group: "assets",
        title: "Static SVG mark",
        summary: "Self-contained static AutoVault vault mark for small UI, docs, and badge contexts."
      },
      {
        path: "assets/brand-mark-animated.svg",
        kind: "svg",
        group: "assets",
        title: "Animated SVG mark",
        summary: "Self-contained animated mark showing scan, dial close, and locked/admitted state with reduced-motion fallback."
      },
      {
        path: "assets/autovault-brand.css",
        kind: "css",
        group: "assets",
        title: "Brand CSS tokens",
        summary: "Reusable CSS custom properties, state classes, scan animation, dial state hooks, and reduced-motion rules."
      },
      {
        path: "assets/ascii-vault.txt",
        kind: "ascii",
        group: "assets",
        title: "ASCII vault frames",
        summary: "Terminal-safe locked, unlocked, scan, read, admit, and held states for logs and TUIs."
      },
      {
        path: "assets/mascot-prompt.md",
        kind: "markdown",
        group: "assets",
        title: "Mascot prompt",
        summary: "Raster and video art direction for friendly mascot adaptations without making the mascot canonical."
      },
      {
        path: "assets/usage-examples.md",
        kind: "markdown",
        group: "assets",
        title: "Usage examples",
        summary: "Copy-ready recipes for web SVG marks, CSS state hooks, terminal loaders, mascot prompts, and video bumpers."
      }
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none" },
      { kind: "ok", label: "filesystem", scope: "read/write for adapting local brand assets" },
      { kind: "ok", label: "resources", scope: "SVG, CSS, ASCII, prompt, metadata, and reference files" }
    ],
    related: ["skill-author", "autovault-skill", "multi-agent-transform"],
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
    ...githubSkillSource("autoworks-ai/autovault", AUTOVAULT_SOURCE_SKILL_REF, "skills/skill-author/SKILL.md"),
    detailPath: "/skill/skill-author",
    rawPath: "/skills/skill-author/SKILL.md",
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
    agents: ["cc", "cx", "aj", "cu"],
    desc: "Understand AutoVault-managed skills, when synced filesystem skills can be used without MCP, and that vault writes must go through autovault add --source local or propose_skill/update_skill.",
    v: "1.2.0",
    references: 4,
    license: "MIT",
    size: "8,177 B",
    ...hostedUrlSkillSource("https://autovault.dev/skills/autovault-skill/SKILL.md"),
    detailPath: "/skill/autovault-skill",
    rawPath: "/skills/autovault-skill/SKILL.md",
    sourceLabel: "public/skills/autovault-skill/SKILL.md",
    sourceKind: "first-party",
    providerName: "autoworks-ai",
    trustLabel: "First-party hosted example",
    admissionStatus: "hosted-example",
    provenanceNote: "Hosted by autovault.dev and parsed by the website catalog test before being shown.",
    frontmatter: [
      "name: autovault-skill",
      "version: 1.2.0",
      "description: Understand AutoVault-managed skills and how to install or update them.",
      "category: meta",
      "capabilities.filesystem: readonly",
      "tools: Bash"
    ],
    overview: [
      "Explains that AutoVault syncs skills into normal agent skill directories as filesystem links.",
      "Treats ~/.autovault/skills as a signed store: author outside the vault, then autovault add --source local or MCP propose_skill/update_skill.",
      "Documents optional MCP tools and when missing MCP means use the CLI, not a hand edit."
    ],
    useCases: [
      "A user asks why an AutoVault-managed skill is visible.",
      "An agent is about to edit SKILL.md and needs the signed-store write path.",
      "You are debugging stale profile sync, tampered integrity, or skill links."
    ],
    permissions: [
      { kind: "no", label: "network", scope: "none" },
      { kind: "ok", label: "filesystem", scope: "readonly profile inspection" },
      { kind: "ok", label: "tools", scope: "Bash for doctor / autovault add" }
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
    cliInstall: "autovault add https://autovault.dev/skills/trusted-skill-import/SKILL.md --source url --sync-profiles",
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
    ...githubSkillSource("autoworks-ai/autovault-website", AUTOVAULT_WEBSITE_SKILL_REF, "public/skills/multi-agent-transform/SKILL.md"),
    detailPath: "/skill/multi-agent-transform",
    rawPath: "/skills/multi-agent-transform/SKILL.md",
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
    ...githubSkillSource("autoworks-ai/autovault-website", AUTOVAULT_WEBSITE_SKILL_REF, "public/skills/secret-safe-setup/SKILL.md"),
    detailPath: "/skill/secret-safe-setup",
    rawPath: "/skills/secret-safe-setup/SKILL.md",
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
    const resourceFields = (skill.resources ?? []).flatMap((resource) => [resource.path, resource.kind, resource.group, resource.title, resource.summary]);
    const matchesQuery = !query || [skill.name, skill.org, skill.desc, skill.category, skill.providerName, skill.trustLabel, skill.provenanceNote, ...resourceFields].some((field) => field.toLowerCase().includes(query));
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
