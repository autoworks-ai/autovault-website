<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import UiIcon from './UiIcon.vue'
import { homepageGateMetrics } from '../data/marketing'

const STEPS = [
  { title: 'YAML auto-repair',         desc: 'Frontmatter is the #1 source of breakage. We fix it before storage.' },
  { title: 'Security denylist',        desc: 'Known-bad patterns: credential reads, fork bombs, exfiltration.' },
  { title: 'Capability vs. behavior',  desc: 'Does the skill actually do what its frontmatter claims?' },
  { title: 'Dedup',                    desc: 'Text similarity in V1, embedding-space matching in V2.' },
  { title: 'Ed25519 sign',             desc: 'Provenance becomes a first-class artifact, not a hope.' },
]

type ScenarioKey = 'clean' | 'unsigned' | 'overscoped' | 'mismatch'
type StepState = '' | 'active' | 'done' | 'failed'

const SCENARIOS: Record<ScenarioKey, {
  label: string
  tag: string
  input: string
  failAt: number | null
  diagnostic: string
  output: string
}> = {
  clean: {
    label: 'Clean install',
    tag: 'UNTRUSTED',
    input: 'weather-skill v1.2.0 from public mirror',
    failAt: null,
    diagnostic: 'Gate admits the skill and writes a signature beside it.',
    output: 'weather-skill v1.2.0 — admitted',
  },
  unsigned: {
    label: 'Unsigned source',
    tag: 'UNSIGNED',
    input: 'pdf-helper v0.1.0 from raw paste',
    failAt: 4,
    diagnostic: 'No trusted signing key was available, so the skill is held outside the vault.',
    output: 'pdf-helper v0.1.0 — held for review',
  },
  overscoped: {
    label: 'Overscoped tools',
    tag: 'OVERSCOPED',
    input: 'deploy-prod v2.0.0 requests fs.write + net.fetch + secrets',
    failAt: 1,
    diagnostic: 'Requested capabilities exceed the caller profile and never reach signing.',
    output: 'deploy-prod v2.0.0 — rejected',
  },
  mismatch: {
    label: 'Behavior mismatch',
    tag: 'MISMATCH',
    input: 'csv-cleaner v0.4.0 claims read-only, writes output files',
    failAt: 2,
    diagnostic: 'Observed behavior disagrees with frontmatter, so the manifest has to be fixed first.',
    output: 'csv-cleaner v0.4.0 — needs manifest repair',
  },
}

const tick = ref(0)
const running = ref(true)
const scenario = ref<ScenarioKey>('clean')
const scenarioKeys: ScenarioKey[] = ['clean', 'unsigned', 'overscoped', 'mismatch']
const activeScenario = computed(() => SCENARIOS[scenario.value])
const rejected = computed(() => activeScenario.value.failAt !== null && tick.value > activeScenario.value.failAt + 1)
const complete = computed(() => activeScenario.value.failAt === null && tick.value > STEPS.length)
let timer: number | undefined

function start() {
  stop()
  timer = window.setInterval(() => {
    const next = tick.value + 1
    if (activeScenario.value.failAt !== null && next > activeScenario.value.failAt + 1) {
      tick.value = activeScenario.value.failAt + 2
      running.value = false
      stop()
      return
    }
    tick.value = next > STEPS.length + 1 ? 0 : next
  }, 1100)
}
function stop() { if (timer) { clearInterval(timer); timer = undefined } }
function replay() { tick.value = 0; running.value = true; start() }
function chooseScenario(key: ScenarioKey) {
  scenario.value = key
  replay()
}
function toggle() {
  running.value = !running.value
  running.value ? start() : stop()
}
onMounted(() => running.value && start())
onBeforeUnmount(stop)

function stepState(i: number): StepState {
  if (tick.value === 0) return ''
  if (activeScenario.value.failAt !== null && tick.value > activeScenario.value.failAt + 1) {
    if (i < activeScenario.value.failAt) return 'done'
    if (i === activeScenario.value.failAt) return 'failed'
    return ''
  }
  if (tick.value > STEPS.length) return 'done'
  if (i < tick.value - 1) return 'done'
  if (i === tick.value - 1) return 'active'
  return ''
}

function stepStatus(i: number) {
  const state = stepState(i)
  if (state === 'failed') return 'BLOCKED'
  if (state === 'active') return 'RUNNING…'
  if (state === 'done') return 'PASSED'
  return 'QUEUED'
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
        <div class="av-gate-scenarios" aria-label="Gate demo scenarios">
          <button
            v-for="key in scenarioKeys"
            :key="key"
            class="av-gate-scenario"
            :class="{ active: scenario === key }"
            type="button"
            @click="chooseScenario(key)"
          >
            {{ SCENARIOS[key].label }}
          </button>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 18px">
          <button class="av-pill-btn" @click="replay">▶ Replay</button>
          <button class="av-pill-btn" @click="toggle">{{ running ? '❚❚ Pause' : '▶ Resume' }}</button>
        </div>

        <div style="margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 460px">
          <div>
            <div style="font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase">Reject rate</div>
            <div style="font-size: 28px; font-weight: 500; margin-top: 4px; letter-spacing: -0.02em">{{ homepageGateMetrics.reject.value }}</div>
            <div style="font-size: 12px; color: var(--ink-3)">{{ homepageGateMetrics.reject.label }}</div>
          </div>
          <div>
            <div style="font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase">Avg. gate latency</div>
            <div style="font-size: 28px; font-weight: 500; margin-top: 4px; letter-spacing: -0.02em">{{ homepageGateMetrics.latency.value }}</div>
            <div style="font-size: 12px; color: var(--ink-3)">{{ homepageGateMetrics.latency.label }}</div>
          </div>
        </div>
      </div>

      <div class="av-gate-pipeline">
        <div class="av-gate-input" :class="{ rejected }">
          <span class="tag">{{ activeScenario.tag }}</span>
          <span style="flex: 1">{{ activeScenario.input }}</span>
          <span style="color: var(--bad); opacity: 0.7">?</span>
        </div>

        <div class="av-gate-track">
          <div v-for="(s, i) in STEPS" :key="i" class="av-gate-step" :class="stepState(i)">
            <span class="num">
              <UiIcon v-if="stepState(i) === 'done'" name="check" :size="12" />
              <span v-else-if="stepState(i) === 'failed'">!</span>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <div>
              <div class="title">{{ s.title }}</div>
              <div class="desc">{{ s.desc }}</div>
            </div>
            <span class="status">{{ stepStatus(i) }}</span>
          </div>
        </div>

        <div class="av-gate-output" :class="{ rejected, complete }" :style="{ opacity: rejected || complete ? 1 : 0.4, transition: 'opacity 300ms' }">
          <span class="tag">{{ rejected ? 'HELD' : 'VERIFIED' }}</span>
          <span style="flex: 1">{{ activeScenario.output }}</span>
          <span class="sig">{{ rejected ? 'diagnostic' : 'sig:0x9af4…2c81' }}</span>
        </div>

        <div class="av-gate-diagnostic" :class="{ rejected, complete }">
          <span>{{ rejected ? '!' : '✓' }}</span>
          <p>{{ activeScenario.diagnostic }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
