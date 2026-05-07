import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./styles.css";

import LandingPage from "./components/LandingPage.vue";
import DocsShell from "./components/DocsShell.vue";
import QuickStartPage from "./components/QuickStartPage.vue";
import AuthoringPage from "./components/AuthoringPage.vue";
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

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("LandingPage", LandingPage);
    app.component("DocsShell", DocsShell);
    app.component("QuickStartPage", QuickStartPage);
    app.component("AuthoringPage", AuthoringPage);
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
