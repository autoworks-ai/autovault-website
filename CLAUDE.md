# CLAUDE.md — autovault-website

## Project

AutoVault website — VitePress (Vue 3) documentation site deployed to Cloudflare Pages. Uses Clerk for authentication. The live site lives at autovault.autoworks.ai (or similar).

**Stack:** VitePress 1.x · `@clerk/vue` v2 · Cloudflare Pages + Workers (via `functions/`) · Wrangler 4 · Vitest

## Key Commands

```bash
npm run dev            # VitePress dev server (port 5173)
npm run docs:build     # Production build → .vitepress/dist/
npm run deploy:pages   # Build + deploy to Cloudflare Pages
npm run test           # Vitest unit tests
npm run typecheck      # vue-tsc
npm run ci             # Full pre-deploy gate: typecheck + test + functions:build + docs:build
```

## Clerk Integration

This project uses `@clerk/vue` v2 (current SDK — NOT Core 2). Initialize in `.vitepress/theme/index.ts`:

```ts
import { clerkPlugin } from '@clerk/vue'
import DefaultTheme from 'vitepress/theme'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(clerkPlugin, { publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY })
  },
}
```

### API Keys

- **Dev:** `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
- **Production (Cloudflare Pages env vars):** `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`

> Using `pk_test_` in production shows a "Development Mode" banner — always use `pk_live_` keys in the Cloudflare Pages production environment.

### Webhook Verification

Webhook handlers live in `functions/`. Use `@clerk/backend` (already a dependency) with `verifyWebhook`.

## Available Clerk Skills

These skills are scoped to this project via `.claude/skills/`:

| Skill | When to invoke |
|-------|----------------|
| `/clerk` | Auth router — start here for any Clerk question |
| `/clerk-setup` | Installing or re-configuring Clerk in a new framework context |
| `/clerk-vue-patterns` | Vue composables, router guards, Pinia auth store |
| `/clerk-custom-ui` | Custom sign-in/up flows, appearance theming, branding |
| `/clerk-webhooks` | Webhook handlers, user sync, event-driven integrations |

Also globally available (not project-scoped but relevant):
- `/clerk-cloudflare-auth` — Clerk + Cloudflare middleware patterns
- `/cloudflare-ops` — Cloudflare Pages deploy, D1, Workers

## Architecture

```
.vitepress/
  config.mts          # VitePress config + nav
  theme/
    index.ts          # Clerk plugin + theme composition
functions/            # Cloudflare Pages Functions (server-side)
  api/                # API routes (auth callbacks, webhooks)
scripts/              # Build-time scripts
tests/                # Vitest tests
```

## Environment Variables

```
VITE_CLERK_PUBLISHABLE_KEY   # Clerk publishable key (pk_live_ in prod)
CLERK_SECRET_KEY             # Server-side only (functions/)
CLERK_WEBHOOK_SIGNING_SECRET # For webhook verification
```
