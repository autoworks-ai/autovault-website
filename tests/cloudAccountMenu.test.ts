import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf-8");
}

const menu = read(".vitepress/theme/components/CloudAccountMenu.vue");
const composable = read(".vitepress/theme/composables/useDisclosureMenu.ts");
const clerkAccount = read(".vitepress/theme/utils/clerkAccount.ts");
const cloudPage = read(".vitepress/theme/components/CloudPage.vue");

describe("cloud account menu", () => {
  it("is a real button, not an inert div", () => {
    // The whole point of the change: every other SaaS opens a menu from the
    // account block in this position, so it has to be focusable and
    // activatable, not a div that ignores clicks.
    expect(menu).toContain('type="button"');
    expect(menu).toContain('class="cv-side-foot"');
    expect(cloudPage).not.toContain('<div class="cv-side-foot">');
  });

  it("declares the WAI-ARIA menu-button contract", () => {
    expect(menu).toContain('aria-haspopup="menu"');
    expect(menu).toContain(':aria-expanded="open"');
    expect(menu).toContain('aria-controls="cv-account-menu"');
    expect(menu).toContain('role="menu"');
    expect(menu).toContain('role="menuitem"');
    expect(menu).toContain('aria-labelledby="cv-account-trigger"');
    // Roving focus: one tab stop, arrows move within.
    expect(menu).toContain('tabindex="-1"');
  });

  it("offers the three items the convention leads people to expect", () => {
    expect(menu).toContain("Profile");
    expect(menu).toContain("Billing");
    expect(menu).toContain("Sign out");
  });

  it("escapes the shell's overflow clip by teleporting to the body", () => {
    // .cv-shell sets `overflow: hidden` to clip the sidebar background to its
    // radius; an absolutely-positioned popover anchored inside it would be
    // cut off.
    expect(menu).toContain("<Teleport");
    expect(menu).toContain('to="body"');
    expect(menu).toContain('position: "fixed"');
  });

  it("does not rely on --cv-radius, which does not survive the teleport", () => {
    // Scoped styles follow teleported vnodes, but custom properties declared
    // on .cv-page do not — the popover is no longer a descendant of it.
    // Match actual usage, not the prose explaining why it is absent.
    const styleBlock = menu.slice(menu.indexOf("<style"));
    expect(styleBlock).not.toContain("var(--cv-radius");
  });

  it("closes before running an action rather than restoring focus into it", () => {
    // Restoring focus to the trigger races Clerk's profile modal for focus
    // and can yank it straight back out of the dialog.
    for (const handler of ["function onProfile", "async function onSignOut"]) {
      const body = menu.slice(menu.indexOf(handler), menu.indexOf(handler) + 220);
      expect(body).toContain("closeMenu()");
      expect(body).not.toContain("restoreFocus: true");
    }
  });

  it("restores focus for Billing, whose action often takes none", () => {
    // Billing is the one item that can finish without anything claiming
    // focus: a 409 (no billing account yet) or a Stripe/auth/network failure
    // renders a notice elsewhere on the page and never navigates, so closing
    // without restoring drops the keyboard user onto <body> and makes them
    // tab in from the top of the document again.
    const at = menu.indexOf("function onBilling");
    expect(at).toBeGreaterThan(-1);
    expect(menu.slice(at, at + 220)).toContain("closeMenu({ restoreFocus: true })");
  });

  it("hands focus back to the trigger when Tab closes the menu", () => {
    // The menu is teleported to the end of <body> and its items are
    // tabindex="-1", so closing without moving focus resumes sequential
    // navigation from the teleported node -- or from <body> once Vue removes
    // it -- and lands the user at the top or bottom of the page instead of
    // beside the account button. Anchor on the branch, not the prose.
    const tabAt = composable.indexOf('event.key === "Tab"');
    const afterTab = composable.indexOf("nextMenuIndex(activeIndex.value", tabAt);
    expect(tabAt).toBeGreaterThan(-1);
    expect(afterTab).toBeGreaterThan(tabAt);
    expect(composable.slice(tabAt, afterTab)).toContain("closeMenu({ restoreFocus: true })");
  });

  it("preventDefaults on the key, not on whether focus moved", () => {
    // Gating on a changed index let Home-at-first, End-at-last, and every
    // arrow in a one-item menu fall through to the browser, which scrolled the
    // page behind the open menu. Anchor on the branch, not on the prose.
    const at = composable.indexOf("function onMenuKeydown");
    const body = composable.slice(at, composable.indexOf("function onPointerDown", at));
    expect(body).toContain("isMenuNavigationKey(event.key)");
    expect(body).not.toContain("next !== activeIndex.value");
  });

  it("does not offer Billing as live while the shell's request lock is held", () => {
    // openBillingPortal returns early when the lock is taken, so an
    // apparently-live command did nothing and said nothing. aria-disabled
    // rather than the disabled attribute, because a disabled button cannot
    // hold focus and would punch a hole in the roving tabindex.
    expect(menu).toContain("busy: boolean;");
    expect(menu).toContain("disabled: props.busy");
    expect(menu).toContain(":aria-disabled=");
    expect(menu).toContain("@click=\"runItem(item)\"");
    expect(cloudPage).toContain(':busy="busy"');
  });

  it("says something when the lock is taken between paint and click", () => {
    // The disabled state closes the common case; this closes the race. A
    // command that silently no-ops reads as a broken app.
    const at = cloudPage.indexOf("async function openBillingPortal");
    const guard = cloudPage.slice(at, at + 700);
    expect(guard).toContain("if (busy.value) {");
    expect(guard).toContain("notice.value =");
  });

  it("re-resolves the roving index when Clerk grows the item list", () => {
    // Opened before Clerk loads, Billing is the only item and activeIndex is
    // 0. When Profile is prepended, Vue keeps focus on the keyed Billing
    // button while the index still says 0, so the next arrow key jumps
    // somewhere the user did not ask for. Track the key, not the position.
    expect(menu).toContain("items.value.map((item) => item.key).join(\"|\")");
    const at = menu.indexOf("watch(\n  () => items.value.map");
    expect(at).toBeGreaterThan(-1);
    const body = menu.slice(at, at + 700);
    expect(body).toContain("previous.split(\"|\")[activeIndex.value]");
    expect(body).toContain("activeIndex.value = moved");
  });

  it("clears its own previous constraints before every measurement", () => {
    // reposition()'s output BECOMES the menu's min/max width, so measuring
    // while a previous result is still applied feeds the calculation its own
    // stale output. That one flaw wore three costumes: the first open measured
    // a box pinned to zero, a resize from a narrow viewport measured against
    // the narrow cap, and a grown item list measured the old height. Fixing it
    // where the measurement happens covers paths added later too.
    const at = composable.indexOf("function measureUnconstrained");
    expect(at).toBeGreaterThan(-1);
    const body = composable.slice(at, composable.indexOf("function reposition", at));
    expect(body).toContain('menu.style.maxWidth = "";');
    expect(body).toContain('menu.style.minWidth = "";');
    // Restored in the same synchronous pass, so nothing paints in between.
    expect(body).toContain("menu.style.maxWidth = previousMaxWidth;");
    expect(body).toContain("menu.style.minWidth = previousMinWidth;");
    // And reposition has to actually use it rather than read offsetWidth raw.
    const repos = composable.slice(composable.indexOf("function reposition"));
    expect(repos.slice(0, 700)).toContain("menu: measureUnconstrained(menu)");
  });

  it("closes itself when the session ends underneath it", () => {
    // Expiry, or a sign-out in another tab: items empties and the trigger is
    // replaced by the static signed-out footer, but the disclosure stayed
    // open -- an empty teleported role="menu" labelled by an id that no longer
    // exists, focus stranded on a button Vue had just removed.
    const at = menu.indexOf("() => props.signedIn && items.value.length > 0");
    expect(at).toBeGreaterThan(-1);
    const body = menu.slice(at, at + 200);
    expect(body).toContain("if (!usable) closeMenu();");
    // Not restoreFocus: the trigger it would restore to no longer exists.
    expect(body).not.toContain("restoreFocus");
  });

  it("re-measures when Clerk changes the item list, not just the index", () => {
    // A changed list changes the menu's height, and the placement was computed
    // for the old one: an above-placed menu grows down over its own trigger,
    // a below-placed one near the viewport bottom gets clipped.
    const at = menu.indexOf("watch(\n  () => items.value.map");
    const body = menu.slice(at, at + 900);
    expect(body).toContain("void nextTick(reposition)");
  });

  it("measures the popover unconstrained before it places it", () => {
    // openMenu() renders first and measures on the next tick, and closeMenu()
    // clears placement -- so the unplaced branch runs on every open. Falling
    // back to a zero cap there meant reposition() measured an empty shell,
    // `left` was clamped as though the menu were MENU_MIN_WIDTH wide, and the
    // real cap then let it grow past the right edge with nothing re-measuring.
    const at = menu.indexOf("const menuStyle = computed");
    const body = menu.slice(at, menu.indexOf("function onProfile", at));
    const unplaced = body.slice(body.indexOf("if (!placed)"), body.indexOf("return {", body.indexOf("if (!placed)") + 40));
    expect(unplaced).not.toContain("maxWidth");
    expect(unplaced).not.toContain("minWidth");
    expect(body).not.toContain("?? 0}px");
    // The stylesheet keeps that unconstrained pass from provoking a scrollbar.
    expect(menu).toContain("max-width: 100vw");
  });

  it("caps the teleported popover to the viewport", () => {
    // Its content is nowrap, so a long account email makes it intrinsically
    // wider than a phone screen; without a cap the right edge stays offscreen
    // and the email's ellipsis never engages.
    expect(menu).toContain("maxWidth: `${placed.maxWidth}px`");
    expect(menu).toContain("min-width: 0");
  });

  it("routes Clerk through composables, never window.Clerk", () => {
    expect(menu).not.toContain("window.Clerk");
    expect(clerkAccount).not.toContain("window.Clerk");
    expect(clerkAccount).toContain("useClerk");
  });

  it("guards the Clerk plugin before touching it, for prerender safety", () => {
    // useClerk() resolves through Clerk's injection context, which THROWS
    // when the plugin was never installed — and the plugin is client-only.
    // VitePress prerenders every page, so the early return is load-bearing.
    // Anchor on the call site, not the comment that explains it.
    const guardAt = clerkAccount.indexOf("if (!clerkAccountEnabled)");
    const useClerkAt = clerkAccount.indexOf("const clerk = useClerk()");
    expect(guardAt).toBeGreaterThan(-1);
    expect(useClerkAt).toBeGreaterThan(guardAt);
    expect(clerkAccount).toContain("!import.meta.env.SSR");
  });

  it("keeps the disclosure composable free of setup-scope DOM access", () => {
    // Anything reaching for window/document during setup would break the
    // prerender. The listeners hang off a watcher that can only run after a
    // user opens the menu.
    const setupPortion = composable.slice(0, composable.indexOf("watch(open"));
    expect(setupPortion).not.toMatch(/^\s*(window|document)\./m);
    expect(composable).toContain("onBeforeUnmount");
  });

  it("stops Escape from also closing the topbar's panels", () => {
    // AvTopbar registers a window-level Escape handler for its nav and search
    // panels; without stopPropagation one keypress closes all three.
    const escapeBlock = composable.slice(composable.indexOf('event.key === "Escape"'));
    expect(escapeBlock.slice(0, 320)).toContain("stopPropagation");
  });

  it("wires Billing to the real portal endpoint with a fresh token", () => {
    expect(cloudPage).toContain("/api/billing/portal");
    const handler = cloudPage.slice(cloudPage.indexOf("async function openBillingPortal"));
    expect(handler.slice(0, 900)).toContain("{ required: true, fresh: true }");
  });
});

describe("account menu styling ownership", () => {
  it("carries its own responsive overrides, since scoped CSS moved with the markup", () => {
    // Scoped CSS is keyed to the component that renders the element. When the
    // footer moved out of CloudPage, CloudPage's <=960px and <=640px rules
    // stopped matching it and both narrow layouts silently fell back to the
    // desktop treatment. The overrides have to live where the markup does.
    expect(menu).toContain("@media (max-width: 960px)");
    expect(menu).toContain("@media (max-width: 640px)");
    expect(menu).toContain("border-left: 1px solid var(--line-2)");
    // And CloudPage must not keep dead copies that match nothing.
    expect(cloudPage).not.toContain(".cv-side-foot");
    expect(cloudPage).not.toContain(".cv-avatar");
  });

  it("silences its own motion under prefers-reduced-motion", () => {
    // The teleported popover is outside CloudPage's DOM subtree entirely, so
    // CloudPage's reduced-motion block cannot reach it.
    const rm = menu.slice(menu.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rm).toContain(".cv-acct-menu");
    expect(rm).toContain("animation: none");
  });
});
