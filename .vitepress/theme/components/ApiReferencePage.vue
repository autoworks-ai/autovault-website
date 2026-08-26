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
        <p class="lede">Current {{ PRODUCT_VERSION }} surfaces are the local CLI, source ESM library exports, local stdio MCP, and remote Streamable HTTP MCP at <code>/mcp</code>. There is no public REST API or separately published SDK package yet; MCP tools are the agent-facing API.</p>
        <div class="api-versions">
          <div class="v"><div class="lbl">CLI</div><div class="val">autovault@{{ PRODUCT_VERSION_SHORT }} <span class="meta">npm · brew · GHCR</span></div></div>
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
            <div v-for="(line, index) in endpoint.signature" :key="index">
              <span v-if="line.prompt" class="pmt">$</span><span>{{ line.text }}</span>
            </div>
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
import { PRODUCT_RELEASE_LABEL, PRODUCT_VERSION, PRODUCT_VERSION_SHORT } from "../data/product";

type ExampleTab = { label: string; body: string };
type ApiArg = { name: string; type: string; description: string; required?: boolean };
type SignatureLine = { prompt: boolean; text: string };
type ApiEndpoint = {
  id: string;
  short: string;
  title: string;
  status: "stable" | "beta" | "alpha";
  since: string;
  description: string;
  signature: SignatureLine[];
  copy: string;
  argsLabel?: string;
  args?: ApiArg[];
  examples?: ExampleTab[];
};
type ApiSection = { id: string; title: string; meta: string; lede: string; items: ApiEndpoint[] };
type NavItem = { kind: "section"; label: string; color: string } | { kind: "item"; id: string; method: "cli" | "fn" | "get" | "post" | "env"; label: string };

const activeId = ref("cli-add");
const copied = ref("");

