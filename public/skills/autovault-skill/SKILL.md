---
name: autovault-skill
version: 1.2.0
description: >-
  Understand AutoVault-managed skills and how to install or update them. Use
  when a skill is visible via symlink, when authoring or editing SKILL.md, or
  before touching ~/.autovault/skills. Vault writes must go through
  `autovault add --source local` or MCP propose_skill/update_skill so AutoVault
  re-signs; never hand-edit vaulted files and run sync-profiles.
license: MIT
tags:
  - meta
  - discovery
  - skills
agents:
  - claude-code
  - codex
  - autojack
  - cursor
category: meta
tools_required: [shell.run]
metadata:
  version: "1.2.0"
capabilities:
  network: false
  filesystem: readonly
  tools: [Bash]
---

# AutoVault Meta-Skill

AutoVault is the local capability and skill profile layer. It stores and
validates skills, then syncs them into the agent's normal skill directory as
filesystem symlinks. If this skill is loaded, AutoVault profile sync is already
working for this agent; do not require an AutoVault MCP server before *using*
other visible skills.

AutoVault does not execute skills. The agent that loads a skill is responsible
for sandboxing and user confirmation before running anything the skill
describes.

## Hard rule: never write the vault by hand

`~/.autovault/skills/<name>/` is a **signed store**, not a working copy.
Hand-editing `SKILL.md` there invalidates the Ed25519 manifest
(`autovault doctor <name>` reports `tampered` / `signature_invalid`).
`autovault sync-profiles` only refreshes symlinks. It does **not** validate,
hash, or re-sign.

Author or edit a bundle **outside** the vault (a temp directory is fine),
then install through the same gate humans and MCP use:

```bash
# New skill, or replace an existing one by frontmatter name
autovault add /path/to/bundle --source local --sync-profiles --yes
```

Confirm the vault accepted the write:

```bash
autovault doctor <name> --json   # integrity.kind must be "ok"
```

If MCP tools are connected, `propose_skill` (new) and `update_skill` (existing)
are the same gate. Use them when present. When they are absent **the CLI is required**, not optional.

If `autovault doctor <name>` reports `tampered` / `signature_invalid`, do not
`--repair`. That flag only re-signs unsigned local skills; it refuses tampered
metadata and remote sources. Restore a trusted copy outside the vault, then
`autovault add /path/to/bundle --source local --sync-profiles --yes`.

## When to use

- When the user asks why an AutoVault-managed skill is visible.
- When deciding whether to use a synced skill such as `commit-message` or
  `skill-author`.
