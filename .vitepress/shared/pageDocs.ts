import { PRODUCT_VERSION } from "../theme/data/product";

const CURRENT_VERSION_LABEL = `v${PRODUCT_VERSION}`;

export const SITE_URL = "https://autovault.dev";

export type PageDocKey =
  | "overview"
  | "cloud"
  | "quick-start"
  | "authoring"
  | "skills-directory"
  | "api"
  | "deploy"
  | "compare"
  | "skill-detail"
  | "author-profile"
  | "security"
  | "about"
  | "changelog";

export interface PageDoc {
  key: PageDocKey;
  file: string;
  title: string;
  description: string;
  route: string;
  agentPath: string;
  markdown: string;
  listed?: boolean;
}

export interface AgentSkillArtifact {
  key: string;
  name: string;
  title: string;
  description: string;
  rawPath: string;
  installPath: string;
}

export const agentSkillArtifacts: AgentSkillArtifact[] = [
  {
    key: "autovault-bootstrap",
    name: "autovault-bootstrap",
    title: "AutoVault Bootstrap Skill",
    description: "A raw SKILL.md an agent can audit, install locally, and use to configure AutoVault for its own profile.",
    rawPath: "/skill.md",
    installPath: "~/.claude/skills/autovault-bootstrap/SKILL.md"
  }
];

export function agentSkillUrl(skill: AgentSkillArtifact): string {
  return `${SITE_URL}${skill.rawPath}`;
}

const overviewMarkdown = `# AutoVault

AutoVault is a local-first vault for agent skills: it validates, signs, scopes, transforms, and serves reusable SKILL.md files from one canonical place.

## What it does

- Stores filesystem-native skills in a local vault backed by SQLite.
- Serves the same vault through local stdio MCP or remote Streamable HTTP MCP.
- Uses OAuth and role-aware access checks in remote mode.
- Validates installs and proposals with frontmatter parsing, schema checks, security scanning, capability/behavior checks, deduplication, and Ed25519 signing.
- Renders per-agent skill profiles for Claude Code, Codex, Cursor, AutoHub, and custom callers.
- Applies vault-local skill transforms so teams can adapt a skill without forking upstream content.
- Tracks source provenance and upstream drift with check_updates.

## Fast path

\`\`\`bash
curl -fsSL https://autovault.sh | sh
autovault skill list
\`\`\`

## Current MCP surface

Remote MCP uses the same underscore tool names shown here.

- get_skill for exact reads, vault inventory lookup, rendered agent variants, and optional packaged resources.
- add_skill for trusted GitHub, agentskills, HTTPS, and local bundle sources.
- update_skill for refreshing installed skills from their recorded source or replacing them from a new source.
- delete_skill for removing a skill and refreshing generated profiles.
- propose_skill for new gated skills authored during a conversation.
- check_updates for upstream drift detection.

## License

AutoVault is MIT licensed.`;

const quickStartMarkdown = `# AutoVault Quick Start

Install AutoVault, verify the local vault, add a signed skill, scope it, and run it from an agent.

## Install

\`\`\`bash
curl -fsSL https://autovault.sh | sh
brew install autoworks-ai/tap/autovault
autovault skill list
\`\`\`

The installer writes ~/.autovault, installs the local CLI shim, preserves the folder as user-owned storage, and bootstraps bundled skills unless AUTOVAULT_NO_BOOTSTRAP=1 is set. The current public package is ${PRODUCT_VERSION}; AutoVault remains pre-1.0.

## Agent-assisted setup

Give Claude Code this prompt when you want the agent to install its own bootstrap skill after review:

\`\`\`text
Fetch https://autovault.dev/skill.md, show me what it will do, install it into ~/.claude/skills/autovault-bootstrap/SKILL.md if approved, then run /autovault-bootstrap.
\`\`\`

The skill is opt-in. It stages the installer for inspection, asks before shell execution, then runs doctor and profile sync after approval.

## Verify

\`\`\`bash
autovault doctor
\`\`\`

Doctor confirms the binary, vault folder, signing key, bundled skill index, and discovered agent profiles.

## Add a skill

\`\`\`bash
autovault add github:autoworks-ai/skills/extract-pdf
\`\`\`

Every source adapter hands raw skill content to the same gate: frontmatter repair, schema validation, denylist scan, capability/behavior check, deduplication, and Ed25519 signing.

## Vault anatomy

The vault is a normal ~/.autovault folder with config.toml, keys, source skills, detached signatures, rendered agent files, cache, and audit.log. Agent profiles read generated files from the vault rather than maintaining hand-edited forks.

## Scope and run

\`\`\`bash
autovault scope extract-pdf --agent claude-code,codex,cursor --project autovault-website --device $(hostname)
autovault sync-profiles --discover
\`\`\`

Scope decides which agents, projects, devices, and profile links can load the signed skill. The skill name stays stable while transforms render caller-specific tool names.`;

