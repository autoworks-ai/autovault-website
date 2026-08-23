import { nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance, type Ref } from "vue";

export type MenuRect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
};

export type MenuPlacement = {
  top: number;
  left: number;
  minWidth: number;
  placement: "above" | "below";
};

export const MENU_MIN_WIDTH = 208;

/**
 * Place a popover relative to its trigger using the space actually available,
 * rather than branching on viewport breakpoints.
 *
 * The trigger this serves moves three times across the dashboard's responsive
 * layouts — bottom of a left sidebar, top-right of a horizontal strip at
 * <=960px, bottom of a stacked strip at <=640px. A breakpoint-driven rule
 * would need updating every time that layout changes; "below if it fits, else
 * above, then clamp into the viewport" is correct in all three and in
 * whatever comes next.
 *
 * Pure by design: the DOM measuring happens at the call site so this can be
 * unit-tested in the repo's node-only vitest environment.
 */
export function computeMenuPosition(input: {
  trigger: MenuRect;
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  gutter?: number;
  margin?: number;
}): MenuPlacement {
  const gutter = input.gutter ?? 8;
  const margin = input.margin ?? 12;
  const minWidth = Math.max(input.trigger.width, MENU_MIN_WIDTH);
  const width = Math.max(input.menu.width, minWidth);

  const roomBelow = input.viewport.height - input.trigger.bottom;
  const fitsBelow = roomBelow >= input.menu.height + gutter + margin;
  const placement: "above" | "below" = fitsBelow ? "below" : "above";

  const top = fitsBelow
    ? input.trigger.bottom + gutter
    : Math.max(margin, input.trigger.top - input.menu.height - gutter);

  const maxLeft = Math.max(margin, input.viewport.width - width - margin);
  const left = Math.min(Math.max(input.trigger.left, margin), maxLeft);

  return { top, left, minWidth, placement };
}

const MENU_NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/**
 * Whether the menu owns this key. Deliberately separate from nextMenuIndex:
 * a handled key can legitimately resolve to the index it started on -- Home on
 * the first item, End on the last, any arrow while the menu holds a single
 * item -- so "the index did not move" says nothing about whether the browser
 * should still act on the key.
 */
export function isMenuNavigationKey(key: string): boolean {
  return MENU_NAVIGATION_KEYS.has(key);
}

/**
 * Roving-focus index for a menu. Returns `current` for keys it doesn't handle,
 * and also for handled keys already at their destination -- use
 * isMenuNavigationKey to tell those apart.
 */
export function nextMenuIndex(current: number, key: string, count: number): number {
  if (count <= 0) return -1;
  switch (key) {
    case "ArrowDown":
      return current >= count - 1 ? 0 : current + 1;
    case "ArrowUp":
      return current <= 0 ? count - 1 : current - 1;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return current;
  }
}

export type DisclosureMenu = {
  open: Ref<boolean>;
  activeIndex: Ref<number>;
  triggerRef: Ref<HTMLElement | null>;
  menuRef: Ref<HTMLElement | null>;
  placement: Ref<MenuPlacement | null>;
  openMenu: (focus?: "first" | "last") => void;
  closeMenu: (options?: { restoreFocus?: boolean }) => void;
  toggle: () => void;
  onTriggerKeydown: (event: KeyboardEvent) => void;
  onMenuKeydown: (event: KeyboardEvent) => void;
  setItemRef: (index: number) => (el: Element | ComponentPublicInstance | null) => void;
};

/**
 * WAI-ARIA menu-button behaviour. Deliberately not a dialog: no focus trap,
 * so Tab closes the menu and moves on rather than cycling inside it.
 *
 * SSR-safe by construction — nothing here touches `window` or `document` at
 * module scope or during setup. The listeners attach inside a watcher that
 * can only ever run after a user opens the menu, which is client-only.
 */
