<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

// Three agents holding the "same" skill at three drifted states.
// The visualization sits between Problems (text-only) and FolderHero (the answer),
// so it makes the drift problem concrete before the vault resolves it.

type Line = { t: 'add' | 'del' | 'ctx'; s: string }

const COLS = [
  {
    agent: 'Claude Code',
    mark: 'C',
    path: '~/.claude/skills/extract-pdf/SKILL.md',
    ver: 'v1.4.0',
    edited: 'edited 8 days ago',
    sig: 'unsigned',
    status: 'stale',
    diff: [
      { t: 'ctx', s: '## Tool calls' },
      { t: 'ctx', s: '- read(path)' },
      { t: 'ctx', s: '- write(path, content)' },
      { t: 'add', s: '+ extract_text(pdf)' },
    ] as Line[],
  },
  {
    agent: 'Codex',
    mark: 'X',
    path: '~/.codex/skills/extract-pdf/SKILL.md',
    ver: 'v1.2.1',
    edited: 'manually edited',
    sig: 'unsigned',
    status: 'forked',
    diff: [
      { t: 'ctx', s: '## Tool calls' },
      { t: 'del', s: '- read(path)' },
      { t: 'add', s: '+ file_read(path)' },
      { t: 'add', s: '+ file_write(path, content)' },
    ] as Line[],
  },
  {
    agent: 'Cursor',
    mark: 'R',
    path: 'proj/.cursor/rules/extract-pdf.mdc',
    ver: 'no version',
    edited: 'pasted from slack',
    sig: 'unsigned',
    status: 'orphan',
    diff: [
      { t: 'ctx', s: '## Tool calls' },
      { t: 'ctx', s: '- read(path)' },
      { t: 'add', s: '+ // TODO: trim prompt' },
      { t: 'del', s: '- write(path, content)' },
    ] as Line[],
  },
]

// Cycle a "syncing" highlight pulse across columns to keep the visual alive.
const focus = ref(0)
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => {
    focus.value = (focus.value + 1) % COLS.length
  }, 2200)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

// Convergence: scattered fragments orbit in from the perimeter, get pulled to center.
// Each chip has a random start vector, rotation, delay, and duration so the field reads
// as a natural cloud rather than a step-locked sequence.
const chipLabels = [
  '~/.cursor/rules/extract-pdf.mdc',
  '~/.codex/skills/extract-pdf/',
  '~/.claude/skills/SKILL.md',
  'discord paste · 03/14',
  'team-wiki/skills.md',
  'gist#a8f1c · v0.7',
  'agentskills.io/extract',
  'proj/.cursor/rules/',
  'fork: extract-pdf-v2',
  'slack-dm · 11d ago',
  'github.com/.../skills',
  '~/Downloads/SKILL.md',
]
const rand = (min: number, max: number) => Math.random() * (max - min) + min
const chips = chipLabels.map((label) => {
  // Place starts around the perimeter of a 720x260 zone
  const side = Math.floor(Math.random() * 4)
  let sx = 0, sy = 0
  if (side === 0)      { sx = rand(-360, 360); sy = rand(-160, -100) }
  else if (side === 1) { sx = rand(260, 380);  sy = rand(-120, 120) }
  else if (side === 2) { sx = rand(-360, 360); sy = rand(100, 160) }
  else                 { sx = rand(-380, -260); sy = rand(-120, 120) }
  return {
    label,
    sx: Math.round(sx),
    sy: Math.round(sy),
    rot: Math.round(rand(-8, 8)),
    delay: +rand(0, 5.6).toFixed(2),
    dur: +rand(5.2, 6.8).toFixed(2),
  }
})
</script>

