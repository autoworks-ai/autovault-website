<template>
  <div class="docs-rich docs-final authoring-final">
    <section class="docs-hero au-hero au-final-hero">
      <AvDocBreadcrumb section="Authoring" page="Write a SKILL.md" />
      <div class="eyebrow"><span class="dash" /> Authoring · 12 min read</div>
      <h1>A skill is one file.<br><span class="ital">Frontmatter, body, that's it.</span></h1>
      <p class="lede">A SKILL.md is markdown with YAML frontmatter. AutoVault keeps the format plain, then validates the extra production fields it needs for capability mapping, permission signals, agent targeting, and signed delivery.</p>
      <div class="pillrow">
        <span class="pill">YAML frontmatter</span>
        <span class="pill">tools_required</span>
        <span class="pill">transformations</span>
        <span class="pill">permissions</span>
        <span class="pill">agents</span>
      </div>
    </section>

    <h2 id="anatomy">Hover a field to see what it does</h2>
    <p>The colored rows show how the validation gate reads a skill: identity first, then tool requirements, rendering transforms, permission signals, and the markdown body the agent actually follows.</p>
    <div class="skill-viewer final-skill-viewer">
      <div class="skill-code code-block">
        <div class="file-head code-tab">
          <span class="signed">● SIGNED</span>
          <span class="name">extract-pdf/SKILL.md</span>
          <span class="meta">production shape · v1.4.0</span>
        </div>
        <pre class="skill-code-body"><button
          v-for="(line, idx) in skillLines"
          :key="line.id"
          class="skill-line"
          :class="{ active: line.group === hovered }"
          :disabled="!line.group"
          type="button"
          @mouseenter="setAnnotation(line.group)"
          @focus="setAnnotation(line.group)"
          @click="setAnnotation(line.group)"
        ><span class="ln-num">{{ idx + 1 }}</span><span class="ln-text"><span v-for="(token, tokenIndex) in colorize(line.text)" :key="`${line.id}-${tokenIndex}`" :class="token.kind">{{ token.text }}</span></span></button></pre>
      </div>
      <aside class="skill-explain ann-side">
        <div class="ex-head"><span>Annotation</span><span class="lns">{{ explanation.lines }}</span></div>
        <h3>{{ explanation.title }}</h3>
        <div class="card-p" v-html="explanation.body" />
        <div class="ann-list" aria-label="Skill annotations">
          <button
            v-for="item in annotationRows"
            :key="item.id"
            class="ann-row"
            :class="{ active: hovered === item.id }"
            type="button"
            @mouseenter="hovered = item.id"
            @focus="hovered = item.id"
            @click="hovered = item.id"
          >
            <span class="ann-key">{{ item.label }}<span v-if="item.required" class="req">required</span></span>
            <span class="ann-body">{{ item.short }}</span>
          </button>
        </div>
      </aside>
    </div>

    <h2 id="schema">Frontmatter fields, in full</h2>
    <p>AutoVault does not need proprietary files beside SKILL.md. The fields below are the current production contract the gate and renderer understand.</p>
    <div class="schema final-schema" aria-label="SKILL.md frontmatter schema">
      <div class="schema-row head">
        <span>Field</span><span>Type</span><span>Required</span><span>Description</span>
      </div>
      <div v-for="row in schemaRows" :key="row.field" class="schema-row">
        <span class="f">{{ row.field }}</span>
        <span class="t">{{ row.type }}</span>
        <span><span class="badge" :class="row.required ? 'req' : 'no'">{{ row.required ? "yes" : "optional" }}</span></span>
        <span class="d">{{ row.description }}</span>
      </div>
    </div>

    <h2 id="manifest">The transformation manifest</h2>
    <p>Authors write against canonical capability names. Transform maps adapt those capabilities for each caller at render time, so one source skill can become Claude Code, Codex, Cursor, or AutoHub-specific output without forking upstream content.</p>
    <div class="man-grid">
      <div v-for="agent in manifestAgents" :key="agent.name" class="man-card">
        <div class="mono-label"><span class="swatch" :style="{ background: agent.color, display: 'inline-block', marginRight: '8px' }" />{{ agent.name }}</div>
        <div class="mono-block transform-map">
          <div v-for="row in agent.rows" :key="row.from"><span class="muted">{{ row.from }}</span><span class="muted"> -> </span><span class="arg">{{ row.to }}</span></div>
        </div>
      </div>
    </div>

    <h2 id="perms">Scope and permissions are separate</h2>
    <p>Permissions are signals declared inside the skill. Scope is the local policy that decides where that signed skill can load. Keep both narrow; the host agent still owns runtime enforcement.</p>
    <div class="scope-rows" aria-label="Example scope rows">
      <div v-for="row in scopeRows" :key="row.axis" class="scope-row">
        <span class="axis">{{ row.axis }}</span>
        <span class="vals">
          <span v-for="value in row.allowed" :key="value" class="v on">{{ value }}</span>
          <span v-for="value in row.blocked" :key="value" class="v off">{{ value }}</span>
        </span>
      </div>
    </div>
    <div class="dodont final-dodont">
      <div class="col do"><div class="mono-label arg">Do</div><ul><li>Declare exact canonical tools in <code>tools_required</code>.</li><li>Use <code>permissions</code> for network and filesystem expectations.</li><li>Use local scope policy to choose agents, projects, and profile links.</li></ul></div>
      <div class="col dont"><div class="mono-label bad">Don't</div><ul><li>Hide shell or browser access inside prose.</li><li>Embed credentials in frontmatter.</li><li>Ship broad helper skills when a narrow task skill will do.</li></ul></div>
    </div>

    <h2 id="playground">Try the gate yourself</h2>
    <p>This is the same five-step pipeline that runs on every skill admitted to a real vault, minus the actual signing step. Paste a SKILL.md, fetch a GitHub/raw URL, and run the browser gate to see what passes, warns, or fails.</p>
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
                  <span class="diag-marker">{{ line.issue ? (line.issue.severity === "fail" ? "x" : "!") : "" }}</span>
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
                <span class="check-icn">{{ row.kind === "pending" ? "..." : row.kind === "warn" ? "!" : row.kind === "fail" ? "x" : "✓" }}</span>
                <span class="check-name">{{ row.name }}</span>
                <span class="check-detail">{{ row.detail }}</span>
              </div>
              <div v-if="evaluation" class="install-preview" :class="{ blocked: !evaluation.passed }">
                <div class="mono-label">{{ evaluation.passed ? "Vault admission preview" : "Admission blocked" }}</div>
                <pre>{{ evaluation.installLines.join("\n") }}</pre>
              </div>
            </template>
            <span v-else class="muted">Run the gate to see yaml-repair, denylist, capability, dedup, transformation, and sign checks.</span>
          </div>
        </div>
      </div>
    </div>

    <h2 id="publish">Admission through the gate</h2>
    <p>Once the skill is clean locally, all write paths use the same validation and signing pipeline before generated agent profiles refresh.</p>
    <div class="process-ribbon">
      <div v-for="(step, idx) in process" :key="step.title" class="step"><div class="num mono-label">{{ String(idx + 1).padStart(2, "0") }}</div><div class="step-title">{{ step.title }}</div><div class="muted step-sub">{{ step.sub }}</div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AvDocBreadcrumb from "./AvDocBreadcrumb.vue";
