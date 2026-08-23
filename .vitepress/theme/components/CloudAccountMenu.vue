<script setup lang="ts">
import { computed, nextTick, watch } from "vue";
import { useDisclosureMenu } from "../composables/useDisclosureMenu";
import { useClerkAccount } from "../utils/clerkAccount";

const props = defineProps<{
  name: string;
  email: string;
  statusText: string;
  avatarStyle: Record<string, string>;
  signedIn: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{ billing: [] }>();

const { canManageAccount, openProfile, signOutOfVault } = useClerkAccount();

type MenuItem = {
  key: string;
  label: string;
  danger?: boolean;
  // aria-disabled rather than the disabled attribute: a disabled button cannot
  // hold focus, which would punch a hole in the roving tabindex the moment the
  // shell got busy.
  disabled?: boolean;
  run: () => void;
};

// canManageAccount only reports whether the Clerk SDK loaded, which is true
// for a signed-out visitor too -- so it cannot gate these on its own.
// Offering Profile and Sign out to someone who has not signed in produces two
// menu items that silently do nothing.
const items = computed<MenuItem[]>(() => {
  if (!props.signedIn) return [];
  const entries: MenuItem[] = [];
  if (canManageAccount.value) {
    entries.push({ key: "profile", label: "Profile", run: onProfile });
  }
  // Billing is the only item whose action shares the shell's request lock, so
  // it is the only one that can be picked and then quietly do nothing.
  entries.push({ key: "billing", label: "Billing", disabled: props.busy, run: onBilling });
  if (canManageAccount.value) {
    entries.push({ key: "signout", label: "Sign out", danger: true, run: onSignOut });
  }
  return entries;
});

const menu = useDisclosureMenu(() => items.value.length);
const { open, activeIndex, triggerRef, menuRef, placement, toggle, closeMenu, reposition, onTriggerKeydown, onMenuKeydown, setItemRef } = menu;

// A session can end while this menu is open -- an expiry, or a sign-out in
// another tab that Clerk propagates here. `items` empties and the trigger is
// replaced by the static signed-out footer, and nothing was closing the
// disclosure: an empty teleported role="menu" stayed on screen, labelled by an
// id that no longer existed, with focus stranded on a button Vue had just
// removed.
//
// Closed without restoring focus, deliberately. The trigger is gone, so there
// is nothing to restore to; focus falling to the document is the honest
// outcome when the page has changed underneath the user rather than because
// of something they did.
watch(
  () => props.signedIn && items.value.length > 0,
  (usable) => {
    if (!usable) closeMenu();
  }
);

// Clerk finishes loading after first paint, so this list can GROW while the
// menu is open: Billing on its own becomes Profile / Billing / Sign out. Vue
// keeps DOM focus on the keyed button it was already on, but the composable's
// roving index still points at the old position -- so the next ArrowDown from
// Billing would refocus Billing, and ArrowUp would jump to Sign out. Re-resolve
// the index from the key that is actually focused. Only the index needs
// correcting; the DOM focus is already right, so nothing is re-focused here.
watch(
  () => items.value.map((item) => item.key).join("|"),
  (next, previous) => {
    if (!open.value || !previous || next === previous) return;
    const focusedKey = previous.split("|")[activeIndex.value];
    if (!focusedKey) return;
    const moved = next.split("|").indexOf(focusedKey);
    if (moved !== -1) activeIndex.value = moved;

    // The list changing also changes the menu's height, and the placement was
    // computed for the old one. An above-placed menu grows downward over its
    // own trigger; a below-placed one near the bottom of the viewport gets
    // clipped. Re-measure once the new items are in the DOM.
    void nextTick(reposition);
  }
);

const menuStyle = computed(() => {
  const placed = placement.value;

  // The measurement pass. openMenu() renders the menu and only measures it on
  // the next tick, and closeMenu() clears placement, so this branch runs on
  // EVERY open, not just the first.
  //
  // It must not constrain the box. Falling back to `0px` here pinned it to
  // max-width 0, so reposition() measured an empty shell and computeMenuPosition
  // clamped `left` as though the menu were only MENU_MIN_WIDTH wide -- then the
  // real cap let it grow out to its intrinsic width with no second measurement,
  // pushing it off the right edge wherever the trigger sits near one.
  //
  // Unconstrained here means the reported width is the intrinsic width, which
  // is exactly what computeMenuPosition needs to clamp width and `left`
  // together. The stylesheet's max-width: 100vw keeps this hidden pass from
  // provoking a scrollbar, and never binds tighter than the real cap.
  if (!placed) {
    return {
      position: "fixed" as const,
      top: "0px",
      left: "0px",
      visibility: "hidden" as const
    };
  }

  return {
    position: "fixed" as const,
    top: `${placed.top}px`,
    left: `${placed.left}px`,
    minWidth: `${placed.minWidth}px`,
    maxWidth: `${placed.maxWidth}px`,
    visibility: "visible" as const
  };
});

// Profile and Sign out close with restoreFocus:false and only then run their
// action. Returning focus to the trigger first would fight whatever the action
// opens — Clerk's profile modal in particular — for the focus it just took.
function onProfile() {
  closeMenu();
  openProfile();
}

// Billing is the exception, and restores focus. Its action is an async fetch
// that only sometimes navigates away: a 409 (no billing account yet) or a
// Stripe/auth/network failure ends with a notice rendered elsewhere on the
// page and nothing claiming focus, so a bare close would drop the keyboard
// user onto <body> and make them tab in from the top of the document again.
// On the success path the browser navigates to Stripe, so restoring focus to
// the trigger costs nothing.
function onBilling() {
  closeMenu({ restoreFocus: true });
  emit("billing");
}

// An aria-disabled item stays focusable on purpose, so it also stays
// clickable -- the handler is what has to refuse. Leaving the menu open is
// the honest outcome: nothing happened, and the item says why.
function runItem(item: MenuItem) {
  if (item.disabled) return;
  item.run();
}

async function onSignOut() {
  closeMenu();
  await signOutOfVault();
}
</script>

<template>
  <div class="cv-acct">
    <!-- Signed out there is no account to manage, so this is plain status
         text rather than a button that opens an empty menu. -->
    <div v-if="!props.signedIn" class="cv-side-foot static">
      <span class="cv-avatar" aria-hidden="true" />
      <span class="cv-who">
        <strong>Not signed in</strong>
        <small>Step 1 unlocks this panel</small>
      </span>
    </div>

    <button
      v-else
      ref="triggerRef"
      id="cv-account-trigger"
      type="button"
      class="cv-side-foot"
      aria-haspopup="menu"
      aria-controls="cv-account-menu"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="cv-avatar" :style="props.avatarStyle" aria-hidden="true" />
      <span class="cv-who">
        <strong>{{ props.name }}</strong>
        <small>Hosted · {{ props.statusText }}</small>
      </span>
      <span class="visually-hidden">Account menu</span>
      <svg class="cv-acct-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 6.2 5 3.2l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport v-if="open" to="body">
      <div
        ref="menuRef"
        id="cv-account-menu"
        class="cv-acct-menu"
        role="menu"
        tabindex="-1"
        aria-labelledby="cv-account-trigger"
        :style="menuStyle"
        @keydown="onMenuKeydown"
      >
        <div class="cv-acct-head" role="presentation">
          <strong>{{ props.name }}</strong>
          <small>{{ props.email }}</small>
        </div>
        <div class="cv-acct-sep" role="separator" />
        <button
          v-for="(item, index) in items"
          :key="item.key"
          :ref="setItemRef(index)"
          type="button"
          role="menuitem"
          tabindex="-1"
          class="cv-acct-item"
          :class="{ danger: item.danger, 'is-disabled': item.disabled }"
          :aria-disabled="item.disabled ? 'true' : undefined"
          @click="runItem(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cv-acct {
  margin-top: auto;
}

