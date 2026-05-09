<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import BrandMark from './BrandMark.vue'
import { copyText } from '../utils/clipboard'
import { homepageGateMetrics } from '../data/marketing'
import { AUTOVAULT_AGENT_SETUP_PROMPT, AUTOVAULT_STAGED_INSTALL_COMMAND, AUTOVAULT_STAGED_RUN_COMMAND } from '../../shared/bootstrap'

// Sources: messy, varied, often unsigned. The "before" column.
const SOURCES = [
  { name: 'github.com/…/skills', sub: 'autoworks-ai/skills', tag: 'unsigned' },
  { name: 'agentskills.io',      sub: 'public index',        tag: 'unverified' },
  { name: 'team / SKILL.md',     sub: 'shared in slack',     tag: 'inconsistent' },
  { name: 'discord paste',       sub: 'forwarded once',      tag: 'unscoped' },
  { name: 'internal draft',      sub: 'eng wiki, 2 weeks',   tag: 'forked' },
]

// Adopters: clean, scoped, native to each tool. The "after" column.
const ADOPTERS = [
  { name: 'Claude Code', mark: 'C', tool: 'read · write' },
  { name: 'Codex',       mark: 'X', tool: 'file_read · file_write' },
  { name: 'Cursor',      mark: 'U', tool: 'fs_read · fs_write' },
  { name: 'AutoHub',     mark: 'A', tool: 'native bridge' },
]

const tickIn  = ref(0)
const tickOut = ref(0)
const copiedStart = ref<'shell' | 'agent' | null>(null)
let t1: number | undefined
let t2: number | undefined

async function copyStart(kind: 'shell' | 'agent') {
  const ok = await copyText(kind === 'shell' ? AUTOVAULT_STAGED_INSTALL_COMMAND : AUTOVAULT_AGENT_SETUP_PROMPT)
  if (!ok) return
  copiedStart.value = kind
  window.setTimeout(() => {
    if (copiedStart.value === kind) copiedStart.value = null
  }, 1400)
}

onMounted(() => {
  t1 = window.setInterval(() => { tickIn.value  = (tickIn.value  + 1) % SOURCES.length  }, 900)
  t2 = window.setInterval(() => { tickOut.value = (tickOut.value + 1) % ADOPTERS.length }, 900)
})
onBeforeUnmount(() => { if (t1) clearInterval(t1); if (t2) clearInterval(t2) })

// Geometry constants for the SVG flow diagram.
// Source nodes vertically distributed at x≈110, vault hub at x≈480, adopters at x≈850.
const SRC_X = 110
const HUB_X = 480
const DST_X = 850
const VBOX_W = 960
const VBOX_H = 460
function srcY(i: number) { return 60 + i * (VBOX_H - 120) / (SOURCES.length - 1) }
function dstY(i: number) { return 90 + i * (VBOX_H - 180) / (ADOPTERS.length - 1) }
</script>

