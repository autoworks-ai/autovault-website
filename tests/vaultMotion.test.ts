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
 *
 * Script comments only. An earlier version also stripped `<!-- -->`, which
 * CodeQL flagged as incomplete multi-character sanitization — correctly, in
 * the general case. It was never needed here: the sole assertion is that the
 * file contains no `watch(stage`, which lives in the script block where a
 * template comment cannot reach.
 */
const cloudCode = cloudPage
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
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
    // The condition itself is asserted by the two tests below — this one only
    // pins that there is exactly one place it can fire from, and that the
    // place is inside decideDevice rather than anywhere a render can reach.
    const body = cloudPage.slice(cloudPage.indexOf("async function decideDevice"));
    expect(body).toContain("celebrateUnlock();");
  });

  it("does not let a failed refresh swallow the celebration", () => {
    // loadDevices() is silent on failure by design — it also runs on a timer.
    // Reading vaultOpen back from it meant a transient blip on the follow-up
    // list request skipped the one celebration that matters, and with no stage
    // watcher nothing catches it later. A 2xx from the admit endpoint is
    // already proof the server activated the device.
    const body = cloudPage.slice(cloudPage.indexOf("async function decideDevice"));
    expect(body).toContain('const opened = action === "admit" && !wasOpen;');
    expect(body).toContain("if (opened) celebrateUnlock();");
    expect(body).not.toContain("!wasOpen && vaultOpen.value");
  });

  it("holds the vault open without waiting for the refresh", () => {
    // Decoupling the celebration from vaultOpen fixed a lost animation and
    // introduced a worse one: with the refresh failed, `devices` still held
    // the pending row, so the mark played the unlock and dropped back to
    // locked when the timer cleared. A vault that visibly opens and shuts is
    // worse than one that never animated.
    const body = cloudPage.slice(cloudPage.indexOf("async function decideDevice"));
    const optimistic = body.indexOf("devices.value = devices.value.map(");
    const refreshed = body.indexOf("await loadDevices();");
    expect(optimistic).toBeGreaterThan(-1);
    // Applied BEFORE the refresh, so a failed refresh cannot undo it.
    expect(optimistic).toBeLessThan(refreshed);
    expect(body).toContain('status: action === "admit" ? "active" : "revoked"');
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

describe("the sweep is visible on a vault that is already open", () => {
  it("restates opacity and scale on every scan frame", () => {
    // `.is-unlocked` rests the dial at opacity 0 / scale 0. A keyframe that
    // animated only rotation left the sweep invisible in exactly the
    // open-and-working case the separate boolean was introduced for.
    const kf = styles.slice(
      styles.indexOf("@keyframes brand-mark-scan"),
      styles.indexOf("@keyframes brand-mark-breathe")
    );
    const frames = kf.split("%").length - 1;
    expect(frames).toBeGreaterThan(1);
    expect((kf.match(/opacity: 1/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((kf.match(/scale\(1\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Not `forwards`: dropping is-working must return the dial to its state rule.
    const rule = styles.slice(styles.indexOf(".brand-mark-svg.is-working .brand-mark-dial {"));
    expect(rule.slice(0, rule.indexOf("}"))).not.toContain("forwards");
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
