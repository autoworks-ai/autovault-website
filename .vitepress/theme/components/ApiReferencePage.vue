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
        <h1>Three surfaces. <span class="ital">One vocabulary.</span></h1>
        <p class="lede">AutoVault exposes the same primitives — admit, load, render, verify — through three interfaces: a CLI for humans, a library for programs, and an HTTP/MCP endpoint for remote agents. They're versioned together; if a name appears here, it works the same way in all three.</p>
        <div class="api-versions">
          <div class="v"><div class="lbl">CLI</div><div class="val">autovault@{{ PRODUCT_VERSION_SHORT }} <span class="meta">npm · brew · cargo</span></div></div>
          <div class="v"><div class="lbl">Library</div><div class="val">@autovault/sdk@{{ PRODUCT_VERSION_SHORT }} <span class="meta">node, deno, bun</span></div></div>
          <div class="v"><div class="lbl">HTTP</div><div class="val">/api/v1 <span class="meta">+ MCP 2024-11-05</span></div></div>
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

const activeId = ref("cli-init");
const copied = ref("");

const nav: NavItem[] = [
  { kind: "section", label: "CLI", color: "#5a9dd6" },
  { kind: "item", id: "cli-init", method: "cli", label: "init" },
  { kind: "item", id: "cli-add", method: "cli", label: "add" },
  { kind: "item", id: "cli-list", method: "cli", label: "list" },
  { kind: "item", id: "cli-add-local", method: "cli", label: "add-local" },
  { kind: "item", id: "cli-verify", method: "cli", label: "verify" },
  { kind: "item", id: "cli-check-updates", method: "cli", label: "check-updates" },
  { kind: "section", label: "Library", color: "#b48ad6" },
  { kind: "item", id: "lib-load", method: "fn", label: "loadSkill()" },
  { kind: "item", id: "lib-render", method: "fn", label: "renderForTarget()" },
  { kind: "item", id: "lib-verify", method: "fn", label: "verifyChain()" },
  { kind: "section", label: "HTTP / MCP", color: "#5ad6c0" },
  { kind: "item", id: "http-skill", method: "get", label: "/skill/{name}" },
  { kind: "item", id: "http-resolve", method: "post", label: "/resolve" },
  { kind: "item", id: "http-verify", method: "post", label: "/verify" }
];

