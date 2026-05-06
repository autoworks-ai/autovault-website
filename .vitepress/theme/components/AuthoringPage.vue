<template>
  <div class="docs-rich">
    <section class="docs-hero">
      <div class="eyebrow"><span class="dash" /> Authoring</div>
      <h1>Write skills that survive <span class="ital">the gate.</span></h1>
      <p class="lede">AutoVault skills are still markdown files. The difference is that metadata, transformations, permissions, and provenance are first-class, validated pieces of the artifact.</p>
    </section>

    <h2 id="anatomy-of-a-skill-md">Anatomy of a SKILL.md</h2>
    <p>Hover a block to see why AutoVault cares about it. The body remains human-readable markdown; the frontmatter gives the vault enough structure to validate and render the skill safely.</p>
    <div class="skill-viewer">
      <div class="skill-code">
        <div class="card-head"><span class="file">extract-pdf/SKILL.md</span><span class="verified"><UiIcon name="check" /> annotated</span></div>
        <pre>
<div v-for="(line, idx) in skillLines" :key="line.id" class="skill-line" :class="{ active: line.group === hovered }" @mouseenter="line.group && (hovered = line.group)"><span class="ln-num">{{ idx + 1 }}</span><span class="ln-text">{{ line.text || " " }}</span></div></pre>
      </div>
      <aside class="skill-explain">
        <div class="mono-label">{{ explanation.lines }}</div>
        <h3>{{ explanation.title }}</h3>
        <div class="card-p" v-html="explanation.body" />
      </aside>
    </div>

    <h2 id="validation-playground">Validation playground</h2>
    <p>The real gate runs deeper checks, but this playground shows the contract: structured metadata, canonical capabilities, permission declarations, and transformations get checked before anything is admitted.</p>
    <div class="playground">
      <div class="playground-head">
        <span class="tag-badge">local demo</span>
        <span style="font-weight: 500">Gate preflight</span>
        <button class="pill-btn primary" style="margin-left: auto" type="button" :disabled="running" @click="run">{{ running ? "Running..." : "Run checks" }}</button>
      </div>
      <div class="playground-grid">
        <div class="playground-input">
          <div class="card-head">SKILL.md · editable</div>
          <textarea v-model="src" spellcheck="false" />
        </div>
        <div class="playground-output">
          <div class="card-head">gate output</div>
          <div class="out-body">
            <template v-if="results">
              <div v-for="row in results" :key="row.name" class="check-row" :class="row.kind">
                <span class="check-icn">{{ row.kind === "pending" ? "…" : row.kind === "warn" ? "!" : "✓" }}</span>
                <span class="check-name">{{ row.name }}</span>
                <span class="check-detail">{{ row.detail }}</span>
              </div>
            </template>
            <span v-else class="muted">Run the preflight to see yaml-repair, denylist, capability, dedup, and sign checks.</span>
          </div>
        </div>
      </div>
    </div>

    <h2 id="transformation-manifest">Transformation manifest</h2>
    <p>Authors write against canonical capability names. AutoVault renders the skill for each caller at delivery time, so the author does not maintain platform forks.</p>
    <div class="man-grid">
      <div v-for="agent in manifestAgents" :key="agent.name" class="man-card">
        <div class="mono-label"><span class="swatch" :style="{ background: agent.color, display: 'inline-block', marginRight: '8px' }" />{{ agent.name }}</div>
        <div class="mono-block" style="padding:0">
          <div v-for="row in agent.rows" :key="row.from"><span class="muted">{{ row.from }}</span><span class="muted"> → </span><span class="arg">{{ row.to }}</span></div>
        </div>
      </div>
    </div>

    <h2 id="permissions">Permissions</h2>
    <div class="dodont">
      <div class="col do"><div class="mono-label arg">Do</div><ul><li>Declare exact canonical tools.</li><li>Declare network and filesystem scope.</li><li>Keep secrets as named references only.</li></ul></div>
      <div class="col dont"><div class="mono-label bad">Don't</div><ul><li>Hide shell access inside prose.</li><li>Embed credentials in frontmatter.</li><li>Ship a generic helper skill with broad powers.</li></ul></div>
    </div>

    <h2 id="publish-through-the-gate">Publish through the gate</h2>
    <div class="process-ribbon">
      <div v-for="(step, idx) in process" :key="step.title" class="step"><div class="num mono-label">{{ String(idx + 1).padStart(2, "0") }}</div><div style="font-weight:500">{{ step.title }}</div><div class="muted" style="font-size:12px">{{ step.sub }}</div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiIcon from "./UiIcon.vue";
import { transforms } from "../data/transforms";

type AnnotationGroup = "fm" | "id" | "tools" | "trans" | "perm" | "body";

