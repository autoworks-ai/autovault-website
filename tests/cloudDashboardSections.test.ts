import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The /cloud dashboard's section switcher.
 *
 * vitest.config.ts is `environment: "node"` with no @vue/test-utils, so every
 * assertion here is a source match rather than a render. That is a real limit
 * and it is worth naming: a `v-if` that is never true would satisfy every test
 * below. What these can prove is the wiring -- that each nav item names a
 * section, that the click handler assigns exactly that value, that a template
 * block is keyed on it, and that the locked items cannot reach any of it.
 */
const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
  "utf-8"
);
const accountMenu = readFileSync(
  new URL("../.vitepress/theme/components/CloudAccountMenu.vue", import.meta.url),
  "utf-8"
);

/** The `section:` a nav item selects, read off its own item() call. */
function sectionOf(key: string): string | null {
  const at = cloudPage.indexOf(`item("${key}"`);
  expect(at, `no nav item named ${key}`).toBeGreaterThan(-1);
  const call = cloudPage.slice(at, cloudPage.indexOf("\n", at));
  return /section: "([a-z]+)"/.exec(call)?.[1] ?? null;
}

/** The stage SECTION_REVEAL gates a section behind, or null for "always". */
function revealTable(): Record<string, string | null> {
  const at = cloudPage.indexOf("const SECTION_REVEAL");
  expect(at, "no SECTION_REVEAL table").toBeGreaterThan(-1);
  const body = cloudPage.slice(at, cloudPage.indexOf("};", at));
  const rows: Record<string, string | null> = {};
  for (const [, name, value] of body.matchAll(/^\s{2}(\w+): (?:"(\w+)"|null),/gm)) {
    rows[name] = value ?? null;
  }
  return rows;
}

describe("the sidebar selects a panel", () => {
  it("keeps one ref and one computed instead of a router", () => {
    // /cloud is one page. A URL that named a panel would have to survive the
    // Stripe and Clerk round trips that already own this page's query string
    // and its #launch-path fragment.
    expect(cloudPage).toContain('const selectedSection = ref<Section>("overview");');
    expect(cloudPage).toContain("const activeSection = computed<Section>(");
    expect(cloudPage).not.toContain("vue-router");
    expect(cloudPage).not.toContain("useRoute");
  });

  it("defaults to overview", () => {
    expect(cloudPage).toContain('ref<Section>("overview")');
    // And overview is ungated, so the default is reachable at every stage --
    // including "error", where STAGE_ORDER.indexOf is -1 and only the null
    // branch of stageReached can pass.
    expect(revealTable().overview).toBeNull();
    expect(cloudPage).toContain("return at === null || STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(at);");
  });

  it("falls back to overview when the selected panel stops being reachable", () => {
    // Revoking the last machine drops the stage from explore back to connect,
    // which re-locks Billing and Skills. Without the fallback the main area
    // would keep rendering a panel whose own nav item is disabled.
    const at = cloudPage.indexOf("const activeSection = computed<Section>(");
    const body = cloudPage.slice(at, cloudPage.indexOf(");", at));
    expect(body).toContain("stageReached(SECTION_REVEAL[selectedSection.value], stage.value)");
    expect(body).toContain("selectedSection.value");
    expect(body).toContain('"overview"');
  });

  it("gives every section a nav item, a reveal stage and a panel", () => {
    // The whole mechanism in one assertion. Each key has to appear in all
    // three places or it is either unreachable or an empty main area.
    const wiring: Array<[key: string, section: string]> = [
      ["overview", "overview"],
      ["skills", "skills"],
      ["sync", "machines"],
      ["billing", "billing"],
    ];
    const table = revealTable();
    for (const [key, section] of wiring) {
      expect(sectionOf(key), `nav item ${key}`).toBe(section);
      expect(Object.keys(table), `SECTION_REVEAL.${section}`).toContain(section);
      // Machines is the one panel rendered outside the v-if/v-else-if chain,
      // because it is also part of the overview and it starts at `connect`.
      const marker =
        section === "machines"
          ? '<template v-if="showsMachines">'
          : `activeSection === '${section}'`;
      expect(cloudPage, `no panel for ${section}`).toContain(marker);
    }
  });

  it("reveals a nav item exactly when its panel exists", () => {
    // One table, read by the lock and by the fallback both. Repeating the
    // stage on the item is what let a nav item unlock before its destination
    // rendered -- a live-looking button that did nothing.
    const table = revealTable();
    expect(table).toEqual({
      overview: null,
      machines: "connect",
      skills: "explore",
      billing: "explore"
    });
    expect(cloudPage).toContain(
      "const revealAt = opts.revealAt ?? (opts.section ? SECTION_REVEAL[opts.section] : null);"
    );
    // All three derivations must read the resolved value. Leaving any of them
    // on opts.revealAt silently drops the "new" badge, which nothing renders a
    // test failure for.
    expect(cloudPage).toContain("const revealed = stageReached(revealAt, s);");
    expect(cloudPage).toContain("const justRevealed = revealAt !== null && revealAt === s;");
    expect(cloudPage).toContain("const locked = Boolean(opts.soon) || !revealed;");
  });

  it("keeps the vault strip as stage chrome rather than overview content", () => {
    // .cv-status-card is what the 72px focal mark shrinks into when a machine
    // is admitted -- and admitting happens from the MACHINES panel, because
    // the CLI's ?admit= link selects it. Moved inside the overview panel, the
    // strip was not rendered at that moment: the mark played its 700ms unlock,
    // cv-vaulthead then unmounted, and the gesture landed on nothing. It has
    // to sit above the panel chain, inside the stage template.
    const stageAt = cloudPage.indexOf(`v-if="stage === 'explore' || stage === 'ready'"`);
    const cardAt = cloudPage.indexOf('class="cv-status-card"');
    const overviewAt = cloudPage.indexOf(`v-if="activeSection === 'overview'"`);
    expect(stageAt, "no explore/ready stage template").toBeGreaterThan(-1);
    expect(cardAt, "no status card").toBeGreaterThan(stageAt);
    expect(cardAt, "status card is inside a panel").toBeLessThan(overviewAt);
  });

  it("marks the selected item active rather than hardcoding Overview", () => {
    // `active: true` used to be a literal on the Overview item, so the
    // highlight never moved and never meant anything.
    expect(cloudPage).not.toContain("{ active: true }");
    expect(cloudPage).toContain("const active = !locked && section !== null && section === current;");
    expect(cloudPage).toContain(`:aria-current="item.active ? 'true' : undefined"`);
  });
});

