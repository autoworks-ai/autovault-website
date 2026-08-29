import { HOSTED_TRIAL_DAYS, PRODUCT_VERSION } from "../theme/data/product";
import { AUTOVAULT_AGENT_SETUP_PROMPT, AUTOVAULT_BOOTSTRAP_INSTALL_PATH, AUTOVAULT_BOOTSTRAP_SKILL_URL, AUTOVAULT_INSTALL_COMMAND, AUTOVAULT_NPM_INSTALL_COMMAND, AUTOVAULT_NPM_PACKAGE } from "./bootstrap";
import { MANUAL_GHCR_IMAGE, RAILWAY_TEMPLATE_URL } from "./deploy";

export const SITE_URL = "https://autovault.dev";

export type PageDocKey =
  | "overview"
  | "cloud"
  | "hosted-sync"
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
${AUTOVAULT_NPM_INSTALL_COMMAND}
${AUTOVAULT_INSTALL_COMMAND}
brew install autoworks-ai/tap/autovault
autovault skill list
\`\`\`

Any of the three channels works: npm publishes the same release as ${AUTOVAULT_NPM_PACKAGE} for Node 24+ environments, the Homebrew tap is convenient for macOS workstations, and the installer script additionally provisions ~/.autovault end-to-end. Installer and setup flows preserve the vault as user-owned storage and bootstrap bundled skills unless AUTOVAULT_NO_BOOTSTRAP=1 is set. The current public package is ${PRODUCT_VERSION}; AutoVault remains pre-1.0.

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

## Add a skill source

\`\`\`bash
autovault add ./skills/skill-author --sync-profiles --yes
autovault add ~/.agents/skills/copilot-review --source local --sync-profiles --yes
autovault add autoworks-ai/autovault:skills/skill-author/SKILL.md --sync-profiles --yes
autovault add https://example.com/SKILL.md --source url --no-sync-profiles --yes
\`\`\`

\`autovault add\` hands local paths, GitHub identifiers or URLs, agentskills slugs, and direct \`SKILL.md\` URLs to the same gate used by MCP install paths: frontmatter repair, schema validation, denylist scan, capability/behavior check, deduplication, and Ed25519 signing. Pass \`--source local\` when a path needs explicit local-source provenance, \`--provenance\` to keep the recorded identifier when replacing from a staging directory, and \`--agent\` when a remote skill does not declare target agents.

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

Use \`autovault remove <name>\` to delete a vaulted skill, delete its vault-local transforms, and prune AutoVault-managed profile symlinks; native host root discovery is on by default, \`--no-discover\` skips discovered roots, and \`--link agent=/path\` targets a custom root.`;

const cloudMarkdown = `# AutoVault Cloud

AutoVault Cloud serves a signed skill catalog to the machines you admit. You create an account, subscribe, reserve a namespace, and pair each machine with a code. From then on that machine pulls signed skills over HTTPS and verifies every release against a key pinned at enrollment.

Cloud never holds a release signing key. Signing stays on your machine.

## What it costs

One hosted namespace, unlimited machines, billed monthly. The live figure is served from Stripe at /api/pricing rather than written into this page, so treat that endpoint as authoritative.

${HOSTED_TRIAL_DAYS > 0 ? "A free trial is currently offered to first-time accounts, and no card is collected while it runs. This page is generated at build time and cannot state the length or your eligibility: both are decided at checkout, and /api/pricing reports the current length at runtime." : "No free trial is configured right now."}

Cancel any time from the Stripe billing portal. Revoking a machine keeps working after a subscription lapses, so a closed account can still remove a machine it no longer controls.

## What works today

- Create an account and subscribe through Stripe Checkout.
- Reserve a namespace, then reach it at \`https://autovault.dev/v/<slug>/\`.
- Pair a machine by running \`autovault link\` with no argument. The CLI prints an \`XXXX-XXXX\` code and waits.
- Confirm that code in the browser. Confirming admits the machine; the dashboard Admit is for a machine enrolled with \`autovault link <slug>\`, which lands pending. Revoke is on the dashboard either way.
- Admitted machines fetch \`catalog.json\` and each signed bundle, verifying the release signature, the bundle hash, and every file hash.

## How content lands in your vault

Publishing is hands-on in private beta. There is no upload API and the CLI has no publish path, because the release signing key lives on the owner machine and never reaches Cloud. Signed catalog and bundle objects are placed in storage out of band.

**A newly reserved vault therefore serves nothing.** Its catalog returns 404 until the first release is published for it. That is expected, not a fault in your setup.

## Limits worth knowing before you subscribe

- \`catalog.public_key\` is pinned when a machine enrols, so rotating it breaks every enrolled machine.
- Scope is devices, not people. There are no seats, roles, or invitations.
- One vault per account. Namespaces cannot be renamed or deleted.
- Skill drafts can be submitted from the dashboard, but there is no review queue that reads them back yet.

## When to use it

Use Cloud when you want several machines pulling the same signed skills without running a server. Use the local quick start when one developer wants the full CLI surface today. Nothing is gated behind Cloud: the source stays MIT licensed and local-first.`;