.cv-side-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 8px;
  padding: 13px 6px 4px;
  border: 0;
  border-top: 1px solid var(--line-2);
  border-radius: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}
.cv-side-foot:hover {
  background: rgba(90, 214, 192, 0.06);
}
.cv-side-foot.static {
  cursor: default;
}
.cv-side-foot.static:hover {
  background: none;
}
.cv-side-foot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cv-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex: none;
  background: linear-gradient(135deg, var(--blue), var(--violet));
  background-size: cover;
  background-position: center;
}

.cv-who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cv-who strong {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cv-who small {
  font-size: 11px;
  color: var(--ink-3);
}

.cv-acct-caret {
  margin-left: auto;
  flex: none;
  color: var(--ink-3);
  transition: transform var(--dur-base) var(--ease);
}
.cv-side-foot[aria-expanded="false"] .cv-acct-caret {
  transform: rotate(180deg);
}

/*
 * Teleported to <body> to escape .cv-shell's `overflow: hidden`, so this block
 * inherits :root tokens but NOT the `--cv-radius` custom property, which is
 * declared locally on .cv-page. Radius is a literal here for that reason.
 * Surface deliberately matches clerk.ts's userButtonPopoverCard so this and
 * the topbar's Clerk menu read as one system.
 */
.cv-acct-menu {
  /* Only binds during the hidden measurement pass, when no inline cap is set
     yet -- it stops a very wide intrinsic width provoking a scrollbar for a
     frame. The real cap is narrower, so this never fights it. */
  max-width: 100vw;
  z-index: 200;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-2);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  animation: cv-acct-in var(--dur-fast) var(--ease);
}

