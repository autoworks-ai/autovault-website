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
  "utf-8",
);
const accountMenu = readFileSync(
  new URL(
    "../.vitepress/theme/components/CloudAccountMenu.vue",
    import.meta.url,
  ),
  "utf-8",
);
const clerkConfig = readFileSync(
  new URL("../.vitepress/theme/clerk.ts", import.meta.url),
  "utf-8",
);

/** One item() call, whole. Sliced to the call's own `),` rather than to
 * the end of its first line: these are formatted source, and an item long
 * enough to wrap would otherwise be read as a truncated fragment, which
 * silently passes every `not.toContain` below. */
function itemCall(key: string): string {
  const at = cloudPage.indexOf(`item("${key}"`);
  expect(at, `no nav item named ${key}`).toBeGreaterThan(-1);
  return cloudPage.slice(at, cloudPage.indexOf("),", at) + 2);
}

/** The `section:` a nav item selects, read off its own item() call. */
function sectionOf(key: string): string | null {
  return /section: "([a-z]+)"/.exec(itemCall(key))?.[1] ?? null;
}

/** Collapses hand-wrapped template prose to one space between words, so a
 * content assertion can match a sentence as written instead of as indented
 * across several physical lines. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** The stage SECTION_REVEAL gates a section behind, or null for "always". */
function revealTable(): Record<string, string | null> {
  const at = cloudPage.indexOf("const SECTION_REVEAL");
  expect(at, "no SECTION_REVEAL table").toBeGreaterThan(-1);
  const body = cloudPage.slice(at, cloudPage.indexOf("};", at));
  const rows: Record<string, string | null> = {};
  for (const [, name, value] of body.matchAll(
    /^\s{2}(\w+): (?:"(\w+)"|null),/gm,
  )) {
    rows[name] = value ?? null;
  }
  return rows;
}

/** What the <h1> says while each section is on screen, off SECTION_TITLE.
 * `[^"]+` rather than revealTable's `\w+`: these are display strings, and
 * "Vault catalog" has a space in it -- a \w+ match would drop that row
 * silently and leave the key-parity assertion below passing on four rows. */
function titleTable(): Record<string, string> {
  const at = cloudPage.indexOf("const SECTION_TITLE");
  expect(at, "no SECTION_TITLE table").toBeGreaterThan(-1);
  const body = cloudPage.slice(at, cloudPage.indexOf("};", at));
  const rows: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/^\s{2}(\w+): "([^"]+)",/gm)) {
    rows[name] = value;
  }
  return rows;
}

