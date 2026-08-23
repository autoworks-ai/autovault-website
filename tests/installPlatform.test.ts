import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { installMethodFor } from "../.vitepress/theme/utils/platform";

const quickStart = readFileSync(
  new URL("../.vitepress/theme/components/QuickStartPage.vue", import.meta.url),
  "utf-8"
);

// Real user agents. The interesting ones are the two that lie about what they
// are, which is the whole reason this logic is not a one-line ternary.
const UA = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  // iPadOS 13+ reports a desktop Macintosh UA, character-for-character a Mac.
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  // Android reports "Linux".
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // ChromeOS carries X11, same as a Linux desktop.
  chromeos: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
} as const;

describe("preselecting an install command", () => {
  it("gives desktops the command that works there", () => {
    // curl is the only channel with no prerequisite of its own, and the only
    // one that provisions ~/.autovault. Windows has no shell for it and no
    // brew, so npm is the only line that runs.
    expect(installMethodFor(UA.mac, 0)).toEqual({ method: "curl", label: "macOS" });
    expect(installMethodFor(UA.linux, 0)).toEqual({ method: "curl", label: "Linux" });
    // Windows is deliberately absent — see the test below.
  });

  it("does not claim Windows, which the UA cannot settle either", () => {
    // The page states Windows support as WSL2, and no browser UA reveals
    // whether WSL2 is present or which shell the visitor will paste into.
    // npm stays selected because it is the default, not because we detected it.
    expect(installMethodFor(UA.windows, 0)).toBeNull();
  });

  it("refuses to guess on a phone or tablet", () => {
    // None of the three commands can run on one, so preselecting hands the
    // visitor a command they cannot use and labels it as their platform.
    expect(installMethodFor(UA.iphone, 5)).toBeNull();
    expect(installMethodFor(UA.android, 5)).toBeNull();
  });

  it("tells an iPad apart from the Mac it claims to be", () => {
    // The two user agents here are byte-identical -- assert that, so nobody
    // "simplifies" this back to a UA test later. maxTouchPoints is the only
    // thing separating them.
    expect(UA.ipad).toBe(UA.mac);
    expect(installMethodFor(UA.ipad, 5)).toBeNull();
    expect(installMethodFor(UA.mac, 0)).toEqual({ method: "curl", label: "macOS" });
    // A Mac with a touchpad still reports at most 1.
    expect(installMethodFor(UA.mac, 1)).toEqual({ method: "curl", label: "macOS" });
  });

  it("does not read a Chromebook as a Linux desktop", () => {
    // ChromeOS reports "X11; CrOS x86_64" and would otherwise take the X11
    // fallback. A Chromebook has no shell for `curl … | sh` unless the
    // optional Linux environment is on, which the UA cannot tell us.
    expect(UA.chromeos).toContain("X11");
    expect(installMethodFor(UA.chromeos, 0)).toBeNull();
    // Touch does not save us here: many Chromebooks report 0.
    expect(installMethodFor(UA.chromeos, 5)).toBeNull();
    // A real Linux desktop still resolves.
    expect(installMethodFor(UA.linux, 0)).toEqual({ method: "curl", label: "Linux" });
  });

  it("leaves the default alone when it cannot tell", () => {
    expect(installMethodFor("", 0)).toBeNull();
    expect(installMethodFor("Some unknown agent", 0)).toBeNull();
  });
});

describe("the page reads the platform without breaking prerender", () => {
  it("detects in onMounted, never at setup scope", () => {
    // `navigator` does not exist during prerender, so choosing at setup scope
    // would make the server HTML disagree with the first client render -- a
    // hydration mismatch on the one element the page exists for.
    const at = quickStart.indexOf("onMounted(() => {");
    expect(at).toBeGreaterThan(-1);
    expect(quickStart.slice(at, at + 320)).toContain("installMethodFor(navigator.userAgent");

    // The only navigator read is the one inside onMounted.
    expect(quickStart.match(/navigator\./g)?.length).toBe(2);
  });

  it("keeps npm as the pre-detection default", () => {
    // Rendered by the server and by the client's first pass, so it has to be
    // the value that needs no detection to be correct.
    expect(quickStart).toContain('const selectedMethod = ref<Method>("npm")');
  });
});

