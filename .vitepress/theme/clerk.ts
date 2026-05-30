import type { PluginOptions } from "@clerk/vue";

const cloudPath = "/cloud#launch-path";

export const clerkBrand = {
  logoImageUrl: import.meta.env.VITE_CLERK_BRAND_LOGO_URL || "https://autovault.dev/brand-mark.svg",
  logoLinkUrl: "/",
  cloudPath,
  docsPath: "/quick-start",
  supportUrl: "https://github.com/autoworks-ai/autovault/issues"
} as const;

// Motion + accent tokens mirrored from the site's styles.css so Clerk's modals,
// UserButton popover, and account pages read as hand-built AutoVault surfaces
// rather than a themed third-party widget.
const ACCENT = "#5ad6c0";
const ACCENT_INK = "#062821";
const ACCENT_RING = "rgba(90, 214, 192, 0.18)";
const ACCENT_SOFT = "rgba(90, 214, 192, 0.12)";
const SURFACE = "#0b1014";
const SURFACE_2 = "#0f161c";
const SURFACE_3 = "#131c24";
const LINE = "#1f2c37";
const LINE_2 = "#283744";
const INK = "#e6edf3";
const INK_2 = "#aab8c5";
const INK_3 = "#6e8090";
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export const clerkAppearance = {
  layout: {
    logoImageUrl: clerkBrand.logoImageUrl,
    logoLinkUrl: clerkBrand.logoLinkUrl,
    logoPlacement: "inside",
    socialButtonsPlacement: "bottom",
    socialButtonsVariant: "blockButton"
  },
  variables: {
    colorPrimary: import.meta.env.VITE_CLERK_BRAND_COLOR_PRIMARY || ACCENT,
    colorBackground: import.meta.env.VITE_CLERK_BRAND_COLOR_BACKGROUND || SURFACE,
    colorInputBackground: SURFACE_2,
    colorInputText: INK,
    colorText: INK,
    colorTextSecondary: INK_2,
    colorTextOnPrimaryBackground: ACCENT_INK,
    colorNeutral: INK_3,
    colorSuccess: "#7bd88f",
    colorWarning: "#e8a866",
    colorDanger: "#d97171",
    borderRadius: "8px",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  elements: {
    cardBox: {
      boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
      border: `1px solid ${LINE}`,
      borderRadius: "14px"
    },
    card: {
      backgroundColor: SURFACE,
      border: `1px solid ${LINE}`
    },
    headerTitle: {
      color: INK,
      fontWeight: "500",
      letterSpacing: "-0.01em"
    },
    headerSubtitle: {
      color: INK_2
    },
    formFieldLabel: {
      color: INK_2,
      fontWeight: "500"
    },
    formFieldInput: {
      backgroundColor: SURFACE_2,
      borderColor: LINE_2,
      color: INK,
      transition: `border-color 160ms ${EASE}, box-shadow 160ms ${EASE}`,
      "&:focus": {
        borderColor: ACCENT,
        boxShadow: `0 0 0 3px ${ACCENT_RING}`
      }
    },
    formFieldInputShowPasswordButton: {
      color: INK_3,
      "&:hover": { color: ACCENT }
    },
    formButtonPrimary: {
      backgroundColor: ACCENT,
      color: ACCENT_INK,
      fontWeight: "600",
      textTransform: "none",
      boxShadow: "none",
      transition: `filter 120ms ${EASE}, transform 120ms ${EASE}, box-shadow 120ms ${EASE}`,
      "&:hover": {
        filter: "brightness(1.08)",
        transform: "translateY(-1px)",
        boxShadow: "0 6px 18px rgba(90, 214, 192, 0.24)"
      },
      "&:active": {
        transform: "translateY(1px)",
        boxShadow: "none"
      }
    },
    socialButtonsBlockButton: {
      backgroundColor: SURFACE_2,
      borderColor: LINE_2,
      color: INK,
      transition: `border-color 160ms ${EASE}, background-color 160ms ${EASE}`,
      "&:hover": {
        backgroundColor: SURFACE_3,
        borderColor: ACCENT
      }
    },
    socialButtonsBlockButtonText: {
      color: INK,
      fontWeight: "500"
    },
    dividerLine: {
      backgroundColor: LINE
    },
    dividerText: {
      color: INK_3,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontSize: "11px"
    },
    otpCodeFieldInput: {
      backgroundColor: SURFACE_2,
      borderColor: LINE_2,
      color: INK,
      "&:focus": {
        borderColor: ACCENT,
        boxShadow: `0 0 0 3px ${ACCENT_RING}`
      }
    },
    formResendCodeLink: {
      color: ACCENT
    },
    identityPreviewText: {
      color: INK_2
    },
    identityPreviewEditButton: {
      color: ACCENT
    },
    footerActionText: {
      color: INK_3
    },
    footerActionLink: {
      color: ACCENT,
      fontWeight: "500",
      "&:hover": { color: "#7be3d1" }
    },
    badge: {
      backgroundColor: ACCENT_SOFT,
      color: ACCENT
    },
    avatarBox: {
      borderRadius: "8px"
    },
    spinner: {
      color: ACCENT
    },
    userButtonPopoverCard: {
      backgroundColor: SURFACE_2,
      border: `1px solid ${LINE}`,
      boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)"
    },
    userButtonPopoverActionButton: {
      color: INK_2,
      transition: `background-color 120ms ${EASE}, color 120ms ${EASE}`,
      "&:hover": {
        backgroundColor: "rgba(90, 214, 192, 0.08)",
        color: INK
      }
    },
    userButtonPopoverActionButtonIcon: {
      color: INK_3
    },
    userButtonPopoverFooter: {
      borderTop: `1px solid ${LINE}`
    },
    userPreviewMainIdentifier: {
      color: INK
    },
    userPreviewSecondaryIdentifier: {
      color: INK_3
    },
    navbar: {
      borderRight: `1px solid ${LINE}`
    },
    navbarButton: {
      color: INK_2,
      "&:hover": { color: INK }
    },
    navbarButtonIcon: {
      color: ACCENT
    },
    profileSectionPrimaryButton: {
      color: ACCENT
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
