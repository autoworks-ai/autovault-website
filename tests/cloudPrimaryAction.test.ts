import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cloudNextAction, type CloudNextAction } from "../.vitepress/theme/utils/nextAction";

/**
 * One marker, on whichever control is the single required action.
 *
 * The complaint: "there's one button on each page that completes that page and
 * it moves around sometimes in the center, sometimes it's in the far right ...
 * Maybe it would be enough just to highlight the button somehow."
 *
 * Two halves, tested two different ways on purpose.
 *
 * The DECISION — which control, if any, is the one — is a pure function, and
 * the first block below runs it. "Exactly one marker on screen" is the whole
 * discipline of this change and it is not something a source match can check:
 * three `v-if`-guarded bindings in two components can all be true at once and
 * every one of them still reads correct in isolation.
 *
 * The WIRING — that those three bindings are the only three, and that each one
 * consumes the function's answer rather than re-deriving it — is a source
 * assertion, because the wiring is what a later edit would break.
 */

const componentUrl = (name: string) =>
  new URL(`../.vitepress/theme/components/${name}`, import.meta.url);

const cloudPage = readFileSync(componentUrl("CloudPage.vue"), "utf-8");
const funnel = readFileSync(componentUrl("HostedVaultFunnel.vue"), "utf-8");
const authControls = readFileSync(componentUrl("ClerkAuthControls.vue"), "utf-8");
const globalStyles = readFileSync(
  new URL("../.vitepress/theme/styles.css", import.meta.url),
  "utf-8"
);

const MARKER = "av-nextaction";

/** Every stage `stage` can compute. "loading" and "error" included. */
const STAGES = [
  "error",
  "loading",
  "account",
  "subscription",
  "setup",
  "connect",
  "explore",
  "ready",
] as const;

function site(
  stage: string,
  namedPendingMachine = false,
  machinesOnScreen = false
): CloudNextAction {
  return cloudNextAction({ stage, namedPendingMachine, machinesOnScreen });
}

/** A component's `<style scoped>` blocks, concatenated. */
function scopedStyles(source: string): string {
  let out = "";
  let at = source.indexOf("<style scoped>");
  while (at > -1) {
    out += source.slice(at, source.indexOf("</style>", at));
    at = source.indexOf("<style scoped>", at + 1);
  }
  return out;
}