import { transforms } from "../data/transforms";
import { evaluateSkillDocument, normalizeSkillUrl, type GateCheck, type GateEvaluation, type GateIssue } from "../utils/skillGate";

type AnnotationGroup = "fm" | "id" | "tools" | "agents" | "trans" | "perm" | "body";
type SkillLine = { id: string; text: string; group: AnnotationGroup | null };
type SchemaRow = { field: string; type: string; required: boolean; description: string };

const skillLines: SkillLine[] = [
  { id: "fm-open", text: "---", group: "fm" },
  { id: "fm-name", text: "name: extract-pdf", group: "id" },
  { id: "fm-version", text: "version: 1.4.0", group: "id" },
  { id: "fm-desc", text: 'description: "Extract structured text from PDF files."', group: "id" },
  { id: "fm-license", text: "license: MIT", group: "id" },
  { id: "blank-1", text: "", group: null },
  { id: "tools-key", text: "tools_required:", group: "tools" },
  { id: "t-1", text: "  - fs.read", group: "tools" },
  { id: "t-2", text: "  - fs.write", group: "tools" },
  { id: "blank-2", text: "", group: null },
  { id: "agents-key", text: "agents:", group: "agents" },
  { id: "agent-1", text: "  - claude-code", group: "agents" },
  { id: "agent-2", text: "  - codex", group: "agents" },
  { id: "blank-3", text: "", group: null },
  { id: "trans-key", text: "transformations:", group: "trans" },
  { id: "tr-1", text: "  claude-code:", group: "trans" },
  { id: "tr-2", text: "    fs.read: read", group: "trans" },
  { id: "tr-3", text: "    fs.write: write", group: "trans" },
  { id: "tr-4", text: "  codex:", group: "trans" },
  { id: "tr-5", text: "    fs.read: file_read", group: "trans" },
  { id: "tr-6", text: "    fs.write: file_write", group: "trans" },
  { id: "blank-4", text: "", group: null },
  { id: "perm-key", text: "permissions:", group: "perm" },
  { id: "perm-1", text: "  network: false", group: "perm" },
  { id: "perm-2", text: '  fs_scope: ["./inputs", "./outputs"]', group: "perm" },
  { id: "perm-3", text: "  egress: deny", group: "perm" },
  { id: "blank-5", text: "", group: null },
  { id: "fm-close", text: "---", group: "fm" },
  { id: "blank-6", text: "", group: null },
  { id: "h1", text: "# Extract PDF text", group: "body" },
  { id: "blank-7", text: "", group: null },
  { id: "p1", text: "Use this skill when the user provides a PDF path", group: "body" },
  { id: "p2", text: "and asks for its text contents, structure, or", group: "body" },
  { id: "p3", text: "summary. Return markdown with headings, lists,", group: "body" },
  { id: "p4", text: "and table layout preserved where possible.", group: "body" }
];

