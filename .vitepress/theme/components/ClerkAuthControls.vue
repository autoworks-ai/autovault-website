<template>
  <div class="clerk-auth-controls" :class="`clerk-auth-controls--${variant}`">
    <template v-if="hydrated && clerkEnabled">
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
          <a v-if="variant === 'funnel'" class="clerk-auth-action" :href="returnPath">{{ signedInLabel }}</a>
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

    <template v-else-if="hydrated && variant === 'funnel'">
      <a class="clerk-auth-action primary" :href="hostedPath">{{ ctaLabel }}</a>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) && !import.meta.env.SSR;
const hostedPath = clerkBrand.cloudPath;
const hydrated = ref(false);
const returnPath = computed(() => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
});

onMounted(() => {
  hydrated.value = true;
});
</script>