const cloudMarkdown = `# AutoVault Cloud Launch

AutoVault Cloud is currently paid hosted onboarding: users create an account, subscribe through Stripe Checkout, and reserve a hosted namespace. Cloud sync is not enabled yet; local AutoVault remains the signing and profile-sync source of truth.

## Promise

- Create a Clerk-backed account and internal user row.
- Subscribe through Stripe Checkout before namespace reservation.
- Reserve a stable hosted URL such as https://vault.autovault.dev/your-team.
- Keep local AutoVault as the signing and profile-sync source of truth.
- Preserve portability: the public source remains MIT licensed and local-first.

## When to use it

Use hosted AutoVault when a team wants to reserve its cloud namespace and join the paid onboarding path. Use the local quick start when a single developer wants the working CLI surface today.`;

const authoringMarkdown = `# Authoring AutoVault Skills

A skill is one SKILL.md file: YAML frontmatter plus a markdown body. AutoVault validates production fields for identity, capability declarations, transform maps, permission signals, resources, and target agents.

## Minimal shape

\`\`\`yaml
---
name: extract-pdf
version: 1.4.0
description: "Extract structured text from PDF files."
license: MIT
tools_required:
  - fs.read
  - fs.write
transformations:
  claude-code:
    fs.read: read
    fs.write: write
  codex:
    fs.read: file_read
    fs.write: file_write
permissions:
  network: false
  fs_scope: ["./inputs", "./outputs"]
  egress: deny
agents:
  - claude-code
  - codex
---

# Extract PDF

Use this skill when the user asks for text, structure, or summaries from a PDF.
\`\`\`

## Schema and validation

- Keep name kebab-case, version semver-like, and description short.
- Declare capabilities in tools_required using canonical names.
- Map caller-specific tool names in transformations instead of forking the skill.
- Keep permissions narrow and treat them as runtime signals for the host agent.
- Package resources beside SKILL.md and load them through get_skill with include_resources.

## Scope

Scope is local policy, not a frontmatter substitute. Use it to decide which agents, projects, devices, and profile links can load the signed skill after admission.

## Admission

Use propose_skill while iterating, add_skill for trusted remote sources or local bundles, and update_skill when replacing an existing skill. All write paths run through the validation and signing gate.`;

const skillsMarkdown = `# AutoVault Skill Examples

The examples page is a compatibility route for curated SKILL.md references. It is not a listings site; it shows how AutoVault admits skills into a local vault, records provenance, signs what passes, renders agent-specific output, and keeps permission signals visible.

## Featured examples

- extract-pdf: extract structured text from PDF files.
- summarize-doc: recursive multi-pass document summarization.
- github-issues: work with GitHub issues through authorized CLI context.
- parse-csv: parse CSV with dialect and type inference.
- yaml-validate: validate YAML with AutoVault-style diagnostics.

First-party AutoVault examples use MIT metadata. Other example sources keep their submitted license metadata and still run through the same gate before admission.

## Agent use

Agents should use get_skill for vault inventory lookup, fetch full content only when needed, and set include_resources when packaged files are required instead of assuming filesystem paths.`;

const apiMarkdown = `# AutoVault API Reference

AutoVault exposes the same skill primitives through CLI, library, HTTP, and MCP surfaces. Human operators use the CLI, programs use the SDK or HTTP API, and agents connect through local stdio MCP or remote Streamable HTTP MCP.

## Current surfaces

- CLI commands for installing, listing, proposing, verifying, syncing profiles, and checking updates.
- MCP tools for discovery/full reads through get_skill, trusted adds, updates, deletes, proposals, and drift checks.
- Remote Streamable HTTP MCP with OAuth and role-aware filtering.

## Agent guidance

Prefer inventory lookup first, full reads second, and get_skill with include_resources when packaged resources are needed.`;