const hostedSyncMarkdown = `# Hosted Sync

A hosted vault serves a signed catalog over HTTPS. You pair each machine with a short code, admit it from the browser, and from then on it pulls skills and verifies every release against a key it pinned when it enrolled. Signing stays on your machine; Cloud never holds a signing key.

## Pair a machine

Run this on the machine you want to sync. No argument: the slug is something the machine learns, not something you type.

\`\`\`bash
autovault link
\`\`\`

The CLI generates an Ed25519 keypair, asks Cloud for a pairing code, and prints it. Codes look like \`BKDF-QMTW\`: eight characters from a 20-letter alphabet with no vowels, so a code can never spell a word. The CLI opens your browser and polls every 5 seconds.

Confirm the code at \`/cloud/pair\`. Check the fingerprint on screen against the one in your terminal before confirming. Confirming is the admission in this flow: the machine comes back active with no second dashboard step. Codes expire after 15 minutes; run \`autovault link\` again to mint another.

## Admit and revoke

Machines are listed under Machines on the cloud dashboard, identified by a fingerprint: the first four and last four characters of the public key. The console never renders a full key.

- **Admit** moves a machine from pending to active. This is for a machine enrolled with \`autovault link <slug>\`, which lands pending; confirming a pairing code already admitted that machine.
- **Revoke** moves it to revoked, effective on that machine's next request. This needs no active subscription, so a lapsed account can still remove a machine it no longer controls.
- **Deny** refuses a waiting pairing code. It writes a tombstone rather than deleting the record, so the CLI is told it was refused instead of timing out against a 404.

Re-admitting a revoked key from the console is deliberately not possible; pair that machine again from the machine itself.

## What a machine may read

| Status | May read | May not read |
| --- | --- | --- |
| pending | catalog.json, its own device record | bundles |
| active | catalog.json, bundles, its own device record | nothing withheld while the subscription is live |
| revoked | its own device record, so the CLI can report it and exit | catalog.json, bundles |

The catalog being readable at pending is deliberate rather than an oversight: \`autovault link\` reads it the moment it enrols, to pin \`catalog.public_key\` before you have admitted anything. Bundles are where skill content lives, so they need active status and a live subscription.

## How a request is signed

Every request under \`/v/<slug>/\` is signed. No bearer tokens, no cookies.

\`\`\`text
X-AutoVault-Device      base64url Ed25519 public key
X-AutoVault-Timestamp   whole seconds since epoch
X-AutoVault-Signature   base64url Ed25519 detached signature
\`\`\`

The signed message is the HTTP method, the request path, and the timestamp, newline separated. Timestamps outside a 300 second window either side are rejected, which bounds replay rather than preventing it.

Enrollment is self-attested: the request that enrols a key is signed by that key and the body repeats it. Admitting is what grants access, not enrolling.

## How content lands in your vault

There is no publish API, and the CLI has no publish command. AutoVault consumes the catalog rather than producing it. The key that signs a release lives on the owner machine and never reaches Cloud, which is what makes the signature worth checking. Signed catalog and bundle objects are placed in your namespace out of band while this is in private beta.

**A newly reserved vault serves nothing.** Its catalog returns 404 until the first release is published to it. Your machine will pair and be admitted normally, then report an empty catalog. That is expected.

## Limits worth knowing

- Key rotation breaks enrolled machines. Each pins \`catalog.public_key\` at enrollment, so changing it hard-fails all of them.
- Scope is machines, not people. No seats, roles, or invitations.
- One vault per account. Namespaces cannot be renamed, transferred, or deleted.
- Skill drafts submitted from the dashboard are stored and never read back. There is no review queue yet.

## The protocol underneath

Hosted sync is one transport for a smaller thing: a signed catalog of releases, plus a bundle per release. Cloud is a convenient place to put those files, not where their trustworthiness comes from.

A catalog is one JSON document. Every release inside it carries its own detached signature, so the catalog is a manifest rather than an authority, and verification happens on the consuming machine against a key it pinned.

\`\`\`text
catalog.json
  schema_version  1
  id              vault identifier
  name            display name
  public_key      base64url Ed25519, pinned by each machine
  releases[]      one entry per publishable thing

releases[]
  kind            skill | agent | mcp_server | collection
  name            stable identifier
  version         semver, compared on every check
  channel         stable, beta, or your own
  publisher       who signed it
  policy          auto_apply | user_approve | admin_hold
  capabilities    network, filesystem, tools[]
  breaking        refuse a silent upgrade
  file_hashes[]   path plus sha256, per file
  bundle_hash     sha256 of the bundle
  bundle_path     bundles/<bundle_hash>.json
  signature       ed25519 over the release, domain-separated
\`\`\`

Two fields carry most of the weight. \`policy\` decides what may happen without a human: auto_apply updates silently, user_approve waits for a person, admin_hold refuses until somebody releases it. \`capabilities\` travels inside the signature, so what a skill may reach is part of the signed payload rather than a claim made after installation.

The release signature uses the domain-separation prefix \`autovault-sync-release-v1\`. That prefix is the trust boundary: a signature minted for another purpose cannot be replayed as a release, and changing the string invalidates every signature ever issued.

\`bundle_path\` is inside the signature, and the client re-derives it as bundles/<bundle_hash>.json relative to the catalog. Bundles cannot be renamed, moved, or redirected. A downloaded bundle is checked against bundle_hash and against every entry in file_hashes before any byte reaches the vault.

## Upstreams

A vault holds a list of upstreams. Each records where a catalog lives, the public key pinned for it, and this machine's own enrollment. \`autovault link\` adds one. There are two kinds, and the difference is transport only.

- \`https\` points at a catalog URL. Requests are device-signed, which is what enrollment and admission are for. AutoVault Cloud is one of these, and so is any HTTPS host you run.
- \`file\` points at a catalog path: a directory, a network mount, a checkout on disk. No server, no enrollment handshake, no account.

Both run the same verification. A file upstream is not the trusting option; the release signature is checked exactly as it is over HTTPS, because a shared drive is not a trust boundary either.

\`\`\`bash
autovault link acme-skills                              # a Cloud slug
autovault link https://skills.acme.dev/catalog.json     # your own host
autovault link ./team-catalog                           # a directory
\`\`\`

The argument decides the kind. Anything that parses as a URL is https. Anything containing a path separator, starting with . or ~ or /, or ending in .json is file. A bare lowercase word is treated as a Cloud slug and expanded against autovault.dev. Slugs are lowercase, and a capitalised one is rejected with the lowercase spelling rather than silently downcased.

## Self-hosting a catalog

A catalog is a static file tree, so anything that serves JSON over HTTPS can host one.

\`\`\`text
your-catalog/
  catalog.json
  bundles/
    3f1a...c92e.json
    a704...11bd.json
\`\`\`

Point a machine at it with \`autovault link https://your-host/catalog.json\`. Self-hosted catalogs carry no device enrollment, so there is no admit step and no console. Access control is whatever the host already does, and the signature is what makes the content trustworthy in either case.

**Self-hosting does not solve the publishing gap. It relocates it.** The CLI consumes catalogs and has no command that produces one: link, add, and sync-profiles all read, and nothing signs a release. The signing primitives exist in the source and are reachable from the test helpers, not from a terminal. Hosting your own catalog today means generating and signing it yourself against the shape above.

So the choice is narrower than it looks. Cloud gives enrollment, per-machine admission, and revocation, with hands-on publishing. Self-hosting gives the same verification with no account and no per-machine gate, with hands-on publishing. Neither has a publish command yet.`;

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
- autovault-skill: understand AutoVault-managed filesystem-synced skills, and never hand-edit the signed vault.

