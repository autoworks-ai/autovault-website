import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(resolve(process.cwd(), ".vitepress/theme/components/AvFolderHero.vue"), "utf8");

describe("AV folder hero layout stability", () => {
  it("keeps the cycling skill inspector from resizing the page", () => {
    expect(component).not.toContain('class="av-folder-side" :key="current.id + readPulse"');
    expect(component).toMatch(/\.av-folder-explorer\s*{[^}]*min-height:/s);
    expect(component).toMatch(/\.av-folder-side\s*{[^}]*min-height:\s*0/s);
    expect(component).toMatch(/\.side-card\s*{[^}]*height:\s*100%/s);
    expect(component).toMatch(/\.agent-reads\s*{[^}]*margin-top:\s*auto/s);
  });
});