const deployMarkdown = `# Deploy A Remote AutoVault

Deploy AutoVault when a team needs a shared remote vault, OAuth-protected MCP access, and role-aware skill delivery.

## Remote mode

- Serves Streamable HTTP MCP at /mcp.
- Uses OAuth for registration, login, token issuance, and protected-resource metadata.
- Keeps validation, signing, transforms, resource reads, and drift checks on the same code path as local mode.
`;

const compareMarkdown = `# AutoVault Comparison

AutoVault is a local-first vault, not a browsing destination. It overlaps most closely with Skillfish for multi-agent skill install/update/sync, then differs by making validation, signing, scoped delivery, transforms, and local/remote vault operation the center of the product.

## Useful alternatives

- Skillfish: strong open-source manager for installing, updating, syncing, and sharing skill bundles across many agents.
- Tessl: useful public ecosystem and distribution layer for skills and agents.
- SkillKit-style directories and Agent Skills spec repos: useful places to find or standardize source material before local admission.
- Manual per-agent folders: simplest for one person with a few files, but drift grows quickly.

## Tradeoff

AutoVault is stricter than a sync manager or external discovery surface. That is useful when provenance, permission signals, transforms, drift checks, and scoped delivery matter more than the broadest discovery surface.`;

const skillDetailMarkdown = `# Example Skill Detail

The extract-pdf example shows how AutoVault presents one signed skill: frontmatter, declared permissions, resources, provenance, compatible agents, and install instructions.

## License

First-party AutoVault example skills use MIT metadata. Community skills keep their submitted license metadata.`;

const authorProfileMarkdown = `# autoworks-ai Source Profile

The autoworks-ai source profile groups first-party AutoVault examples and the public identity metadata used by skill detail pages.

## Use

Agents should treat source pages as provenance context, then fetch the exact skill content through get_skill or the markdown skill detail endpoint when they need instructions.`;

const securityMarkdown = `# AutoVault Security And Provenance

AutoVault does not execute skills. It validates, stores, signs, scopes, and serves skill content. The host agent executes locally inside its own tool and sandbox model.

## Trust boundary

- Authors own what the skill claims to do.
- The vault owns validation, signing, indexing, transforms, and filtered delivery.
- The agent owns runtime execution, approval prompts, and enforcement of declared permissions.

## Validation pipeline

Every install or proposal runs through frontmatter parsing, schema validation, security scanning, capability/behavior checks, deduplication, and Ed25519 signing. Strict mode blocks denylist hits; non-strict mode can report warnings.

## Remote mode

Remote AutoVault serves Streamable HTTP MCP at /mcp. It uses OAuth for client registration, login, token issuance, and protected-resource metadata, then filters skill visibility for non-owner roles.

## Provenance and drift

Installed skills store source sidecars and detached signatures. check_updates compares installed content against upstream sources and reports drift, including transform base drift through transform_reviews.

## License

AutoVault is MIT licensed and self-buildable from the public source repository.`;

const aboutMarkdown = `# About AutoVault

AutoVault is brought to you by Jack Arturo, AutoJack, Jason Coleman, Flint, Zack Katz, and Daniel Iser.

## People and projects

- Jack Arturo builds AutoVault, AutoMem, and the Drunk Support working notebook for memory-bearing agents and half-built systems.
- AutoJack is the agent-backed writing and workflow track on Drunk Support.
- Jason Coleman is Co-Founder and CEO of Paid Memberships Pro.
- Flint helps automate business, marketing, and development processes for Stranger Studios.
- Zack Katz is Project Lead and Developer at GravityKit.
- Daniel Iser is Founder of Popup Maker.

## Links

- Jack Arturo: https://drunk.support/about/
- AutoMem: https://automem.ai/
- AutoJack: https://drunk.support/category/autojack/
- Jason Coleman: https://www.paidmembershipspro.com/about/
- Flint: https://github.com/flintfromthebasement
- Zack Katz: https://www.gravitykit.com/about/
- Daniel Iser: https://wppopupmaker.com/about/`;

