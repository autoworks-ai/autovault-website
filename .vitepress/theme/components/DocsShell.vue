<template>
  <div class="cd-page">
    <AvTopbar :active="config.active" show-search />

    <div v-if="config.variant === 'docs'" class="cd-docs-shell">
      <aside class="cd-sidebar" aria-label="Docs sidebar">
        <div v-for="group in sidebarGroups" :key="group.title" class="cd-group">
          <div class="cd-group-title">{{ group.title }}</div>
          <a v-for="item in group.items" :key="item.label" :href="item.href" :class="{ active: item.label === activeSidebarLabel }">
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="badge">{{ item.badge }}</span>
          </a>
        </div>
      </aside>
      <main class="cd-docs-content">
        <div v-if="showMarkdownActions" class="cd-page-markdown-actions">
          <MarkdownActions :page="markdownPage" />
        </div>
        <slot />
      </main>
      <aside v-if="config.toc.length" class="cd-toc" aria-label="On this page">
        <div class="cd-toc-title">On this page</div>
        <a v-for="item in config.toc" :key="item.id" :href="`#${item.id}`">{{ item.label }}</a>
      </aside>
    </div>

    <main v-else class="cd-full-content">
      <div v-if="showMarkdownActions" class="cd-page-markdown-actions">
        <MarkdownActions :page="markdownPage" />
      </div>
      <slot />
    </main>

    <AvFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AvTopbar from "./AvTopbar.vue";
import AvFooter from "./AvFooter.vue";
import MarkdownActions from "./MarkdownActions.vue";
import { PRODUCT_VERSION } from "../data/product";
import type { PageDocKey } from "../../shared/pageDocs";

type PageKey = "quick-start" | "authoring" | "permissions" | "skills" | "api" | "deploy" | "compare" | "skill-detail" | "author-profile" | "security" | "troubleshooting" | "about" | "cloud" | "changelog";
type ShellVariant = "docs" | "full";
type TocItem = { label: string; id: string };

const props = defineProps<{ page: PageKey }>();

const sidebarGroups = [
  {
    title: "Start",
    items: [
      { label: "Quick start", href: "/quick-start", badge: "5 min" },
      { label: "Install", href: "/quick-start#install" },
      { label: "Vault anatomy", href: "/quick-start#vault-anatomy" },
      { label: "Verify a skill", href: "/authoring#playground" }
    ]
  },
  {
    title: "Build",
    items: [
      { label: "Authoring", href: "/authoring" },
      { label: "SKILL.md anatomy", href: "/authoring#anatomy" },
      { label: "Schema", href: "/authoring#schema" },
      { label: "Capabilities ref", href: "/authoring#perms" }
    ]
  },
  {
    title: "Permissions",
    items: [
      { label: "Permissions", href: "/permissions" },
      { label: "Capabilities", href: "/permissions#capabilities" },
      { label: "Transforms", href: "/permissions#transforms" },
      { label: "Install scope", href: "/permissions#install-scope" }
    ]
  },
  {
    title: "Reference",
    items: [
      { label: "Examples", href: "/skills-directory" },
      { label: "API", href: "/api" },
      { label: "Deploy", href: "/deploy" },
      { label: "Compare", href: "/compare" },
      { label: "Security", href: "/security" },
      { label: "Troubleshooting", href: "/troubleshooting" },
      { label: "Changelog", href: "/changelog", badge: PRODUCT_VERSION }
    ]
  }
];

const configs: Record<PageKey, { active: string; sidebarActive: string; variant: ShellVariant; toc: TocItem[] }> = {
  "quick-start": {
    active: "Quick start",
    sidebarActive: "Quick start",
    variant: "docs",
    toc: [
      { label: "Install the local vault", id: "install" },
      { label: "Run the setup wizard", id: "setup" },
      { label: "Verify the install", id: "verify" },
      { label: "Add your first skill", id: "first" },
      { label: "Vault anatomy", id: "vault-anatomy" },
      { label: "Scope it", id: "scope" },
      { label: "Run it", id: "run" },
      { label: "Where next", id: "next" }
    ]
  },
  authoring: {
    active: "Authoring",
    sidebarActive: "Authoring",
    variant: "docs",
    toc: [
      { label: "Anatomy of a SKILL.md", id: "anatomy" },
      { label: "Frontmatter schema", id: "schema" },
      { label: "Transformation manifest", id: "manifest" },
      { label: "Capabilities reference", id: "perms" },
      { label: "Secrets and .env", id: "secrets" },
      { label: "Try the gate", id: "playground" },
      { label: "Admission", id: "publish" }
    ]
  },
  permissions: {
    active: "Permissions",
    sidebarActive: "Permissions",
    variant: "docs",
    toc: [
      { label: "Start here", id: "story" },
      { label: "Layer 1 — Capabilities", id: "capabilities" },
      { label: "Layer 2 — Transforms", id: "transforms" },
      { label: "Layer 3 — Install scope", id: "install-scope" },
      { label: "Agent-mediated install", id: "agents-do-the-work" },
      { label: "Open SKILL.md compat", id: "open-skill-md" },
      { label: "Deep dive", id: "deep-dive" },
      { label: "Where next", id: "next" }
    ]
  },
  skills: { active: "Examples", sidebarActive: "Examples", variant: "full", toc: [] },
  api: { active: "API", sidebarActive: "API", variant: "full", toc: [] },
  deploy: { active: "Deploy", sidebarActive: "Deploy", variant: "full", toc: [] },
  compare: { active: "Compare", sidebarActive: "Compare", variant: "full", toc: [] },
  "skill-detail": { active: "Examples", sidebarActive: "Examples", variant: "full", toc: [] },
  "author-profile": { active: "Examples", sidebarActive: "Examples", variant: "full", toc: [] },
  security: { active: "Security", sidebarActive: "Security", variant: "full", toc: [] },
  troubleshooting: { active: "Troubleshooting", sidebarActive: "Troubleshooting", variant: "full", toc: [] },
  about: { active: "About", sidebarActive: "About", variant: "full", toc: [] },
  cloud: { active: "Cloud", sidebarActive: "Cloud", variant: "full", toc: [] },
  changelog: { active: "Changelog", sidebarActive: "Changelog", variant: "full", toc: [] }
};

const config = computed(() => configs[props.page]);
const markdownPage = computed<PageDocKey>(() => (props.page === "skills" ? "skills-directory" : props.page));
const showMarkdownActions = computed(() => !["about", "cloud", "skill-detail"].includes(props.page));
const currentHash = ref("");
const activeSidebarLabel = computed(() => {
  if (props.page === "quick-start" && currentHash.value === "#install") return "Install";
  if (props.page === "quick-start" && currentHash.value === "#vault-anatomy") return "Vault anatomy";
  if (props.page === "authoring" && currentHash.value === "#playground") return "Verify a skill";
  if (props.page === "authoring" && currentHash.value === "#schema") return "Schema";
  if (props.page === "authoring" && currentHash.value === "#perms") return "Capabilities ref";
  if (props.page === "permissions" && currentHash.value === "#capabilities") return "Capabilities";
  if (props.page === "permissions" && currentHash.value === "#transforms") return "Transforms";
  if (props.page === "permissions" && currentHash.value === "#install-scope") return "Install scope";
  return config.value.sidebarActive;
});

function syncHash() {
  currentHash.value = window.location.hash;
}

onMounted(() => {
  syncHash();
  window.addEventListener("hashchange", syncHash);
});
onBeforeUnmount(() => {
  window.removeEventListener("hashchange", syncHash);
});
</script>
