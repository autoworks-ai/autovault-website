# Documentation Drift Update Instructions

You are updating the AutoVault website (VitePress + custom Vue components) to
reflect source-code changes from `autoworks-ai/autovault`.

## Task

1. Read the changed source files in `.source-repo/`.
2. Read the affected website pages/components in this repository.
3. Update only sections made inaccurate by the source change.
4. Preserve existing copy, layout, tone, components, and visual structure when still accurate.
5. Run `npm run typecheck`, `npm test`, and `npm run docs:build`.

## Rules

- Make surgical updates, not rewrites.
- Do not update decorative/demo statistics unless source changes directly prove they are stale.
- Keep installation commands aligned with `scripts/install.sh` in the source repo.
- Keep `autovault.sh` as the curl installer endpoint and `autovault.dev` as the production website.
- If the source change does not require website updates, leave files unchanged and report that no drift was found.
- Use commit message format: `docs: update [page-names] for autovault@[short-sha]`.
