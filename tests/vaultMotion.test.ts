import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf-8");
const cloudPage = read(".vitepress/theme/components/CloudPage.vue");

/**
 * Source with comments removed.
 *
 * The `watch(stage` guard below matched this file's own comment explaining why
 * that pattern is wrong — the same shape as a `merge_group` mention in a YAML
 * comment masking a deleted trigger. A guard that a comment can satisfy is not
 * a guard, and rewording the comment only defers the problem to the next one.
 */
const cloudCode = cloudPage
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/<!--[\s\S]*?-->/g, "");
const brandMark = read(".vitepress/theme/components/BrandMark.vue");
const styles = read(".vitepress/theme/styles.css");

describe("the unlock fires on the event, not on the render", () => {
  it("never watches stage", () => {
    // The highest-value assertion here. `watch(stage)` is the obvious way to
    // build this and it celebrates on every reload for every returning
    // customer: CloudPage loads /api/me twice, the first response is anonymous
    // and computes stage "setup", the second returns the real vault and jumps
    // to "ready". Any "previous was non-null" guard fires on that pair.
    expect(cloudCode).not.toContain("watch(stage");
    expect(cloudCode).not.toContain("watch(() => stage");
    // And prove the stripper actually removed something, so a future change to
    // it cannot make this pass by emptying the haystack.
    expect(cloudCode.length).toBeLessThan(cloudPage.length);
    expect(cloudCode).toContain("function celebrateUnlock");
  });

  it("celebrates only where a machine is actually admitted", () => {
    const calls = cloudPage.match(/celebrateUnlock\(\)/g) ?? [];
    // One definition, one call site.
    expect(calls).toHaveLength(2);
    expect(cloudPage).toContain(
      'if (action === "admit" && !wasOpen && vaultOpen.value) celebrateUnlock();'
    );
  });

  it("compares against the state the owner saw, not the refreshed one", () => {
    // `wasOpen` has to be read before loadDevices(), or it already reflects the
    // admit and the vault never appears to have changed.
    const body = cloudPage.slice(cloudPage.indexOf("async function decideDevice"));
    const captured = body.indexOf("const wasOpen = vaultOpen.value;");
    const firstAwait = body.indexOf("await ");
    const refreshed = body.indexOf("await loadDevices();");
    expect(captured).toBeGreaterThan(-1);
    expect(captured).toBeLessThan(refreshed);
    // Before ANY await, not merely before the refresh. The four-second device
    // poll can land while the admit request is in flight, see the device the
    // server has already activated, and flip vaultOpen first — so a capture
    // taken after the fetch reads true and the owner's first machine gets no
    // celebration at all.
    expect(captured).toBeLessThan(firstAwait);
  });

  it("reads the motion preference inside the handler", () => {
    // Never at setup scope: a media-query read there is the hydration-mismatch
    // class fixed in PR #88. Inside a click handler it cannot contribute.
    const fn = cloudPage.slice(
      cloudPage.indexOf("function celebrateUnlock"),
      cloudPage.indexOf("onBeforeUnmount(() => {\n  if (vaultUnlockTimer)")
    );
    expect(fn).toContain("if (prefersReducedMotion()) return;");
  });
});

describe("the celebration happens at the size it was staged at", () => {
  it("holds the focal mark through the unlock", () => {
    // Admitting flips the stage in the same tick, so gating on `!vaultOpen`
    // alone unmounted the 72px mark and played the gesture on the 34px strip
    // icon that had just replaced it.
    expect(cloudPage).toContain('v-if="!vaultOpen || vaultUnlocking"');
  });

  it("never shows two vaults at once", () => {
    expect(cloudPage).toContain('v-show="!vaultUnlocking" class="cv-status-mark"');
  });
});

describe("the keyframe lands on the resting state", () => {
  it("ends exactly where .is-unlocked rests", () => {
    // `.is-unlocked .brand-mark-dial` rests at opacity 0 / scale 0. If the
    // keyframe's 100% frame does not match, removing the class snaps. At
    // scale(0) the rotation is visually identity, which is what lets a
    // rotated end frame agree with an unrotated resting one.
    const resting = styles.slice(
      styles.indexOf(".brand-mark-svg.is-unlocked .brand-mark-dial {"),
      styles.indexOf("}", styles.indexOf(".brand-mark-svg.is-unlocked .brand-mark-dial {"))
    );
    expect(resting).toContain("opacity: 0");
    expect(resting).toContain("transform: scale(0)");

    const kf = styles.slice(
      styles.indexOf("@keyframes brand-mark-unlock"),
      styles.indexOf("@keyframes brand-mark-open")
    );
    expect(kf).toContain("transform: rotate(140deg) scale(0)");
    expect(kf).toContain("opacity: 0");
  });

  it("still lands there when motion is reduced", () => {
    // These keyframes use `forwards`. The site-wide reduced-motion block only
    // zeroes durations, so without an explicit destination the dial would be
    // left at its pre-unlock state instead of its resting one.
    const rm = styles.slice(styles.indexOf(".brand-mark-svg.is-working .brand-mark-dial,\n  .brand-mark-svg.is-working"));
    expect(rm).toContain("transform: rotate(140deg) scale(0)");
  });
});

describe("BrandMark exposes the states without losing the resting one", () => {
  it("keeps working and unlocking as separate flags", () => {
    // Not extra members of BrandMarkState: a vault can be open *and* working
    // (a second machine checking in), and `unlocking` has to sit on top of
    // `unlocked` so the keyframe can land on that resting state.
    expect(brandMark).toContain("working?: boolean");
    expect(brandMark).toContain("unlocking?: boolean");
    expect(brandMark).toContain("'is-working': working");
    expect(brandMark).toContain("'is-unlocking': unlocking");
  });
});

// The connect stage used to read as four stacked strangers: the mark, the
// rail, a greeting that paraphrased the card beneath it, then the card. Two of
// those are now one unit and one is gone.
describe("the connect stage is one thing, not four", () => {
  it("groups the mark and the progress rail", () => {
    expect(cloudPage).toContain('class="cv-vaulthead"');
    const head = cloudPage.slice(
      cloudPage.indexOf('class="cv-vaulthead"'),
      cloudPage.indexOf("</ol>")
    );
    expect(head).toContain("cv-vaultfocal");
    expect(head).toContain("cv-rail");
  });

  it("drops the greeting the focal card already said", () => {
    // The card carries a "Reserved" pill, the endpoint, and the heading this
    // sentence was paraphrasing.
    expect(cloudPage).not.toContain("Welcome — your vault is reserved");
  });

  it("lets the current step's detail line be read in full", () => {
    // The base rule caps it at 150px with nowrap + ellipsis, which is right
    // for a four-across row and clipped "Point your CLI at the namespace" to
    // "…at the nama…" once the rail became a centered caption.
    const rule = cloudPage.slice(
      cloudPage.indexOf(".cv-vaulthead .cv-rail-step.active .cv-rail-copy small {")
    );
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("max-width: none");
    expect(body).toContain("white-space: normal");
  });

  it("keeps the rail's accessible state text", () => {
    // Only the per-step detail line is hidden, never the state label — the
    // rail must not convey progress by colour and position alone.
    expect(cloudPage).toContain("RAIL_STATE_LABEL[step.state]");
    expect(cloudPage).toContain('class="visually-hidden"');
    const hide = cloudPage.slice(cloudPage.indexOf(".cv-vaulthead .cv-rail-copy small {"));
    expect(hide.slice(0, hide.indexOf("}"))).toContain("display: none");
    expect(hide.slice(0, hide.indexOf("}"))).not.toContain("visually-hidden");
  });
});
