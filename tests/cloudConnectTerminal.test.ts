import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The connect stage's terminal card, and the bridge from it to the Machines
 * list.
 *
 * vitest.config.ts is `environment: "node"` with no @vue/test-utils, so every
 * assertion here is a source match rather than a render. That limit is the
 * whole reason this file exists in the shape it does: the defect these tests
 * were written for was a set of `<style scoped>` rules that compiled to
 * selectors matching nothing, and "the rule is present in the file" is exactly
 * the kind of evidence that cannot tell that apart from "the rule applies".
 *
 * So the load-bearing test below is not "is there CSS for the copy button" —
 * it is the scope-boundary invariant: every class ConnectTerminal renders on a
 * NON-root element must be styled through `:deep()` or by a global rule, never
 * by a flat selector in CloudPage's scoped block. That one is decidable from
 * source, and it is the failure that shipped.
 */
const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
  "utf-8"
);
const globalStyles = readFileSync(
  new URL("../.vitepress/theme/styles.css", import.meta.url),
  "utf-8"
);

/** CloudPage's single `<style scoped>` block. */
function styleBlock(): string {
  const at = cloudPage.indexOf("<style scoped>");
  expect(at, "CloudPage has no scoped style block").toBeGreaterThan(-1);
  return cloudPage.slice(at, cloudPage.indexOf("</style>", at));
}

/** The same block with `/* … *​/` comments removed. The boundary test below
 *  scans for selectors, and the comments explaining the boundary naturally
 *  quote the very selectors it is looking for. */
function styleRules(): string {
  return styleBlock().replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The `defineComponent` body of the ConnectTerminal child. */
function connectTerminalSource(): string {
  const at = cloudPage.indexOf("const ConnectTerminal = defineComponent(");
  expect(at, "no ConnectTerminal component").toBeGreaterThan(-1);
  const end = cloudPage.indexOf("\n});", at);
  expect(end, "ConnectTerminal is not closed as expected").toBeGreaterThan(at);
  return cloudPage.slice(at, end);
}

/** The `<div class="cv-connect-terminal">…</div>` wrapper in CloudPage's own
 *  template, which is where the static chrome lives. */
function connectWrapperMarkup(): string {
  const at = cloudPage.indexOf('<div class="cv-connect-terminal">');
  expect(at, "no .cv-connect-terminal wrapper").toBeGreaterThan(-1);
  const end = cloudPage.indexOf("<ConnectTerminal", at);
  expect(end, "ConnectTerminal is not mounted inside the wrapper").toBeGreaterThan(at);
  return cloudPage.slice(at, end);
}

/** The body of one rule, given its exact selector text. */
function ruleBody(selector: string): string {
  const css = styleBlock();
  const at = css.indexOf(`${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

function flatten(text: string): string {
  return text.replace(/\s+/g, " ");
}

describe("connect terminal chrome", () => {
  it("renders the same head/dots/title bar as the reserve-step terminal", () => {
    // Matching HostedVaultFunnel.vue's already-shipped block rather than
    // inventing a second terminal language for the same product.
    const markup = flatten(connectWrapperMarkup());
    expect(markup).toContain('<div class="terminal-head">');
    expect(markup).toContain('style="background: #d97171"');
    expect(markup).toContain('style="background: #e8a866"');
    expect(markup).toContain('class="dot live"');
    expect(markup).toContain('<span class="ttl">~ — autovault — bash</span>');
  });

  it("puts the chrome in CloudPage's template, not inside the child", () => {
    // The scope-attribute hazard again, from the other direction: static
    // markup here can be styled normally, and `.cv-connect-terminal
    // .terminal-head` below depends on that.
    expect(connectTerminalSource()).not.toContain("terminal-head");
  });

  it("styles the chrome off global classes, which ignore scope ids", () => {
    for (const rule of [".terminal-head {", ".dot.live {", ".terminal-head .ttl {"]) {
      expect(globalStyles, `styles.css is missing ${rule}`).toContain(rule);
    }
  });

  it("gives .cv-connect-terminal a real frame", () => {
    // It had zero rules anywhere in the repo, so the terminal rendered as
    // loose text on the focal card's gradient with no card of its own.
    const body = ruleBody(".cv-connect-terminal");
    expect(body).toContain("border:");
    expect(body).toContain("border-radius:");
    // Without this the head's square top corners sit over the radius.
    expect(body).toContain("overflow: hidden");
  });
});

