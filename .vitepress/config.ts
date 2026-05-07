import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AutoVault",
  description: "The skill registry with a gate.",
  lang: "en-US",
  cleanUrls: false,
  lastUpdated: false,
  markdown: {
    theme: {
      light: "github-dark",
      dark: "github-dark"
    }
  },
  head: [
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
      }
    ],
    ["meta", { name: "theme-color", content: "#0b1014" }]
  ],
  themeConfig: {
    logo: { src: "/brand-mark.svg", width: 22, height: 22 },
    siteTitle: "AutoVault",
    search: {
      provider: "local"
    },
    nav: [
      { text: "Overview", link: "/" },
      { text: "Quick start", link: "/quick-start.html" },
      { text: "Authoring", link: "/authoring.html" },
      { text: "Skills", link: "/skills-directory.html" },
      { text: "API", link: "/api.html" },
      { text: "Deploy", link: "/deploy.html" },
      { text: "Security", link: "/security.html" },
      { text: "Changelog", link: "/changelog.html" }
    ],
    sidebar: [
      {
        text: "Get started",
        items: [
          { text: "Overview", link: "/" },
          { text: "Quick start", link: "/quick-start.html" },
          { text: "Installation", link: "/quick-start.html#install" },
          { text: "Your first skill", link: "/quick-start.html#first" }
        ]
      },
      {
        text: "Authoring",
        items: [
          { text: "Anatomy of a SKILL.md", link: "/authoring.html" },
          { text: "Transformation manifest", link: "/authoring.html#manifest" },
          { text: "Permissions", link: "/authoring.html#perms" },
          { text: "Publishing", link: "/authoring.html#publish" }
        ]
      },
      {
        text: "Reference",
        items: [
          { text: "Skills directory", link: "/skills-directory.html" },
          { text: "API reference", link: "/api.html" },
          { text: "Deploy remote vault", link: "/deploy.html" },
          { text: "Compare alternatives", link: "/compare.html" },
          { text: "Security & provenance", link: "/security.html" },
          { text: "Changelog", link: "/changelog.html" }
        ]
      }
    ],
    outline: {
      level: [2, 3],
      label: "On this page"
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/autoworks-ai/autovault" }
    ],
    footer: {
      message: "A curated skills layer for AI agents.",
      copyright: "Copyright © 2026 autoworks-ai · Apache-2.0"
    }
  }
});
