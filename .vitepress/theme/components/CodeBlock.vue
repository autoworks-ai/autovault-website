<template>
  <div class="code">
    <div class="code-head">
      <span class="arg">{{ lang }}</span>
      <span v-if="file" class="muted">{{ file }}</span>
      <button class="copy-btn" type="button" @click="copy">{{ copied ? "copied" : "copy" }}</button>
    </div>
    <pre><slot /></pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{ lang?: string; file?: string }>(), { lang: "bash" });
const copied = ref(false);

async function copy() {
  const text = document.activeElement?.closest(".code")?.querySelector("pre")?.textContent ?? "";
  await navigator.clipboard?.writeText(text);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}
</script>