First-party AutoVault examples use MIT metadata. Other example sources keep their submitted license metadata and still run through the same gate before admission.

## Agent use

Agents should use get_skill for vault inventory lookup, fetch full content only when needed, and set include_resources when packaged files are required instead of assuming filesystem paths.`;

const apiMarkdown = `# AutoVault API Reference

Current ${PRODUCT_VERSION} surfaces are the local CLI, source ESM library exports, local stdio MCP, remote Streamable HTTP MCP at /mcp, and the hosted sync routes under /v/<slug>/. There is no public REST API or separately published SDK package yet. MCP tools are the agent-facing API. Hosted sync has exactly one write, POST /v/<slug>/devices, which any keypair may call to enrol itself as pending; the rest is reads, and admission gates bundles rather than the catalog.

## Current ${PRODUCT_VERSION} surfaces

- CLI commands for add install, remove/uninstall cleanup, profile sync, doctor checks, local skill search/list/which, repo audit, setup, capability resolve, and remote service startup.
- Source ESM library exports for resolveCapabilities, syncProfiles, addSkill, updateSkill, deleteSkill, proposeSkill, transforms, auditRepo, and profile discovery.
- MCP tools for discovery/full reads through get_skill, trusted adds, updates, deletes, proposals, and drift checks.
- Remote Streamable HTTP MCP with OAuth and role-aware filtering at /mcp.
- AutoVault Cloud hosted sync at /v/<slug>/: four device-signed routes, one write (POST devices, which enrols a key as pending) and three reads.

