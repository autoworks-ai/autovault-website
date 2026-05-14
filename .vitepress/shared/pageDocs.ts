import { PRODUCT_VERSION } from "../theme/data/product";
import { AUTOVAULT_AGENT_SETUP_PROMPT, AUTOVAULT_BOOTSTRAP_INSTALL_PATH, AUTOVAULT_BOOTSTRAP_SKILL_URL, AUTOVAULT_INSTALL_COMMAND } from "./bootstrap";
import { MANUAL_GHCR_IMAGE, RAILWAY_TEMPLATE_URL } from "./deploy";

export const SITE_URL = "https://autovault.dev";

export type PageDocKey =
  | "overview"
  | "cloud"
  | "quick-start"
  | "authoring"
  | "permissions"
  | "skills-directory"
  | "api"
  | "deploy"
  | "compare"
  | "skill-detail"
  | "author-profile"
  | "security"
  | "troubleshooting"
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
    installPath: AUTOVAULT_BOOTSTRAP_INSTALL_PATH
  }
];

export function agentSkillUrl(skill: AgentSkillArtifact): string {
  return skill.rawPath === "/skill.md" ? AUTOVAULT_BOOTSTRAP_SKILL_URL : `${SITE_URL}${skill.rawPath}`;
}

const overviewMarkdown = `# AutoVault

AutoVault is a local-first vault for agent skills: it validates, signs, scopes, transforms, and serves reusable SKILL.md files from one canonical place.

## What it does

- Stores filesystem-native skills in a local vault backed by SQLite.
- Serves the same vault through local stdio MCP or remote Streamable HTTP MCP.
- Uses OAuth and role-aware access checks in remote mode.
- Validates install requests and proposals with frontmatter parsing, schema checks, security scanning, capability/behavior checks, deduplication, and Ed25519 signing.
- Renders per-agent skill profiles for Claude Code, Codex, Cursor, AutoHub, and custom callers.
- Applies vault-local skill transforms so teams can adapt a skill without forking upstream content.
- Tracks source provenance and upstream drift with check_updates.

## Fast path

\`\`\`bash
${AUTOVAULT_INSTALL_COMMAND}
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

Install AutoVault, verify the local vault, add a local signed skill bundle, sync profiles, and run it from an agent.

## Install

\`\`\`bash
${AUTOVAULT_INSTALL_COMMAND}
brew install autoworks-ai/tap/autovault
autovault skill list
\`\`\`

The installer writes ~/.autovault, places the local CLI shim, preserves the folder as user-owned storage, and bootstraps bundled skills unless AUTOVAULT_NO_BOOTSTRAP=1 is set. The current public package is ${PRODUCT_VERSION}; AutoVault remains pre-1.0.

## Agent-assisted setup

Give Claude Code this prompt when you want the agent to install its own bootstrap skill after review:

\`\`\`text
${AUTOVAULT_AGENT_SETUP_PROMPT}
\`\`\`

The skill is opt-in. It stages the installer for inspection, asks before shell execution, then runs doctor and profile sync after approval.

## Run the setup wizard

\`\`\`bash
autovault setup --review
\`\`\`

The setup wizard scans the vault, bundled skills, and any native agent skill roots it discovers (~/.claude/skills, ~/.codex/skills, ~/.cursor/skills), then asks per skill how to adopt it: \`augment\` (default, leaves native dirs in place and refreshes profile symlinks), \`backup\` (moves the native dir to <root>.bak before admitting bytes — the typical "import my existing skills" choice), or \`in-place\` (admits bytes and replaces the native dir with a symlink — destructive). Re-run any time. If you installed AutoVault via Claude Code or another agent's shell tool, the install ran without a TTY and the wizard was skipped — open a real terminal and run \`autovault setup\` to finish onboarding. See Troubleshooting if your existing ~/.claude/skills did not import; picking \`backup\` (not the default \`augment\`) is the common fix.

## Verify

\`\`\`bash
autovault doctor
\`\`\`

Doctor confirms the binary, vault folder, signing key, bundled skill index, and discovered agent profiles.

## Add a local skill bundle

\`\`\`bash
autovault add-local ./skills/skill-author --source vendor/skills --sync-profiles
\`\`\`

The \`autovault add-local\` command hands raw skill content and sibling resources to the same gate used by MCP install paths: frontmatter repair, schema validation, denylist scan, capability/behavior check, deduplication, and Ed25519 signing.

## Vault anatomy

The vault is a normal ~/.autovault folder. The current implementation layout includes config.toml, autovault.sqlite, .signing-key.json, source skills under skills/, .autovault-source.json, .autovault-manifest, rendered variants, profiles/, and optional profiles.config.json. Agent profiles read generated files from the vault rather than maintaining hand-edited forks.

## Scope and run

\`\`\`bash
autovault sync-profiles --discover
autovault skill search code-review --top-k 5
\`\`\`

Profile policy decides which agents, named profiles, tags, and profile links can load a signed skill. The skill name stays stable while transforms render caller-specific tool names.

## Remove a skill

\`\`\`bash
autovault remove skill-author --json
\`\`\`

Use \`autovault remove <name>\` to delete a vaulted skill and prune AutoVault-managed profile symlinks; native host root discovery is on by default, \`--no-discover\` skips discovered roots, and \`--link agent=/path\` targets a custom root.`;

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

