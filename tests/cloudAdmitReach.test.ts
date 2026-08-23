import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse, compileStyle } from "@vue/compiler-sfc";

/**
 * Getting the Admit control within reach of the machine it admits.
 *
 * The complaint, verbatim: "even on a huge screen the actual permission grant
 * button is off to the right and below the fold." Both halves are layout, so
 * most of what matters here cannot be asserted at all from Node — there is no
 * layout engine in this suite, and no source match can see "below the fold".
 * The measurements that decided this change were taken in a browser and are
 * written up in the task report; what follows guards the mechanisms those
 * measurements depend on, so a later edit cannot quietly undo them.
 *
 * The first describe block does something the rest of this repo's CSS
 * assertions do not: it COMPILES the scoped style block. A `<style scoped>`
 * rule naming a class that only exists inside a child component compiles to
 * `.foo[data-v-...]` and matches nothing, and this plan has already shipped
 * five such rules by accident. A source match cannot tell a live rule from a
 * dead one; the compiler output can, because the scope attribute lands on the
 * element the selector ends at.
 */

const cloudPageUrl = new URL(
  "../.vitepress/theme/components/CloudPage.vue",
  import.meta.url
);
const cloudPage = readFileSync(cloudPageUrl, "utf-8");

const SCOPE_ID = "data-v-admitreach";

const descriptor = parse(cloudPage, { filename: "CloudPage.vue" }).descriptor;

/** CloudPage's own template — the elements that actually receive the scope. */
const cloudTemplate = descriptor.template?.content ?? "";

/** The scoped block, run through the same compiler the build uses. */
const compiledStyle = (() => {
  const scoped = descriptor.styles.find((style) => style.scoped);
  if (!scoped) throw new Error("CloudPage.vue has no <style scoped> block");
  return compileStyle({
    source: scoped.content,
    filename: "CloudPage.vue",
    id: SCOPE_ID,
    scoped: true,
  }).code;
})();

interface CssRule {
  /** One comma-separated selector, whitespace-normalised. */
  selector: string;
  /** Its declaration block, whitespace-normalised. */
  declarations: string;
  /** The at-rule preludes this rule sits inside, outermost first. */
  atRules: string[];
}

/**
 * Flatten the compiled sheet into rules.
 *
 * Written as a brace scanner rather than a regex because the compiler keeps the
 * source comments, so "the character before a selector" is very often `/` and
 * any anchor-on-`}` pattern silently misses the rule it was looking for.
 */