const skillLines: Array<{ id: string; text: string; group: AnnotationGroup | null }> = [
  { id: "fm-open", text: "---", group: "fm" },
  { id: "fm-name", text: "name: extract-pdf", group: "id" },
  { id: "fm-version", text: "version: 1.4.0", group: "id" },
  { id: "fm-desc", text: 'description: "Extract structured text from PDF files."', group: "id" },
  { id: "fm-author", text: "author: autoworks-ai", group: "id" },
  { id: "fm-license", text: "license: Apache-2.0", group: "id" },
  { id: "blank-1", text: "", group: null },
  { id: "tools-key", text: "tools_required:", group: "tools" },
  { id: "t-1", text: "  - browser.fill_form", group: "tools" },
  { id: "t-2", text: "  - browser.click", group: "tools" },
  { id: "t-3", text: "  - fs.read", group: "tools" },
  { id: "t-4", text: "  - fs.write", group: "tools" },
  { id: "blank-2", text: "", group: null },
  { id: "trans-key", text: "transformations:", group: "trans" },
  { id: "tr-1", text: "  claude-code:", group: "trans" },
  { id: "tr-2", text: "    browser.fill_form: chrome-devtools", group: "trans" },
  { id: "tr-3", text: "    fs.read: read", group: "trans" },
  { id: "tr-4", text: "  codex:", group: "trans" },
  { id: "tr-5", text: "    browser.fill_form: browser_form", group: "trans" },
  { id: "tr-6", text: "    fs.read: file_read", group: "trans" },
  { id: "blank-3", text: "", group: null },
  { id: "perm-key", text: "permissions:", group: "perm" },
  { id: "perm-1", text: "  network: false", group: "perm" },
  { id: "perm-2", text: '  fs_scope: ["./inputs", "./outputs"]', group: "perm" },
  { id: "perm-3", text: "  egress: deny", group: "perm" },
  { id: "blank-4", text: "", group: null },
  { id: "fm-close", text: "---", group: "fm" },
  { id: "blank-5", text: "", group: null },
  { id: "h1", text: "# Extract PDF text", group: "body" },
  { id: "p1", text: "Use this skill when the user provides a PDF path", group: "body" },
  { id: "p2", text: "and asks for its text contents, structure, or", group: "body" },
  { id: "p3", text: "summarization. Returns markdown with preserved", group: "body" }
];

const explanations = {
  fm: { lines: "L1, L27", title: "YAML frontmatter delimiters", body: "Everything between <code>---</code> markers is structured metadata. Everything after is markdown the agent reads as instructions." },
  id: { lines: "L2-L6", title: "Identity block", body: "<code>name</code> and <code>version</code> form the lookup key. <code>author</code> participates in the provenance chain when the skill is signed." },
  tools: { lines: "L8-L12", title: "Canonical capabilities", body: "The skill declares stable capability names, independent of any one agent's tool vocabulary." },
  trans: { lines: "L14-L20", title: "Transformation manifest", body: "The vault maps canonical capabilities to caller-specific tool names at delivery time." },
  perm: { lines: "L22-L25", title: "Permission declaration", body: "The gate checks whether the requested permissions match the skill's observed behavior." },
  body: { lines: "L29-L32", title: "Instruction body", body: "Plain markdown stays plain. The agent gets concise instructions only when the skill is relevant." }
} as const;

const hovered = ref<AnnotationGroup>("trans");
const explanation = computed(() => explanations[hovered.value]);

const src = ref(`---
name: extract-pdf
version: 1.4.0
tools_required:
  - fs.read
  - fs.write
permissions:
  network: false
  fs_scope: ["./inputs", "./outputs"]
---
# Extract PDF text
Use this skill when the user provides a PDF path.`);

const running = ref(false);
const results = ref<Array<{ name: string; detail: string; kind: "ok" | "warn" | "pending" }> | null>(null);

function run() {
  running.value = true;
  results.value = [
    { name: "yaml-repair", detail: "queued", kind: "pending" },
    { name: "schema", detail: "queued", kind: "pending" },
    { name: "permissions", detail: "queued", kind: "pending" },
    { name: "dedup", detail: "queued", kind: "pending" },
    { name: "sign", detail: "queued", kind: "pending" }
  ];
  window.setTimeout(() => {
    results.value = [
      { name: "yaml-repair", detail: "frontmatter clean", kind: "ok" },
      { name: "schema", detail: "name/version/tools valid", kind: "ok" },
      { name: "permissions", detail: "fs_scope declared", kind: src.value.includes("fs_scope") ? "ok" : "warn" },
      { name: "dedup", detail: "no near match", kind: "ok" },
      { name: "sign", detail: "0x9af4…2c81", kind: "ok" }
    ];
    running.value = false;
  }, 700);
}

const manifestAgents = Object.entries(transforms).map(([name, config]) => ({ name, ...config }));
const process = [
  { title: "Proposed", sub: "source adapter" },
  { title: "Repaired", sub: "frontmatter clean" },
  { title: "Scanned", sub: "denylist + behavior" },
  { title: "Signed", sub: "ed25519 provenance" },
  { title: "Indexed", sub: "searchable · scopable" }
];
</script>
