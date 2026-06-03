<template>
  <div class="sd-page reveal-page">
    <nav class="sd-crumb reveal-item" aria-label="Breadcrumb">
      <a href="/skills-directory">Examples</a>
      <span class="sep">/</span>
      <a v-if="authorPath" :href="authorPath">{{ currentSkill.org }}</a>
      <span v-else>{{ currentSkill.org }}</span>
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
              <span class="verified"><UiIcon name="check" /> {{ bundleBadgeLabel }}</span>
              <span class="source-badge" :class="currentSkill.sourceKind">{{ currentSkill.trustLabel }}</span>
              <span class="meta-facts">
                <span>v{{ currentSkill.v }}</span>
                <span>{{ currentSkill.license }}</span>
                <span>{{ currentSkill.size }}</span>
              </span>
            </div>
            <div class="src-path">{{ currentSkill.sourceLabel }}</div>
          </div>
        </div>
        <p class="desc">{{ currentSkill.desc }}</p>
        <div v-if="hasBundle" class="sd-asset-strip" aria-label="Bundle highlights">
          <button v-for="asset in featuredAssets" :key="asset.path" type="button" class="sd-asset-chip" @click="openResource(asset.path)">
            <span v-if="asset.kind === 'svg'" class="thumb"><img :src="resourceHref(asset)" :alt="asset.title" /></span>
            <span v-else class="thumb mono">{{ asset.kind }}</span>
            <span>
              <span class="name">{{ asset.title }}</span>
              <span class="path">{{ asset.path }}</span>
            </span>
          </button>
        </div>
      </div>
      <div class="actions">
        <div class="sd-install">
          <div class="sd-install-head">
            <span class="lbl">Install</span>
            <span class="sd-install-tag">{{ installRows.length > 1 ? "CLI + MCP" : "MCP" }}</span>
          </div>
          <div class="sd-install-list">
            <div v-for="row in installRows" :key="row.mode" class="sd-install-row">
              <div class="sd-install-row-meta">
                <span class="sd-install-method">{{ row.label }}</span>
                <span>{{ row.help }}</span>
              </div>
              <div class="cmd">
                <span class="pmt">{{ row.prompt }}</span>
                <span class="cmd-text">{{ row.command }}</span>
                <button class="copy" type="button" :aria-label="row.copyLabel" @click="copyInstall(row.command, row.mode)">
                  {{ copiedCommand === row.mode ? "Copied" : copyFailedCommand === row.mode ? "Failed" : "Copy" }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="sd-copy-status" aria-live="polite">{{ copyStatus }}</div>
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
              <p v-for="row in installRows" :key="`overview-${row.mode}`"><strong>{{ row.label }}:</strong> <code>{{ row.command }}</code></p>
              <h2>Provenance</h2>
              <p>{{ currentSkill.provenanceNote }}</p>
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

        <section v-else-if="tab === 'bundle'" class="sd-bundle">
          <div class="sd-bundle-head">
            <div>
              <h2>Bundle contents</h2>
              <p>Every file declared by this skill is inspectable here. Static resources are previewed from same-origin hosted files; script-like files, when present, are shown as text only.</p>
            </div>
            <div class="sd-bundle-count">
              <strong>{{ bundleFileCount }}</strong>
              <span>files</span>
            </div>
          </div>
          <div class="sd-bundle-grid">
            <nav class="sd-resource-tree" aria-label="Bundle files">
              <div v-for="group in bundleGroups" :key="group.name" class="sd-resource-group">
                <div class="sd-resource-group-title">{{ group.label }}</div>
                <div v-for="resource in group.items" :key="resource.path" :class="['sd-resource-row', selectedResource?.path === resource.path ? 'active' : '']">
                  <button type="button" @click="selectResource(resource.path)">
                    <span class="kind">{{ resource.kind }}</span>
                    <span class="file">
                      <span class="title">{{ resource.title }}</span>
                      <span class="path">{{ resource.path }}</span>
                    </span>
                    <span v-if="resource.kind === 'script'" class="exec-badge">inspect only</span>
                  </button>
                  <a class="raw-link" :href="resourceHref(resource)">raw</a>
                </div>
              </div>
            </nav>

            <article v-if="selectedResource" class="sd-resource-preview">
              <div class="sd-resource-preview-head">
                <div>
                  <span class="kind">{{ selectedResource.kind }}</span>
                  <span class="filename">{{ selectedResource.path }}</span>
                </div>
                <a :href="resourceHref(selectedResource)">view raw →</a>
              </div>
              <div class="sd-resource-summary">
                <h3>{{ selectedResource.title }}</h3>
                <p>{{ selectedResource.summary }}</p>
              </div>
              <div v-if="selectedResource.kind === 'svg'" class="sd-resource-visual">
                <img :src="resourceHref(selectedResource)" :alt="selectedResource.title" />
              </div>
              <div v-else class="sd-resource-code">
                <pre v-if="resourcePreview.status === 'loaded'">{{ resourcePreview.content }}</pre>
                <pre v-else-if="resourcePreview.status === 'loading'">Loading {{ selectedResource.path }}...</pre>
                <pre v-else>{{ resourcePreview.content || "Preview unavailable. Open the raw file to inspect this resource." }}</pre>
              </div>
            </article>
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
              <div class="det">
                <a v-if="row.detail.kind === 'link'" :href="row.detail.href">{{ row.detail.text }}</a>
                <code v-else-if="row.detail.kind === 'code'">{{ row.detail.text }}</code>
                <template v-else>{{ row.detail.text }}</template>
              </div>
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
import { computed, ref, watch } from "vue";
import UiIcon from "./UiIcon.vue";
import { PRODUCT_VERSION } from "../data/product";
import { agents as catalogAgents, findSkillByName, skills, type SkillResource } from "../data/skills";
import { copyText } from "../utils/clipboard";

type TabId = "overview" | "bundle" | "perms" | "prov" | "versions";
type BundleResource = SkillResource & { root?: boolean };
type InstallMode = "cli" | "mcp";
type InstallRow = {
  mode: InstallMode;
  label: "CLI" | "MCP";
  prompt: "$" | ">";
  command: string;
  help: string;
  copyLabel: string;
};

const props = defineProps<{ skillName?: string }>();
const tab = ref<TabId>("overview");
const copiedCommand = ref<InstallMode | "">("");
const copyFailedCommand = ref<InstallMode | "">("");
const selectedResourcePath = ref("SKILL.md");
const resourcePreview = ref({ path: "", status: "idle" as "idle" | "loading" | "loaded" | "error", content: "" });

const currentSkill = computed(() => findSkillByName(props.skillName));

const installRows = computed(() => {
  const rows: InstallRow[] = [];
  if (currentSkill.value.cliInstall) {
    rows.push({
      mode: "cli" as const,
      label: "CLI",
      prompt: "$",
      command: currentSkill.value.cliInstall,
      help: "Run from your local shell.",
      copyLabel: "Copy CLI install command"
    });
  }
  rows.push({
    mode: "mcp" as const,
    label: "MCP",
    prompt: ">",
    command: currentSkill.value.install,
    help: "Paste into an agent MCP tool call.",
    copyLabel: "Copy MCP install command"
  });
  return rows;
});

const ORG_AUTHOR_PAGES: Record<string, string> = {
  "autoworks-ai": "/author-autoworks-ai"
};
const authorPath = computed(() => ORG_AUTHOR_PAGES[currentSkill.value.org] ?? null);

const resourceCount = computed(() => currentSkill.value.resources?.length ?? 0);
const hasBundle = computed(() => resourceCount.value > 0);
const bundleFileCount = computed(() => resourceCount.value + 1);
const bundleBadgeLabel = computed(() => hasBundle.value ? "Hosted skill bundle" : "Hosted SKILL.md");

const tabs = computed(() => [
  { id: "overview" as const, label: "Overview" },
  ...(hasBundle.value ? [{ id: "bundle" as const, label: "Bundle", count: bundleFileCount.value }] : []),
  { id: "perms" as const, label: "Permissions" },
  { id: "prov" as const, label: "Provenance" },
  { id: "versions" as const, label: "Source", count: 1 }
]);

const stats = computed(() => {
  if (hasBundle.value) {
    return [
      { label: "Example type", value: "bundle", trend: "hosted skill bundle" },
      { label: "Bundle files", value: String(bundleFileCount.value), trend: "SKILL.md + resources" },
      { label: "Resources", value: String(resourceCount.value), trend: "declared in frontmatter" },
      { label: "Declared agents", value: String(currentSkill.value.agents.length), trend: "from frontmatter" },
      { label: "Source", value: currentSkill.value.providerName, trend: currentSkill.value.trustLabel }
    ];
  }

  return [
    { label: "Example type", value: "skill", trend: "hosted SKILL.md" },
    { label: "Declared agents", value: String(currentSkill.value.agents.length), trend: "from frontmatter" },
    { label: "Gate stages", value: "5", trend: "covered by tests" },
    { label: "Permission rows", value: String(currentSkill.value.permissions.length), trend: "declared metadata", muted: true },
    { label: "Source", value: currentSkill.value.providerName, trend: currentSkill.value.trustLabel }
  ];
});

const agentRows = computed(() => catalogAgents.map((agent) => ({
  ...agent,
  on: currentSkill.value.agents.includes(agent.id)
})));

const relatedSkills = computed(() => currentSkill.value.related.map((name) => skills.find((skill) => skill.name === name)).filter((skill): skill is (typeof skills)[number] => Boolean(skill)));

const permissionGroups = computed(() => [
  { title: "Declared capabilities", rows: currentSkill.value.permissions }
]);

const bundleResources = computed<BundleResource[]>(() => [
  {
    path: "SKILL.md",
    kind: "markdown",
    group: "root",
    title: "SKILL.md",
    summary: "Primary agent instructions, frontmatter, workflow, and declared resource manifest.",
    root: true
  },
  ...(currentSkill.value.resources ?? [])
]);

const bundleGroups = computed(() => {
  const order = ["root", "references", "assets", "agents", "bin", "scripts"];
  const labels: Record<string, string> = {
    root: "Skill root",
    references: "Reference docs",
    assets: "Assets",
    agents: "Agent metadata",
    bin: "Commands",
    scripts: "Scripts"
  };
  return order
    .map((name) => ({
      name,
      label: labels[name] ?? name,
      items: bundleResources.value.filter((resource) => resource.group === name)
    }))
    .filter((group) => group.items.length);
});

const selectedResource = computed(() => bundleResources.value.find((resource) => resource.path === selectedResourcePath.value) ?? bundleResources.value[0]);

const featuredAssets = computed(() => {
  const priority = [
    "assets/brand-mark-animated.svg",
    "assets/brand-mark.svg",
    "assets/ascii-vault.txt",
    "assets/autovault-brand.css"
  ];
  return priority
    .map((path) => bundleResources.value.find((resource) => resource.path === path))
    .filter((resource): resource is BundleResource => Boolean(resource));
});

type ProvenanceDetail =
  | { kind: "link"; href: string; text: string }
  | { kind: "code"; text: string }
  | { kind: "text"; text: string };

const provenance = computed(() => [
  { icon: "check" as const, ok: true, title: "Hosted raw SKILL.md", detail: { kind: "link" as const, href: currentSkill.value.rawPath, text: currentSkill.value.rawPath }, when: "current" },
  { icon: currentSkill.value.sourceUrl.startsWith("https://github.com/") ? ("github" as const) : ("tip" as const), ok: true, title: "Provider/source reference", detail: { kind: "link" as const, href: currentSkill.value.sourceUrl, text: currentSkill.value.sourceLabel }, when: currentSkill.value.providerName },
  { icon: "shield" as const, ok: true, title: currentSkill.value.trustLabel, detail: { kind: "text" as const, text: currentSkill.value.provenanceNote }, when: currentSkill.value.admissionStatus === "provenance-example" ? "review" : "hosted" },
  { icon: "shield" as const, ok: true, title: `Website gate · ${PRODUCT_VERSION}`, detail: { kind: "text" as const, text: "Catalog tests parse the hosted file and verify frontmatter against the listing." }, when: "CI" },
  { icon: "lock" as const, title: "Available for local admission", detail: { kind: "code" as const, text: currentSkill.value.install }, when: "on demand" }
]);

const versions = computed(() => [
  { version: currentSkill.value.v, latest: true, notes: "Current hosted SKILL.md", date: "source", example: currentSkill.value.rawPath }
]);

const metadata = computed(() => [
  { key: "version", value: currentSkill.value.v, mono: true },
  { key: "size", value: currentSkill.value.size, mono: true },
  { key: "license", value: currentSkill.value.license },
  { key: "provider", value: currentSkill.value.providerName, accent: true },
  { key: "trust", value: currentSkill.value.trustLabel },
  { key: "raw", value: currentSkill.value.rawPath, mono: true }
]);

const summaryPermissions = computed(() => currentSkill.value.permissions);

const maintainers = computed(() => [
  { name: currentSkill.value.providerName, meta: currentSkill.value.sourceKind === "trusted-provider" ? "trusted provider example" : "source owner", bg: "linear-gradient(135deg, #5ad6c0, #5a9dd6)" },
  { name: "AutoVault gate", meta: "validates before local admission", bg: "linear-gradient(135deg, #d6a85a, #b48ad6)" }
]);

const copyStatus = computed(() => {
  const copiedRow = installRows.value.find((row) => row.mode === copiedCommand.value);
  if (copiedRow) return `${copiedRow.label} install command copied.`;
  const failedRow = installRows.value.find((row) => row.mode === copyFailedCommand.value);
  if (failedRow) return `${failedRow.label} copy failed. Select the command above to copy it manually.`;
  return installRows.value.length > 1
    ? "Choose CLI for a shell install or MCP for an agent tool call."
    : "Copy the MCP add_skill call and paste it to your agent to admit the skill from source.";
});

async function copyInstall(command: string, mode: InstallMode) {
  copiedCommand.value = "";
  copyFailedCommand.value = "";
  if (await copyText(command)) {
    copiedCommand.value = mode;
    window.setTimeout(() => {
      if (copiedCommand.value === mode) copiedCommand.value = "";
    }, 1200);
    return;
  }
  copyFailedCommand.value = mode;
  window.setTimeout(() => {
    if (copyFailedCommand.value === mode) copyFailedCommand.value = "";
  }, 1600);
}

function skillResourceBasePath() {
  return currentSkill.value.rawPath.replace(/\/SKILL\.md$/, "");
}

function resourceHref(resource: Pick<BundleResource, "path" | "root">) {
  if (resource.root || resource.path === "SKILL.md") return currentSkill.value.rawPath;
  return `${skillResourceBasePath()}/${resource.path}`;
}

function selectResource(path: string) {
  selectedResourcePath.value = path;
}

function openResource(path: string) {
  selectedResourcePath.value = path;
  tab.value = "bundle";
}

async function loadSelectedResource() {
  const resource = selectedResource.value;
  if (!resource || resource.kind === "svg" || typeof window === "undefined") return;

  const href = resourceHref(resource);
  resourcePreview.value = { path: resource.path, status: "loading", content: "" };
  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    if (selectedResource.value?.path !== resource.path) return;
    resourcePreview.value = { path: resource.path, status: "loaded", content };
  } catch {
    if (selectedResource.value?.path !== resource.path) return;
    resourcePreview.value = {
      path: resource.path,
      status: "error",
      content: `Could not load ${href}. Open the raw file to inspect this resource.`
    };
  }
}

// Only fetch a resource preview while the Bundle tab is actually visible —
// avoids a wasted SKILL.md fetch on mount and on non-bundle skills (which have
// no Bundle tab at all). Reacts to both the tab switch and the selection, and
// runs immediately so opening the tab loads the current selection.
watch(
  [tab, selectedResource],
  () => {
    if (tab.value !== "bundle") return;
    void loadSelectedResource();
  },
  { immediate: true }
);
</script>
