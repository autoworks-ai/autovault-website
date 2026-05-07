import { describe, expect, it } from "vitest";
import { buildAgentsIndex, buildLlmsFullTxt, buildLlmsTxt, pageDocs, SITE_URL } from "../.vitepress/shared/pageDocs";

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

    expect(index.pages).toHaveLength(pageDocs.length);
    for (const doc of pageDocs) {
      expect(llms).toContain(`${SITE_URL}${doc.agentPath}`);
      expect(full).toContain(doc.markdown);
      expect(index.pages.find((page) => page.key === doc.key)?.markdown_url).toBe(`${SITE_URL}${doc.agentPath}`);
    }
  });
});
