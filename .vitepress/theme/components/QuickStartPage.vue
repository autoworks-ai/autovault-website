<template>
  <div class="docs-rich">
    <section class="qs-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> Get started · 5 minutes</div>
        <h1>Run one skill across <span class="ital">two agents.</span></h1>
        <p class="lede">By the end of this page you'll have a local vault, a validated skill, and the same skill running from both Claude Code and Codex with zero forks.</p>
        <div class="stats-grid">
          <div class="stat"><div class="mono-label">Time</div><div class="val">5<span class="muted" style="font-size: 12px"> min</span></div></div>
          <div class="stat"><div class="mono-label">Disk</div><div class="val">12<span class="muted" style="font-size: 12px"> MB</span></div></div>
          <div class="stat"><div class="mono-label">Required</div><div class="val">node <span class="muted" style="font-size: 12px">≥ 20</span></div></div>
        </div>
      </div>
      <TerminalDemo />
    </section>

    <h2 id="step-1-install-the-local-vault">Step 1 — Install the local vault</h2>
    <p>The installer drops a single binary at <code>~/.autovault/bin/autovault</code>, generates an Ed25519 keypair, and symlinks each agent's skill profile directory into the rendered output of the vault.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> curl <span class="arg">-fsSL</span> autovault.sh <span class="muted">|</span> sh
<span class="yaml-comment"># macOS: also available via brew</span>
<span class="pmt">$</span> brew install autoworks-ai/tap/autovault</CodeBlock>
    <div class="callout tip"><UiIcon name="tip" class="arg" /><div><strong>Privacy.</strong> The installer does not phone home. <code>autovault.sh</code> redirects to the GitHub release artifact; you can audit the script before piping it.</div></div>

    <h2 id="step-2-add-your-first-skill">Step 2 — Add your first skill</h2>
    <p>Skills enter the vault through a <strong>source adapter</strong>. Whatever the source, the gate runs the same five checks before admission.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault <span class="arg">add</span> github:autoworks-ai/skills/extract-pdf</CodeBlock>
    <div class="callout warn"><UiIcon name="tip" class="warn" /><div><strong>What gets rejected.</strong> About 11% of private-beta submissions were rejected for capability/behavior mismatches or near-duplicates.</div></div>

    <h2 id="step-3-scope-it-to-your-context">Step 3 — Scope it to your context</h2>
    <p>By default a freshly-added skill is unscoped — admitted to the vault, but not visible to any caller. Scope it explicitly to the agents and projects that should see it.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault <span class="arg">scope</span> extract-pdf \
    <span class="arg">--agent</span> claude-code,codex \
    <span class="arg">--project</span> autovault-website \
    <span class="arg">--device</span> $(hostname)</CodeBlock>

    <h2 id="step-4-run-it-from-your-agent">Step 4 — Run it from your agent</h2>
    <p>The skill is now installed, validated, scoped, and rendered for each target agent. The same skill name works in all of them, while tool calls are transformed to each agent's vocabulary.</p>
    <div class="agent-tabs" style="margin: 8px 0 0" role="tablist" aria-label="Agent">
      <button v-for="item in agentOptions" :key="item.id" :class="{ active: agent === item.id }" type="button" @click="agent = item.id"><span class="agent-dot" :style="{ background: item.color }" />{{ item.label }}</button>
    </div>
    <CodeBlock :lang="activeAgent.label.toLowerCase()" :file="`# in ${activeAgent.label}`"><span class="pmt">&gt;</span> {{ activeAgent.cmd }}
<span class="yaml-comment">{{ activeAgent.out }}</span>
<span class="yaml-comment"># extracting...</span>
"This 24-page report covers Q1 platform metrics, with three..."</CodeBlock>

    <h2 id="where-to-next">Where to next</h2>
    <p>You've completed the install + add + scope + run loop. From here, most people branch into one of four places:</p>
    <div class="cmd-grid">
      <a class="cmd-card" href="/authoring.html"><div class="cmd-name">→ Author your own</div><div class="cmd-desc">Write a SKILL.md, attach a transformation manifest, propose it through the gate.</div></a>
      <a class="cmd-card" href="/skills-directory.html"><div class="cmd-name">→ Browse skills</div><div class="cmd-desc">241 community skills, all signed and gated.</div></a>
      <a class="cmd-card" href="/security.html"><div class="cmd-name">→ Security model</div><div class="cmd-desc">Provenance chain, denylist sources, what we sign and why.</div></a>
      <a class="cmd-card" href="/AutoVault.html#concepts"><div class="cmd-name">→ Concepts</div><div class="cmd-desc">The five-step gate, four-axis scoping, transformation manifest in depth.</div></a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onUnmounted, ref } from "vue";
