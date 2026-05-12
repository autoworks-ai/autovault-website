<template>
  <div class="api-shell reveal-page">
    <aside class="api-nav reveal-item">
      <div class="api-nav-title">API reference</div>
      <template v-for="item in nav" :key="item.kind === 'section' ? item.label : item.id">
        <div v-if="item.kind === 'section'" class="api-nav-section-title">
          <span class="dot" :style="{ background: item.color }" />
          {{ item.label }}
        </div>
        <a v-else :href="`#${item.id}`" :class="{ active: activeId === item.id }" @click="activeId = item.id">
          <span :class="['meth', item.method]">{{ item.method.toUpperCase() }}</span>
          {{ item.label }}
        </a>
      </template>
    </aside>

    <main class="api-main">
      <section class="api-hero reveal-item">
        <div class="eyebrow"><span class="dash" /> Reference · {{ PRODUCT_RELEASE_LABEL }}</div>
        <h1>Current surfaces. <span class="ital">Clear boundaries.</span></h1>
        <p class="lede">Current v0.2.1 surfaces are the local CLI, source ESM library exports, local stdio MCP, and remote Streamable HTTP MCP at <code>/mcp</code>. There is no public REST API or separately published SDK package yet; MCP tools are the agent-facing API.</p>
        <div class="api-versions">
          <div class="v"><div class="lbl">CLI</div><div class="val">autovault@{{ PRODUCT_VERSION_SHORT }} <span class="meta">npm · brew · cargo</span></div></div>
          <div class="v"><div class="lbl">Library</div><div class="val">source ESM exports <span class="meta">Node/TypeScript</span></div></div>
          <div class="v"><div class="lbl">Remote</div><div class="val">/mcp <span class="meta">Streamable HTTP MCP</span></div></div>
        </div>
      </section>

      <section v-for="section in sections" :id="section.id" :key="section.id" class="api-section reveal-item">
        <div class="api-h2">
          <h2>{{ section.title }}</h2>
          <span class="meta">{{ section.meta }}</span>
        </div>
        <p class="api-section-lede">{{ section.lede }}</p>

        <article v-for="endpoint in section.items" :id="endpoint.id" :key="endpoint.id" class="api-endpoint">
          <div class="head">
            <h3>{{ endpoint.title }}</h3>
            <span :class="['status-pill', endpoint.status]">{{ endpoint.status }}</span>
            <span :class="['since', endpoint.status === 'beta' ? 'beta' : '']">since {{ endpoint.since }}</span>
          </div>
          <p class="desc" v-html="endpoint.description" />
          <div class="api-sig">
            <button class="copy" type="button" @click="copyText(endpoint.copy, endpoint.id)">{{ copied === endpoint.id ? "Copied" : "Copy" }}</button>
            <div v-for="(line, index) in endpoint.signature" :key="index" v-html="line" />
          </div>
          <div v-if="endpoint.args?.length" class="api-args">
            <div class="head"><span>{{ endpoint.argsLabel ?? "Field" }}</span><span>Type</span><span>Description</span></div>
            <div v-for="arg in endpoint.args" :key="arg.name" class="row">
              <span class="nm">{{ arg.name }} <span v-if="arg.required" class="req">*</span><span v-else class="opt">opt</span></span>
              <span class="ty" v-html="arg.type" />
              <span class="desc" v-html="arg.description" />
            </div>
          </div>
          <TabbedExample v-if="endpoint.examples?.length" :tabs="endpoint.examples" />
        </article>
      </section>
    </main>

    <aside class="api-toc reveal-item">
      <div class="ttl">On this page</div>
      <template v-for="section in sections" :key="`toc-${section.id}`">
        <a :href="`#${section.id}`">{{ section.title }}</a>
        <a v-for="endpoint in section.items" :key="endpoint.id" :class="['l2', { active: activeId === endpoint.id }]" :href="`#${endpoint.id}`" @click="activeId = endpoint.id">{{ endpoint.short }}</a>
      </template>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, ref } from "vue";
import { PRODUCT_RELEASE_LABEL, PRODUCT_VERSION_SHORT } from "../data/product";