A skill is one SKILL.md file: YAML frontmatter plus a markdown body. Open Agent Skills fields provide the portable core: name, description, optional metadata, and resources. AutoVault extensions add production validation fields for canonical tools, transform maps, capability declarations, resources, secret requirements, signed setup actions, and target agents.

## Minimal shape

\`\`\`yaml
---
name: skill-author
version: 1.0.0
description: "Author a well-formed SKILL.md with valid AutoVault frontmatter."
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
capabilities:
  network: false
  filesystem: readwrite
  tools:
    - fs.read
    - fs.write
agents:
  - claude-code
  - codex
---

# Skill Author

Use this skill when the user wants to create or repair a SKILL.md file.
\`\`\`

## Schema and validation

- Keep the open SKILL.md core portable: name, description, metadata, resources, and markdown body should still make sense without AutoVault.
- Declare canonical tool names in tools_required.
- Map caller-specific tool names in transformations instead of forking the skill.
- Use the capabilities block for declared network, filesystem, and tool boundaries; the host agent still owns runtime enforcement.
- Use requires-secrets for secret names and purposes only. Never put secret values in SKILL.md, resources, transforms, or vault files.
- Use signed bin setup actions only for user-run setup, verify, or rotation workflows.
- Package resources beside SKILL.md and load them through get_skill with include_resources.

## Secrets and .env variables

AutoVault is a skill vault, not a credential vault. A skill may describe that it needs authorization, but secret values belong in the host's real secret store: SSH agent, macOS Keychain, 1Password CLI, provider CLIs, or deployment platform secrets.

Good pattern:

- Store SSH keys under ~/.ssh with a named host alias and least-privileged server account.
- Store API tokens in Keychain, 1Password, provider CLIs, or platform secrets.
- Teach the skill the safe workflow, expected remote paths, dry-run checks, and rollback commands.
- Use signed bin setup actions for interactive configuration that the user runs in their own terminal.

Avoid:

- Bundling .env files, SSH private keys, access tokens, or copied dashboard secrets.
- Instructing the agent to read ~/.ssh/id_*, ~/.aws/credentials, or full environment dumps.
- Treating AutoVault signatures as a substitute for secret rotation, revocation, or least privilege.

## Scope

Scope is local policy, not a frontmatter substitute. Use it to decide which agents, projects, devices, and profile links can load the signed skill after admission.

## Admission

Use propose_skill while iterating, add_skill for trusted remote sources or local bundles, and update_skill when replacing an existing skill. All write paths run through the validation and signing gate.`;

const permissionsMarkdown = `# AutoVault Permissions Model

AutoVault keeps three independent answers to "what can a skill do, where, and for whom" so the canonical SKILL.md stays portable while operators stay in control. The three layers are configured separately and visible in plain text.

## Layer 1 — Capabilities

The author declares a small block inside SKILL.md describing what the skill expects: network on or off, filesystem readonly or readwrite, the canonical tool names the body calls.

\`\`\`yaml
capabilities:
  network: false
  filesystem: readwrite
  tools:
    - fs.read
    - fs.write
\`\`\`

This is the author's signal, not enforcement. The admission gate validates the shape (types, enums, list contents) and runs a small denylist on the body; the agent at install time is what compares the declaration against what the skill actually does. A SKILL.md without a capabilities block is accepted with a warning.

## Layer 2 — Transforms

A separate TRANSFORM.md rewrites those declarations per agent. Transforms can add tools, remove tools, flip network, or change filesystem access. Multiple transforms stack in priority order; targets.agents narrows a transform to specific agents (or matches every agent when empty). The author writes one canonical SKILL.md and AutoVault renders one profile per agent at install time.

## Layer 3 — Install scope

After AutoVault renders a profile for an agent, install scope decides whether that profile is symlinked into a host's ~/.claude/skills, ~/.codex/skills, or another agent surface. The agents axis is enforced by autovault sync-profiles. project, device, and profile link are host-policy hooks the local installer composes.

## Agent-mediated install

Operators do not write capabilities, transforms, or scope by hand. Agents understand the model and ask the install-scope questions in plain English: which agents, which projects, which devices. The skill author wrote intent; the operator supplied policy; AutoVault is where those two meet.

## Compatibility

The SKILL.md shape matches the open spec used by Claude Code skills: YAML frontmatter, markdown body. capabilities, transformations, and agents are optional fields layered on top — the gate accepts open-spec skills without them and uses warnings to flag missing declarations rather than blocking admission.`;

