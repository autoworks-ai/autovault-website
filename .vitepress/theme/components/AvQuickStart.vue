<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const active = ref(0)
const playing = ref(true)
let timer: number | undefined

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

function start() {
  stop()
  timer = window.setInterval(() => {
    active.value = (active.value + 1) % 4
  }, 1800)
}

function choose(index: number) {
  active.value = index
  playing.value = false
  stop()
}

function toggle() {
  playing.value = !playing.value
  playing.value ? start() : stop()
}

onMounted(() => playing.value && start())
onBeforeUnmount(stop)
</script>

<template>
  <section class="av-section" id="start">
    <div class="av-eyebrow"><span class="dash" /> Five minutes, two agents</div>
    <div class="av-qs-head">
      <h2 style="margin-top: 16px; max-width: 760px">Same skill, two callers, zero forks.</h2>
      <button class="av-pill-btn" type="button" @click="toggle">{{ playing ? '❚❚ Pause scan' : '▶ Replay scan' }}</button>
    </div>

    <div class="av-qs-grid">
      <button class="av-qs-step" :class="{ active: active === 0 }" type="button" @click="choose(0)" @focus="choose(0)">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 01</span>
          <span class="av-qs-step-title">Install the local vault</span>
        </div>
        <div class="av-qs-step-body">
          <div class="row"><span class="pmt">$</span><span>curl -fsSL autovault.sh | sh</span></div>
          <div class="out" style="margin-top: 6px">↳ installed → ~/.autovault</div>
          <div class="out">↳ profile dirs symlinked: ~/.claude/skills, ~/.codex/skills</div>
          <div class="row" style="margin-top: 10px"><span class="pmt">$</span><span>autovault status</span></div>
          <div class="ok" style="margin-top: 6px">● vault healthy · 0 skills · ed25519 keypair generated</div>
        </div>
      </button>

      <button class="av-qs-step" :class="{ active: active === 1 }" type="button" @click="choose(1)" @focus="choose(1)">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 02</span>
          <span class="av-qs-step-title">Add a validated skill</span>
        </div>
        <div class="av-qs-step-body">
          <div class="row"><span class="pmt">$</span><span>autovault add github:autoworks-ai/skills/extract-pdf</span></div>
          <div class="out" style="margin-top: 6px">↳ fetching… 1.4kb</div>
          <div class="out">↳ <span class="ok">[1/5]</span> yaml-repair: ok</div>
          <div class="out">↳ <span class="ok">[2/5]</span> denylist: ok</div>
          <div class="out">↳ <span class="ok">[3/5]</span> capability/behavior: ok</div>
          <div class="out">↳ <span class="ok">[4/5]</span> dedup: ok (no near matches)</div>
          <div class="out">↳ <span class="ok">[5/5]</span> sign: 0x9af4…2c81</div>
          <div class="ok" style="margin-top: 6px">✓ admitted to vault</div>
        </div>
      </button>

      <button class="av-qs-step" :class="{ active: active === 2 }" type="button" @click="choose(2)" @focus="choose(2)">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 03</span>
          <span class="av-qs-step-title">Scope to a project</span>
        </div>
        <div class="av-qs-step-body">
          <div class="row"><span class="pmt">$</span><span>autovault scope extract-pdf --project autovault-website --agent claude-code,codex</span></div>
          <div class="out" style="margin-top: 6px">↳ scoped: 2 agents × 1 project</div>
          <div class="out">↳ rendering for claude-code → fs.read → read</div>
          <div class="out">↳ rendering for codex → fs.read → file_read</div>
          <div class="ok" style="margin-top: 6px">✓ ready · cached</div>
        </div>
      </button>

      <button class="av-qs-step" :class="{ active: active === 3 }" type="button" @click="choose(3)" @focus="choose(3)">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 04</span>
          <span class="av-qs-step-title">Run from either agent</span>
        </div>
        <div class="av-qs-step-body">
          <div style="color: var(--ink-3)"># in claude-code</div>
          <div>&gt; use extract-pdf to summarize report.pdf</div>
          <div class="ok" style="margin-top: 4px">✓ tool resolved: chrome-devtools, read</div>
          <div style="color: var(--ink-3); margin-top: 12px"># in codex</div>
          <div>&gt; use extract-pdf to summarize report.pdf</div>
          <div class="ok" style="margin-top: 4px">✓ tool resolved: browser_form, file_read</div>
        </div>
      </button>
    </div>
  </section>
</template>