type ExampleTab = { label: string; body: string };
type ApiArg = { name: string; type: string; description: string; required?: boolean };
type ApiEndpoint = {
  id: string;
  short: string;
  title: string;
  status: "stable" | "beta" | "alpha";
  since: string;
  description: string;
  signature: string[];
  copy: string;
  argsLabel?: string;
  args?: ApiArg[];
  examples?: ExampleTab[];
};
type ApiSection = { id: string; title: string; meta: string; lede: string; items: ApiEndpoint[] };
type NavItem = { kind: "section"; label: string; color: string } | { kind: "item"; id: string; method: "cli" | "fn" | "get" | "post"; label: string };

const activeId = ref("cli-add-local");
const copied = ref("");

const nav: NavItem[] = [
  { kind: "section", label: "CLI", color: "#5a9dd6" },
  { kind: "item", id: "cli-add-local", method: "cli", label: "add-local" },
  { kind: "item", id: "cli-sync-profiles", method: "cli", label: "sync-profiles" },
  { kind: "item", id: "cli-doctor", method: "cli", label: "doctor" },
  { kind: "item", id: "cli-skill-search", method: "cli", label: "skill search" },
  { kind: "item", id: "cli-serve", method: "cli", label: "serve" },
  { kind: "section", label: "Library exports", color: "#b48ad6" },
  { kind: "item", id: "lib-resolve", method: "fn", label: "resolveCapabilities()" },
  { kind: "item", id: "lib-install", method: "fn", label: "skill lifecycle" },
  { kind: "item", id: "lib-profiles", method: "fn", label: "syncProfiles()" },
  { kind: "section", label: "MCP tools", color: "#5ad6c0" },
  { kind: "item", id: "mcp-get-skill", method: "fn", label: "get_skill" },
  { kind: "item", id: "mcp-add-skill", method: "fn", label: "add_skill" },
  { kind: "item", id: "mcp-propose-skill", method: "fn", label: "propose_skill" },
  { kind: "item", id: "mcp-check-updates", method: "fn", label: "check_updates" }
];

