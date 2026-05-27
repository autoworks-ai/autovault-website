<template>
  <div class="clerk-auth-controls" :class="`clerk-auth-controls--${variant}`">
    <template v-if="hydrated && clerkEnabled && !clerkFailed">
      <ClerkLoaded>
        <Show when="signed-out">
          <SignInButton
            mode="modal"
            :appearance="clerkSignInAppearance"
            :fallback-redirect-url="returnPath"
            :sign-up-fallback-redirect-url="returnPath"
          >
            <button class="clerk-auth-action" type="button">Sign in</button>
          </SignInButton>
          <SignUpButton
            v-if="variant === 'funnel'"
            mode="modal"
            :appearance="clerkSignInAppearance"
            :fallback-redirect-url="returnPath"
            :sign-in-fallback-redirect-url="returnPath"
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
let clerkReadyInterval: number | undefined;
const returnPath = computed(() => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
});

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
});

onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("error", handleWindowError);
  window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  if (clerkLoadTimer) window.clearTimeout(clerkLoadTimer);
  if (clerkReadyInterval) window.clearInterval(clerkReadyInterval);
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

function markClerkReady() {
  if (!(window as unknown as { Clerk?: unknown }).Clerk) return;
  clerkFailed.value = false;
  if (clerkLoadTimer) window.clearTimeout(clerkLoadTimer);
  if (clerkReadyInterval) window.clearInterval(clerkReadyInterval);
}
</script>