<template>
  <section class="av-flow-hero" id="overview">
    <div class="av-flow-bg" aria-hidden="true"><div class="grid" /></div>

    <div class="av-flow-wrap">
      <header class="av-flow-header">
        <div class="av-flow-eyebrow">
          <span class="dot" />
          <span class="lbl">SKILL.md</span>
          <span class="sep">·</span>
          <span class="muted">open spec, evolving</span>
          <a class="link" href="/authoring" aria-label="Read the skill authoring spec">read the spec ↗</a>
        </div>

        <h1 class="av-flow-title">
          A vault for skills<br />
          <span class="ital">that agents can actually use.</span>
        </h1>

        <p class="av-flow-sub">
          SKILL.md files arrive from GitHub repos, public indexes, team docs,
          and agent drafts. AutoVault validates them at the door, signs what
          passes, and renders one clean view per agent without forking.
        </p>
      </header>

      <section class="av-start-panel" aria-label="Start AutoVault">
        <div class="av-start-card primary">
          <div class="av-start-kicker">Terminal</div>
          <div class="av-start-title">Review, then install the local vault</div>
          <div class="av-start-command">
            <span class="prompt">$</span>
            <code>{{ AUTOVAULT_STAGED_INSTALL_COMMAND }}</code>
            <button type="button" @click="copyStart('shell')">{{ copiedStart === 'shell' ? 'copied' : 'copy' }}</button>
          </div>
          <p>Inspect the script, then run <code>{{ AUTOVAULT_STAGED_RUN_COMMAND }}</code>.</p>
        </div>
        <div class="av-start-card">
          <div class="av-start-kicker">Agent-assisted</div>
          <div class="av-start-title">Have Claude Code set itself up</div>
          <div class="av-start-command prompt-block">
            <code>{{ AUTOVAULT_AGENT_SETUP_PROMPT }}</code>
            <button type="button" @click="copyStart('agent')">{{ copiedStart === 'agent' ? 'copied' : 'copy' }}</button>
          </div>
          <p>Fetches a raw SKILL.md, shows the behavior, installs locally only after approval, then verifies AutoVault.</p>
        </div>
      </section>

      <div class="av-flow-stage">
        <!-- ── Sources column (messy in) ──────────────────── -->
        <div class="av-flow-col srcs">
          <div class="av-flow-col-head">
            <span class="num">01</span>
            <span class="lbl">In · varied sources</span>
          </div>
          <div
            v-for="(s, i) in SOURCES"
            :key="s.name"
            class="src-row"
            :class="{ active: tickIn === i }"
          >
            <span class="src-icon">▸</span>
            <div class="src-meta">
              <span class="src-name">{{ s.name }}</span>
              <span class="src-sub">{{ s.sub }}</span>
            </div>
            <span class="src-tag">{{ s.tag }}</span>
          </div>
        </div>

        <!-- ── Vault hub ───────────────────────────────────── -->
        <div class="av-flow-hub">
          <div class="hub-ring"><div class="hub-mark"><BrandMark :size="34" /></div></div>
          <div class="hub-label">
            <span class="hub-name">~/.autovault</span>
            <span class="hub-sub">gate · sign · scope</span>
          </div>
        </div>

        <!-- ── Adopters column (clean out) ─────────────────── -->
        <div class="av-flow-col dsts">
          <div class="av-flow-col-head right">
            <span class="lbl">Out · rendered per agent</span>
            <span class="num">02</span>
          </div>
          <div
            v-for="(a, i) in ADOPTERS"
            :key="a.name"
            class="dst-row"
            :class="{ active: tickOut === i }"
          >
            <span class="dst-mark">{{ a.mark }}</span>
            <div class="dst-meta">
              <span class="dst-name">{{ a.name }}</span>
              <span class="dst-tool">{{ a.tool }}</span>
            </div>
            <span class="dst-check">✓</span>
          </div>
        </div>

        <!-- ── Connection lines + traveling pulses (full-stage SVG) ── -->
        <svg class="av-flow-lines" :viewBox="`0 0 ${VBOX_W} ${VBOX_H}`" preserveAspectRatio="none">
          <defs>
            <linearGradient id="flowIn" x1="0" x2="1">
              <stop offset="0%"   stop-color="rgba(217,113,113,0.5)" />
              <stop offset="60%"  stop-color="rgba(232,168,102,0.5)" />
              <stop offset="100%" stop-color="var(--accent)" />
            </linearGradient>
            <linearGradient id="flowOut" x1="0" x2="1">
              <stop offset="0%"   stop-color="var(--accent)" />
              <stop offset="100%" stop-color="rgba(90,214,192,0.15)" />
            </linearGradient>
          </defs>

          <!-- Inflow lines (sources → hub) -->
          <g v-for="(_, i) in SOURCES" :key="'in' + i">
            <path
              :d="`M ${SRC_X} ${srcY(i)} C ${(SRC_X + HUB_X) / 2} ${srcY(i)}, ${(SRC_X + HUB_X) / 2} ${VBOX_H / 2}, ${HUB_X} ${VBOX_H / 2}`"
              stroke="url(#flowIn)"
              stroke-width="1"
              fill="none"
              stroke-dasharray="2 4"
              opacity="0.55"
            />
            <circle r="2.5" fill="var(--accent)" opacity="0.85">
              <animateMotion
                :path="`M ${SRC_X} ${srcY(i)} C ${(SRC_X + HUB_X) / 2} ${srcY(i)}, ${(SRC_X + HUB_X) / 2} ${VBOX_H / 2}, ${HUB_X} ${VBOX_H / 2}`"
                dur="3.6s"
                :begin="`${i * 0.45}s`"
                repeatCount="indefinite"
              />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="3.6s" :begin="`${i * 0.45}s`" repeatCount="indefinite" />
            </circle>
          </g>

          <!-- Outflow lines (hub → adopters) -->
          <g v-for="(_, i) in ADOPTERS" :key="'out' + i">
            <path
              :d="`M ${HUB_X} ${VBOX_H / 2} C ${(HUB_X + DST_X) / 2} ${VBOX_H / 2}, ${(HUB_X + DST_X) / 2} ${dstY(i)}, ${DST_X} ${dstY(i)}`"
              stroke="url(#flowOut)"
              stroke-width="1"
              fill="none"
              opacity="0.6"
            />
            <circle r="2.5" fill="var(--accent)">
              <animateMotion
                :path="`M ${HUB_X} ${VBOX_H / 2} C ${(HUB_X + DST_X) / 2} ${VBOX_H / 2}, ${(HUB_X + DST_X) / 2} ${dstY(i)}, ${DST_X} ${dstY(i)}`"
                dur="2.6s"
                :begin="`${1.6 + i * 0.32}s`"
                repeatCount="indefinite"
              />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="2.6s" :begin="`${1.6 + i * 0.32}s`" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>
      </div>

      <div class="av-flow-footer">
        <div class="meta">
          <span class="meta-num">{{ homepageGateMetrics.reject.value }}</span>
          <span class="meta-lbl">{{ homepageGateMetrics.reject.label }}</span>
        </div>
        <div class="meta">
          <span class="meta-num">{{ homepageGateMetrics.latency.value }}</span>
          <span class="meta-lbl">{{ homepageGateMetrics.latency.label }}</span>
        </div>
        <div class="meta">
          <span class="meta-num">{{ homepageGateMetrics.render.value }}</span>
          <span class="meta-lbl">{{ homepageGateMetrics.render.label }}</span>
        </div>
        <div class="bridge">
          <span>The format works. The bits around it don't.</span>
          <span class="arrow">↓</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.av-flow-hero {
  position: relative;
  padding: 88px 0 64px;
  border-top: 0;
  overflow: hidden;
}
.av-flow-bg { position: absolute; inset: 0; pointer-events: none; }
.av-flow-bg .grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 64px 64px;
  opacity: 0.4;
  mask-image: radial-gradient(ellipse 90% 70% at 50% 50%, black, transparent 80%);
}

