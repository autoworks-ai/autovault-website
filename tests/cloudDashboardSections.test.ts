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
const clerkConfig = readFileSync(
  new URL("../.vitepress/theme/clerk.ts", import.meta.url),
  "utf-8"
);

/** The `section:` a nav item selects, read off its own item() call. */
function sectionOf(key: string): string | null {
  const at = cloudPage.indexOf(`item("${key}"`);
  expect(at, `no nav item named ${key}`).toBeGreaterThan(-1);
  const call = cloudPage.slice(at, cloudPage.indexOf("\n", at));
  return /section: "([a-z]+)"/.exec(call)?.[1] ?? null;
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
  for (const [, name, value] of body.matchAll(/^\s{2}(\w+): (?:"(\w+)"|null),/gm)) {
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
      ["catalog", "catalog"],
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
      billing: "explore",
      catalog: "explore"
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

describe("the heading names the panel that is on screen", () => {
  it("titles every section, keyed by the same union the panels are", () => {
    // Not a subset and not a superset: a missing row is a heading that cannot
    // be produced (Record<Section, string> would fail typecheck, but this
    // catches a row added to one table and forgotten in the other, which
    // typechecks fine and silently mislabels a panel).
    expect(cloudPage).toContain("const SECTION_TITLE: Record<Section, string> = {");
    expect(titleTable()).toEqual({
      overview: "Overview",
      billing: "Billing",
      machines: "Machines",
      skills: "Skills",
      catalog: "Vault catalog"
    });
    expect(Object.keys(titleTable()).sort()).toEqual(Object.keys(revealTable()).sort());
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
    expect(nav).toContain("const active = !locked && section !== null && section === current;");
  });

  it("keeps the three stage branches ahead of it", () => {
    // Re-homed from cloudDashboardHonesty.test.ts's angle: error, pre-vault
    // and connect are facts about the stage, and at those stages the panel
    // chain is not what is rendering. v1Content.test.ts reads the pre-vault
    // literal out of this exact branch.
    const at = cloudPage.indexOf("const pageTitle = computed");
    const body = cloudPage.slice(at, cloudPage.indexOf("});", at));
    const fallthrough = body.indexOf("return SECTION_TITLE[activeSection.value];");
    for (const branch of [
      'if (stage.value === "error") return "We couldn\'t load your vault";',
      'if (!vault.value) return "Reserve a hosted AutoVault namespace";',
      'if (stage.value === "connect") return "Connect your CLI";'
    ]) {
      expect(body, branch).toContain(branch);
      expect(body.indexOf(branch), `${branch} must precede the fallthrough`).toBeLessThan(
        fallthrough
      );
    }
  });

  it("gives each panel an accessible name that tracks the heading", () => {
    // Only .cv-devices carried a region role before this; the other panels
    // swapped in with no role and no label, so nothing announced the change.
    expect(cloudPage).toContain('<h1 id="cv-page-title">{{ pageTitle }}</h1>');
    expect(cloudPage).toContain('aria-labelledby="cv-devices-title"');
    // One per in-chain panel: overview, billing, skills, catalog. Machines
    // keeps its own heading as its label, since it renders outside the chain.
    expect((cloudPage.match(/aria-labelledby="cv-page-title"/g) ?? []).length).toBe(4);
    for (const section of ["overview", "billing", "skills", "catalog"]) {
      const at = cloudPage.indexOf(`activeSection === '${section}'`);
      expect(at, `no ${section} panel`).toBeGreaterThan(-1);
      const opening = cloudPage.slice(at, cloudPage.indexOf(">", cloudPage.indexOf("<div", at)));
      expect(opening, `${section} panel is not a named region`).toContain('role="region"');
      expect(opening, `${section} panel has no label`).toContain('aria-labelledby="cv-page-title"');
    }
  });
});

describe("the early-access ask belongs to the stage, not to a panel", () => {
  /** The vault strip, from its own class attribute to where the panel chain
   * starts. Everything in here renders whichever panel is selected. */
  const stripAt = cloudPage.indexOf('class="cv-status-card"');
  const strip = cloudPage.slice(stripAt, cloudPage.indexOf("SECTION: OVERVIEW", stripAt));

  it("is reachable from the strip, whichever panel is on screen", () => {
    // The defect this fixes: markProgress('early_access') is the only action
    // that advances explore -> ready, and C2's section split left its single
    // call site inside the Skills panel. `explore` lands on Overview, so a
    // paying, vaulted, linked user's next page load had nothing on it to do
    // -- and the one nav item hiding the CTA was badged "new" identically to
    // the two beside it that did not.
    expect(stripAt, "no status card").toBeGreaterThan(-1);
    expect(strip).toContain("@click=\"markProgress('early_access')\"");
    expect(strip).toContain("Get early access");
    // Same behaviour it had in the panel: it takes the shell's request lock
    // and says so rather than going quiet. The word changed with the move --
    // `busy` is one lock shared with Manage billing, and the Billing panel
    // now renders with this button beside it every time, so "Saving…" had the
    // strip announcing work nobody asked for. "Working…" is what the device
    // rows already say while someone else's request is in flight.
    expect(strip).toContain(':disabled="busy"');
    // Anchored on the label expression, not the bare word: the comment above
    // the button explains what it stopped saying, and a negative match on the
    // quoted literal alone reads that comment instead of the code.
    expect(strip).toContain('busy ? "Working…"');
    expect(strip).not.toContain('busy ? "Saving…"');
    // And the strip really is stage chrome outside the chain -- the panel
    // test above pins that, this pins that the button came with it.
    const overviewAt = cloudPage.indexOf(`v-if="activeSection === 'overview'"`);
    expect(strip.indexOf("markProgress")).toBeGreaterThan(-1);
    expect(stripAt).toBeLessThan(overviewAt);
  });

  it("moved rather than being copied", () => {
    // Two call sites would be two buttons on screen at once whenever Skills
    // is the selected panel, both writing the same column.
    expect((cloudPage.match(/markProgress\('early_access'\)/g) ?? []).length).toBe(1);
    const skillsAt = cloudPage.indexOf(`v-else-if="activeSection === 'skills'"`);
    const skills = cloudPage.slice(skillsAt, cloudPage.indexOf("SECTION: CATALOG", skillsAt));
    expect(skillsAt, "no skills panel").toBeGreaterThan(-1);
    expect(skills, "skills panel is still the only way to the CTA").not.toContain("markProgress");
    // The panel still exists and is still worth visiting -- only the action
    // left it. And it says where the action went.
    expect(skills).toContain("Manage your vault from the web");
    expect(flatten(skills)).toContain("Ask for early access from the vault strip above");
  });

  it("disappears once the ask has been made", () => {
    // stage === "ready" IS early_access_at being set (see the stage computed),
    // so the button has to go when the strip's own text starts saying "early
    // access requested" and the Skills panel starts confirming it.
    expect(strip).toContain(`v-if="stage !== 'ready'"`);
    expect(strip).toContain("early access requested");
    const at = cloudPage.indexOf("const stage = computed<Stage>");
    const body = cloudPage.slice(at, cloudPage.indexOf("\n});", at));
    expect(body).toContain('if (!earlyAccess.value) return "explore";');
    expect(body).toContain('return "ready";');
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

  it("is where the portal is opened from", () => {
    // The panel's own button is the thing that reaches Stripe. It reuses
    // openBillingPortal untouched, which already handles the 409 "no billing
    // account yet" case and works for a canceled subscriber.
    expect(panel).toContain('@click="openBillingPortal"');
    expect(panel).toContain("Manage billing");
    // It shares the shell's request lock.
    expect(panel).toContain(':disabled="busy"');
    // Exactly one transport, not a copy of it inside the panel.
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
    expect(body).toContain("void openBillingPortal();");
    // The fallback is the guarded branch, not the default one.
    expect(body.indexOf("void openBillingPortal();")).toBeLessThan(
      body.indexOf('selectedSection.value = "billing";')
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
    const noticeAt = panel.indexOf('v-if="subscriptionNeedsAttention"');
    expect(noticeAt, "no subscription-attention notice").toBeGreaterThan(-1);
    const notice = panel.slice(noticeAt, panel.indexOf("</p>", noticeAt));
    expect(notice).toContain("contact support");
    expect(notice).toContain(':href="clerkBrand.supportUrl"');
  });
});

describe("the Catalog panel", () => {
  const at = cloudPage.indexOf(`v-else-if="activeSection === 'catalog'"`);
  const panel = cloudPage.slice(at, cloudPage.indexOf("SECTION: MACHINES", at));

  it("exists as a panel, not a card to scroll to", () => {
    expect(at, "no catalog panel").toBeGreaterThan(-1);
    expect(sectionOf("catalog")).toBe("catalog");
  });

  it("reveals at explore, not connect, even though the copy is about linked machines", () => {
    // The naive read of "this needs a linked machine to be meaningful" points
    // at "connect", but the panel lives inside the explore/ready template
    // (the same v-else-if chain skills and billing use), which does not
    // render at all at "connect". Locking this to "connect" would unlock the
    // nav item two stages before there is anything to show, and describe
    // "your linked machines" before cliLinked is even true. "explore" is the
    // only value that keeps the nav item's lock in sync with the template
    // that actually renders behind it.
    const table = revealTable();
    expect(table.catalog).toBe("explore");
    // And the panel really is inside that chain, not pulled out the way
    // machines is -- proven by position: it has to fall between the outer
    // template's opening and the machines comment that marks where that
    // template closes.
    const exploreReadyAt = cloudPage.indexOf(`v-if="stage === 'explore' || stage === 'ready'"`);
    const machinesCommentAt = cloudPage.indexOf("SECTION: MACHINES");
    expect(exploreReadyAt).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(exploreReadyAt);
    expect(at).toBeLessThan(machinesCommentAt);
  });

  it("answers what a vault catalog is", () => {
    expect(flatten(panel)).toContain("signed manifest");
    expect(flatten(panel)).toContain("your linked machines pull skills from");
  });

  it("answers how it relates to linked machines", () => {
    expect(flatten(panel)).toContain("Every machine you admit reads from that same vault catalog");
  });

  it("answers what publishing will look like, and agrees there is nothing to do today", () => {
    expect(flatten(panel)).toContain("Publishing ships with hosted sync");
    expect(flatten(panel)).toContain("nothing to publish or configure here today");
    // Matches the Sync engine card's own framing (signing/serving stay local)
    // rather than inventing a publish flow or an owner console that do not
    // exist yet.
    expect(flatten(panel)).toContain("signing and serving already work today");
  });

  it("gives an honest empty state instead of a fake control", () => {
    expect(panel).toContain("Nothing published yet");
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
    expect(copy).not.toMatch(/cloud sync is enabled|enabled cloud sync|sync now/i);
    expect(copy).not.toMatch(/prototype mode/i);
  });
});

describe("Docs and Support are always-visible links, not sections", () => {
  it("are wired to an href, not a section", () => {
    for (const key of ["docs", "support"]) {
      const at = cloudPage.indexOf(`item("${key}"`);
      expect(at, `no nav item named ${key}`).toBeGreaterThan(-1);
      const call = cloudPage.slice(at, cloudPage.indexOf("\n", at));
      expect(call).toContain("href:");
      expect(call).not.toContain("section:");
    }
  });

  it("point at the same destinations as the account dropdown", () => {
    // ClerkAuthControls.vue's UserButton menu is "the account dropdown" --
    // both read the same clerkBrand fields so there is exactly one place
    // either URL is written down.
    expect(cloudPage).toContain('import { clerkBrand } from "../clerk";');
    const docsAt = cloudPage.indexOf('item("docs"');
    const docsCall = cloudPage.slice(docsAt, cloudPage.indexOf("\n", docsAt));
    expect(docsCall).toContain("clerkBrand.docsPath");
    const supportAt = cloudPage.indexOf('item("support"');
    const supportCall = cloudPage.slice(supportAt, cloudPage.indexOf("\n", supportAt));
    expect(supportCall).toContain("clerkBrand.supportUrl");
  });

  it("carry no reveal stage or soon flag, so nothing can lock them", () => {
    for (const key of ["docs", "support"]) {
      const at = cloudPage.indexOf(`item("${key}"`);
      const call = cloudPage.slice(at, cloudPage.indexOf("\n", at));
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
    expect(cloudPage).toContain(":target=\"item.external ? '_blank' : undefined\"");
    // The two literals the sidebar's lock/highlight tests already pin, kept
    // byte-identical through the tag switch rather than only true for
    // <button> once <a> items exist alongside it.
    expect(cloudPage).toContain(':disabled="item.disabled"');
    expect(cloudPage).toContain(`:aria-current="item.active ? 'true' : undefined"`);
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