<template>
  <section class="av-section av-drift-section" id="drift">
    <div class="head">
      <div>
        <div class="av-eyebrow"><span class="dash" /> What this looks like, concretely</div>
        <h2 style="margin-top: 16px; max-width: 760px">
          One skill. <span class="ital">Three filesystems. Three versions. No source of truth.</span>
        </h2>
      </div>
      <p class="av-lede" style="max-width: 380px">
        Every agent reads from its own folder. Edits in one don't propagate. Versions drift. Signatures don't exist.
        The same <code>extract-pdf</code> skill ends up looking like this.
      </p>
    </div>

    <div class="drift-grid">
      <div
        v-for="(c, i) in COLS"
        :key="c.agent"
        class="drift-col"
        :class="{ active: focus === i }"
      >
        <div class="col-head">
          <span class="mark">{{ c.mark }}</span>
          <div class="col-meta">
            <span class="agent">{{ c.agent }}</span>
            <span class="path">{{ c.path }}</span>
          </div>
          <span class="status" :data-status="c.status">{{ c.status }}</span>
        </div>

        <div class="col-pills">
          <span class="pill ver">{{ c.ver }}</span>
          <span class="pill edited">{{ c.edited }}</span>
          <span class="pill sig">⌀ {{ c.sig }}</span>
        </div>

        <pre class="diff"><code><span
          v-for="(l, li) in c.diff"
          :key="li"
          :class="['line', l.t]"
        >{{ l.t === 'add' ? '+ ' : l.t === 'del' ? '- ' : '  ' }}{{ l.s.replace(/^[+-] /, '') }}
</span></code></pre>
      </div>
    </div>

    <!-- Convergence stage: scattered fragments drift in, vault dial closes. -->
    <div class="convergence" aria-hidden="true">
      <div class="conv-bg">
        <span class="bg-line bg-l1" />
        <span class="bg-line bg-l2" />
        <span class="bg-line bg-l3" />
      </div>

      <!-- Drifting filename chips -->
      <span
        v-for="(c, i) in chips"
        :key="c.label + i"
        class="chip-fly"
        :style="{
          '--sx': c.sx + 'px',
          '--sy': c.sy + 'px',
          '--rot': c.rot + 'deg',
          '--delay': c.delay + 's',
          '--dur': c.dur + 's',
        }"
      >{{ c.label }}</span>

      <!-- Central vault SVG: official AutoVault logo. Body always present; dial scales+fades to "lock" when chips land. -->
      <svg class="vault-svg" viewBox="0 0 200 200" width="160" height="160" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="vault-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stop-color="#5ad6c0" stop-opacity="0.28" />
            <stop offset="60%" stop-color="#5ad6c0" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#5ad6c0" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="90" r="92" fill="url(#vault-glow)" class="vault-glow" />

        <!-- Body -->
        <rect x="20" y="20" width="160" height="140" rx="32"
              stroke="#5ad6c0" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Stubs -->
        <path d="M60 160 v16" stroke="#5ad6c0" stroke-width="12" stroke-linecap="round" />
        <path d="M140 160 v16" stroke="#5ad6c0" stroke-width="12" stroke-linecap="round" />

        <!-- Open-state dashed interior (visible while unlocked, fades out as it closes) -->
        <g class="vault-open-hint">
          <rect x="40" y="40" width="120" height="100" rx="16"
                stroke="#5ad6c0" stroke-width="4"
                stroke-dasharray="8 8" opacity="0.3" />
        </g>

        <!-- Dial (closed state): scales up + fades in with spring easing -->
        <g class="vault-dial">
          <circle cx="100" cy="90" r="24" stroke="#5ad6c0" stroke-width="10" />
          <path d="M100 66 v12" stroke="#5ad6c0" stroke-width="10" stroke-linecap="round" />
        </g>

        <!-- Lock pulse: radiates outward at the moment the dial snaps closed -->
        <circle cx="100" cy="90" r="24" class="lock-pulse"
                stroke="#5ad6c0" stroke-width="6" fill="none" />
      </svg>

      <!-- Caption strip below the vault -->
      <div class="conv-caption">
        <span class="cap-dot" />
        <span class="cap-text">scattered → validated → signed → vaulted</span>
      </div>
    </div>

    <div class="drift-resolve">
      <div class="resolve-line"></div>
      <div class="resolve-card">
        <div class="resolve-label">↳ in the vault</div>
        <div class="resolve-body">
          <span class="canonical">~/.autovault/skills/extract-pdf/SKILL.md</span>
          <span class="dot">·</span>
          <span class="r-pill">v1.4.0</span>
          <span class="r-pill r-sig">signed 0x9af4…2c81</span>
          <span class="r-pill r-render">rendered per agent</span>
        </div>
        <div class="resolve-sub">
          One canonical file. Three native renders — <code>read</code> for Claude Code, <code>file_read</code> for Codex, <code>fs_read</code> for Cursor — generated at install time, not forked by hand.
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.av-drift-section { padding-top: 120px; padding-bottom: 80px; }
.head {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-bottom: 56px; gap: 32px;
}
.head .ital {
  font-family: var(--serif); font-style: italic; font-weight: 400;
  color: var(--ink-3); letter-spacing: -0.015em;
}

