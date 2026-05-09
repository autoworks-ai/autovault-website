# AutoVault Website

This repository contains the public documentation site for AutoVault.

- Website: [autovault.dev](https://autovault.dev)
- Installer: [autovault.sh](https://autovault.sh)
- Source: [autoworks-ai/autovault](https://github.com/autoworks-ai/autovault)
- Security policy: [Security policy](https://github.com/autoworks-ai/autovault/security/policy)
- Current source release: [v0.2.1](https://github.com/autoworks-ai/autovault/releases/tag/v0.2.1)

AutoVault is a local-first vault for agent skills. The website is built with VitePress and is intentionally focused on the current verified install paths: the shell installer and the GHCR container image.

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

- Do not advertise npm install commands until the package is published.
- Keep deployment docs to verified Docker and Railway paths unless another host has been tested end to end.
- Treat `v0.2.1` as the current public release until release-please publishes a newer release from the source repository.
