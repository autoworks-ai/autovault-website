<template>
  <div class="cd-page">
    <header class="cd-topbar">
      <div class="cd-topbar-inner">
        <a class="cd-brand" href="/">
          <BrandMark :size="22" />
          <span><span class="auto">Auto</span><span class="vault">Vault</span></span>
          <span class="cd-version">v0.4.1</span>
        </a>

        <nav class="cd-nav" aria-label="Primary">
          <a v-for="item in navItems" :key="item.label" :href="item.href" :class="{ active: item.label === config.active }">{{ item.label }}</a>
        </nav>

        <div class="cd-search">
          <label class="cd-search-box">
            <UiIcon name="search" :size="14" />
            <span class="visually-hidden">Search docs</span>
            <input v-model="query" type="search" placeholder="Search docs..." @focus="searchOpen = true" />
            <span class="kbd">⌘K</span>
          </label>
          <div v-if="searchOpen && query.trim()" class="cd-search-results">
            <a v-for="result in filteredResults" :key="result.href" :href="result.href" @click="searchOpen = false">
              <span>{{ result.title }}</span>
              <small>{{ result.section }}</small>
            </a>
            <span v-if="!filteredResults.length" class="empty-row">No local matches</span>
          </div>
        </div>

        <a class="icon-btn cd-github" href="https://github.com/autoworks-ai/autovault" title="GitHub"><UiIcon name="github" :size="15" /></a>
        <a class="pill-btn primary cd-install" href="/quick-start.html">Install <UiIcon name="arrow" /></a>
      </div>
    </header>

    <div v-if="config.variant === 'docs'" class="cd-docs-shell">
      <aside class="cd-sidebar" aria-label="Docs sidebar">
        <div v-for="group in sidebarGroups" :key="group.title" class="cd-group">
          <div class="cd-group-title">{{ group.title }}</div>
          <a v-for="item in group.items" :key="item.label" :href="item.href" :class="{ active: item.label === config.sidebarActive }">
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="badge">{{ item.badge }}</span>
          </a>
        </div>
      </aside>
      <main class="cd-docs-content">
        <slot />
      </main>
      <aside v-if="config.toc.length" class="cd-toc" aria-label="On this page">
        <div class="cd-toc-title">On this page</div>
        <a v-for="item in config.toc" :key="item.id" :href="`#${item.id}`">{{ item.label }}</a>
      </aside>
    </div>

    <main v-else class="cd-full-content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BrandMark from "./BrandMark.vue";
import UiIcon from "./UiIcon.vue";

type PageKey = "quick-start" | "authoring" | "skills" | "security" | "changelog";
type ShellVariant = "docs" | "full";
type TocItem = { label: string; id: string };

const props = defineProps<{ page: PageKey }>();

const navItems = [
  { label: "Overview", href: "/" },
  { label: "How it works", href: "/#how" },
  { label: "Quick start", href: "/quick-start.html" },
  { label: "Authoring", href: "/authoring.html" },
  { label: "Skills", href: "/skills-directory.html" },
  { label: "API", href: "/quick-start.html#where-to-next" },
  { label: "Security", href: "/security.html" },
  { label: "Changelog", href: "/changelog.html" }
];

const sidebarGroups = [
  {
    title: "Get started",
    items: [
      { label: "Quick start", href: "/quick-start.html", badge: "5 min" },
      { label: "Installation", href: "/quick-start.html#step-1-install-the-local-vault" },
      { label: "Your first skill", href: "/quick-start.html#step-2-add-your-first-skill" }
    ]
  },
  {
    title: "Authoring",
    items: [
      { label: "Anatomy of a SKILL.md", href: "/authoring.html" },
      { label: "Transformation manifest", href: "/authoring.html#transformation-manifest" },
      { label: "Permissions", href: "/authoring.html#permissions" },
      { label: "Publishing", href: "/authoring.html#publish-through-the-gate" }
    ]
  },
  {
    title: "Reference",
    items: [
      { label: "Skills directory", href: "/skills-directory.html" },
      { label: "Security & provenance", href: "/security.html" },
      { label: "Changelog", href: "/changelog.html", badge: "v0.4.1" }
    ]
  },
  {
    title: "Concepts",
    items: [
      { label: "Validation gate", href: "/#concepts" },
      { label: "Per-caller transform", href: "/#how" },
      { label: "Four-axis scoping", href: "/#overview" }
    ]
  }
];

const configs: Record<PageKey, { active: string; sidebarActive: string; variant: ShellVariant; toc: TocItem[] }> = {
  "quick-start": {
    active: "Quick start",
    sidebarActive: "Quick start",
    variant: "docs",
    toc: [
      { label: "Install the local vault", id: "step-1-install-the-local-vault" },
      { label: "Add your first skill", id: "step-2-add-your-first-skill" },
      { label: "Scope it", id: "step-3-scope-it-to-your-context" },
      { label: "Run it", id: "step-4-run-it-from-your-agent" },
      { label: "Where next", id: "where-to-next" }
    ]
  },
  authoring: {
    active: "Authoring",
    sidebarActive: "Anatomy of a SKILL.md",
    variant: "docs",
    toc: [
      { label: "Anatomy of a SKILL.md", id: "anatomy-of-a-skill-md" },
      { label: "Transformation manifest", id: "transformation-manifest" },
      { label: "Permissions", id: "permissions" },
      { label: "Try the gate", id: "validation-playground" },
      { label: "Publishing", id: "publish-through-the-gate" }
    ]
  },
  skills: { active: "Skills", sidebarActive: "Skills directory", variant: "full", toc: [] },
  security: { active: "Security", sidebarActive: "Security & provenance", variant: "full", toc: [] },
  changelog: { active: "Changelog", sidebarActive: "Changelog", variant: "full", toc: [] }
};

const searchResults = [
  { title: "Quick start", section: "Get started", href: "/quick-start.html", terms: "install local vault first skill scope run" },
  { title: "Authoring skills", section: "Authoring", href: "/authoring.html", terms: "skill md transformation manifest permissions publish gate" },
  { title: "Skills directory", section: "Reference", href: "/skills-directory.html", terms: "skills filters agent category org installs" },
  { title: "Security & provenance", section: "Reference", href: "/security.html", terms: "security signature signing provenance denylist gate verifier" },
  { title: "Changelog", section: "Reference", href: "/changelog.html", terms: "release notes changes security patch minor" }
];

const config = computed(() => configs[props.page]);
const query = ref("");
const searchOpen = ref(false);
const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return searchResults.filter((result) => `${result.title} ${result.section} ${result.terms}`.toLowerCase().includes(q)).slice(0, 5);
});

function handleKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchOpen.value = true;
    window.setTimeout(() => document.querySelector<HTMLInputElement>(".cd-search input")?.focus(), 0);
  }
  if (event.key === "Escape") searchOpen.value = false;
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", handleKeydown));
</script>