.drift-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;
  align-items: stretch;
}

.drift-col {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px 18px 14px;
  display: flex; flex-direction: column; gap: 14px;
  transition: border-color 0.6s ease, box-shadow 0.6s ease, transform 0.6s ease;
}
.drift-col.active {
  border-color: rgba(90, 214, 192, 0.45);
  box-shadow: 0 0 0 3px rgba(90, 214, 192, 0.08);
}

.col-head {
  display: grid; grid-template-columns: 28px 1fr auto;
  align-items: center; gap: 10px;
}
.mark {
  width: 28px; height: 28px; border-radius: 7px;
  background: var(--bg-2); color: var(--ink-2);
  display: grid; place-items: center;
  font-family: var(--mono); font-size: 12px; font-weight: 600;
  letter-spacing: 0;
}
.col-meta { display: flex; flex-direction: column; min-width: 0; }
.agent { font-size: 13px; font-weight: 500; color: var(--ink); }
.path {
  font-family: var(--mono); font-size: 11px; color: var(--ink-4);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.status {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 3px 7px; border-radius: 999px;
  border: 1px dashed currentColor;
}
.status[data-status="stale"]  { color: #d8a85a; }
.status[data-status="forked"] { color: #d97a6c; }
.status[data-status="orphan"] { color: var(--ink-4); }

.col-pills {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.pill {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.02em;
  padding: 3px 8px; border-radius: 999px;
  background: var(--bg); color: var(--ink-3);
  border: 1px solid var(--line);
}
.pill.ver { color: var(--ink-2); }

.diff {
  margin: 0;
  background: rgba(0,0,0,0.18);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  font-family: var(--mono); font-size: 11.5px; line-height: 1.7;
  overflow: hidden;
}
.diff code { display: block; }
.line { display: block; white-space: pre; }
.line.ctx { color: var(--ink-3); }
.line.add { color: #5ad6c0; background: rgba(90, 214, 192, 0.06); }
.line.del { color: #d97a6c; background: rgba(217, 122, 108, 0.06); text-decoration: line-through; text-decoration-color: rgba(217, 122, 108, 0.4); }

.drift-resolve {
  margin-top: 36px;
  display: flex; flex-direction: column; align-items: stretch; gap: 0;
}
.resolve-line {
  width: 1px; height: 32px; background: var(--line);
  margin: 0 auto;
  position: relative;
}
.resolve-line::before, .resolve-line::after {
  content: ''; position: absolute; left: -28px; top: 50%;
  width: 28px; height: 1px; background: var(--line);
}
.resolve-line::after { left: auto; right: -28px; }

.resolve-card {
  border: 1px solid rgba(90, 214, 192, 0.3);
  border-radius: 14px;
  padding: 18px 22px;
  background: linear-gradient(180deg, rgba(90, 214, 192, 0.04), rgba(90, 214, 192, 0.01));
  display: flex; flex-direction: column; gap: 8px;
}
.resolve-label {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--accent);
}
.resolve-body {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  font-size: 14px;
}
.canonical {
  font-family: var(--mono); font-size: 13px; color: var(--ink);
}
.dot { color: var(--ink-4); }
.r-pill {
  font-family: var(--mono); font-size: 11px;
  padding: 3px 8px; border-radius: 999px;
  background: var(--bg); color: var(--ink-2);
  border: 1px solid var(--line);
}
.r-sig { color: var(--accent); border-color: rgba(90, 214, 192, 0.3); }
.r-render { color: var(--ink-2); }
.resolve-sub {
  font-size: 13.5px; color: var(--ink-3); line-height: 1.55;
  max-width: 720px;
}
.resolve-sub code {
  font-family: var(--mono); font-size: 11.5px;
  padding: 1px 5px; border-radius: 4px;
  background: var(--bg); color: var(--ink-2);
}

@media (max-width: 1080px) {
  .drift-grid { grid-template-columns: 1fr; }
  .head { flex-direction: column; align-items: flex-start; }
}

/* ---------- Convergence stage ---------- */
.convergence {
  position: relative;
  height: 320px;
  margin: 56px auto 8px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(ellipse at center, rgba(90, 214, 192, 0.045), transparent 60%),
    linear-gradient(180deg, rgba(90, 214, 192, 0.015), rgba(90, 214, 192, 0));
}
.conv-bg { position: absolute; inset: 0; pointer-events: none; }
.bg-line {
  position: absolute; left: 50%; top: 50%;
  width: 1px; height: 200%;
  background: linear-gradient(180deg, transparent, rgba(90, 214, 192, 0.12), transparent);
  transform-origin: center;
  opacity: 0.5;
}
.bg-l1 { transform: translate(-50%, -50%) rotate(20deg); }
.bg-l2 { transform: translate(-50%, -50%) rotate(-30deg); }
.bg-l3 { transform: translate(-50%, -50%) rotate(70deg); }

/* Drifting fragment chips */
.chip-fly {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.01em;
  color: var(--ink-3);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 10px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  animation: chip-fly var(--dur) cubic-bezier(0.55, 0.05, 0.25, 1) var(--delay) infinite;
  will-change: transform, opacity;
}
@keyframes chip-fly {
  0%   { transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) rotate(var(--rot)) scale(0.96); opacity: 0; }
  10%  { opacity: 0.9; }
  60%  { transform: translate(calc(-50% + var(--sx) * 0.35), calc(-50% + var(--sy) * 0.35)) rotate(calc(var(--rot) * 0.5)) scale(0.94); opacity: 0.9; }
  85%  { transform: translate(-50%, -50%) rotate(0deg) scale(0.5); opacity: 0.7; color: #5ad6c0; border-color: rgba(90, 214, 192, 0.45); }
  100% { transform: translate(-50%, -50%) rotate(0deg) scale(0.1); opacity: 0; }
}

/* Central vault */
.vault-svg {
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 24px rgba(90, 214, 192, 0.18));
}
.vault-glow { animation: glow-breathe 4.4s ease-in-out infinite; transform-origin: center; }
@keyframes glow-breathe {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}

/* Dial = closed lock — scales up + fades in with spring easing each cycle */
.vault-dial {
  transform-box: fill-box;
  transform-origin: center;
  animation: dial-close 4.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}
@keyframes dial-close {
  0%   { opacity: 0; transform: scale(0); }
  18%  { opacity: 0; transform: scale(0); }
  46%  { opacity: 1; transform: scale(1); }
  78%  { opacity: 1; transform: scale(1); }
  92%  { opacity: 0; transform: scale(0); }
  100% { opacity: 0; transform: scale(0); }
}

/* Open-state dashed interior — visible while the vault is unlocked, fades when dial closes */
.vault-open-hint {
  transform-origin: 100px 90px;
  animation: open-hint 4.4s ease-in-out infinite;
}
@keyframes open-hint {
  0%, 18%   { opacity: 0.3; }
  40%, 90%  { opacity: 0; }
  100%      { opacity: 0.3; }
}

/* Pulse ring that radiates out the moment the dial closes */
.lock-pulse {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: lock-pulse 4.4s ease-out infinite;
}
@keyframes lock-pulse {
  0%, 42%  { opacity: 0; transform: scale(1); }
  48%      { opacity: 0.7; transform: scale(1); }
  82%      { opacity: 0; transform: scale(2.4); }
  100%     { opacity: 0; transform: scale(2.4); }
}

.conv-caption {
  position: absolute;
  bottom: 18px; left: 50%;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 10.5px;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ink-4);
}
.cap-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px rgba(90, 214, 192, 0.6);
  animation: cap-blink 4.4s ease-in-out infinite;
}
@keyframes cap-blink {
  0%, 35%, 100% { opacity: 0.3; }
  45%, 75%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .chip-fly, .vault-dial, .vault-open-hint, .lock-pulse, .vault-glow, .cap-dot { animation: none; }
  .chip-fly { opacity: 0.6; transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) rotate(var(--rot)); }
  .vault-dial { opacity: 1; transform: scale(1); }
  .vault-open-hint { opacity: 0; }
}
</style>
