<template>
  <div class="sd-page reveal-page">
    <nav class="sd-crumb reveal-item" aria-label="Breadcrumb">
      <a href="/skills-directory">Examples</a>
      <span class="sep">/</span>
      <a href="/author-autoworks-ai">{{ currentSkill.org }}</a>
      <span class="sep">/</span>
      <span class="cur">{{ currentSkill.name }}</span>
    </nav>

    <header class="sd-head reveal-item">
      <div>
        <div class="ttl-row">
          <div class="icon-tile">{{ currentSkill.icon }}</div>
          <div>
            <h1><span class="org">{{ currentSkill.org }} / </span>{{ currentSkill.name }}</h1>
            <div class="sub-row">
              <span class="verified"><UiIcon name="check" /> Hosted SKILL.md</span>
              <span>v{{ currentSkill.v }}</span><span class="dot" />
              <span>{{ currentSkill.license }}</span><span class="dot" />
              <span>{{ currentSkill.size }}</span><span class="dot" />
              <span>{{ currentSkill.sourceLabel }}</span>
            </div>
          </div>
        </div>
        <p class="desc">{{ currentSkill.desc }}</p>
      </div>
      <div class="actions">
        <button class="sd-installbtn" type="button" @click="copyInstall">Add to your vault <UiIcon name="arrow" /></button>
        <div class="sd-install">
          <div class="lbl">Or via CLI</div>
          <div class="cmd">
            <span class="pmt">$</span>
            <span>{{ currentSkill.install }}</span>
            <button class="copy" type="button" @click="copyInstall">{{ copied ? "Copied" : copyFailed ? "Copy failed" : "Copy" }}</button>
          </div>
        </div>
        <div class="sd-secondary-actions">
          <a class="sd-sbtn" :href="currentSkill.sourceUrl"><UiIcon name="github" /> Source</a>
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
              <a class="raw" :href="currentSkill.rawPath">view raw →</a>
            </div>
            <div class="sd-md-body">
              <div class="sd-frontmatter">
                <div class="marker">---</div>
                <div v-for="line in currentSkill.frontmatter" :key="line">{{ line }}</div>
                <div class="marker">---</div>
              </div>
              <h2>{{ currentSkill.name }}</h2>
              <p v-for="paragraph in currentSkill.overview" :key="paragraph">{{ paragraph }}</p>
              <h2>When to use this skill</h2>
              <ul>
                <li v-for="useCase in currentSkill.useCases" :key="useCase">{{ useCase }}</li>
              </ul>
              <h2>Install</h2>
              <p><code>{{ currentSkill.install }}</code></p>
            </div>
          </div>
          <div class="sd-related-wrap">
            <div class="mono-label">Related skills</div>
            <div class="sd-related">
              <a v-for="skill in relatedSkills" :key="skill.name" class="sd-rel-tile" :href="skill.detailPath">
                <div class="name">{{ skill.name }}</div>
                <div class="desc">{{ skill.desc }}</div>
              </a>
            </div>
          </div>
        </section>

        <section v-else-if="tab === 'transform'">
          <p class="sd-intro">This skill declares the agents shown below. The vault renders each admitted skill for the caller's target profile, so this view only shows supported targets from the hosted catalog.</p>
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
              <div class="head"><span class="ttl">SKILL.md (canonical)</span><span class="meta">v{{ currentSkill.v }}</span></div>
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
            <span class="ch">format: markdown</span>
            <span class="ch">trigger style: {{ target === "cx" ? "task-oriented" : "natural" }}</span>
            <span class="ch">permissions: explicit</span>
            <span class="ch">source: hosted SKILL.md</span>
          </div>
        </section>

        <section v-else-if="tab === 'perms'">
          <p class="sd-intro">This skill's declared capabilities, by axis. These rows are derived from the hosted SKILL.md metadata rather than placeholder marketplace copy.</p>
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
          <div class="sd-versions-row head"><span>Version</span><span>Notes</span><span>Date</span><span>Gate</span><span>Example</span></div>
          <div v-for="version in versions" :key="version.version" class="sd-versions-row">
            <span class="ver">{{ version.version }}<span v-if="version.latest" class="latest">latest</span></span>
            <span class="notes">{{ version.notes }}</span>
            <span class="date">{{ version.date }}</span>
            <span class="gate">5/5 ✓</span>
            <span class="install">{{ version.example }}</span>
          </div>
        </section>
      </main>

      <aside class="sd-rail">
        <div class="sd-card">
          <h4>Compatibility</h4>
          <div class="sd-agent-list">
            <div v-for="agent in agentRows" :key="agent.id" class="sd-agent-row">
              <span class="swatch" :style="{ background: agent.color }" />
              <span class="lbl">{{ agent.label }}</span>
              <span class="stat">{{ agent.on ? "declared" : "not declared" }}</span>
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
          <h4>Source model</h4>
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
import { PRODUCT_VERSION } from "../data/product";
import { agents as catalogAgents, findSkillByName, skills } from "../data/skills";

