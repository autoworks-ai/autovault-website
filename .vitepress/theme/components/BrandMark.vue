<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    class="brand-mark-svg"
    :class="[`is-${state}`, { 'has-depth': showDepth, 'is-working': working, 'is-unlocking': unlocking }]"
    fill="none"
    aria-hidden="true"
  >
    <rect class="brand-mark-body" x="2.4" y="2.4" width="19.2" height="16.8" rx="3.84" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    <path class="brand-mark-stub" d="M7.2 19.2v1.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <path class="brand-mark-stub" d="M16.8 19.2v1.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <g class="brand-mark-depth">
      <rect x="4.8" y="4.8" width="14.4" height="12" rx="1.9" stroke="currentColor" stroke-width="0.5" stroke-dasharray="1.1 1.1" />
    </g>
    <g class="brand-mark-dial">
      <circle cx="12" cy="10.8" r="2.9" stroke="currentColor" stroke-width="1.25" />
      <path d="M12 7.9v1.45" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </g>
  </svg>
</template>

<script setup lang="ts">
type BrandMarkState = "locked" | "unlocked";

// `working` and `unlocking` are separate booleans rather than extra members of
// BrandMarkState because they are *transient* and the resting state still has
// to be readable underneath them: a mark can be unlocked and working (a second
// machine checking in against an open vault), and `unlocking` has to sit on
// top of `unlocked` so the keyframe can land exactly on that resting state.
withDefaults(
  defineProps<{
    size?: number;
    state?: BrandMarkState;
    showDepth?: boolean;
    /** Dial sweeps back and forth. The loading graphic. */
    working?: boolean;
    /** One ~700ms turn-and-retract. Apply in the same tick the state flips. */
    unlocking?: boolean;
  }>(),
  {
    size: 22,
    state: "locked",
    showDepth: false,
    working: false,
    unlocking: false
  }
);
</script>
