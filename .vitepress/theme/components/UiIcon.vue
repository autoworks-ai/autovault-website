<template>
  <svg v-if="name === 'check'" viewBox="0 0 16 16" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
  <svg v-else-if="name === 'x'" viewBox="0 0 16 16" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
  <svg v-else-if="name === 'arrow'" viewBox="0 0 16 16" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
  <svg v-else-if="name === 'github'" viewBox="0 0 16 16" :width="size" :height="size" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.7 7.7 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.74.54 1.5v2.22c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
  <svg v-else-if="name === 'search'" viewBox="0 0 16 16" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" />
    <path d="m13 13-2.5-2.5" stroke-linecap="round" />
  </svg>
  <svg v-else viewBox="0 0 16 16" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5M8 11v.01" stroke-linecap="round" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: "check" | "x" | "arrow" | "github" | "search" | "tip"; size?: number }>(), { size: 14 });
</script>