describe("locked items are genuinely unselectable", () => {
  it("cannot be clicked, and would do nothing if they could", () => {
    // Three independent guards, because a source-match test cannot click.
    // 1. The button is disabled.
    expect(cloudPage).toContain(':disabled="item.disabled"');
    expect(cloudPage).toContain("disabled: locked,");
    // 2. The handler refuses a locked item even so.
    expect(cloudPage).toContain("if (item.locked || !item.section) return;");
    // 3. And the permanently-locked item carries no section at all, so there
    //    is nothing for the handler to assign even with both other guards off.
    expect(sectionOf("members")).toBeNull();
    expect(cloudPage).toContain('item("members", "Members", ICON.users, { soon: true }),');
  });

  it("leaves Settings a no-op rather than inventing a panel for it", () => {
    // It reveals at ready and does nothing, exactly as before this switcher.
    // Giving it a section would mean shipping settings there are none of.
    expect(sectionOf("settings")).toBeNull();
    expect(cloudPage).toContain('item("settings", "Settings", ICON.gear, { revealAt: "ready" })');
  });
});

describe("the Billing panel", () => {
  const at = cloudPage.indexOf(`v-else-if="activeSection === 'billing'"`);
  const panel = cloudPage.slice(at, cloudPage.indexOf(`v-else-if="activeSection === 'skills'"`, at));

  it("exists as a panel, not a card to scroll to", () => {
    expect(at, "no billing panel").toBeGreaterThan(-1);
    expect(sectionOf("billing")).toBe("billing");
  });

  it("reads its price from /api/pricing through formatPriceLabel", () => {
    // A literal drifts silently the moment the price changes in Stripe --
    // pricingEndpoint.test.ts forbids one anywhere in this file. The label is
    // "Plan price" on purpose: /api/pricing reports the configured plan, and
    // nothing in /api/me exposes what this subscription is actually charged.
    expect(panel).toContain("{{ hostedPriceLabel }}");
    expect(panel).toContain("Plan price");
    expect(cloudPage).toContain('import { formatPriceLabel } from "../utils/money";');
    expect(cloudPage).toContain("formatPriceLabel(price.amount, price.currency, price.interval)");
    expect(cloudPage).toContain('await fetch("/api/pricing"');
    expect(cloudPage).not.toMatch(/\$\d+\s*\/\s*(mo|month)/);
  });

  it("reuses the existing subscription vocabulary instead of a second one", () => {
    expect(panel).toContain("subscriptionState.tone");
    expect(panel).toContain("subscriptionState.text");
    expect(panel).toContain("{{ renewalLabel }}");
    expect(panel).toContain("subscriptionNeedsAttention");
  });

  it("opens the real portal, and the account menu still does too", () => {
    // Two entry points, one handler: openBillingPortal already handles the 409
    // "no billing account yet" case and works for a canceled subscriber.
    expect(panel).toContain('@click="openBillingPortal"');
    expect(panel).toContain("Manage billing");
    // The button shares the shell's request lock, like the menu item does.
    expect(panel).toContain(':disabled="busy"');
    expect(cloudPage).toContain('@billing="openBillingPortal"');
    expect(accountMenu).toContain('emit("billing")');
    // Exactly one transport, not a copy of it inside the panel.
    expect((cloudPage.match(/api\/billing\/portal/g) ?? []).length).toBe(1);
  });

  it("is the page's only subscription display", () => {
    // The old Subscription card was relocated here, not duplicated: the
    // overview must not carry a second, quietly diverging copy.
    expect((cloudPage.match(/>Subscription</g) ?? []).length).toBe(1);
    const overviewAt = cloudPage.indexOf(`v-if="activeSection === 'overview'"`);
    expect(overviewAt, "no overview panel").toBeGreaterThan(-1);
    const overview = cloudPage.slice(overviewAt, at);
    // Prove the slice is the panel and not an empty haystack: three negative
    // assertions over "" would pass without guarding anything.
    expect(overview).toContain("Sync engine");
    expect(overview).not.toContain("subscriptionState");
    expect(overview).not.toContain("renewalLabel");
    expect(overview).not.toContain("hostedPriceLabel");
  });
});

