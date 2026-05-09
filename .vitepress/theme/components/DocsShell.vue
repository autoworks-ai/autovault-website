<template>
  <div class="cd-page">
    <AvTopbar :active="config.active" show-search :search-results="searchResults" />

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

type PageKey = "quick-start" | "authoring" | "skills" | "api" | "deploy" | "compare" | "skill-detail" | "author-profile" | "security" | "about" | "cloud" | "changelog";
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
      { label: "Scoping", href: "/authoring#perms" }
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
      { label: "Scope and permissions", id: "perms" },
      { label: "Try the gate", id: "playground" },
      { label: "Admission", id: "publish" }
    ]
  },
  skills: { active: "Examples", sidebarActive: "Examples", variant: "full", toc: [] },
  api: { active: "API", sidebarActive: "API", variant: "full", toc: [] },
  deploy: { active: "Deploy", sidebarActive: "Deploy", variant: "full", toc: [] },
  compare: { active: "Compare", sidebarActive: "Compare", variant: "full", toc: [] },
  "skill-detail": { active: "Examples", sidebarActive: "Examples", variant: "full", toc: [] },
  "author-profile": { active: "Examples", sidebarActive: "Examples", variant: "full", toc: [] },
  security: { active: "Security", sidebarActive: "Security", variant: "full", toc: [] },
  about: { active: "About", sidebarActive: "About", variant: "full", toc: [] },
  cloud: { active: "Cloud", sidebarActive: "Cloud", variant: "full", toc: [] },
  changelog: { active: "Changelog", sidebarActive: "Changelog", variant: "full", toc: [] }
};

const searchResults = [
  { title: "Quick start", section: "Get started", href: "/quick-start", terms: "install local vault doctor first skill scope run vault anatomy add-local autovault_skill_install bootstrap" },
  { title: "Vault anatomy", section: "Get started", href: "/quick-start#vault-anatomy", terms: "vault folder tree anatomy signatures rendered profiles audit access map" },
  { title: "Authoring skills", section: "Authoring", href: "/authoring", terms: "skill md schema tools_required transformations permissions agents admission gate propose_skill get_skill add_skill update_skill delete_skill include_resources scoping" },
  { title: "SKILL.md schema", section: "Authoring", href: "/authoring#schema", terms: "frontmatter fields schema tools_required transformations permissions agents resources" },
  { title: "Verify a skill", section: "Authoring", href: "/authoring#playground", terms: "paste url playground browser gate diagnostics verify check skill" },
  { title: "Skill examples", section: "Reference", href: "/skills-directory", terms: "examples vault inventory filters agent category source refs mit license" },
  { title: "API reference", section: "Reference", href: "/api", terms: "cli library http mcp endpoint load render verify resolve add_skill update_skill delete_skill propose_skill get_skill check_updates" },
  { title: "Deploy remote vault", section: "Reference", href: "/deploy", terms: "deploy remote mcp oauth pkce railway docker fly endpoint" },
  { title: "Compare alternatives", section: "Reference", href: "/compare", terms: "comparison skillfish tessl skillkit manual folders alternatives signing provenance scoping transforms" },
  { title: "extract-pdf", section: "Examples", href: "/skill-detail", terms: "extract pdf skill detail transformations permissions provenance versions" },
  { title: "autoworks-ai", section: "Examples", href: "/author-autoworks-ai", terms: "source author profile certificate maintainers skills examples" },
  { title: "Security & provenance", section: "Reference", href: "/security", terms: "security signature signing provenance denylist gate verifier oauth remote mcp" },
  { title: "About AutoVault", section: "Team", href: "/about", terms: "jack arturo autojack jason coleman flint zack katz daniel iser team credits" },
  { title: "Changelog", section: "Reference", href: "/changelog", terms: "release notes remote mcp oauth add-local transforms resource drift" }
];

const config = computed(() => configs[props.page]);
const markdownPage = computed<PageDocKey>(() => (props.page === "skills" ? "skills-directory" : props.page));
const showMarkdownActions = computed(() => !["about", "cloud"].includes(props.page));
const currentHash = ref("");
const activeSidebarLabel = computed(() => {
  if (props.page === "quick-start" && currentHash.value === "#install") return "Install";
  if (props.page === "quick-start" && currentHash.value === "#vault-anatomy") return "Vault anatomy";
  if (props.page === "authoring" && currentHash.value === "#playground") return "Verify a skill";
  if (props.page === "authoring" && currentHash.value === "#schema") return "Schema";
  if (props.page === "authoring" && currentHash.value === "#perms") return "Scoping";
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
