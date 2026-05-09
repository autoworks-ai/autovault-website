import { defineConfig, type HeadConfig } from "vitepress";
import { writeAgentArtifacts } from "./build/agentArtifacts";
import { canonicalUrl, findPageDocByFile, SITE_URL, type PageDoc } from "./shared/pageDocs";

function pageHead(doc: PageDoc): HeadConfig[] {
  const url = canonicalUrl(doc);
  const schema = {
    "@context": "https://schema.org",
    "@type": doc.key === "overview" ? "SoftwareApplication" : "TechArticle",
    name: doc.title,
    description: doc.description,
    url,
    license: "https://opensource.org/license/mit",
    publisher: {
      "@type": "Organization",
      name: "autoworks-ai",
      url: SITE_URL
    },
    isPartOf: {
      "@type": "WebSite",
      name: "AutoVault",
      url: SITE_URL
    }
  };

  const head: HeadConfig[] = [
    ["link", { rel: "canonical", href: url }],
    ["meta", { name: "description", content: doc.description }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "AutoVault" }],
    ["meta", { property: "og:title", content: doc.title }],
    ["meta", { property: "og:description", content: doc.description }],
    ["meta", { property: "og:url", content: url }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: doc.title }],
    ["meta", { name: "twitter:description", content: doc.description }],
    ["script", { type: "application/ld+json" }, JSON.stringify(schema)]
  ];

  if (doc.listed === false) {
    head.splice(2, 0, ["meta", { name: "robots", content: "noindex,nofollow" }]);
  }

  return head;
}

function isHiddenSitemapItem(item: { url: string }) {
  const path = item.url.startsWith("http")
    ? new URL(item.url).pathname
    : item.url.startsWith("/")
      ? item.url
      : `/${item.url}`;
  return path === "/cloud" || path === "/cloud/";
}

export default defineConfig({
  title: "AutoVault",
  description: "AutoVault is a local-first vault for AI agent skills with validation, signing, scoped delivery, transforms, and MCP access.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: false,
  srcExclude: ["autovault/**", "AutoVault.md"],
  sitemap: {
    hostname: SITE_URL,
    transformItems: (items) => items.filter((item) => !isHiddenSitemapItem(item))
  },
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
  transformHead({ pageData }) {
    const doc = findPageDocByFile(pageData.relativePath);
    if (!doc) return [];
    return pageHead(doc);
  },
  async buildEnd(siteConfig) {
    await writeAgentArtifacts(siteConfig.outDir);
  },
  themeConfig: {
    logo: { src: "/brand-mark.svg", width: 22, height: 22 },
    siteTitle: "AutoVault",
    search: {
      provider: "local"
    },
    nav: [
      { text: "Overview", link: "/" },
      { text: "Quick start", link: "/quick-start" },
      { text: "Authoring", link: "/authoring" },
      { text: "Examples", link: "/skills-directory" },
      { text: "Security", link: "/security" },
      { text: "About", link: "/about" },
      { text: "Changelog", link: "/changelog" }
    ],
    sidebar: [
      {
        text: "Get started",
        items: [
          { text: "Overview", link: "/" },
          { text: "Quick start", link: "/quick-start" },
          { text: "Installation", link: "/quick-start#install" },
          { text: "Agent-assisted setup", link: "/quick-start#agent-assisted" },
          { text: "Your first skill", link: "/quick-start#first" }
        ]
      },
      {
        text: "Authoring",
        items: [
          { text: "Anatomy of a SKILL.md", link: "/authoring" },
          { text: "Transformation manifest", link: "/authoring#manifest" },
          { text: "Permissions", link: "/authoring#perms" },
          { text: "Admission", link: "/authoring#publish" }
        ]
      },
      {
        text: "Reference",
        items: [
          { text: "Skill examples", link: "/skills-directory" },
          { text: "API reference", link: "/api" },
          { text: "Deploy remote vault", link: "/deploy" },
          { text: "Compare alternatives", link: "/compare" },
          { text: "Security & provenance", link: "/security" },
          { text: "About", link: "/about" },
          { text: "Changelog", link: "/changelog" }
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
      message: "A local-first vault for the skills your agents actually use.",
      copyright: "Copyright © 2026 autoworks-ai · MIT"
    }
  }
});