const nav: NavItem[] = [
  { kind: "section", label: "CLI", color: "#5a9dd6" },
  { kind: "item", id: "cli-add", method: "cli", label: "add" },
  { kind: "item", id: "cli-remove", method: "cli", label: "remove" },
  { kind: "item", id: "cli-sync-profiles", method: "cli", label: "sync-profiles" },
  { kind: "item", id: "cli-setup", method: "cli", label: "setup" },
  { kind: "item", id: "cli-doctor", method: "cli", label: "doctor" },
  { kind: "item", id: "cli-audit-repo", method: "cli", label: "audit-repo" },
  { kind: "item", id: "cli-resolve", method: "cli", label: "resolve" },
  { kind: "item", id: "cli-skill-list", method: "cli", label: "skill list" },
  { kind: "item", id: "cli-skill-search", method: "cli", label: "skill search" },
  { kind: "item", id: "cli-skill-which", method: "cli", label: "skill which" },
  { kind: "item", id: "cli-skill-action", method: "cli", label: "skill <action>" },
  { kind: "item", id: "cli-serve", method: "cli", label: "serve" },
  { kind: "section", label: "Environment", color: "#d6a85a" },
  { kind: "item", id: "env-cli-runtime", method: "env", label: "CLI runtime" },
  { kind: "item", id: "env-install-script", method: "env", label: "Install script" },
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
    lede: "The CLI is the local operator surface. It installs local bundles and remote skill sources, runs the setup wizard, syncs host profiles, audits repositories, resolves capability visibility, inspects installed skills, and starts the remote service when you self-host.",
    items: [
      endpoint("cli-add", "add", "autovault add <source-or-path>", "Admit a known skill from a local path, GitHub identifier or URL, agentskills slug, or direct HTTPS <code>SKILL.md</code> URL. The command collects sibling resources when available, rejects symlinks, validates, signs, records provenance, and can refresh profile links. Use <code>--agent</code> for remote skills that do not declare target agents, <code>--yes</code> for non-TTY automation, and <code>--provenance</code> to keep the recorded source identifier when replacing a local skill from a staging directory.", "$ autovault add <source-or-path> [--source github|agentskills|url|local] [--provenance <value>] [--version <v>] [--agent <agent>] [--sync-profiles|--no-sync-profiles] [--discover|--no-discover] [--link agent=/path/to/skills] [--dry-run] [--yes] [--quiet] [--verbose] [--json]\n$ autovault add ./skills/skill-author --sync-profiles --yes\n$ autovault add ./staging/skill-author --source local --provenance '<existing-identifier>' --sync-profiles --yes\n$ autovault add autoworks-ai/autovault:skills/skill-author/SKILL.md --sync-profiles --yes\n$ autovault add skill-slug --source agentskills --sync-profiles --agent codex --yes\n$ autovault add https://example.com/SKILL.md --source url --no-sync-profiles --yes", "autovault add ./skills/skill-author --sync-profiles --yes", "0.4.0"),
      endpoint("cli-remove", "remove", "autovault remove <skill-name>", "Remove a vaulted skill, delete vault-local transforms for that skill, and refresh managed profile links. Native profile-root discovery is on by default, so AutoVault prunes managed symlinks from discovered host roots such as <code>~/.claude/skills</code>, <code>~/.codex/skills</code>, and <code>~/.cursor/skills</code>. Use <code>--no-discover</code> to refresh only the vault's internal profile tree, <code>--link agent=/path</code> for an explicit host root, and <code>--json</code> for automation.", "$ autovault remove <skill-name> [--discover|--no-discover] [--link agent=/path/to/skills] [--json]", "autovault remove skill-author --json", "0.3.0"),
      endpoint("cli-sync-profiles", "sync-profiles", "autovault sync-profiles", "Regenerate local filesystem-native profile links for detected or configured host skill roots. Reports <code>restart_required: true</code> when symlinks change so the operator knows to reload their agent session. Remote mode cannot perform this on client machines.", "$ autovault sync-profiles [--discover] [--link agent=/path/to/skills]", "autovault sync-profiles --discover", "0.2.0"),
      endpoint("cli-setup", "setup", "autovault setup", "Interactive wizard that scans the vault, the bundled skills root, and any discovered native agent skill roots (<code>~/.claude/skills</code>, <code>~/.codex/skills</code>, <code>~/.cursor/skills</code>), then offers a per-skill adoption decision. The wizard requires a TTY; without one it exits with code <code>2</code> and a <code>NoTtyError</code>. Re-run any time to re-scan. Three adoption modes: <strong>augment</strong> (safe default) refreshes profile symlinks only — existing native dirs are not touched; <strong>backup</strong> renames each native dir to <code>&lt;root&gt;.bak/&lt;name&gt;</code>, admits the bytes into the vault, then replaces the original with a managed symlink (the typical “import my skills” choice); <strong>in-place</strong> admits the bytes then removes the native dir and replaces with a symlink — destructive, no backup. After adoption the wizard runs <code>sync-profiles</code>, which emits <code>restart_required: true</code> when symlinks change.", "$ autovault setup [--json] [--review] [--advanced]", "autovault setup --review", "0.2.0"),
      endpoint("cli-doctor", "doctor", "autovault doctor", "Inspect local vault health, installed skill integrity, ignored OS/editor metadata, and profile visibility. <code>--clean</code> removes ignored OS/editor metadata. <code>--repair</code> re-signs unsigned local skills only — it refuses tampered metadata and remote sources. <code>--json</code> emits a structured report with <code>repair_status</code> per skill.", "$ autovault doctor [skill-name] [--clean] [--repair] [--json]", "autovault doctor --repair", "0.2.0"),
      endpoint("cli-audit-repo", "audit-repo", "autovault audit-repo", "Walk a repository for vendored <code>SKILL.md</code> files, validate each through the same admission gate the vault uses, and emit a report. Useful for CI checks that block merging unsigned or invalid skills.", "$ autovault audit-repo --repo /path/to/repo [--format json|markdown]", "autovault audit-repo --repo ./vendor/skills --format markdown", "0.2.0"),
      endpoint("cli-resolve", "resolve", "autovault resolve", "Resolve which skills are visible to a given caller, platform, channel, and query. This exposes the same capability resolution the MCP server runs internally. Output is JSON; <code>--channel</code> is optional, the rest are required.", "$ autovault resolve --caller <id> --platform <name> [--channel <id>] --query <text>", "autovault resolve --caller claude-code --platform local --query review", "0.2.0"),
      endpoint("cli-skill-list", "skill list", "autovault skill list", "List installed skills as JSON, with each skill’s declared <code>bin.*</code> action names. Reserved action names (<code>list</code>, <code>search</code>, <code>which</code>) cannot be declared as bin actions.", "$ autovault skill list", "autovault skill list", "0.2.0"),
      endpoint("cli-skill-search", "skill search", "autovault skill search", "Run local metadata text search over installed skills. Searches names, descriptions, tags, categories, and when-to-use metadata; embedding-backed semantic search is future work.", "$ autovault skill search <query> [--top-k N]", "autovault skill search code-review --top-k 5", "0.2.1"),
      endpoint("cli-skill-which", "skill which", "autovault skill which", "Print the resolved script path(s) for a skill without running them. Verifies the signed manifest before parsing. With <code>&lt;action&gt;</code>, prints the single command/args/cwd for that action; without, prints all declared actions.", "$ autovault skill which <name> [<action>]", "autovault skill which skill-author setup", "0.2.0"),
      endpoint("cli-skill-action", "skill <action>", "autovault skill <action> <name>", "Generic dispatch that delegates to the named skill’s <code>bin.&lt;action&gt;</code> handler. The skill’s signed manifest declares which actions exist; <code>list</code>, <code>search</code>, and <code>which</code> are reserved.", "$ autovault skill <action> <name>", "autovault skill setup skill-author", "0.2.0"),
      endpoint("cli-serve", "serve", "autovault serve", "Start the remote Streamable HTTP MCP service. Set <code>AUTOVAULT_MODE=remote</code>, <code>AUTOVAULT_PUBLIC_URL</code>, admin credentials, and storage path before exposing it.", "$ autovault serve", "AUTOVAULT_MODE=remote autovault serve", "0.2.1")
    ]
  },
  {
    id: "env",
    title: "Environment variables",
    meta: "process env · CLI runtime + install script",
    lede: "Two distinct groups. The first is honored by the <code>autovault</code> CLI binary at runtime (parsed in <code>src/config.ts</code>). The second is read only by <code>scripts/install.sh</code> during the initial install; the CLI does not read these.",
    items: [
      {
        id: "env-cli-runtime",
        short: "CLI runtime",
        title: "CLI runtime variables",
        status: "stable" as const,
        since: "0.2.0",
        description: "Set these before invoking the <code>autovault</code> CLI or starting <code>autovault serve</code>. Logs are JSON lines on <strong>stderr only</strong>; stdout is reserved for MCP framing — never write to stdout from server code.",
        copy: "AUTOVAULT_STORAGE_PATH=~/.autovault autovault doctor",
        signature: signatureLines("$ AUTOVAULT_STORAGE_PATH=~/.autovault autovault doctor"),
        argsLabel: "Variable",
        args: [
          { name: "AUTOVAULT_STORAGE_PATH", type: "<code>~/.autovault</code>", description: "Vault root directory. Default if unset." },
          { name: "AUTOVAULT_DB_PATH", type: "<code>&lt;storage&gt;/autovault.sqlite</code>", description: "Override the SQLite index location; defaults under the storage path." },
          { name: "AUTOVAULT_MODE", type: "<code>local</code> | <code>remote</code>", description: "<code>local</code> runs the stdio MCP server. Set to <code>remote</code> before <code>autovault serve</code>." },
          { name: "AUTOVAULT_PUBLIC_URL", type: "<code>https://&lt;host&gt;</code>", description: "Required when running <code>autovault serve</code> behind a reverse proxy. Must match the externally visible URL." },
          { name: "AUTOVAULT_HTTP_PORT", type: "<code>3000</code>", description: "Listen port for the remote MCP service. Some platforms inject <code>PORT</code> instead; check your host." },
          { name: "AUTOVAULT_ALLOWED_ORIGINS", type: "comma-separated", description: "CORS allowlist for remote mode. Comma-separated origins." },
          { name: "AUTOVAULT_PROFILE_LINKS", type: "<code>agent=/path,&hellip;</code>", description: "Override discovered profile roots. Comma-separated <code>agent=/path</code> pairs." },
          { name: "AUTOVAULT_SECURITY_STRICT", type: "<code>true</code>", description: "When <code>true</code> (default), security-flag hits block admission. Set <code>false</code> to downgrade them to warnings." },
          { name: "AUTOVAULT_LOG_LEVEL", type: "<code>info</code>", description: "One of <code>debug</code> / <code>info</code> / <code>warn</code> / <code>error</code>. JSON-line output on stderr." },
          { name: "AUTOVAULT_SEARCH_MODE", type: "<code>text</code>", description: "Search backend. Today only <code>text</code> is supported; embedding-backed search is future work." },
          { name: "AUTOVAULT_ADMIN_EMAIL", type: "email", description: "Remote mode: initial admin email. Used by the OAuth bootstrap on first boot." },
          { name: "AUTOVAULT_ADMIN_PASSWORD", type: "string &ge; 12 chars", description: "Remote mode: initial admin password. Hashed on first boot." }
        ]
      },
      {
        id: "env-install-script",
        short: "Install script",
        title: "Install script variables",
        status: "stable" as const,
        since: "0.2.0",
        description: "Read only by <code>scripts/install.sh</code> during the initial install. The <code>autovault</code> binary does not parse these — they shape the installer's interactive flow.",
        copy: "AUTOVAULT_NO_SETUP=1 curl -fsSL https://autovault.sh | sh",
        signature: signatureLines("$ AUTOVAULT_NO_SETUP=1 curl -fsSL https://autovault.sh | sh"),
        argsLabel: "Variable",
        args: [
          { name: "AUTOVAULT_NO_SETUP", type: "<code>1</code>", description: "Skip launching the setup wizard at install time; the installer prints a hint to run <code>autovault setup</code> from a terminal afterward." },
          { name: "AUTOVAULT_YES", type: "<code>1</code>", description: "Accept default answers in the installer's non-prompt branches. Referenced in the <code>NoTtyError</code> message <code>setup</code> prints when invoked without a TTY." },
          { name: "AUTOVAULT_NO_BOOTSTRAP", type: "<code>1</code>", description: "Skip <code>bootstrap-skills.mjs</code>. No bundled skills are installed. Primarily for development." }
        ]
      }
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
      endpoint("mcp-add-skill", "add_skill", "add_skill", "Install a known skill from GitHub, agentskills, HTTPS URL, or local bundle source. Caller-authored bytes should use <code>propose_skill</code> instead. For local bundles, pass <code>skill_dir</code> and an explicit <code>identifier</code> matching the CLI provenance value.", "{ source: \"github\" | \"agentskills\" | \"url\" | \"local\", identifier: string, ... }", "add_skill({ source: \"github\", identifier: \"owner/repo:skills/example/SKILL.md\" })"),
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
    signature: signatureLines(signature)
  };
}

function signatureLines(signature: string): SignatureLine[] {
  return signature.split("\n").map((line) => {
    if (line.startsWith("$ ")) return { prompt: true, text: line.slice(2) };
    return { prompt: false, text: line };
  });
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
