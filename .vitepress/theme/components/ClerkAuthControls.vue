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
            <UserButton.UserProfilePage label="AutoVault cloud" url="autovault-cloud">
              <template #labelIcon>
                <span class="clerk-menu-glyph clerk-menu-glyph--cloud" aria-hidden="true"></span>
              </template>
              <div class="clerk-profile-page">
                <p class="clerk-profile-kicker">Hosted namespace</p>
                <h2>AutoVault cloud</h2>
                <p>Manage your reserved namespace from the cloud dashboard. Account identity and security stay in Clerk.</p>
                <a :href="clerkBrand.cloudPath">Open cloud dashboard</a>
              </div>
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
const authReturnPath = computed(() => clerkBrand.cloudPath);

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
  if (sessionRepairInterval) window.clearInterval(sessionRepairInterval);
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

async function activatePendingSession() {
  const clerk = (window as unknown as { Clerk?: ClerkLike }).Clerk;
  if (!clerk?.loaded || clerk.session || repairingSession) return;

  const pending = clerk.client?.sessions?.find((s) => s.status === "active");
  if (!pending) return;

  repairingSession = true;
  try {
    await clerk.setActive?.({ session: pending.id });
  } catch {
    // A failed repair is not worth surfacing: the sign-in controls are still
    // rendered and a reload remains a working fallback.
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
