import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("waits out Cloudflare Pages propagation before scanning the deployment URL", async () => {
    const { port, close } = await startScanServer(() => `<!doctype html><html><body>cloud</body></html>`, 2);

    try {
      const result = await runNode([
        resolve(repoRoot, "scripts/scan-clerk-production-url.mjs"),
        `http://127.0.0.1:${port}/cloud`,
        "--ready-timeout-ms=2000",
        "--ready-interval-ms=100"
      ]);

      expect(result.stderr).not.toContain("returned 404");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("no development Clerk markers found");
    } finally {
      await close();
    }
  });

  it("still fails a propagation-delayed deployment that ships a development Clerk key", async () => {
    const devKey = publishableKey("test", "arriving-yak-2.clerk.accounts.dev");
    const { port, close } = await startScanServer(() => `<!doctype html><html><body>${devKey}</body></html>`, 2);

    try {
      const result = await runNode([
        resolve(repoRoot, "scripts/scan-clerk-production-url.mjs"),
        `http://127.0.0.1:${port}/cloud`,
        "--ready-timeout-ms=2000",
        "--ready-interval-ms=100"
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("development Clerk marker");
    } finally {
      await close();
    }
  });

  it("waits out propagation on linked assets, not just the entry point", async () => {
    let themeRequests = 0;
    const server = createServer((request, response) => {
      if (request.url === "/assets/theme.js") {
        themeRequests += 1;

        if (themeRequests === 1) {
          response.writeHead(404, { "content-type": "text/plain" });
          response.end("Not found");
          return;
        }

        response.writeHead(200, { "content-type": "text/javascript" });
        response.end('window.__clerk="configured";');
        return;
      }

      response.writeHead(200, { "content-type": "text/html" });
      response.end('<script type="module" src="/assets/theme.js"></script>');
    });

    await new Promise<void>((ready) => {
      server.listen(0, "127.0.0.1", ready);
    });

    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const result = await runNode([
        resolve(repoRoot, "scripts/scan-clerk-production-url.mjs"),
        `http://127.0.0.1:${port}/cloud`
      ]);

      expect(result.stderr).not.toContain("returned 404");
      expect(result.status).toBe(0);
      expect(themeRequests).toBeGreaterThan(1);
    } finally {
      await new Promise<void>((closed) => {
        server.close(() => closed());
      });
    }
  });

  it("fails when the deployment never becomes reachable within the retry budget", async () => {
    const { port, close } = await startScanServer(() => "", Number.POSITIVE_INFINITY);

    try {
      const result = await runNode([
        resolve(repoRoot, "scripts/scan-clerk-production-url.mjs"),
        `http://127.0.0.1:${port}/cloud`,
        "--ready-timeout-ms=600",
        "--ready-interval-ms=100"
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("did not become reachable");
      expect(result.stderr).toContain("404");
    } finally {
      await close();
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
    // The account menu and its composable are where the new Clerk work
    // lives; without these the ban stops covering the code it exists for.
    expect(read(".vitepress/theme/components/CloudAccountMenu.vue")).not.toContain("window.Clerk");
    expect(read(".vitepress/theme/utils/clerkAccount.ts")).not.toContain("window.Clerk");
    expect(funnel).toContain("@signed-in-action");
    expect(controls).toContain("signedInAction");
  });

  it("requires ready Clerk auth before protected cloud funnel requests", () => {
    const helper = read(".vitepress/theme/utils/clerkApi.ts");
    const funnel = read(".vitepress/theme/components/HostedVaultFunnel.vue");

    expect(helper).toContain("ClerkApiAuthError");
    expect(helper).toContain("resolveClerkAuthHeaders");
    expect(helper).toContain("required?: boolean");
    expect(helper).toContain("fresh?: boolean");
    expect(funnel).toContain("protectedAuthHeaders");
    expect(funnel).toContain("clerkAuthRecoveryMessage");
    expect(funnel).toContain("{ required: true, fresh: true }");
  });

  it("redirects Clerk sign-in and sign-up completions into the cloud funnel", () => {
    const controls = read(".vitepress/theme/components/ClerkAuthControls.vue");

    expect(controls).toContain("authReturnPath");
    expect(controls).toContain("clerkBrand.cloudPath");
    expect(controls).toContain(":force-redirect-url=\"authReturnPath\"");
    expect(controls).toContain(":sign-up-force-redirect-url=\"authReturnPath\"");
    expect(controls).toContain(":sign-in-force-redirect-url=\"authReturnPath\"");
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

  // A2: the Cloud tab's content (ClerkCloudTab.vue) fetches /api/me and, if a
  // vault exists, a device count. ClerkAuthControls mounts on every page of
  // the site, signed in or not, so the P1 this repo already paid for once
  // (commit 2a81d91: two independent owners of /api/me state, one of them
  // unconditional) must not come back. The safety argument is not "the fetch
  // lives in onMounted" -- a component's own onMounted always looks like
  // that from inside the file. It is "the only thing that ever instantiates
  // the fetching component is the lazily-routed Clerk custom page", which is
  // what these two tests actually check.
  it("never gives ClerkAuthControls itself a fetch, and only instantiates ClerkCloudTab from the lazily-routed Cloud custom page", () => {
    const controls = read(".vitepress/theme/components/ClerkAuthControls.vue");

    // The every-page component must own zero fetch calls, full stop -- not
    // just "no /api/me", since any fetch here runs on every page load.
    expect(controls).not.toContain("fetch(");

    // ClerkCloudTab is referenced exactly once in this file.
    const references = controls.match(/<ClerkCloudTab\b/g) ?? [];
    expect(references).toHaveLength(1);

    // ...and that one reference sits inside the "autovault-cloud" custom
    // page's own slot, between its opening tag and its closing tag -- i.e.
    // it is only ever created by Clerk's lazy custom-page mount. Verified in
    // the browser while building this: opening the UserButton popover alone
    // never puts this page's content in the DOM; only navigating into
    // "Cloud namespace" does.
    const pageStart = controls.indexOf('url="autovault-cloud"');
    expect(pageStart).toBeGreaterThan(-1);
    const pageEnd = controls.indexOf("</UserButton.UserProfilePage>", pageStart);
    expect(pageEnd).toBeGreaterThan(pageStart);

    const referenceIndex = controls.indexOf("<ClerkCloudTab");
    expect(referenceIndex).toBeGreaterThan(pageStart);
    expect(referenceIndex).toBeLessThan(pageEnd);
  });

  it("does not let ClerkCloudTab be reused anywhere outside ClerkAuthControls' Cloud custom page", () => {
    const themeDir = resolve(repoRoot, ".vitepress/theme");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".vue")) continue;
        if (entry.name === "ClerkAuthControls.vue" || entry.name === "ClerkCloudTab.vue") continue;
        if (readFileSync(full, "utf8").includes("ClerkCloudTab")) offenders.push(full);
      }
    };
    walk(themeDir);

    expect(offenders).toEqual([]);
  });

  it("guards ClerkCloudTab's fetch against writes after the tab unmounts, and never treats a failed /api/me as 'no vault'", () => {
    const tab = read(".vitepress/theme/components/ClerkCloudTab.vue");

    expect(tab).toContain("onMounted(load)");
    expect(tab).toContain('fetch("/api/me"');
    expect(tab).toContain("onBeforeUnmount");
    expect(tab).toContain("componentActive");

    // The lesson from commit 2a81d91: a non-OK /api/me means "could not find
    // out", not "signed out" or "no vault". Pin the behavior (a distinct
    // error state, with its own template branch), not the implementation
    // detail of how that state gets set.
    expect(tab).toContain('loadState.value = "error"');
    expect(tab).toContain("loadState === 'error'");
  });

  it("reuses CloudPage.vue's subscription vocabulary and billing-portal request shape in ClerkCloudTab instead of inventing new ones", () => {
    const tab = read(".vitepress/theme/components/ClerkCloudTab.vue");
    const cloudPage = read(".vitepress/theme/components/CloudPage.vue");

    // Anchored to CloudPage.vue's actual SUBSCRIPTION_LABELS entries, not
    // bare words like "Active" -- those appear all over a 2,800-line
    // template for unrelated reasons and would keep passing even if the map
    // itself were renamed or deleted.
    const labelEntries = [
      'active: { text: "Active", tone: "ok" }',
      'trialing: { text: "Trialing", tone: "ok" }',
      'past_due: { text: "Past due", tone: "warn" }',
      'unpaid: { text: "Unpaid", tone: "bad" }',
      'incomplete: { text: "Incomplete", tone: "warn" }',
      'incomplete_expired: { text: "Expired", tone: "bad" }',
      'canceled: { text: "Canceled", tone: "bad" }',
      'paused: { text: "Paused", tone: "warn" }',
    ];
    for (const entry of labelEntries) {
      expect(tab).toContain(entry);
      expect(cloudPage).toContain(entry);
    }

    expect(tab).toContain('"/api/billing/portal"');
    expect(tab).toContain('body: JSON.stringify({ return_to: "/cloud#launch-path" })');
    expect(tab).toContain("{ required: true, fresh: true }");
    expect(cloudPage).toContain('body: JSON.stringify({ return_to: "/cloud#launch-path" })');

    expect(tab).toContain("clerkBrand.cloudPath");
    expect(tab).toContain("clerkBrand.docsPath");
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

// Emulates the Cloudflare Pages propagation race the deployment scan hit on main:
// the deployment URL 404s for the first `notFoundResponses` requests, then serves
// `body`. Pass Infinity to model a deployment that never becomes reachable.
async function startScanServer(body: () => string, notFoundResponses: number) {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;

    if (requests <= notFoundResponses) {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("<!doctype html><html><body>Not found</body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end(body());
  });

  await new Promise<void>((ready) => {
    server.listen(0, "127.0.0.1", ready);
  });

  const address = server.address();

  return {
    port: typeof address === "object" && address ? address.port : 0,
    close: () => new Promise<void>((closed) => {
      server.close(() => closed());
    })
  };
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