// The quick start page sets `layout: false` and renders its own chrome through
// DocsShell, so VitePress's themeConfig.sidebar is never displayed on it — the
// right-hand TOC in DocsShell is. Renaming a heading therefore has to be
// followed there, and nothing checked that until this test: the first pass of
// this PR renamed six headings and left the rendered TOC reading "Run the setup
// wizard" and "Verify the install".
describe("the rendered TOC keeps up with the page", () => {
  const docsShell = readFileSync(
    new URL("../.vitepress/theme/components/DocsShell.vue", import.meta.url),
    "utf-8"
  );

  // The `toc:` array inside the "quick-start" entry of DocsShell's configs map.
  const quickStartToc = docsShell.slice(
    docsShell.indexOf('"quick-start": {'),
    docsShell.indexOf("authoring: {")
  );
  const tocIds = [...quickStartToc.matchAll(/id: "([a-z-]+)"/g)].map((m) => m[1]);
  const pageIds = new Set([...quickStart.matchAll(/id="([a-z-]+)"/g)].map((m) => m[1]));

  it("finds every TOC entry on the page", () => {
    expect(tocIds.length).toBeGreaterThan(4);
    // A TOC row whose anchor no longer exists scrolls nowhere and says nothing
    // about it, which is the failure mode worth catching automatically.
    for (const id of tocIds) {
      expect(pageIds.has(id), `TOC links #${id}, which the page does not define`).toBe(true);
    }
  });

  it("does not still describe the old step wording", () => {
    // Labels are prose and will drift again; these are the exact strings this
    // PR renamed, so they must not survive in the TOC that renders.
    for (const stale of ["Run the setup wizard", "Verify the install", "Install the local vault"]) {
      expect(quickStartToc).not.toContain(stale);
    }
  });
});

// The hero section carries BOTH `qs-hero` and `qs-final-hero`, and
// `.cd-docs-content .qs-hero` / `.cd-docs-content .qs-final-hero` have equal
// specificity — so source order decides, and the later one wins. The first
// pass of this PR changed the ratio on the earlier rule, which resolved to
// exactly nothing; measured in the browser, the columns stayed 500/494 with
// the install card no wider than the illustration beside it.
describe("the hero gives the install card the wider column", () => {
  const styles = readFileSync(
    new URL("../.vitepress/theme/styles.css", import.meta.url),
    "utf-8"
  );

  it("puts the ratio on the declaration that actually wins", () => {
    const early = styles.indexOf(".cd-docs-content .qs-hero {");
    const late = styles.indexOf(".cd-docs-content .qs-final-hero {");
    expect(early).toBeGreaterThan(-1);
    expect(late).toBeGreaterThan(-1);
    // If these ever swap order, the winning rule swaps with them.
    expect(late).toBeGreaterThan(early);

    const rule = styles.slice(late, styles.indexOf("}", late));
    const columns = rule.match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? "";
    const [first, second] = [...columns.matchAll(/([\d.]+)fr/g)].map((m) => Number(m[1]));

    expect(first, `qs-final-hero columns: ${columns}`).toBeGreaterThan(second);
  });

  it("only ever applies both classes to the same element", () => {
    // The reasoning above holds only because nothing uses `qs-hero` alone. If
    // something did, the earlier rule would be live for that page and leaving
    // it stale would be a real bug rather than a documented no-op.
    const users = readFileSync(
      new URL("../.vitepress/theme/components/QuickStartPage.vue", import.meta.url),
      "utf-8"
    );
    expect(users).toContain('class="docs-hero qs-hero qs-final-hero"');
  });
});
