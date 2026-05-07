<template>
  <div class="docs-rich">
    <section class="qs-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> Get started · 5 minutes</div>
        <h1>Run one skill across <span class="ital">two agents.</span></h1>
        <p class="lede">By the end of this page you'll have a local vault, bundled skills, a validated install path, and the same skill available from Claude Code and Codex with zero forks.</p>
        <div class="stats-grid">
          <div class="stat"><div class="mono-label">Time</div><div class="val">5<span class="muted" style="font-size: 12px"> min</span></div></div>
          <div class="stat"><div class="mono-label">Disk</div><div class="val">12<span class="muted" style="font-size: 12px"> MB</span></div></div>
          <div class="stat"><div class="mono-label">Required</div><div class="val">node <span class="muted" style="font-size: 12px">≥ 20</span></div></div>
        </div>
      </div>
      <TerminalDemo />
    </section>

    <h2 id="install">Step 1 — Install the local vault</h2>
    <p>The installer builds the Node app under <code>~/.autovault/app</code>, drops the shim at <code>~/.autovault/bin/autovault</code>, preserves <code>~/.autovault</code> as storage, and bootstraps bundled skills unless <code>AUTOVAULT_NO_BOOTSTRAP=1</code> is set. Nothing runs as a daemon; local MCP hosts spawn stdio on demand.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> curl <span class="arg">-fsSL</span> autovault.sh <span class="muted">|</span> sh<br />
