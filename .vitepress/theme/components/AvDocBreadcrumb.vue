<script setup lang="ts">
defineProps<{ section: string; page: string }>();
</script>

<template>
  <nav class="av-doc-breadcrumb" aria-label="Breadcrumb">
    <a href="/" class="crumb home-crumb">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8 L8 2 L14 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 7v6h8V7" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      </svg>
      Home
    </a>
    <span class="sep">/</span>
    <span class="crumb">{{ section }}</span>
    <span class="sep">/</span>
    <span class="crumb current">{{ page }}</span>
  </nav>
</template>