const changelogMarkdown = `# AutoVault Changelog

AutoVault is currently pre-1.0. The public source package is MIT licensed and the current source README identifies v0.2.0 as the release status, with unreleased work already documented for bundled skills, bootstrap flow, signing, and installer polish.

## Current source sync

- Local stdio MCP and remote Streamable HTTP MCP surfaces.
- OAuth and role-aware access checks for remote mode.
- add-local for third-party installers that already have a local skill bundle.
- AUTOVAULT_SKILL_INSTALL vendor routing modes.
- Bundled skills are installed from each skills/*/SKILL.md bundle.
- scripts/bootstrap-skills.mjs to seed bundled skills through the real validation path and refresh discovered host profiles.
- get_skill agent rendering and include_resources for transformed variants and packaged resources.
- check_updates for upstream drift and transform review state.

## v0.2.0

Initial focused TypeScript MCP server release with skill storage, source adapters, validation, resource reads, update checks, smoke tests, and documentation.

## Unreleased

Bundled skill bootstrap, expanded validation, signing sidecars, add-local installer flow, remote OAuth docs, and MIT license alignment.`;

export const pageDocs: PageDoc[] = [
  {
    key: "overview",
    file: "index.md",
    title: "AutoVault",
    description: "AutoVault is a local-first vault for AI agent skills with validation, signing, scoped delivery, transforms, and MCP access.",
    route: "/",
    agentPath: "/agents/overview",
    markdown: overviewMarkdown
  },
  {
    key: "cloud",
    file: "cloud.md",
    title: "AutoVault Cloud Launch",
    description: "Create a Clerk account, subscribe through Stripe Checkout, and reserve a hosted AutoVault namespace. Cloud sync is not enabled yet.",
    route: "/cloud",
    agentPath: "/agents/cloud",
    markdown: cloudMarkdown,
    listed: false
  },
  {
    key: "quick-start",
    file: "quick-start.md",
    title: "AutoVault Quick Start",
    description: "Install AutoVault, verify the local vault, inspect vault anatomy, scope a signed skill, and run it from supported agents.",
    route: "/quick-start",
    agentPath: "/agents/quick-start",
    markdown: quickStartMarkdown
  },
  {
    key: "authoring",
    file: "authoring.md",
    title: "Authoring AutoVault Skills",
    description: "Write production SKILL.md files with canonical tools, transform maps, permissions, agent targets, resources, and browser-gate validation.",
    route: "/authoring",
    agentPath: "/agents/authoring",
    markdown: authoringMarkdown
  },
  {
    key: "skills-directory",
    file: "skills-directory.md",
    title: "AutoVault Skill Examples",
    description: "Review curated AutoVault examples by agent, capability, source, provenance, permissions, transforms, and license.",
    route: "/skills-directory",
    agentPath: "/agents/skills-directory",
    markdown: skillsMarkdown
  },
  {
    key: "api",
    file: "api.md",
    title: "AutoVault API Reference",
    description: "Reference AutoVault CLI, library, HTTP, and MCP surfaces for loading, rendering, verifying, admitting, transforming, and checking skills.",
    route: "/api",
    agentPath: "/agents/api",
    markdown: apiMarkdown
  },
  {
    key: "deploy",
    file: "deploy.md",
    title: "Deploy A Remote AutoVault",
    description: "Deploy AutoVault as a remote Streamable HTTP MCP service with OAuth, role-aware access, policy enforcement, and portable storage.",
    route: "/deploy",
    agentPath: "/agents/deploy",
    markdown: deployMarkdown
  },
  {
    key: "compare",
    file: "compare.md",
    title: "AutoVault vs Alternatives",
    description: "Compare AutoVault with Skillfish, Tessl, SkillKit-style directories, and manual per-agent folders across provenance, transforms, scoping, and portability.",
    route: "/compare",
    agentPath: "/agents/compare",
    markdown: compareMarkdown
  },
  {
    key: "skill-detail",
    file: "skill-detail.md",
    title: "AutoVault Skill Detail Example",
    description: "Inspect an example signed AutoVault skill page with frontmatter, permissions, provenance, transforms, install details, and MIT first-party metadata.",
    route: "/skill-detail",
    agentPath: "/agents/skill-detail",
    markdown: skillDetailMarkdown
  },
  {
    key: "author-profile",
    file: "author-autoworks-ai.md",
    title: "autoworks-ai Source Profile",
    description: "Review the autoworks-ai source profile for first-party AutoVault example skills, provenance context, and maintainer metadata.",
    route: "/author-autoworks-ai",
    agentPath: "/agents/author-autoworks-ai",
    markdown: authorProfileMarkdown
  },
  {
    key: "security",
    file: "security.md",
    title: "AutoVault Security And Provenance",
    description: "Inspect AutoVault's trust boundary, validation gate, Ed25519 provenance, OAuth-protected remote MCP mode, and drift detection model.",
    route: "/security",
    agentPath: "/agents/security",
    markdown: securityMarkdown
  },
  {
    key: "about",
    file: "about.md",
    title: "About AutoVault",
    description: "Meet the people and projects behind AutoVault, including Jack Arturo, AutoJack, Jason Coleman, Flint, Zack Katz, and Daniel Iser.",
    route: "/about",
    agentPath: "/agents/about",
    markdown: aboutMarkdown
  },
  {
    key: "changelog",
    file: "changelog.md",
    title: "AutoVault Changelog",
    description: "Read AutoVault release notes covering remote MCP, OAuth, add-local, bundled-skill bootstrap, transforms, resource reads, and drift checks.",
    route: "/changelog",
    agentPath: "/agents/changelog",
    markdown: changelogMarkdown
  }
];

