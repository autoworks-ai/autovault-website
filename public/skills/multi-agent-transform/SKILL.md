---
name: multi-agent-transform
version: 0.1.0
description: Demonstrate a single canonical skill rendered into Claude Code, Codex, and AutoJack tool vocabularies.
license: MIT
tags: [transforms, multi-agent, autovault, demo]
agents: [claude-code, codex, autojack]
category: transforms
tools_required: [fs.read, fs.write, shell.run]
transformations:
  claude-code:
    fs.read: Read
    fs.write: Edit
    shell.run: Bash
  codex:
    fs.read: exec_command
    fs.write: apply_patch
    shell.run: exec_command
  autojack:
    fs.read: file.read
    fs.write: file.patch
    shell.run: shell.exec
capabilities:
  network: false
  filesystem: readwrite
  tools: [fs.read, fs.write, shell.run]
---

# Multi-Agent Transform

Use this skill when a user wants to understand how AutoVault keeps one canonical
skill source while delivering agent-specific tool names and permissions.

## Workflow

1. Start from the canonical `tools_required` list.
2. Select the current agent from `agents`.
3. Render the transformation map for that target agent.
4. Refuse to run if the current agent has no transform for a required tool.
5. Report the canonical tool name and rendered tool name before making edits.

## Expected Outcome

The same reviewed skill can be scoped to multiple agents without hand-maintained
copies drifting apart.
