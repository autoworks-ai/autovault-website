<template>
  <div class="changelog-page">
    <header class="changelog-header">
      <div class="row">
        <div>
          <div class="eyebrow"><span class="dash" /> Changelog</div>
          <h1>Every skill leaves <span class="ital">a trail.</span></h1>
          <p class="lede">A permanent, signed record of what changed in AutoVault — and a model for how we'd like the rest of the skill ecosystem to look. Every release is signed; every signature is verifiable.</p>
        </div>
        <div class="changelog-feeds">
          <button v-for="feed in feeds" :key="feed" class="changelog-feed-btn" type="button">{{ feed }}</button>
        </div>
      </div>
    </header>

    <div class="changelog-filters">
      <div class="changelog-filter-group" aria-label="Release type">
        <button v-for="option in releaseFilters" :key="option.id" type="button" :class="{ active: filter === option.id }" @click="filter = option.id">
          {{ option.label }} <span class="count">{{ counts[option.id] }}</span>
        </button>
      </div>
      <label class="changelog-search">
        <UiIcon name="search" />
        <span class="visually-hidden">Search releases</span>
        <input v-model="query" type="search" placeholder="Search releases..." />
      </label>
      <div class="changelog-count">{{ filtered.length }} of {{ releases.length }} releases</div>
    </div>

    <div class="changelog-timeline">
      <div v-if="filtered.length === 0" class="empty">no releases match — <button class="seg-btn" type="button" @click="clear">clear filters</button></div>
      <article v-for="release in filtered" :key="release.version" class="changelog-release" :class="release.type">
        <div class="changelog-meta">
          <div class="date">{{ release.date }}</div>
        </div>
        <div class="changelog-card" :class="{ featured: release.featured }">
          <div class="vh">
            <span class="ver">{{ release.version }}</span>
            <span class="vtag" :class="release.tag">{{ release.tag }}</span>
            <span v-if="hasSecurity(release)" class="vtag security">security</span>
            <span v-if="release.codename" class="codename">“{{ release.codename }}”</span>
          </div>
          <h2>{{ release.title }}</h2>
          <p class="summary">{{ release.summary }}</p>

          <div class="changelog-sections">
            <section v-for="section in release.sections" :key="section.kind" class="changelog-section" :class="section.kind">
              <div class="sh"><span class="marker" />{{ sectionTitles[section.kind] }}</div>
              <ul>
                <li v-for="item in section.items" :key="item">{{ item }}</li>
              </ul>
            </section>
          </div>

          <div class="footer-row">
            <span class="commit">{{ release.commit }}</span>
            <span class="author"><span class="av" /> @{{ release.author }}</span>
            <span>{{ release.contributors }} {{ release.contributors === 1 ? "contributor" : "contributors" }}</span>
            <span class="spc" />
            <button class="text-link" type="button">verify signature</button>
            <button class="text-link" type="button">diff →</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiIcon from "./UiIcon.vue";
import { countReleaseFilters, filterReleases, releaseFilters, releases, type Release, type ReleaseFilter, type ReleaseSectionKind } from "../data/releases";

const feeds = ["RSS", "Atom", "JSON"];
const filter = ref<ReleaseFilter>("all");
const query = ref("");
const counts = countReleaseFilters(releases);
const filtered = computed(() => filterReleases(releases, filter.value, query.value));
const sectionTitles: Record<ReleaseSectionKind, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
  security: "Security"
};

function hasSecurity(release: Release) {
  return release.sections.some((section) => section.kind === "security");
}

function clear() {
  filter.value = "all";
  query.value = "";
}
</script>
