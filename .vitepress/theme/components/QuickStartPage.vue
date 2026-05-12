<template>
  <div class="docs-rich docs-final quickstart-final">
    <section class="docs-hero qs-hero qs-final-hero">
      <div>
        <AvDocBreadcrumb section="Get started" page="Quick start" />
        <div class="eyebrow"><span class="dash" /> Install · 5 minutes</div>
        <h1>Install AutoVault.<br><span class="ital">One command. No daemon.</span></h1>
        <p class="lede">Create the local vault, admit a signed skill, scope it to the agents that need it, and run the same capability from Claude Code, Codex, or Cursor without maintaining forks.</p>

        <div class="install-final-card" aria-label="Install command">
          <div class="install-tabs" aria-label="Install method">
            <button
              v-for="method in INSTALL_METHODS"
              :key="method"
              :class="{ active: selectedMethod === method }"
              type="button"
              :aria-pressed="selectedMethod === method"
              @click="selectedMethod = method"
            >
              {{ method }}
            </button>
            <span class="tabs-sep" />
            <span class="tabs-meta">{{ PRODUCT_VERSION_BADGE }}</span>
          </div>
          <div class="install-cmd">
            <span class="prompt">$</span>
            <code>{{ INSTALL_COMMANDS[selectedMethod] }}</code>
            <button class="copy-btn" :class="{ copied }" type="button" @click="copyInstall">{{ copied ? "copied" : "copy" }}</button>
          </div>
          <div class="install-foot">
            <span class="dot live" />
            <span>Installer endpoint: <code>autovault.sh</code></span>
            <a href="https://github.com/autoworks-ai/autovault">view source</a>
          </div>
        </div>

        <div class="prereqs" aria-label="Requirements">
          <span class="prereq-label">requires</span>
          <span v-for="item in PREREQS" :key="item.label" class="prereq">
            <span class="lbl">{{ item.label }}</span>
            <span class="sub">{{ item.detail }}</span>
          </span>
        </div>
      </div>

      <TerminalDemo />
    </section>

    <h2 id="install">Step 1 — Install the local vault</h2>
    <p>The installer writes <code>~/.autovault</code>, installs the local CLI shim, preserves the folder as user-owned storage, and bootstraps bundled skills unless <code>AUTOVAULT_NO_BOOTSTRAP=1</code> is set. Nothing runs as a background daemon; local MCP hosts spawn stdio on demand.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> curl <span class="arg">-fsSL</span> https://autovault.sh <span class="muted">|</span> sh<br />
