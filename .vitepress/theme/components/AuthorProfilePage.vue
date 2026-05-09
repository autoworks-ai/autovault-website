<template>
  <div class="au-page reveal-page">
    <nav class="au-crumb reveal-item" aria-label="Breadcrumb">
      <a href="/skills-directory">Examples</a>
      <span class="sep">/</span>
      <span class="cur">autoworks-ai</span>
    </nav>

    <header class="au-head reveal-item">
      <div>
        <div class="au-id">
          <div class="au-avatar">
            <div class="glyph">A</div>
            <div class="verified-mark"><UiIcon name="check" /></div>
          </div>
          <div>
            <h1>autoworks-ai</h1>
            <div class="handle">@autoworks-ai · source</div>
            <span class="verify-badge"><UiIcon name="shield" /> Verified author · since 2026-01-08</span>
          </div>
        </div>
        <p class="au-bio">Authors of <span class="ital">AutoVault</span> and a handful of foundational skill examples for the agent ecosystem. Every skill we admit goes through the same gate as everyone else's — no special treatment, no skipped stages. The tooling we build for ourselves is the tooling we ship.</p>
        <div class="au-meta-row">
          <a class="item" href="https://github.com/autoworks-ai"><UiIcon name="github" /> github.com/autoworks-ai</a>
          <a class="item" href="/">autovault.dev</a>
          <span class="item">San Francisco · Remote</span>
          <span class="item">3 maintainers</span>
        </div>
      </div>

      <aside class="au-cert" aria-label="Identity certificate">
        <div class="cert-head"><UiIcon name="shield" class="seal" /><span>Identity certificate</span><span class="id">CERT-7E10A2C8</span></div>
        <div v-for="row in certificate" :key="row.key" class="cert-row">
          <span class="k">{{ row.key }}</span>
          <span :class="['v', row.accent ? 'accent' : '', row.big ? 'bigkey' : '']">{{ row.value }}</span>
        </div>
        <div class="cert-actions">
          <button type="button" @click="notice = 'Chain verified locally'">Verify chain</button>
          <button type="button" @click="notice = 'Key pinned in this browser session'">Pin key</button>
          <button type="button" @click="copyCert">{{ certCopied ? "Copied" : "Export" }}</button>
        </div>
        <div v-if="notice" class="cert-notice">{{ notice }}</div>
      </aside>
    </header>

    <section class="au-stats reveal-item" aria-label="Source statistics">
      <div v-for="stat in stats" :key="stat.label" class="st">
        <div class="lbl">{{ stat.label }}</div>
        <div class="val" v-html="stat.value" />
        <div :class="['trend', stat.dim ? 'dim' : '']">{{ stat.trend }}</div>
      </div>
    </section>

    <section class="au-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Body of work</div>
      <h2>Example skills from autoworks-ai</h2>
      <p class="sub">Every skill listed here has been signed with the certificate above, run through the gate, and is available as provenance context for local admission.</p>
      <div class="au-skills-toolbar">
        <button v-for="category in categories" :key="category" type="button" :class="['filter-chip', { on: selectedCategory === category }]" @click="selectedCategory = category">{{ category }}</button>
        <span class="ct">{{ filteredSkills.length }} of {{ authorSkills.length }} skills</span>
      </div>
      <div class="au-skills-grid">
        <a v-for="skill in filteredSkills" :key="skill.name" :class="['au-skill-tile', { flagship: skill.flagship }]" href="/skill-detail">
          <div class="row1">
            <div class="icon-tile">{{ skill.icon }}</div>
            <span class="name">{{ skill.name }}</span>
            <span class="ver">v{{ skill.version }}</span>
          </div>
          <div class="desc">{{ skill.desc }}</div>
          <div class="row3">
            <span class="install">{{ skill.installs }} refs</span>
            <span class="spacer" />
            <div class="agents">
              <span v-for="agent in agentIds" :key="agent" class="a" :style="agentStyle(skill, agent)">{{ agent }}</span>
            </div>
          </div>
        </a>
      </div>
    </section>

    <section class="au-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Trust track record</div>
      <h2>What the gate has seen from this source</h2>
      <p class="sub">A verified author isn't a free pass. Every admission still runs the same five stages, including the failures. No source should ever look like 100%.</p>
      <div class="au-track">
        <div class="au-track-grid">
          <div v-for="cell in track" :key="cell.label" class="au-track-cell">
            <div class="lbl">{{ cell.label }}</div>
            <div :class="['pct', cell.kind]">{{ cell.value }} <span v-if="cell.sub" class="sub">{{ cell.sub }}</span></div>
            <div class="det">{{ cell.detail }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="au-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Activity</div>
      <h2>What this source has been doing</h2>
      <p class="sub">A feed of proposals, admissions, updates, and gate verdicts — including the rejections. Activity is signed and append-only.</p>
      <div class="au-activity">
        <div class="au-activity-feed">
          <div class="feed-head">Last 12 weeks · 7 events</div>
          <div v-for="item in activity" :key="`${item.kind}-${item.name}`" class="au-activity-row">
            <div :class="['pip', item.kind]"><UiIcon :name="item.kind === 'admit' ? 'check' : item.kind === 'update' ? 'arrow' : 'x'" /></div>
            <div class="body">
              <div><span>{{ actionLabel(item.kind) }}</span> <span class="name">{{ item.name }}</span></div>
              <div class="det">{{ item.detail }}</div>
            </div>
            <span class="when">{{ item.when }}</span>
          </div>
        </div>
        <div class="au-cadence">
          <h4>Admission cadence</h4>
          <div class="h4-sub">last 26 weeks · 130 events</div>
          <div class="au-cadence-grid">
            <div v-for="(value, index) in cadenceData" :key="index" class="au-cadence-cell" :style="{ background: cadenceColor(value) }" />
          </div>
          <div class="au-cadence-legend">
            <span>less</span>
            <div class="scale"><div v-for="value in [0, 1, 2, 3, 4]" :key="value" :style="{ background: cadenceColor(value) }" /></div>
            <span>more</span>
            <span class="median">median: 4 / week</span>
          </div>
        </div>
      </div>
    </section>

    <section class="au-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Maintainers</div>
      <h2>Who's behind these skills</h2>
      <p class="sub">Each maintainer holds an individual signing key under the org root. Compromise of a personal key revokes only that maintainer's signatures — the org chain stays intact.</p>
      <div class="au-contrib-list">
        <div v-for="contributor in contributors" :key="contributor.name" class="au-contrib" :class="{ open: contributor.open }">
          <div class="av" :style="{ background: contributor.bg }" />
          <div class="col">
            <div class="name">{{ contributor.name }}</div>
            <div class="meta">{{ contributor.meta }}</div>
          </div>
          <div class="stat">{{ contributor.stat }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiIcon from "./UiIcon.vue";

type AgentId = "cc" | "cx" | "cu" | "ah";
type AuthorSkill = {
  name: string;
  icon: string;
  version: string;
  category: string;
  agents: AgentId[];
  installs: string;
  desc: string;
  flagship?: boolean;
};

const selectedCategory = ref("all");
const certCopied = ref(false);
const notice = ref("");

const agentIds: AgentId[] = ["cc", "cx", "cu", "ah"];
const agentColors: Record<AgentId, string> = { cc: "#d6a85a", cx: "#5a9dd6", cu: "#b48ad6", ah: "#5ad6c0" };

const certificate = [
  { key: "Subject", value: "CN = autoworks-ai" },
  { key: "Algorithm", value: "Ed25519" },
  { key: "Public key", value: "0x9af4 2c81 7e7e c4f9 3a01 e10a 2c81 9af4 7e7e e10a 2c81 9af4 c4f9 3a01 e10a 2c81", big: true },
  { key: "Anchor", value: "vault.autovault.dev (root)", accent: true },
  { key: "Issued", value: "2026-01-08" },
  { key: "Rotated", value: "2026-04-04 · 0 incidents" }
];

const stats = [
  { label: "Example skills", value: "14", trend: "+2 this month" },
  { label: "Reference uses", value: "12.8<span class=\"unit\">k</span>", trend: "+1.6k this week" },
  { label: "Gate pass rate", value: "96.4<span class=\"unit\">%</span>", trend: "81 of 84 submissions" },
  { label: "Median bundle", value: "3.1<span class=\"unit\">KB</span>", trend: "75th: 5.4KB", dim: true },
  { label: "Issue response", value: "14<span class=\"unit\">h</span>", trend: "median, last 90d" }
];

const authorSkills: AuthorSkill[] = [
  { name: "extract-pdf", icon: "PD", version: "1.4.0", category: "files", agents: ["cc", "cx", "cu", "ah"], installs: "2.8k", desc: "Extract structured text from PDF files. Preserves headings, lists, and table layout.", flagship: true },
  { name: "summarize-doc", icon: "SD", version: "0.9.2", category: "text", agents: ["cc", "cx", "cu", "ah"], installs: "1.9k", desc: "Recursive multi-pass summarization with configurable depth.", flagship: true },
  { name: "github-issues", icon: "GH", version: "2.1.0", category: "integrations", agents: ["cc", "cx", "cu"], installs: "1.4k", desc: "Read, search, and create GitHub issues. Scoped to authorized repos.", flagship: true },
  { name: "ocr-image", icon: "OC", version: "1.2.1", category: "files", agents: ["cc", "cx", "cu", "ah"], installs: "1.1k", desc: "OCR an image to text. Wraps tesseract locally; never sends pixels off-device." },
  { name: "json-validate", icon: "JV", version: "1.2.0", category: "data", agents: ["cc", "cx", "cu", "ah"], installs: "1.0k", desc: "Validate JSON against a schema with structured error reporting." },
  { name: "parse-csv", icon: "CV", version: "1.0.4", category: "files", agents: ["cc", "cx", "cu", "ah"], installs: "980", desc: "Parse CSV with type inference and configurable dialects." },
  { name: "yaml-validate", icon: "YV", version: "0.9.0", category: "data", agents: ["cc", "cx", "cu", "ah"], installs: "840", desc: "Validate YAML with auto-repair suggestions — same engine as the gate." },
  { name: "extract-table", icon: "TB", version: "0.7.0", category: "files", agents: ["cc", "cx"], installs: "720", desc: "Pull structured tables from HTML, PDF, and image sources into normalized rows." },
  { name: "diff-summarize", icon: "DS", version: "0.6.0", category: "code", agents: ["cc", "cx", "cu", "ah"], installs: "470", desc: "Walk a diff and produce a structured summary of intent + risk per hunk." },
  { name: "git-blame", icon: "GB", version: "1.1.0", category: "code", agents: ["cc", "cx", "cu"], installs: "540", desc: "Annotate git blame across a repo with author + commit summary." },
  { name: "tf-plan-explain", icon: "TF", version: "0.4.0", category: "infra", agents: ["cc", "cx"], installs: "220", desc: "Read a terraform plan and produce a human-readable change summary." },
  { name: "regex-extract", icon: "RX", version: "1.5.0", category: "text", agents: ["cc", "cx", "cu", "ah"], installs: "1.5k", desc: "Test, refine, and run regex against sample text." },
  { name: "linear-tasks", icon: "LN", version: "0.4.0", category: "integrations", agents: ["cc", "cx"], installs: "380", desc: "Read and update Linear tasks scoped to a workspace." },
  { name: "slack-search", icon: "SL", version: "0.3.1", category: "integrations", agents: ["cc", "cx", "cu"], installs: "290", desc: "Search a Slack workspace and return formatted thread context." }
];

const categories = ["all", "files", "text", "data", "code", "integrations", "infra"];
const filteredSkills = computed(() => selectedCategory.value === "all" ? authorSkills : authorSkills.filter((skill) => skill.category === selectedCategory.value));

const track = [
  { label: "Submissions", value: "84", detail: "across 14 skills · last 12 months" },
  { label: "Passed clean", value: "81", sub: "/ 96.4%", detail: "no repair, no flag, no dedup hit" },
  { label: "Auto-repaired", value: "11", sub: "/ 13.1%", kind: "warn", detail: "YAML frontmatter fixes, mostly" },
  { label: "Rejected", value: "3", sub: "/ 3.6%", kind: "bad", detail: "2 capability mismatch, 1 dedup" }
];

const activity = [
  { kind: "admit", name: "extract-pdf@1.4.0", detail: "+--pages range support · 5/5 gate stages green", when: "2d" },
  { kind: "update", name: "extract-pdf@1.3.2", detail: "patch: malformed cross-reference tables", when: "3w" },
  { kind: "admit", name: "yaml-validate@0.9.0", detail: "initial release · same engine as the gate", when: "5w" },
  { kind: "deny", name: "experiment-skill@0.1.0", detail: "rejected by gate stage 03 · capability mismatch", when: "6w" },
  { kind: "update", name: "github-issues@2.1.0", detail: "minor: support enterprise.github.com hosts", when: "7w" },
  { kind: "admit", name: "extract-table@0.7.0", detail: "initial release · pairs with extract-pdf", when: "9w" },
  { kind: "update", name: "summarize-doc@0.9.2", detail: "patch: token budgeting on long docs", when: "10w" }
];

const cadenceData = Array.from({ length: 26 * 5 }, (_, index) => {
  const seed = (index * 9301 + 49297) % 233280;
  return Math.floor(Math.pow(seed / 233280, 2) * 5);
});

const contributors = [
  { name: "elvissun", meta: "key:0xC4F9…E10A · since 2026-01-08", stat: "412 commits", bg: "linear-gradient(135deg, #5ad6c0, #5a9dd6)" },
  { name: "iris-d", meta: "key:0xD6A8…5AB4 · since 2026-02-19", stat: "180 commits", bg: "linear-gradient(135deg, #d6a85a, #b48ad6)" },
  { name: "sky-w", meta: "key:0xB48A…D6E2 · since 2026-03-04", stat: "94 commits", bg: "linear-gradient(135deg, #b48ad6, #5ad6c0)" },
  { name: "Open seat", meta: "contributing@autoworks-ai", stat: "—", bg: "var(--bg-2)", open: true }
];

function cadenceColor(value: number) {
  if (value <= 0) return "#1a242e";
  if (value === 1) return "rgba(90,214,192,0.18)";
  if (value === 2) return "rgba(90,214,192,0.35)";
  if (value === 3) return "rgba(90,214,192,0.6)";
  return "var(--accent)";
}

function actionLabel(kind: string) {
  return kind === "admit" ? "Admitted" : kind === "update" ? "Updated" : "Gate rejected";
}

function agentStyle(skill: AuthorSkill, agent: AgentId) {
  const on = skill.agents.includes(agent);
  return {
    background: on ? agentColors[agent] : "var(--bg-2)",
    color: on ? "#0a0d11" : "var(--ink-4)",
    border: `1px solid ${on ? agentColors[agent] : "var(--line)"}`
  };
}

async function copyCert() {
  certCopied.value = true;
  notice.value = "Certificate exported to clipboard";
  try {
    await navigator.clipboard?.writeText(certificate.map((row) => `${row.key}: ${row.value}`).join("\n"));
  } catch {
    // Clipboard is progressive enhancement.
  }
  window.setTimeout(() => {
    certCopied.value = false;
  }, 1200);
}
</script>
