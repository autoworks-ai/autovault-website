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
    for (const handler of ["function onProfile", "function onBilling", "async function onSignOut"]) {
      const body = menu.slice(menu.indexOf(handler), menu.indexOf(handler) + 220);
      expect(body).toContain("closeMenu()");
      expect(body).not.toContain("restoreFocus: true");
    }
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
