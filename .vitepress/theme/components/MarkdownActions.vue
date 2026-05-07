<template>
  <div class="markdown-actions" aria-label="Markdown actions">
    <a class="copy-btn markdown-link" :href="doc.agentPath" target="_blank" rel="noopener">Markdown</a>
    <button class="copy-btn" :class="{ copied }" type="button" @click="copyMarkdown">{{ copied ? "Copied" : "Copy Markdown" }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { getPageDoc, type PageDocKey } from "../../shared/pageDocs";
import { copyText } from "../utils/clipboard";

const props = defineProps<{ page: PageDocKey }>();
const copied = ref(false);
const doc = computed(() => getPageDoc(props.page));

async function copyMarkdown() {
  copied.value = await copyText(doc.value.markdown);
  window.setTimeout(() => {
    copied.value = false;
  }, 1400);
}
</script>
