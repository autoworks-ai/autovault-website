#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const renderer = resolve(
  homedir(),
  ".autovault/skills/html-asset-renderer/scripts/render-html-assets.mjs",
);

try {
  await access(renderer);
} catch {
  process.stderr.write(
    `html-asset-renderer not found at ${renderer}\nInstall or sync the skill, then retry.\n`,
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [
    renderer,
    resolve(repoRoot, "scripts/social-assets/source"),
    resolve(repoRoot, "public"),
    "--manifest",
    resolve(repoRoot, "scripts/social-assets/clerk-logo.manifest.json"),
    "--dpr",
    "2",
    "--timeout",
    "20000",
  ],
  { stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