const sections: ApiSection[] = [
  {
    id: "cli",
    title: "CLI",
    meta: "six commands · everything else is a flag",
    lede: "The CLI is the canonical surface. Library and HTTP are thin wrappers over the same machinery. If a workflow can't be expressed as a CLI invocation, it can't be expressed at all.",
    items: [
      {
        id: "cli-init",
        short: "init",
        title: "autovault init",
        status: "stable",
        since: "0.1.0",
        description: "Scaffold a local vault. Generates a signing key, creates the <code>~/.autovault</code> folder when needed, and writes a starter <code>config.toml</code>.",
        signature: ["<span class=\"pmt\">$</span> autovault init <span class=\"opt\">[--key &lt;path&gt;] [--anchor &lt;url&gt;] [--no-key]</span>"],
        copy: "autovault init",
        argsLabel: "Flag",
        args: [
          { name: "--key", type: "path", description: "Existing Ed25519 private key to import. If omitted, a new key is generated and written under <code>~/.autovault</code>." },
          { name: "--anchor", type: "url <span class=\"def\">= autovault.dev</span>", description: "Trust anchor URL. Override to point at a private vault for self-hosted deployments." },
          { name: "--no-key", type: "flag", description: "Skip key generation. Use this if you only intend to read skills from an existing vault." }
        ],
        examples: [
          { label: "Bash", body: "<div><span class=\"com\"># first local vault</span></div><div><span class=\"pmt\">$</span> autovault init</div><div><span class=\"ok\">  ✓</span> generated key:0x9af4…2c81</div><div><span class=\"ok\">  ✓</span> ~/.autovault created</div><div><span class=\"ok\">  ✓</span> anchored to autovault.dev (root)</div>" },
          { label: "Self-hosted", body: "<div><span class=\"pmt\">$</span> autovault init \\</div><div>    --anchor https://vault.internal.acme.com</div><div><span class=\"ok\">  ✓</span> anchored to vault.internal.acme.com</div>" },
          { label: "Import key", body: "<div><span class=\"pmt\">$</span> autovault init --key ./signing.pem</div><div><span class=\"ok\">  ✓</span> imported key:0xD6A8…5AB4</div>" }
        ]
      },
      {
        id: "cli-add",
        short: "add",
        title: "autovault add <skill>",
        status: "stable",
        since: "0.1.0",
        description: "Resolve, fetch, verify, and install a skill into the current vault. Renders the appropriate transformation for each agent declared in <code>config.toml</code>'s <code>[targets]</code>.",
        signature: ["<span class=\"pmt\">$</span> autovault add <span class=\"key\">&lt;skill&gt;</span> <span class=\"opt\">[@&lt;version&gt;] [--target &lt;agent&gt;] [--dry-run]</span>"],
        copy: "autovault add autoworks-ai/extract-pdf",
        argsLabel: "Argument",
        args: [
          { name: "skill", required: true, type: "string", description: "Fully-qualified name: <code>org/name</code>. Can include <code>@version</code> suffix; otherwise resolves to latest signed version." },
          { name: "--target", type: "enum", description: "Restrict installation to a specific agent: <code>claude-code</code>, <code>codex</code>, <code>cursor</code>, <code>autohub</code>. Repeatable." },
          { name: "--dry-run", type: "flag", description: "Verify and render without writing any files. Useful in CI gates." }
        ],
        examples: [
          { label: "Bash", body: "<div><span class=\"pmt\">$</span> autovault add autoworks-ai/extract-pdf</div><div><span class=\"ok\">  ✓</span> resolved @1.4.0</div><div><span class=\"ok\">  ✓</span> verified ed25519 sig</div><div><span class=\"ok\">  ✓</span> rendered → CLAUDE.md, AGENTS.md, .cursorrules</div>" },
          { label: "Pinned", body: "<div><span class=\"pmt\">$</span> autovault add autoworks-ai/extract-pdf@1.3.2</div><div><span class=\"ok\">  ✓</span> resolved @1.3.2 (pinned)</div>" },
          { label: "Single target", body: "<div><span class=\"pmt\">$</span> autovault add autoworks-ai/extract-pdf \\</div><div>    --target claude-code</div><div><span class=\"ok\">  ✓</span> rendered → CLAUDE.md only</div>" }
        ]
      },
      endpoint("cli-list", "list", "autovault list", "Print the installed skills in this vault, their versions, and the last verification timestamp. Adds <code>--json</code> for machine output.", "$ autovault list [--json] [--stale]", "autovault list"),
      endpoint("cli-add-local", "add-local", "autovault add-local <path>", "Admit a local SKILL.md bundle into the vault. Runs the same gate as remote sources, writes provenance, signs what passes, and can refresh generated profiles.", "$ autovault add-local <path> [--source <id>] [--sync-profiles]", "autovault add-local ./skills/extract-pdf --sync-profiles", "0.2.0"),
      endpoint("cli-verify", "verify", "autovault verify", "Walk the provenance chain for a skill. Resolves the latest version, fetches the signature bundle, and verifies every link from author through mirror.", "$ autovault verify <skill> [--chain] [--offline]", "autovault verify autoworks-ai/extract-pdf", "0.3.0"),
      endpoint("cli-check-updates", "check-updates", "autovault check-updates", "Compare admitted skills against their recorded source sidecars and report upstream drift, including transform review state when applicable.", "$ autovault check-updates [--json]", "autovault check-updates", "0.2.0")
    ]
  },
  {
    id: "lib",
    title: "Library",
    meta: "@autovault/sdk · TypeScript-first",
    lede: "The library is what the CLI calls under the hood. Every CLI command is a thin wrapper. Use it directly when you want skill resolution inside your own tooling — agent harnesses, CI checks, custom inspectors.",
    items: [
      {
        id: "lib-load",
        short: "loadSkill",
        title: "loadSkill(spec, options?)",
        status: "stable",
        since: "0.2.0",
        description: "Resolve and verify a signed skill bundle. Returns the canonical SKILL.md plus its frontmatter, transformations, and provenance chain.",
        signature: ["<span class=\"key\">async function</span> <span class=\"num\">loadSkill</span>(", "  <span class=\"key\">spec</span>: <span class=\"str\">string</span>, <span class=\"com\">// \"org/name@version\" or \"org/name\"</span>", "  <span class=\"key\">options</span>?: <span class=\"str\">LoadOptions</span>", "): <span class=\"key\">Promise</span>&lt;<span class=\"str\">SignedSkill</span>&gt;"],
        copy: "loadSkill(\"autoworks-ai/extract-pdf\")",
        args: [
          { name: "options.anchor", type: "string <span class=\"def\">= \"autovault.dev\"</span>", description: "Trust anchor URL. Skill must chain to a key trusted by this anchor." },
          { name: "options.cache", type: "\"prefer\" | \"none\"", description: "Whether to use the local cache. <code>\"none\"</code> forces a network round-trip." },
          { name: "options.signal", type: "AbortSignal", description: "Standard cancellation signal." }
        ],
        examples: [
          { label: "TypeScript", body: "<div><span class=\"key\">import</span> { loadSkill } <span class=\"key\">from</span> <span class=\"str\">\"@autovault/sdk\"</span>;</div><div></div><div><span class=\"key\">const</span> skill = <span class=\"key\">await</span> loadSkill(<span class=\"str\">\"autoworks-ai/extract-pdf\"</span>);</div><div><span class=\"com\">// skill.frontmatter.version === \"1.4.0\"</span></div>" },
          { label: "Pinned + offline", body: "<div><span class=\"key\">const</span> skill = <span class=\"key\">await</span> loadSkill(</div><div>  <span class=\"str\">\"autoworks-ai/extract-pdf@1.4.0\"</span>,</div><div>  { cache: <span class=\"str\">\"prefer\"</span> }</div><div>);</div>" }
        ]
      },
      endpoint("lib-render", "renderForTarget", "renderForTarget(skill, target)", "Pure function. Takes a verified skill and a target identifier; returns the agent-specific output string.", "function renderForTarget(skill: SignedSkill, target: \"claude-code\" | \"codex\" | \"cursor\" | \"autohub\"): string", "renderForTarget(skill, \"codex\")", "0.2.0"),
      endpoint("lib-verify", "verifyChain", "verifyChain(bundle)", "Verify a provenance chain offline. Takes a bundle from <code>loadSkill()</code>; returns a structured verdict with which links passed, which failed, and why.", "function verifyChain(bundle: SignedSkill): VerifyResult", "verifyChain(bundle)", "0.3.0")
    ]
  },
  {
    id: "http",
    title: "HTTP & MCP",
    meta: "remote endpoint · for sandboxed agents",
    lede: "Use the HTTP surface when an agent runs in an environment without local CLI access — mobile, hosted notebooks, browser-only runtimes. The MCP server bundled with the vault speaks both the vanilla HTTP API below and the MCP protocol on the same port.",
    items: [
      {
        id: "http-skill",
        short: "GET /skill",
        title: "GET /api/v1/skill/{org}/{name}",
        status: "stable",
        since: "0.3.0",
        description: "Fetch a signed skill bundle. Response is signed JSON; clients should verify the signature with the public key from the trust anchor before consuming the body.",
        signature: ["GET /api/v1/skill/<span class=\"key\">{org}</span>/<span class=\"key\">{name}</span><span class=\"opt\">?version=1.4.0&target=claude-code</span>"],
        copy: "curl https://vault.autovault.dev/api/v1/skill/autoworks-ai/extract-pdf",
        argsLabel: "Param",
        args: [
          { name: "org", required: true, type: "path", description: "Publisher org, e.g. <code>autoworks-ai</code>." },
          { name: "name", required: true, type: "path", description: "Skill name within the org." },
          { name: "version", type: "query", description: "Specific version. Omit for latest signed." },
          { name: "target", type: "query", description: "Pre-render the transformation for this target. Reduces caller-side work." }
        ],
        examples: [
          { label: "curl", body: "<div><span class=\"pmt\">$</span> curl https://vault.autovault.dev/api/v1/skill/autoworks-ai/extract-pdf</div><div></div><div><span class=\"key\">{</span></div><div>  <span class=\"str\">\"name\"</span>: <span class=\"str\">\"extract-pdf\"</span>,</div><div>  <span class=\"str\">\"version\"</span>: <span class=\"str\">\"1.4.0\"</span>,</div><div>  <span class=\"str\">\"signature\"</span>: <span class=\"str\">\"ed25519:9af42c81…7e7e\"</span></div><div><span class=\"key\">}</span></div>" },
          { label: "MCP", body: "<div><span class=\"com\">// MCP tool call</span></div><div><span class=\"key\">{</span></div><div>  <span class=\"str\">\"method\"</span>: <span class=\"str\">\"get_skill\"</span>,</div><div>  <span class=\"str\">\"params\"</span>: { <span class=\"str\">\"name\"</span>: <span class=\"str\">\"autoworks-ai/extract-pdf\"</span> }</div><div><span class=\"key\">}</span></div>" }
        ]
      },
      endpoint("http-resolve", "POST /resolve", "POST /api/v1/resolve", "Batch-resolve a list of skill specs to their latest signed versions. Useful for vaults that want to refresh many skills in one round-trip.", "POST /api/v1/resolve\n\n{ \"specs\": [\"autoworks-ai/extract-pdf\"], \"target\": \"claude-code\" }", "POST /api/v1/resolve", "0.3.0"),
      endpoint("http-verify", "POST /verify", "POST /api/v1/verify", "Server-side reproducible verification. Send a bundle; the vault re-runs the gate and returns whether its verdict matches what the bundle claims.", "POST /api/v1/verify\n\n// body: a SignedSkill bundle", "POST /api/v1/verify", "0.4.0", "beta")
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