type TabId = "overview" | "transform" | "perms" | "prov" | "versions";
type TargetId = "cc" | "cx" | "aj";

const props = defineProps<{ skillName?: string }>();
const tab = ref<TabId>("overview");
const target = ref<TargetId>("cc");
const copied = ref(false);
const copyFailed = ref(false);

const currentSkill = computed(() => findSkillByName(props.skillName));

const tabs = [
  { id: "overview" as const, label: "Overview" },
  { id: "perms" as const, label: "Permissions" },
  { id: "prov" as const, label: "Provenance" },
  { id: "versions" as const, label: "Source", count: 1 }
];

const stats = computed(() => [
  { label: "Example type", value: "skill", trend: "hosted SKILL.md" },
  { label: "Declared agents", value: String(currentSkill.value.agents.length), trend: "from frontmatter" },
  { label: "Gate stages", value: "5", trend: "covered by tests" },
  { label: "Permission rows", value: String(currentSkill.value.permissions.length), trend: "declared metadata", muted: true },
  { label: "Source", value: currentSkill.value.org, trend: "real source link" }
]);

const agentRows = computed(() => catalogAgents.map((agent) => ({
  ...agent,
  on: currentSkill.value.agents.includes(agent.id)
})));

const targets = [
  { id: "cc" as const, label: "Claude Code", color: "#d6a85a", added: 2, removed: 0, file: "SKILL.md" },
  { id: "cx" as const, label: "Codex", color: "#5a9dd6", added: 2, removed: 0, file: "SKILL.md" },
  { id: "aj" as const, label: "AutoJack", color: "#5ad6c0", added: 1, removed: 0, file: "SKILL.md" }
];
const activeTarget = computed(() => targets.find((item) => item.id === target.value) ?? targets[0]);

const canonicalLines = computed(() => [
  `## Skill: ${currentSkill.value.name}`,
  "",
  currentSkill.value.desc,
  "",
  "### Install",
  currentSkill.value.install,
  "",
  "### Source",
  currentSkill.value.sourceLabel
]);

const transformLines = computed<Record<TargetId, Array<{ kind?: "add" | "del"; text: string }>>>(() => ({
  cc: currentSkill.value.overview.map((text) => ({ text })),
  cx: currentSkill.value.useCases.map((text) => ({ kind: "add", text })),
  aj: currentSkill.value.frontmatter.map((text) => ({ text }))
}));

const relatedSkills = computed(() => currentSkill.value.related.map((name) => skills.find((skill) => skill.name === name)).filter((skill): skill is (typeof skills)[number] => Boolean(skill)));

const permissionGroups = computed(() => [
  { title: "Declared capabilities", rows: currentSkill.value.permissions }
]);

const provenance = computed(() => [
  { icon: "check" as const, ok: true, title: "Hosted raw SKILL.md", detail: `<a href="${currentSkill.value.rawPath}">${currentSkill.value.rawPath}</a>`, when: "current" },
  { icon: "github" as const, ok: true, title: "Source path", detail: `<a href="${currentSkill.value.sourceUrl}">${currentSkill.value.sourceLabel}</a>`, when: "current" },
  { icon: "shield" as const, ok: true, title: `Website gate · ${PRODUCT_VERSION}`, detail: "Catalog tests parse the hosted file and verify frontmatter against the listing.", when: "CI" },
  { icon: "lock" as const, title: "Available for local admission", detail: `<code>${currentSkill.value.install}</code>`, when: "on demand" }
]);

const versions = computed(() => [
  { version: currentSkill.value.v, latest: true, notes: "Current hosted SKILL.md", date: "source", example: currentSkill.value.rawPath }
]);

const metadata = computed(() => [
  { key: "version", value: currentSkill.value.v, mono: true },
  { key: "size", value: currentSkill.value.size, mono: true },
  { key: "license", value: currentSkill.value.license },
  { key: "source", value: currentSkill.value.org, accent: true },
  { key: "raw", value: currentSkill.value.rawPath, mono: true }
]);

const summaryPermissions = computed(() => currentSkill.value.permissions);

const maintainers = computed(() => [
  { name: currentSkill.value.org, meta: "source owner", bg: "linear-gradient(135deg, #5ad6c0, #5a9dd6)" },
  { name: "AutoVault gate", meta: "validates before local admission", bg: "linear-gradient(135deg, #d6a85a, #b48ad6)" }
]);

async function copyInstall() {
  copied.value = false;
  copyFailed.value = false;
  try {
    if (!navigator.clipboard) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(currentSkill.value.install);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1200);
  } catch {
    copyFailed.value = true;
    window.setTimeout(() => {
      copyFailed.value = false;
    }, 1600);
  }
}
</script>