## Hosted sync routes

Served by AutoVault Cloud under /v/<slug>/. Every route is signed. There are no anonymous reads and no API keys: a device holds an Ed25519 keypair, signs the string \`<METHOD>\\n<pathname>\\n<unix-seconds>\`, and sends three headers.

\`\`\`http
X-AutoVault-Device      base64url Ed25519 public key
X-AutoVault-Timestamp   whole seconds since epoch
X-AutoVault-Signature   base64url detached signature
\`\`\`

Timestamps more than 300 seconds off are rejected. Pathname is the full request path as sent, not a path rebuilt from route parameters.

| Route | Who may call it |
|---|---|
| POST /v/<slug>/devices | any keypair, signed by itself. This is first contact. |
| GET /v/<slug>/devices/current | any enrolled device, including a revoked one |
| GET /v/<slug>/catalog.json | a pending or active device |
| GET /v/<slug>/bundles/<bundle_hash>.json | an active device, on an active subscription |

- Enrollment is idempotent per key, so running \`autovault link\` twice returns the same device_id. A vault holds at most 20 pending devices at once.
- The catalog is readable while a device is still pending, because \`autovault link\` enrols and then immediately reads the catalog to pin the publishing public key.
- Catalog and bundles are served byte-for-byte from KV. Re-serialising the JSON changes the bytes and every release signature stops verifying.
- A vault with nothing published answers 404 for its catalog. That is the normal state of a new vault, not an error.
- Bundles additionally check the hosted subscription and answer 402 when it lapses, while the catalog keeps answering.
- Nothing under /v/ returns a 3xx. The client fetches with redirect: "manual" and throws on any redirect.
- Device responses are no-store, private, because they are authorized per device rather than per URL.

There is no route that writes a catalog. Publishing is owner-side and out of band: the release signing key stays on the owner's machine and Cloud never holds one.

## Agent guidance

Prefer inventory lookup first, full reads second, and get_skill with include_resources when packaged resources are needed. Use local sync-profiles when a filesystem-native host needs files under its local skill root.

## add examples

\`\`\`bash
autovault add ./skills/skill-author --sync-profiles --yes
autovault add ./staging/skill-author --source local --provenance '<existing-identifier>' --sync-profiles --yes
autovault add autoworks-ai/autovault:skills/skill-author/SKILL.md --sync-profiles --yes
autovault add skill-slug --source agentskills --sync-profiles --agent codex --yes
autovault add https://example.com/SKILL.md --source url --no-sync-profiles --yes
\`\`\`

\`autovault add\` infers the source for common local paths and GitHub inputs. Use \`--source\` when the input is ambiguous, \`--agent\` when a remote skill does not declare target agents, \`--sync-profiles\` when visible agent roots should be refreshed, and \`--provenance\` to keep the recorded source identifier when replacing a staged local bundle.`;

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

