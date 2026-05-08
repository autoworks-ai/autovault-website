<script setup lang="ts">
import { ref } from 'vue'
import BrandMark from './BrandMark.vue'
import ClerkAuthControls from './ClerkAuthControls.vue'
import UiIcon from './UiIcon.vue'

const active = ref('vault')
const items: [string, string][] = [
  ['vault', 'Vault'],
  ['gate', 'Gate'],
  ['render', 'Render'],
  ['scope', 'Scope'],
  ['team', 'Team'],
  ['compare', 'Compare'],
]
function go(id: string) {
  active.value = id
  const el = document.getElementById(id)
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 70
    window.scrollTo({ top, behavior: 'smooth' })
  }
}
</script>

<style scoped>
.av-install-pill { white-space: nowrap; gap: 6px; }
.av-install-pill .prompt {
  font-family: var(--mono); font-size: 12px; opacity: 0.7;
}
.av-install-pill .lbl { font-weight: 600; }
</style>

<template>
  <div class="av-topbar">
    <div class="av-topbar-inner">
      <a class="av-brand" href="/">
        <span class="av-brand-mark"><BrandMark /></span>
        <span class="av-brand-name"><span class="auto">Auto</span><span class="vault">Vault</span></span>
        <span style="font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); margin-left: 6px; letter-spacing: 0.04em">v0.2.0</span>
      </a>
      <nav class="av-nav">
        <button v-for="[id, label] in items" :key="id" :class="{ active: active === id }" @click="go(id)">{{ label }}</button>
      </nav>
      <div class="av-topbar-right">
        <a class="av-icon-btn" href="https://github.com/autoworks-ai/autovault" title="GitHub"><UiIcon name="github" /></a>
        <a class="av-pill-btn" href="/quick-start"><span class="av-status-dot" /><span>Docs</span></a>
        <button class="av-pill-btn primary av-install-pill" @click="go('vault')">
          <span class="prompt">$</span>
          <span class="lbl">Install</span>
          <UiIcon name="arrow" />
        </button>
        <ClerkAuthControls />
      </div>
    </div>
  </div>
</template>
