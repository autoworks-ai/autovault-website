<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { copyText } from '../utils/clipboard'

const copied = ref(false)
async function copyInstall() {
  copied.value = await copyText('curl -fsSL https://autovault.sh | sh')
  window.setTimeout(() => (copied.value = false), 1400)
}

const TREE = [
  {
    id: 'extract-pdf',
    sig: '0x9af4…2c81',
    scopes: ['claude-code', 'codex'],
    ver: '1.4.0',
    intent: 'Extract tables and summary text from PDF reports.',
    path: '~/.autovault/skills/extract-pdf/SKILL.md',
    tools: ['fs.read', 'browser.fill_form', 'browser.click'],
    agents: [
      ['claude-code', 'read · chrome-devtools'],
      ['codex', 'file_read · browser_form'],
    ],
    frontmatter: [
      ['name', 'extract-pdf'],
      ['version', '1.4.0'],
      ['permissions', 'fs.read, browser'],
      ['scope', 'project:autovault-website'],
    ],
  },
  {
    id: 'parse-csv',
    sig: '0x3b71…f042',
    scopes: ['claude-code', 'codex', 'cursor'],
    ver: '0.7.2',
    intent: 'Normalize messy CSV exports before analysis.',
    path: '~/.autovault/skills/parse-csv/SKILL.md',
    tools: ['fs.read', 'fs.write'],
    agents: [
      ['claude-code', 'read · write'],
      ['codex', 'file_read · file_write'],
      ['cursor', 'fs_read · fs_write'],
    ],
    frontmatter: [
      ['name', 'parse-csv'],
      ['version', '0.7.2'],
      ['permissions', 'fs.read, fs.write'],
      ['scope', 'machine:laptop-jack'],
    ],
  },
  {
    id: 'summarize-thread',
    sig: '0xc108…ae2d',
    scopes: ['claude-code'],
    ver: '2.1.0',
    intent: 'Turn a Slack or Discord thread into decisions and next actions.',
    path: '~/.autovault/skills/summarize-thread/SKILL.md',
    tools: ['net.fetch', 'clipboard.write'],
    agents: [
      ['claude-code', 'web_fetch · clipboard'],
    ],
    frontmatter: [
      ['name', 'summarize-thread'],
      ['version', '2.1.0'],
      ['permissions', 'network, clipboard'],
      ['scope', 'agent:claude-code'],
    ],
  },
]
const selected = ref<string>('extract-pdf')
const userPinned = ref(false)
const readPulse = ref(0)
const current = computed(() => TREE.find(t => t.id === selected.value) ?? TREE[0])

