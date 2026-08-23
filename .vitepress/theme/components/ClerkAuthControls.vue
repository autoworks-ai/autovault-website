<template>
  <div class="clerk-auth-controls" :class="`clerk-auth-controls--${variant}`">
    <template v-if="hydrated && clerkEnabled && !clerkFailed">
      <ClerkLoaded>
        <Show when="signed-out">
          <SignInButton
            mode="modal"
            :appearance="clerkSignInAppearance"
            :force-redirect-url="authReturnPath"
            :fallback-redirect-url="authReturnPath"
            :sign-up-force-redirect-url="authReturnPath"
            :sign-up-fallback-redirect-url="authReturnPath"
          >
            <button class="clerk-auth-action" type="button">Sign in</button>
          </SignInButton>
          <SignUpButton
            v-if="variant === 'funnel'"
            mode="modal"
            :appearance="clerkSignInAppearance"
            :force-redirect-url="authReturnPath"
            :fallback-redirect-url="authReturnPath"
            :sign-in-force-redirect-url="authReturnPath"
            :sign-in-fallback-redirect-url="authReturnPath"
          >
            <button class="clerk-auth-action primary" type="button">{{ ctaLabel }}</button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <button v-if="variant === 'funnel'" class="clerk-auth-action" type="button" @click="emit('signedInAction')">{{ signedInLabel }}</button>
          <UserButton
            :appearance="clerkSignInAppearance"
            :user-profile-props="clerkUserProfileProps"
            :sign-in-url="clerkBrand.cloudPath"
            :after-switch-session-url="clerkBrand.cloudPath"
          >
            <UserButton.MenuItems>
              <UserButton.Action label="manageAccount" />
              <UserButton.Action label="Cloud namespace" open="autovault-cloud">
                <template #labelIcon>
                  <span class="clerk-menu-glyph clerk-menu-glyph--cloud" aria-hidden="true"></span>
                </template>
              </UserButton.Action>
              <UserButton.Link :href="clerkBrand.docsPath" label="Docs">
                <template #labelIcon>
                  <span class="clerk-menu-glyph clerk-menu-glyph--docs" aria-hidden="true"></span>
                </template>
              </UserButton.Link>
              <UserButton.Link :href="clerkBrand.supportUrl" label="Support">
                <template #labelIcon>
                  <span class="clerk-menu-glyph clerk-menu-glyph--support" aria-hidden="true"></span>
                </template>
              </UserButton.Link>
              <UserButton.Action label="signOut" />
            </UserButton.MenuItems>
            <UserButton.UserProfilePage label="account" />
            <UserButton.UserProfilePage label="security" />
            <!--
              ClerkCloudTab fetches /api/me (and, if a vault exists, a device
              count) on its own onMounted -- which is safe here specifically
              because UserProfilePage's default slot is a Clerk custom page:
              Clerk only mounts a custom page's content once the popover is
              routed to it, never as part of the popover's own initial
              render. Verified in the browser: opening the UserButton
              popover alone never puts this page's content in the DOM, only
              clicking "Cloud namespace" does. ClerkAuthControls mounts on
              every page of the site, signed in or not -- do NOT lift this
              fetch (or one like it) up into this component's own onMounted
              above, and do NOT reuse ClerkCloudTab anywhere that isn't this
              exact lazily-routed slot. That is the P1 this repo already
              paid for once (see tests/clerkProductionConfig.test.ts and
              commit 2a81d91): two independent owners of /api/me state,
              one of them running unconditionally on a page that has nothing
              to do with cloud status.
            -->
            <UserButton.UserProfilePage label="AutoVault cloud" url="autovault-cloud">
              <template #labelIcon>
                <span class="clerk-menu-glyph clerk-menu-glyph--cloud" aria-hidden="true"></span>
              </template>
              <ClerkCloudTab />
            </UserButton.UserProfilePage>
          </UserButton>
        </Show>
      </ClerkLoaded>
    </template>

    <template v-else-if="hydrated && clerkEnabled && clerkFailed">
      <span class="clerk-auth-unavailable" role="status">AutoVault auth is unavailable</span>
    </template>

    <template v-else-if="hydrated && variant === 'funnel'">
      <a class="clerk-auth-action primary" :href="hostedPath">{{ ctaLabel }}</a>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ClerkLoaded, Show, SignInButton, SignUpButton, UserButton } from "@clerk/vue";
import { clerkBrand, clerkSignInAppearance, clerkUserProfileProps } from "../clerk";
import { withAdmitParam } from "../utils/admit";
import ClerkCloudTab from "./ClerkCloudTab.vue";

