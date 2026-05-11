import { describe, expect, it } from "vitest";
import vitepressConfig from "../.vitepress/config";
import { agentSkillArtifacts, agentSkillUrl, buildAgentsIndex, buildLlmsFullTxt, buildLlmsTxt, listedPageDocs, pageDocs, SITE_URL } from "../.vitepress/shared/pageDocs";

describe("agent markdown docs", () => {
  it("includes the Pirsch tracking snippet by default", () => {
    const expectedDataCode = process.env.PIRSCH_DATA_CODE?.trim() || "ooKBAPbmvXCA4hyKwoBDBx66yNyNswJL";
    const pirschScripts = (vitepressConfig.head ?? []).filter((entry) => {
      return Array.isArray(entry) && entry[0] === "script" && entry[1]?.id === "pianjs";
    });

    expect(pirschScripts).toHaveLength(1);
    expect(pirschScripts[0]).toEqual([
      "script",
      {
        defer: "",
        src: "https://api.pirsch.io/pa.js",
        id: "pianjs",
        "data-code": expectedDataCode
      }
    ]);
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

  it("keeps the hosted cloud page unlisted but routable", async () => {
    const cloud = pageDocs.find((doc) => doc.key === "cloud");
    const index = buildAgentsIndex();
    const llms = buildLlmsTxt();
    const full = buildLlmsFullTxt();
    const transformItems = vitepressConfig.sitemap?.transformItems;
    const transformHead = vitepressConfig.transformHead;

    expect(cloud).toMatchObject({ route: "/cloud", listed: false });
    expect(listedPageDocs.some((doc) => doc.key === "cloud")).toBe(false);
    expect(index.pages.some((page) => page.key === "cloud")).toBe(false);
    expect(llms).not.toContain(`${SITE_URL}/agents/cloud`);
    expect(full).not.toContain(`url: ${SITE_URL}/cloud`);
    expect(transformItems).toBeTypeOf("function");

    const sitemapItems = await transformItems?.([
      { url: "cloud" },
      { url: "/cloud/" },
      { url: "quick-start" }
    ]);
    expect(sitemapItems?.map((item) => item.url)).toEqual(["quick-start"]);

    expect(transformHead).toBeTypeOf("function");
    const head = transformHead?.({
      pageData: {
        relativePath: "cloud.md",
        filePath: "cloud.md",
        title: "AutoVault Cloud Launch",
        description: "",
        headers: [],
        frontmatter: {}
      },
      siteConfig: {} as never,
      siteData: {} as never,
      page: "cloud.md"
    } as never);
    expect(JSON.stringify(head)).toContain("noindex,nofollow");
  });
});