describe("which control is the one thing to do next", () => {
  it("marks the funnel's primary at each pre-vault step", () => {
    expect(site("account")).toBe("funnel");
    expect(site("subscription")).toBe("funnel");
    expect(site("setup")).toBe("funnel");
  });

  it("marks the status strip's CTA once the vault is open", () => {
    expect(site("explore")).toBe("early-access");
  });

  it("marks nothing at ready, where nothing is left to do", () => {
    // A marker with no step behind it is worse than none: it is the page
    // insisting there is another one.
    expect(site("ready")).toBeNull();
    expect(site("ready", true, true)).toBeNull();
  });

  it("marks nothing while the page does not know what state this account is in", () => {
    // The loading stage exists because empty refs read as "signed out, nothing
    // bought, no vault". Marking the funnel's button here would be the same
    // confident-and-wrong claim in a different medium -- and it is behind the
    // boot veil, so it would be spent where nobody could see it.
    expect(site("loading")).toBeNull();
    expect(site("loading", true, true)).toBeNull();
  });

  it("marks nothing on the error stage, where the only control is a retry", () => {
    expect(site("error")).toBeNull();
    expect(site("error", true, true)).toBeNull();
  });

  it("marks the Admit button of a machine this page can name", () => {
    expect(site("connect", true, true)).toBe("admit");
  });

  it("marks nothing at connect when no single machine can be named", () => {
    // Two pending and nothing in the URL naming one: pointing at either would
    // be a guess delivered as an instruction, and admitting the wrong box is
    // the hazard the previous task removed. With none pending there is no
    // button here at all.
    expect(site("connect", false, true)).toBeNull();
    expect(site("connect")).toBeNull();
  });

  it("lets a waiting machine outrank the early-access ask", () => {
    // Both are rendered at explore -- a second machine can enrol long after the
    // first one opened the vault -- and this is the case where two markers
    // would otherwise appear. A CLI is blocked on the Admit; nothing is
    // blocked on early access.
    expect(site("explore", true, true)).toBe("admit");
  });

  it("falls back to the action that is actually on screen", () => {
    // The owner can be reading Billing, where the Machines card is in a panel
    // Vue is not rendering. A marker on an element that is not in the DOM is
    // no marker at all, so the one that IS on screen takes it.
    expect(site("explore", true, false)).toBe("early-access");
    // At connect there is no other control to fall back to.
    expect(site("connect", true, false)).toBeNull();
  });

  it("never names more than one site, for any combination of inputs", () => {
    // The exhaustive sweep. Every stage x named-machine x card-visible, with
    // the answer expanded into the three booleans the templates actually bind,
    // asserting at most one is ever true. This is the assertion the whole
    // change rests on and the one no source match could make.
    for (const stage of STAGES) {
      for (const named of [false, true]) {
        for (const visible of [false, true]) {
          const answer = site(stage, named, visible);
          const marked = [
            answer === "funnel",
            answer === "admit",
            answer === "early-access",
          ].filter(Boolean);
          expect(marked.length, `${stage}/${named}/${visible} marked ${marked.length}`)
            .toBeLessThanOrEqual(1);
          expect(
            answer === null || ["funnel", "admit", "early-access"].includes(answer),
            `${stage} produced an unknown site: ${answer}`
          ).toBe(true);
        }
      }
    }
  });

  it("marks something at every stage that still has a step in it", () => {
    // The other direction, so a future edit cannot satisfy "at most one" by
    // marking nothing anywhere. Every pre-vault stage and `explore` must name
    // a control.
    for (const stage of ["account", "subscription", "setup", "explore"]) {
      expect(site(stage), `${stage} has a step but marks nothing`).not.toBeNull();
    }
  });
});

describe("the marker is wired to that decision and to nothing else", () => {
  it("names the same three sites in the template that the function returns", () => {
    expect(cloudPage).toContain(`:marked-action="nextAction === 'funnel'"`);
    expect(cloudPage).toContain(`:class="{ 'av-nextaction': nextAction === 'early-access' }"`);
    expect(cloudPage).toContain(`:class="{ 'av-nextaction': isNextAction(device) }"`);
    // isNextAction is the admit branch, and it reads the same computed rather
    // than re-deriving "is this the target row" from the URL.
    expect(cloudPage).toContain(`return nextAction.value === "admit" && markedDevice.value?.id === device.id;`);
  });

  it("has exactly one place that decides, and it is not a template", () => {
    expect(cloudPage).toContain(`import { cloudNextAction, type CloudNextAction } from "../utils/nextAction";`);
    // One call site. A second would be a second opinion. Comments stripped
    // first -- the comment explaining the rule names the function it counts.
    const code = cloudPage
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*(\/\/|\*).*$/gm, " ");
    expect(code.match(/cloudNextAction\(/g)?.length).toBe(1);
  });

  it("writes the marker class in exactly the places that consume the decision", () => {
    // Four bindings for three sites: the funnel's primary has two branches
    // (checkout and reserve) that are mutually exclusive by `v-else-if`.
    const templateEnd = cloudPage.indexOf("<script setup");
    const cloudBindings = cloudPage.slice(0, templateEnd).match(/av-nextaction/g) ?? [];
    expect(cloudBindings.length, "CloudPage marks something new").toBe(2);

    const funnelTemplateEnd = funnel.indexOf("<script setup");
    const funnelBindings = funnel.slice(0, funnelTemplateEnd).match(/av-nextaction/g) ?? [];
    expect(funnelBindings.length, "the funnel marks something new").toBe(2);

    const authTemplateEnd = authControls.indexOf("<script setup");
    const authBindings = authControls.slice(0, authTemplateEnd).match(/av-nextaction/g) ?? [];
    // Signed-out Clerk modal button, and the no-Clerk fallback anchor. Both
    // are the same control in different environments, never both rendered.
    expect(authBindings.length, "the auth control marks something new").toBe(2);
  });

  it("keeps the marker off the topbar's copy of the auth control", () => {
    // ClerkAuthControls mounts on every page of the site. The marker means
    // "the one required action on THIS page", which the topbar's Sign in is
    // not, so the prop has to default false and the topbar must not set it.
    expect(authControls).toContain("markPrimary: false");
    const topbar = readFileSync(componentUrl("AvTopbar.vue"), "utf-8");
    expect(topbar).not.toContain("mark-primary");
    expect(topbar).not.toContain(MARKER);
  });

  it("leaves the ?admit= handshake's own hook untouched", () => {
    // data-admit-target is what the focus handshake queries for. The marker is
    // a second, independent binding on the same button -- adding it must not
    // have replaced it.
    expect(cloudPage).toContain(`:data-admit-target="isAdmitTarget(device) ? 'true' : undefined"`);
    expect(cloudPage).toContain(`"[data-admit-target='true']"`);
  });
});

