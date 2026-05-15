# AutoVault Website

This repository contains the public documentation site for AutoVault.

- Website: [autovault.dev](https://autovault.dev)
- Installer: [autovault.sh](https://autovault.sh)
- npm: [`@autoworks-ai/autovault`](https://www.npmjs.com/package/@autoworks-ai/autovault)
- Source: [autoworks-ai/autovault](https://github.com/autoworks-ai/autovault)
- Security policy: [Security policy](https://github.com/autoworks-ai/autovault/security/policy)
- Current source release: [v0.3.0](https://github.com/autoworks-ai/autovault/releases/tag/v0.3.0)

AutoVault is a local-first vault for agent skills. The website is built with VitePress and documents the verified install paths: the published npm package, the shell installer, the Homebrew tap, and the GHCR container image.

## Development

```bash
npm ci
npm run dev
```

Run the full local check before publishing changes:

```bash
npm run ci
```

## Public Launch Notes

- The npm package `@autoworks-ai/autovault` is now published; show `npm install -g @autoworks-ai/autovault` alongside the installer script and Homebrew tap as first-class install paths (Node 24+ required).
- Keep deployment docs to verified Docker and Railway paths unless another host has been tested end to end.
- Treat `v0.3.0` as the current public release until release-please publishes a newer release from the source repository.
