import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vitepressConfig from "../.vitepress/config";
import { agentSkillArtifacts, agentSkillUrl, buildAgentsIndex, buildLlmsFullTxt, buildLlmsTxt, listedPageDocs, pageDocs, SITE_URL } from "../.vitepress/shared/pageDocs";

describe("agent markdown docs", () => {
  it("includes the Pirsch tracking snippet by default", () => {
    const expectedDataCode = process.env.PIRSCH_DATA_CODE?.trim() || "ooKBAPbmvXCA4hyKwoBDBx66yNyNswJL";
    const pirschScripts = (vitepressConfig.head ?? []).filter((entry) => {
      return Array.isArray(entry) && entry[0] === "script" && entry[1]?.id === "pianjs";
    });

    expect(pirschScripts).toHaveLength(1);
    expect(pirschScripts[0][0]).toBe("script");
    expect(pirschScripts[0][1]).toMatchObject({
      src: "https://api.pirsch.io/pa.js",
      id: "pianjs",
      "data-code": expectedDataCode
    });
  });

  it("defines one clean markdown endpoint per public page", () => {
    const keys = new Set(pageDocs.map((doc) => doc.key));
    const routes = new Set(pageDocs.map((doc) => doc.route));
    const agentPaths = new Set(pageDocs.map((doc) => doc.agentPath));

    expect(keys.size).toBe(pageDocs.length);
    expect(routes.size).toBe(pageDocs.length);
    expect(agentPaths.size).toBe(pageDocs.length);
    expect(pageDocs.every((doc) => doc.agentPath.startsWith("/agents/"))).toBe(true);
    expect(pageDocs.every((doc) => !doc.agentPath.endsWith(".md"))).toBe(true);
    expect(pageDocs.every((doc) => doc.markdown.startsWith("# "))).toBe(true);
  });

  it("builds llms files and the index from the same page metadata", () => {
    const index = buildAgentsIndex();
    const llms = buildLlmsTxt();
    const full = buildLlmsFullTxt();

    expect(index.pages).toHaveLength(listedPageDocs.length);
    for (const doc of listedPageDocs) {
      expect(llms).toContain(`${SITE_URL}${doc.agentPath}`);
      expect(full).toContain(doc.markdown);
      expect(index.pages.find((page) => page.key === doc.key)?.markdown_url).toBe(`${SITE_URL}${doc.agentPath}`);
    }

    for (const skill of agentSkillArtifacts) {
      expect(index.skills.find((item) => item.key === skill.key)).toMatchObject({
        raw_url: agentSkillUrl(skill),
        install_path: skill.installPath
      });
      expect(llms).toContain(agentSkillUrl(skill));
      expect(full).toContain(agentSkillUrl(skill));
    }
  });

  it("publishes the hosted cloud page like any other product page", async () => {
    // The inverse of the case that stood here. `listed: false` was one flag
    // doing three jobs: it cut /agents/cloud from llms.txt and the agents
    // index, and it made config.ts splice a noindex,nofollow robots meta into
    // the head. All three were correct while the page sold a reservation. The
    // page sells a shipped product now.
    const cloud = pageDocs.find((doc) => doc.key === "cloud");
    const index = buildAgentsIndex();
    const llms = buildLlmsTxt();
    const full = buildLlmsFullTxt();

    expect(cloud).toMatchObject({ route: "/cloud" });
    expect(cloud?.listed).not.toBe(false);
    expect(listedPageDocs.some((doc) => doc.key === "cloud")).toBe(true);
    expect(index.pages.some((page) => page.key === "cloud")).toBe(true);
    expect(llms).toContain(`${SITE_URL}/agents/cloud`);
    expect(full).toContain(`url: ${SITE_URL}/cloud`);

    const transformHead = vitepressConfig.transformHead;
    expect(transformHead).toBeTypeOf("function");
    const head = transformHead?.({
      pageData: {
        relativePath: "cloud.md",
        filePath: "cloud.md",
        title: "AutoVault Cloud",
        description: "",
        headers: [],
        frontmatter: {}
      },
      siteConfig: {} as never,
      siteData: {} as never,
      page: "cloud.md"
    } as never);
    expect(JSON.stringify(head)).not.toContain("noindex");
  });

  it("keeps only the pairing endpoint out of the sitemap", async () => {
    // /cloud/pair is where the CLI sends an owner to confirm an XXXX-XXXX
    // code. It means nothing without one, and it has no pageDocs entry, so
    // transformHead never runs for it and never has: this filter and the
    // page's own `search: false` are the whole of what keeps it unindexed.
    const transformItems = vitepressConfig.sitemap?.transformItems;
    expect(transformItems).toBeTypeOf("function");

    const sitemapItems = await transformItems?.([
      { url: "cloud" },
      { url: "/cloud/" },
      { url: "cloud/pair" },
      { url: "/cloud/pair/" },
      { url: "quick-start" }
    ]);
    expect(sitemapItems?.map((item) => item.url)).toEqual([
      "cloud",
      "/cloud/",
      "quick-start"
    ]);

    // And it carries its own robots tag, because transformHead cannot give it
    // one. The sitemap filter alone only withholds an invitation; a URL an
    // owner pastes into a chat is still crawlable without this.
    const pair = readFileSync(new URL("../cloud/pair.md", import.meta.url), "utf-8");
    expect(pair).toContain("content: noindex,nofollow");
    expect(pair).toContain("search: false");
  });
});