const explanations = {
  fm: { lines: "L1, L28", label: "frontmatter", short: "YAML boundary", required: true, title: "YAML frontmatter delimiters", body: "<p>The skill begins and ends its metadata block with <code>---</code>. Everything between is parsed as YAML; everything after is markdown instruction content.</p><p>The gate repairs common frontmatter mistakes before it performs the strict schema and security checks.</p>" },
  id: { lines: "L2-L5", label: "identity", short: "name, version, license", required: true, title: "Identity block", body: "<p><code>name</code> and <code>version</code> form the canonical lookup key. <code>description</code> is loaded during discovery, so it should stay direct and short.</p><p>Use kebab-case names and semver-like versions so updates can be compared cleanly.</p>" },
  tools: { lines: "L7-L9", label: "tools_required", short: "canonical capabilities", required: true, title: "Canonical tool requirements", body: "<p>The skill declares the capabilities it expects using AutoVault's stable names, not one agent's temporary tool vocabulary.</p><p>The capability/behavior check compares these declarations with the body and transform maps.</p>" },
  agents: { lines: "L11-L13", label: "agents", short: "target callers", required: false, title: "Target agents", body: "<p><code>agents</code> tells the renderer which callers this skill is prepared to support. Local scope policy can narrow this further by project, device, or profile link.</p>" },
  trans: { lines: "L15-L21", label: "transformations", short: "per-agent mapping", required: false, title: "Per-caller transformation", body: "<p>The transform map rewrites canonical capability names into each agent's native tool names at render time.</p><p>That keeps the source skill reviewable while still producing caller-specific output.</p>" },
  perm: { lines: "L23-L26", label: "permissions", short: "runtime expectations", required: false, title: "Permission boundaries", body: "<p>Permission fields are signals to the host agent about expected network, filesystem, and egress behavior.</p><p>AutoVault validates and surfaces them. The agent or runtime sandbox owns actual enforcement.</p>" },
  body: { lines: "L30-L35", label: "body", short: "agent instructions", required: true, title: "Skill body", body: "<p>The markdown body is what the agent reads when the skill is loaded. Keep it operational, specific, and short enough that discovery stays cheap.</p><p>Use packaged resources only when the body needs deeper reference material.</p>" }
} as const;

const hovered = ref<AnnotationGroup>("tools");
const explanation = computed(() => explanations[hovered.value]);
const annotationRows = Object.entries(explanations).map(([id, item]) => ({ id: id as AnnotationGroup, ...item }));

function setAnnotation(group: AnnotationGroup | null) {
  if (group) hovered.value = group;
}

const schemaRows: SchemaRow[] = [
  { field: "name", type: "string", required: true, description: "Canonical id. Use kebab-case and keep it stable across releases." },
  { field: "version", type: "semver-like", required: true, description: "Version used for update checks, drift reporting, and provenance records." },
  { field: "description", type: "string", required: true, description: "One concise sentence used during discovery and search." },
  { field: "license", type: "string", required: false, description: "License metadata. First-party examples currently use MIT." },
  { field: "tools_required", type: "string[]", required: true, description: "Canonical capability names the skill body expects to use." },
  { field: "transformations", type: "agent map", required: false, description: "Per-agent mapping from canonical capabilities to caller-specific tool names." },
  { field: "permissions", type: "object", required: false, description: "Network, filesystem, egress, and runtime expectation signals." },
  { field: "agents", type: "string[]", required: false, description: "Supported target agents before local scope narrows delivery." },
  { field: "resources", type: "file[]", required: false, description: "Packaged files loaded through get_skill with include_resources." }
];

const scopeRows = [
  { axis: "agents", allowed: ["claude-code", "codex"], blocked: ["cursor", "autohub"] },
  { axis: "project", allowed: ["autovault-website"], blocked: ["client-foo", "internal/*"] },
  { axis: "device", allowed: ["this host"], blocked: ["ci", "shared runner"] },
  { axis: "profile link", allowed: ["~/.codex/skills", "~/.claude/skills"], blocked: ["global fallback"] }
];

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
agents:
  - claude-code
  - codex
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
  { name: "vault admission simulation", detail: "queued", kind: "pending" }
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
agents:
  - claude-code
  - codex
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
  { title: "Indexed", sub: "searchable and scoped" }
];
</script>
