import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("Clerk production deployment configuration", () => {
  it("splits preview and production publishable keys in CI", () => {
    const workflow = read(".github/workflows/ci.yml");

    expect(workflow).toContain("VITE_CLERK_PREVIEW_PUBLISHABLE_KEY");
    expect(workflow).toContain("VITE_CLERK_PRODUCTION_PUBLISHABLE_KEY");
    expect(workflow).toContain("CLERK_DEPLOY_TARGET=preview");
    expect(workflow).toContain("CLERK_DEPLOY_TARGET=production");
    expect(workflow).toContain("scripts/verify-clerk-production-key.mjs");
  });

  it("requires the production Clerk key for manual deploys", () => {
    const workflow = read(".github/workflows/deploy.yml");

    expect(workflow).toContain("VITE_CLERK_PRODUCTION_PUBLISHABLE_KEY");
    expect(workflow).not.toContain("vars.VITE_CLERK_PUBLISHABLE_KEY || secrets.VITE_CLERK_PUBLISHABLE_KEY");
    expect(workflow).toContain("CLERK_DEPLOY_TARGET: production");
    expect(workflow).toContain("scripts/verify-clerk-production-key.mjs production");
  });

  it("rejects development Clerk hosts from production builds", () => {
    const testKey = publishableKey("test", "arriving-yak-2.clerk.accounts.dev");
    const result = verifyKey("production", testKey);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Production Clerk deploys require a pk_live_ publishable key");
  });

  it("rejects pk_live keys that still target accounts.dev in production", () => {
    const devHostLiveKey = publishableKey("live", "arriving-yak-2.clerk.accounts.dev");
    const result = verifyKey("production", devHostLiveKey);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("accounts.dev");
  });

  it("allows live production keys and test preview keys", () => {
    expect(verifyKey("production", publishableKey("live", "autovault.clerk.accounts.com")).status).toBe(0);
    expect(verifyKey("preview", publishableKey("test", "arriving-yak-2.clerk.accounts.dev")).status).toBe(0);
  });

  it("scans production artifacts for development Clerk keys", () => {
    const distDir = mkdtempSync(resolve(tmpdir(), "autovault-clerk-dist-"));

    try {
      writeFileSync(resolve(distDir, "theme.js"), `window.__clerk="${publishableKey("test", "arriving-yak-2.clerk.accounts.dev")}"; fetch("https://arriving-yak-2.clerk.accounts.dev")`);

      const result = spawnSync(process.execPath, [
        resolve(repoRoot, "scripts/scan-clerk-production-dist.mjs"),
        distDir
      ], {
        cwd: repoRoot,
        encoding: "utf8"
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("development Clerk marker");
    } finally {
      rmSync(distDir, { recursive: true, force: true });
    }
  });

  it("centralizes Clerk brand configuration for plugin, modal, and account UI", () => {
    const theme = read(".vitepress/theme/index.ts");
    const controls = read(".vitepress/theme/components/ClerkAuthControls.vue");

    expect(theme).toContain("./clerk");
    expect(theme).toContain("clerkPluginOptions");
    expect(controls).toContain("clerkSignInAppearance");
    expect(controls).toContain("clerkUserProfileProps");
    expect(controls).toContain("UserButton.MenuItems");
    expect(controls).toContain("UserButton.Action label=\"manageAccount\"");
    expect(controls).toContain("UserButton.Link");
    expect(controls).toContain("UserButton.UserProfilePage");
    expect(controls).toContain("Cloud namespace");
    expect(controls).toContain("Support");
  });
});

function read(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function verifyKey(target: string, key: string) {
  return spawnSync(process.execPath, [
    resolve(repoRoot, "scripts/verify-clerk-production-key.mjs"),
    target
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      VITE_CLERK_PUBLISHABLE_KEY: key
    }
  });
}

function publishableKey(mode: "live" | "test", frontendApi: string) {
  const encoded = Buffer.from(`${frontendApi}$`, "utf8").toString("base64url");
  return `pk_${mode}_${encoded}`;
}
