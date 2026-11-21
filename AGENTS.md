# AGENTS.md

This file provides guidance to Codex and other non-Claude agents working
in this repository. Claude Code reads `CLAUDE.md` instead; the two files
should stay in sync.

The full project context, commands, architecture map, and conventions
live in [`CLAUDE.md`](./CLAUDE.md) — read that first.

## Codex-specific notes

For PR creation, hosted review, CI, and merge readiness, use the installed `babysit` skill (`~/.autovault/skills/babysit/SKILL.md`) as the canonical procedure.

- Local validation: `npm run ci` (details and PR title conventions in `CLAUDE.md`).
- Verify UI changes against the Cloudflare Pages PR preview linked from the PR checks.
- D1 schema is migration-based; never edit a migration that has already been
  applied. New schema goes in the next numbered `migrations/*.sql`.
- Migrations are NOT applied by CI. Run `npm run migrate:remote` before
  deploying anything that depends on a new migration.
- VitePress globs every `.md` in the repo as a page. Non-public Markdown must
  be listed in `srcExclude` in `.vitepress/config.ts`.

## Operating scope

Jack's standing instruction (2026-08-22): do as much of the work as possible
directly — in Clerk, Stripe, the live site, and the Cloudflare CLI — rather
than handing back instructions. `wrangler`, `stripe`, `clerk` and `gh` are all
installed and authenticated.

No permission needed for: `wrangler.toml` (including `[vars]` and bindings),
Cloudflare Pages config/deploys/DNS/D1/KV/secrets, Clerk instance
configuration, Stripe **test-mode** work, remote D1 migrations, and production
deploys. Live-mode Stripe writes move real money — say what you're doing
before the first one in a session.

Still exercise judgment on hard-to-undo actions (dropping a populated table,
deleting live DNS, rotating an in-use secret): say what's about to happen,
then do it.

Two things the broadening did *not* cover: don't commit secrets, and don't
auto-merge PRs (stop at green review for human merge).

## Active feature work

The hosted-vault sync loop — a signed catalog API plus device enrollment —
is the current build. The client half of that contract already ships in
`autoworks-ai/autovault` (`src/sync/contract.ts`, `src/sync/local.ts`); the
server must match it rather than invent a parallel schema.