describe("the sidebar selects a panel", () => {
  it("keeps one ref and one computed instead of a router", () => {
    // /cloud is one page. A URL that named a panel would have to survive the
    // Stripe and Clerk round trips that already own this page's query string
    // and its #launch-path fragment.
    expect(cloudPage).toContain(
      'const selectedSection = ref<Section>("overview");',
    );
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
    expect(cloudPage).toContain(
      "return at === null || STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(at);",
    );
  });

  it("falls back to overview when the selected panel stops being reachable", () => {
    // Revoking the last machine drops the stage from explore back to connect,
    // which re-locks Billing and Skills. Without the fallback the main area
    // would keep rendering a panel whose own nav item is disabled.
    const at = cloudPage.indexOf("const activeSection = computed<Section>(");
    const body = cloudPage.slice(at, cloudPage.indexOf(");", at));
    expect(body).toContain(
      "stageReached(SECTION_REVEAL[selectedSection.value], stage.value)",
    );
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
      ["catalog", "catalog"],
    ];
    const table = revealTable();
    for (const [key, section] of wiring) {
      expect(sectionOf(key), `nav item ${key}`).toBe(section);
      expect(Object.keys(table), `SECTION_REVEAL.${section}`).toContain(
        section,
      );
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
      skills: "ready",
      billing: "ready",
      catalog: "ready",
    });
    expect(cloudPage).toContain(
      "const revealAt =\n      opts.revealAt ?? (opts.section ? SECTION_REVEAL[opts.section] : null);",
    );
    // All three derivations must read the resolved value. Leaving any of them
    // on opts.revealAt silently drops the "new" badge, which nothing renders a
    // test failure for.
    expect(cloudPage).toContain("const revealed = stageReached(revealAt, s);");
    expect(cloudPage).toContain(
      "const justRevealed = revealAt !== null && revealAt === s;",
    );
    expect(cloudPage).toContain(
      "const locked = Boolean(opts.soon) || !revealed;",
    );
  });

  it("keeps the vault strip as stage chrome rather than overview content", () => {
    // .cv-status-card is what the 72px focal mark shrinks into when a machine
    // is admitted -- and admitting happens from the MACHINES panel, because
    // the CLI's ?admit= link selects it. Moved inside the overview panel, the
    // strip was not rendered at that moment: the mark played its 700ms unlock,
    // cv-vaulthead then unmounted, and the gesture landed on nothing. It has
    // to sit above the panel chain, inside the stage template.
    const stageAt = cloudPage.indexOf(`v-if="stage === 'ready'"`);
    const cardAt = cloudPage.indexOf('class="cv-status-card"');
    const overviewAt = cloudPage.indexOf(`v-if="activeSection === 'overview'"`);
    expect(stageAt, "no ready stage template").toBeGreaterThan(-1);
    expect(cardAt, "no status card").toBeGreaterThan(stageAt);
    expect(cardAt, "status card is inside a panel").toBeLessThan(overviewAt);
  });

  it("marks the selected item active rather than hardcoding Overview", () => {
    // `active: true` used to be a literal on the Overview item, so the
    // highlight never moved and never meant anything.
    expect(cloudPage).not.toContain("{ active: true }");
    expect(cloudPage).toContain(
      "const active = !locked && section !== null && section === current;",
    );
    expect(cloudPage).toContain(
      `:aria-current="item.active ? 'true' : undefined"`,
    );
  });
});

describe("the heading names the panel that is on screen", () => {
  it("titles every section, keyed by the same union the panels are", () => {
    // Not a subset and not a superset: a missing row is a heading that cannot
    // be produced (Record<Section, string> would fail typecheck, but this
    // catches a row added to one table and forgotten in the other, which
    // typechecks fine and silently mislabels a panel).
    expect(cloudPage).toContain(
      "const SECTION_TITLE: Record<Section, string> = {",
    );
    expect(titleTable()).toEqual({
      overview: "Overview",
      billing: "Billing",
      machines: "Machines",
      skills: "Skills",
      catalog: "Vault catalog",
    });
    expect(Object.keys(titleTable()).sort()).toEqual(
      Object.keys(revealTable()).sort(),
    );
  });

  it("follows the selection, not a literal, past the stage branches", () => {
    // The defect: C1 made pageTitle stage-keyed with a literal "Overview"
    // fallthrough, and C2 then turned Overview into one panel of five and
    // moved aria-current onto whichever nav item is selected. Neither diff
    // showed the combination -- on Billing the h1 said "Overview" while
    // aria-current said Billing, so the DOM stated two different answers to
    // "where am I".
    const at = cloudPage.indexOf("const pageTitle = computed");
    const body = cloudPage.slice(at, cloudPage.indexOf("});", at));
    expect(body).toContain("return SECTION_TITLE[activeSection.value];");
    expect(body).not.toContain('return "Overview"');

    // Same computed the nav reads to decide which item is aria-current, so
    // the two cannot disagree: navItems takes `current` from activeSection,
    // and `active` -- which drives aria-current -- is `section === current`.
    const navAt = cloudPage.indexOf("const navItems = computed<NavItem[]>(");
    const nav = cloudPage.slice(navAt, cloudPage.indexOf("\n});", navAt));
    expect(nav).toContain("const current = activeSection.value;");
    expect(nav).toContain(
      "const active = !locked && section !== null && section === current;",
    );
  });

  it("keeps the three stage branches ahead of it", () => {
    // Re-homed from cloudDashboardHonesty.test.ts's angle: error, pre-vault
    // and connect are facts about the stage, and at those stages the panel
    // chain is not what is rendering. v1Content.test.ts reads the pre-vault
    // literal out of this exact branch.
    const at = cloudPage.indexOf("const pageTitle = computed");
    const body = cloudPage.slice(at, cloudPage.indexOf("});", at));
    const fallthrough = body.indexOf(
      "return SECTION_TITLE[activeSection.value];",
    );
    for (const branch of [
      'if (stage.value === "error") return "We couldn\'t load your vault";',
      'if (!vault.value) return "AutoVault Cloud";',
      'if (stage.value === "connect") return "Connect your CLI";',
    ]) {
      expect(body, branch).toContain(branch);
      expect(
        body.indexOf(branch),
        `${branch} must precede the fallthrough`,
      ).toBeLessThan(fallthrough);
    }
  });

  it("gives each panel an accessible name that tracks the heading", () => {
    // Only .cv-devices carried a region role before this; the other panels
    // swapped in with no role and no label, so nothing announced the change.
    expect(cloudPage).toContain('<h1 id="cv-page-title">{{ pageTitle }}</h1>');
    expect(cloudPage).toContain('aria-labelledby="cv-devices-title"');
    // One per in-chain panel: overview, billing, skills, catalog. Machines
    // keeps its own heading as its label, since it renders outside the chain.
    expect(
      (cloudPage.match(/aria-labelledby="cv-page-title"/g) ?? []).length,
    ).toBe(4);
    for (const section of ["overview", "billing", "skills", "catalog"]) {
      const at = cloudPage.indexOf(`activeSection === '${section}'`);
      expect(at, `no ${section} panel`).toBeGreaterThan(-1);
      const opening = cloudPage.slice(
        at,
        cloudPage.indexOf(">", cloudPage.indexOf("<div", at)),
      );
      expect(opening, `${section} panel is not a named region`).toContain(
        'role="region"',
      );
      expect(opening, `${section} panel has no label`).toContain(
        'aria-labelledby="cv-page-title"',
      );
    }
  });
});