const skillsMarkdown = `# AutoVault Skill Examples

The examples page is a compatibility route for curated SKILL.md references. It is not a listings site; it shows how AutoVault admits skills into a local vault, records provenance, signs what passes, renders agent-specific output, and keeps permission signals visible.

## Featured examples

- autovault-bootstrap: audit, install, verify, and sync AutoVault for an agent profile.
- skill-author: author a well-formed SKILL.md with valid frontmatter and capability declarations.
- autovault-skill: understand AutoVault-managed filesystem-synced skills.

First-party AutoVault examples use MIT metadata. Other example sources keep their submitted license metadata and still run through the same gate before admission.

## Agent use

Agents should use get_skill for vault inventory lookup, fetch full content only when needed, and set include_resources when packaged files are required instead of assuming filesystem paths.`;

const apiMarkdown = `# AutoVault API Reference

Current v0.2.1 surfaces are the local CLI, source ESM library exports, local stdio MCP, and remote Streamable HTTP MCP at /mcp. There is no public REST API or separately published SDK package yet. MCP tools are the agent-facing API.

## Current v0.2.1 surfaces

- CLI commands for add-local install, remove/uninstall cleanup, profile sync, doctor checks, local skill search/list/which, repo audit, setup, capability resolve, and remote service startup.
- Source ESM library exports for resolveCapabilities, syncProfiles, addSkill, updateSkill, deleteSkill, proposeSkill, transforms, auditRepo, and profile discovery.
- MCP tools for discovery/full reads through get_skill, trusted adds, updates, deletes, proposals, and drift checks.
- Remote Streamable HTTP MCP with OAuth and role-aware filtering at /mcp.

## Agent guidance

Prefer inventory lookup first, full reads second, and get_skill with include_resources when packaged resources are needed. Use local sync-profiles when a filesystem-native host needs files under its local skill root.`;

const deployMarkdown = `# Deploy A Remote AutoVault

Deploy AutoVault when a team needs a shared remote vault, OAuth-protected MCP access, and role-aware skill delivery.

## Remote mode

- Serves Streamable HTTP MCP at /mcp.
- Uses OAuth for registration, login, token issuance, and protected-resource metadata.
- Keeps validation, signing, transforms, resource reads, and drift checks on the same code path as local mode.
- Remote mode cannot create symlinks on client machines. Remote clients should discover and read skills through get_skill; local filesystem-native hosts still need local sync-profiles or a future mirror helper.

## Railway template

Use the Railway template as the primary self-hosted setup path:

${RAILWAY_TEMPLATE_URL}

Template checklist:

- Provide AUTOVAULT_ADMIN_EMAIL and AUTOVAULT_ADMIN_PASSWORD during deploy. The password must be at least 12 characters and is hashed on first boot.
- Keep the persistent volume mounted at /data/autovault before the first healthy deploy.
- Set AUTOVAULT_MODE=remote and AUTOVAULT_STORAGE_PATH=/data/autovault.
- Confirm AUTOVAULT_PUBLIC_URL matches the generated https://<service>.up.railway.app domain. Railway injects PORT, so do not override it.
- Verify /healthz, /.well-known/oauth-authorization-server, and /mcp after deploy.

## Manual image deploy

Advanced operators can deploy the public GHCR image directly:

\`\`\`text
${MANUAL_GHCR_IMAGE}
volume: /data/autovault
leave PORT unset
\`\`\`

Required variables:

\`\`\`bash
AUTOVAULT_MODE=remote
AUTOVAULT_STORAGE_PATH=/data/autovault
AUTOVAULT_PUBLIC_URL=https://<your-service>.up.railway.app
AUTOVAULT_ADMIN_EMAIL=admin@example.com
AUTOVAULT_ADMIN_PASSWORD=<long random string, min 12 chars>
AUTOVAULT_SECURITY_STRICT=true
AUTOVAULT_LOG_LEVEL=info
\`\`\`

Remote MCP URL:

\`\`\`text
https://<your-service>.up.railway.app/mcp
\`\`\`
`;