## Hosted delivery

AutoVault Cloud pulls skills to a second machine without hand-copying files. A machine pairs with a code, the owner admits it from the browser, and it fetches a signed catalog and signed bundles over HTTPS from /v/<slug>/. Every request is Ed25519 device-signed and the client verifies each release against a key pinned at enrollment, so delivery is authenticated in both directions rather than just encrypted in transit.

Where it is behind: getting a signed catalog into a hosted vault is hands-on in private beta. There is no publish button and no upload API, because publishing would require Cloud to hold a release signing key and it deliberately does not. Tessl is the stronger fit when hosted distribution itself is the job.

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

## Hosted sync

AutoVault Cloud moves a signed catalog from the owner's machine to the machines the owner admits. The trust boundary does not move when a vault becomes hosted.

- Cloud holds sync artifacts: signed catalog and bundle objects byte for byte, enrolled device public keys with their status and hostname, and live pairing codes until they expire.
- It also holds account records: the email, name and avatar the identity provider returns, Stripe customer and subscription ids, and the reserved namespace.
- A skill draft posted from the dashboard is stored whole, body text included, and nothing reads it back yet.
- No signing key, in any of them. That is the one thing Cloud is built never to hold.
- Cloud never holds a release signing key. There is no upload API and no publish button, because either would require Cloud to hold the thing that makes a release trustworthy. Signed objects are placed by hand from the machine that signed them.
- A device proves identity with an Ed25519 keypair generated on that machine. The private half never leaves it and there is no API key in its place.
- Every request under /v/ carries a detached signature over \`<METHOD>\\n<pathname>\\n<unix-seconds>\`. A timestamp more than 300 seconds out is refused, so a captured request stops working in five minutes.
- Admission is a person in the browser, not a token exchange. An enrolled key nobody has admitted reads the catalog and its own status, never a bundle: it needs the catalog to pin the publisher key before anyone has decided about it.
- Device responses are no-store and private, because they are authorized per device rather than per URL.

Two costs worth knowing before adopting hosted sync:

- A device pins catalog.public_key the first time it reads the catalog, which is what stops a compromised Cloud substituting releases of its own. There is no rotation path in beta, so changing that key means re-enrolling every machine.
- Revoking a device is immediate for catalog and bundle reads. It does not reach back onto that machine. Skills it already pulled are files on a disk the owner no longer controls.

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

Use \`autovault add <skill-dir> --source local --sync-profiles --yes\`. Sync refuses to overwrite an existing user-managed native directory, so move the native dir aside first if you want the managed symlink in its place.

## Removed skill still visible

Run \`autovault remove <name>\`, then reload the agent session. Removal deletes the vaulted skill, removes its vault-local transforms, regenerates internal profiles, and prunes AutoVault-managed symlinks from discovered native host roots by default. If removal used \`--no-discover\`, discovered native roots were intentionally left alone; re-run without that flag or pass \`--link agent=/path/to/skills\`. Dedicated doctor cleanup for arbitrary orphan symlinks is a follow-up, not current behavior.`;

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