.av-flow-wrap {
  position: relative;
  max-width: 1240px; margin: 0 auto;
  padding: 0 32px;
}

/* ── Header ─────────────────────────────────────── */
.av-flow-header {
  max-width: 760px;
  margin: 0 auto 56px;
  text-align: center;
}
.av-flow-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-size: 11.5px;
  color: var(--ink-2); letter-spacing: 0.04em;
  padding: 6px 12px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 100px;
  margin-bottom: 28px;
}
.av-flow-eyebrow .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 8px var(--accent);
}
.av-flow-eyebrow .lbl   { color: var(--ink); font-weight: 500; }
.av-flow-eyebrow .sep   { color: var(--ink-4); }
.av-flow-eyebrow .muted { color: var(--ink-3); }
.av-flow-eyebrow .link  {
  color: var(--accent); margin-left: 4px;
  border-left: 1px solid var(--line-2); padding-left: 10px;
  text-decoration: none;
}
.av-flow-eyebrow .link:hover { color: var(--ink); }

.av-flow-title {
  font-size: 60px; line-height: 1.04; letter-spacing: -0.035em;
  font-weight: 500; color: var(--ink);
  margin: 0;
}
.av-flow-title .ital {
  font-family: var(--serif); font-style: italic; font-weight: 400;
  color: var(--ink-3); letter-spacing: -0.015em;
}
.av-flow-sub {
  margin: 22px auto 0; max-width: 600px;
  color: var(--ink-2); font-size: 16px; line-height: 1.6;
}

