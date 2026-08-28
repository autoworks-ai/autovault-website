import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANUAL_GHCR_IMAGE, RAILWAY_TEMPLATE_URL } from "../.vitepress/shared/deploy";
import { pageDocs } from "../.vitepress/shared/pageDocs";
import { comparisonPlayers, comparisonSources, homepageComparisonRows, homepageGateMetrics } from "../.vitepress/theme/data/marketing";
import { PRODUCT_STATUS, PRODUCT_VERSION, PRODUCT_VERSION_BADGE, PRODUCT_VERSION_SHORT } from "../.vitepress/theme/data/product";
import { releases } from "../.vitepress/theme/data/releases";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("v1 content guardrails", () => {
  it("keeps primary product version copy centralized", () => {
    expect(PRODUCT_VERSION).toBe(`v${PRODUCT_VERSION_SHORT}`);
    expect(PRODUCT_VERSION).toBe("v0.5.0");
    expect(PRODUCT_STATUS).toBe("pre-1.0");
    expect(PRODUCT_VERSION_BADGE).toContain(PRODUCT_VERSION);
    expect(PRODUCT_VERSION_BADGE).not.toContain("Unreleased May 2026");
    const changelogMarkdown = pageDocs.find((doc) => doc.key === "changelog")?.markdown ?? "";
    expect(changelogMarkdown).toContain("## v0.5.0");
    expect(changelogMarkdown).toContain("## v0.4.0");
    expect(changelogMarkdown).not.toContain("## Unreleased");

    // The topbar badge and the newest changelog entry are edited in different
    // files, so bumping one and forgetting the other is the drift that put
    // v0.4.0 in the nav while npm shipped 0.5.0. Exactly one entry is featured,
    // and it is the one the rest of the site claims to be running.
    expect(`v${releases[0].version}`).toBe(PRODUCT_VERSION);
    expect(releases.filter((release) => release.featured)).toHaveLength(1);
    expect(releases[0].featured).toBe(true);
    expect(changelogMarkdown).toContain(`## v${releases[0].version}`);

    const primarySurfaces = [
      ".vitepress/theme/components/AvTopbar.vue",
      ".vitepress/theme/components/DocsShell.vue",
      ".vitepress/theme/components/QuickStartPage.vue",
      ".vitepress/theme/components/ApiReferencePage.vue",
      ".vitepress/theme/components/ComparePage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/theme/components/DeployPage.vue"
    ].map(read).join("\n");

    expect(primarySurfaces).not.toContain("Unreleased May 2026");
    expect(primarySurfaces).not.toMatch(/\bv0\.2\.0\b/);
  });

  it("frames the compatibility route as examples instead of a marketplace directory", () => {
    const examplesSurfaces = [
      ".vitepress/theme/components/SkillsDirectoryPage.vue",
      ".vitepress/theme/components/SkillDetailPage.vue",
      ".vitepress/theme/components/AuthorProfilePage.vue",
      ".vitepress/theme/data/skills.ts",
      ".vitepress/shared/pageDocs.ts"
    ].map(read).join("\n");

    expect(examplesSurfaces).toContain("Vault inventory preview");
    expect(examplesSurfaces).toContain("not a live marketplace score");
    expect(examplesSurfaces).not.toMatch(/Skills directory|skills directory|Most installed|Total installs|Active vaults|Reference uses|CDN mirror|mirrored to CDN/);
    expect(examplesSurfaces).not.toMatch(/installs:|\.installs|SkillSort = "installs"|sort === "installs"/);
  });

  it("keeps deploy claims limited to verified v1 providers", () => {
    const deploy = read(".vitepress/theme/components/DeployPage.vue");
    const deployMarkdown = pageDocs.find((doc) => doc.key === "deploy")?.markdown ?? "";

    expect(deploy).toContain('name: "Railway"');
    expect(deploy).toContain('name: "Docker"');
    expect(deploy).toContain("RAILWAY_TEMPLATE_URL");
    expect(deployMarkdown).toContain(RAILWAY_TEMPLATE_URL);
    expect(deploy).toContain("MANUAL_GHCR_IMAGE");
    expect(deployMarkdown).toContain(MANUAL_GHCR_IMAGE);
    expect(deploy).toContain("Manual image deploy");
    expect(deploy).toContain("Min 12 chars");
    expect(deploy).not.toMatch(/\bRender\b|Fly\.io|officially-tested|24 chars|render\.yaml|fly\.toml|LiteFS/);
  });

  it("documents that AutoVault is not a credential vault", () => {
    const [authoring, security, docsMarkdown] = [
      ".vitepress/theme/components/AuthoringPage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/shared/pageDocs.ts"
    ].map((path) => read(path));

    expect(authoring).toContain("AutoVault is a skill vault, not a credential vault");
    expect(authoring).toContain("requires-secrets");
    expect(authoring).toContain("SSH agent");
    expect(authoring).toContain("Keychain");
    expect(authoring).toContain("Do not bundle <code>.env</code> files, SSH private keys, access tokens, or copied dashboard secrets.");
    expect(security).toContain("A <code>.env</code> file or private key inside a skill bundle is content, not protected secret storage.");
    expect(docsMarkdown).toContain("Do not bundle .env files, SSH private keys, API tokens, or copied dashboard secrets");
  });

  it("keeps current API, storage, and remote-mode docs aligned to v0 surfaces", () => {
    const api = read(".vitepress/theme/components/ApiReferencePage.vue");
    const styles = read(".vitepress/theme/styles.css");
    const quickStart = read(".vitepress/theme/components/QuickStartPage.vue");
    const deploy = read(".vitepress/theme/components/DeployPage.vue");
    const authoring = read(".vitepress/theme/components/AuthoringPage.vue");
    const compare = read(".vitepress/theme/components/ComparePage.vue");
    const apiCurrentSurface = [
      sliceBetween(api, "<section class=\"api-hero", "</section>"),
      sliceBetween(api, "const nav: NavItem[] = [", "function endpoint")
    ].join("\n");
    const vaultAnatomy = sliceBetween(quickStart, "<h2 id=\"vault-anatomy\">", "const ACCESS_ROWS");
    const remoteModeCopy = sliceBetween(deploy, "<section id=\"hosts\"", "const providers");
    const authoringSchemaIntro = sliceBetween(authoring, "<h2 id=\"schema\">", "<div class=\"schema final-schema\"");
    const apiMarkdown = pageDocs.find((doc) => doc.key === "api")?.markdown ?? "";
    const deployMarkdown = pageDocs.find((doc) => doc.key === "deploy")?.markdown ?? "";

    expect(apiCurrentSurface).toContain("Current {{ PRODUCT_VERSION }} surfaces");
    expect(apiCurrentSurface).toContain("MCP tools are the agent-facing API");
    expect(apiCurrentSurface).toContain("autovault add");
    expect(apiCurrentSurface).not.toMatch(/@autovault\/sdk|\/api\/v1|autovault init|MCP 2024-11-05|cli-import-autohub|import-autohub|add-local/);
    expect(api).not.toContain('v-html="line"');
    expect(api).toContain("line.text");
    expect(styles).toContain(".api-sig .pmt {");
    expect(styles).toContain("margin-right: 0.35em");
    expect(api).toContain("autovault add <source-or-path>");
    expect(api).toContain("[--provenance <value>]");
    expect(api).toContain("autovault add ./skills/skill-author --sync-profiles --yes");
    expect(api).toContain("autovault add ./staging/skill-author --source local --provenance '<existing-identifier>' --sync-profiles --yes");
    expect(api).toContain("autovault add skill-slug --source agentskills --sync-profiles --agent codex --yes");
    expect(api).not.toContain("autovault add-local");
    expect(apiMarkdown).toContain("autovault add ./skills/skill-author --sync-profiles --yes");
    expect(apiMarkdown).toContain("autovault add ./staging/skill-author --source local --provenance '<existing-identifier>' --sync-profiles --yes");
    expect(apiMarkdown).toContain("autovault add skill-slug --source agentskills --sync-profiles --agent codex --yes");
    expect(apiMarkdown).not.toMatch(/add-local|cli-import-autohub|import-autohub/);

    expect(vaultAnatomy).toContain("current implementation layout");
    expect(vaultAnatomy).toContain(".signing-key.json");
    expect(vaultAnatomy).toContain(".autovault-source.json");
    expect(vaultAnatomy).toContain(".autovault-manifest");
    expect(vaultAnatomy).not.toMatch(/keys\/|ed25519\.priv|manifest\.json|SKILL\.md\.sig/);

    expect(remoteModeCopy).toContain("Remote mode cannot create symlinks on client machines");
    expect(remoteModeCopy).toContain("Remote clients should discover and read skills through <code>get_skill</code>");
    expect(remoteModeCopy).not.toContain("install signed skills without ever touching a local filesystem");

    expect(authoringSchemaIntro).toContain("Open Agent Skills fields");
    expect(authoringSchemaIntro).toContain("AutoVault extensions");
    expect(authoringSchemaIntro).toContain("<code>name</code> and <code>description</code> remain the portable core");
    expect(deployMarkdown).toContain("Remote mode cannot create symlinks on client machines");
    expect(deploy).toContain('TerminalBlock title="remote MCP health" :lines="remoteHealthLines"');
    expect(deploy).not.toContain("statusLines");
    expect(compare).toContain("autovault add ./skills/toolsmith --source local --sync-profiles --yes");
    expect(compare).not.toContain("--source github:");
    expect(apiMarkdown).toContain("Current v0.5.0 surfaces");
  });

  it("keeps internal imports and compatibility aliases out of public docs", () => {
    const publicSurfaces = [
      ".vitepress/theme/components/ApiReferencePage.vue",
      ".vitepress/theme/components/AvQuickStart.vue",
      ".vitepress/theme/components/AvValidationGate.vue",
      ".vitepress/theme/components/ComparePage.vue",
      ".vitepress/theme/components/QuickStartPage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/theme/data/releases.ts",
      ".vitepress/theme/data/searchResults.ts",
      ".vitepress/shared/pageDocs.ts",
      "changelog.md",
      "public/skills/trusted-skill-import/SKILL.md",
      "public/skills/autovault-skill/SKILL.md",
      ...readdirSync(resolve(repoRoot, "skill"))
        .filter((file) => file.endsWith(".md"))
        .map((file) => `skill/${file}`)
    ].map(read).join("\n");

    expect(publicSurfaces).toContain("autovault add ");
    expect(publicSurfaces).not.toMatch(/cli-import-autohub|import-autohub|autovault add-local|agentgonewild-publisher/);
  });

  it("keeps hosted copy accurate: sync shipped, publishing did not", () => {
    const hostedCopy = [
      ".vitepress/theme/components/CloudPage.vue",
      ".vitepress/theme/components/CloudAccountMenu.vue",
      ".vitepress/theme/components/HostedVaultFunnel.vue",
      ".vitepress/shared/pageDocs.ts"
    ].map(read).join("\n");

    // This case used to require the opposite and is the reason true copy could
    // not be written without editing this file: it asserted the copy contained
    // "Cloud sync is not enabled yet" and forbade /cloud sync is enabled/. That
    // was correct while sync was vapor. Enrollment (#98), admit/revoke (#99),
    // pairing (#117) and CLI v0.5.0 have all shipped since, so the line it
    // guards has moved rather than disappeared.
    //
    // The line now: sync is real, publishing is not. Both halves are
    // load-bearing. Drop the first and the site understates a shipped product;
    // drop the second and it promises an upload path that does not exist.

    // Half one. Sync is real, and the copy is allowed to say so.
    expect(hostedCopy).toContain("Hosted vault");
    expect(hostedCopy).toMatch(/autovault link/i);
    expect(hostedCopy).toMatch(/signed skills/i);
    expect(hostedCopy).not.toMatch(/cloud sync is not enabled|sync is not enabled yet/i);
    expect(hostedCopy).not.toMatch(/hosted sync ships next|turns on automatically when it ships/i);
    expect(hostedCopy).not.toMatch(/Get early access|early-access list|Coming soon · preview/i);

    // Half two. Publishing is not, and nothing may imply otherwise.
    // AUTOVAULT_VAULT_OBJECTS.put() appears once in functions/, writing a
    // pending-skill draft; the catalog and bundle keys are only ever read.
    expect(hostedCopy).not.toMatch(/publish your|upload your|push your/i);
    expect(hostedCopy).toMatch(/no publish (path|button)|hands-on in private beta/i);

    // Unchanged guards: never claim a runtime that does not exist, and never
    // print an address that does not resolve. Nothing routes vault.autovault.dev.
    expect(hostedCopy).not.toMatch(/prototype mode|Internal cloud prototype/i);
    expect(hostedCopy).not.toMatch(/Simulate MCP ping|Simulate pending import/i);
    expect(hostedCopy).not.toMatch(/live vault|provisioned runtime/i);
    expect(hostedCopy).not.toMatch(/>vault\.autovault\.dev/);
  });

  it("keeps homepage comparison credible and linked", () => {
    const homepageCopy = [
      ".vitepress/theme/components/AvComparison.vue",
      ".vitepress/theme/components/AvSpecHero.vue",
      ".vitepress/theme/components/AvProblems.vue",
      ".vitepress/theme/components/AvValidationGate.vue"
    ].map(read).join("\n");

    expect(homepageCopy).not.toMatch(/ClawdHub|TLC registry|credential stealers|shipping malware|11\.4%|820ms/);
    expect(comparisonPlayers.map((player) => player.name)).toEqual([
      "AutoVault",
      "Skillfish",
      "Tessl",
      "SkillKit / Agent Skills",
      "Manual"
    ]);
    expect(comparisonSources.map((source) => source.label)).toEqual([
      "Skill.Fish",
      "Tessl docs",
      "Agent Skills GitHub",
      "SkillKit",
      "SkillClone",
      "ClawHub docs",
      "Cloudflare obfuscation docs"
    ]);
    expect(comparisonSources.every((source) => source.href.startsWith("https://"))).toBe(true);
    expect(homepageComparisonRows.some((row) => row[1] === "partial")).toBe(true);
    expect(homepageComparisonRows.every((row) => row.length === comparisonPlayers.length + 1)).toBe(true);
  });

  it("keeps compare-page positioning focused on no-fork transforms and admission-time dedup", () => {
    const compare = read(".vitepress/theme/components/ComparePage.vue");

    expect(compare).toContain("transforms instead of forks");
    expect(compare).toContain("workspace-local deltas");
    // Admission-time dedup positioning — exact copy may evolve, key tokens must stay
    expect(compare).toMatch(/Admission-time dedup stops a duplicate from becoming local infrastructure/);
    expect(compare).toContain("SkillClone");
    expect(compare).toContain("https://arxiv.org/abs/2603.22447");
    // SkillClone metrics — values matter, surrounding prose may change
    expect(compare).toMatch(/75%/);
    expect(compare).toMatch(/3\.5x/);
    expect(compare).toMatch(/5,642/);
    expect(compare).toMatch(/41%/);
  });

  it("keeps compare discoverable in the footer, sidebar, search, and markdown export", () => {
    const footer = read(".vitepress/theme/components/AvFooter.vue");
    const docsShell = read(".vitepress/theme/components/DocsShell.vue");
    const searchResultsSource = read(".vitepress/theme/data/searchResults.ts");
    const pageDocsSource = read(".vitepress/shared/pageDocs.ts");
    const compareMarkdown = pageDocs.find((doc) => doc.key === "compare")?.markdown ?? "";

    // This used to require Compare in the topbar. The topbar is capped at five
    // links now, so the invariant had to move rather than be deleted: Compare
    // is still reachable from every page, just from the footer instead. The
    // footer is the only one of these three that renders on the landing page,
    // so it is the load-bearing assertion, not a formality.
    expect(footer).toContain('<a href="/compare">Compare</a>');
    expect(docsShell).toContain('{ label: "Compare", href: "/compare" }');
    expect(searchResultsSource).toContain("transforms instead of forks");
    expect(searchResultsSource).toContain("skillclone");
    expect(compareMarkdown).toContain("transforms instead of forks");
    expect(compareMarkdown).toContain("workspace-local deltas");
    expect(compareMarkdown).toContain("Admission-time dedup");
    expect(compareMarkdown).toContain("https://arxiv.org/abs/2603.22447");
    expect(pageDocsSource).toContain("SkillClone");
  });

  it("keeps both account surfaces agreeing on which statuses go to the portal", () => {
    // CloudPage and ClerkCloudTab each carry their own copy of this set. Two
    // account surfaces offering different recovery paths for one Stripe status
    // is worse than either being wrong alone, and `paused` was fixed in one and
    // missed in the other. Compare the sets rather than one literal.
    const setIn = (file: string) => {
      const text = read(file);
      const at = text.indexOf("const PORTAL_ONLY_STATUSES");
      expect(at, `no PORTAL_ONLY_STATUSES in ${file}`).toBeGreaterThan(-1);
      const body = text.slice(at, text.indexOf("]);", at));
      return [...body.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
    };

    const dashboard = setIn(".vitepress/theme/components/CloudPage.vue");
    const profile = setIn(".vitepress/theme/components/ClerkCloudTab.vue");
    expect(profile).toEqual(dashboard);
    expect(dashboard).toContain("paused");
  });

  it("documents an enrollment body the handler will actually accept", () => {
    const api = read(".vitepress/theme/components/ApiReferencePage.vue");
    const route = readFileSync(resolve(repoRoot, "functions/v/[slug]/devices.js"), "utf-8");

    // The handler refuses with 400 unless body.public_key equals the
    // X-AutoVault-Device header. The reference showed a body of hostname
    // alone, so anyone implementing from it got a 400 on first contact and
    // nothing on the page said why.
    expect(route).toContain("body.public_key !== publicKey");
    const at = api.indexOf('id: "sync-enroll"');
    expect(at, "no sync-enroll endpoint").toBeGreaterThan(-1);
    const block = api.slice(at, api.indexOf('endpoint("sync-current"', at));
    expect(block).toContain('public_key');
    expect(block).toContain('hostname');
  });

  it("does not sell the CLI version as a container tag", () => {
    const api = read(".vitepress/theme/components/ApiReferencePage.vue");
    const deploy = read(".vitepress/shared/deploy.ts");

    // npm and GHCR do not ship together. One version printed over three
    // channels claimed a GHCR image that stopped resolving the moment npm
    // moved ahead, so the container gets its own row keyed to its own tag.
    expect(api).not.toContain("npm · brew · GHCR");
    expect(api).toContain("MANUAL_GHCR_TAG");
    expect(deploy).toContain("export const MANUAL_GHCR_TAG");
  });

  it("does not describe hosted sync as read-only or admission-gated at the catalog", () => {
    const api = read(".vitepress/theme/components/ApiReferencePage.vue");
    const apiMarkdown = pageDocs.find((doc) => doc.key === "api")?.markdown ?? "";

    // Two claims that were both wrong, in the one paragraph a reader uses to
    // size up the surface. POST /v/<slug>/devices is a write any keypair may
    // call, and the catalog is readable while pending: admission gates bundles.
    for (const text of [api, apiMarkdown]) {
      expect(text).not.toMatch(/hosted sync is a read-only surface/i);
      expect(text).toMatch(/exactly one write/i);
    }
  });

  it("does not present a partial inventory of hosted data as the whole of it", () => {
    const security = read(".vitepress/theme/components/SecurityPage.vue");
    const securityMarkdown = pageDocs.find((doc) => doc.key === "security")?.markdown ?? "";

    // The card listed catalog objects, device keys and the subscription, then
    // said "That is the list". D1 also holds the identity provider's email,
    // name and avatar, Stripe ids, pairing codes and hostnames, and the full
    // body of any skill draft submitted from the dashboard. A privacy claim
    // that stops early is worse than none.
    expect(security).not.toContain("That is the list");
    for (const text of [security, securityMarkdown]) {
      expect(text).toMatch(/email, name and avatar/i);
      expect(text).toMatch(/stored whole, body text included/i);
      expect(text).toMatch(/pairing codes/i);
      expect(text).toMatch(/No signing key/i);
    }
  });

  it("never tells a paired machine to go and get admitted afterwards", () => {
    // Two enrollment paths, and they end differently. `autovault link <slug>`
    // POSTs /v/<slug>/devices and lands `pending`, so the dashboard Admit is
    // real for it. `autovault link` with no argument goes through a pairing
    // code, and the confirm handler calls admitDevice and returns an active
    // device -- confirming IS the admission. Five separate surfaces told the
    // second group to go and click a button that is not there for them, which
    // is a support ticket dressed as instructions.
    const surfaces = [
      ".vitepress/theme/components/HostedSyncPage.vue",
      ".vitepress/theme/components/HostedVaultFunnel.vue",
      ".vitepress/theme/components/CloudPage.vue",
      ".vitepress/shared/pageDocs.ts"
    ];

    for (const file of surfaces) {
      const text = read(file);
      expect(text, `${file} sends a paired machine looking for an Admit button`)
        .not.toMatch(/pair (?:it|this machine)[^.]*, then admit/i);
      expect(text, `${file} sends a paired machine looking for an Admit button`)
        .not.toMatch(/confirm (?:that |the )?code[^.]*, then admit/i);
    }

    // And the correction is stated, not merely absent.
    expect(read(".vitepress/theme/components/HostedSyncPage.vue"))
      .toContain("Confirming <em>is</em> the admission here");
  });

  it("caps the top nav at five links and keeps every demoted page reachable", () => {
    const topbar = read(".vitepress/theme/components/AvTopbar.vue");
    const footer = read(".vitepress/theme/components/AvFooter.vue");
    const docsShell = read(".vitepress/theme/components/DocsShell.vue");

    const nav = topbar.slice(topbar.indexOf("const navItems = ["));
    const items = nav.slice(0, nav.indexOf("\n];"));
    const labels = [...items.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);

    // Six is where a topbar with a search box, an auth control and a GitHub
    // icon stops reading as a row and starts reading as a list. The cap is the
    // point of this case; which five is a product call and can change.
    expect(labels).toHaveLength(5);
    expect(labels).toContain("Cloud");
    expect(labels).toContain("Quick start");

    // Nothing gets demoted into nowhere. Every page that left the topbar is
    // still one click away from the landing page, which has a footer and no
    // sidebar.
    for (const href of ["/authoring", "/compare"]) {
      expect(labels).not.toContain(href);
      expect(footer).toContain(`href="${href}"`);
      expect(docsShell).toContain(`href: "${href}"`);
    }
  });

  it("shows the cloud nav entry to everyone and uses clerkBrand.cloudPath", () => {
    const topbar = read(".vitepress/theme/components/AvTopbar.vue");
    const clerk = read(".vitepress/theme/clerk.ts");

    // This case used to assert the opposite, and the reason it did is worth
    // keeping written down: Cloud was pushed onto the nav only for a signed-in
    // visitor, because the hosted vault was a namespace you reserved while
    // waiting for sync, and there was nothing on that page for a stranger.
    // Sync shipped. /cloud is now the sign-up entry point, so gating it on
    // being signed in hid the page from everyone it was built to reach.
    expect(topbar).toContain('{ label: "Cloud", href: clerkBrand.cloudPath }');
    expect(topbar).not.toContain('{ label: "Cloud", href: "/cloud');

    // No auth gate left, and no leftover machinery for one. clerkBrand.cloudPath
    // carries the `#launch-path` anchor Clerk also redirects to, so the topbar
    // and the sign-in bounce land on the same scroll position.
    expect(topbar).not.toContain("useClerkApiAuth");
    expect(topbar).not.toContain("isClerkSignedIn");
    expect(clerk).toContain("cloudPath");

    // The isActive special case survives the flip: cloudPath carries a hash, so
    // a plain equality against location.pathname would never match on /cloud.
    expect(topbar).toContain('item.href === clerkBrand.cloudPath && currentPath.value.startsWith("/cloud")');
  });

  it("keeps homepage gate metrics labeled as fixtures", () => {
    expect(homepageGateMetrics.reject).toEqual({
      value: "~1 in 9",
      label: "held in the demo fixture"
    });
    expect(homepageGateMetrics.latency).toEqual({
      value: "<1s",
      label: "local validation fixture"
    });
  });

  it("keeps rendered social assets aligned with current positioning", () => {
    const socialSurfaces = [
      "scripts/social-assets/source/og-1200x630.html",
      "scripts/social-assets/source/twitter-1200x600.html",
      "scripts/social-assets/source/github-1280x640.html",
      "scripts/social-assets/source/square-1200x1200.html",
      "scripts/social-assets/manifest.json",
      "public/social-card.svg",
      ".vitepress/config.ts"
    ].map(read).join("\n");

    expect(socialSurfaces).toContain("Local-first skill vault");
    expect(socialSurfaces).toContain("/og-1200x630.png");
    expect(socialSurfaces).toContain("/twitter-1200x600.png");
    expect(socialSurfaces).not.toMatch(/The skill registry|registry with a gate|11\.4%|820ms|v1\.0|github:org\/skills\/extract-pdf/);

    for (const asset of [
      "og-1200x630.png",
      "twitter-1200x600.png",
      "github-1280x640.png",
      "square-1200x1200.png",
      "favicon-512.png",
      "apple-touch-icon.png",
      "favicon-32.png"
    ]) {
      expect(existsSync(resolve(repoRoot, "public", asset))).toBe(true);
    }
  });

  it("avoids Cloudflare email-obfuscation traps in visible demos", () => {
    const demoSurfaces = [
      ".vitepress/theme/components/AvSpecHero.vue",
      ".vitepress/theme/components/AvValidationGate.vue",
      ".vitepress/theme/components/AvFolderHero.vue",
      ".vitepress/theme/components/AvQuickStart.vue",
      ".vitepress/theme/components/QuickStartPage.vue",
      ".vitepress/theme/components/SecurityPage.vue",
      ".vitepress/theme/components/ApiReferencePage.vue",
      ".vitepress/theme/components/AuthorProfilePage.vue",
      ".vitepress/theme/components/SkillDetailPage.vue"
    ].map(read).join("\n");

    expect(demoSurfaces).not.toMatch(/[A-Za-z0-9._%+/-]+@[0-9]+(?:\.[0-9]+)+/);
  });
});

function read(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function sliceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0) {
    throw new Error(`Missing slice start marker: ${start}`);
  }

  if (endIndex <= startIndex) {
    throw new Error(`Missing slice end marker after "${start}": ${end}`);
  }

  return source.slice(startIndex, endIndex);
}
