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
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
} as const;

describe("preselecting an install command", () => {
  it("gives desktops the command that works there", () => {
    // curl is the only channel with no prerequisite of its own, and the only
    // one that provisions ~/.autovault. Windows has no shell for it and no
    // brew, so npm is the only line that runs.
    expect(installMethodFor(UA.mac, 0)).toEqual({ method: "curl", label: "macOS" });
    expect(installMethodFor(UA.linux, 0)).toEqual({ method: "curl", label: "Linux" });
    expect(installMethodFor(UA.windows, 0)).toEqual({ method: "npm", label: "Windows" });
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