describe("the early-access ask is gone, not relocated", () => {
  /** The vault strip, from its own class attribute to where the panel chain
   * starts. Everything in here renders whichever panel is selected. */
  const stripAt = cloudPage.indexOf('class="cv-status-card"');
  const strip = cloudPage.slice(
    stripAt,
    cloudPage.indexOf("SECTION: OVERVIEW", stripAt),
  );

  it("leaves no waitlist control anywhere on the page", () => {
    // This block used to pin the opposite: that markProgress('early_access')
    // had exactly one call site, and that it lived in the vault strip rather
    // than inside the Skills panel. The ask queued people for hosted sync,
    // which has since shipped, so the control was deleted rather than
    // repointed at some other unbuilt thing.
    expect(cloudPage).not.toContain("markProgress");
    expect(cloudPage).not.toMatch(/Get early access/i);
    expect(cloudPage).not.toMatch(/early-access list/i);
  });

  it("keeps the strip as stage chrome, showing state it can prove", () => {
    expect(stripAt, "no status card").toBeGreaterThan(-1);
    const overviewAt = cloudPage.indexOf(`v-if="activeSection === 'overview'"`);
    expect(stripAt).toBeLessThan(overviewAt);
    // Counted off the device list, not off a column a button wrote.
    expect(strip).toContain("activeDevices.length");
    expect(flatten(strip)).toMatch(/signed skills/i);
  });

  it("states the publishing limit where the ask used to be", () => {
    // flatten: the sentence is line-wrapped in the template, so a raw match
    // would depend on where the wrap happens to fall.
    expect(flatten(strip)).toMatch(/hands-on in private beta/i);
    expect(flatten(strip)).not.toMatch(/we'll email|when it ships/i);
  });

  it("leaves the Skills panel a labelled preview with no action in it", () => {
    const skillsAt = cloudPage.indexOf(
      `v-else-if="activeSection === 'skills'"`,
    );
    const skills = cloudPage.slice(
      skillsAt,
      cloudPage.indexOf("SECTION: CATALOG", skillsAt),
    );
    expect(skillsAt, "no skills panel").toBeGreaterThan(-1);
    expect(skills).not.toContain("markProgress");
    // Labelled as unbuilt rather than as imminent: the old label alternated
    // between "Coming soon · preview" and "You're on the list · preview".
    expect(flatten(skills)).toContain("Not built yet · preview");
    // And it points at where skills actually come from instead of a waitlist.
    expect(flatten(skills)).toMatch(/signed catalog/i);
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
    expect(cloudPage).toContain(
      'item("members", "Members", ICON.users, { soon: true }),',
    );
  });

  it("leaves Settings a no-op rather than inventing a panel for it", () => {
    // It reveals at ready and does nothing, exactly as before this switcher.
    // Giving it a section would mean shipping settings there are none of.
    expect(sectionOf("settings")).toBeNull();
    expect(cloudPage).toContain(
      'item("settings", "Settings", ICON.gear, { revealAt: "ready" })',
    );
  });
});

describe("the Billing panel", () => {
  const at = cloudPage.indexOf(`v-else-if="activeSection === 'billing'"`);
  const panel = cloudPage.slice(
    at,
    cloudPage.indexOf(`v-else-if="activeSection === 'skills'"`, at),
  );

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
    expect(cloudPage).toContain(
      'import { formatPriceLabel } from "../utils/money";',
    );
    expect(cloudPage).toContain(
      "formatPriceLabel(price.amount, price.currency, price.interval)",
    );
    expect(cloudPage).toContain('await fetch("/api/pricing"');
    expect(cloudPage).not.toMatch(/\$\d+\s*\/\s*(mo|month)/);
  });

  it("sends never-subscribed owners to Checkout, not a second subscription for past_due", () => {
    // Membership, not the literal source line. The rule is "a status that still
    // has a live Stripe subscription behind it goes to the portal, because
    // Checkout would mint a second one"; `paused` joined the set for exactly
    // that reason and the old string match failed on the formatting rather than
    // on the rule.
    const at0 = cloudPage.indexOf("const PORTAL_ONLY_STATUSES");
    expect(at0, "no PORTAL_ONLY_STATUSES").toBeGreaterThan(-1);
    const declared = cloudPage.slice(at0, cloudPage.indexOf("]);", at0));
    for (const live of ["past_due", "unpaid", "incomplete", "paused"]) {
      expect(declared, `${live} must not reach Checkout`).toContain(`"${live}"`);
    }
    // Canceled and never-subscribed are the ones Checkout is for.
    for (const gone of ["canceled", "incomplete_expired"]) {
      expect(declared).not.toContain(`"${gone}"`);
    }
    const at = cloudPage.indexOf("const canStartCheckout = computed");
    expect(at, "no canStartCheckout").toBeGreaterThan(-1);
    const body = cloudPage.slice(
      at,
      cloudPage.indexOf("const canManageBilling", at),
    );
    expect(body).toContain("if (paid.value) return false");
    expect(body).toContain("PORTAL_ONLY_STATUSES.has(status)");
    const checkout = cloudPage.slice(
      cloudPage.indexOf("async function startHostedCheckout"),
      cloudPage.indexOf("async function openBillingPortal"),
    );
    expect(checkout).toContain("if (paid.value)");
    expect(checkout).toContain('fetch("/api/checkout/hosted-vault"');
  });

  it("reuses the existing subscription vocabulary instead of a second one", () => {
    expect(panel).toContain("subscriptionState.tone");
    expect(panel).toContain("subscriptionState.text");
    expect(panel).toContain("{{ renewalLabel }}");
    expect(panel).toContain("subscriptionNeedsAttention");
  });

  it("is where Checkout and the portal are opened from", () => {
    // After the funnel, this panel is the only place a never-subscribed
    // owner can start paying: the vault already exists, so stage stays
    // "ready" and the funnel's Open checkout button is gone. The portal is
    // still here for anyone who already has a Stripe customer.
    expect(panel).toContain('@click="startHostedCheckout"');
    expect(panel).toContain("Start subscription");
    expect(panel).toContain('v-if="canStartCheckout"');
    expect(panel).toContain('v-if="canManageBilling"');
    expect(panel).toContain('@click="openBillingPortal"');
    expect(panel).toContain("Manage billing");
    // It shares the shell's request lock.
    expect(panel).toContain(':disabled="busy"');
    // Exactly one of each transport, not a copy of either inside the panel.
    expect((cloudPage.match(/api\/checkout\/hosted-vault/g) ?? []).length).toBe(
      1,
    );
    expect((cloudPage.match(/api\/billing\/portal/g) ?? []).length).toBe(1);
  });

  it("is what the account menu's Billing item selects, rather than Stripe", () => {
    // The menu item used to call openBillingPortal directly, so the one place
    // that shows plan, price, status and period end was skipped on the way to
    // Stripe -- which is the thing this panel exists to stop. Every other item
    // that navigates this page selects a section; Billing is not an exception.
    expect(accountMenu).toContain('emit("billing")');
    expect(cloudPage).toContain('@billing="showBilling"');
    expect(cloudPage).not.toContain('@billing="openBillingPortal"');

    const at = cloudPage.indexOf("function showBilling()");
    expect(at, "no showBilling handler").toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body).toContain('selectedSection.value = "billing";');

    // ...except before `explore`, where there is no panel to select and the
    // menu is already rendered. Falling through to the portal there is what
    // keeps the item from becoming a live-looking command that does nothing.
    expect(body).toContain("stageReached(SECTION_REVEAL.billing, stage.value)");
    expect(body).toContain("void startHostedCheckout();");
    expect(body).toContain("void openBillingPortal();");
    // Checkout is the fall-through for a never-subscribed account; the portal
    // is the remaining fallback. Both are the guarded branch, not the default.
    expect(body.indexOf("void startHostedCheckout();")).toBeLessThan(
      body.indexOf('selectedSection.value = "billing";'),
    );
    expect(body.indexOf("void openBillingPortal();")).toBeLessThan(
      body.indexOf('selectedSection.value = "billing";'),
    );
    // And because that branch survives, the menu item can still take the
    // shell's request lock -- so its aria-disabled guard stays load-bearing.
    expect(accountMenu).toContain("disabled: props.busy");
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

  it("gives the dead 'contact support' text a real destination", () => {
    // It used to just be the words "contact support" with nothing behind
    // them. Retired by linking it rather than deleting it: a subscriber
    // whose access looks wrong still needs somewhere to go.
    const noticeAt = panel.indexOf('v-else-if="subscriptionNeedsAttention"');
    expect(noticeAt, "no subscription-attention notice").toBeGreaterThan(-1);
    const notice = panel.slice(noticeAt, panel.indexOf("</p>", noticeAt));
    expect(notice).toContain("contact support");
    expect(notice).toContain(':href="clerkBrand.supportUrl"');
  });
});

