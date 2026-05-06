<template>
  <div class="docs-rich">
    <section class="docs-hero au-hero">
      <div class="breadcrumbs">
        <a href="/">Docs</a>
        <span class="sep">/</span>
        <span>Authoring</span>
        <span class="sep">/</span>
        <span>Anatomy of a SKILL.md</span>
      </div>
      <div class="eyebrow"><span class="dash" /> Authoring · 12 min read</div>
      <h1>Write one skill.<br><span class="ital">Run it everywhere.</span></h1>
      <p class="lede">Authoring an AutoVault skill is writing a single SKILL.md that declares <strong>what it does</strong>, <strong>what it needs</strong>, and <strong>how it should be rendered</strong> for each calling agent. The vault handles the rest — validation, signing, scoping, transformation.</p>
      <div class="pillrow">
        <span class="pill">YAML frontmatter</span>
        <span class="pill">Canonical capabilities</span>
        <span class="pill">Per-caller transform</span>
        <span class="pill">Permission boundaries</span>
      </div>
    </section>

    <h2 id="anatomy-of-a-skill-md">Anatomy of a SKILL.md</h2>
    <p>Hover a block to see why AutoVault cares about it. The body remains human-readable markdown; the frontmatter gives the vault enough structure to validate and render the skill safely.</p>
    <div class="skill-viewer">
      <div class="skill-code">
        <div class="file-head">
          <span class="signed">● SIGNED</span>
          <span class="name">extract-pdf/SKILL.md</span>
          <span class="meta">33 lines · ed25519</span>
        </div>
        <pre>
<div v-for="(line, idx) in skillLines" :key="line.id" class="skill-line" :class="{ active: line.group === hovered }" @mouseenter="line.group && (hovered = line.group)"><span class="ln-num">{{ idx + 1 }}</span><span class="ln-text"><span v-for="(token, tokenIndex) in colorize(line.text)" :key="`${line.id}-${tokenIndex}`" :class="token.kind">{{ token.text }}</span></span></div></pre>
      </div>
      <aside class="skill-explain">
        <div class="ex-head"><span>Explainer</span><span class="lns">{{ explanation.lines }}</span></div>
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
  { id: "p3", text: "summarization. Returns markdown with preserved", group: "body" },
  { id: "p4", text: "headings, lists, and table layout where possible.", group: "body" }
];

const explanations = {
  fm: { lines: "L1, L27", title: "YAML frontmatter delimiters", body: "<p>The skill begins and ends its frontmatter with <code>---</code>. Everything between is structured metadata; everything after is markdown the agent reads as instructions.</p><p>The validation gate parses this block first. <strong>YAML auto-repair</strong> handles common breakage before the strict schema check.</p>" },
  id: { lines: "L2-L6", title: "Identity block", body: "<p>These fields uniquely identify a skill in the vault. <code>name</code> and <code>version</code> form the lookup key; <code>author</code> participates in the provenance chain when the skill is signed.</p><p><strong>Naming:</strong> keep it verb-object and specific, like <code>extract-pdf</code> or <code>parse-csv</code>.</p>" },
  tools: { lines: "L8-L12", title: "Canonical tool requirements", body: "<p>The skill declares what it needs in <strong>canonical capability names</strong>, independent of any specific agent's vocabulary.</p><p>This is what the gate's capability/behavior check audits before a skill can be admitted.</p>" },
  trans: { lines: "L14-L20", title: "Per-caller transformation", body: "<p>The transformation manifest maps each canonical capability to the actual tool name the calling agent expects. Same skill, three rendered views — written once.</p><p>If a tool isn't mapped for a given agent, the skill renders without that capability and the gate emits a warning at scope-time.</p>" },
  perm: { lines: "L22-L25", title: "Permission boundaries", body: "<p>The skill declares its own runtime boundaries. <code>network: false</code> tells the host agent to refuse outbound HTTP from this skill's tool calls.</p><p>These are enforced by <em>the agent</em> at execution time, not by AutoVault.</p>" },
  body: { lines: "L29-L33", title: "Skill body", body: "<p>Plain markdown. This is what the agent reads and follows when the skill is loaded into context.</p><p><strong>Progressive disclosure:</strong> the full body is loaded only when the skill is relevant.</p>" }
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
type TokenKind = "head" | "k" | "s" | "v";

function colorize(text: string): Array<{ kind: TokenKind; text: string }> {
  if (!text) return [{ kind: "v", text: " " }];
  if (/^---$/.test(text) || /^#/.test(text)) return [{ kind: "head", text }];
  const yaml = text.match(/^(\s*)(-?\s*[\w_.]+:)(.*)$/);
  if (yaml) {
    return [
      { kind: "v", text: yaml[1] },
      { kind: "k", text: yaml[2] },
      { kind: "s", text: yaml[3] }
    ];
  }
  if (/^\s*-\s/.test(text)) return [{ kind: "s", text }];
  return [{ kind: "v", text }];
}

const process = [
  { title: "Proposed", sub: "source adapter" },
  { title: "Repaired", sub: "frontmatter clean" },
  { title: "Scanned", sub: "denylist + behavior" },
  { title: "Signed", sub: "ed25519 provenance" },
  { title: "Indexed", sub: "searchable · scopable" }
];
</script>
