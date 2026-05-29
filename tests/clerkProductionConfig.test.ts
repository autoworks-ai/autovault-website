import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
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

  it("scans the exact Pages deployment URL after production deploys", () => {
    const ciWorkflow = read(".github/workflows/ci.yml");
    const deployWorkflow = read(".github/workflows/deploy.yml");

    expect(ciWorkflow).toContain("id: production_deploy");
    expect(ciWorkflow).toContain("steps.production_deploy.outputs['deployment-url']");
    expect(deployWorkflow).toContain("id: pages_deploy");
    expect(deployWorkflow).toContain("steps.pages_deploy.outputs['deployment-url']");
    expect(ciWorkflow).not.toContain("scan-clerk-production-url.mjs https://autovault.dev/cloud --verify-fapi");
    expect(deployWorkflow).not.toContain("scan-clerk-production-url.mjs https://autovault.dev/cloud --verify-fapi");
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

  it("fails live scans when the production Clerk Frontend API host is unreachable", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/assets/theme.js") {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end(`window.__clerk="${publishableKey("live", "missing-clerk.invalid")}";`);
        return;
      }

      response.writeHead(200, { "content-type": "text/html" });
      response.end('<script type="module" src="/assets/theme.js"></script>');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const result = await runNode([
        resolve(repoRoot, "scripts/scan-clerk-production-url.mjs"),
        `http://127.0.0.1:${port}/cloud`,
        "--verify-fapi"
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Clerk Frontend API");
      expect(result.stderr).toContain("missing-clerk.invalid");
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
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

  it("renders an explicit Clerk load failure fallback instead of an empty auth action", () => {
    const controls = read(".vitepress/theme/components/ClerkAuthControls.vue");

    expect(controls).toContain("clerkFailed");
    expect(controls).toContain("AutoVault auth is unavailable");
    expect(controls).toContain("window.addEventListener(\"error\"");
  });

  it("uses Clerk Vue reactive auth state for cloud API requests", () => {
    const helperPath = ".vitepress/theme/utils/clerkApi.ts";
    const helperAbs = resolve(repoRoot, helperPath);

    expect(existsSync(helperAbs)).toBe(true);
    const helper = read(helperPath);
    const funnel = read(".vitepress/theme/components/HostedVaultFunnel.vue");
    const cloudPage = read(".vitepress/theme/components/CloudPage.vue");
    const controls = read(".vitepress/theme/components/ClerkAuthControls.vue");

    expect(helper).toContain("useAuth");
    expect(funnel).toContain("useClerkApiAuth");
    expect(cloudPage).toContain("useClerkApiAuth");
    expect(funnel).not.toContain("window.Clerk");
    expect(cloudPage).not.toContain("window.Clerk");
    expect(funnel).toContain("@signed-in-action");
    expect(controls).toContain("signedInAction");
  });

  it("uses Clerk user reactivity as the live signed-in identity fallback", () => {
    const helper = read(".vitepress/theme/utils/clerkApi.ts");
    const funnel = read(".vitepress/theme/components/HostedVaultFunnel.vue");
    const cloudPage = read(".vitepress/theme/components/CloudPage.vue");

    expect(helper).toContain("useUser");
    expect(helper).toContain("clerkUserLabel");
    expect(helper).toContain("clerkUserSlugSeed");
    expect(funnel).toContain("clerkUserLabel");
    expect(funnel).toContain("clerkUserSlugSeed");
    expect(cloudPage).toContain("clerkUserLabel");
    // The redesigned dashboard derives its namespace from the provisioned vault row,
    // so slug-seed fallback now lives in the funnel; CloudPage still reflects the live
    // Clerk identity reactively via isClerkSignedIn.
    expect(cloudPage).toContain("isClerkSignedIn");
  });

  it("prevents stale anonymous Clerk refreshes from overwriting newer signed-in state", () => {
    const funnel = read(".vitepress/theme/components/HostedVaultFunnel.vue");
    const cloudPage = read(".vitepress/theme/components/CloudPage.vue");

    expect(funnel).toContain("let meRequestSeq = 0");
    expect(funnel).toContain("const requestSeq = ++meRequestSeq");
    expect(funnel).toContain("if (requestSeq !== meRequestSeq) return;");
    expect(cloudPage).toContain("let cloudStateRequestSeq = 0");
    expect(cloudPage).toContain("const requestSeq = ++cloudStateRequestSeq");
    expect(cloudPage).toContain("if (requestSeq !== cloudStateRequestSeq) return;");
  });

  it("allows the Clerk auth controls to recover after a slow Clerk script load", () => {
    const controls = read(".vitepress/theme/components/ClerkAuthControls.vue");

    expect(controls).toContain("clerkReadyInterval");
    expect(controls).toContain("markClerkReady");
    expect(controls).toContain("clerkFailed.value = false");
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

function runNode(args: string[]) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: node ${args.join(" ")}`));
    }, 5000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });
}