describe("the machines list stays where it is needed", () => {
  it("shows on the overview as well as on its own panel", () => {
    // At connect it is the only thing to look at -- the CLI is sitting in a
    // spinner waiting to be admitted -- and once the vault is open, which
    // machines hold it IS the state of the vault.
    const at = cloudPage.indexOf("const showsMachines = computed(");
    const body = cloudPage.slice(at, cloudPage.indexOf(");", at));
    expect(body).toContain('activeSection.value === "overview"');
    expect(body).toContain('activeSection.value === "machines"');
    expect(cloudPage).toContain('<template v-if="showsMachines">');
  });

  it("still only renders when there is a vault", () => {
    // The panel gate wraps the list; it does not replace the vault gate.
    const at = cloudPage.indexOf('ref="devicesCard"');
    expect(at).toBeGreaterThan(-1);
    expect(cloudPage.slice(at - 120, at)).toContain('v-if="vault"');
  });

  it("puts the panel on screen before the admit handshake reaches into it", () => {
    // `autovault link` opens /cloud?admit=<fingerprint> and the page focuses
    // that row's Admit button. A second machine checking in while the owner is
    // reading Billing would otherwise focus a button Vue is not rendering.
    const at = cloudPage.indexOf("if (!deviceId || admitFocusedId === deviceId) return;");
    expect(at).toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("button?.focus();", at));
    expect(body).toContain('selectedSection.value = "machines";');
    expect(body).toContain("await focusDevicesCard();");
    // Selecting a panel is still not admitting anything.
    expect(body).not.toContain("decideDevice");
  });

  it("re-reads the element after the switch instead of capturing it early", () => {
    // focusCard used to take the element as an argument. Called straight after
    // switching panels, that argument is the null the ref held before Vue
    // rendered the panel, and the scroll silently does nothing.
    const at = cloudPage.indexOf("async function focusDevicesCard()");
    expect(at).toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body.indexOf("await nextTick();")).toBeLessThan(
      body.indexOf("devicesCard.value?.scrollIntoView")
    );
  });
});
