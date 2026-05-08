<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { copyText } from '../utils/clipboard'

const copied = ref(false)
async function copyInstall() {
  copied.value = await copyText('curl -fsSL https://autovault.sh | sh')
  window.setTimeout(() => (copied.value = false), 1400)
}

// Hover-able skill rows in the folder tree. Each shows a side-card with sig + scope.
const TREE = [
  { id: 'extract-pdf',     sig: '0x9af4…2c81', scopes: ['claude-code', 'codex'],          ver: '1.4.0' },
  { id: 'parse-csv',       sig: '0x3b71…f042', scopes: ['claude-code', 'codex', 'cursor'], ver: '0.7.2' },
  { id: 'summarize-thread', sig: '0xc108…ae2d', scopes: ['claude-code'],                    ver: '2.1.0' },
]
const hover = ref<string>('extract-pdf')

// Auto-cycle when nothing hovered, stop while hovered.
let timer: number | undefined
const userHovering = ref(false)
function cycle() {
  if (userHovering.value) return
  const i = TREE.findIndex(t => t.id === hover.value)
  hover.value = TREE[(i + 1) % TREE.length].id
}
onMounted(() => { timer = window.setInterval(cycle, 2200) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function pin(id: string) { hover.value = id; userHovering.value = true }
function unpin() { userHovering.value = false }
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
          <pre class="av-folder-tree"><span class="path">~/.autovault/</span>
├── <span class="dir">skills/</span>
│   ├── <span class="dir-row" :class="{ on: hover === 'extract-pdf' }" @mouseenter="pin('extract-pdf')" @mouseleave="unpin"><span class="dir">extract-pdf/</span>  <span class="dim">SKILL.md  · sig 0x9af4…2c81</span></span>
│   ├── <span class="dir-row" :class="{ on: hover === 'parse-csv' }" @mouseenter="pin('parse-csv')" @mouseleave="unpin"><span class="dir">parse-csv/</span>  <span class="dim">SKILL.md  · sig 0x3b71…f042</span></span>
│   └── <span class="dir-row" :class="{ on: hover === 'summarize-thread' }" @mouseenter="pin('summarize-thread')" @mouseleave="unpin"><span class="dir">summarize-thread/</span>  <span class="dim">SKILL.md  · sig 0xc108…ae2d</span></span>
├── <span class="dir">signatures/</span>
│   └── <span class="file">trust.toml</span>
└── <span class="file">vault.toml</span></pre>
        </div>
        <div class="av-folder-side">
          <div class="side-eyebrow">scoped render →</div>
          <div v-for="t in TREE" :key="t.id" v-show="hover === t.id" class="side-card">
            <div class="side-head">
              <span class="side-name">{{ t.id }}</span>
              <span class="side-ver">v{{ t.ver }}</span>
            </div>
            <div class="side-row"><span class="lbl">sig</span><span class="val">{{ t.sig }}</span></div>
            <div class="side-row"><span class="lbl">scope</span>
              <span class="chips">
                <span v-for="s in t.scopes" :key="s" class="chip">{{ s }}</span>
              </span>
            </div>
            <div class="side-row"><span class="lbl">status</span><span class="val ok">● admitted</span></div>
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
  max-width: 720px;
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
  grid-template-columns: 1.4fr 1fr;
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
  white-space: pre;
}
.av-folder-tree .path { color: var(--accent); font-weight: 500; }
.av-folder-tree .dir  { color: var(--ink); }
.av-folder-tree .file { color: var(--ink-2); }
.av-folder-tree .dim  { color: var(--ink-4); font-size: 11.5px; }
.av-folder-tree .dir-row {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 6px;
  margin: 0 -6px;
  transition: background 160ms;
}
.av-folder-tree .dir-row:hover,
.av-folder-tree .dir-row.on {
  background: rgba(90,214,192,0.08);
}
.av-folder-tree .dir-row.on .dir { color: var(--accent); }

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
.side-card { display: flex; flex-direction: column; gap: 12px; }
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
.side-row .val.ok { color: var(--accent); }
.side-row .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.side-row .chip {
  font-size: 10.5px;
  color: var(--accent); background: var(--accent-soft);
  padding: 2px 8px; border-radius: 3px;
  letter-spacing: 0.02em;
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