const props = withDefaults(defineProps<{
  ctaLabel?: string;
  signedInLabel?: string;
  variant?: "topbar" | "funnel";
}>(), {
  ctaLabel: "Create vault",
  signedInLabel: "Onboarding",
  variant: "topbar"
});
const emit = defineEmits<{
  signedInAction: [];
}>();

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) && !import.meta.env.SSR;
const hostedPath = clerkBrand.cloudPath;
const hydrated = ref(false);
const clerkFailed = ref(false);
let clerkLoadTimer: number | undefined;
// Minimal shape of the bits of the Clerk global this component touches. The
// full type lives behind the plugin, which is not installed during prerender.
type ClerkLike = {
  loaded?: boolean;
  session?: unknown;
  client?: { sessions?: Array<{ id: string; status: string }> };
  setActive?: (opts: { session: string }) => Promise<unknown>;
};

let clerkReadyInterval: number | undefined;
let sessionRepairInterval: number | undefined;
// Carries `?admit=` through the sign-in round trip. A signed-out owner
// following the link `autovault link` printed would otherwise come back to a
// bare /cloud, and the handshake would degrade to hunting for the row by hand
// at exactly the moment it was supposed to help.
//
// Safe to read `window` here: every consumer of this computed sits inside the
// `hydrated && clerkEnabled` branch, which renders nothing during prerender.
// The guard is belt and braces.
const authReturnPath = computed(() =>
  typeof window === "undefined"
    ? clerkBrand.cloudPath
    : withAdmitParam(clerkBrand.cloudPath, window.location.search)
);

onMounted(() => {
  hydrated.value = true;
  if (!clerkEnabled) return;

  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  markClerkReady();
  clerkLoadTimer = window.setTimeout(() => {
    if (!(window as unknown as { Clerk?: unknown }).Clerk) clerkFailed.value = true;
  }, 8000);
  clerkReadyInterval = window.setInterval(markClerkReady, 500);
  sessionRepairInterval = window.setInterval(activatePendingSession, 400);
});

onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("error", handleWindowError);
  window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  if (clerkLoadTimer) window.clearTimeout(clerkLoadTimer);
  if (clerkReadyInterval) window.clearInterval(clerkReadyInterval);
  stopSessionRepair();
});

function handleWindowError(event: ErrorEvent) {
  if (isClerkLoadFailure(event.message) || isClerkLoadFailure(event.error)) {
    clerkFailed.value = true;
  }
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
  if (isClerkLoadFailure(event.reason)) {
    clerkFailed.value = true;
  }
}

function isClerkLoadFailure(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return /failed_to_load_clerk|failed to load clerk/i.test(message);
}

// Clerk's modal sign-up finishes by navigating to its forced redirect URL.
// On /cloud that URL IS /cloud#launch-path -- the page the user is already
// on -- so the browser performs a same-document hash change, never reloads,
// and Clerk does not finish activating the session it just created.
//
// The observable result is a dead end: client.sessions holds a session with
// status "active" while Clerk.session and Clerk.user stay null, so BOTH
// <Show when="signed-out"> and <Show when="signed-in"> render nothing. The
// user sees step 1 with an empty action slot and no way forward but a manual
// reload -- which works, because a fresh load re-reads the __client cookie
// and activates the session properly.
//
// Reconcile it here instead of asking the user to guess. setActive is
// idempotent and this no-ops in every state except the broken one.
let repairingSession = false;

// This is a one-shot rescue, not a poller, and the distinction is load-bearing
// because the interval is 400ms. A Clerk or network failure that leaves the
// created session visible while setActive keeps rejecting would otherwise
// retry about 150 times a minute, forever, in every affected tab. The budget
// is per session id, so a genuinely new sign-up still gets its own attempts
// rather than inheriting a spent counter.
const SESSION_REPAIR_ATTEMPTS = 3;
let repairTargetId: string | null = null;
let repairsLeft = SESSION_REPAIR_ATTEMPTS;

function stopSessionRepair() {
  if (sessionRepairInterval) window.clearInterval(sessionRepairInterval);
  sessionRepairInterval = undefined;
}

async function activatePendingSession() {
  const clerk = (window as unknown as { Clerk?: ClerkLike }).Clerk;
  if (!clerk?.loaded || clerk.session || repairingSession) return;

  const pending = clerk.client?.sessions?.find((s) => s.status === "active");
  if (!pending) return;

  if (pending.id !== repairTargetId) {
    repairTargetId = pending.id;
    repairsLeft = SESSION_REPAIR_ATTEMPTS;
  }
  if (repairsLeft <= 0) return;

  repairingSession = true;
  try {
    await clerk.setActive?.({ session: pending.id });
  } catch {
    // A failed repair is not worth surfacing: the sign-in controls are still
    // rendered and a reload remains a working fallback. Give up once the
    // budget is spent so a persistent failure cannot become a retry storm.
    repairsLeft -= 1;
    if (repairsLeft <= 0) stopSessionRepair();
  } finally {
    repairingSession = false;
  }
}

function markClerkReady() {
  if (!(window as unknown as { Clerk?: unknown }).Clerk) return;
  clerkFailed.value = false;
  if (clerkLoadTimer) window.clearTimeout(clerkLoadTimer);
  if (clerkReadyInterval) window.clearInterval(clerkReadyInterval);
}
</script>
