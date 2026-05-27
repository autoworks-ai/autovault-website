import { computed, type ComputedRef } from "vue";
import { useAuth, useUser } from "@clerk/vue";

type HeaderMap = Record<string, string>;
type ClerkEmailLike = { emailAddress?: string | null };
type ClerkUserLike = {
  primaryEmailAddress?: ClerkEmailLike | null;
  emailAddresses?: ClerkEmailLike[] | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
};

type ClerkApiAuth = {
  authHeaders: (headers: HeaderMap) => Promise<HeaderMap>;
  clerkAuthEnabled: boolean;
  isClerkLoaded: ComputedRef<boolean>;
  isClerkSignedIn: ComputedRef<boolean>;
  clerkUserLabel: ComputedRef<string>;
  clerkUserSlugSeed: ComputedRef<string>;
};

const clerkAuthEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) && !import.meta.env.SSR;
const loadedWithoutClerk = computed(() => !clerkAuthEnabled);
const signedOutWithoutClerk = computed(() => false);
const emptyUserLabel = computed(() => "");
const emptyUserSlugSeed = computed(() => "");

export function useClerkApiAuth(): ClerkApiAuth {
  if (!clerkAuthEnabled) {
    return {
      authHeaders: async (headers) => headers,
      clerkAuthEnabled,
      isClerkLoaded: loadedWithoutClerk,
      isClerkSignedIn: signedOutWithoutClerk,
      clerkUserLabel: emptyUserLabel,
      clerkUserSlugSeed: emptyUserSlugSeed
    };
  }

  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  return {
    authHeaders: async (headers) => {
      const token = await getToken.value();
      return token ? { ...headers, authorization: `Bearer ${token}` } : headers;
    },
    clerkAuthEnabled,
    isClerkLoaded: computed(() => Boolean(isLoaded.value)),
    isClerkSignedIn: computed(() => Boolean(isSignedIn.value)),
    clerkUserLabel: computed(() => clerkUserIdentity(user.value).label),
    clerkUserSlugSeed: computed(() => clerkUserIdentity(user.value).slugSeed)
  };
}

function clerkUserIdentity(user: unknown) {
  const current = user as ClerkUserLike | null | undefined;
  const email = current?.primaryEmailAddress?.emailAddress || current?.emailAddresses?.[0]?.emailAddress || "";
  const name = current?.fullName || [current?.firstName, current?.lastName].filter(Boolean).join(" ") || current?.username || "";

  return {
    label: email || name || "",
    slugSeed: email || name || ""
  };
}
