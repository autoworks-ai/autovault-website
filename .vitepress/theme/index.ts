import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { clerkPlugin, type PluginOptions } from "@clerk/vue";
import "./styles.css";

import LandingPage from "./components/LandingPage.vue";
import DocsShell from "./components/DocsShell.vue";
import QuickStartPage from "./components/QuickStartPage.vue";
import AuthoringPage from "./components/AuthoringPage.vue";
import PermissionsPage from "./components/PermissionsPage.vue";
import SkillsDirectoryPage from "./components/SkillsDirectoryPage.vue";
import SecurityPage from "./components/SecurityPage.vue";
import ChangelogPage from "./components/ChangelogPage.vue";
import ApiReferencePage from "./components/ApiReferencePage.vue";
import DeployPage from "./components/DeployPage.vue";
import ComparePage from "./components/ComparePage.vue";
import SkillDetailPage from "./components/SkillDetailPage.vue";
import AuthorProfilePage from "./components/AuthorProfilePage.vue";
import AboutPage from "./components/AboutPage.vue";
import CloudPage from "./components/CloudPage.vue";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkAppearance = {
  layout: {
    logoImageUrl: import.meta.env.VITE_CLERK_BRAND_LOGO_URL || "https://autovault.dev/brand-mark.svg",
    logoLinkUrl: "/",
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
    modalBackdrop: {
      backgroundColor: "rgba(3, 7, 11, 0.72)",
      backdropFilter: "blur(10px)"
    }
  }
} satisfies NonNullable<PluginOptions["appearance"]>;

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    if (!import.meta.env.SSR && clerkPublishableKey) {
      app.use(clerkPlugin, {
        publishableKey: clerkPublishableKey,
        afterSignOutUrl: "/",
        signInFallbackRedirectUrl: "/",
        signUpFallbackRedirectUrl: "/",
        appearance: clerkAppearance
      });
    }
    app.component("LandingPage", LandingPage);
    app.component("DocsShell", DocsShell);
    app.component("QuickStartPage", QuickStartPage);
    app.component("AuthoringPage", AuthoringPage);
    app.component("PermissionsPage", PermissionsPage);
    app.component("SkillsDirectoryPage", SkillsDirectoryPage);
    app.component("SecurityPage", SecurityPage);
    app.component("ChangelogPage", ChangelogPage);
    app.component("ApiReferencePage", ApiReferencePage);
    app.component("DeployPage", DeployPage);
    app.component("ComparePage", ComparePage);
    app.component("SkillDetailPage", SkillDetailPage);
    app.component("AuthorProfilePage", AuthorProfilePage);
    app.component("AboutPage", AboutPage);
    app.component("CloudPage", CloudPage);
  }
} satisfies Theme;
