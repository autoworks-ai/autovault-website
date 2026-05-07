<template>
  <div class="sd-page reveal-page">
    <nav class="sd-crumb reveal-item" aria-label="Breadcrumb">
      <a href="/skills-directory.html">Skills</a>
      <span class="sep">/</span>
      <a href="/author-autoworks-ai.html">autoworks-ai</a>
      <span class="sep">/</span>
      <span class="cur">extract-pdf</span>
    </nav>

    <header class="sd-head reveal-item">
      <div>
        <div class="ttl-row">
          <div class="icon-tile">PD</div>
          <div>
            <h1><span class="org">autoworks-ai / </span>extract-pdf</h1>
            <div class="sub-row">
              <span class="verified"><UiIcon name="check" /> Signed</span>
              <span>v1.4.0</span><span class="dot" />
              <span>Apache-2.0</span><span class="dot" />
              <span>2,847 bytes</span><span class="dot" />
              <span>updated 2d ago</span><span class="dot" />
              <span>maintained by 2 contributors</span>
            </div>
          </div>
        </div>
        <p class="desc">Extract structured text from PDF files while preserving heading hierarchy, list structure, and table layout where possible. Wraps a local parsing library — never reaches the network. Pairs naturally with <a href="/skill-detail.html">ocr-image</a> for scanned documents and <a href="/skill-detail.html">extract-table</a> for structured data.</p>
      </div>
      <div class="actions">
        <button class="sd-installbtn" type="button" @click="copyInstall">Install in your vault <UiIcon name="arrow" /></button>
        <div class="sd-install">
          <div class="lbl">Or via CLI</div>
          <div class="cmd">
            <span class="pmt">$</span>
            <span>autovault add extract-pdf</span>
            <button class="copy" type="button" @click="copyInstall">{{ copied ? "Copied" : "Copy" }}</button>
          </div>
        </div>
        <div class="sd-secondary-actions">
          <a class="sd-sbtn" href="https://github.com/autoworks-ai/autovault"><UiIcon name="github" /> Source</a>
          <button class="sd-sbtn" type="button" @click="tab = 'prov'"><UiIcon name="shield" /> Verify</button>
        </div>
      </div>
    </header>

    <section class="sd-stats reveal-item" aria-label="Skill statistics">
      <div v-for="stat in stats" :key="stat.label" class="st">
        <div class="lbl">{{ stat.label }}</div>
        <div class="val" v-html="stat.value" />
        <div :class="['trend', stat.muted ? 'muted' : '']">{{ stat.trend }}</div>
      </div>
    </section>

    <nav class="sd-tabs reveal-item" aria-label="Skill detail tabs">
      <button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">
        {{ item.label }} <span v-if="item.count" class="ct">{{ item.count }}</span>
      </button>
    </nav>

    <div class="sd-body reveal-item">
      <main>
        <section v-if="tab === 'overview'">
          <div class="sd-md">
            <div class="sd-md-head">
              <span class="lights"><span /><span /><span /></span>
              <span class="filename">SKILL.md</span>
              <a class="raw" href="https://github.com/autoworks-ai/autovault">view raw →</a>
            </div>
            <div class="sd-md-body">
              <div class="sd-frontmatter">
                <div v-for="line in frontmatterLines" :key="line" v-html="line" />
              </div>
              <h1># Extract PDF</h1>
              <p>Extract structured text from PDF files while preserving heading hierarchy, list structure, and table layout where possible. Wraps a local pdf-parsing library — never sends bytes off-device.</p>
              <h2>## When to use this skill</h2>
              <p>Reach for <code>extract-pdf</code> when the user asks you to read, summarize, or extract content from a PDF file. Don't use this skill for structured data extraction — pair with <code>extract-table</code> downstream for that.</p>
              <h2>## Inputs</h2>
              <ul>
                <li>A path to a .pdf file under the user's working directory</li>
                <li>Optional: <code>--format=json</code> to emit structured output</li>
                <li>Optional: <code>--pages=1-5</code> to scope extraction to a page range</li>
              </ul>
              <h2>## Outputs</h2>
              <ul>
                <li>Plain text by default. Headings preserved as <code>#</code> markers, lists as <code>-</code> bullets</li>
                <li>JSON when <code>--format=json</code> — includes pages, headings, paragraphs, and tables</li>
              </ul>
              <h2>## Examples</h2>
              <h3>Basic extraction</h3>
              <p>User: <em>"What's in spec-v2.pdf?"</em> → run <code>extract-pdf ./spec-v2.pdf</code>, then summarize the result.</p>
              <h3>Page range</h3>
              <p>User: <em>"Read the first chapter of book.pdf"</em> → estimate page range from the table of contents, run <code>extract-pdf ./book.pdf --pages=1-22</code>.</p>
              <h2>## Caveats</h2>
              <ul>
                <li>Scanned PDFs without an embedded text layer return empty. Pair with <code>ocr-image</code> for image-based PDFs.</li>
                <li>Tables in irregular layouts may extract as flat text.</li>
                <li>Encrypted PDFs require the password as a third positional argument.</li>
              </ul>
            </div>
          </div>
          <div class="sd-related-wrap">
            <div class="mono-label">Related skills</div>
            <div class="sd-related">
              <a v-for="skill in relatedSkills" :key="skill.name" class="sd-rel-tile" href="/skill-detail.html">
                <div class="name">{{ skill.name }}</div>
                <div class="desc">{{ skill.desc }}</div>
              </a>
            </div>
          </div>
        </section>

        <section v-else-if="tab === 'transform'">
          <p class="sd-intro">This skill ships with three transformations — one per supported agent. The vault renders them at install time, so each caller receives only the format and idiom it actually understands.</p>
          <div class="sd-xform-toolbar">
            <span class="lbl">Render for</span>
            <div class="sd-target-pills">
              <button v-for="targetOption in targets" :key="targetOption.id" type="button" :class="{ active: target === targetOption.id }" @click="target = targetOption.id">
                <span class="sw" :style="{ background: targetOption.color }" />
                {{ targetOption.label }}
              </button>
            </div>
            <span class="spacer" />
            <span class="diff-count">{{ activeTarget.added }} added · {{ activeTarget.removed }} removed</span>
          </div>
          <div class="sd-diff">
            <div class="sd-diff-pane">
              <div class="head"><span class="ttl">SKILL.md (canonical)</span><span class="meta">v1.4.0</span></div>
              <div class="body">
                <div v-for="(line, index) in canonicalLines" :key="index" class="ln"><span class="gut">{{ index + 1 }}</span><span class="text">{{ line }}</span></div>
              </div>
            </div>
            <div class="sd-diff-pane">
              <div class="head"><span class="ttl">{{ activeTarget.file }}</span><span class="meta" :style="{ color: activeTarget.color }">● {{ activeTarget.label }}</span></div>
              <div class="body">
                <div v-for="(line, index) in transformLines[target]" :key="index" :class="['ln', line.kind]">
                  <span class="gut">{{ index + 1 }}</span><span class="text">{{ line.text }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="sd-xform-summary">
            <span class="ch">format: {{ target === "cu" ? "rules" : "markdown" }}</span>
            <span class="ch">trigger style: {{ target === "cx" ? "WHEN/DO/THEN" : "natural" }}</span>
            <span class="ch">permissions: {{ target === "cu" ? "elided" : "explicit" }}</span>
            <span class="ch">examples: {{ target === "cu" ? "inline" : "section" }}</span>
          </div>
        </section>

        <section v-else-if="tab === 'perms'">
          <p class="sd-intro">This skill's declared capabilities, by axis. The gate verified that the implementation matches what's declared here — no over-claim, no hidden behavior.</p>
          <div class="sd-perm-grid">
            <div v-for="group in permissionGroups" :key="group.title" class="sd-card">
              <h4>{{ group.title }}</h4>
              <div v-for="row in group.rows" :key="row.label" class="sd-perm-row">
                <span :class="['ico', row.kind]"><UiIcon :name="row.kind === 'no' ? 'x' : row.kind === 'warn' ? 'tip' : 'check'" /></span>
                <span>{{ row.label }}</span>
                <span class="scope">{{ row.scope }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="tab === 'prov'" class="sd-prov-timeline">
          <div v-for="row in provenance" :key="row.title" class="sd-prov-row">
            <div :class="['pip', row.ok ? 'ok' : '']"><UiIcon :name="row.icon" /></div>
            <div class="pcontent">
              <div class="ttl">{{ row.title }}</div>
              <div class="det" v-html="row.detail" />
            </div>
            <div class="when">{{ row.when }}</div>
          </div>
        </section>

        <section v-else class="sd-versions-table">
          <div class="sd-versions-row head"><span>Version</span><span>Notes</span><span>Date</span><span>Gate</span><span>Installs</span></div>
          <div v-for="version in versions" :key="version.version" class="sd-versions-row">
            <span class="ver">{{ version.version }}<span v-if="version.latest" class="latest">latest</span></span>
            <span class="notes">{{ version.notes }}</span>
            <span class="date">{{ version.date }}</span>
            <span class="gate">5/5 ✓</span>
            <span class="install">{{ version.installs }}</span>
          </div>
        </section>
      </main>

      <aside class="sd-rail">
        <div class="sd-card">
          <h4>Compatibility</h4>
          <div class="sd-agent-list">
            <div v-for="agent in agents" :key="agent.id" class="sd-agent-row">
              <span class="swatch" :style="{ background: agent.color }" />
              <span class="lbl">{{ agent.label }}</span>
              <span class="stat">✓ tested</span>
            </div>
          </div>
        </div>
        <div class="sd-card">
          <h4>Metadata</h4>
          <div class="kv">
            <template v-for="item in metadata" :key="item.key">
              <span class="k">{{ item.key }}</span>
              <span :class="['v', item.mono ? 'mono' : '', item.accent ? 'accent' : '']">{{ item.value }}</span>
            </template>
          </div>
        </div>
        <div class="sd-card">
          <h4>Permission summary</h4>
          <div v-for="row in summaryPermissions" :key="row.label" class="sd-perm-row">
            <span :class="['ico', row.kind]"><UiIcon :name="row.kind === 'no' ? 'x' : 'check'" /></span>
            <span>{{ row.label }}</span>
            <span class="scope">{{ row.scope }}</span>
          </div>
          <button class="sd-link-btn" type="button" @click="tab = 'perms'">View full breakdown →</button>
        </div>
        <div class="sd-card">
          <h4>Maintainers</h4>
          <div class="sd-maintainers">
            <div v-for="maintainer in maintainers" :key="maintainer.name" class="sd-maintainer">
              <div class="avatar" :style="{ background: maintainer.bg }" />
              <div><div class="name">{{ maintainer.name }}</div><div class="meta">{{ maintainer.meta }}</div></div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiIcon from "./UiIcon.vue";

type TabId = "overview" | "transform" | "perms" | "prov" | "versions";
type TargetId = "cc" | "cx" | "cu";

const tab = ref<TabId>("overview");
const target = ref<TargetId>("cc");
const copied = ref(false);

const tabs = [
  { id: "overview" as const, label: "Overview" },
  { id: "transform" as const, label: "Transformations", count: 3 },
  { id: "perms" as const, label: "Permissions" },
  { id: "prov" as const, label: "Provenance" },
  { id: "versions" as const, label: "Versions", count: 12 }
];

const stats = [
  { label: "Installs", value: "2,840", trend: "+312 this week" },
  { label: "Active vaults", value: "1,920", trend: "+204 this week" },
  { label: "Gate runs", value: "12", trend: "all passed" },
  { label: "Issues open", value: "3<span class=\"unit\">/ 47 closed</span>", trend: "median 2d", muted: true },
  { label: "Compatibility", value: "4<span class=\"unit\">/ 4 agents</span>", trend: "universal" }
];

const agents = [
  { id: "cc", label: "Claude Code", color: "#d6a85a" },
  { id: "cx", label: "Codex", color: "#5a9dd6" },
  { id: "cu", label: "Cursor", color: "#b48ad6" },
  { id: "ah", label: "AutoHub", color: "#5ad6c0" }
];

const targets = [
  { id: "cc" as const, label: "Claude Code", color: "#d6a85a", added: 4, removed: 2, file: "CLAUDE.md" },
  { id: "cx" as const, label: "Codex", color: "#5a9dd6", added: 6, removed: 1, file: "AGENTS.md" },
  { id: "cu" as const, label: "Cursor", color: "#b48ad6", added: 3, removed: 4, file: ".cursorrules" }
];
const activeTarget = computed(() => targets.find((item) => item.id === target.value) ?? targets[0]);

const frontmatterLines = [
  "<span class=\"marker\">---</span>",
  "<span class=\"key\">name</span>: <span class=\"str\">extract-pdf</span>",
  "<span class=\"key\">version</span>: <span class=\"str\">1.4.0</span>",
  "<span class=\"key\">description</span>: <span class=\"str\">Extract structured text from PDF files. Preserves headings, lists, tables.</span>",
  "<span class=\"key\">author</span>: <span class=\"str\">autoworks-ai</span>",
  "<span class=\"key\">license</span>: <span class=\"str\">Apache-2.0</span>",
  "<span class=\"key\">tools_required</span>:",
  "  - <span class=\"str\">read</span>     <span class=\"com\"># reads .pdf bytes from disk</span>",
  "  - <span class=\"str\">write</span>    <span class=\"com\"># writes .txt or .json sidecar</span>",
  "<span class=\"key\">network</span>: <span class=\"str\">none</span>",
  "<span class=\"key\">scope</span>:",
  "  <span class=\"key\">paths</span>: [<span class=\"str\">\"./*.pdf\"</span>, <span class=\"str\">\"./docs/**/*.pdf\"</span>]",
  "<span class=\"key\">transformations</span>:",
  "  <span class=\"key\">claude-code</span>: <span class=\"str\">CLAUDE.md</span>",
  "  <span class=\"key\">codex</span>:       <span class=\"str\">AGENTS.md</span>",
  "  <span class=\"key\">cursor</span>:      <span class=\"str\">.cursorrules</span>",
  "<span class=\"marker\">---</span>"
];

const canonicalLines = [
  "## Skill: extract-pdf",
  "",
  "When the user mentions a PDF, run this skill.",
  "",
  "### Inputs",
  "- path to .pdf file",
  "- optional --format=json",
  "- optional --pages=N-M",
  "",
  "### Permissions",
  "- read, write",
  "- network: none",
  "",
  "### Pairs with",
  "- ocr-image (scanned PDFs)",
  "- extract-table (structured data)"
];

const transformLines: Record<TargetId, Array<{ kind?: "add" | "del"; text: string }>> = {
  cc: [
    { text: "## Skill: extract-pdf" },
    { text: "" },
    { text: "When the user asks about a PDF file, use the extract-pdf skill." },
    { kind: "add", text: "- \"read this PDF\"" },
    { kind: "add", text: "- \"what's in <file>.pdf\"" },
    { kind: "add", text: "- \"summarize <file>.pdf\"" },
    { text: "Call: extract-pdf <path> [--format=json] [--pages=N-M]" },
    { kind: "del", text: "- requires `read`, `write`, `network`" },
    { kind: "add", text: "- requires `read`, `write` (no network)" },
    { text: "- pair with `ocr-image` for scanned PDFs" }
  ],
  cx: [
    { text: "## extract-pdf" },
    { text: "" },
    { text: "Codex behavioral rule for PDF extraction." },
    { kind: "add", text: "WHEN: user mentions a .pdf file" },
    { kind: "add", text: "DO: run extract-pdf with the resolved path" },
    { kind: "add", text: "THEN: summarize or quote based on user intent" },
    { kind: "add", text: "ALLOWED-TOOLS: read, write" },
    { kind: "add", text: "FORBIDDEN-TOOLS: network, exec" },
    { text: "FALLBACK: if PDF is scanned, hand off to ocr-image." },
    { kind: "del", text: "PERMISSIONS: see frontmatter" },
    { kind: "add", text: "PERMISSIONS: read+write under user cwd only" }
  ],
  cu: [
    { text: "# Cursor rule: extract-pdf" },
    { text: "" },
    { kind: "add", text: "When you need PDF content, invoke extract-pdf." },
    { kind: "del", text: "Always extract the entire PDF for full context." },
    { kind: "del", text: "Use --format=json by default." },
    { kind: "del", text: "Run network probes if extraction fails." },
    { text: "" },
    { kind: "add", text: "Examples:" },
    { kind: "add", text: "  extract-pdf ./spec.pdf" },
    { kind: "add", text: "  extract-pdf ./book.pdf --pages=1-22" }
  ]
};

const relatedSkills = [
  { name: "autoworks-ai/ocr-image", desc: "OCR a scanned image to text. Use after extract-pdf returns empty." },
  { name: "autoworks-ai/extract-table", desc: "Pull structured tables from extracted PDF text into normalized rows." },
  { name: "autoworks-ai/summarize-doc", desc: "Recursive multi-pass summarization for long documents." }
];

const permissionGroups = [
  { title: "File system", rows: [
    { kind: "ok", label: "read .pdf files", scope: "./*.pdf, ./docs/**" },
    { kind: "ok", label: "write .txt sidecar", scope: "same dir as input" },
    { kind: "no", label: "read other paths", scope: "denied" },
    { kind: "no", label: "delete files", scope: "denied" }
  ] },
  { title: "Network", rows: [
    { kind: "no", label: "outbound HTTP", scope: "none" },
    { kind: "no", label: "DNS lookup", scope: "none" },
    { kind: "no", label: "local socket", scope: "none" }
  ] },
  { title: "Tool calls", rows: [
    { kind: "ok", label: "read", scope: "scoped paths only" },
    { kind: "ok", label: "write", scope: "scoped paths only" },
    { kind: "no", label: "exec / shell", scope: "denied" },
    { kind: "no", label: "fetch", scope: "denied" }
  ] },
  { title: "Activation", rows: [
    { kind: "ok", label: "auto-load", scope: "in-context" },
    { kind: "warn", label: "user approval per call", scope: "not required" }
  ] }
];

const provenance = [
  { icon: "check" as const, ok: true, title: "Authored & signed by @autoworks-ai", detail: "commit f4e02c1 · key: 0x9af4…2c81 · 2,847 bytes", when: "2026-04-28 12:14Z" },
  { icon: "check" as const, ok: true, title: "Gate run · v0.4.1 · all 5 stages passed", detail: "repair: 0 fixes · denylist: clean · capabilities: aligned · dedup: unique · sign: ed25519", when: "2026-04-28 12:18Z" },
  { icon: "shield" as const, ok: true, title: "Vault counter-signature", detail: "vault.autoworks-ai · key: vault-2026-04 · isnad link 02", when: "2026-04-28 14:21Z" },
  { icon: "check" as const, ok: true, title: "Published to public mirror", detail: "cdn.autovault.dev · 3 regional replicas synced", when: "2026-04-28 14:22Z" },
  { icon: "lock" as const, title: "Available for install", detail: "verify locally with <code>autovault verify autoworks-ai/extract-pdf@1.4.0</code>", when: "on demand" }
];

const versions = [
  { version: "1.4.0", latest: true, notes: "Add --pages range support; fix table extraction on rotated layouts", date: "2026-04-28", installs: "2.8k" },
  { version: "1.3.2", notes: "Patch: handle malformed cross-reference tables", date: "2026-04-12", installs: "1.4k" },
  { version: "1.3.1", notes: "Patch: heading detection regression on 3-column layouts", date: "2026-04-02", installs: "892" },
  { version: "1.3.0", notes: "Add JSON output format; structured headings/paragraphs/tables", date: "2026-03-19", installs: "1.1k" },
  { version: "1.2.0", notes: "Heading hierarchy preserved as # markers", date: "2026-02-21", installs: "640" },
  { version: "1.1.0", notes: "List structure preservation", date: "2026-01-30", installs: "412" },
  { version: "1.0.0", notes: "Initial public release", date: "2026-01-08", installs: "201" }
];

const metadata = [
  { key: "version", value: "1.4.0", mono: true },
  { key: "size", value: "2,847 B", mono: true },
  { key: "license", value: "Apache-2.0" },
  { key: "author", value: "autoworks-ai", accent: true },
  { key: "signed", value: "ed25519", mono: true },
  { key: "key", value: "0x9af4…2c81", mono: true },
  { key: "first seen", value: "2026-01-08", mono: true },
  { key: "updated", value: "2 days ago", mono: true }
];

const summaryPermissions = [
  { kind: "ok", label: "read", scope: "scoped" },
  { kind: "ok", label: "write", scope: "scoped" },
  { kind: "no", label: "network", scope: "none" },
  { kind: "no", label: "exec", scope: "none" }
];

const maintainers = [
  { name: "elvissun", meta: "lead · 142 commits", bg: "linear-gradient(135deg, #5ad6c0, #5a9dd6)" },
  { name: "iris-d", meta: "22 commits", bg: "linear-gradient(135deg, #d6a85a, #b48ad6)" }
];

async function copyInstall() {
  copied.value = true;
  try {
    await navigator.clipboard?.writeText("autovault add extract-pdf");
  } catch {
    // Clipboard is progressive enhancement.
  }
  window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}
</script>
