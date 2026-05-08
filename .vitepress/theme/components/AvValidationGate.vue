<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import UiIcon from './UiIcon.vue'

const STEPS = [
  { title: 'YAML auto-repair',         desc: 'Frontmatter is the #1 source of breakage. We fix it before storage.' },
  { title: 'Security denylist',        desc: 'Known-bad patterns: credential stealers, fork bombs, exfiltration.' },
  { title: 'Capability vs. behavior',  desc: 'Does the skill actually do what its frontmatter claims?' },
  { title: 'Dedup',                    desc: 'Text similarity in V1, embedding-space matching in V2.' },
  { title: 'Ed25519 sign',             desc: 'Provenance becomes a first-class artifact, not a hope.' },
]

const tick = ref(0)
const running = ref(true)
let timer: number | undefined

function start() {
  stop()
  timer = window.setInterval(() => {
    tick.value = (tick.value + 1) % (STEPS.length + 2)
  }, 1100)
}
function stop() { if (timer) { clearInterval(timer); timer = undefined } }
function replay() { tick.value = 0; running.value = true; start() }
function toggle() {
  running.value = !running.value
  running.value ? start() : stop()
}
onMounted(() => running.value && start())
onBeforeUnmount(stop)

function stepState(i: number): '' | 'active' | 'done' {
  if (tick.value === 0) return ''
  if (tick.value > STEPS.length) return 'done'
  if (i < tick.value - 1) return 'done'
  if (i === tick.value - 1) return 'active'
  return ''
}
</script>

<template>
  <section class="av-section" id="gate">
    <div class="av-gate-section">
      <div>
        <div class="av-eyebrow"><span class="dash" /> How the vault stays clean — 01</div>
        <h2 style="margin-top: 16px">
          Skills enter dirty.<br />
          They leave <span class="ital">signed.</span>
        </h2>
        <p class="av-lede" style="margin-top: 16px">
          Anything joining the folder — whether you ran <code class="inl">autovault add</code> or an agent proposed one mid-conversation — passes the same five-step gate first. YAML auto-repaired, denylisted patterns refused, behavior cross-checked against the frontmatter, dedup against what's already there, then signed on the way in.
        </p>
        <div style="display: flex; gap: 12px; margin-top: 28px">
          <button class="av-pill-btn" @click="replay">▶ Replay</button>
          <button class="av-pill-btn" @click="toggle">{{ running ? '❚❚ Pause' : '▶ Resume' }}</button>
        </div>

        <div style="margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 460px">
          <div>
            <div style="font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase">Reject rate</div>
            <div style="font-size: 28px; font-weight: 500; margin-top: 4px; letter-spacing: -0.02em">11.4%</div>
            <div style="font-size: 12px; color: var(--ink-3)">of submissions in private beta</div>
          </div>
          <div>
            <div style="font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase">Avg. gate latency</div>
            <div style="font-size: 28px; font-weight: 500; margin-top: 4px; letter-spacing: -0.02em">820ms</div>
            <div style="font-size: 12px; color: var(--ink-3)">per skill, fully validated</div>
          </div>
        </div>
      </div>

      <div class="av-gate-pipeline">
        <div class="av-gate-input">
          <span class="tag">UNTRUSTED</span>
          <span style="flex: 1">weather-skill@1.2.0 from clawdhub-mirror</span>
          <span style="color: var(--bad); opacity: 0.7">?</span>
        </div>

        <div class="av-gate-track">
          <div v-for="(s, i) in STEPS" :key="i" class="av-gate-step" :class="stepState(i)">
            <span class="num">
              <UiIcon v-if="stepState(i) === 'done'" name="check" :size="12" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <div>
              <div class="title">{{ s.title }}</div>
              <div class="desc">{{ s.desc }}</div>
            </div>
            <span class="status">{{ stepState(i) === 'active' ? 'RUNNING…' : stepState(i) === 'done' ? 'PASSED' : 'QUEUED' }}</span>
          </div>
        </div>

        <div class="av-gate-output" :style="{ opacity: tick > STEPS.length ? 1 : 0.4, transition: 'opacity 300ms' }">
          <span class="tag">VERIFIED</span>
          <span style="flex: 1">weather-skill@1.2.0 — admitted</span>
          <span class="sig">sig:0x9af4…2c81</span>
        </div>
      </div>
    </div>
  </section>
</template>
