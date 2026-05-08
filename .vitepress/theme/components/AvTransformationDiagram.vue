<script setup lang="ts">
import { ref } from 'vue'
import BrandMark from './BrandMark.vue'
import UiIcon from './UiIcon.vue'

type TKey = 'claude-code' | 'codex' | 'cursor'
const TRANSFORMS: Record<TKey, { color: string; rows: { from: string; to: string }[] }> = {
  'claude-code': {
    color: '#d6a85a',
    rows: [
      { from: 'browser.fill_form', to: 'chrome-devtools' },
      { from: 'browser.click',     to: 'chrome-devtools' },
      { from: 'fs.read',           to: 'read' },
      { from: 'fs.write',          to: 'write' },
    ],
  },
  'codex': {
    color: '#5a9dd6',
    rows: [
      { from: 'browser.fill_form', to: 'browser_form' },
      { from: 'browser.click',     to: 'browser_click' },
      { from: 'fs.read',           to: 'file_read' },
      { from: 'fs.write',          to: 'file_write' },
    ],
  },
  'cursor': {
    color: '#b48ad6',
    rows: [
      { from: 'browser.fill_form', to: 'playwright_fill_form' },
      { from: 'browser.click',     to: 'playwright_click' },
      { from: 'fs.read',           to: 'fs_read' },
      { from: 'fs.write',          to: 'fs_write' },
    ],
  },
}

const target = ref<TKey>('claude-code')
const keys = Object.keys(TRANSFORMS) as TKey[]
</script>

<template>
  <section class="av-section" id="render">
    <div class="av-eyebrow"><span class="dash" /> How the vault stays clean — 02</div>
    <h2 style="margin-top: 16px; max-width: 760px">
      One canonical skill.<br />
      <span class="ital">Three rendered views.</span>
    </h2>
    <p class="av-lede" style="margin-top: 16px">
      Skills are written once against canonical capability names. The vault rewrites tool names per caller at delivery time — Claude Code sees <code class="inl">read</code>, Codex sees <code class="inl">file_read</code>, Cursor sees <code class="inl">fs_read</code>. Same skill on disk, three honest renderings out.
    </p>

    <div class="av-xform-wrap">
      <div class="av-xform-head">
        <div>
          <h3>Transformation manifest in flight</h3>
          <p>Hover the platforms to see the rendered view change. The skill on the left never moves.</p>
        </div>
        <div class="av-xform-toggle">
          <button
            v-for="k in keys"
            :key="k"
            :class="{ active: target === k }"
            @click="target = k"
            @mouseenter="target = k"
          >
            <span class="swatch" :style="{ background: TRANSFORMS[k].color }" />{{ k }}
          </button>
        </div>
      </div>

      <div class="av-xform-stage">
        <svg class="flow" viewBox="0 0 1000 400" preserveAspectRatio="none">
          <defs>
            <linearGradient id="avFlow1" x1="0" x2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.7" />
            </linearGradient>
            <linearGradient id="avFlow2" x1="0" x2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.7" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path v-for="y in [120, 170, 220, 270]" :key="'l' + y" :d="`M280 ${y} L500 200`" stroke="url(#avFlow1)" stroke-width="0.8" fill="none" />
          <path v-for="y in [120, 170, 220, 270]" :key="'r' + y" :d="`M500 200 L720 ${y}`" stroke="url(#avFlow2)" stroke-width="0.8" fill="none" />
        </svg>

        <div class="av-xform-col">
          <div class="av-xform-col-head"><span class="num">1</span> Canonical skill</div>
          <div class="av-skill-card">
            <div class="av-skill-card-head">
              <span class="file">extract-pdf<span class="ext">/SKILL.md</span></span>
              <span class="verified"><UiIcon name="check" :size="10" /> SIGNED</span>
            </div>
            <div class="av-skill-card-body">
              <div><span class="yaml-key">name:</span> <span class="yaml-str">extract-pdf</span></div>
              <div><span class="yaml-key">version:</span> <span class="yaml-val">1.4.0</span></div>
              <div><span class="yaml-key">tools_required:</span></div>
              <div class="yaml-list">&nbsp;&nbsp;- browser.fill_form</div>
              <div class="yaml-list">&nbsp;&nbsp;- browser.click</div>
              <div class="yaml-list">&nbsp;&nbsp;- fs.read</div>
              <div class="yaml-list">&nbsp;&nbsp;- fs.write</div>
              <div class="yaml-comment"># transformations:</div>
              <div class="yaml-comment"># &nbsp;&nbsp;applied at delivery</div>
            </div>
          </div>
        </div>

        <div />

        <div class="av-xform-col" style="display: flex; flex-direction: column; justify-content: center">
          <div class="av-xform-col-head" style="justify-content: center"><span class="num">2</span> Engine</div>
          <div class="av-xform-engine"><div class="ring"><BrandMark :size="26" /></div></div>
          <div class="av-platforms">
            <div
              v-for="k in keys"
              :key="k"
              class="av-platform"
              :class="{ active: target === k }"
              @mouseenter="target = k"
            >
              <span class="av-platform-mark">{{ k[0].toUpperCase() }}</span>
              <span class="name">{{ k }}</span>
              <span class="tool">→ render</span>
            </div>
          </div>
        </div>

        <div />

        <div class="av-xform-col">
          <div class="av-xform-col-head"><span class="num">3</span> Rendered for caller</div>
          <div class="av-rendered-tool">
            <div class="rt-head">
              <span class="agent" :style="{ color: TRANSFORMS[target].color }">● {{ target }}</span>
              <span style="margin-left: auto; color: var(--ink-3)">SKILL.md (rewritten)</span>
            </div>
            <div class="rt-body">
              <div style="color: var(--ink-3); margin-bottom: 8px">tools_required:</div>
              <div v-for="r in TRANSFORMS[target].rows" :key="r.from" class="row">
                <span class="key">{{ r.from }}</span>
                <span style="color: var(--ink-4)">→</span>
                <span class="val">{{ r.to }}</span>
              </div>
            </div>
          </div>
          <div style="margin-top: 14px; font-family: var(--mono); font-size: 11px; color: var(--ink-3); line-height: 1.6">
            <span style="color: var(--accent)">✓</span> Skill author wrote one file.<br />
            <span style="color: var(--accent)">✓</span> Agent receives its native tool names.<br />
            <span style="color: var(--accent)">✓</span> No fork, no drift, no duplicate.
          </div>
        </div>
      </div>

      <div class="av-xform-footnote">
        <div class="item">
          <div class="lbl">Manifest format</div>
          <div class="val">YAML in skill frontmatter, validated at <strong>install</strong> and <strong>render</strong></div>
        </div>
        <div class="item">
          <div class="lbl">Resolution latency</div>
          <div class="val"><strong>&lt; 4ms</strong> per skill, cached after first render</div>
        </div>
        <div class="item">
          <div class="lbl">Agents supported today</div>
          <div class="val"><strong>Claude Code, Codex, Cursor, AutoHub</strong> + bridge skill for the rest</div>
        </div>
      </div>
    </div>
  </section>
</template>
