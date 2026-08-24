import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(resolve(process.cwd(), ".vitepress/theme/components/CloudPage.vue"), "utf8");

describe("connect → machines bridge layout", () => {
  it("keeps the next-step sentence in one inline flow rather than flex columns", () => {
    // A flex container makes the caret, the text either side of <strong>, and
    // the <strong> itself into separate items that cannot wrap mid-item, so
    // the sentence renders as side-by-side columns at phone widths. It fits on
    // one line at desktop, which is why this is worth pinning rather than
    // eyeballing.
    expect(component).toMatch(/\.cv-nextstep-copy\s*{[^}]*display:\s*block/s);
    expect(component).not.toMatch(/\.cv-nextstep-copy\s*{[^}]*display:\s*flex/s);
    expect(component).toMatch(/\.cv-nextstep-caret\s*{[^}]*display:\s*inline-block/s);
  });
});
