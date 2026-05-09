import type { PluginOptions } from "@clerk/vue";

const cloudPath = "/cloud#launch-path";

export const clerkBrand = {
  logoImageUrl: import.meta.env.VITE_CLERK_BRAND_LOGO_URL || "https://autovault.dev/brand-mark.svg",
  logoLinkUrl: "/",
  cloudPath,
  docsPath: "/quick-start",
  supportUrl: "https://drunk.support/category/autojack/"
} as const;

export const clerkAppearance = {
  layout: {
    logoImageUrl: clerkBrand.logoImageUrl,
    logoLinkUrl: clerkBrand.logoLinkUrl,
    logoPlacement: "inside",
    socialButtonsPlacement: "bottom",
    socialButtonsVariant: "blockButton"
  },
  variables: {
    colorPrimary: import.meta.env.VITE_CLERK_BRAND_COLOR_PRIMARY || "#5ad6c0",
    colorBackground: import.meta.env.VITE_CLERK_BRAND_COLOR_BACKGROUND || "#0b1014",
    colorInputBackground: "#0f161c",
    colorInputText: "#e6edf3",
    colorText: "#e6edf3",
    colorTextSecondary: "#aab8c5",
    colorNeutral: "#6e8090",
    borderRadius: "8px",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  elements: {
    cardBox: {
      boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)"
    },
    card: {
      backgroundColor: "#0b1014",
      border: "1px solid #1f2c37"
    },
    headerTitle: {
      color: "#e6edf3",
      fontWeight: "500",
      letterSpacing: "0"
    },
    headerSubtitle: {
      color: "#aab8c5"
    },
    formFieldLabel: {
      color: "#aab8c5"
    },
    formFieldInput: {
      backgroundColor: "#0f161c",
      borderColor: "#283744",
      color: "#e6edf3"
    },
    formButtonPrimary: {
      backgroundColor: "#5ad6c0",
      color: "#062821",
      fontWeight: "600"
    },
    footerActionLink: {
      color: "#5ad6c0"
    },
    navbarButton: {
      color: "#aab8c5"
    },
    navbarButtonIcon: {
      color: "#5ad6c0"
    },
    modalBackdrop: {
      backgroundColor: "rgba(3, 7, 11, 0.72)",
      backdropFilter: "blur(10px)"
    }
  }
} satisfies NonNullable<PluginOptions["appearance"]>;

export const clerkLocalization = {
  locale: "en-US",
  socialButtonsBlockButton: "Continue with {{provider|titleize}}",
  dividerText: "or",
  signIn: {
    start: {
      title: "Access AutoVault",
      subtitle: "Use your AutoVault cloud account.",
      actionText: "New to AutoVault?",
      actionLink: "Create an account"
    }
  },
  signUp: {
    start: {
      title: "Reserve AutoVault cloud",
      subtitle: "Create an account to reserve a hosted namespace.",
      actionText: "Already have an account?",
      actionLink: "Sign in"
    }
  },
  userButton: {
    action__manageAccount: "Account settings",
    action__signOut: "Sign out"
  },
  userProfile: {
    navbar: {
      title: "AutoVault account",
      description: "Manage sign-in, security, and hosted namespace details.",
      account: "Profile",
      security: "Security"
    },
    start: {
      headerTitle__account: "Profile",
      headerTitle__security: "Security"
    }
  }
} satisfies NonNullable<PluginOptions["localization"]>;

export const clerkRedirects = {
  afterSignOutUrl: "/",
  signInFallbackRedirectUrl: cloudPath,
  signUpFallbackRedirectUrl: cloudPath
} as const;

export const clerkPluginOptions = {
  ...clerkRedirects,
  appearance: clerkAppearance,
  localization: clerkLocalization
} satisfies Omit<PluginOptions, "publishableKey">;

export const clerkSignInAppearance = clerkAppearance;

export const clerkUserProfileProps = {
  appearance: clerkAppearance
} as const;