describe("scoped-style boundary into ConnectTerminal", () => {
  /**
   * Vue stamps a child component's root element, and only its root, with the
   * parent's scoped-style attribute. A flat `.cv-foo` rule in CloudPage's
   * scoped block therefore cannot match anything inside ConnectTerminal
   * except its outermost div — it compiles to `.cv-foo[data-v-x]` and silently
   * matches nothing.
   *
   * This is not hypothetical: `.cv-terminal-body`, `.cv-cmd-copy`,
   * `.cv-cmd-copy:hover`, `.cv-cmd-copy:focus-visible` and the reduced-motion
   * `.cv-cmd-copy` rule were all written flat and all dead, which is why the
   * connect terminal shipped with the global 400px `.terminal-body` height and
   * a browser-default "Copy" button.
   */
  const ROOT_CLASS = "cv-terminal-wrapper";

  function childClasses(): string[] {
    const source = connectTerminalSource();
    const found = new Set<string>();
    for (const [, list] of source.matchAll(/class: "([^"]+)"/g)) {
      for (const name of list.split(/\s+/)) {
        if (name.startsWith("cv-")) found.add(name);
      }
    }
    return [...found];
  }

  it("renders from a single root element", () => {
    const source = connectTerminalSource();
    expect(source).toContain(`h("div", { class: "${ROOT_CLASS}" }, [`);
  });

  it("styles every non-root class through :deep(), never flat", () => {
    const css = styleRules();
    const classes = childClasses().filter((name) => name !== ROOT_CLASS);
    // Guard the guard: if the render function stops using cv- classes this
    // test would pass vacuously.
    expect(classes.length).toBeGreaterThan(0);

    for (const name of classes) {
      const flat = [...css.matchAll(new RegExp(`(?<!:deep\\()\\.${name}\\b`, "g"))];
      expect(
        flat.length,
        `.${name} is styled flat in CloudPage's scoped block; it is inside ` +
          `ConnectTerminal, so that rule matches nothing. Wrap it as ` +
          `.cv-connect-terminal :deep(.${name}).`
      ).toBe(0);
    }
  });

  it("beats the global .terminal-body height that was showing instead", () => {
    expect(globalStyles.slice(globalStyles.indexOf(".terminal-body {"))).toContain("400px");
    const body = ruleBody(".cv-connect-terminal :deep(.cv-terminal-body)");
    expect(body).toContain("min-height: auto");
    expect(body).toContain("max-height: none");
  });
});

describe("connect terminal copy button", () => {
  it("reads as a button rather than bare text", () => {
    const body = ruleBody(".cv-connect-terminal :deep(.cv-cmd-copy)");
    // Same shape as `.hosted-copy-row button` in styles.css, which is the
    // approved reference: bordered, 32px tall, 11px mono.
    expect(body).toContain("border:");
    expect(body).toContain("border-radius:");
    expect(body).toContain("min-height: 32px");
    expect(body).toContain("font: 11px var(--mono)");
    expect(body).toContain("cursor: pointer");
    expect(ruleBody(".cv-connect-terminal :deep(.cv-cmd-copy:hover)")).toContain(
      "var(--accent)"
    );
  });

  it("holds its width through the 'Copied' label swap", () => {
    // "Copy commands" -> "Copied" is ~40px narrower; without a floor the one
    // control this stage asks people to press shrinks and snaps back.
    const source = connectTerminalSource();
    expect(source).toContain('copied.value ? "Copied" : "Copy commands"');
    expect(ruleBody(".cv-connect-terminal :deep(.cv-cmd-copy)")).toContain("min-width:");
  });

  it("keeps a keyboard focus ring", () => {
    expect(
      ruleBody(".cv-connect-terminal :deep(.cv-cmd-copy:focus-visible)")
    ).toContain("outline: 2px solid var(--accent)");
  });

  it("sits in a row below the terminal, clear of the new head bar", () => {
    // It used to be `position: absolute; top: 10px; right: 10px`, which is
    // exactly where the title bar now is.
    const body = ruleBody(".cv-connect-terminal :deep(.cv-cmd-copy)");
    expect(body).not.toContain("position: absolute");
    expect(connectTerminalSource()).toContain('class: "cv-copy-row"');
  });
});

