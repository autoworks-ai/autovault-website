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
  }
} satisfies Theme;
