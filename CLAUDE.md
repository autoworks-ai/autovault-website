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

npm test                                # vitest run (one-shot)
npm run typecheck                       # vue-tsc --noEmit
npm run pages:functions:build           # compile Cloudflare Functions
npm run ci                              # full local check (typecheck + test + functions + docs)

npx wrangler pages deploy .vitepress/dist --project-name autovault-website
```

`npm run ci` is the gate before opening a PR.

## Local hosted-vault flow (two terminals)

The funnel (Clerk → Stripe Checkout → vault provisioning → pending skills)
only runs end-to-end under `wrangler pages dev`. `npm run dev` (port 5173)
is fine for VitePress/CSS work but does **not** execute Pages Functions, so
`/api/*` 404s there. Use `http://127.0.0.1:8788/cloud` for E2E.

**One-time setup**

```bash
cp .dev.vars.example .dev.vars       # fill in Clerk + Stripe + price + session secret
npm run dev:bootstrap                # apply all pending D1 migrations to local D1
```

`.dev.vars` is gitignored; `.dev.vars.example` documents every required key.
Clerk keys can be pulled via `clerk env pull --file .dev.vars`.

**`STRIPE_SECRET_KEY` must come from the Stripe Dashboard** (Developers >
API keys > Secret key, test mode) — *not* from `stripe config --list`.
That CLI key is minted by `stripe login` and Stripe expires it 90 days
later, at which point checkout starts failing with "Expired API Key
provided: sk_test_***" and nothing points at the CLI as the cause. A
dashboard key does not expire.

`npm run dev:stripe` reads that same key and passes it to the Stripe CLI, so
one credential covers both the app and webhook forwarding and `stripe login`
is not required. It refuses to start on a live key. The webhook secret is
stable per Stripe account in test mode — rerun `stripe listen --print-secret`
if `.dev.vars` ever drifts.

**Per-session — two terminals**

```bash
# terminal A — Pages Functions + static site on :8788
npm run dev:pages

# terminal B — forward live Stripe events to the local webhook
npm run dev:stripe
```

For iteration on the funnel UI itself, leave `dev:pages` running and rebuild
in a third terminal — Wrangler picks the new bundle up without a restart, and
`--live-reload` reloads the browser for you:

```bash
npm run docs:build      # ~2s, no restart needed
```

There used to be a `dev:pages:live` script promising true hot reload. It was
removed because it silently lied: `wrangler pages dev --proxy 5173` is
ignored whenever `wrangler.toml` sets `pages_build_output_dir`, so Wrangler
served a stale `.vitepress/dist` while a VitePress dev server nobody proxied
to ran alongside it. Verified against wrangler 4.125: edit a string, and
:5173 shows it while :8788 still serves the previous build.

**`npm run dev` (port 5173) cannot run this funnel at all.** It is VitePress
only — no Pages Functions — so every `/api/*` call 404s and `/cloud` can
never leave the signed-out state. The page detects port 5173 and says so.

**Test-mode helpers**

- Clerk dev sign-ups skip real email by using `<anything>+clerk_test@<anything>`
  with verification code `424242`.
- Stripe Checkout accepts card `4242 4242 4242 4242` with any future expiry
  and any CVC.
- Reset local DB + KV state: `rm -rf .wrangler/state && npm run dev:bootstrap`.

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
| Schema | `migrations/*.sql` | `0001` users, sessions, customers, subscriptions, vaults, pending_skills; `0002` vault progress columns; `0003` stripe_events dedupe + drops oauth_states |
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
9. **Never commit secrets to git.** Keys live in Cloudflare Pages env vars
   (`wrangler pages secret put`), `.dev.vars`, or `.env.local` — all
   gitignored. Setting and rotating them is fine; committing them is not,
   because git history is permanent and this repo is public.
9b. **New Markdown is not automatically a page.** VitePress globs every `.md`
   in the repo. Anything not meant to be public must be in `srcExclude` in
   `.vitepress/config.ts` — `docs/**`, `README.md` and `public/**` are already
   listed, and `tests/publicSurface.test.ts` asserts it.
10. **Stripe test mode is the default working mode.** Test-mode work —
    products, prices, webhook endpoints, checkout configuration,
    `stripe listen`, `stripe trigger` — needs no permission. Live mode
    moves real money, so say what you're about to do before the first
    live-mode write in a session; after that, carry on.

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

The hosted-vault sync loop (signed catalog API + device enrollment) is the
current build. Background on the client-side contract this server must match
lives in `autoworks-ai/autovault` at `src/sync/contract.ts` and
`src/sync/local.ts`.

Migrations are NOT applied by CI. Run `npm run migrate:remote` before deploying
any change that depends on a new migration, or the Functions will 500 against
the old schema.

## Operating scope

Jack's standing instruction (2026-08-22): **do as much of the work as possible
directly — in Clerk, Stripe, the live site, and the Cloudflare CLI — rather
than handing back instructions to run.** All four CLIs are installed and
authenticated: `wrangler`, `stripe`, `clerk`, `gh`.

In scope, no permission needed:

- **`wrangler.toml`** — including `[vars]`, bindings, and routes.
- **Cloudflare** — Pages config and deploys, DNS records, D1 (`--remote`
  included), KV, secrets via `wrangler pages secret put`.
- **Clerk** — `clerk env pull`, instance and application configuration,
  redirect and allowed-origin settings, appearance.
- **Stripe test mode** — products, prices, webhook endpoints, checkout
  configuration, `stripe listen`, `stripe trigger`.
- **Remote D1 migrations** — `npm run migrate:remote`.
- **Production deploys** — CI on merge to `main` is the normal path;
  `npm run deploy:pages` for a break-glass deploy.

Judgment still applies to things that are hard to undo: dropping a populated
table, deleting DNS the live site depends on, the first live-mode Stripe
write, rotating a secret that is in active use. Say what is about to happen,
then do it. That is being a careful colleague, not asking for permission.

## Don't / Hard rules

- Don't commit secrets. Everything else about secrets is fair game.
- Don't edit `migrations/0001_hosted_vault.sql`, or any migration already
  applied to production — add a new numbered one. This is correctness, not
  permission: editing an applied migration desynchronizes environments.
- Don't auto-merge PRs. Stop at green review for human merge (Jack's
  validated `parallel-task-batch` contract). This one was *not* part of the
  2026-08-22 broadening — ask if you want it relaxed too.
- Don't add new top-level VitePress pages without adding to nav, and don't
  let non-public Markdown escape `srcExclude`.
- Don't introduce bare `console.log` in functions — it emits to Cloudflare
  logs indiscriminately. Structured logging through a deliberate sink
  (Analytics Engine, Tail Worker) is wanted; the API has none today.
- Don't collapse the Clerk preview and production publishable keys into one.
  They are intentionally separate and CI verifies it.
