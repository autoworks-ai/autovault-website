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
