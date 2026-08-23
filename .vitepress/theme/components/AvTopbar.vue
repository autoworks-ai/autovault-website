<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BrandMark from "./BrandMark.vue";
import UiIcon from "./UiIcon.vue";
import ClerkAuthControls from "./ClerkAuthControls.vue";
import { PRODUCT_VERSION } from "../data/product";
import { searchResults } from "../data/searchResults";
import { useClerkApiAuth } from "../utils/clerkApi";
import { clerkBrand } from "../clerk";

const props = withDefaults(defineProps<{
  active?: string;
  showSearch?: boolean;
}>(), {
  active: "",
  showSearch: false
});

const baseNavItems = [
  { label: "Quick start", href: "/quick-start" },
  { label: "Authoring", href: "/authoring" },
  { label: "Examples", href: "/skills-directory" },
  { label: "Compare", href: "/compare" },
  { label: "Security", href: "/security" }
];

const { isClerkSignedIn } = useClerkApiAuth();

const navItems = computed(() => {
  const items = [...baseNavItems];
  if (isClerkSignedIn.value) {
    items.push({ label: "Cloud", href: clerkBrand.cloudPath });
  }
  return items;
});

const query = ref("");
const searchOpen = ref(false);
const navOpen = ref(false);
const currentPath = ref("");
const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return searchResults.filter((result) => `${result.title} ${result.section} ${result.terms}`.toLowerCase().includes(q)).slice(0, 5);
});

function isActive(item: { label: string; href: string }) {
  if (props.active) return item.label === props.active;
  return currentPath.value === item.href || (item.href === "/skills-directory" && currentPath.value.startsWith("/skill")) || (item.href === clerkBrand.cloudPath && currentPath.value.startsWith("/cloud"));
}

function handleSearchInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value;
  searchOpen.value = true;
}

function handleKeydown(event: KeyboardEvent) {
  if (props.showSearch && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchOpen.value = true;
    window.setTimeout(() => document.querySelector<HTMLInputElement>(".av-search input")?.focus(), 0);
  }
  if (event.key === "Escape") {
    searchOpen.value = false;
    navOpen.value = false;
  }
}

onMounted(() => {
  currentPath.value = window.location.pathname;
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <header class="av-topbar" :class="{ 'nav-open': navOpen }">
    <div class="av-topbar-inner" :class="{ 'with-search': props.showSearch }">
      <a class="av-brand" href="/">
        <span class="av-brand-mark"><BrandMark /></span>
        <span class="av-brand-name"><span class="auto">Auto</span><span class="vault">Vault</span></span>
        <span class="av-topbar-version">{{ PRODUCT_VERSION }}</span>
      </a>

      <button class="av-topbar-menu av-icon-btn" type="button" aria-controls="av-primary-nav" :aria-expanded="navOpen" aria-label="Open navigation" @click="navOpen = !navOpen">
        <UiIcon name="menu" :size="16" />
      </button>

      <nav id="av-primary-nav" class="av-nav" aria-label="Primary">
        <a v-for="item in navItems" :key="item.label" :href="item.href" :class="{ active: isActive(item) }" @click="navOpen = false">{{ item.label }}</a>
      </nav>

      <div v-if="props.showSearch" class="av-search">
        <label class="av-search-box">
          <UiIcon name="search" :size="14" />
          <span class="visually-hidden">Search docs</span>
          <input :value="query" type="search" placeholder="Search docs..." @focus="searchOpen = true" @input="handleSearchInput" />
          <span class="kbd">⌘K</span>
        </label>
        <div v-if="searchOpen && query.trim()" class="av-search-results">
          <a v-for="result in filteredResults" :key="result.href" :href="result.href" @click="searchOpen = false">
            <span>{{ result.title }}</span>
            <small>{{ result.section }}</small>
          </a>
          <span v-if="!filteredResults.length" class="empty-row">No local matches</span>
        </div>
      </div>

      <div class="av-topbar-right">
        <ClerkAuthControls variant="topbar" ctaLabel="Sign in" />
        <a class="av-icon-btn" href="https://github.com/autoworks-ai/autovault" title="GitHub"><UiIcon name="github" /></a>
      </div>
    </div>
  </header>
</template>