let timer: number | undefined
function cycle() {
  if (userPinned.value) return
  const i = TREE.findIndex(t => t.id === selected.value)
  selected.value = TREE[(i + 1) % TREE.length].id
  readPulse.value += 1
}
onMounted(() => { timer = window.setInterval(cycle, 2200) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function selectSkill(id: string) {
  selected.value = id
  userPinned.value = true
  readPulse.value += 1
}

function previewSkill(id: string) {
  if (!userPinned.value) {
    selected.value = id
    readPulse.value += 1
  }
}

function resumeCycle() {
  userPinned.value = false
}
</script>

<template>
  <section class="av-section av-folder-hero" id="vault">
    <div class="av-folder-stage">
      <div class="av-folder-eyebrow">
        <span class="dot" />
        <span>The simple answer</span>
      </div>

      <h1 class="av-folder-title">
        It's a folder.<br />
        <span class="ital">That's the whole pitch.</span>
      </h1>

      <p class="av-folder-lede">
        AutoVault lives at <code>~/.autovault</code>. Your skills go in there.
        Every agent on your machine — Claude Code, Codex, Cursor, AutoHub —
        reads from the same folder. Sync it with Git. Sync it with Dropbox.
        Don't sync it. Your call.
      </p>

      <div class="av-folder-explorer">
        <div class="av-folder-tree-pane">
          <div class="av-folder-tree-head">
            <span class="dot live" />
            <span>~/.autovault</span>
            <span class="watching">watching · 142 skills · 4 agents</span>
          </div>
          <div class="av-folder-tree" role="tree" aria-label="AutoVault skills folder">
            <div><span class="path">~/.autovault/</span></div>
            <div>├── <span class="dir">skills/</span></div>
            <button
              v-for="(t, index) in TREE"
              :key="t.id"
              class="dir-row"
              :class="{ on: selected === t.id }"
              type="button"
              role="treeitem"
              :aria-selected="selected === t.id"
              @click="selectSkill(t.id)"
              @mouseenter="previewSkill(t.id)"
              @focus="previewSkill(t.id)"
            >
              <span class="tree-prefix">{{ index === TREE.length - 1 ? '│   └──' : '│   ├──' }}</span>
              <span class="dir">{{ t.id }}/</span>
              <span class="dim">SKILL.md · sig {{ t.sig }}</span>
              <span class="row-action">{{ selected === t.id ? 'reading' : 'inspect' }}</span>
            </button>
            <div>├── <span class="dir">signatures/</span></div>
            <div>│   └── <span class="file">trust.toml</span></div>
            <div>└── <span class="file">vault.toml</span></div>
          </div>
        </div>
        <div class="av-folder-side" :key="current.id + readPulse">
          <div class="side-eyebrow">read path →</div>
          <div class="side-card">
            <div class="side-head">
              <span class="side-name">{{ current.id }}</span>
              <span class="side-ver">v{{ current.ver }}</span>
            </div>
            <div class="read-rail">
              <span>open</span>
              <span>verify</span>
              <span>scope</span>
              <span>render</span>
            </div>
            <div class="side-row"><span class="lbl">path</span><span class="val">{{ current.path }}</span></div>
            <div class="side-row"><span class="lbl">intent</span><span class="val">{{ current.intent }}</span></div>
            <div class="side-row"><span class="lbl">sig</span><span class="val">{{ current.sig }}</span></div>
            <div class="side-row"><span class="lbl">scope</span>
              <span class="chips">
                <span v-for="s in current.scopes" :key="s" class="chip">{{ s }}</span>
              </span>
            </div>
            <div class="manifest-mini">
              <div v-for="[key, value] in current.frontmatter" :key="key">
                <span class="yaml-key">{{ key }}:</span>
                <span class="yaml-val">{{ value }}</span>
              </div>
            </div>
            <div class="agent-reads">
              <div v-for="[agent, tools] in current.agents" :key="agent" class="agent-read">
                <span>{{ agent }}</span>
                <span>{{ tools }}</span>
              </div>
            </div>
            <button v-if="userPinned" class="side-link" type="button" @click="resumeCycle">Resume live scan</button>
          </div>
        </div>
      </div>

      <div class="av-folder-cta">
        <div class="av-folder-cmd" @click="copyInstall">
          <span class="prompt">$</span>
          <span class="text">curl <span class="dim">-fsSL</span> https://autovault.sh <span class="dim">|</span> sh</span>
          <span class="copy">{{ copied ? '✓ copied' : 'click to copy' }}</span>
        </div>
        <div class="av-folder-secondary">
          <span class="dim">Or self-host the team mode →</span>
          <a class="link" href="/deploy">Deploy a remote vault</a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.av-folder-hero {
  padding: 140px 0 160px;
  border-top: 0;
}
.av-folder-stage {
  max-width: 960px;
  margin: 0 auto;
  text-align: left;
}

.av-folder-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-size: 11px;
  color: var(--accent); letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 36px;
}
.av-folder-eyebrow .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 12px var(--accent);
}

.av-folder-title {
  font-size: 76px;
  line-height: 1.0;
  letter-spacing: -0.04em;
  margin: 0;
  font-weight: 500;
}
.av-folder-title .ital {
  font-family: var(--serif); font-style: italic; font-weight: 400;
  color: var(--ink-2); letter-spacing: -0.02em;
}

.av-folder-lede {
  margin: 40px 0 0;
  color: var(--ink-2);
  font-size: 19px;
  line-height: 1.6;
  max-width: 620px;
}
.av-folder-lede code {
  font-family: var(--mono);
  font-size: 0.9em;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 7px;
  border-radius: 4px;
}

.av-folder-explorer {
  margin: 48px 0 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.9fr);
  gap: 16px;
  align-items: stretch;
}
.av-folder-tree-pane {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.av-folder-tree-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  font-family: var(--mono); font-size: 11px;
  color: var(--ink-3); letter-spacing: 0.04em;
}
.av-folder-tree-head .dot.live {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 8px var(--accent);
}
.av-folder-tree-head .watching { margin-left: auto; color: var(--ink-4); }

