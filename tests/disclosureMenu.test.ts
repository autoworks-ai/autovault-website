import { describe, expect, it } from "vitest";
import { computeMenuPosition, nextMenuIndex, MENU_MIN_WIDTH } from "../.vitepress/theme/composables/useDisclosureMenu";

const VIEWPORT = { width: 1280, height: 800 };
const MENU = { width: 208, height: 180 };

describe("computeMenuPosition", () => {
  it("opens upward when the trigger sits at the bottom of the viewport", () => {
    // The desktop case: the account button lives at the bottom of a sidebar
    // in a min-height:640px shell, so there is never room beneath it.
    const placed = computeMenuPosition({
      trigger: { top: 700, left: 24, bottom: 740, right: 224, width: 200 },
      menu: MENU,
      viewport: VIEWPORT
    });

    expect(placed.placement).toBe("above");
    expect(placed.top).toBe(700 - MENU.height - 8);
    expect(placed.left).toBe(24);
  });

  it("opens downward when there is room beneath the trigger", () => {
    // The <=960px case: the sidebar becomes a horizontal strip at the top of
    // the shell, so the trigger has the whole page below it.
    const placed = computeMenuPosition({
      trigger: { top: 80, left: 600, bottom: 120, right: 800, width: 200 },
      menu: MENU,
      viewport: VIEWPORT
    });

    expect(placed.placement).toBe("below");
    expect(placed.top).toBe(128);
  });

  it("clamps a right-edge trigger back inside the viewport", () => {
    // In the <=960px strip the account block is right-aligned, so a naive
    // left-align to the trigger would run the menu off-screen.
    const placed = computeMenuPosition({
      trigger: { top: 80, left: 1180, bottom: 120, right: 1268, width: 88 },
      menu: MENU,
      viewport: VIEWPORT
    });

    expect(placed.left).toBe(VIEWPORT.width - MENU.width - 12);
    expect(placed.left + MENU.width).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it("never places the menu off the left edge on a narrow viewport", () => {
    const placed = computeMenuPosition({
      trigger: { top: 500, left: 8, bottom: 540, right: 200, width: 192 },
      menu: MENU,
      viewport: { width: 375, height: 667 }
    });

    expect(placed.left).toBeGreaterThanOrEqual(12);
    expect(placed.left + MENU.width).toBeLessThanOrEqual(375);
  });

  it("floors the width at the menu minimum but grows to a wider trigger", () => {
    const narrow = computeMenuPosition({
      trigger: { top: 700, left: 24, bottom: 740, right: 104, width: 80 },
      menu: MENU,
      viewport: VIEWPORT
    });
    expect(narrow.minWidth).toBe(MENU_MIN_WIDTH);

    const wide = computeMenuPosition({
      trigger: { top: 700, left: 24, bottom: 740, right: 324, width: 300 },
      menu: MENU,
      viewport: VIEWPORT
    });
    expect(wide.minWidth).toBe(300);
  });

  it("keeps an above-placed menu on screen when the trigger is near the top", () => {
    // Pathological but reachable while scrolling: not enough room either way.
    const placed = computeMenuPosition({
      trigger: { top: 40, left: 24, bottom: 60, right: 224, width: 200 },
      menu: { width: 208, height: 600 },
      viewport: { width: 1280, height: 620 }
    });

    expect(placed.top).toBeGreaterThanOrEqual(12);
  });
});

describe("nextMenuIndex", () => {
  it("wraps in both directions", () => {
    expect(nextMenuIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextMenuIndex(0, "ArrowUp", 3)).toBe(2);
    expect(nextMenuIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextMenuIndex(2, "ArrowUp", 3)).toBe(1);
  });

  it("jumps to the ends", () => {
    expect(nextMenuIndex(1, "Home", 3)).toBe(0);
    expect(nextMenuIndex(1, "End", 3)).toBe(2);
  });

  it("returns the current index for keys it does not handle", () => {
    // The caller only calls preventDefault when the index actually moved, so
    // this is what keeps Enter/Space/letters working normally.
    expect(nextMenuIndex(1, "Enter", 3)).toBe(1);
    expect(nextMenuIndex(1, "a", 3)).toBe(1);
  });

  it("degrades safely with no items", () => {
    expect(nextMenuIndex(0, "ArrowDown", 0)).toBe(-1);
  });
});