describe("the billing recovery block", () => {
  const at = cloudPage.indexOf("BILLING RECOVERY");
  const block = cloudPage.slice(at, cloudPage.indexOf("SECTION: MACHINES", at));

  it("gives a lapsed owner a way out before any machine is admitted", () => {
    // The Billing panel reveals at `ready`, and `ready` requires an admitted
    // machine. Admitting one answers 402 while the subscription is inactive.
    // An owner who reserved a namespace and then lapsed was parked at
    // `connect` with both exits shut, and that is every unconverted trial. So
    // this block has to live OUTSIDE the `ready` template, next to Machines.
    expect(at, "no billing recovery block").toBeGreaterThan(-1);
    expect(SECTION_REVEAL_BILLING).toBe('billing: "ready"');
    expect(block).toContain('v-if="vault && !paid"');
    expect(block).toContain("startHostedCheckout");
    expect(block).toContain("openBillingPortal");
    // Same predicates the Billing panel uses, so a paused or past_due owner is
    // still routed to the portal rather than to a second subscription.
    expect(block).toContain('v-if="canStartCheckout"');
    expect(block).toContain('v-if="canManageBilling"');
  });

  it("says the namespace survived rather than implying it was taken away", () => {
    expect(flatten(block)).toContain("still reserved and nothing has been deleted");
  });
});

