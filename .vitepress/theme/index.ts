import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { clerkPlugin } from "@clerk/vue";
import { clerkPluginOptions } from "./clerk";
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

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    if (!import.meta.env.SSR && clerkPublishableKey) {
      app.use(clerkPlugin, {
        publishableKey: clerkPublishableKey,
        ...clerkPluginOptions
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