const compareMarkdown = `# AutoVault Comparison

AutoVault is a local-first vault, not a browsing destination. It overlaps most closely with Skillfish for multi-agent skill install/update/sync, then differs by making validation, signing, scoped delivery, transforms, and local/remote vault operation the center of the product.

The core AutoVault wedge is transforms instead of forks. Keep pristine upstream source, apply workspace-local deltas at render time, then sign and scope the output each caller actually loads.

## Useful alternatives

- Skillfish: strong open-source manager for installing, updating, syncing, and sharing skill bundles across many agents.
- Tessl: useful public ecosystem and distribution layer for skills and agents.
- SkillKit / Agent Skills directories and spec repos: useful places to find or standardize source material before local admission.
- Manual per-agent folders: simplest for one person with a few files, but drift grows quickly.

## Deduplication bet

Admission-time dedup matters because agent-authored skill corpora already show clone pressure. SkillClone found 75% of all analyzed skills involved in clone pairs, 3.5x ecosystem inflation, only 5,642 unique skill concepts, and 41% of skills in clone families superseded by a strictly better variant.

Source: https://arxiv.org/abs/2603.22447

## Tradeoff

AutoVault is stricter than a sync manager or external discovery surface. That is useful when provenance, permission signals, transforms, drift checks, and scoped delivery matter more than the broadest discovery surface.`;

const skillDetailMarkdown = `# Example Skill Detail

The skill detail page shows one hosted SKILL.md example at a time: frontmatter, declared permissions, source path, compatible agents, and install instructions.

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
- Secret values stay outside the vault in SSH agent, Keychain, 1Password, provider CLIs, or deployment secrets. AutoVault stores skill content and secret names, not credential values.

## Validation pipeline

Every install or proposal runs through frontmatter parsing, schema validation, security scanning, capability/behavior checks, deduplication, and Ed25519 signing. Strict mode blocks denylist hits; non-strict mode can report warnings.

## Secret handling

Use requires-secrets to document required variable or credential names. Use signed bin setup actions when a skill needs interactive setup. Do not bundle .env files, SSH private keys, API tokens, or copied dashboard secrets in SKILL.md, resources, transforms, or the vault directory.

## Remote mode

Remote AutoVault serves Streamable HTTP MCP at /mcp. It uses OAuth for client registration, login, token issuance, and protected-resource metadata, then filters skill visibility for non-owner roles.

## Provenance and drift

Installed skills store source sidecars and signed manifests. check_updates compares installed content against upstream sources and reports drift, including transform base drift through transform_reviews.

## License

AutoVault is MIT licensed and self-buildable from the public source repository.`;

const troubleshootingMarkdown = `# AutoVault Troubleshooting

Most install-time confusion comes down to two things: the setup wizard was skipped because it ran without a TTY, or the wizard ran in augment mode when you wanted backup. Both have clean recoveries; no reinstall is required.

## My existing native skills didn't import

Recovery for the most common scenario — installed AutoVault via Claude Code (or another agent's shell tool) and existing \`~/.claude/skills\` content did not appear in the vault.

1. Open a real terminal. Installers running inside another agent's shell tool execute as a subprocess without a TTY, so the interactive wizard is silently skipped.
2. Run \`autovault setup\`.
3. When the wizard reports your native skills, pick the \`backup\` adoption mode. The \`augment\` safe default only refreshes profile links — it does not ingest your existing content.
4. Reload your Claude Code session so the new skill list is picked up.

## Setup requires an interactive terminal

\`autovault setup\` exits with code 2 and a NoTtyError when invoked without a TTY. Open a real terminal and re-run it, or pass \`autovault setup --json\` for a non-interactive scan that emits a DriftReport without prompting.

## Adoption modes

The wizard offers three adoption modes per native skill:

- \`augment\` (safe default): refresh profile symlinks only. Existing native skill directories are not touched. Use this when you only want bundled AutoVault skills available alongside your existing native skills.
- \`backup\`: rename each native skill directory to \`<root>.bak/<name>\`, admit the bytes into the vault through the validation gate, then replace the original with a managed symlink. Refuses to overwrite an existing backup. The typical "import my skills" choice.
- \`in-place\`: admit the native bytes into the vault, then remove the native directory and replace with a managed symlink. Destructive — no backup.

## sync-profiles ENOENT after install

\`autovault sync-profiles --discover\` can crash with \`ENOENT scandir '.autovault/skills'\` when the vault directory exists but no skills have been installed. Run \`autovault setup\` first; the wizard creates the expected directory tree and admits any bundled skills.

## Doctor signature mismatch

Run \`autovault doctor --repair\`. The repair flow re-signs unsigned local skills under strict validation conditions. It refuses tampered metadata and remote sources. Today the doctor logs mismatches but does not enforce; future versions may reject mismatched signatures at load time.

## Skill admitted but not visible in the agent

After adoption the wizard runs sync-profiles, which reports restart_required: true when symlinks change. Reload the agent session. Use \`autovault skill which <name>\` to confirm where the skill resolves from — vault, bundled, or native.

## Move a skill into the vault without the wizard

Use \`autovault add-local <skill-dir> --source native:claude-code --sync-profiles\`. Sync refuses to overwrite an existing user-managed native directory, so move the native dir aside first if you want the managed symlink in its place.

## Removed skill still visible

Run \`autovault remove <name>\`, then reload the agent session. Removal deletes the vaulted skill, regenerates internal profiles, and prunes AutoVault-managed symlinks from discovered native host roots by default. If removal used \`--no-discover\`, discovered native roots were intentionally left alone; re-run without that flag or pass \`--link agent=/path/to/skills\`. Dedicated doctor cleanup for arbitrary orphan symlinks is a follow-up, not current behavior.`;