const cssRules: CssRule[] = (() => {
  const rules: CssRule[] = [];
  const open: string[] = [];
  let buffer = "";
  const clean = (value: string) =>
    value.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();

  for (const char of compiledStyle) {
    if (char === "{") {
      open.push(clean(buffer));
      buffer = "";
    } else if (char === "}") {
      const prelude = open.pop() ?? "";
      if (!prelude.startsWith("@")) {
        const atRules = open.filter((entry) => entry.startsWith("@"));
        for (const selector of prelude.split(",")) {
          const trimmed = clean(selector);
          if (trimmed) {
            rules.push({ selector: trimmed, declarations: clean(buffer), atRules });
          }
        }
      }
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return rules;
})();

/** Every compiled selector that mentions `cls`. */
function compiledSelectors(cls: string): string[] {
  const marker = new RegExp(`\\.${cls}(?![\\w-])`);
  return cssRules.filter((rule) => marker.test(rule.selector)).map((rule) => rule.selector);
}

/** The declarations of the compiled rule whose selector matches exactly. */
function declarationsFor(selector: string): string {
  const rule = cssRules.find((entry) => entry.selector === selector);
  if (!rule) throw new Error(`no compiled rule for ${selector}`);
  return rule.declarations;
}

/**
 * The classes on the last compound of a selector — the element Vue stamps.
 *
 * This is the whole test. Vue puts the scope attribute on the FINAL element of
 * every scoped selector whether or not this template renders one, so a compiled
 * `[data-v-...]` proves nothing on its own. A rule is live exactly when the
 * element it ends on is in CloudPage's own template.
 */
function scopedTargetClasses(selector: string): string[] {
  const compounds = selector.split(/\s+|(?=>)|(?<=>)/).filter((part) => part && part !== ">");
  const last = compounds[compounds.length - 1] ?? "";
  return [...last.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
}

describe("the device row's rules are live, not dead", () => {
  it("ends every device rule on an element this template renders", () => {
    // The five dead rules Task A found were dead because their selectors ended
    // on elements inside a child component, which never receive CloudPage's
    // scope attribute. Every device-row selector must terminate on a class this
    // template actually writes -- that, not the presence of `[data-v-...]`, is
    // what separates a live rule from a dead one.
    const deviceRules = cssRules.filter((rule) => /\.cv-device(?![\w-])/.test(rule.selector));
    expect(deviceRules.length).toBeGreaterThan(0);
    for (const rule of deviceRules) {
      expect(rule.selector, rule.selector).toContain(`[${SCOPE_ID}]`);
      for (const cls of scopedTargetClasses(rule.selector)) {
        expect(cloudTemplate, `${rule.selector} ends on .${cls}`).toContain(cls);
      }
    }
  });

  it("would notice a rule that ended inside a child component", () => {
    // The guard above is only worth having if it can fail. ConnectTerminal owns
    // .cv-terminal-body; a flat rule for it compiles to a perfectly
    // scoped-looking selector that matches nothing, which is exactly the shape
    // that shipped before.
    const dead = compileStyle({
      source: ".cv-connect-terminal .cv-terminal-body { color: red; }",
      filename: "CloudPage.vue",
      id: SCOPE_ID,
      scoped: true,
    }).code;
    expect(dead).toContain(`[${SCOPE_ID}]`);
    expect(scopedTargetClasses(`.cv-connect-terminal .cv-terminal-body[${SCOPE_ID}]`)).toEqual([
      "cv-terminal-body",
    ]);
    expect(cloudTemplate).not.toContain("cv-terminal-body");
  });

  it("carries the fingerprint contrast rule across the pending row", () => {
    // Two pending machines differ by their fingerprint and nothing else, so it
    // has to be readable on exactly the rows being told apart. Both halves of
    // this selector are CloudPage's, so it survives scoping.
    const selectors = compiledSelectors("cv-device-id").filter((s) =>
      s.includes("cv-device.pending")
    );
    expect(selectors).toHaveLength(1);
    expect(selectors[0]).toBe(
      `.cv-device.pending .cv-device-id code[${SCOPE_ID}]`
    );
    expect(declarationsFor(selectors[0])).toContain("color: var(--ink-2)");
  });
});

describe("the Admit control travels with the machine it admits", () => {
  it("stops the identity column absorbing the row's slack", () => {
    // This was `flex: 1 1 auto`. /cloud is full-bleed (.cd-full-content, and
    // .cv-shell sets no max-width), so on a 2560px monitor the row is 2236px
    // wide and a growing identity column put the hostname 2260px from the
    // Admit button that acts on it. A fixed basis is what keeps them together.
    const declarations = declarationsFor(`.cv-device-id[${SCOPE_ID}]`);
    expect(declarations).toContain("flex: 0 1 300px");
    expect(declarations).not.toContain("flex: 1 1 auto");
    // Still allowed to shrink, and still able to ellipsize inside.
    expect(declarations).toContain("min-width: 0");
  });

  it("keeps every row's controls on the same x", () => {
    // A content-width status column would step in and out by however many
    // characters the last timestamp needed ("just now" vs "first seen Aug 23"),
    // and the Admit buttons would stagger with it. Two staggered buttons on two
    // pending rows is precisely the thing you can misread.
    const declarations = declarationsFor(`.cv-device-seen[${SCOPE_ID}]`);
    expect(declarations).toContain("min-width: 132px");
    expect(declarations).toContain("align-items: flex-start");
    expect(declarations).not.toContain("align-items: flex-end");
  });

  it("leaves no rule re-aligning the status column at a narrower width", () => {
    // .cv-device-seen used to be right-aligned, with a media rule flipping it
    // to flex-start under 640px. Now that it is flex-start everywhere that rule
    // would be dead weight -- and dead CSS is what this plan keeps finding.
    const narrow = cssRules.filter(
      (rule) =>
        rule.atRules.some((at) => at.includes("max-width: 640px")) &&
        rule.selector.includes(".cv-device")
    );
    expect(narrow.length).toBeGreaterThan(0);
    for (const rule of narrow) {
      expect(rule.declarations, rule.selector).not.toContain("align-items");
    }
    // The floor has to go on a phone, or a timestamp squeezes out the hostname.
    const seen = narrow.find((rule) => rule.selector === `.cv-device-seen[${SCOPE_ID}]`);
    expect(seen?.declarations).toContain("min-width: 0");
  });
});

describe("the topbar says a machine is waiting even once one is linked", () => {
  const badges = cloudTemplate.slice(
    cloudTemplate.indexOf('<div class="cv-badges">'),
    cloudTemplate.indexOf("</header>")
  );

  it("reports pending alongside linked rather than instead of it", () => {
    // This was `v-else-if` on the "N machines linked" pill, so one active plus
    // one pending reported only "1 machine linked" -- and a second machine
    // running `autovault link` against a set-up vault is precisely the case
    // devicePollUrgent refuses to stop polling for. The badge went silent in
    // the one state where the poll was working hardest.
    expect(badges).toContain('v-if="activeDevices.length"');
    expect(badges).toContain('v-if="pendingDevices.length"');
    expect(badges).not.toContain('v-else-if="pendingDevices.length"');
    // Order matters: the thing asking for something comes after the statement
    // of fact, but it is its own branch, not a continuation of it.
    expect(badges.indexOf('v-if="activeDevices.length"')).toBeLessThan(
      badges.indexOf('v-if="pendingDevices.length"')
    );
  });

  it("is a control, and the only one among the badges", () => {
    // The Machines card is ~960px down the connect stage on a 2560x1080
    // screen. This is the handle back to it from where the count is announced.
    const at = badges.indexOf('v-if="pendingDevices.length"');
    const element = badges.slice(badges.lastIndexOf("<", at), badges.indexOf(">", at));
    expect(element).toContain("<button");
    expect(element).toContain('type="button"');
    expect(element).toContain('class="cv-pill warn cv-pill-jump"');
    expect(element).toContain('@click="jumpToMachines()"');
    // Every other badge in this row is a statement, and stays one.
    expect(badges.match(/<button/g)).toHaveLength(1);
  });

  it("routes through the same scroll the CLI handshake uses", () => {
    // Not a second scroll mechanism: one way to reach the machines list.
    const at = cloudPage.indexOf("function jumpToMachines()");
    expect(at).toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body).toContain('selectedSection.value = "machines";');
    expect(body).toContain("focusDevicesCard()");
    // Selecting a panel is not admitting anything, and a badge that named no
    // particular machine has no business putting focus on an Admit button.
    expect(body).not.toContain("decideDevice");
    expect(body).not.toContain(".focus()");
  });
});

describe("reaching the card does not have to be a journey", () => {
  it("jumps rather than glides when motion is turned down", () => {
    // `behavior: "smooth"` is advisory under prefers-reduced-motion, not
    // binding. Everywhere else on this page motion is spelled out rather than
    // left to the browser, and this is now on two paths (the CLI handshake and
    // the badge above), so it is worth being explicit about.
    const at = cloudPage.indexOf("async function focusDevicesCard()");
    expect(at).toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body).toContain("const jump = prefersReducedMotion() || document.visibilityState === \"hidden\";");
    expect(body).toContain('behavior: jump ? "auto" : "smooth"');
    // Read inside the function, never at setup scope -- the PR #88 class.
    expect(body.indexOf("prefersReducedMotion()")).toBeGreaterThan(-1);
    const setupHead = cloudPage.slice(
      cloudPage.indexOf("<script setup"),
      cloudPage.indexOf("async function focusDevicesCard()")
    );
    expect(setupHead).not.toMatch(/^const .*= prefersReducedMotion\(\)/m);
  });

  it("jumps in a background tab too, because nothing there animates", () => {
    // Measured: in a hidden document `scrollIntoView({behavior:"smooth"})`
    // leaves scrollY at 0 while "auto" moves it in the same frame. /cloud lands
    // in a background tab routinely -- `autovault link` opens the browser, the
    // Stripe return can arrive in a new one -- and this page has already been
    // bitten once by assuming a background tab animates (Task E's rAF ceiling).
    const at = cloudPage.indexOf("async function focusDevicesCard()");
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body).toContain('document.visibilityState === "hidden"');
  });
});