describe("connect terminal accessibility contract", () => {
  it("keeps the static transcript paired with the aria-hidden replay", () => {
    // The replay types character by character and is aria-hidden for that
    // reason, which leaves the visually-hidden <pre> as the only
    // screen-reader-reachable copy of the commands to run.
    const source = connectTerminalSource();
    expect(source).toContain('h("pre", { class: "visually-hidden" }');
    expect(source).toContain('h("code", commands.value.join("\\n"))');
    const bodyAt = source.indexOf('class: "terminal-body cv-terminal-body"');
    expect(bodyAt).toBeGreaterThan(-1);
    expect(source.slice(bodyAt, source.indexOf("}", bodyAt) + 1)).toContain(
      '"aria-hidden": "true"'
    );
  });

  it("still tells the truth about what linking does", () => {
    // Styling task only: linking ends PENDING, so the last replay line must
    // not become a tick. Read off the `lines` computed with its comments
    // stripped -- the comment that explains the rule quotes the tick it
    // forbids, so a whole-file match would never be able to fail.
    const at = cloudPage.indexOf("const lines = computed<TerminalReplayLine[]>");
    expect(at, "no replay lines in ConnectTerminal").toBeGreaterThan(-1);
    const body = cloudPage
      .slice(at, cloudPage.indexOf("]);", at))
      .replace(/^\s*\/\/.*$/gm, "");
    expect(body).toContain("⧗ waiting for you to admit it below");
    expect(body).not.toContain("✓ linked successfully");
  });
});

describe("the next step after the terminal", () => {
  it("bridges the terminal's 'below' to the Machines card", () => {
    const at = cloudPage.indexOf('<div class="cv-nextstep">');
    expect(at, "no .cv-nextstep bridge").toBeGreaterThan(-1);
    const markup = flatten(cloudPage.slice(at, cloudPage.indexOf("</template>", at)));
    expect(markup).toContain("<strong>Machines</strong>");
    expect(markup).toContain("Admit it there");
    // Decorative, like .cv-focal-glow — the sentence carries the meaning.
    expect(markup).toContain('<span class="cv-nextstep-rule" aria-hidden="true" />');
    expect(markup).toContain('<span class="cv-nextstep-caret" aria-hidden="true">↓</span>');
  });

  it("renders the bridge only at the connect stage", () => {
    // Inside `<template v-if="stage === 'connect'">`, whose closing tag is the
    // first one after the bridge.
    const stageAt = cloudPage.indexOf("<template v-if=\"stage === 'connect'\">");
    const bridgeAt = cloudPage.indexOf('<div class="cv-nextstep">');
    expect(stageAt).toBeGreaterThan(-1);
    expect(bridgeAt).toBeGreaterThan(stageAt);
    expect(cloudPage.indexOf("</template>", stageAt)).toBeGreaterThan(bridgeAt);
  });

  it("marks the Machines card as the live target while connecting", () => {
    const at = cloudPage.indexOf('ref="devicesCard"');
    expect(at).toBeGreaterThan(-1);
    const tag = cloudPage.slice(at, cloudPage.indexOf(">", at));
    // Added to the existing binding: `focusflash` is the admit handshake's
    // transient flash and must survive.
    expect(tag).toContain("focusflash: devicesFlash");
    expect(tag).toContain("awaiting: stage === 'connect'");
    const body = ruleBody(".cv-devices.standalone.awaiting");
    expect(body).toContain("var(--accent)");
  });
});