export function useDisclosureMenu(itemCount: () => number): DisclosureMenu {
  const open = ref(false);
  const activeIndex = ref(-1);
  const triggerRef = ref<HTMLElement | null>(null);
  const menuRef = ref<HTMLElement | null>(null);
  const placement = ref<MenuPlacement | null>(null);
  const itemRefs = ref<HTMLElement[]>([]);
  let frame = 0;

  function setItemRef(index: number) {
    return (el: Element | ComponentPublicInstance | null) => {
      const node = (el && "$el" in (el as ComponentPublicInstance)
        ? (el as ComponentPublicInstance).$el
        : el) as HTMLElement | null;
      if (node) itemRefs.value[index] = node;
      else itemRefs.value.splice(index, 1);
    };
  }

  function focusItem(index: number) {
    activeIndex.value = index;
    void nextTick(() => itemRefs.value[index]?.focus());
  }

  function reposition() {
    const trigger = triggerRef.value;
    const menu = menuRef.value;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    placement.value = computeMenuPosition({
      trigger: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width
      },
      menu: { width: menu.offsetWidth, height: menu.offsetHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight }
    });
  }

  function scheduleReposition() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      reposition();
    });
  }

  function openMenu(focus: "first" | "last" = "first") {
    if (open.value) return;
    open.value = true;
    void nextTick(() => {
      reposition();
      focusItem(focus === "first" ? 0 : Math.max(0, itemCount() - 1));
    });
  }

  function closeMenu(options: { restoreFocus?: boolean } = {}) {
    if (!open.value) return;
    open.value = false;
    activeIndex.value = -1;
    placement.value = null;
    // Restoring focus is correct for Escape, and wrong for anything that
    // hands focus somewhere else on purpose — activating an item that opens a
    // modal, for instance, where yanking focus back to the trigger fights the
    // dialog for it.
    if (options.restoreFocus) triggerRef.value?.focus();
  }

  function toggle() {
    if (open.value) closeMenu({ restoreFocus: true });
    else openMenu("first");
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
    }
  }

  function onMenuKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      // AvTopbar registers a window-level Escape handler that closes its nav
      // and search panels. Without this the same keypress would close those
      // too, which reads as the page lurching.
      event.stopPropagation();
      closeMenu({ restoreFocus: true });
      return;
    }
    if (event.key === "Tab") {
      // restoreFocus, not a bare close. The menu is teleported to the end of
      // <body> and its items are tabindex="-1", so sequential navigation would
      // resume from that teleported position -- or from <body> once Vue removes
      // the node -- and dump the user at the top or bottom of the page. Moving
      // focus to the trigger synchronously and letting the default Tab run
      // continues the tab order from where the menu actually appears.
      closeMenu({ restoreFocus: true });
      return;
    }
    if (isMenuNavigationKey(event.key)) {
      // Gate on the key, not on whether the index moved. Home at the first
      // item, End at the last, and every arrow while the menu holds a single
      // item all resolve to the current index; letting those reach the browser
      // scrolls the page behind an open menu.
      event.preventDefault();
      focusItem(nextMenuIndex(activeIndex.value, event.key, itemCount()));
    }
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.target as Node | null;
    if (!target) return;
    if (triggerRef.value?.contains(target) || menuRef.value?.contains(target)) return;
    closeMenu();
  }

  function onFocusIn(event: FocusEvent) {
    const target = event.target as Node | null;
    if (!target) return;
    if (triggerRef.value?.contains(target) || menuRef.value?.contains(target)) return;
    closeMenu();
  }

  watch(open, (isOpen) => {
    if (isOpen) {
      window.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("focusin", onFocusIn, true);
      // Capture so the menu keeps tracking a trigger inside a scrolling
      // container. Closing on scroll would be wrong here: in the <=960px
      // layout the trigger stays visible while the page moves under it.
      window.addEventListener("scroll", scheduleReposition, true);
      window.addEventListener("resize", scheduleReposition);
    } else {
      itemRefs.value = [];
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("scroll", scheduleReposition, true);
      window.removeEventListener("resize", scheduleReposition);
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    }
  });

  onBeforeUnmount(() => {
    if (!open.value) return;
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("focusin", onFocusIn, true);
    window.removeEventListener("scroll", scheduleReposition, true);
    window.removeEventListener("resize", scheduleReposition);
    if (frame) window.cancelAnimationFrame(frame);
  });

  return {
    open,
    activeIndex,
    triggerRef,
    menuRef,
    placement,
    openMenu,
    closeMenu,
    toggle,
    onTriggerKeydown,
    onMenuKeydown,
    setItemRef
  };
}