<span class="yaml-comment"># macOS: also available through the tap</span><br />
<span class="pmt">$</span> brew install autoworks-ai/tap/autovault<br />
<span class="pmt">$</span> autovault skill list</CodeBlock>
    <div class="callout tip"><div class="callout-dot" /><div><strong>Bundled skills.</strong> The installer seeds first-party bundled skills through the same validation path used by remote installs and proposals, then refreshes discovered host profiles.</div></div>

    <h2 id="agent-assisted">Agent-assisted setup</h2>
    <p>If you want Claude Code to configure its own AutoVault bootstrap skill, give it this prompt. The hosted skill is a raw <code>SKILL.md</code>; the agent should fetch it, show you the behavior, install it locally only after approval, then run it.</p>
    <CodeBlock lang="text" file="Claude Code prompt">{{ AGENT_SETUP_PROMPT }}</CodeBlock>
    <div class="callout warn"><div class="callout-dot" /><div><strong>Opt-in by design.</strong> The bootstrap skill stages the installer for inspection, asks before shell execution, then runs <code>autovault doctor</code> and <code>autovault sync-profiles --discover</code>.</div></div>

    <h2 id="verify">Step 2 — Verify the install</h2>
    <p>One command confirms the binary, local vault folder, profile discovery, and signing key are ready before any skill enters the vault.</p>
    <div class="terminal static-terminal">
      <div class="terminal-head"><span class="dot live" /><span class="dot" /><span class="dot" /><span class="ttl">autovault doctor</span></div>
      <div class="terminal-body compact">
        <div class="line"><span class="pmt">$</span><span>autovault doctor</span></div>
        <div class="ok">  ✓ binary signed · {{ PRODUCT_VERSION }}</div>
        <div class="ok">  ✓ ~/.autovault initialized · bundled skills indexed</div>
        <div class="ok">  ✓ local keypair available · ed25519</div>
        <div class="ok">  ✓ detected agents · claude-code, codex</div>
        <div class="out">  ↳ next: autovault add &lt;source&gt;</div>
      </div>
    </div>

    <h2 id="first">Step 3 — Add your first skill</h2>
    <p>Skills enter through a source adapter. Each adapter fetches from one origin and hands the raw skill to the validation gate. Whatever the source, the gate runs the same checks before admission.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault <span class="arg">add</span> url:https://autovault.dev/skills/skill-author/SKILL.md</CodeBlock>
    <div class="terminal static-terminal">
      <div class="terminal-head"><span class="dot live" /><span class="dot" /><span class="dot" /><span class="ttl">gate run · skill-author</span></div>
      <div class="terminal-body compact">
        <div class="out">  ↳ fetching skill-author v1.0.0</div>
        <div class="ok">  ✓ yaml-repair · frontmatter clean</div>
        <div class="ok">  ✓ denylist · no known bad patterns</div>
        <div class="ok">  ✓ capability/behavior · declared matches observed</div>
        <div class="ok">  ✓ dedup · no near match in vault</div>
        <div class="ok">  ✓ sign · ed25519 provenance recorded</div>
      </div>
    </div>

    <h2 id="vault-anatomy">The vault is a folder</h2>
    <p>The final model is intentionally boring: a regular folder on disk. This is the current implementation layout: SQLite index, local signing key, source skills, source metadata, signed manifests, rendered variants, and profile links. Select a row to inspect how the folder is read.</p>
    <div class="vault-anatomy">
      <div class="vault-tree" aria-label="Vault folder tree">
        <button
          v-for="row in VAULT_TREE"
          :key="`${row.depth}-${row.label}`"
          class="vault-tree-row"
          :class="[row.kind, { active: selectedVaultRow === row.id }]"
          :disabled="!row.id"
          :style="depthStyle(row.depth)"
          type="button"
          @mouseenter="selectVaultRow(row.id)"
          @focus="selectVaultRow(row.id)"
          @click="selectVaultRow(row.id)"
        >
          <span class="tree-indent" aria-hidden="true" />
          <span class="tree-label">{{ row.label }}</span>
        </button>
      </div>
      <aside class="vault-note">
        <div class="side-eyebrow">↳ {{ activeVaultNote.title }}</div>
        <p>{{ activeVaultNote.body }}</p>
        <div v-if="activeVaultNote.tags?.length" class="side-tags">
          <span v-for="tag in activeVaultNote.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </aside>
    </div>

    <h2 id="scope">Step 4 — Scope it to your context</h2>
    <p>By default a freshly added skill is visible only after you scope it. A caller sees a skill when it matches the agents and projects you approved, so dev-machine skills do not leak into prod and client work does not bleed across projects.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault <span class="arg">scope</span> skill-author \<br />
    <span class="arg">--agent</span> claude-code,codex \<br />
    <span class="arg">--project</span> autovault-website \<br />
    <span class="arg">--device</span> $(hostname)<br />
<span class="pmt">$</span> autovault sync-profiles <span class="arg">--discover</span></CodeBlock>

    <div class="access-table" aria-label="How agents read from the vault">
      <div class="access-row head">
        <span>Agent</span>
        <span>Reads from</span>
        <span>How</span>
      </div>
      <div v-for="row in ACCESS_ROWS" :key="row.agent" class="access-row">
        <span class="agent">{{ row.agent }}</span>
        <span class="path">{{ row.path }}</span>
        <span class="via">{{ row.via }}</span>
      </div>
    </div>

    <h2 id="run">Step 5 — Run it from your agent</h2>
    <p>The same skill is now validated, scoped, and rendered for each target agent. The skill name stays stable, while tool names are transformed to match the caller.</p>
    <div class="agent-tabs" aria-label="Agent">
      <button v-for="item in agentOptions" :key="item.id" :class="{ active: agent === item.id }" type="button" :aria-pressed="agent === item.id" @click="agent = item.id"><span class="agent-dot" :style="{ background: item.color }" />{{ item.label }}</button>
    </div>
    <CodeBlock :lang="activeAgent.label.toLowerCase()" :file="`# in ${activeAgent.label}`"><span class="pmt">&gt;</span> {{ activeAgent.cmd }}<br />