AutoVault is currently pre-1.0. The public source package is MIT licensed and the current release is ${PRODUCT_VERSION}, which adds hosted sync: autovault link enrolls a machine against a signed HTTPS catalog, by Cloud slug or by pairing with a code.

## Current source sync

- Local stdio MCP and remote Streamable HTTP MCP surfaces.
- OAuth and role-aware access checks for remote mode.
- add for local paths, GitHub sources, agentskills slugs, and direct SKILL.md URLs.
- remove for deleting a vaulted skill and pruning AutoVault-managed profile symlinks.
- AUTOVAULT_SKILL_INSTALL vendor routing modes.
- Bundled skills are installed from each skills/*/SKILL.md bundle.
- scripts/bootstrap-skills.mjs to seed bundled skills through the real validation path and refresh discovered host profiles.
- get_skill agent rendering and include_resources for transformed variants and packaged resources.
- check_updates for upstream drift and transform review state.

## v0.5.0

Released August 26, 2026. Adds autovault link, which enrolls a machine against a signed HTTPS catalog and expands a bare Cloud slug to its catalog URL. With no argument it starts Cloud pairing and prints a code to confirm in the browser. Also adds a local management dashboard, Codex render checks in doctor, a unified add UX, and interactive frontmatter repair in add-local. An unpublished Cloud catalog now reads as a waiting state rather than an error.

## v0.4.0

Released May 22, 2026. Improves install and setup review UX, adds community skill examples, smooths the local add flow, standardizes public CLI output, retries Dependabot automerge after CI, and aligns Node typings with the runtime policy.

## v0.3.0

Released May 14, 2026. Adds vaulted skill removal, doctor repair for unsigned local skills, tag-filtered project profiles, v1 migration hardening, and smoother installer/setup/serve UX.

## v0.2.1

Bundled skill bootstrap, expanded validation, signing sidecars, local skill installer flow, remote OAuth docs, and MIT license alignment.

## v0.2.0

Initial focused TypeScript MCP server release with skill storage, source adapters, validation, resource reads, update checks, smoke tests, and documentation.`;

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
    title: "AutoVault Cloud",
    description: "Serve a signed skill catalog to the machines you admit. Pair a machine with a code, admit it, and it pulls verified skills over HTTPS. Publishing is hands-on in private beta.",
    route: "/cloud",
    agentPath: "/agents/cloud",
    markdown: cloudMarkdown
  },
  {
    key: "hosted-sync",
    file: "hosted-sync.md",
    title: "AutoVault Hosted Sync",
    description: "Pair a machine with a code, admit it, and it pulls signed skills from your hosted vault over HTTPS. Covers enrollment, the signed request format, and how content is published.",
    route: "/hosted-sync",
    agentPath: "/agents/hosted-sync",
    markdown: hostedSyncMarkdown
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
    description: "Read AutoVault release notes covering remote MCP, OAuth, skill install, bundled-skill bootstrap, transforms, resource reads, and drift checks.",
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
    "> AutoVault is an MIT-licensed local-first vault for AI agent skills. It validates, signs, scopes, transforms, and serves SKILL.md files over local stdio MCP, remote Streamable HTTP MCP, and device-signed hosted sync.",
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
