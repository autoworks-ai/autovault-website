# Progressive Hosted-Vault Dashboard — Design

**Date:** 2026-05-29
**Status:** Approved (visual brainstorm), in build
**Surface:** `/cloud` (CloudPage.vue) — the post-checkout hosted-vault dashboard

## Context

The hosted-vault dashboard today renders everything at once: status pills, a
re-embedded sign-up funnel, a starter-skills grid, and explainer asides. Recent
commits (`drop the duplicate CLI handoff panel`, `hide the pre-vault scaffolding
once the namespace is reserved`) show the post-vault state was cobbled from
pre-vault pieces and feels busy. Meanwhile the only genuinely valuable action a
paying user can take today is **connecting their local CLI to the reserved
namespace** — hosted sync is still "coming soon."

We are also about to wire in a *preview* of the real vault-management app, with
an **early-access waitlist** so paying users register interest with minimal
build effort.

## Decisions (from brainstorm)

- **Layout:** Direction B — "Product Shell." Persistent left nav; future
  sections (Skills, Sync log, Members) present but locked. The dashboard is a
  v0 of the real app, so locked items light up later with zero layout churn.
- **Progressive disclosure:** the page opens calm — one focal action — and
  reveals sections as the user advances. Never show more than the one thing that
  matters right now. Leans on the existing lock→unlock vault metaphor.
- **App preview intent:** realistic but non-functional "coming soon" mock of the
  vault-management app + early-access CTA. Minimal real wiring.
- **Waitlist mechanics:** flag interest in D1 against the existing vault row
  (`early_access_at` timestamp). User is already authenticated; no email capture.
- **Visual direction:** bolder, app-like rethink within the existing color
  tokens (dark theme, `--accent` cyan, Inter/JetBrains Mono). No new fonts —
  consistency with the marketing site matters more than novelty here.

## Progressive stages (post-vault)

Driven entirely by two nullable timestamps on the vault row, so the correct
stage renders on every visit (including hard refresh), not just session state.

| Stage | Condition | Main content |
|---|---|---|
| **A — Connect** | vault, `!cli_linked_at` | Hero (namespace reserved) + focal "Connect your local CLI" card with commands + "I've linked my CLI ✓". Step 1 of 2 rail. Minimal else. |
| **B — Explore** | `cli_linked_at`, `!early_access_at` | CLI card collapses to "✓ CLI linked". Reveal (slide-in): what's reserved, sync-engine status, app preview + "Get early access". Billing nav unlocks. |
| **C — All set** | `early_access_at` | Calm resting dashboard: "All set" line, vault summary, "✓ on the early-access list" confirmation. Settings nav appears. |

Pre-vault (anonymous → signed-in → paid → reserve) keeps the existing
`HostedVaultFunnel`, presented calmly inside the same shell.

"I've linked my CLI" is a **self-attested** click (no real CLI detection yet) —
honest and simple; the provision/sync API can auto-detect later.

## Architecture

### Backend
- **`migrations/0002_vault_progress.sql`** — `alter table vaults add column
  cli_linked_at text` + `early_access_at text` (both nullable).
- **`_lib/vault.js`** — `getCurrentVault` select includes the two columns;
  new idempotent `markVaultProgress(env, user, step)` (step ∈
  `cli_linked` | `early_access`) that only sets a timestamp if currently null,
  returns the updated vault.
- **`functions/api/vaults/current/progress.js`** (POST) — requires user +
  active subscription + existing vault; validates `step`; returns `{ vault }`.
- **`/api/me`** auto-carries the new fields once the select includes them.

### Frontend
- **`CloudPage.vue`** rewritten as app shell (sidebar + main) with the stage
  machine above. Scoped `<style>` block (isolation; avoids bloating the shared
  13k-line styles.css and avoids touching marketing classes co-defined with
  `.about-*`). New `cv-*` class namespace.
- TS types updated: `CloudVault` (CloudPage) and `MeResponse.vault` (funnel)
  gain `cli_linked_at?`, `early_access_at?`.

### Tests
- Extend `tests/hostedVaultApi.test.ts` fake env to handle `update vaults`;
  cover mark-cli-linked, mark-early-access, idempotency, requires-vault.

## Verification bar
- `npm run ci` green (typecheck + test + functions build + docs build).
- Full local E2E on the new build: register (fresh `+clerk_test@`, code 424242)
  → Stripe test checkout (`4242…`) → provision → Stage A → click "linked" →
  Stage B → click "early access" → Stage C.
- **Hard refresh at each post-vault stage** renders the correct stage from D1
  (proves persistence, not just optimistic in-memory transitions).

## Non-goals
- Real hosted sync / real CLI link detection.
- Functional Skills/Sync/Members sections (locked previews only).
- Email capture for the waitlist (auth identity already on file).
