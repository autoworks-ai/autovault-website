---
name: secret-safe-setup
version: 0.1.0
description: Guide a user through secret-safe setup where credentials stay in host secret stores, not in SKILL.md.
license: MIT
tags: [secrets, setup, keychain, autovault]
agents: [claude-code, codex]
category: setup
tools_required: [Read, Bash]
capabilities:
  network: false
  filesystem: readonly
  tools: [Read, Bash]
requires-secrets:
  - name: PROVIDER_PROFILE
    description: Host-managed profile name for the provider CLI or keychain item.
    required: true
bin:
  setup:
    command: bin/setup
    description: Configure the host secret reference in an interactive terminal.
    requires-tty: true
  verify:
    command: bin/verify
    description: Confirm the host can access the named provider profile.
    requires-tty: true
---

# Secret-Safe Setup

Use this skill when a workflow needs credentials but the user wants the agent to
avoid seeing or storing secret values.

## Workflow

1. Explain that AutoVault stores skill instructions and metadata, not secret
   values.
2. Ask the user to create credentials in Keychain, 1Password, ssh-agent, a
   provider CLI, or the deployment platform secret manager.
3. Reference only the profile or key name in the skill metadata.
4. Ask the user to run `autovault skill setup secret-safe-setup` in their own
   terminal for interactive configuration.
5. Verify only that the named profile exists; never print the credential value.

## Expected Outcome

The skill documents the required credential shape and setup commands while the
actual secret remains outside the vault and outside the agent transcript.