const aboutMarkdown = `# About AutoVault

AutoVault is brought to you by Jack Arturo, Jason Coleman, Flint, Zack Katz, and Daniel Iser, with AutoJack in the loop.

## People and projects

- Jack Arturo builds AutoVault, AutoMem, and Jack's build notes for memory-bearing agents and half-built systems.
- AutoJack is the agent-backed writing and workflow track on Jack's build notes.
- Jason Coleman is Co-Founder and CEO of Paid Memberships Pro.
- Flint helps automate business, marketing, and development processes for Stranger Studios.
- Zack Katz is Project Lead and Developer at GravityKit.
- Daniel Iser is Founder of Popup Maker.

## Links

- Jack's build notes: https://drunk.support/about/
- AutoMem: https://automem.ai/
- AutoJack archive: https://drunk.support/category/autojack/
- Jason Coleman: https://www.paidmembershipspro.com/about/
- Flint: https://github.com/flintfromthebasement
- Zack Katz: https://www.gravitykit.com/about/
- Daniel Iser: https://wppopupmaker.com/about/`;

const changelogMarkdown = `# AutoVault Changelog

AutoVault is currently pre-1.0. The public source package is MIT licensed and the current source README identifies v0.2.1 as the release status, with unreleased work already documented for bundled skills, bootstrap flow, signing, and installer polish.

## Current source sync

- Local stdio MCP and remote Streamable HTTP MCP surfaces.
- OAuth and role-aware access checks for remote mode.
- add-local for third-party installers that already have a local skill bundle.
- remove for deleting a vaulted skill and pruning AutoVault-managed profile symlinks.
- AUTOVAULT_SKILL_INSTALL vendor routing modes.
- Bundled skills are installed from each skills/*/SKILL.md bundle.
- scripts/bootstrap-skills.mjs to seed bundled skills through the real validation path and refresh discovered host profiles.
- get_skill agent rendering and include_resources for transformed variants and packaged resources.
- check_updates for upstream drift and transform review state.

## v0.2.0

Initial focused TypeScript MCP server release with skill storage, source adapters, validation, resource reads, update checks, smoke tests, and documentation.

## Unreleased

Bundled skill bootstrap, expanded validation, signing sidecars, add-local installer flow, remove/uninstall cleanup, remote OAuth docs, and MIT license alignment.`;

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
    key: "permissions",
    file: "permissions.md",
    title: "AutoVault Permissions",
    description: "AutoVault's three-layer permission model — capabilities, transforms, install scope — explained the way agents already use it.",
    route: "/permissions",
    agentPath: "/agents/permissions",
    markdown: permissionsMarkdown
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
    description: "Compare AutoVault with Skillfish, Tessl, SkillKit / Agent Skills directories, and manual per-agent folders across provenance, transforms, scoping, and portability.",
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
    key: "troubleshooting",
    file: "troubleshooting.md",
    title: "AutoVault Troubleshooting",
    description: "Diagnose and recover from common AutoVault install and adoption issues — setup wizard, adoption modes, sync-profiles, doctor.",
    route: "/troubleshooting",
    agentPath: "/agents/troubleshooting",
    markdown: troubleshootingMarkdown
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