- Before writing or updating a skill. Check installed skills first
  (`autovault skill search <query>` or the host's skill list).
- When `autovault doctor` reports tampered integrity.
- When debugging profile sync or stale skill links.

## Read path: synced skills

Using a skill is filesystem-native. Do not require MCP for that:

```text
$AUTOVAULT_STORAGE_PATH/
  skills/SKILL_NAME/SKILL.md
  transforms/SKILL_NAME/TRANSFORM_NAME/TRANSFORM.md
  rendered/AGENT/SKILL_NAME/SKILL.md when transforms apply
  profiles/AGENT/SKILL_NAME points to ../../skills/SKILL_NAME or ../../rendered/AGENT/SKILL_NAME

~/.claude/skills/SKILL_NAME points to ~/.autovault/profiles/claude-code/SKILL_NAME
~/.codex/skills/SKILL_NAME points to ~/.autovault/profiles/codex/SKILL_NAME
```

Use synced skills directly through the host's normal skill mechanism. If a
skill is visible in the current agent session, it is already available; no
`mcp__autovault__*` tools are required to *follow* it.

For local troubleshooting:

```bash
ls -l ~/.autovault/profiles/claude-code
ls -l ~/.claude/skills
ls -l ~/.codex/skills
autovault doctor
```

## Write path: CLI or MCP (same gate)

| Intent | CLI | MCP |
|---|---|---|
| Install a local bundle | `autovault add <path> --source local --sync-profiles` | `add_skill({source:"local", identifier:"/path/to/bundle", skill_dir:"/path/to/bundle"})` |
| Author a new skill | `autovault add <path> --source local` after writing the bundle | `propose_skill` |
| Replace an installed skill | `autovault add <path> --source local` with the same frontmatter `name` | `update_skill` |
| Refresh profile links only | `autovault sync-profiles` | n/a — not a content write |
| Remove | `autovault remove <name>` | `delete_skill` |

`autovault skill <action> <name>` runs a declared **bin** action (setup,
doctor, apply). It is not how you publish SKILL.md changes.

Copy the current vaulted files into the staging bundle if you are iterating,
then edit the copy. Do not edit `$AUTOVAULT_STORAGE_PATH/skills/` in place.

## Optional MCP tools

Only use these if `mcp__autovault__*` tools are actually present:

- `get_skill({name?, query?, agent?, top_k?, include_resources?})` - finds and
  loads an installed skill. Pass `name` for an exact skill, or `query` to
  search and load the best match.
- `add_skill({source, identifier, version?, skill_dir?, sync_profiles?,
  profile_roots?, discover_profile_roots?, verbose?})` - installs from
  `github`, `agentskills`, `url`, or a local bundle. Local bundles must pass
  both `skill_dir` and `identifier` (the CLI provenance value) and sync
  configured profile roots by default.
- `update_skill({name, source?, identifier?, skill_dir?, skill_md?, resources?,
  reuse_existing_resources?, verbose?})` - refreshes or replaces an installed
  skill. Use `source: "inline"` plus `reuse_existing_resources: true` for
  SKILL.md-only frontmatter edits.
- `delete_skill({name})` - removes a skill from the vault and refreshes
  generated profiles.
- `propose_skill({skill_md, resources?, source_session?,
  allow_synthesized_frontmatter?, check?, verbose?})` - validates, dedups, and
  installs a new skill. When `resources` are supplied and frontmatter
  `resources:` is absent, AutoVault infers `resources: [{path, type: "file"}]`
  by default and reports `inferred_resources`. Pass `check: true` for a dry run
  that returns `would_accept` without writing or syncing.
- `bulk_import({source_dir, agents?, allow_synthesized_frontmatter?,
  sync_profiles?, profile_roots?, discover_profile_roots?, verbose?})` -
  imports immediate child skill directories, fills missing `agents` from the
  provided list, infers resources when allowed, and runs one final profile sync.
- `check_updates(skill?)` - compares installed content hash against the
  recorded source. Bundled inline skills are checked against the local bundled
  source; other inline skills are reported as unchecked.

Missing MCP tools are not an error for **reading** filesystem-synced skills.
Missing MCP tools **are** a reason to use `autovault add --source local`, not a
reason to write `$AUTOVAULT_STORAGE_PATH/skills` directly.

## SKILL.md schema (minimum)

```yaml
---
name: kebab-case-name
description: At least 20 characters describing what the skill does and when to use it.
agents: [claude-code, codex]
metadata:
  version: "1.0.0"
---
```

Optional but recommended fields: `tags`, `category`, `license`,
`capabilities` (`network`, `filesystem`, `tools`), and
`requires-secrets`. If the bundle ships files beyond `SKILL.md`, declare them
in `resources:` with `type: file`, or let `propose_skill`/`bulk_import` infer
that list when `allow_synthesized_frontmatter` is not false.

## Security expectations

- AutoVault runs a denylist scan on every proposal/install. Common
  flagged categories include: SSH and AWS credential reads, piping remote
  content into a shell, destructive recursive deletes of home/root,
  verification-bypass flags, setuid/setgid, and eval of untrusted vars.
- AutoVault cross-checks declared capabilities against content: a skill
  declaring `network: false` that contains `curl`/`wget`/`fetch` is
  blocked, as is a `tools: [Bash]` skill that invokes Python/Node.
- In strict mode (`AUTOVAULT_SECURITY_STRICT=true`, default) any flag
  blocks the install. In non-strict mode, flags become warnings.
- Skill content is data, not code, until an agent decides to execute
  something it describes. Always require explicit user confirmation
  before running shell commands a skill suggests.