describe("the marker rule is live, steady, and reduced-motion safe", () => {
  function markerRule(selector: string): string {
    const at = globalStyles.indexOf(`${selector} {`);
    expect(at, `no global rule for ${selector}`).toBeGreaterThan(-1);
    return globalStyles.slice(at, globalStyles.indexOf("}", at));
  }

  it("is global, because a scoped rule could only ever reach one of the three", () => {
    // The trap this page has already paid for five times: a `<style scoped>`
    // rule naming a class that lives in another component compiles to
    // `.foo[data-v-...]` and matches nothing. Three components wear this
    // marker, so a scoped definition is dead by construction in two of them.
    expect(globalStyles).toContain(`.${MARKER}::after {`);
    expect(scopedStyles(cloudPage)).not.toContain(MARKER);
    expect(scopedStyles(funnel)).not.toContain(MARKER);
    expect(scopedStyles(authControls)).not.toContain(MARKER);
  });

  it("draws on a pseudo-element, so hover cannot erase it", () => {
    // .cv-btn:hover and .cv-btn:active both set box-shadow, and both outrank a
    // plain .av-nextaction. A marker written as the button's own box-shadow
    // would disappear under the pointer at the exact moment of use.
    const rule = markerRule(`.${MARKER}::after`);
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("pointer-events: none");
    expect(markerRule(`.${MARKER}`)).toContain("position: relative");
  });

  it("reuses the page's accent rather than inventing a colour", () => {
    const rule = markerRule(`.${MARKER}::after`);
    expect(rule).toContain("var(--accent)");
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("is steady: nothing here repeats", () => {
    // "Steady, not pulsing" -- at connect the owner leaves to run CLI commands
    // and comes back, and something throbbing for minutes is fatiguing. The
    // one animation is a single fade-in when the marker first appears.
    const rule = markerRule(`.${MARKER}::after`);
    expect(rule).not.toContain("infinite");
    expect(rule).not.toContain("alternate");
    expect(rule).toContain("av-nextaction-in 320ms");
    expect(globalStyles).toContain("@keyframes av-nextaction-in");
  });

  it("lands on the drawn state when motion is turned down", () => {
    // The fade is filled `both`, and the site-wide reduced-motion rule only
    // zeroes the duration -- which is exactly how a `both`-filled animation
    // freezes at `from` instead of `to`. Named explicitly, the way this file
    // already handles .brand-mark-svg's `forwards` animations.
    const at = globalStyles.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    const block = globalStyles.slice(at);
    expect(block).toContain(`.${MARKER}::after`);
    const rule = block.slice(block.indexOf(`.${MARKER}::after`));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("animation: none");
    // The resting state is the drawn one, not the invisible first frame.
    expect(body).toContain("opacity: 1");
    expect(body).toContain("transform: none");
  });
});