const SECTION_REVEAL_BILLING = (() => {
  const at = cloudPage.indexOf("const SECTION_REVEAL");
  const body = cloudPage.slice(at, cloudPage.indexOf("};", at));
  return body.split("\n").map((line) => line.trim().replace(/,$/, ""))
    .find((line) => line.startsWith("billing:")) ?? "";
})();

describe("the Catalog panel", () => {
  const at = cloudPage.indexOf(`v-else-if="activeSection === 'catalog'"`);
  // Ends at whichever block comes next, not at one named marker. This slice
  // used to run to SECTION: MACHINES and swallowed everything inserted between
  // the two, so a <button> in a later, unrelated block failed a case about the
  // catalog panel. The nearest following marker is the panel's real end.
  const panelEnd = Math.min(
    ...["BILLING RECOVERY", "SECTION: MACHINES"]
      .map((marker) => cloudPage.indexOf(marker, at))
      .filter((index) => index > -1)
  );
  const panel = cloudPage.slice(at, panelEnd);

  it("exists as a panel, not a card to scroll to", () => {
    expect(at, "no catalog panel").toBeGreaterThan(-1);
    expect(sectionOf("catalog")).toBe("catalog");
  });

  it("reveals at ready, not connect, even though the copy is about linked machines", () => {
    // The naive read of "this needs a linked machine to be meaningful" points
    // at "connect", but the panel lives inside the explore/ready template
    // (the same v-else-if chain skills and billing use), which does not
    // render at all at "connect". Locking this to "connect" would unlock the
    // nav item two stages before there is anything to show, and describe
    // "your linked machines" before cliLinked is even true. "explore" is the
    // only value that keeps the nav item's lock in sync with the template
    // that actually renders behind it.
    const table = revealTable();
    expect(table.catalog).toBe("ready");
    // And the panel really is inside that chain, not pulled out the way
    // machines is -- proven by position: it has to fall between the outer
    // template's opening and the machines comment that marks where that
    // template closes.
    const readyAt = cloudPage.indexOf(`v-if="stage === 'ready'"`);
    const machinesCommentAt = cloudPage.indexOf("SECTION: MACHINES");
    expect(readyAt).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(readyAt);
    expect(at).toBeLessThan(machinesCommentAt);
  });

  it("answers what a vault catalog is", () => {
    expect(flatten(panel)).toContain("signed manifest");
    expect(flatten(panel)).toContain("your linked machines pull skills from");
  });

  it("answers how it relates to linked machines", () => {
    expect(flatten(panel)).toContain(
      "Every machine you admit reads from that same vault catalog",
    );
  });

  it("answers how publishing actually works, without inventing a control", () => {
    // This used to assert "Publishing ships with hosted sync" -- written when
    // sync was the unshipped half. Sync shipped; publishing did not, and it is
    // not waiting on sync. It is out of band by design, because the release
    // signing key never reaches Cloud, so the copy has to explain the absence
    // rather than date it.
    expect(flatten(panel)).toContain("There is no publish button here");
    expect(flatten(panel)).toContain("no upload API");
    expect(flatten(panel)).toContain("never reaches us");
    // And it says what a customer sees before the first release lands, so a
    // 404 from their own catalog does not read as a fault they caused. Phrased
    // as the rule rather than as a claim about this vault: the panel never
    // queries KV, so "this vault serves nothing" was an assertion it could not
    // support, in the same way "serving signed skills" was.
    expect(flatten(panel)).toContain("answers 404 for its catalog");
    expect(flatten(panel)).toContain("rather than a fault");
    expect(panel).not.toContain("this vault serves nothing");
  });

  it("gives an honest empty state instead of a fake control", () => {
    // Capability wording, not a per-vault fact: the panel never queries KV,
    // so it must not claim to know this vault specifically has nothing
    // published -- only that self-serve publishing does not exist yet.
    expect(panel).toContain("No publish path yet");
    expect(panel).not.toContain("Nothing published yet");
    // Nothing on this panel is clickable -- there is genuinely nothing to do.
    expect(panel).not.toContain("<button");
  });

  it("disambiguates from the public skills directory, and links it", () => {
    // The site already uses "catalog" for the public examples page in
    // ComparePage.vue, AuthorProfilePage.vue and data/skills.ts. Confusing
    // the two is most of the actual complaint this task exists to fix.
    expect(flatten(panel)).toContain("your vault catalog");
    expect(flatten(panel)).toContain("the public skills directory");
    expect(panel).toContain('<a href="/skills-directory">');
  });

  it("never matches the three regexes v1Content.test.ts bans from hosted copy", () => {
    // Mirrors the "keeps hidden hosted copy reservation-only" guard in
    // v1Content.test.ts, scoped to just the new copy so a failure here
    // points straight at this panel instead of the whole file. Flattened,
    // not raw: a negative match against hand-wrapped source is the wrong
    // direction for a banned-phrase guard -- wrapping the words differently
    // would silently defeat the raw-source version while the rendered text
    // still said the banned thing.
    const copy = flatten(panel);
    expect(copy).not.toMatch(/live vault|provisioned runtime/i);
    expect(copy).not.toMatch(
      /cloud sync is enabled|enabled cloud sync|sync now/i,
    );
    expect(copy).not.toMatch(/prototype mode/i);
  });
});