<span class="yaml-comment">{{ activeAgent.out }}</span><br />
<span class="yaml-comment"># extracting...</span><br />
"This 24-page report covers Q1 platform metrics, with three..."</CodeBlock>

    <h2 id="next">Where to next</h2>
    <div class="next-grid">
      <a class="next-card" href="/authoring">
        <div class="next-num">01</div>
        <div class="next-title">Author a SKILL.md</div>
        <div class="next-body">Write one canonical skill, declare tools and scope, then run it through the browser gate.</div>
        <div class="next-cta">Read →</div>
      </a>
      <a class="next-card" href="/security">
        <div class="next-num">02</div>
        <div class="next-title">Security model</div>
        <div class="next-body">Understand signing, provenance, denylist scans, and where runtime enforcement lives.</div>
        <div class="next-cta">Read →</div>
      </a>
      <a class="next-card" href="/deploy">
        <div class="next-num">03</div>
        <div class="next-title">Self-host team mode</div>
        <div class="next-body">Deploy the remote MCP surface for teams without changing the local-first source of truth.</div>
        <div class="next-cta">Read →</div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from "vue";
import AvDocBreadcrumb from "./AvDocBreadcrumb.vue";
import CodeBlock from "./CodeBlock.vue";
import { useTerminalReplay, type TerminalReplayLine } from "../composables/useTerminalReplay";
import { PRODUCT_VERSION, PRODUCT_VERSION_BADGE } from "../data/product";
import { AUTOVAULT_AGENT_SETUP_PROMPT, AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";
import { copyText } from "../utils/clipboard";

type Method = "curl" | "brew";
type VaultRow = { depth: number; label: string; kind: "dir" | "file" | "sig"; id?: string };

const INSTALL_METHODS: Method[] = ["curl", "brew"];
const INSTALL_COMMANDS: Record<Method, string> = {
  curl: AUTOVAULT_INSTALL_COMMAND,
  brew: "brew install autoworks-ai/tap/autovault"
};
const selectedMethod = ref<Method>("curl");
const copied = ref(false);
const AGENT_SETUP_PROMPT = AUTOVAULT_AGENT_SETUP_PROMPT;

async function copyInstall() {
  copied.value = await copyText(INSTALL_COMMANDS[selectedMethod.value]);
  if (copied.value) window.setTimeout(() => (copied.value = false), 1400);
}

const PREREQS = [
  { label: "macOS", detail: "13+" },
  { label: "Linux", detail: "x64 / arm64" },
  { label: "Windows", detail: "WSL2" },
  { label: "Node", detail: "20+" },
  { label: "Disk", detail: "< 40 MB" }
];

const VAULT_TREE: VaultRow[] = [
  { depth: 0, label: "~/.autovault", kind: "dir", id: "root" },
  { depth: 1, label: "config.toml", kind: "file", id: "config" },
  { depth: 1, label: "autovault.sqlite", kind: "file", id: "db" },
  { depth: 1, label: ".signing-key.json", kind: "file", id: "signing" },
  { depth: 1, label: "skills/", kind: "dir", id: "skills" },
  { depth: 2, label: "skill-author/", kind: "dir", id: "skill" },
  { depth: 3, label: "SKILL.md", kind: "file" },
  { depth: 3, label: ".autovault-source.json", kind: "file" },
  { depth: 3, label: ".autovault-manifest", kind: "file" },
  { depth: 1, label: "rendered/", kind: "dir", id: "rendered" },
  { depth: 2, label: "claude-code/skill-author/", kind: "dir" },
  { depth: 2, label: "codex/skill-author/", kind: "dir" },
  { depth: 1, label: "profiles/", kind: "dir", id: "profiles" },
  { depth: 2, label: "claude-code/skill-author/ -> rendered/...", kind: "dir" },
  { depth: 1, label: "profiles.config.json", kind: "file", id: "profile-config" }
];

const VAULT_NOTES: Record<string, { title: string; body: string; tags?: string[] }> = {
  root: { title: "The vault itself", body: "A normal folder. Inspect it, sync it, back it up, or version it the same way you handle dotfiles." },
  config: { title: "config.toml", body: "Trusted sources, default scope policy, and render targets live here so the policy diffs cleanly." },
  db: { title: "autovault.sqlite", body: "SQLite index for capabilities, callers, tool groups, profiles, and installed skill metadata.", tags: ["sqlite", "index"] },
  signing: { title: ".signing-key.json", body: "A local Ed25519 keypair signs admitted skills and manifests. Treat write access to the storage root as vault compromise.", tags: ["ed25519", "local-only"] },
  skills: { title: "skills/", body: "One subfolder per canonical skill. The source SKILL.md remains the thing humans review." },
  skill: { title: "skill-author/", body: "The source SKILL.md, source metadata, resources, and signed manifest stay together under the canonical id.", tags: ["canonical", "signed"] },
  rendered: { title: "rendered/", body: "Generated per-agent variants. Regenerate these from source rather than hand-editing forks." },
  profiles: { title: "profiles/", body: "Symlink targets for filesystem-native host skill roots. sync-profiles can project these into Claude Code, Codex, Cursor, and named profiles." },
  "profile-config": { title: "profiles.config.json", body: "Optional named-profile policy for tag-filtered project profiles and explicit profile roots.", tags: ["scope"] }
};
const selectedVaultRow = ref("root");
const activeVaultNote = computed(() => VAULT_NOTES[selectedVaultRow.value]);
function depthStyle(depth: number) {
  return { "--depth": String(depth) };
}
function selectVaultRow(id: string | undefined) {
  if (id) selectedVaultRow.value = id;
}

const ACCESS_ROWS = [
  { agent: "Claude Code", path: "~/.autovault/profiles/claude-code/skill-author", via: "symlink into ~/.claude/skills" },
  { agent: "Codex", path: "~/.autovault/profiles/codex/skill-author", via: "symlink into ~/.codex/skills" },
  { agent: "AutoJack", path: "~/.autovault/skills/skill-author/SKILL.md", via: "native read of canonical source" }
];

const agentOptions = [
  { id: "claude-code", label: "Claude Code", color: "#d6a85a", cmd: "use skill-author to draft a new SKILL.md", out: "✓ tool resolved: Read, Edit, Write" },
  { id: "codex", label: "Codex", color: "#5a9dd6", cmd: "use skill-author to draft a new SKILL.md", out: "✓ tool resolved: read/write workspace files" },
  { id: "autojack", label: "AutoJack", color: "#5ad6c0", cmd: "use skill-author to review this SKILL.md", out: "✓ canonical SKILL.md loaded" }
];
const agent = ref(agentOptions[0].id);
const activeAgent = computed(() => agentOptions.find((item) => item.id === agent.value) ?? agentOptions[0]);

const TerminalDemo = defineComponent({
  setup() {
    const bodyRef = ref<HTMLElement | null>(null);
    const lines: TerminalReplayLine[] = [
      { type: "cmd", text: AUTOVAULT_INSTALL_COMMAND },
      { type: "out", text: "↳ downloading autovault-installer" },
      { type: "out", text: "↳ verifying installer signature" },
      { type: "ok", text: `✓ signature ok · ${PRODUCT_VERSION}` },
      { type: "out", text: "↳ installed to ~/.autovault" },
      { type: "out", text: "↳ refreshing managed profile links:" },
      { type: "out", text: "    ~/.claude/skills/autovault-skill → ~/.autovault/profiles/claude-code/autovault-skill" },
      { type: "out", text: "    ~/.codex/skills/autovault-skill  → ~/.autovault/profiles/codex/autovault-skill" },
      { type: "out", text: "    ~/.autojack/skills/autovault-skill → ~/.autovault/profiles/autojack/autovault-skill" },
      { type: "ok", text: "✓ vault ready · bundled skills bootstrapped · profiles synced" },
      { type: "blank", text: "" },
      { type: "cmd", text: "autovault add url:https://autovault.dev/skills/skill-author/SKILL.md" },
      { type: "out", text: "↳ fetching skill-author v1.0.0" },
      { type: "out", text: "↳ [1/5] yaml-repair    : ok" },
      { type: "out", text: "↳ [2/5] denylist       : ok" },
      { type: "out", text: "↳ [3/5] cap/behavior   : ok" },
      { type: "out", text: "↳ [4/5] dedup          : ok" },
      { type: "out", text: "↳ [5/5] sign           : ed25519" },
      { type: "ok", text: "✓ admitted to vault · scoped to: claude-code, codex" }
    ];
    const replay = useTerminalReplay(lines, { autoStart: true, scrollTarget: () => bodyRef.value });

    return () => h("div", { class: "terminal" }, [
      h("div", { class: "terminal-head" }, [h("span", { class: "dot", style: "background:#d97171" }), h("span", { class: "dot", style: "background:#e8a866" }), h("span", { class: "dot live" }), h("span", { class: "ttl" }, "~ — autovault — bash")]),
      h("div", { class: "terminal-body", ref: bodyRef }, [
        ...replay.visibleLines.value.map((line, index) => line.type === "blank" ? h("div", { key: index, style: "height:12px" }) : line.type === "cmd" ? h("div", { class: "line terminal-line", key: index }, [h("span", { class: "pmt" }, "$"), h("span", line.text)]) : h("div", { key: index, class: line.type }, line.text)),
        !replay.complete.value ? h("span", { class: "cur cursor" }) : null,
        replay.complete.value ? h("div", { class: "terminal-controls" }, [
          h("button", { class: "pill-btn", type: "button", onClick: replay.replay }, "↻ Replay")
        ]) : null
      ])
    ]);
  }
});
</script>
