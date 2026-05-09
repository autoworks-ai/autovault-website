---
name: autovault-bootstrap
version: 0.1.0
description: "Audit, install, verify, and sync AutoVault for the current agent profile."
license: MIT
disable-model-invocation: true
allowed-tools:
  - "Bash(uname:*)"
  - "Bash(command -v autovault:*)"
  - "Bash(mktemp:*)"
  - "Bash(curl -fsSL https://raw.githubusercontent.com/autoworks-ai/autovault/main/scripts/install.sh -o *)"
  - "Bash(wc -c *)"
  - "Bash(sed -n *)"
  - "Bash(sh *)"
  - "Bash(autovault doctor:*)"
  - "Bash(autovault sync-profiles --discover:*)"
  - Read
  - Write
tools_required:
  - http.fetch
  - shell.run
  - fs.read
  - fs.write
transformations:
  claude-code:
    http.fetch: WebFetch
    shell.run: Bash
    fs.read: Read
    fs.write: Write
  codex:
    http.fetch: web
    shell.run: exec_command
    fs.read: exec_command
    fs.write: apply_patch
permissions:
  network: true
  egress:
    - https://raw.githubusercontent.com/autoworks-ai/autovault/main/scripts/install.sh
    - https://autovault.dev
    - https://autovault.sh
  fs_scope:
    - "$TMPDIR/autovault-*"
    - "~/.claude/skills/autovault-bootstrap"
    - "~/.autovault"
agents:
  - claude-code
  - codex
---

# AutoVault Bootstrap

Use this skill when the user asks to install, configure, repair, or verify AutoVault for the current agent environment.

## Safety Rules

- Do not execute the installer until the user explicitly approves the reviewed script.
- Do not stream a network response directly into a shell.
- Keep every downloaded installer in a temporary file so the user can inspect it.
- If a command needs broader shell, filesystem, or network access than this skill declares, stop and ask for approval with the exact command.
- Never print secrets, tokens, private keys, or full environment dumps.

## Workflow

1. Detect the host and current state:

   ```bash
   uname -a
   command -v autovault
   ```

2. If `autovault` already exists, run verification first:

   ```bash
   autovault doctor
   autovault sync-profiles --discover
   ```

   Report the result and stop unless verification fails.

3. If AutoVault is missing, stage the installer for review:

   ```bash
   tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/autovault-installer.XXXXXX")"
   installer="$tmpdir/install.sh"
   curl -fsSL https://raw.githubusercontent.com/autoworks-ai/autovault/main/scripts/install.sh -o "$installer"
   wc -c "$installer"
   sed -n '1,160p' "$installer"
   ```

4. Summarize what the staged script appears to do. Include install location, profile changes, network calls, and any commands that modify the filesystem.

5. Ask the user for explicit approval before running:

   ```bash
   sh "$installer"
   ```

6. After an approved install, verify and sync:

   ```bash
   autovault doctor
   autovault sync-profiles --discover
   ```

7. If anything fails, explain the blocked step, likely permission or network cause, and the exact command the user can run manually.

## Expected Outcome

The current machine should have a working `autovault` command, a healthy `~/.autovault` folder, and discovered agent profiles refreshed through AutoVault.
