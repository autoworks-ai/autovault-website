# AutoVault Cloud: capability truth table

Internal reference. `docs/**` is in `srcExclude`, so this never builds as a
page.

Every cloud claim written on the site must cite a row here. A copy block
that cannot cite a row does not ship.

Verified against the route files at `feat/cloud-docs-rewrite`, not against
CLAUDE.md. CLAUDE.md is stale on two counts: it lists migrations 0001-0005
when `0006_device_pairings.sql` exists, and its hosted-vault data flow names
`/api/auth/start`, which is not in the tree.

## Status

| Capability | Routes | Status |
|---|---|---|
| Clerk auth and session validation | `GET /api/me` | SHIPPED |
| Live price display | `GET /api/pricing` (public, read from Stripe) | SHIPPED |
| Subscribe | `POST /api/checkout/hosted-vault` | SHIPPED |
| Billing portal | `POST /api/billing/portal` | SHIPPED |
| Subscription webhook, dedupe, ordering | `POST /api/billing/webhook` | SHIPPED |
| Post-checkout reconcile fallback | `POST /api/billing/reconcile` | SHIPPED |
| Namespace availability check | `GET /api/vaults/availability` | SHIPPED |
| Namespace reservation | `POST /api/vaults/provision` | SHIPPED |
| Pairing by code (RFC 8628 shape) | `POST /api/devices/pair`, `POST /api/devices/token`, `GET\|POST /api/devices/pairings/<user_code>` | SHIPPED |
| Device enrollment by slug | `POST /v/<slug>/devices` | SHIPPED |
| Device self-check | `GET /v/<slug>/devices/current` | SHIPPED |
| Owner console: list, admit, revoke | `GET /api/vaults/current/devices`, `POST /api/vaults/current/devices/<id>` | SHIPPED |
| Signed catalog delivery | `GET /v/<slug>/catalog.json` | SHIPPED |
| Signed bundle delivery | `GET /v/<slug>/bundles/<hash>.json` | SHIPPED |
| Catalog publishing | none | **NOT IMPLEMENTED** |
| Pending-skill review | `POST /api/vaults/current/pending-skills` only | **PARTIAL, write-only** |
| Vault rename, delete, or a second vault | none | NOT IMPLEMENTED |
| Seats, roles, invitations | none | NOT IMPLEMENTED |
| Free tier or configured trial | none | NOT IMPLEMENTED |
| Rate limiting | none | NOT IMPLEMENTED |
| Signing-key rotation | none | NOT IMPLEMENTED |

## The five constraints copy must respect

**1. There is no publish path.** `AUTOVAULT_VAULT_OBJECTS.put()` appears
exactly once in `functions/`, at `functions/api/_lib/vault.js:327`, and it
writes a pending-skill draft to `vaults/<vault_id>/pending/<id>.md`. The
catalog and bundle keys are only ever read. Signed objects reach KV by hand,
with `wrangler kv key put`, from the owner machine that holds the release
signing key. Cloud never holds a secret key. Never imply a customer can push
skills to their vault.

**2. A new vault serves nothing.** `GET /v/<slug>/catalog.json` returns 404
"This vault has no published catalog yet" until an operator seeds KV. A paid,
provisioned, device-linked vault is empty. Explain this state; do not present
it as an error the customer caused.

**3. Pending skills is write-only.** A draft can be POSTed. Nothing lists,
approves, rejects, or promotes it, and nothing reads the table back. Do not
document a review queue.

**4. Key rotation hard-fails.** `catalog.public_key` is pinned by the client
at enrollment, so rotating it breaks every enrolled device. Document it; do
not swap keys quietly.

**5. `vault.autovault.dev/<slug>` is a display string.** Nothing routes or
serves that host. The real sync surface is `autovault.dev/v/<slug>/`. Do not
print the pretty URL as though it resolves.

## Wire details that are safe to document

- Signed message is `"<METHOD>\n<pathname>\n<unix-seconds>"`, verified against
  `new URL(request.url).pathname`.
- Headers: `X-AutoVault-Device` (base64url Ed25519 public key),
  `X-AutoVault-Timestamp` (whole seconds), `X-AutoVault-Signature`.
- Clock skew window is 300 seconds either side.
- Device fingerprint is `first4…last4` of the base64url key. The console never
  renders a full public key.
- User codes are `XXXX-XXXX` over a 20-letter alphabet with no vowels, so no
  code spells a word.
