import { describe, expect, it } from "vitest";
import vitepressConfig from "../.vitepress/config";
import { buildAgentsIndex, buildLlmsFullTxt, buildLlmsTxt, listedPageDocs, pageDocs, SITE_URL } from "../.vitepress/shared/pageDocs";

describe("agent markdown docs", () => {
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
