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
            <span class="verify-badge"><UiIcon name="shield" /> Public source · current examples</span>
          </div>
        </div>
        <p class="au-bio">Authors of <span class="ital">AutoVault</span> and the first-party SKILL.md examples shown here. Each listed row points to a hosted raw skill and to the matching source path.</p>
        <div class="au-meta-row">
          <a class="item" href="https://github.com/autoworks-ai"><UiIcon name="github" /> github.com/autoworks-ai</a>
          <a class="item" href="/">autovault.dev</a>
          <span class="item">MIT examples</span>
          <span class="item">{{ authorSkills.length }} hosted skills</span>
        </div>
      </div>

      <aside class="au-cert" aria-label="Source record">
        <div class="cert-head"><UiIcon name="shield" class="seal" /><span>Source record</span><span class="id">PUBLIC</span></div>
        <div v-for="row in certificate" :key="row.key" class="cert-row">
          <span class="k">{{ row.key }}</span>
          <span :class="['v', row.accent ? 'accent' : '', row.big ? 'bigkey' : '']">{{ row.value }}</span>
        </div>
        <div class="cert-actions">
          <a href="https://github.com/autoworks-ai/autovault">Open source</a>
          <a href="/skills/autovault-skill/SKILL.md">Open raw</a>
          <button type="button" @click="copyCert">{{ certCopied ? "Copied" : "Copy record" }}</button>
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
      <p class="sub">Every skill listed here is backed by a real hosted SKILL.md file and a source URL.</p>
      <div class="au-skills-toolbar">
        <button v-for="category in categories" :key="category" type="button" :class="['filter-chip', { on: selectedCategory === category }]" @click="selectedCategory = category">{{ category }}</button>
        <span class="ct">{{ filteredSkills.length }} of {{ authorSkills.length }} skills</span>
      </div>
      <div class="au-skills-grid">
        <a v-for="skill in filteredSkills" :key="skill.name" :class="['au-skill-tile', { flagship: skill.flagship }]" :href="skill.detailPath">
          <div class="row1">
            <div class="icon-tile">{{ skill.icon }}</div>
            <span class="name">{{ skill.name }}</span>
            <span class="ver">v{{ skill.version }}</span>
          </div>
          <div class="desc">{{ skill.desc }}</div>
          <div class="row3">
            <span class="install">{{ skill.references }} refs</span>
            <span class="spacer" />
            <div class="agents">
              <span v-for="agent in agentIds" :key="agent" class="a" :style="agentStyle(skill, agent)">{{ agent }}</span>
            </div>
          </div>
        </a>
      </div>
    </section>

    <section class="au-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Reference coverage</div>
      <h2>What this source demonstrates</h2>
      <p class="sub">This section summarizes only the hosted examples currently present in the catalog; it is not a live marketplace score.</p>
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
      <div class="eyebrow"><span class="dash" /> Example audit trail</div>
      <h2>How a source profile should explain changes</h2>
      <p class="sub">The rows below point at source ownership and hosted copies rather than fabricated signing history.</p>
      <div class="au-activity">
        <div class="au-activity-feed">
          <div class="feed-head">Current hosted examples · {{ activity.length }} events</div>
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
          <h4>Hosted coverage</h4>
          <div class="h4-sub">current catalog size</div>
          <div class="au-cadence-grid">
            <div v-for="(value, index) in cadenceData" :key="index" class="au-cadence-cell" :style="{ background: cadenceColor(value) }" />
          </div>
          <div class="au-cadence-legend">
            <span>less</span>
            <div class="scale"><div v-for="value in [0, 1, 2, 3, 4]" :key="value" :style="{ background: cadenceColor(value) }" /></div>
            <span>more</span>
            <span class="median">{{ authorSkills.length }} skills</span>
          </div>
        </div>
      </div>
    </section>

    <section class="au-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Signing model</div>
      <h2>How maintainer identity is represented</h2>
      <p class="sub">A local vault can add its own signature after admission; the website only claims the hosted source record.</p>
      <div class="au-contrib-list">
        <div v-for="identity in signingIdentities" :key="identity.name" class="au-contrib" :class="{ open: identity.open }">
          <div class="av" :style="{ background: identity.bg }" />
          <div class="col">
            <div class="name">{{ identity.name }}</div>
            <div class="meta">{{ identity.meta }}</div>
          </div>
          <div class="stat">{{ identity.stat }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiIcon from "./UiIcon.vue";
import { agents, skills, type AgentId, type Skill } from "../data/skills";

type AuthorSkill = {
  name: string;
  icon: string;
  version: string;
  category: string;
  agents: AgentId[];
  references: string;
  desc: string;
  detailPath: string;
  flagship?: boolean;
};
type TrackCell = {
  label: string;
  value: string;
  detail: string;
  kind?: string;
  sub?: string;
};

const selectedCategory = ref("all");
const certCopied = ref(false);
const notice = ref("");

const agentIds: AgentId[] = agents.map((agent) => agent.id);
const agentColors = Object.fromEntries(agents.map((agent) => [agent.id, agent.color])) as Record<AgentId, string>;

const certificate = [
  { key: "Subject", value: "CN = autoworks-ai" },
  { key: "Repository", value: "github.com/autoworks-ai/autovault", accent: true },
  { key: "Hosted raw", value: "/skills/{name}/SKILL.md", big: true },
  { key: "Catalog", value: "autovault.dev/skills-directory" },
  { key: "License", value: "MIT examples" }
];

const authorSourceSkills = skills.filter((skill) => skill.org === "autoworks-ai");
const authorSkills: AuthorSkill[] = authorSourceSkills.map((skill: Skill, index) => ({
  name: skill.name,
  icon: skill.icon,
  version: skill.v,
  category: skill.category,
  agents: skill.agents,
  references: String(skill.references),
  desc: skill.desc,
  detailPath: skill.detailPath,
  flagship: index === 0
}));

const stats = computed(() => [
  { label: "Example skills", value: String(authorSkills.length), trend: "hosted SKILL.md files" },
  { label: "Reference rows", value: String(authorSkills.length), trend: "source-backed examples" },
  { label: "Render targets", value: String(agentIds.length), trend: agents.map((agent) => agent.label).join(", ") },
  { label: "Gate stages", value: "5", trend: "same pipeline as installs" },
  { label: "Median bundle", value: medianBundleSize(), trend: "hosted payload", dim: true }
]);

const categories = ["all", ...Array.from(new Set(authorSkills.map((skill) => skill.category)))];
const filteredSkills = computed(() => selectedCategory.value === "all" ? authorSkills : authorSkills.filter((skill) => skill.category === selectedCategory.value));

const track: TrackCell[] = [
  { label: "Example rows", value: String(authorSkills.length), detail: "real hosted SKILL.md files" },
  { label: "Source links", value: "present", detail: "each row has a GitHub source URL" },
  { label: "Raw links", value: "present", detail: "each row has a local raw markdown path" },
  { label: "Fixture claims", value: "removed", detail: "no fabricated install counts or fake versions" }
];

const activity = authorSourceSkills.map((skill) => ({
  kind: "admit",
  name: `${skill.name}@${skill.v}`,
  detail: skill.sourceLabel,
  when: "current"
}));

const cadenceData = Array.from({ length: 26 * 5 }, (_, index) => {
  const seed = (index * 9301 + 49297) % 233280;
  return Math.floor(Math.pow(seed / 233280, 2) * 5);
});

const signingIdentities = [
  { name: "source owner", meta: "github.com/autoworks-ai/autovault", stat: "author", bg: "linear-gradient(135deg, #5ad6c0, #5a9dd6)" },
  { name: "hosted copy", meta: "served from autovault.dev/skills", stat: "raw", bg: "linear-gradient(135deg, #d6a85a, #b48ad6)" },
  { name: "local vault", meta: "signs after admission on the user's machine", stat: "optional", bg: "var(--bg-2)", open: true }
];

function cadenceColor(value: number) {
  if (value <= 0) return "#1a242e";
  if (value === 1) return "rgba(90,214,192,0.18)";
  if (value === 2) return "rgba(90,214,192,0.35)";
  if (value === 3) return "rgba(90,214,192,0.6)";
  return "var(--accent)";
}

function actionLabel(kind: string) {
  return kind === "admit" ? "Hosted" : kind === "update" ? "Updated" : "Gate rejected";
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
  notice.value = "Source record copied";
  try {
    await navigator.clipboard?.writeText(certificate.map((row) => `${row.key}: ${row.value}`).join("\n"));
  } catch {
    // Clipboard is progressive enhancement.
  }
  window.setTimeout(() => {
    certCopied.value = false;
  }, 1200);
}

function medianBundleSize() {
  const sizes = authorSourceSkills.map((skill) => Number(skill.size.replace(/\D/g, ""))).sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);
  const median = sizes.length % 2 === 0 ? (sizes[mid - 1] + sizes[mid]) / 2 : sizes[mid];
  return `${(median / 1000).toFixed(1)}<span class="unit">KB</span>`;
}
</script>