.av-folder-tree {
  margin: 0;
  padding: 20px 24px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.95;
  color: var(--ink-3);
  overflow-x: auto;
  white-space: nowrap;
}
.av-folder-tree .path { color: var(--accent); font-weight: 500; }
.av-folder-tree .dir  { color: var(--ink); }
.av-folder-tree .file { color: var(--ink-2); }
.av-folder-tree .dim  { color: var(--ink-4); font-size: 11.5px; }
.av-folder-tree .dir-row {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 420px;
  align-items: baseline;
  gap: 8px;
  cursor: pointer;
  border: 0;
  border-radius: 3px;
  background: none;
  color: inherit;
  padding: 0 6px;
  margin: 0 -6px;
  font: inherit;
  line-height: inherit;
  text-align: left;
  transition: background 160ms, color 160ms, transform 160ms;
}
.av-folder-tree .dir-row:hover,
.av-folder-tree .dir-row.on {
  background: rgba(90,214,192,0.08);
}
.av-folder-tree .dir-row:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}
.av-folder-tree .dir-row.on {
  transform: translateX(2px);
}
.av-folder-tree .dir-row.on::before {
  position: absolute;
  inset: 3px auto 3px -10px;
  width: 2px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 12px rgba(90, 214, 192, 0.8);
  content: "";
}
.av-folder-tree .dir-row.on .dir { color: var(--accent); }
.av-folder-tree .tree-prefix {
  color: var(--ink-3);
}
.av-folder-tree .row-action {
  margin-left: auto;
  color: var(--ink-4);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.av-folder-tree .dir-row.on .row-action {
  color: var(--accent);
}

.av-folder-side {
  display: flex; flex-direction: column; gap: 10px;
  padding: 20px 22px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 10px;
}
.side-eyebrow {
  font-family: var(--mono); font-size: 10.5px;
  color: var(--ink-3); letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 6px;
}
.side-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: folderReadIn 260ms var(--ease);
}
.side-head {
  display: flex; align-items: baseline; gap: 8px;
  padding-bottom: 10px; border-bottom: 1px solid var(--line);
}
.side-name { font-family: var(--mono); font-size: 14px; color: var(--ink); font-weight: 500; }
.side-ver  { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); margin-left: auto; }
.side-row {
  display: grid; grid-template-columns: 64px 1fr; gap: 10px;
  align-items: start;
  font-family: var(--mono); font-size: 11.5px;
}
.side-row .lbl { color: var(--ink-4); letter-spacing: 0.04em; text-transform: uppercase; font-size: 10px; padding-top: 2px; }
.side-row .val { color: var(--ink-2); }
.side-row .val { overflow-wrap: anywhere; }
.side-row .val.ok { color: var(--accent); }
.side-row .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.side-row .chip {
  font-size: 10.5px;
  color: var(--accent); background: var(--accent-soft);
  padding: 2px 8px; border-radius: 3px;
  letter-spacing: 0.02em;
}
.read-rail {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 2px 0 4px;
  color: var(--ink-4);
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.read-rail::before {
  position: absolute;
  top: 50%;
  left: 0;
  z-index: 0;
  width: 100%;
  height: 1px;
  background: var(--line-2);
  content: "";
}
.read-rail::after {
  position: absolute;
  top: 50%;
  left: 0;
  z-index: 1;
  width: 26%;
  height: 1px;
  background: var(--accent);
  box-shadow: 0 0 14px rgba(90, 214, 192, 0.45);
  content: "";
  animation: folderReadRail 1450ms var(--ease) both;
}
.read-rail span {
  position: relative;
  z-index: 2;
  justify-self: start;
  background: var(--panel);
  padding-right: 6px;
}
.manifest-mini {
  display: grid;
  gap: 3px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
}
.manifest-mini .yaml-key {
  color: var(--ink-3);
}
.manifest-mini .yaml-val {
  margin-left: 6px;
  color: var(--ink-2);
}
.agent-reads {
  display: grid;
  gap: 6px;
}
.agent-read {
  display: grid;
  grid-template-columns: minmax(92px, 0.8fr) 1fr;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--bg);
  padding: 7px 9px;
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 10.5px;
}
.agent-read span:first-child {
  color: var(--accent);
}
.side-link {
  align-self: flex-start;
  border: 1px solid var(--line-2);
  border-radius: 4px;
  background: var(--bg);
  color: var(--ink-2);
  padding: 5px 9px;
  font: 500 10.5px var(--mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.side-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@keyframes folderReadIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes folderReadRail {
  0% {
    width: 0;
    opacity: 0.35;
  }
  35% {
    opacity: 1;
  }
  100% {
    width: 100%;
    opacity: 0.9;
  }
}

@media (max-width: 720px) {
  .av-folder-explorer { grid-template-columns: 1fr; }
}

.av-folder-cta {
  margin-top: 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.av-folder-cmd {
  display: inline-flex; align-items: center; gap: 14px;
  background: var(--panel); border: 1px solid var(--line-2);
  padding: 16px 20px; border-radius: 8px;
  font-family: var(--mono); font-size: 14px;
  cursor: pointer;
  transition: border-color 160ms, background 160ms;
}
.av-folder-cmd:hover { border-color: var(--accent); background: var(--panel-2); }
.av-folder-cmd .prompt { color: var(--accent); }
.av-folder-cmd .text   { color: var(--ink); flex: 1; }
.av-folder-cmd .text .dim { color: var(--ink-3); }
.av-folder-cmd .copy   {
  font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ink-3);
}
.av-folder-cmd:hover .copy { color: var(--accent); }

.av-folder-secondary {
  display: flex; align-items: center; gap: 12px;
  font-family: var(--mono); font-size: 12px;
  color: var(--ink-3);
}
.av-folder-secondary .link { color: var(--ink-2); cursor: pointer; }
.av-folder-secondary .link:hover { color: var(--accent); }
.av-folder-secondary .dim { color: var(--ink-4); }

@media (max-width: 720px) {
  .av-folder-hero { padding: 80px 0 100px; }
  .av-folder-title { font-size: 52px; }
  .av-folder-tree { font-size: 12px; padding: 20px 18px; }
}
</style>
