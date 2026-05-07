<template>
  <div class="cd-page" :class="{ 'nav-open': navOpen }">
    <header class="cd-topbar">
      <div class="cd-topbar-inner">
        <a class="cd-brand" href="/">
          <BrandMark :size="22" />
          <span><span class="auto">Auto</span><span class="vault">Vault</span></span>
          <span class="cd-version">v0.2.0</span>
        </a>

        <button class="icon-btn cd-menu-toggle" type="button" aria-controls="cd-primary-nav" :aria-expanded="navOpen" aria-label="Open navigation" @click="navOpen = !navOpen">
          <UiIcon name="menu" :size="16" />
        </button>

        <nav id="cd-primary-nav" class="cd-nav" aria-label="Primary">
          <a v-for="item in navItems" :key="item.label" :href="item.href" :class="{ active: item.label === config.active }" @click="navOpen = false">{{ item.label }}</a>
        </nav>

        <div class="cd-search">
          <label class="cd-search-box">
            <UiIcon name="search" :size="14" />
            <span class="visually-hidden">Search docs</span>
            <input :value="query" type="search" placeholder="Search docs..." @focus="searchOpen = true" @input="handleSearchInput" />
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

        <MarkdownActions v-if="showMarkdownActions" :page="markdownPage" />
        <a class="icon-btn cd-github" href="https://github.com/autoworks-ai/autovault" title="GitHub"><UiIcon name="github" :size="15" /></a>
        <a class="pill-btn primary cd-install" href="/cloud" title="Launch for free in 5 minutes on our hardware">Launch free <UiIcon name="arrow" /></a>
      </div>
    </header>

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
import MarkdownActions from "./MarkdownActions.vue";
import UiIcon from "./UiIcon.vue";
import type { PageDocKey } from "../../shared/pageDocs";

type PageKey = "quick-start" | "authoring" | "skills" | "api" | "deploy" | "compare" | "skill-detail" | "author-profile" | "security" | "about" | "cloud" | "changelog";
type ShellVariant = "docs" | "full";
type TocItem = { label: string; id: string };

const props = defineProps<{ page: PageKey }>();

const navItems = [
  { label: "Overview", href: "/" },
  { label: "How it works", href: "/#how" },
  { label: "Quick start", href: "/quick-start" },
  { label: "Cloud", href: "/cloud" },
  { label: "Authoring", href: "/authoring" },
  { label: "Skills", href: "/skills-directory" },
  { label: "Security", href: "/security" },
  { label: "About", href: "/about" },
  { label: "Changelog", href: "/changelog" }
];

const sidebarGroups = [
  {
    title: "Start",
    items: [
      { label: "Quick start", href: "/quick-start", badge: "5 min" },
      { label: "Verify a skill", href: "/authoring#playground" }
    ]
  },
  {
    title: "Build",
    items: [
      { label: "Authoring", href: "/authoring" },
      { label: "Manifest", href: "/authoring#manifest" },
      { label: "Permissions", href: "/authoring#perms" }
    ]
  },
  {
    title: "Reference",
    items: [
      { label: "Skills", href: "/skills-directory" },
      { label: "API", href: "/api" },
      { label: "Deploy", href: "/deploy" },
      { label: "Compare", href: "/compare" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: "/changelog", badge: "v0.2.0" }
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
      { label: "Add your first skill", id: "first" },
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
      { label: "Transformation manifest", id: "manifest" },
      { label: "Permissions", id: "perms" },
      { label: "Try the gate", id: "playground" },
      { label: "Publishing", id: "publish" }
    ]
  },
  skills: { active: "Skills", sidebarActive: "Skills", variant: "full", toc: [] },
  api: { active: "API", sidebarActive: "API", variant: "full", toc: [] },
  deploy: { active: "Deploy", sidebarActive: "Deploy", variant: "full", toc: [] },
  compare: { active: "Compare", sidebarActive: "Compare", variant: "full", toc: [] },
  "skill-detail": { active: "Skills", sidebarActive: "Skills", variant: "full", toc: [] },
  "author-profile": { active: "Skills", sidebarActive: "Skills", variant: "full", toc: [] },
  security: { active: "Security", sidebarActive: "Security", variant: "full", toc: [] },
  about: { active: "About", sidebarActive: "About", variant: "full", toc: [] },
  cloud: { active: "Cloud", sidebarActive: "Cloud", variant: "full", toc: [] },
  changelog: { active: "Changelog", sidebarActive: "Changelog", variant: "full", toc: [] }
};

const searchResults = [
  { title: "Quick start", section: "Get started", href: "/quick-start", terms: "install local vault first skill scope run add-local autovault_skill_install bootstrap" },
  { title: "Authoring skills", section: "Authoring", href: "/authoring", terms: "skill md transformation manifest permissions publish gate propose_skill_transform read_skill_resource" },
  { title: "Verify a skill", section: "Authoring", href: "/authoring#playground", terms: "paste url playground browser gate diagnostics verify check skill" },
  { title: "Skills directory", section: "Reference", href: "/skills-directory", terms: "skills filters agent category org installs mit license" },
  { title: "API reference", section: "Reference", href: "/api", terms: "cli library http mcp endpoint load render verify resolve" },
  { title: "Deploy remote vault", section: "Reference", href: "/deploy", terms: "deploy remote mcp oauth pkce railway docker fly endpoint" },
  { title: "Compare alternatives", section: "Reference", href: "/compare", terms: "comparison rawhub forkflow manualops alternatives signing provenance" },
  { title: "extract-pdf", section: "Skills", href: "/skill-detail", terms: "extract pdf skill detail transformations permissions provenance versions" },
  { title: "autoworks-ai", section: "Skills", href: "/author-autoworks-ai", terms: "publisher author profile certificate maintainers skills" },
  { title: "Security & provenance", section: "Reference", href: "/security", terms: "security signature signing provenance denylist gate verifier oauth remote mcp" },
  { title: "Cloud launch", section: "Hosted", href: "/cloud", terms: "launch free hosted hardware remote mcp oauth cloud five minutes" },
  { title: "About AutoVault", section: "Team", href: "/about", terms: "jack arturo autojack jason coleman flint zack katz daniel iser team credits" },
  { title: "Changelog", section: "Reference", href: "/changelog", terms: "release notes remote mcp oauth add-local transforms resource drift" }
];

const config = computed(() => configs[props.page]);
const markdownPage = computed<PageDocKey>(() => (props.page === "skills" ? "skills-directory" : props.page));
const showMarkdownActions = computed(() => !["about", "cloud"].includes(props.page));
const query = ref("");
const searchOpen = ref(false);
const navOpen = ref(false);
const currentHash = ref("");
const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return searchResults.filter((result) => `${result.title} ${result.section} ${result.terms}`.toLowerCase().includes(q)).slice(0, 5);
});
const activeSidebarLabel = computed(() => {
  if (props.page === "authoring" && currentHash.value === "#playground") return "Verify a skill";
  return config.value.sidebarActive;
});

function handleKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchOpen.value = true;
    window.setTimeout(() => document.querySelector<HTMLInputElement>(".cd-search input")?.focus(), 0);
  }
  if (event.key === "Escape") {
    searchOpen.value = false;
    navOpen.value = false;
  }
}

function handleSearchInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value;
  searchOpen.value = true;
}

function syncHash() {
  currentHash.value = window.location.hash;
}

onMounted(() => {
  syncHash();
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("hashchange", syncHash);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("hashchange", syncHash);
});
</script>
