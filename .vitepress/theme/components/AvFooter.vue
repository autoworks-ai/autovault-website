<script setup lang="ts">
import BrandMark from './BrandMark.vue'
</script>

<template>
  <footer class="av-footer">
    <div class="av-footer-inner">
      <div class="av-footer-col">
        <div class="av-brand" style="margin-bottom: 14px">
          <span class="av-brand-mark"><BrandMark /></span>
          <span class="av-brand-name"><span class="auto">Auto</span><span class="vault">Vault</span></span>
        </div>
        <div style="color: var(--ink-3); font-size: 13px; max-width: 320px; line-height: 1.55">
          A local-first vault for the skills your agents actually use. Validated at the door, signed with provenance, scoped per caller.
        </div>
        <div style="margin-top: 18px; font-family: var(--mono); font-size: 11px; color: var(--ink-4); letter-spacing: 0.04em">
          PART OF THE AUTOWORKS-AI FAMILY
        </div>
      </div>
      <div class="av-footer-col">
        <h5>Vault</h5>
        <a href="/authoring">What's a skill</a><a href="/#vault">The folder</a><a href="/#gate">Validation gate</a><a href="/#render">Transformation</a><a href="/authoring#perms">Scoping</a>
      </div>
      <div class="av-footer-col">
        <h5>Develop</h5>
        <a href="/quick-start">Quick start</a><a href="/authoring">Authoring skills</a><a href="/deploy">Self-hosting</a><a href="/deploy">Remote MCP</a><a href="/changelog">Changelog</a>
      </div>
      <div class="av-footer-col">
        <h5>Org</h5>
        <a href="https://github.com/autoworks-ai/autovault">autoworks-ai</a><a href="https://automem.ai">AutoMem</a><a href="https://github.com/autoworks-ai">AutoHub</a><a href="https://drunk.support">AutoJack</a><a href="https://github.com/autoworks-ai/autovault/security">Security policy</a>
      </div>
    </div>
    <div class="av-footer-bottom">
      <span>© 2026 autoworks-ai · MIT license</span>
      <span>autovault.dev</span>
    </div>
  </footer>
</template>
