import { computed, type ComputedRef } from "vue";
import { useClerk } from "@clerk/vue";
import { clerkRedirects, clerkUserProfileProps } from "../clerk";

// Mirrors the guard in clerkApi.ts. `useClerk()` resolves through Clerk's
// injection context, which THROWS when the plugin was never installed — and
// the plugin is installed client-side only (theme/index.ts guards on
// `!import.meta.env.SSR`). VitePress prerenders every page, so this early
// return is what keeps the build from crashing, not a nicety.
const clerkAccountEnabled =
  Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) && !import.meta.env.SSR;

const unavailable = computed(() => false);

export type ClerkAccount = {
  clerkAccountEnabled: boolean;
  canManageAccount: ComputedRef<boolean>;
  openProfile: () => void;
  signOutOfVault: () => Promise<void>;
};

export function useClerkAccount(): ClerkAccount {
  if (!clerkAccountEnabled) {
    return {
      clerkAccountEnabled,
      canManageAccount: unavailable,
      openProfile: () => {},
      signOutOfVault: async () => {}
    };
  }

  const clerk = useClerk();

  return {
    clerkAccountEnabled,
    canManageAccount: computed(() => Boolean(clerk.value)),
    // Reuses the same appearance and redirect config as the topbar's
    // UserButton so the profile modal and sign-out destination are identical
    // wherever the user reaches them from.
    openProfile: () => {
      clerk.value?.openUserProfile(clerkUserProfileProps);
    },
    signOutOfVault: async () => {
      await clerk.value?.signOut({ redirectUrl: clerkRedirects.afterSignOutUrl });
    }
  };
}
