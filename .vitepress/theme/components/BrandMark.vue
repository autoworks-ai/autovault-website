<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="2" stroke="currentColor" stroke-width="1.4" />
    <path d="M12 4v16" stroke="currentColor" stroke-width="1.4" />
    <path d="M7 12.5l2.2 2.2L13.5 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 22 });
</script>