/**
 * Every page ships twice: a Vue component for people, and a markdown mirror in
 * pageDocs.ts served at /agents/<key> and inlined into llms.txt. Nothing
 * asserted the two agreed on SUBSTANCE -- the case above only checks the
 * plumbing -- so one could be corrected and the other left stale. AutoVault is
 * a product for agents; the stale half would be the half agents read.
 */
describe("the human and agent copies of a page make the same claims", () => {
  const component = (name: string) =>
    readFileSync(new URL(`../.vitepress/theme/components/${name}`, import.meta.url), "utf-8");

  const markdownFor = (key: string) => {
    const doc = pageDocs.find((entry) => entry.key === key);
    expect(doc, `no pageDoc for ${key}`).toBeTruthy();
    return doc!.markdown;
  };

  const SURFACES = [
    { key: "cloud", vue: "CloudPage.vue" },
    { key: "hosted-sync", vue: "HostedSyncPage.vue" },
  ] as const;

  for (const surface of SURFACES) {
    describe(surface.key, () => {
      const copies = [
        { half: "component", text: component(surface.vue) },
        { half: "agent markdown", text: markdownFor(surface.key) },
      ];

      for (const { half, text } of copies) {
        it(`${half}: never implies a self-serve publish path`, () => {
          // There is none. AUTOVAULT_VAULT_OBJECTS.put() appears once in
          // functions/, writing a pending-skill draft; the catalog and bundle
          // keys are only ever read. Signed objects reach KV out of band.
          expect(text).not.toMatch(/publish your|upload your|push your|publish button below/i);
        });

        it(`${half}: states the publishing gap rather than omitting it`, () => {
          // The assumption every reader brings. Silence here reads as yes.
          expect(text).toMatch(/no publish (path|API|button)|hands-on in private beta|out of band/i);
        });

        it(`${half}: never promises seats, roles, or a free tier`, () => {
          // Scope is devices, not members (0005_sync_devices.sql). Checkout
          // hardcodes quantity 1 and configures no trial.
          expect(text).not.toMatch(/free tier|free plan|invite your team|per seat|per-seat/i);
        });

        it(`${half}: never prints vault.autovault.dev as a live endpoint`, () => {
          // vaults.public_url holds that string and nothing routes the host.
          // The address a CLI reaches is autovault.dev/v/<slug>/.
          expect(text).not.toMatch(/https:\/\/vault\.autovault\.dev/);
        });
      }
    });
  }
});
