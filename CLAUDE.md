# CLAUDE.md

## Project Overview

`autovault-website` is the public marketing site, docs, and the **paid hosted
vault portal** for AutoVault. It is the surface where users sign up, pay,
and operate a cloud-managed AutoVault namespace that the local AutoVault
CLI syncs against.

Single repo, multiple surfaces:
- **Docs/marketing site** (VitePress) — `index.md`, `cloud.md`, `compare.md`,
  the `/skill/*` catalog pages, theme components in `.vitepress/theme/`.
- **Hosted vault portal** (Vue components inside VitePress) —
  `CloudPage.vue`, `LandingPage.vue`, etc.
- **Backend API** (Cloudflare Pages Functions) — `functions/api/*.js`.
- **Storage** — Cloudflare D1 (`AUTOVAULT_DB`) +
  KV (`AUTOVAULT_VAULT_OBJECTS`).
- **Auth** — Clerk (`@clerk/backend`, `@clerk/vue`) with legacy GitHub/Google
  OAuth fallback handlers still present.
- **Billing** — Stripe Checkout + Customer Portal + subscription webhooks
  (test mode unless production secrets land).

`AGENTS.md` mirrors this file for non-Claude agents.

## Key Commands

```bash
npm ci                                  # install
npm run dev                             # vitepress dev — http://localhost:5173
npm run docs:build                      # static build → .vitepress/dist
npm run docs:preview                    # preview built site

npm test                                # vitest run (one-shot, 55 tests/11 files)
npm run typecheck                       # vue-tsc --noEmit
npm run pages:functions:build           # compile Cloudflare Functions
npm run ci                              # full local check (typecheck + test + functions + docs)

npx wrangler pages deploy .vitepress/dist --project-name autovault-website
npx wrangler d1 migrations apply autovault-hosted --local   # local D1
npx wrangler pages dev .vitepress/dist                       # local end-to-end
```

`npm run ci` is the gate before opening a PR.

## Architecture

| Layer | Path | Notes |
|---|---|---|
| Docs site | `index.md`, `cloud.md`, `*.md` at root | VitePress treats root `.md` as pages; non-page files must be in `srcExclude` |
| Theme | `.vitepress/theme/` | Vue components, Clerk wiring in `theme/clerk.ts` |
| Shared modules | `.vitepress/shared/` | `pageDocs.ts`, `deploy.ts`, `bootstrap.ts` |
| Build hooks | `.vitepress/build/agentArtifacts.ts` | Generates agent-readable artifacts at build time |
| API | `functions/api/` | Pages Functions — Clerk auth, Stripe checkout, vault provisioning |
| API lib | `functions/api/_lib/` | `auth.js`, `db.js`, `stripe.js`, `vault.js`, `crypto.js`, `http.js` |
| Middleware | `functions/_middleware.js` | Handles `autovault.sh` installer host redirect |
| Schema | `migrations/0001_hosted_vault.sql` | users, sessions, oauth_states, customers, subscriptions, vaults |
| Skill catalog content | `skill/` (rendered) + `public/skills/` (assets) | Static catalog pages |
| Tests | `tests/*.test.ts` | Vitest, no browser yet |

### Hosted vault data flow (current)

```
User → Clerk sign-in → /api/auth/start (legacy) OR Clerk frontend
     → /api/me (returns user + subscription + vault state)
     → /api/checkout/hosted-vault (creates Stripe Checkout session)
     → Stripe → /api/billing/webhook (writes customers + subscriptions to D1)
     → /api/vaults/provision (creates vault row; requires active subscription)
     → CloudPage.vue dashboard renders state from /api/me
```

Pending skill drafts: `/api/vaults/current/pending-skills` (POST only today;
GET/approve/reject not yet implemented).

## Conventions

1. **Pages Functions are ESM `.js`** (not TS). Use the existing `_lib/`
   helpers — `handleApi`, `json`, `ApiError`, `requireUser`. Don't reinvent.
2. **Tests are Vitest, repo-root config (`vitest.config.ts`).** Use the
   existing fixture style in `hostedVaultFunctions.test.ts`.
3. **D1 access goes through `_lib/db.js`** — `first()`, `run()`, `all()`.
   Don't drop raw `env.AUTOVAULT_DB.prepare()` in handlers.
4. **Schema changes are new migration files**, never edits to
   `0001_hosted_vault.sql` after it's shipped. Name them
   `0002_<topic>.sql`, etc.
5. **VitePress page files must be at repo root** OR explicitly registered
   in nav. New non-page Markdown (planning docs, agent briefs) goes under
   `.claude/` so it isn't crawled — VitePress skips dot-directories.
6. **PR gates**: `npm run ci` locally, then GitHub CI runs build-test,
   CodeQL, dependency audit, and deploys a preview. Required: build-test
   green + preview deployed.
7. **Don't merge PRs with `Lint PR Title` failures.** Title must follow
   conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
8. **No console.* in `functions/api/*.js`** — they emit to Cloudflare logs
   indiscriminately. Use `ApiError` + structured responses.
9. **Never commit secrets.** Clerk + Stripe keys live in Cloudflare Pages
   env vars (set via the dashboard or `wrangler pages secret put`).
10. **Stripe is test-mode by default.** Live keys gated by a deliberate
    flip; no autonomous agent should set `STRIPE_SECRET_KEY=sk_live_*`.

## Environment / Secrets

Configured in Cloudflare Pages project settings (not `.env`):

- `CLERK_SECRET_KEY` (runtime), `VITE_CLERK_PUBLISHABLE_KEY` (build),
  `VITE_CLERK_PREVIEW_PUBLISHABLE_KEY`, `VITE_CLERK_PRODUCTION_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AUTOVAULT_HOSTED_PRICE_ID`
- D1 binding `AUTOVAULT_DB` (id in `wrangler.toml`)
- KV binding `AUTOVAULT_VAULT_OBJECTS` (id in `wrangler.toml`)
- `PIRSCH_DATA_CODE` (analytics, optional)
- `AUTOVAULT_INSTALLER_URL` (overrides the installer redirect target)

## Active feature work

See `.claude/FEATURE-PLAN.md` for the hosted-portal punch list and worktree
split. See `.claude/KICKOFF.md` for the orchestrated-build entry prompt.

## Don't / Hard rules

- Don't touch `migrations/0001_hosted_vault.sql` — add new migrations.
- Don't auto-merge PRs. Stop at green review for human merge (the user's
  validated `parallel-task-batch` contract).
- Don't autonomously edit `wrangler.toml` `[vars]` or secrets bindings.
- Don't add new top-level VitePress pages without adding to nav.
- Don't introduce `console.log` in functions. Use the error response
  helpers.
- Don't widen Clerk publishable-key handling — preview vs production keys
  are intentionally separate.