<span class="yaml-comment"># macOS: also available via brew</span><br />
<span class="pmt">$</span> brew install autoworks-ai/tap/autovault<br />
<span class="pmt">$</span> autovault skill list</CodeBlock>
    <div class="callout tip"><UiIcon name="tip" class="arg" /><div><strong>Bundled skills.</strong> The installer seeds every bundled <code>skills/*/SKILL.md</code> through the same validation path used by remote installs and proposals, then refreshes discovered host profiles.</div></div>

    <h2 id="first">Step 2 — Add your first skill</h2>
    <p>Skills enter the vault through a <strong>source adapter</strong>. Each adapter knows how to fetch from one origin (GitHub repo, agentskills slug, HTTPS bundle, or local directory) and hand the raw skill to the validation gate. Whatever the source, the gate runs the same checks before admission.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault <span class="arg">add</span> github:autoworks-ai/skills/extract-pdf</CodeBlock>
    <p>You'll see the gate run live in your terminal — yaml-repair, denylist, capability/behavior, dedup, sign. If any step fails, the skill is rejected and never touches your vault.</p>
    <div class="callout warn"><UiIcon name="tip" class="warn" /><div><strong>Local bundles.</strong> Third-party installers should use <code>autovault add-local ./skill-dir --source vendor/name --sync-profiles</code> instead of copying the same SKILL.md into every native host directory. <code>AUTOVAULT_SKILL_INSTALL</code> controls AutoVault-first, native-first, both, native-only, and off modes.</div></div>

    <h2 id="scope">Step 3 — Scope it to your context</h2>
    <p>By default a freshly-added skill is unscoped: admitted to the vault, but not visible to any caller. Scope it explicitly to the agents and projects that should see it. The four-axis permission system means dev-machine skills don't leak into prod, and client work doesn't bleed across project boundaries.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault <span class="arg">scope</span> extract-pdf \<br />
    <span class="arg">--agent</span> claude-code,codex \<br />
    <span class="arg">--project</span> autovault-website \<br />
    <span class="arg">--device</span> $(hostname)</CodeBlock>
    <p>Each scope rule is additive. A caller sees a skill only if it matches at least one rule on every axis it requests. Unspecified axes default to "any."</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault sync-profiles <span class="arg">--discover</span></CodeBlock>
    <p>Profile discovery checks native roots such as <code>~/.claude/skills</code>, <code>~/.codex/skills</code>, and <code>~/.cursor/skills</code>. Set <code>AUTOVAULT_PROFILE_LINKS</code> when you want installs, proposals, updates, deletes, or transform changes to refresh managed links automatically.</p>

    <h2 id="run">Step 4 — Run it from your agent</h2>
    <p>The skill is now installed, validated, scoped, and rendered for each target agent. Open whichever agent you use most — the same skill name works in all of them, but the underlying tool calls have been transformed to match each agent's vocabulary.</p>
    <div class="agent-tabs" style="margin: 8px 0 0" role="tablist" aria-label="Agent">
      <button v-for="item in agentOptions" :key="item.id" :class="{ active: agent === item.id }" type="button" @click="agent = item.id"><span class="agent-dot" :style="{ background: item.color }" />{{ item.label }}</button>
    </div>
    <CodeBlock :lang="activeAgent.label.toLowerCase()" :file="`# in ${activeAgent.label}`"><span class="pmt">&gt;</span> {{ activeAgent.cmd }}<br />
<span class="yaml-comment">{{ activeAgent.out }}</span><br />
<span class="yaml-comment"># extracting...</span><br />
"This 24-page report covers Q1 platform metrics, with three..."</CodeBlock>

    <h2 id="next">Where to next</h2>
    <p>You've completed the install + add + scope + run loop. From here, most people branch into one of three places:</p>
    <div class="cmd-grid">
      <a class="cmd-card" href="/authoring"><div class="cmd-name">→ Author your own</div><div class="cmd-desc">Write a SKILL.md, attach a transformation manifest, propose it through the gate.</div></a>
      <a class="cmd-card" href="/skills-directory"><div class="cmd-name">→ Browse skills</div><div class="cmd-desc">First-party and community skills, all signed and gated.</div></a>
      <a class="cmd-card" href="/security"><div class="cmd-name">→ Security model</div><div class="cmd-desc">Provenance chain, denylist sources, remote OAuth, what we sign and why.</div></a>
      <a class="cmd-card" href="/#concepts"><div class="cmd-name">→ Concepts</div><div class="cmd-desc">The five-step gate, four-axis scoping, transformation manifest in depth.</div></a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from "vue";
import CodeBlock from "./CodeBlock.vue";
import UiIcon from "./UiIcon.vue";
import { useTerminalReplay, type TerminalReplayLine } from "../composables/useTerminalReplay";

const agentOptions = [
  { id: "claude-code", label: "Claude Code", color: "#d6a85a", cmd: "use extract-pdf to summarize report.pdf", out: "✓ tool resolved: chrome-devtools, read" },
  { id: "codex", label: "Codex", color: "#5a9dd6", cmd: "use extract-pdf to summarize report.pdf", out: "✓ tool resolved: browser_form, file_read" },
  { id: "cursor", label: "Cursor", color: "#b48ad6", cmd: "@extract-pdf summarize report.pdf", out: "✓ tool resolved: playwright_fill_form, fs_read" }
];

const agent = ref(agentOptions[0].id);
const activeAgent = computed(() => agentOptions.find((item) => item.id === agent.value) ?? agentOptions[0]);

const TerminalDemo = defineComponent({
  setup() {
    const bodyRef = ref<HTMLElement | null>(null);
    const lines: TerminalReplayLine[] = [
      { type: "cmd", text: "curl -fsSL autovault.sh | sh" },
      { type: "out", text: "↳ downloading autovault-installer (1.2 MB)…" },
      { type: "out", text: "↳ verifying ed25519 signature…" },
      { type: "ok", text: "✓ signature ok · key:0xC4F9…E10A" },
      { type: "out", text: "↳ installed to ~/.autovault" },
      { type: "out", text: "↳ refreshing managed profile links:" },
      { type: "out", text: "    ~/.claude/skills/autovault-skill → ~/.autovault/profiles/claude-code/autovault-skill" },
      { type: "out", text: "    ~/.codex/skills/autovault-skill  → ~/.autovault/profiles/codex/autovault-skill" },
      { type: "out", text: "    ~/.cursor/skills/autovault-skill → ~/.autovault/profiles/cursor/autovault-skill" },
      { type: "ok", text: "✓ vault ready · bundled skills bootstrapped · profiles synced" },
      { type: "blank", text: "" },
      { type: "cmd", text: "autovault add github:autoworks-ai/skills/extract-pdf" },
      { type: "out", text: "↳ fetching extract-pdf@1.4.0… 1.4kb" },
      { type: "out", text: "↳ [1/5] yaml-repair    : ok (frontmatter clean)" },
      { type: "out", text: "↳ [2/5] denylist       : ok (no known bad patterns)" },
      { type: "out", text: "↳ [3/5] cap/behavior   : ok (declared = observed)" },
      { type: "out", text: "↳ [4/5] dedup          : ok (no near matches in vault)" },
      { type: "out", text: "↳ [5/5] sign           : 0x9af4…2c81" },
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