import CodeBlock from "./CodeBlock.vue";
import UiIcon from "./UiIcon.vue";

const agentOptions = [
  { id: "claude-code", label: "Claude Code", color: "#d6a85a", cmd: "use extract-pdf to summarize report.pdf", out: "✓ tool resolved: chrome-devtools, read" },
  { id: "codex", label: "Codex", color: "#5a9dd6", cmd: "use extract-pdf to summarize report.pdf", out: "✓ tool resolved: browser_form, file_read" },
  { id: "cursor", label: "Cursor", color: "#b48ad6", cmd: "@extract-pdf summarize report.pdf", out: "✓ tool resolved: playwright_fill_form, fs_read" }
];

const agent = ref(agentOptions[0].id);
const activeAgent = computed(() => agentOptions.find((item) => item.id === agent.value) ?? agentOptions[0]);

const TerminalDemo = defineComponent({
  setup() {
    const lines = [
      { type: "cmd", text: "curl -fsSL autovault.sh | sh" },
      { type: "out", text: "↳ downloading autovault-installer (1.2 MB)…" },
      { type: "out", text: "↳ verifying ed25519 signature…" },
      { type: "ok", text: "✓ signature ok · key:0xC4F9…E10A" },
      { type: "out", text: "↳ installed to ~/.autovault" },
      { type: "out", text: "↳ symlinking profile dirs:" },
      { type: "out", text: "    ~/.claude/skills → ~/.autovault/render/claude-code" },
      { type: "out", text: "    ~/.codex/skills  → ~/.autovault/render/codex" },
      { type: "ok", text: "✓ vault ready · 0 skills · ed25519 keypair generated" },
      { type: "blank", text: "" },
      { type: "cmd", text: "autovault add github:autoworks-ai/skills/extract-pdf" },
      { type: "out", text: "↳ fetching extract-pdf@1.4.0… 1.4kb" },
      { type: "out", text: "↳ [1/5] yaml-repair    : ok" },
      { type: "out", text: "↳ [2/5] denylist       : ok" },
      { type: "out", text: "↳ [3/5] cap/behavior   : ok" },
      { type: "out", text: "↳ [4/5] dedup          : ok" },
      { type: "out", text: "↳ [5/5] sign           : 0x9af4…2c81" },
      { type: "ok", text: "✓ admitted to vault · scoped to: claude-code, codex" }
    ];
    const shown = ref(lines.length);
    const running = ref(false);
    let timer: number | undefined;
    function schedule() {
      if (!running.value || shown.value >= lines.length) {
        running.value = false;
        return;
      }
      const cur = lines[shown.value];
      const delay = cur.type === "cmd" ? 700 : cur.type === "ok" ? 250 : 130;
      timer = window.setTimeout(() => {
        shown.value += 1;
        schedule();
      }, delay);
    }
    function clearTimer() {
      if (timer) window.clearTimeout(timer);
      timer = undefined;
    }
    function replay() {
      shown.value = 0;
      running.value = true;
      clearTimer();
      schedule();
    }
    function pause() {
      running.value = false;
      clearTimer();
    }
    function resume() {
      if (shown.value >= lines.length) return;
      running.value = true;
      clearTimer();
      schedule();
    }
    onUnmounted(clearTimer);
    return () => h("div", { class: "terminal" }, [
      h("div", { class: "terminal-head" }, [h("span", { class: "dot", style: "background:#d97171" }), h("span", { class: "dot", style: "background:#e8a866" }), h("span", { class: "dot live" }), h("span", { class: "ttl" }, "~ — autovault — bash")]),
      h("div", { class: "terminal-body" }, [
        ...lines.slice(0, shown.value).map((line, index) => line.type === "blank" ? h("div", { key: index, style: "height:12px" }) : line.type === "cmd" ? h("div", { class: "terminal-line", key: index }, [h("span", { class: "pmt" }, "$"), h("span", line.text)]) : h("div", { key: index, class: line.type }, line.text)),
        shown.value < lines.length ? h("span", { class: "cursor" }) : null,
        h("div", { class: "terminal-controls" }, [
          shown.value < lines.length ? h("button", { class: "pill-btn", type: "button", onClick: running.value ? pause : resume }, running.value ? "Pause" : "Resume") : null,
          h("button", { class: "pill-btn", type: "button", onClick: replay }, "↻ Replay")
        ])
      ])
    ]);
  }
});
</script>
