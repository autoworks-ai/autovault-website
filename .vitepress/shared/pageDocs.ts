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
}

const overviewMarkdown = `# AutoVault

AutoVault is the skill registry with a gate: a local-first capability layer that validates, signs, scopes, transforms, and serves reusable SKILL.md files for AI agents.

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

## Current agent surfaces

- list_skills and search_skills for discovery.
- get_skill for full SKILL.md content and parsed metadata.
- read_skill_resource for packaged resources.
- install_skill for GitHub, agentskills, and HTTPS sources.
- propose_skill for new gated skills.
- propose_skill_transform, list_skill_transforms, and remove_skill_transform for overlays.
- check_updates for drift detection.

## License

AutoVault is MIT licensed.`;

const quickStartMarkdown = `# AutoVault Quick Start

Install AutoVault, seed the bundled skills, add a skill, scope it, and run it from an agent.

## 1. Install

\`\`\`bash
curl -fsSL https://autovault.sh | sh
export PATH="$HOME/.autovault/bin:$PATH"
autovault skill list
\`\`\`

The installer builds the Node app under ~/.autovault/app, writes the shim to ~/.autovault/bin/autovault, preserves ~/.autovault as storage, and bootstraps bundled skills unless AUTOVAULT_NO_BOOTSTRAP=1 is set.

## 2. Seed bundled skills manually

\`\`\`bash
npm run build
node scripts/bootstrap-skills.mjs
\`\`\`

Bundled skills currently include autovault-skill, commit-message, and skill-author. They install through the same validation path as any other skill.

## 3. Add a remote skill

\`\`\`bash
autovault add github:autoworks-ai/skills/extract-pdf
\`\`\`

Remote skills are untrusted until they pass validation and signing.

## 4. Add a local bundle

\`\`\`bash
autovault add-local ./skills/railway --source railway/skills --sync-profiles
\`\`\`

add-local requires SKILL.md, gathers sibling resources, refuses symlinks, records local provenance, and can refresh discovered profile roots.

## 5. Sync native agent profiles

\`\`\`bash
autovault sync-profiles --discover
\`\`\`

Discovery checks native skill roots such as ~/.claude/skills, ~/.codex/skills, and ~/.cursor/skills. Set AUTOVAULT_PROFILE_LINKS for managed roots that should refresh on install, propose, or transform changes.

## 6. Vendor installer routing

AUTOVAULT_SKILL_INSTALL controls whether vendor installers prefer AutoVault, install both AutoVault and native copies, use native-first fallback, native-only, or skip skill installation.`;

const cloudMarkdown = `# AutoVault Cloud Launch

AutoVault Cloud is the hosted path for teams that want remote MCP, OAuth, role-aware access, bundled skills, and drift checks without standing up their own vault first.

## Promise

- Launch a free hosted vault in about five minutes.
- Serve skills over the same remote Streamable HTTP MCP surface.
- Keep OAuth and role-aware filtering on by default.
- Seed bundled skills through the same validation path as local AutoVault.
- Preserve portability: the public source remains MIT licensed and local-first.

## When to use it

Use hosted AutoVault when a team wants a shared remote vault or a fast first run. Use the local quick start when a single developer wants to keep the whole vault on their machine.`;

const authoringMarkdown = `# Authoring AutoVault Skills

An AutoVault skill is a SKILL.md file with YAML frontmatter and markdown instructions. The frontmatter declares identity, capabilities, resources, permissions, target agents, and optional transform metadata.

## Minimal shape

\`\`\`yaml
---
name: extract-pdf
version: 1.4.0
description: "Extract structured text from PDF files."
author: autoworks-ai
license: MIT
tools_required:
  - fs.read
  - fs.write
permissions:
  network: false
  filesystem: readonly
agents:
  - codex
  - claude-code
---

# Extract PDF

Use this skill when the user asks for text, structure, or summaries from a PDF.
\`\`\`

## Validation expectations

- Keep the name kebab-case and the version semver-like.
- Declare every tool or capability the body actually uses.
- Keep secrets as named references, never literal credentials.
- Package resources beside SKILL.md and let agents read them through read_skill_resource.
- Use the narrowest useful permission scope.

## Transforms

Use propose_skill_transform for vault-local overlays when a workspace or agent needs different instructions, tools, or setup without forking the upstream skill. AutoVault stores the transform under the vault, pins the base skill, signs a transform manifest, and reports base drift through check_updates.

## Publishing

Use propose_skill while iterating, install_skill for trusted remote sources, and add-local for local bundles from third-party installers. All paths run through the validation and signing gate.`;

const skillsMarkdown = `# AutoVault Skills Directory

The skills directory is a signed catalog of reusable SKILL.md packages. It is organized for agents and humans: query by name, description, category, agent compatibility, organization, install count, and license.

## Featured first-party examples

- extract-pdf: extract structured text from PDF files.
- summarize-doc: recursive multi-pass document summarization.
- github-issues: work with GitHub issues through authorized CLI context.
- parse-csv: parse CSV with dialect and type inference.
- yaml-validate: validate YAML with AutoVault-style diagnostics.

First-party AutoVault examples are MIT licensed. Community examples keep their submitted license metadata.

## Agent use

Agents should discover with search_skills or list_skills, fetch full content only when needed with get_skill, and read packaged files through read_skill_resource instead of assuming filesystem paths.`;

const apiMarkdown = `# AutoVault API Reference

AutoVault exposes the same skill primitives through CLI, library, HTTP, and MCP surfaces. Human operators use the CLI, programs use the SDK or HTTP API, and agents connect through local stdio MCP or remote Streamable HTTP MCP.

## Current surfaces

- CLI commands for installing, listing, proposing, verifying, syncing profiles, and checking updates.
- MCP tools for discovery, full skill reads, resource reads, installs, proposals, transforms, and drift checks.
- Remote Streamable HTTP MCP with OAuth and role-aware filtering.

## Agent guidance

Prefer discovery first, full reads second, and packaged resource reads through read_skill_resource instead of guessing filesystem paths.`;

