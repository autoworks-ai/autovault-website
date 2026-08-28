<template>
  <div class="code">
    <div class="code-head">
      <span class="arg">{{ lang }}</span>
      <span v-if="file" class="muted">{{ file }}</span>
      <button class="copy-btn" type="button" @click="copy">{{ copied ? "copied" : "copy" }}</button>
    </div>
    <pre ref="body"><slot /></pre>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { copyText } from "../utils/clipboard";

const props = withDefaults(defineProps<{ lang?: string; file?: string }>(), { lang: "bash" });
const copied = ref(false);

// A ref to this block's own <pre>, rather than walking up from
// document.activeElement. That walk assumed clicking the button focused it,
// which is not something a button is owed: Safari and Firefox on macOS leave
// focus on the body after a click, and copyText's textarea fallback steals it
// anyway. When the walk missed, closest(".code") returned null, the copy ran
// against an empty string, and the button never flipped to "copied" -- the
// button did nothing at all, silently, in whole browsers.
const body = useTemplateRef<HTMLPreElement>("body");

async function copy() {
  copied.value = await copyText(body.value?.textContent ?? "");
  window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}
</script>
