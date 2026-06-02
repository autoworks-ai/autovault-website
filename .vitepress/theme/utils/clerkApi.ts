import { computed, type ComputedRef } from "vue";
import { useAuth, useUser } from "@clerk/vue";

type HeaderMap = Record<string, string>;
type ClerkGetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;
type ClerkAuthHeaderOptions = {
  required?: boolean;
  fresh?: boolean;
};
type ClerkAuthHeaderInput = {
  clerkAuthEnabled: boolean;
  headers: HeaderMap;
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: ClerkGetToken;
};
export type ClerkApiAuthErrorReason = "clerk-not-loaded" | "signed-out" | "token-unavailable";
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
  authHeaders: (headers: HeaderMap, options?: ClerkAuthHeaderOptions) => Promise<HeaderMap>;
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

export class ClerkApiAuthError extends Error {
  readonly reason: ClerkApiAuthErrorReason;

  constructor(reason: ClerkApiAuthErrorReason, cause?: unknown) {
    super(clerkAuthErrorText(reason), { cause });
    this.name = "ClerkApiAuthError";
    this.reason = reason;
  }
}

export async function resolveClerkAuthHeaders(
  input: ClerkAuthHeaderInput,
  options: ClerkAuthHeaderOptions = {}
): Promise<HeaderMap> {
  if (!input.clerkAuthEnabled) return input.headers;

  if (!input.isLoaded) {
    if (options.required) throw new ClerkApiAuthError("clerk-not-loaded");
    return input.headers;
  }

  if (!input.isSignedIn) {
    if (options.required) throw new ClerkApiAuthError("signed-out");
    return input.headers;
  }

  let token: string | null;
  try {
    token = await input.getToken(options.fresh ? { skipCache: true } : undefined);
  } catch (error) {
    if (options.required) throw new ClerkApiAuthError("token-unavailable", error);
    return input.headers;
  }

  if (!token) {
    if (options.required) throw new ClerkApiAuthError("token-unavailable");
    return input.headers;
  }

  return { ...input.headers, authorization: `Bearer ${token}` };
}

export function isClerkApiAuthError(error: unknown): error is ClerkApiAuthError {
  return error instanceof ClerkApiAuthError;
}

export function clerkAuthRecoveryMessage(error: unknown) {
  if (!isClerkApiAuthError(error)) {
    return "Could not confirm your session. Sign in again to resume.";
  }

  if (error.reason === "clerk-not-loaded") {
    return "AutoVault auth is still loading. Try again in a moment.";
  }

  if (error.reason === "signed-out") {
    return "Create your account or sign in before opening checkout.";
  }

  return "Could not refresh your Clerk session. Sign in again to resume.";
}

export function useClerkApiAuth(): ClerkApiAuth {
  if (!clerkAuthEnabled) {
    return {
      authHeaders: async (headers, options) => resolveClerkAuthHeaders({
        clerkAuthEnabled,
        headers,
        isLoaded: false,
        isSignedIn: false,
        getToken: async () => null
      }, options),
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
    authHeaders: (headers, options) => resolveClerkAuthHeaders({
      clerkAuthEnabled,
      headers,
      isLoaded: Boolean(isLoaded.value),
      isSignedIn: Boolean(isSignedIn.value),
      getToken: (tokenOptions) => getToken.value(tokenOptions)
    }, options),
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

function clerkAuthErrorText(reason: ClerkApiAuthErrorReason) {
  if (reason === "clerk-not-loaded") return "Clerk auth is still loading.";
  if (reason === "signed-out") return "Clerk user is signed out.";
  return "Clerk session token is unavailable.";
}