describe("a machine that checks in reaches the card by itself", () => {
  const at = cloudPage.indexOf("const arrivalShownIds = new Set<string>();");
  const watcher = cloudPage.slice(at, cloudPage.indexOf("\n);", at));

  it("exists, and is driven by the list rather than by a click", () => {
    expect(at).toBeGreaterThan(-1);
    expect(watcher).toContain("pendingDevices.value.map((device) => device.id)");
    expect(watcher).toContain("await focusDevicesCard();");
  });

  it("only at connect, where the page has already pointed at the card", () => {
    // .cv-nextstep promises the machine shows up "below". From explore on the
    // owner may be reading Billing, and a page that scrolls out from under them
    // is worse than the badge they can click.
    expect(watcher).toContain('if (currentStage !== "connect") return;');
  });

  it("waits for the veil rather than spending its one attempt behind it", () => {
    // Task E's regression, one watcher along: `revealed` is in the SOURCE so the
    // watcher wakes when the veil lifts, and the guard sits BEFORE the latch so
    // an attempt that could not have worked is not counted.
    expect(watcher).toContain("revealed.value,");
    const guard = watcher.indexOf("if (!isRevealed) return;");
    const latch = watcher.indexOf("arrivalShownIds.add");
    expect(guard).toBeGreaterThan(-1);
    expect(latch).toBeGreaterThan(guard);
  });

  it("yields to the CLI handshake instead of scrolling on top of it", () => {
    // The handshake scrolls, flashes AND focuses. Half of that again would
    // restart the flash mid-flash on the one row that named itself.
    expect(watcher).toContain("if (admitTarget.value) return;");
    expect(watcher.indexOf("if (admitTarget.value) return;")).toBeLessThan(
      watcher.indexOf("arrivalShownIds.add")
    );
  });

  it("does not steal focus, and cannot admit anything", () => {
    // Nothing here named a machine. Focus on a button that grants vault access
    // is what the ?admit= handshake earns by carrying a fingerprint.
    expect(watcher).not.toContain(".focus()");
    expect(watcher).not.toContain("decideDevice");
  });

  it("waits for the flush before it touches the DOM", () => {
    // A watcher callback runs before Vue renders, so at this point the card
    // still holds "Nothing enrolled yet" and the rows that are about to replace
    // it are not in the document.
    const tick = watcher.indexOf("await nextTick();");
    const scroll = watcher.indexOf("await focusDevicesCard();");
    expect(tick).toBeGreaterThan(-1);
    expect(scroll).toBeGreaterThan(tick);
  });

  it("does not try to decide whether the card is already visible", () => {
    // The connect stage grows while this runs: ConnectTerminal types its replay
    // out a line at a time and each line pushes the card down. Traced at
    // 2560x1080 the card's bottom went 1053 -> 1074 -> 1181 over seven seconds,
    // crossing the fold partway through -- so an in-view check measured at
    // arrival read "already visible" and skipped the scroll for a card that was
    // about to leave the window. It was flaky in the worst direction: it worked
    // whenever someone was watching it.
    expect(watcher).not.toContain("window.innerHeight");
    expect(watcher).not.toContain("getBoundingClientRect");
  });

  it("scrolls once per machine, not once per poll", () => {
    // The list reloads every four seconds. Re-scrolling on every response would
    // pin the page to this card.
    expect(watcher).toContain("!arrivalShownIds.has(device.id)");
    expect(watcher).toContain("for (const device of unseen) arrivalShownIds.add(device.id);");
  });

  it("runs nothing at setup scope", () => {
    // The admit watcher above is `{ immediate: true }`; this one deliberately is
    // not. There is nothing to do before a device list exists, and `revealed`
    // in the source is what wakes it for a row that arrived behind the veil.
    const tail = cloudPage.slice(
      cloudPage.indexOf("\n);", at),
      cloudPage.indexOf("\n);", at) + 8
    );
    expect(tail).not.toContain("immediate");
  });
});
