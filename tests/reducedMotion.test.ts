import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { prefersReducedMotion } from "../.vitepress/theme/utils/motion";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({ matches: query.includes("reduce") ? matches : false })
  });
}

// AvValidationGate.vue is deliberately excluded: its guard lives entirely
// inside start() (invoked from onMounted, a scenario click, and the pause/
// resume toggle), never duplicated at the onMounted call site itself, so a
// forward slice from `onMounted(` finds no guard to compare against a timer
// position. Its own dedicated tests below cover both halves of the same
// invariant -- the guard precedes the timer inside start(), and onMounted
// delegates to it rather than re-checking and short-circuiting.
const ANIMATED_COMPONENTS = [
  "AvSpecHero.vue",
  "AvFolderHero.vue",
  "AvQuickStart.vue",
  "AvDriftDiagram.vue"
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
  //
  // The guard belongs strictly inside onMounted, never in a ref's initial
  // value or any other setup-scope code: VitePress prerenders these pages,
  // and prefersReducedMotion() always reads false server-side (no `window`).
  // Reading it before onMounted would make the client's first computed value
  // diverge from the server-rendered DOM for a reduced-motion visitor -- a
  // hydration mismatch Vue silently patches, but only after rendering the
  // wrong state for an instant (caught by Codex review on PR #88, in
  // AvQuickStart.vue's `playing` ref).
  it.each(ANIMATED_COMPONENTS)("%s guards its timer on mount, not at setup time", (name) => {
    const source = readFileSync(
      new URL(`../.vitepress/theme/components/${name}`, import.meta.url),
      "utf-8"
    );
    expect(source).toContain("prefersReducedMotion");

    // Anchor on the hook call, not the `onMounted` import specifier. A call
    // to prefersReducedMotion() textually before this point is fine as long
    // as it sits inside a function *definition* (e.g. AvValidationGate's
    // start(), only ever invoked from onMounted or a click handler, both
    // client-only) rather than executing at component-setup time -- setup-
    // scope execution is the specific SSR/hydration hazard the two tests
    // below guard against directly, by literal pattern, for each component
    // where it was actually found.
    const hookAt = source.search(/onMounted\(/);
    expect(hookAt).toBeGreaterThan(-1);

    const body = source.slice(hookAt, hookAt + 900);
    const guard = body.indexOf("prefersReducedMotion()");
    const timer = body.search(/setInterval|start\(\)/);
    expect(guard).toBeGreaterThan(-1);
    expect(timer).toBeGreaterThan(-1);
    // The guard has to precede the timer, not merely coexist with it.
    expect(guard).toBeLessThan(timer);
  });
});

describe("reduced-motion interactive fixes", () => {
  it("AvQuickStart corrects the play/pause control post-mount, not by diverging its SSR initial value", () => {
    const source = readFileSync(
      new URL("../.vitepress/theme/components/AvQuickStart.vue", import.meta.url),
      "utf-8"
    );
    // Two bugs, fixed in sequence: first, a plain early-return guard left
    // `playing` hardcoded to `true` regardless, so the toggle button read
    // "Pause scan" while nothing was running under reduced motion. Baking
    // the check into the ref's initial value fixed the label but broke SSR
    // hydration (prefersReducedMotion() always reads false server-side, so
    // a reduced-motion client's first computed value would diverge from the
    // prerendered DOM). The initial value must stay a plain literal;
    // `playing.value = false` belongs inside onMounted instead.
    expect(source).toMatch(/const playing = ref\(true\)/);
    const hookAt = source.search(/onMounted\(/);
    const mountBody = source.slice(hookAt, hookAt + 400);
    const guardInMount = mountBody.indexOf("prefersReducedMotion()");
    const correction = mountBody.indexOf("playing.value = false");
    expect(guardInMount).toBeGreaterThan(-1);
    expect(correction).toBeGreaterThan(-1);
    expect(guardInMount).toBeLessThan(correction);
  });

  it("AvValidationGate guards the interval at its single source, not only at mount", () => {
    const source = readFileSync(
      new URL("../.vitepress/theme/components/AvValidationGate.vue", import.meta.url),
      "utf-8"
    );
    // chooseScenario() -> replay() -> start() used to ignore the preference
    // entirely, so clicking any scenario tile resumed the content-changing
    // interval even with reduced motion on. The guard has to live inside
    // start() itself so every caller (mount, scenario click, toggle) is
    // covered, not just the mount-time call.
    const startAt = source.indexOf("function start()");
    expect(startAt).toBeGreaterThan(-1);
    const startBody = source.slice(startAt, startAt + 900);
    const guard = startBody.indexOf("prefersReducedMotion()");
    const timer = startBody.indexOf("setInterval");
    expect(guard).toBeGreaterThan(-1);
    expect(timer).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(timer);
  });

  it("AvValidationGate settles to a finished state on mount under reduced motion, instead of staying queued", () => {
    const source = readFileSync(
      new URL("../.vitepress/theme/components/AvValidationGate.vue", import.meta.url),
      "utf-8"
    );
    // onMounted used to check prefersReducedMotion() itself and return early
    // without calling start() at all -- `running` stayed at its initial
    // `true` and `tick` at 0, so the demo showed every step QUEUED forever
    // and the toggle read "Pause" for a scan that was never running. start()
    // already has its own reduced-motion guard that settles both; onMounted
    // must delegate to it, not duplicate (and shortcut) the check.
    const hookAt = source.search(/onMounted\(/);
    const mountBody = source.slice(hookAt, hookAt + 450);
    expect(mountBody).not.toMatch(/if \(prefersReducedMotion\(\)\) return/);
    expect(mountBody).toContain("if (running.value) start()");
  });
});