- Pairing TTL is 900 seconds; the CLI polls every 5 seconds.
- A device may read the catalog while `pending` or `active`. Bundles require
  `active` plus a live subscription.
- Catalog and bundle bodies are served byte for byte from KV. Re-serialising
  breaks every release signature.
- Nothing under `/v/` may redirect. The CLI fetches with `redirect: "manual"`.

## CLI facts

- Package is `@autoworks-ai/autovault`, currently v0.5.0.
- `autovault link` with no argument starts Cloud pairing and prints a user
  code. `autovault init` is an alias.
- **`autovault sync` does not exist.** `autovault sync-profiles` is unrelated:
  it symlinks vault skills into local agent skill directories.

## Public posture

`/cloud` is a public, indexed page as of the 2026-08-28 flip. Five switches
moved together and they belong together:

- `pageDocs.ts` cloud entry no longer sets `listed: false`. That single flag
  also controlled the `noindex,nofollow` splice in `config.ts:pageHead`, so
  dropping it both publishes `/agents/cloud` into `llms.txt` and the agents
  index and stops the robots tag.
- `isHiddenSitemapItem` narrowed from everything under `/cloud` to
  `/cloud/pair` only.
- `cloud.md` dropped `search: false`.
- `AvTopbar` moved Cloud out of the signed-in-only push and into
  `navItems`.
- `DocsShell` added Cloud to the Reference sidebar group.

`/cloud/pair` stays out. It is the device-confirmation endpoint the CLI sends
an owner to, addressed by a one-time code, and it has no `pageDocs` entry, so
`transformHead` never runs for it and never emitted a robots tag. It now
carries `noindex,nofollow` in its own frontmatter, plus `search: false` and
the narrowed sitemap filter.

The publishing gap did not close with this flip. Every public page still has
to state it: pairing and signed pulls work, and getting a signed catalog into
a hosted vault is hands-on per customer.

## Trial and pricing

`AUTOVAULT_HOSTED_TRIAL_DAYS` in `wrangler.toml` is the only place the trial is
configured. Three consumers read it and none of them holds a copy:

- `hostedTrialDays(env)` in `functions/api/_lib/stripe.js` parses it. Whole
  digits only, clamped to Stripe's 730 ceiling, and anything else reads as 0.
- `buildHostedVaultCheckoutParams` sends `subscription_data[trial_period_days]`
  when it is above 0, and sends nothing at all when it is 0. Stripe rejects
  `trial_period_days=0`, so absent is the only correct way to say "no trial".
- `GET /api/pricing` returns it as `trial_days`, which is what `/cloud` renders
  every trial line from. A page cannot advertise a trial Checkout is not
  configured to grant.

Build-time surfaces have no runtime, so agent markdown, `AvTeamMode.vue` and
`HostedSyncPage.vue` print `HOSTED_TRIAL_DAYS` from
`.vitepress/theme/data/product.ts`. `tests/hostedTrial.test.ts` pins that
constant to the toml, and separately forbids the number appearing anywhere in
those files outside an interpolation.

Verified against Stripe test mode on 2026-08-28: a session built with the trial
returns `amount_total: 0`; the same session without it returns `1500`.
`payment_method_collection` is already `if_required`, so no card is collected
while a trial runs. Live mode is untouched.

| Capability | Status |
|---|---|
| $15/mo hosted plan, price read from Stripe at `/api/pricing` | SHIPPED |
| 14 day trial, no card, `status=trialing` treated as paid | SHIPPED (test mode) |
| Promotion codes on Checkout | SHIPPED |
| Seats, roles, invites, per-seat pricing, annual billing | NOT IMPLEMENTED |

## The protocol, and where self-hosting stops

`autovault link` accepts three argument shapes and resolves them in
`src/sync/target.ts`: a URL becomes an `https` upstream, a path becomes a
`file` upstream, and a bare lowercase word is expanded to a Cloud slug. A vault
holds a list of upstreams and both kinds run identical release verification.

So **consuming** a catalog is transport-agnostic and fully shipped. Any static
host works, and so does a directory.

**Producing one is not shipped anywhere.** `signSyncRelease` is exported from
`src/sync/contract.ts` and imported by exactly one file, `src/sync/testing.ts`.
No CLI command reaches it: the usage block lists add, add-local, remove,
sync-profiles, profiles, setup, doctor, audit-repo, import-autohub, link,
resolve, serve, ui, update, version and skill, and none of them signs.

Copy must therefore not present self-hosting as the way around the publishing
gap. The gap does not close when you leave Cloud; it moves with you.
