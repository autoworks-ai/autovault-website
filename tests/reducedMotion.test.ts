import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { prefersReducedMotion } from "../.vitepress/theme/utils/motion";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({ matches: query.includes("reduce") ? matches : false })
  });
}

const ANIMATED_COMPONENTS = [
  "AvSpecHero.vue",
  "AvFolderHero.vue",
  "AvQuickStart.vue",
  "AvDriftDiagram.vue",
  "AvValidationGate.vue"
];

describe("prefersReducedMotion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports the user preference", () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is safe during SSR, where there is no window", () => {
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is safe where matchMedia is missing", () => {
    vi.stubGlobal("window", {});
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("JS animation loops", () => {
  // styles.css already zeroes CSS animation under the media query, but these
  // components drive content changes from setInterval, which the CSS reset
  // cannot reach. Each must bail out of its own accord.
  it.each(ANIMATED_COMPONENTS)("%s guards its timer on mount", (name) => {
    const source = readFileSync(
      new URL(`../.vitepress/theme/components/${name}`, import.meta.url),
      "utf-8"
    );
    expect(source).toContain("prefersReducedMotion");

    // Anchor on the hook call, not the `onMounted` import specifier.
    const hookAt = source.search(/onMounted\(/);
    expect(hookAt).toBeGreaterThan(-1);
    const body = source.slice(hookAt, hookAt + 400);

    const guard = body.indexOf("prefersReducedMotion()");
    const timer = body.search(/setInterval|start\(\)/);
    expect(guard).toBeGreaterThan(-1);
    expect(timer).toBeGreaterThan(-1);
    // The guard has to precede the timer, not merely coexist with it.
    expect(guard).toBeLessThan(timer);
  });
});