/* ── First-run entry points ─────────────────────── */
.av-start-panel {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 12px;
  max-width: 980px;
  margin: 0 auto 44px;
}
.av-start-card {
  min-width: 0;
  background: rgba(16, 23, 29, 0.84);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
}
.av-start-card.primary {
  border-color: rgba(90, 214, 192, 0.28);
  background: rgba(90, 214, 192, 0.06);
}
.av-start-kicker {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.av-start-title {
  margin-top: 8px;
  color: var(--ink);
  font-size: 15px;
  font-weight: 500;
}
.av-start-command {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  margin-top: 12px;
  padding: 10px 10px 10px 12px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: 6px;
  font-family: var(--mono);
  font-size: 12px;
}
.av-start-command .prompt {
  flex: 0 0 auto;
  color: var(--accent);
}
.av-start-command code {
  min-width: 0;
  flex: 1;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0;
}
.av-start-command.prompt-block {
  align-items: flex-start;
}
.av-start-command.prompt-block code {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.45;
}
.av-start-command button {
  flex: 0 0 auto;
  border: 1px solid var(--line-2);
  background: var(--panel);
  color: var(--ink-3);
  border-radius: 4px;
  padding: 4px 8px;
  font: inherit;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.av-start-command button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.av-start-card p {
  margin: 10px 0 0;
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.5;
}

/* ── Stage ──────────────────────────────────────── */
.av-flow-stage {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1.1fr 1fr;
  gap: 0;
  align-items: center;
  min-height: 460px;
  padding: 0 8px;
}
.av-flow-lines {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

/* ── Columns ────────────────────────────────────── */
.av-flow-col { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; }
.av-flow-col-head {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 10.5px;
  color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase;
  margin-bottom: 6px;
}
.av-flow-col-head.right { justify-content: flex-end; }
.av-flow-col-head .num {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--panel); border: 1px solid var(--line-2);
  display: grid; place-items: center;
  font-size: 10px; color: var(--ink-2);
}

/* Source rows (left, "messy in") */
.src-row {
  display: grid; grid-template-columns: 16px 1fr auto; gap: 10px;
  padding: 10px 12px;
  background: var(--bg-2); border: 1px dashed var(--line-2);
  border-radius: 6px;
  font-family: var(--mono); font-size: 11.5px;
  transition: border-color 240ms, background 240ms;
}
.src-row.active { border-color: var(--ink-3); border-style: solid; background: var(--panel); }
.src-row .src-icon { color: var(--ink-4); }
.src-row .src-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.src-row .src-name { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.src-row .src-sub  { color: var(--ink-4); font-size: 10px; }
.src-row .src-tag  {
  font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--bad); background: rgba(217,113,113,0.08);
  padding: 2px 6px; border-radius: 3px;
  align-self: center;
}

/* Vault hub (center) */
.av-flow-hub {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  align-self: center;
}
.hub-ring {
  width: 120px; height: 120px; border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--line-2);
  display: grid; place-items: center;
  position: relative;
  box-shadow: 0 0 0 1px var(--bg) inset, 0 12px 40px rgba(0,0,0,0.4), 0 0 60px rgba(90,214,192,0.12);
}
.hub-ring::before, .hub-ring::after {
  content: ""; position: absolute; inset: -8px; border-radius: 50%;
  border: 1px dashed rgba(90,214,192,0.3);
  animation: avSpin 18s linear infinite;
}
.hub-ring::after { inset: -20px; opacity: 0.4; animation-direction: reverse; animation-duration: 30s; }
@keyframes avSpin { to { transform: rotate(360deg); } }
.hub-mark { display: grid; place-items: center; }
.hub-label {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-family: var(--mono);
}
.hub-name { font-size: 13px; color: var(--ink); font-weight: 500; }
.hub-sub  { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.08em; text-transform: uppercase; }

/* Adopter rows (right, "clean out") */
.dst-row {
  display: grid; grid-template-columns: 22px 1fr auto; gap: 12px;
  padding: 10px 12px;
  background: var(--bg-2); border: 1px solid var(--line);
  border-radius: 6px;
  font-family: var(--mono); font-size: 12px;
  transition: border-color 240ms, background 240ms;
}
.dst-row.active { border-color: var(--accent); background: rgba(90,214,192,0.05); }
.dst-row .dst-mark {
  width: 22px; height: 22px; border-radius: 4px;
  background: var(--panel); border: 1px solid var(--line-2);
  display: grid; place-items: center;
  font-weight: 600; font-size: 11px; color: var(--ink-2);
}
.dst-row.active .dst-mark { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.dst-row .dst-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dst-row .dst-name { color: var(--ink); }
.dst-row .dst-tool { color: var(--ink-4); font-size: 10px; }
.dst-row .dst-check { color: var(--accent); align-self: center; opacity: 0.6; }
.dst-row.active .dst-check { opacity: 1; }

/* ── Footer / metrics ───────────────────────────── */
.av-flow-footer {
  margin-top: 64px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  gap: 40px;
  align-items: center;
}
.av-flow-footer .meta { display: flex; flex-direction: column; gap: 4px; }
.av-flow-footer .meta-num {
  font-size: 22px; font-weight: 500; letter-spacing: -0.02em;
  color: var(--ink); font-feature-settings: "tnum";
}
.av-flow-footer .meta-lbl {
  font-family: var(--mono); font-size: 10.5px;
  color: var(--ink-3); letter-spacing: 0.06em; text-transform: uppercase;
}
.av-flow-footer .bridge {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px;
  font-family: var(--mono); font-size: 12px;
  color: var(--ink-3);
}
.av-flow-footer .arrow {
  color: var(--accent); font-size: 16px;
  animation: avBob 2.4s ease-in-out infinite;
}
@keyframes avBob {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50%      { transform: translateY(4px); opacity: 1; }
}

@media (max-width: 1080px) {
  .av-flow-title { font-size: 44px; }
  .av-start-panel { grid-template-columns: 1fr; max-width: 720px; }
  .av-flow-stage { grid-template-columns: 1fr; gap: 32px; }
  .av-flow-lines { display: none; }
  .av-flow-footer { grid-template-columns: 1fr 1fr; gap: 24px; }
  .av-flow-footer .bridge { grid-column: 1 / -1; justify-content: flex-start; }
}
</style>