export const listedPageDocs = pageDocs.filter((doc) => doc.listed !== false);

export function getPageDoc(key: PageDocKey): PageDoc {
  const page = pageDocs.find((doc) => doc.key === key);
  if (!page) throw new Error(`Unknown page doc: ${key}`);
  return page;
}

export function findPageDocByFile(relativePath: string): PageDoc | undefined {
  return pageDocs.find((doc) => doc.file === relativePath);
}

export function canonicalUrl(doc: PageDoc): string {
  return `${SITE_URL}${doc.route === "/" ? "/" : doc.route}`;
}

export function agentUrl(doc: PageDoc): string {
  return `${SITE_URL}${doc.agentPath}`;
}

export function buildAgentsIndex() {
  return {
    title: "AutoVault agent documentation",
    description: "Extensionless markdown endpoints for agents reading AutoVault documentation.",
    generated_at: new Date().toISOString(),
    pages: listedPageDocs.map((doc) => ({
      key: doc.key,
      title: doc.title,
      description: doc.description,
      html_url: canonicalUrl(doc),
      markdown_url: agentUrl(doc)
    })),
    skills: agentSkillArtifacts.map((skill) => ({
      key: skill.key,
      name: skill.name,
      title: skill.title,
      description: skill.description,
      raw_url: agentSkillUrl(skill),
      install_path: skill.installPath
    }))
  };
}

export function buildLlmsTxt(): string {
  const lines = [
    "# AutoVault",
    "",
    "> AutoVault is an MIT-licensed local-first vault for AI agent skills. It validates, signs, scopes, transforms, and serves SKILL.md files over local stdio MCP and remote Streamable HTTP MCP.",
    "",
    "## Canonical Docs",
    ...listedPageDocs.map((doc) => `- [${doc.title}](${agentUrl(doc)}): ${doc.description}`),
    "",
    "## Hosted Skills",
    ...agentSkillArtifacts.map((skill) => `- [${skill.title}](${agentSkillUrl(skill)}): ${skill.description}`),
    "",
    "## Agent Notes",
    "- Prefer the /agents/* markdown endpoints for compact agent context.",
    "- The hosted bootstrap skill is an opt-in raw SKILL.md; audit it before installing it into an agent profile.",
    "- Use /llms-full.txt when a single bundled context file is more useful than page-by-page loading.",
    "- Human-facing canonical pages use clean URLs without .html extensions."
  ];

  return `${lines.join("\n")}\n`;
}

export function buildLlmsFullTxt(): string {
  return `${buildLlmsTxt()}\n${listedPageDocs.map((doc) => `---\nurl: ${canonicalUrl(doc)}\nmarkdown: ${agentUrl(doc)}\n---\n\n${doc.markdown}`).join("\n\n")}\n`;
}