@keyframes cv-acct-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

.cv-acct-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 10px;
  /* Lets the nowrap email actually ellipsize once the menu is width-capped. */
  min-width: 0;
}
.cv-acct-head strong {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink);
}
.cv-acct-head small {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cv-acct-sep {
  height: 1px;
  margin: 0 -6px 6px;
  background: var(--line);
}

.cv-acct-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--ink-2);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}
.cv-acct-item:hover,
.cv-acct-item:focus-visible {
  background: rgba(90, 214, 192, 0.08);
  color: var(--ink);
  outline: none;
}
.cv-acct-item.danger:hover,
.cv-acct-item.danger:focus-visible {
  color: #d97171;
}
/*
 * Still focusable -- see the aria-disabled note in the script block -- so it
 * keeps a focus-visible treatment and only loses the pointer affordance and
 * the hover highlight.
 */
.cv-acct-item.is-disabled {
  color: var(--ink-3, var(--ink-2));
  opacity: 0.55;
  cursor: default;
}
.cv-acct-item.is-disabled:hover {
  background: none;
  color: var(--ink-3, var(--ink-2));
}

/*
 * These two overrides used to live in CloudPage's scoped block. They have to
 * move with the markup: scoped CSS is keyed to the component that renders the
 * element, so once the footer became this component's, CloudPage's rules
 * stopped matching it and both narrow layouts silently reverted to the
 * desktop treatment.
 *
 * At <=960px the sidebar becomes a horizontal strip and the account block
 * sits at its right end, so the separator moves from top to left. At <=640px
 * the strip re-stacks vertically and the separator goes back to the top.
 */
@media (max-width: 960px) {
  .cv-acct {
    margin-top: 0;
  }
  .cv-side-foot {
    margin: 0;
    padding: 0 0 0 8px;
    border-top: 0;
    border-left: 1px solid var(--line-2);
  }
}

@media (max-width: 640px) {
  .cv-side-foot {
    padding: 10px 0 0;
    border-top: 1px solid var(--line-2);
    border-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cv-acct-menu {
    animation: none;
  }
  .cv-acct-caret,
  .cv-acct-item,
  .cv-side-foot {
    transition: none;
  }
}
</style>
