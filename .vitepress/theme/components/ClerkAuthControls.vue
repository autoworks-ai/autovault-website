<template>
  <div class="clerk-auth-controls" :class="`clerk-auth-controls--${variant}`">
    <template v-if="clerkEnabled">
      <ClerkLoaded>
        <Show when="signed-out">
          <SignInButton mode="modal" :fallback-redirect-url="returnPath" :sign-up-fallback-redirect-url="returnPath">
            <button class="clerk-auth-action" type="button">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal" :fallback-redirect-url="returnPath" :sign-in-fallback-redirect-url="returnPath">
            <button class="clerk-auth-action primary" type="button">{{ ctaLabel }}</button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <a class="clerk-auth-action" href="/cloud#launch-path">{{ signedInLabel }}</a>
          <UserButton />
        </Show>
      </ClerkLoaded>
    </template>

    <template v-else>
      <a class="clerk-auth-action primary" href="/cloud#launch-path">{{ ctaLabel }}</a>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ClerkLoaded, Show, SignInButton, SignUpButton, UserButton } from "@clerk/vue";

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
const returnPath = computed(() => {
  if (typeof window === "undefined") return "/cloud#launch-path";
  if (props.variant !== "funnel") return "/cloud#launch-path";
  return `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
});
</script>
