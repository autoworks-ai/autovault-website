---
name: trusted-skill-import
version: 0.1.0
description: Review a skill obtained from a trusted external provider before admitting it to a local AutoVault.
license: MIT
tags: [provenance, trusted-provider, import, autovault]
agents: [claude-code, codex]
category: provenance
tools_required: [Read]
capabilities:
  network: false
  filesystem: readonly
  tools: [Read]
source:
  provider: Anthropic
  reference: https://docs.claude.com/en/docs/agents-and-tools/agent-skills
---

# Trusted Skill Import

Use this skill when a user has a skill from a trusted external source and wants
an agent to inspect it before local admission. It demonstrates the AutoVault
review path for third-party skills without turning the public examples page into
a marketplace.

## Workflow

1. Confirm the source label, source URL, and expected provider name.
2. Read the complete `SKILL.md` before suggesting install.
3. Check that the skill declares its tools, filesystem access, network access,
   and any required setup steps.
4. Compare the local copy against the provider source or checksum if one is
   available.
5. Run the AutoVault gate and report whether the skill is ready for local
   admission, needs edits, or should be rejected.

## Expected Outcome

The user gets a clear provenance note, a local gate result, and a command they
can run themselves:

```bash
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
curl -fsSL https://example.com/trusted-provider/SKILL.md -o "$tmpdir/SKILL.md"
autovault add-local "$tmpdir" --source trusted-provider/example --sync-profiles
```

Do not install or execute any provider-supplied scripts until the user has
reviewed the declared capability surface.