const sections: ApiSection[] = [
  {
    id: "cli",
    title: "CLI",
    meta: "user-facing local operations",
    lede: "The CLI is the local operator surface. It installs local bundles, syncs host profiles, audits repository capabilities, inspects installed skills, and starts the remote service when you self-host.",
    items: [
      endpoint("cli-add-local", "add-local", "autovault add-local <path>", "Admit a local SKILL.md bundle. The command collects sibling resources, rejects symlinks, validates, signs, records local provenance, and can refresh profile links.", "$ autovault add-local <skill-dir> --source <repo-or-url> [--sync-profiles] [--link agent=/path/to/skills] [--json]", "autovault add-local ./skills/skill-author --source vendor/skills --sync-profiles", "0.2.0"),
      endpoint("cli-sync-profiles", "sync-profiles", "autovault sync-profiles", "Regenerate local filesystem-native profile links for detected or configured host skill roots. Remote mode cannot perform this on client machines.", "$ autovault sync-profiles [--discover] [--link agent=/path/to/skills]", "autovault sync-profiles --discover", "0.2.0"),
      endpoint("cli-doctor", "doctor", "autovault doctor", "Inspect local vault health, installed skill integrity, ignored OS/editor metadata, and profile visibility. Add <code>--clean</code> only to remove ignored artifacts.", "$ autovault doctor [skill-name] [--clean] [--json]", "autovault doctor --json", "0.2.0"),
      endpoint("cli-skill-search", "skill search", "autovault skill search", "Run local metadata text search over installed skills. This searches names, descriptions, tags, categories, and when-to-use metadata; embedding-backed semantic search is future work.", "$ autovault skill search <query> [--top-k N]", "autovault skill search code-review --top-k 5", "0.2.1"),
      endpoint("cli-serve", "serve", "autovault serve", "Start the remote Streamable HTTP MCP service. Set <code>AUTOVAULT_MODE=remote</code>, <code>AUTOVAULT_PUBLIC_URL</code>, admin credentials, and storage path before exposing it.", "$ autovault serve", "AUTOVAULT_MODE=remote autovault serve", "0.2.1")
    ]
  },
  {
    id: "lib",
    title: "Library exports",
    meta: "source package · TypeScript-first",
    lede: "The source package exports the same storage, validation, profile-sync, and capability-resolution helpers used by the CLI and MCP server. This is useful for local integrations built from the repository; it is not a separately documented public SDK package.",
    items: [
      endpoint("lib-resolve", "resolveCapabilities", "resolveCapabilities(input)", "Resolve tools, skills, and MCP servers for a scoped caller request. Unknown callers fail closed unless mapped to a restricted profile.", "resolveCapabilities({ caller_id, platform, query, channel })", "resolveCapabilities({ caller_id: \"codex\", platform: \"local\", query: \"review\" })", "0.2.1"),
      endpoint("lib-install", "lifecycle", "skill lifecycle helpers", "Grouped source exports for installing from configured sources, validating caller-authored SKILL.md bytes, or refreshing an installed skill. MCP tools wrap these same helpers.", "addSkill(input)\nproposeSkill(input)\nupdateSkill(input)", "proposeSkill({ skill_md })", "0.2.0"),
      endpoint("lib-profiles", "syncProfiles", "syncProfiles(input)", "Regenerate per-agent and tag-filtered profile symlinks from installed skill metadata and optional profile config.", "syncProfiles({ discover: true, profileRoots })", "syncProfiles({ discover: true })", "0.2.0")
    ]
  },
  {
    id: "mcp",
    title: "MCP tools",
    meta: "local stdio · remote /mcp",
    lede: "MCP tools are the agent-facing API. Local hosts spawn the stdio server; remote clients connect to Streamable HTTP MCP at <code>/mcp</code> with OAuth and role-aware filtering.",
    items: [
      endpoint("mcp-get-skill", "get_skill", "get_skill", "Search by query or fetch one installed skill by name. Pass <code>include_resources</code> when packaged resource files are needed.", "{ query?: string, name?: string, agent?: string, include_resources?: boolean }", "get_skill({ query: \"code review\" })"),
      endpoint("mcp-add-skill", "add_skill", "add_skill", "Install a known skill from GitHub, agentskills, HTTPS URL, or local bundle source. Caller-authored bytes should use <code>propose_skill</code> instead.", "{ source: \"github\" | \"agentskills\" | \"url\" | \"local\", identifier: string, ... }", "add_skill({ source: \"url\", identifier: \"https://example.com/SKILL.md\" })"),
      endpoint("mcp-propose-skill", "propose_skill", "propose_skill", "Submit newly authored SKILL.md content for validation, security scan, capability cross-check, deduplication, signing, and storage.", "{ skill_md: string, resources?: Array<{ path: string, content: string }> }", "propose_skill({ skill_md })"),
      endpoint("mcp-check-updates", "check_updates", "check_updates", "Compare installed skills against recorded upstream source state and report drift, unchecked inline skills, warnings, and errors.", "{ skill?: string }", "check_updates({ skill: \"skill-author\" })")
    ]
  }
];

const TabbedExample = defineComponent({
  props: {
    tabs: { type: Array as () => ExampleTab[], required: true }
  },
  setup(props) {
    const active = ref(0);
    return () => h("div", { class: "api-examples" }, [
      h("div", { class: "tabs" }, props.tabs.map((tab, index) => h("button", { type: "button", class: { active: active.value === index }, onClick: () => { active.value = index; } }, tab.label))),
      h("div", { class: "body", innerHTML: props.tabs[active.value]?.body ?? "" })
    ]);
  }
});

function endpoint(id: string, short: string, title: string, description: string, signature: string, copy: string, since = "0.1.0", status: "stable" | "beta" | "alpha" = "stable"): ApiEndpoint {
  return {
    id,
    short,
    title,
    status,
    since,
    description,
    copy,
    signature: signature.split("\n").map((line) => line.replace(/^\$ /, "<span class=\"pmt\">$</span> "))
  };
}

async function copyText(text: string, key: string) {
  copied.value = key;
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // Clipboard is a progressive enhancement in the static docs.
  }
  window.setTimeout(() => {
    if (copied.value === key) copied.value = "";
  }, 1200);
}
</script>
