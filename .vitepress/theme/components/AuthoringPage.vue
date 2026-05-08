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
      <p class="lede">Authoring an AutoVault skill is writing a single SKILL.md that declares <strong>what it does</strong>, <strong>what it needs</strong>, and <strong>how it should be rendered</strong> for each calling agent. The vault handles the rest: validation, signing, scoping, resources, and transform overlays.</p>
      <div class="pillrow">
        <span class="pill">YAML frontmatter</span>
        <span class="pill">Canonical capabilities</span>
        <span class="pill">Per-caller transform</span>
        <span class="pill">Permission boundaries</span>
      </div>
    </section>

    <h2 id="anatomy">Anatomy of a SKILL.md</h2>
    <p>Hover any block in the file below to see what it does and why it's there. The colored bands show how the validation gate parses each section.</p>
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

    <h2 id="manifest">The transformation manifest</h2>
    <p>This is the part that distinguishes AutoVault from every other registry. The manifest is a flat dictionary keyed by agent identifier, mapping canonical capability names to whatever each agent calls them. Workspace-specific transforms let a vault adapt an upstream skill without forking it.</p>
    <div class="man-grid">
      <div v-for="agent in manifestAgents" :key="agent.name" class="man-card">
        <div class="mono-label"><span class="swatch" :style="{ background: agent.color, display: 'inline-block', marginRight: '8px' }" />{{ agent.name }}</div>
        <div class="mono-block" style="padding:0">
          <div v-for="row in agent.rows" :key="row.from"><span class="muted">{{ row.from }}</span><span class="muted"> → </span><span class="arg">{{ row.to }}</span></div>
        </div>
      </div>
    </div>
    <p>You don't have to map every agent. Unmapped agents fall through to the canonical name — which usually fails, which is intentional. Better to fail loudly with <code>tool browser.fill_form not found</code> than silently with a confused caller.</p>
    <p>If your team uses an agent we haven't mapped, just add it to the manifest. The renderer will use it as soon as the next scope refresh fires. Transform reviews show up during <code>check_updates</code> when the pinned base skill drifts.</p>

    <h2 id="perms">Permissions: declared vs. enforced</h2>
    <p>This trips up new authors, so it's worth being clear: AutoVault is a <strong>content provider</strong>, not an executor. The vault never runs your skill. Permissions you declare are <strong>signals to the host agent</strong> about what the skill expects to do.</p>
    <div class="dodont">
      <div class="col do"><div class="mono-label arg">Do</div><ul><li>Declare exact canonical tools.</li><li>Declare network and filesystem scope.</li><li>Keep secrets as named references only.</li></ul></div>
      <div class="col dont"><div class="mono-label bad">Don't</div><ul><li>Hide shell access inside prose.</li><li>Embed credentials in frontmatter.</li><li>Ship a generic helper skill with broad powers.</li></ul></div>
    </div>

    <h2 id="playground">Try the gate yourself</h2>
    <p>This is the same five-step pipeline that runs on every skill admitted to a real vault — minus the actual signing step (we don't have your private key). Paste a SKILL.md, fetch a GitHub/raw URL, and click <strong>Run gate</strong> to see what passes, what warns, and what fails.</p>
    <div class="playground" :data-ready="hydrated ? 'true' : 'false'">
      <div class="playground-head">
        <span class="tag-badge">browser gate</span>
        <span class="playground-title">Validate this SKILL.md</span>
        <button class="pill-btn" type="button" @click="loadSample">Sample</button>
        <button class="pill-btn primary" type="button" :disabled="running" @click="run">{{ running ? "Running..." : "Run gate" }}</button>
      </div>
      <div class="source-row">
        <label class="source-input">
          <span>Source URL</span>
          <input v-model="urlInput" type="url" placeholder="https://github.com/org/repo/blob/main/SKILL.md" @keydown.enter.prevent="fetchSource" />
        </label>
        <button class="pill-btn" type="button" :disabled="loadingSource" @click="fetchSource">{{ loadingSource ? "Fetching..." : "Fetch URL" }}</button>
      </div>
      <div class="playground-grid">
        <div class="playground-input">
          <div class="card-head editor-head">
            <span>SKILL.md · editable</span>
            <span class="diagnostic-badges" aria-live="polite">
              <span v-if="liveIssueCounts.fail" class="diag-badge fail">{{ liveIssueCounts.fail }} fail</span>
              <span v-if="liveIssueCounts.warn" class="diag-badge warn">{{ liveIssueCounts.warn }} warn</span>
              <span v-if="!liveIssues.length" class="diag-badge ok">live clean</span>
            </span>
          </div>
          <div v-if="liveIssues.length" class="diagnostic-summary" aria-live="polite">
            <span v-for="issue in visibleIssues" :key="`${issue.check}-${issue.lineStart}-${issue.message}`" class="diag-chip" :class="issue.severity">
              L{{ issue.lineStart }} · {{ issue.check }} · {{ issue.message }}
            </span>
            <span v-if="liveIssues.length > visibleIssues.length" class="diag-chip muted">+{{ liveIssues.length - visibleIssues.length }} more</span>
          </div>
          <div class="skill-editor">
            <div class="diagnostic-layer" aria-hidden="true">
              <div class="diagnostic-scroll" :style="{ transform: `translateY(-${editorScrollTop}px)` }">
                <div v-for="line in editorLineRows" :key="line.number" class="diag-line" :class="line.className" :title="line.issue?.message">
                  <span class="diag-marker">{{ line.issue ? (line.issue.severity === "fail" ? "×" : "!") : "" }}</span>
                  <span class="diag-num">{{ line.number }}</span>
                </div>
              </div>
            </div>
            <textarea v-model="src" spellcheck="false" wrap="off" aria-label="Editable SKILL.md source" @scroll="handleEditorScroll" />
          </div>
        </div>
        <div class="playground-output">
          <div class="card-head">gate output</div>
          <div class="out-body">
            <div v-if="sourceNotice" class="source-notice" :class="sourceNotice.kind">{{ sourceNotice.text }}</div>
            <template v-if="rows">
              <div v-for="row in results" :key="row.name" class="check-row" :class="row.kind">
                <span class="check-icn">{{ row.kind === "pending" ? "…" : row.kind === "warn" ? "!" : row.kind === "fail" ? "×" : "✓" }}</span>
                <span class="check-name">{{ row.name }}</span>
                <span class="check-detail">{{ row.detail }}</span>
              </div>
              <div v-if="evaluation" class="install-preview" :class="{ blocked: !evaluation.passed }">
                <div class="mono-label">{{ evaluation.passed ? "Hub install preview" : "Install blocked" }}</div>
                <pre>{{ evaluation.installLines.join("\n") }}</pre>
              </div>
            </template>
            <span v-else class="muted">Run the gate to see yaml-repair, denylist, capability, dedup, transformation, and sign checks.</span>
          </div>
        </div>
      </div>
    </div>

    <h2 id="publish">Publishing through the gate</h2>
    <p>Once your skill is happy locally, you have two paths to a shareable, validated artifact:</p>
    <div class="process-ribbon">
      <div v-for="(step, idx) in process" :key="step.title" class="step"><div class="num mono-label">{{ String(idx + 1).padStart(2, "0") }}</div><div style="font-weight:500">{{ step.title }}</div><div class="muted" style="font-size:12px">{{ step.sub }}</div></div>
    </div>
    <p>The other path uses <code>add_skill</code> for trusted remote sources or local bundles. Either way, the skill is signed against your vault's keypair before it is rendered into an agent profile, and packaged resources stay available through <code>get_skill</code> with <code>include_resources</code>.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import UiIcon from "./UiIcon.vue";
import { transforms } from "../data/transforms";
import { evaluateSkillDocument, normalizeSkillUrl, type GateCheck, type GateEvaluation, type GateIssue } from "../utils/skillGate";

type AnnotationGroup = "fm" | "id" | "tools" | "trans" | "perm" | "body";

const skillLines: Array<{ id: string; text: string; group: AnnotationGroup | null }> = [
  { id: "fm-open", text: "---", group: "fm" },
  { id: "fm-name", text: "name: extract-pdf", group: "id" },
  { id: "fm-version", text: "version: 1.4.0", group: "id" },
  { id: "fm-desc", text: 'description: "Extract structured text from PDF files."', group: "id" },
  { id: "fm-author", text: "author: autoworks-ai", group: "id" },
  { id: "fm-license", text: "license: MIT", group: "id" },
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
  { id: "blank-6", text: "", group: null },
  { id: "p1", text: "Use this skill when the user provides a PDF path", group: "body" },
  { id: "p2", text: "and asks for its text contents, structure, or", group: "body" },
  { id: "p3", text: "summarization. Returns markdown with preserved", group: "body" },
  { id: "p4", text: "headings, lists, and table layout where possible.", group: "body" }
];

const explanations = {
  fm: { lines: "L1, L27", title: "YAML frontmatter delimiters", body: "<p>The skill begins and ends its frontmatter with <code>---</code>. Everything between is structured metadata; everything after is markdown the agent reads as instructions.</p><p>The validation gate parses this block first. <strong>YAML auto-repair</strong> handles common breakage — trailing commas, mixed indentation, unquoted special chars — before the strict schema check.</p>" },
  id: { lines: "L2–L6", title: "Identity block", body: "<p>These six fields uniquely identify a skill in the vault. <code>name</code> + <code>version</code> together form the lookup key; <code>author</code> participates in the provenance chain when the skill is signed.</p><p><strong>Naming:</strong> kebab-case, scoped roughly to a verb-object (e.g. <code>extract-pdf</code>, <code>parse-csv</code>, <code>summarize-doc</code>). Avoid generic names like <code>tools</code> or <code>helpers</code> — the dedup gate flags them aggressively.</p>" },
  tools: { lines: "L8–L12", title: "Canonical tool requirements", body: "<p>The skill declares what it needs in <strong>canonical capability names</strong> — a stable namespace AutoVault maintains, independent of any specific agent's vocabulary.</p><p>This is the part the gate's capability/behavior check audits. If the skill body uses <code>fs.read</code> but never declares it here, or declares it but never uses it, the skill is rejected.</p>" },
  trans: { lines: "L14–L20", title: "Per-caller transformation", body: "<p>The transformation manifest maps each canonical capability to the actual tool name the calling agent expects. Same skill, three rendered views — written once.</p><p>If a tool isn't mapped for a given agent, the skill renders without that capability and the gate emits a warning at scope-time. Agents you haven't mapped fall through to the canonical name (which usually fails — that's the point).</p>" },
  perm: { lines: "L22–L25", title: "Permission boundaries", body: "<p>The skill declares its own runtime boundaries. <code>network: false</code> tells the host agent to refuse outbound HTTP from this skill's tool calls. <code>fs_scope</code> restricts filesystem access to specific path prefixes.</p><p>These are enforced by <em>the agent</em> at execution time, not by AutoVault. AutoVault is content provider, not executor — but it surfaces the declared boundary so callers know what they're admitting.</p>" },
  body: { lines: "L29–L33", title: "Skill body", body: "<p>Plain markdown. This is what the agent reads and follows when the skill is loaded into context. Keep it tight: under 200 tokens for a skill of this size, under 500 for anything bigger.</p><p><strong>Progressive disclosure:</strong> Agents can call <code>get_skill</code> with a query for discovery, load full content only when needed, and set <code>include_resources</code> when packaged files are required.</p>" }
} as const;

const hovered = ref<AnnotationGroup>("trans");
const explanation = computed(() => explanations[hovered.value]);

const src = ref(`---
name: weather
version: 0.1.0
description: "Get the weather"
tools_required:
  - http.fetch
transformations:
  claude-code:
    http.fetch: web_fetch
  codex:
    http.fetch: browser_request
permissions:
  network: true
  egress: allowlist
---

# Weather

Fetch the current weather for a location.`);

const running = ref(false);
const hydrated = ref(false);
const loadingSource = ref(false);
const urlInput = ref("");
const sourceLabel = ref("sample SKILL.md");
const sourceNotice = ref<{ kind: "ok" | "warn" | "fail"; text: string } | null>(null);
const pendingRows: GateCheck[] = [
  { name: "yaml-repair", detail: "queued", kind: "pending" },
  { name: "schema", detail: "queued", kind: "pending" },
  { name: "denylist", detail: "queued", kind: "pending" },
  { name: "capability/behavior", detail: "queued", kind: "pending" },
  { name: "hub install simulation", detail: "queued", kind: "pending" }
];
const evaluation = ref<GateEvaluation | null>(null);
const results = computed(() => (running.value ? pendingRows : evaluation.value?.checks ?? null));
const rows = computed(() => !!results.value);
const liveEvaluation = computed(() => evaluateSkillDocument(src.value, sourceLabel.value));
const liveIssues = computed(() => liveEvaluation.value.issues);
const visibleIssues = computed(() => liveIssues.value.slice(0, 4));
const liveIssueCounts = computed(() => ({
  fail: liveIssues.value.filter((issue) => issue.severity === "fail").length,
  warn: liveIssues.value.filter((issue) => issue.severity === "warn").length
}));
const editorScrollTop = ref(0);
const editorLineRows = computed(() =>
  src.value.split("\n").map((_, index) => {
    const number = index + 1;
    const issue = issueForLine(number, liveIssues.value);
    return {
      number,
      issue,
      className: issue ? `has-${issue.severity}` : ""
    };
  })
);

function run() {
  running.value = true;
  window.setTimeout(() => {
    evaluation.value = evaluateSkillDocument(src.value, sourceLabel.value);
    running.value = false;
  }, 700);
}

function loadSample() {
  sourceLabel.value = "sample SKILL.md";
  urlInput.value = "";
  sourceNotice.value = { kind: "ok", text: "Loaded the bundled Weather sample." };
  src.value = `---
name: weather
version: 0.1.0
description: "Get the weather"
tools_required:
  - http.fetch
transformations:
  claude-code:
    http.fetch: web_fetch
  codex:
    http.fetch: browser_request
permissions:
  network: true
  egress: allowlist
---

# Weather

Fetch the current weather for a location.`;
}

function issueForLine(lineNumber: number, issues: GateIssue[]): GateIssue | null {
  const matches = issues.filter((issue) => lineNumber >= issue.lineStart && lineNumber <= issue.lineEnd);
  return matches.sort((a, b) => issueSeverityScore(b) - issueSeverityScore(a))[0] ?? null;
}

function issueSeverityScore(issue: GateIssue): number {
  return issue.severity === "fail" ? 2 : 1;
}

function handleEditorScroll(event: Event) {
  editorScrollTop.value = (event.target as HTMLTextAreaElement).scrollTop;
}

async function fetchSource() {
  const url = normalizeSkillUrl(urlInput.value);
  if (!url) {
    sourceNotice.value = { kind: "fail", text: "Enter a valid GitHub, raw, or CORS-enabled SKILL.md URL." };
    return;
  }

  loadingSource.value = true;
  sourceNotice.value = null;
  try {
    const response = await fetch(url, { headers: { Accept: "text/plain,*/*" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text.includes("---")) throw new Error("No frontmatter delimiter found");
    src.value = text;
    urlInput.value = url;
    sourceLabel.value = url;
    sourceNotice.value = { kind: "ok", text: `Fetched ${new URL(url).hostname}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    sourceNotice.value = { kind: "fail", text: `${message}. If the host blocks browser fetches, paste the SKILL.md contents instead.` };
  } finally {
    loadingSource.value = false;
  }
}

watch(src, () => {
  evaluation.value = null;
});

onMounted(() => {
  hydrated.value = true;
});

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