const deployMarkdown = `# Deploy A Remote AutoVault

Deploy AutoVault when a team needs a shared remote vault, OAuth-protected MCP access, and role-aware skill delivery.

## Remote mode

- Serves Streamable HTTP MCP at /mcp.
- Uses OAuth for registration, login, token issuance, and protected-resource metadata.
- Keeps validation, signing, transforms, resource reads, and drift checks on the same code path as local mode.

## Hosted path

Use /cloud for the quickest hosted launch. Use this deploy page when you want to operate the remote service yourself.`;

const compareMarkdown = `# AutoVault Comparison

AutoVault is a validating skill registry rather than a raw index or a pile of per-agent forks.

## Where it differs

- Gate-and-sign instead of publish-and-pray.
- One canonical SKILL.md rendered per caller.
- Local-first operation with optional remote MCP.
- MIT source, portable storage, and reproducible validation.

## Tradeoff

AutoVault is stricter than a raw registry. That is useful when provenance, permission signals, transforms, and drift checks matter.`;

const skillDetailMarkdown = `# Example Skill Detail

The extract-pdf example shows how AutoVault presents one signed skill: frontmatter, declared permissions, resources, provenance, compatible agents, and install instructions.

## License

First-party AutoVault example skills use MIT metadata. Community skills keep their submitted license metadata.`;

const authorProfileMarkdown = `# autoworks-ai Publisher Profile

The autoworks-ai publisher profile groups first-party AutoVault examples and the public identity metadata used by skill detail pages.

## Use

Agents should treat publisher pages as provenance context, then fetch the exact skill content through get_skill or the markdown skill detail endpoint when they need instructions.`;

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
- Bundled skills: autovault-skill, commit-message, and skill-author.
- scripts/bootstrap-skills.mjs to seed bundled skills through the real validation path.
- propose_skill_transform, list_skill_transforms, and remove_skill_transform for vault-local overlays.
- read_skill_resource for packaged resources.
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
    description: "AutoVault is an MIT-licensed skill registry and capability layer for AI agents with validation, signing, scoped delivery, transforms, and MCP access.",
    route: "/",
    agentPath: "/agents/overview",
    markdown: overviewMarkdown
  },
  {
    key: "cloud",
    file: "cloud.md",
    title: "AutoVault Cloud Launch",
    description: "Launch AutoVault for free in five minutes on hosted AutoVault hardware with remote MCP, OAuth, bundled skills, and drift checks.",
    route: "/cloud",
    agentPath: "/agents/cloud",
    markdown: cloudMarkdown
  },
  {
    key: "quick-start",
    file: "quick-start.md",
    title: "AutoVault Quick Start",
    description: "Install AutoVault, bootstrap bundled skills, add remote or local skill bundles, sync native agent profiles, and configure vendor installer routing.",
    route: "/quick-start",
    agentPath: "/agents/quick-start",
    markdown: quickStartMarkdown
  },
  {
    key: "authoring",
    file: "authoring.md",
    title: "Authoring AutoVault Skills",
    description: "Write SKILL.md files with MIT-compatible metadata, capability declarations, resources, permissions, and vault-local transform overlays.",
    route: "/authoring",
    agentPath: "/agents/authoring",
    markdown: authoringMarkdown
  },
  {
    key: "skills-directory",
    file: "skills-directory.md",
    title: "AutoVault Skills Directory",
    description: "Browse signed AutoVault skills by agent, category, organization, install count, and license, with first-party examples aligned to MIT.",
    route: "/skills-directory",
    agentPath: "/agents/skills-directory",
    markdown: skillsMarkdown
  },
  {
    key: "api",
    file: "api.md",
    title: "AutoVault API Reference",
    description: "Reference AutoVault CLI, library, HTTP, and MCP surfaces for loading, rendering, verifying, installing, transforming, and checking skills.",
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
    description: "Compare AutoVault with raw skill registries, per-agent forks, and manual skill management across provenance, transforms, scoping, and portability.",
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
    title: "autoworks-ai Publisher Profile",
    description: "Review the autoworks-ai publisher profile for first-party AutoVault example skills, provenance context, and maintainer metadata.",
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
    pages: pageDocs.map((doc) => ({
      key: doc.key,
      title: doc.title,
      description: doc.description,
      html_url: canonicalUrl(doc),
      markdown_url: agentUrl(doc)
    }))
  };
}

export function buildLlmsTxt(): string {
  const lines = [
    "# AutoVault",
    "",
    "> AutoVault is an MIT-licensed skill registry and capability layer for AI agents. It validates, signs, scopes, transforms, and serves SKILL.md files over local stdio MCP and remote Streamable HTTP MCP.",
    "",
    "## Canonical Docs",
    ...pageDocs.map((doc) => `- [${doc.title}](${agentUrl(doc)}): ${doc.description}`),
    "",
    "## Agent Notes",
    "- Prefer the /agents/* markdown endpoints for compact agent context.",
    "- Use /llms-full.txt when a single bundled context file is more useful than page-by-page loading.",
    "- Human-facing canonical pages use clean URLs without .html extensions."
  ];

  return `${lines.join("\n")}\n`;
}

export function buildLlmsFullTxt(): string {
  return `${buildLlmsTxt()}\n${pageDocs.map((doc) => `---\nurl: ${canonicalUrl(doc)}\nmarkdown: ${agentUrl(doc)}\n---\n\n${doc.markdown}`).join("\n\n")}\n`;
}
