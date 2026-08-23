<script setup lang="ts">
import { computed } from "vue";
import { useDisclosureMenu } from "../composables/useDisclosureMenu";
import { useClerkAccount } from "../utils/clerkAccount";

const props = defineProps<{
  name: string;
  email: string;
  statusText: string;
  avatarStyle: Record<string, string>;
}>();

const emit = defineEmits<{ billing: [] }>();

const { canManageAccount, openProfile, signOutOfVault } = useClerkAccount();

type MenuItem = { key: string; label: string; danger?: boolean; run: () => void };

const items = computed<MenuItem[]>(() => {
  const entries: MenuItem[] = [];
  if (canManageAccount.value) {
    entries.push({ key: "profile", label: "Profile", run: onProfile });
  }
  entries.push({ key: "billing", label: "Billing", run: onBilling });
  if (canManageAccount.value) {
    entries.push({ key: "signout", label: "Sign out", danger: true, run: onSignOut });
  }
  return entries;
});

const menu = useDisclosureMenu(() => items.value.length);
const { open, triggerRef, menuRef, placement, toggle, closeMenu, onTriggerKeydown, onMenuKeydown, setItemRef } = menu;

const menuStyle = computed(() => ({
  position: "fixed" as const,
  top: `${placement.value?.top ?? 0}px`,
  left: `${placement.value?.left ?? 0}px`,
  minWidth: `${placement.value?.minWidth ?? 0}px`,
  visibility: placement.value ? ("visible" as const) : ("hidden" as const)
}));

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

async function onSignOut() {
  closeMenu();
  await signOutOfVault();
}
</script>

<template>
  <div class="cv-acct">
    <button
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
          :class="{ danger: item.danger }"
          @click="item.run()"
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