describe("Docs and Support are always-visible links, not sections", () => {
  it("are wired to an href, not a section", () => {
    for (const key of ["docs", "support"]) {
      const call = itemCall(key);
      expect(call).toContain("href:");
      expect(call).not.toContain("section:");
    }
  });

  it("point at the same destinations as the account dropdown", () => {
    // ClerkAuthControls.vue's UserButton menu is "the account dropdown" --
    // both read the same clerkBrand fields so there is exactly one place
    // either URL is written down.
    expect(cloudPage).toContain('import { clerkBrand } from "../clerk";');
    expect(itemCall("docs")).toContain("clerkBrand.docsPath");
    expect(itemCall("support")).toContain("clerkBrand.supportUrl");
  });

  it("carry no reveal stage or soon flag, so nothing can lock them", () => {
    for (const key of ["docs", "support"]) {
      const call = itemCall(key);
      expect(call).not.toContain("revealAt:");
      expect(call).not.toContain("soon:");
    }
    // And neither is a row SECTION_REVEAL could gate even if one were added
    // by mistake -- they are not part of the Section union at all.
    const table = revealTable();
    expect(table).not.toHaveProperty("docs");
    expect(table).not.toHaveProperty("support");
  });

  it("render as real anchors so open-in-new-tab and copy-link work", () => {
    expect(cloudPage).toContain(`:is="item.href ? 'a' : 'button'"`);
    expect(cloudPage).toContain(':href="item.href ?? undefined"');
    expect(cloudPage).toContain(
      ":target=\"item.external ? '_blank' : undefined\"",
    );
    // The two literals the sidebar's lock/highlight tests already pin, kept
    // byte-identical through the tag switch rather than only true for
    // <button> once <a> items exist alongside it.
    expect(cloudPage).toContain(':disabled="item.disabled"');
    expect(cloudPage).toContain(
      `:aria-current="item.active ? 'true' : undefined"`,
    );
  });

  it("mark the GitHub support link external, and the docs link internal", () => {
    const at = cloudPage.indexOf("const external = href !== null");
    expect(at, "no external-link derivation").toBeGreaterThan(-1);
    expect(cloudPage.slice(at, at + 120)).toContain("/^https?:\\/\\//");
    // clerkBrand is the one place either URL is written down -- proving the
    // derivation's http(s):// test actually discriminates the two values it
    // will be run against.
    expect(clerkConfig).toMatch(/supportUrl: "https:\/\/github\.com/);
    expect(clerkConfig).toMatch(/docsPath: "\//);
    expect(clerkConfig).not.toMatch(/docsPath: "https?:\/\//);
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
    const at = cloudPage.indexOf(
      "if (!deviceId || admitFocusedId === deviceId) return;",
    );
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
      body.indexOf("devicesCard.value?.scrollIntoView"),
    );
  });

  it("scrolls to itself when Sync log is selected from the nav, not just via the admit handshake", () => {
    // Machines has no template block of its own -- selecting it can leave
    // the page pixel-identical to Overview, with only aria-current moving.
    // onNavClick is the second (and only other) caller of focusDevicesCard.
    const at = cloudPage.indexOf("function onNavClick(item: NavItem)");
    expect(at).toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body).toContain('item.section === "machines"');
    expect(body).toContain("focusDevicesCard()");
    // Still sets the section too -- this is additive feedback, not a
    // reversion to the old scroll-only dispatch.
    expect(body).toContain("selectedSection.value = item.section;");
  });
});
