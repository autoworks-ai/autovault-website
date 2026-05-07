<template>
  <div class="av-page">
    <LandingTopbar />
    <main class="av-wrap" data-screen-label="01 Home">
      <section class="section hero" id="overview">
        <div class="hero-grid">
          <div>
            <div class="hero-tag"><span class="badge">v0.2</span><span>Current source release · May 2026</span></div>
            <h1>The skill registry<br />with a <span class="ital">gate</span>.</h1>
            <p class="hero-sub">
              Curated skills for AI agents: validated at the door, signed with provenance, scoped per caller, served over local stdio or remote Streamable HTTP MCP, and transformed without forking. Local-first. Self-hostable.
            </p>
            <div class="install">
              <div class="install-head"><span class="dot live" /><span class="dot" /><span class="dot" /><span class="label">~ &nbsp;bash</span></div>
              <div class="install-body">
                <span class="prompt">$</span>
                <code class="cmd">curl <span class="arg">-fsSL</span> https://autovault.sh <span class="pipe">|</span> sh</code>
                <button class="copy-btn" :class="{ copied }" type="button" @click="copyInstall">{{ copied ? "Copied" : "Copy" }}</button>
              </div>
            </div>
            <div class="hero-meta">
              <span><UiIcon name="check" class="arg" /> Ed25519 signed</span>
              <span><UiIcon name="check" class="arg" /> OAuth remote MCP</span>
              <span><UiIcon name="check" class="arg" /> MIT</span>
            </div>
          </div>
          <GateStage />
        </div>
      </section>

      <section class="section" id="problems">
        <div class="section-head">
          <div>
            <div class="eyebrow"><span class="dash" /> The state of skills</div>
            <h2 style="margin-top: 16px; max-width: 720px">Six concrete holes in how skills work today.</h2>
          </div>
          <p class="lede" style="max-width: 360px">
            The format works. The ecosystem around the format is a hot mess. Each of these is a separate fix to a separate hole.
          </p>
        </div>
        <div class="problems">
          <article v-for="item in problems" :key="item.num" class="problem">
            <div class="num">PROBLEM / {{ item.num }}</div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
            <span class="badge">{{ item.badge }}</span>
          </article>
        </div>
      </section>

      <section class="section" id="how">
        <div class="eyebrow"><span class="dash" /> The actually clever part</div>
        <h2 style="margin-top: 16px; max-width: 760px">One canonical skill.<br /><span class="ital">Three rendered views.</span></h2>
        <p class="lede" style="margin-top: 16px">
          Authors write the skill once against canonical capability names. AutoVault holds a transformation manifest that maps to whatever the calling agent actually understands — at delivery time, not author time.
        </p>
        <div class="xform-wrap">
          <div class="xform-head">
            <div>
              <h3>Transformation manifest in flight</h3>
              <p class="card-p">Hover or click the platforms to see the rendered view change. The skill on the left never moves.</p>
            </div>
            <div class="xform-toggle" role="tablist" aria-label="Transformation target">
              <button v-for="key in transformKeys" :key="key" :class="{ active: target === key }" type="button" @click="target = key" @mouseenter="target = key">
                <span class="swatch" :style="{ background: transforms[key].color }" />{{ key }}
              </button>
            </div>
          </div>
          <div class="xform-stage">
            <svg class="xform-flow" viewBox="0 0 1000 400" preserveAspectRatio="none">
              <defs>
                <linearGradient id="flow1" x1="0" x2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0" /><stop offset="100%" stop-color="var(--accent)" stop-opacity="0.7" /></linearGradient>
                <linearGradient id="flow2" x1="0" x2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.7" /><stop offset="100%" stop-color="var(--accent)" stop-opacity="0" /></linearGradient>
              </defs>
              <path v-for="y in [120, 170, 220, 270]" :key="'l' + y" class="flow-line flow-in" :d="`M280 ${y} L500 200`" stroke="url(#flow1)" stroke-width="0.8" fill="none" />
              <path v-for="y in [120, 170, 220, 270]" :key="'lp' + y" class="flow-pulse flow-in" :style="{ '--flow-delay': `${(y - 120) / 120}s` }" :d="`M280 ${y} L500 200`" stroke="var(--accent)" stroke-width="1.1" fill="none" pathLength="1" />
              <path v-for="y in [120, 170, 220, 270]" :key="'r' + y" class="flow-line flow-out" :d="`M500 200 L720 ${y}`" stroke="url(#flow2)" stroke-width="0.8" fill="none" />
              <path v-for="y in [120, 170, 220, 270]" :key="'rp' + y" class="flow-pulse flow-out" :style="{ '--flow-delay': `${0.45 + (y - 120) / 120}s` }" :d="`M500 200 L720 ${y}`" stroke="var(--accent)" stroke-width="1.1" fill="none" pathLength="1" />
            </svg>
            <div class="xform-col">
              <div class="mono-label">1 · Canonical skill</div>
              <div class="skill-card">
                <div class="card-head"><span class="file">extract-pdf<span class="muted">/SKILL.md</span></span><span class="verified"><UiIcon name="check" /> SIGNED</span></div>
                <div class="mono-block">
                  <div><span class="yaml-key">name:</span> extract-pdf</div>
                  <div><span class="yaml-key">version:</span> <span class="arg">1.4.0</span></div>
                  <div><span class="yaml-key">tools_required:</span></div>
                  <div class="yaml-key">&nbsp;&nbsp;- browser.fill_form</div>
                  <div class="yaml-key">&nbsp;&nbsp;- browser.click</div>
                  <div class="yaml-key">&nbsp;&nbsp;- fs.read</div>
                  <div class="yaml-key">&nbsp;&nbsp;- fs.write</div>
                  <div class="yaml-comment"># transformations applied at delivery</div>
                </div>
              </div>
            </div>
            <div class="xform-spacer" />
            <div class="xform-col" style="display: flex; flex-direction: column; justify-content: center">
              <div class="mono-label" style="text-align: center">2 · Engine</div>
              <div class="xform-engine"><div class="ring" :class="{ 'is-unlocking': engineState === 'unlocked' }"><BrandMark :size="26" :state="engineState" show-depth /></div></div>
              <div class="platforms">
                <button v-for="key in transformKeys" :key="key" class="platform" :class="{ active: target === key }" type="button" @click="target = key" @mouseenter="target = key">
                  <span class="platform-mark">{{ key[0].toUpperCase() }}</span><span class="name">{{ key }}</span><span class="tool muted" style="margin-left: auto">→ render</span>
                </button>
              </div>
            </div>
            <div class="xform-spacer" />
            <div class="xform-col">
              <div class="mono-label">3 · Rendered for caller</div>
              <div class="rendered-tool">
                <div class="card-head"><span :style="{ color: activeTransform.color }">● {{ target }}</span><span class="muted" style="margin-left: auto">SKILL.md rewritten</span></div>
                <div class="mono-block">
                  <div class="muted" style="margin-bottom: 8px">tools_required:</div>
                  <div v-for="row in activeTransform.rows" :key="row.from" style="display: flex; justify-content: space-between; gap: 14px">
                    <span class="key">{{ row.from }}</span><span class="muted">→</span><span class="arg">{{ row.to }}</span>
                  </div>
                </div>
              </div>
              <p class="mono-block" style="padding-left: 0; color: var(--ink-3)">
                <span class="arg">✓</span> Skill author wrote one file.<br />
                <span class="arg">✓</span> Agent receives native tool names.<br />
                <span class="arg">✓</span> No fork, no drift, no duplicate.
              </p>
            </div>
          </div>
          <div class="xform-footnote">
            <div><div class="mono-label">Manifest format</div><div class="card-p">YAML in skill frontmatter, validated at <strong>install</strong> and <strong>render</strong></div></div>
            <div><div class="mono-label">Resolution latency</div><div class="card-p"><strong>&lt; 4ms</strong> per skill, cached after first render</div></div>
            <div><div class="mono-label">Agents supported today</div><div class="card-p"><strong>Claude Code, Codex, Cursor, AutoHub</strong> + bridge skill for the rest</div></div>
          </div>
        </div>
      </section>

      <section class="section" id="concepts">
        <div class="gate-section">
          <div>
            <div class="eyebrow"><span class="dash" /> The wedge</div>
            <h2 style="margin-top: 16px">Skills enter dirty.<br />They leave <span class="ital">signed.</span></h2>
            <p class="lede" style="margin-top: 16px">
              Existing registries are publish-and-pray. AutoVault is gate-and-sign — every skill runs the same five-step validation pipeline before it touches the vault.
            </p>
            <div style="display: flex; gap: 12px; margin-top: 28px">
              <button class="pill-btn" type="button" @click="replayGate">▶ Replay</button>
              <button class="pill-btn" type="button" @click="running = !running">{{ running ? "❚❚ Pause" : "▶ Resume" }}</button>
            </div>
            <div class="stats-grid" style="max-width: 460px">
              <div><div class="mono-label">Reject rate</div><div style="font-size: 28px; font-weight: 500">11.4%</div><div class="muted" style="font-size: 12px">of submissions in private beta</div></div>
              <div><div class="mono-label">Avg. gate latency</div><div style="font-size: 28px; font-weight: 500">820ms</div><div class="muted" style="font-size: 12px">per skill, fully validated</div></div>
            </div>
          </div>
          <div class="gate-pipeline panel">
            <div class="gate-input"><span class="tag">UNTRUSTED</span><span style="flex: 1">weather-skill@1.2.0 from clawdhub-mirror</span><span class="bad">?</span></div>
            <div class="gate-track">
              <div v-for="(step, i) in gateStages" :key="step.title" class="gate-step" :class="stepClass(i)">
                <span class="num"><UiIcon v-if="stepClass(i) === 'done'" name="check" /> <template v-else>{{ i + 1 }}</template></span>
                <div><div class="title">{{ step.title }}</div><div class="desc">{{ step.desc }}</div></div>
                <span class="status">{{ stepStatus(i) }}</span>
              </div>
            </div>
            <div class="gate-output" :class="{ verified: tick > gateStages.length }" :style="{ opacity: tick > gateStages.length ? 1 : 0.4 }"><span class="tag">VERIFIED</span><span style="flex: 1">weather-skill@1.2.0 — admitted</span><span class="arg">sig:0x9af4…2c81</span></div>
            <a v-if="verifiedSeen" class="gate-verify-flag" href="/authoring#playground">
              <span class="mono-label">Your turn</span>
              <strong>Verify your own skill URL</strong>
              <UiIcon name="arrow" :size="14" />
            </a>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="eyebrow"><span class="dash" /> Four-axis scoping</div>
        <h2 style="margin-top: 16px; max-width: 760px">The skill exists.<br /><span class="ital">Whether you can see it</span> is a separate question.</h2>
        <p class="lede" style="margin-top: 16px">Every request carries a context. Same vault, filtered four ways — agent, device, project, tool.</p>
        <div class="perm-grid">
          <article v-for="card in permissionCards" :key="card.axis" class="perm-card">
            <span class="mono-label">{{ card.axis }}</span>
            <h4>{{ card.title }}</h4>
            <p class="card-p">{{ card.body }}</p>
            <div class="chip-row"><span v-for="chip in card.chips" :key="chip.label" class="chip" :class="{ on: chip.on }">{{ chip.label }}</span></div>
          </article>
        </div>
      </section>

      <section class="section" id="compare">
        <div class="eyebrow"><span class="dash" /> Honest deltas</div>
        <h2 style="margin-top: 16px">How AutoVault differs.</h2>
        <p class="lede" style="margin-top: 16px">Specific features, not vibes. Other registries are publish-and-pray; AutoVault is gate-and-sign.</p>
        <div class="compare">
          <table>
            <thead><tr><th>Capability</th><th class="us">AutoVault</th><th>Tessl</th><th>ClawdHub</th><th>agentskills.io</th><th>TLC registry</th></tr></thead>
            <tbody>
              <tr v-for="row in compareRows" :key="row[0]">
                <td class="feat">{{ row[0] }}</td>
                <td class="us"><Mark :kind="row[1]" /></td>
                <td><Mark :kind="row[2]" /></td>
                <td><Mark :kind="row[3]" /></td>
                <td><Mark :kind="row[4]" /></td>
                <td><Mark :kind="row[5]" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="section" id="start">
        <div class="eyebrow"><span class="dash" /> Five minutes, two agents</div>
        <h2 style="margin-top: 16px; max-width: 760px">Same skill, two callers, zero forks.</h2>
        <div class="qs-grid" style="grid-template-columns: 1fr 1fr; margin-top: 40px">
          <article v-for="(step, i) in quickSteps" :key="step.title" class="qs-step">
            <div class="card-head"><span class="arg">STEP / 0{{ i + 1 }}</span><span>{{ step.title }}</span></div>
            <div class="mono-block" v-html="step.body" />
          </article>
        </div>
      </section>

      <section class="section" style="padding-bottom: 48px">
        <div class="cta">
          <div class="eyebrow" style="justify-content: center"><span class="dash" /> Ship one</div>
          <h2>Signed skills. Real provenance.<br /><span class="ital">No mystery code.</span></h2>
          <p>One vault. Every agent. No drift. Self-host the team mode, or run local-only — same engine, same gate.</p>
          <div style="display: inline-flex; gap: 12px; flex-wrap: wrap; justify-content: center">
            <a class="pill-btn primary" href="/cloud">Reserve namespace <UiIcon name="arrow" /></a>
            <a class="pill-btn" href="/quick-start">Install locally</a>
            <a class="pill-btn" href="https://github.com/autoworks-ai/autovault"><UiIcon name="github" /> github.com/autoworks-ai/autovault</a>
          </div>
        </div>
      </section>
    </main>
    <AutoVaultFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from "vue";
import BrandMark from "./BrandMark.vue";
import ClerkAuthControls from "./ClerkAuthControls.vue";
import UiIcon from "./UiIcon.vue";
import { gateStages } from "../data/security";
import { transforms, type TransformTarget } from "../data/transforms";
import { copyText } from "../utils/clipboard";

const Mark = defineComponent({
  props: { kind: { type: String, required: true } },
  setup(props) {
    return () => h("span", { class: props.kind === "yes" ? "yes" : props.kind === "partial" ? "partial" : "no" }, props.kind === "yes" ? "●" : props.kind === "partial" ? "◐" : "○");
  }
});

const LandingTopbar = defineComponent({
  setup() {
    const items = [
      ["Overview", "#overview"],
      ["How it works", "#how"],
      ["Concepts", "#concepts"],
      ["Quick start", "/quick-start"],
      ["Compare", "#compare"],
      ["About", "/about"]
    ];
    return () => h("div", { class: "av-topbar" }, h("div", { class: "av-topbar-inner" }, [
      h("a", { class: "av-brand", href: "/" }, [h(BrandMark), h("span", [h("span", { class: "auto" }, "Auto"), h("span", { class: "vault" }, "Vault")])]),
      h("span", { class: "av-version" }, "v0.2.0"),
      h("nav", { class: "av-nav" }, items.map(([label, href]) => h("a", { href }, label))),
      h("div", { class: "av-actions" }, [
        h("a", { class: "icon-btn", href: "https://github.com/autoworks-ai/autovault", title: "GitHub" }, h(UiIcon, { name: "github", size: 15 })),
        h("a", { class: "pill-btn", href: "/quick-start" }, [h("span", { class: "status-dot" }), "Docs"]),
        h(ClerkAuthControls, { ctaLabel: "Create vault", signedInLabel: "Onboarding" }),
        h("a", { class: "pill-btn primary", href: "/cloud", title: "Reserve a hosted AutoVault namespace" }, ["Reserve namespace", h(UiIcon, { name: "arrow" })])
      ])
    ]));
  }
});

const GateStage = defineComponent({
  setup() {
    const incoming = [80, 140, 200, 260, 320];
    const outgoing = [
      { y: 100, label: "claude-code" },
      { y: 200, label: "codex" },
      { y: 300, label: "cursor" }
    ];
    return () => h("div", { class: "gate-stage" }, [
      h("span", { class: "gate-label l" }, "// dirty"),
      h("span", { class: "gate-label r" }, "// scoped"),
      h("svg", { viewBox: "0 0 400 400", preserveAspectRatio: "none" }, [
        h("defs", [
          h("linearGradient", { id: "lineFade", x1: "0", x2: "1" }, [h("stop", { offset: "0%", "stop-color": "var(--ink-4)", "stop-opacity": "0" }), h("stop", { offset: "40%", "stop-color": "var(--ink-3)", "stop-opacity": "0.7" }), h("stop", { offset: "100%", "stop-color": "var(--accent)", "stop-opacity": "1" })]),
          h("linearGradient", { id: "lineFanOut", x1: "0", x2: "1" }, [h("stop", { offset: "0%", "stop-color": "var(--accent)", "stop-opacity": "1" }), h("stop", { offset: "100%", "stop-color": "var(--accent)", "stop-opacity": "0.15" })]),
          h("radialGradient", { id: "gateGlow", cx: "0.5", cy: "0.5", r: "0.5" }, [h("stop", { offset: "0%", "stop-color": "var(--accent)", "stop-opacity": "0.35" }), h("stop", { offset: "60%", "stop-color": "var(--accent)", "stop-opacity": "0.06" }), h("stop", { offset: "100%", "stop-color": "var(--accent)", "stop-opacity": "0" })])
        ]),
        ...incoming.flatMap((y, i) => {
          const path = `M0 ${y} C 80 ${y}, 140 200, 200 200`;
          return [
            h("path", { d: path, stroke: "url(#lineFade)", "stroke-width": "1", fill: "none" }),
            h("circle", { r: "2.5", fill: "var(--accent)", opacity: "0.9" }, [
              h("animateMotion", { dur: `${2.4 + i * 0.3}s`, repeatCount: "indefinite", begin: `${i * 0.4}s` }, [
                h("mpath", { href: `#in-${i}` })
              ])
            ]),
            h("path", { id: `in-${i}`, d: path, fill: "none", style: { display: "none" } })
          ];
        }),
        h("circle", { cx: "200", cy: "200", r: "80", fill: "url(#gateGlow)" }),
        ...outgoing.flatMap((p, i) => {
          const path = `M232 200 C 280 200, 320 ${p.y}, 400 ${p.y}`;
          return [
            h("path", { d: path, stroke: "url(#lineFanOut)", "stroke-width": "1.2", fill: "none" }),
            h("path", { id: `out-${i}`, d: path, fill: "none", style: { display: "none" } }),
            h("circle", { r: "2.5", fill: "var(--accent)", opacity: "1" }, [
              h("animateMotion", { dur: "2.6s", repeatCount: "indefinite", begin: `${0.6 + i * 0.5}s` }, [
                h("mpath", { href: `#out-${i}` })
              ])
            ]),
            h("text", { x: "350", y: p.y - 8, fill: "var(--ink-2)", "font-family": "var(--mono)", "font-size": "10", "text-anchor": "end" }, p.label)
          ];
        })
      ]),
      h("span", { class: "gate-stage-brand", "aria-hidden": "true" }, h(BrandMark, { size: 88, showDepth: true }))
    ]);
  }
});

const AutoVaultFooter = defineComponent({
  setup() {
    return () => h("footer", { class: "footer" }, [
      h("div", { class: "footer-inner" }, [
        h("div", [h("div", { class: "av-brand", style: "margin-bottom:14px" }, [h(BrandMark), h("span", [h("span", { class: "auto" }, "Auto"), h("span", { class: "vault" }, "Vault")])]), h("p", { class: "card-p", style: "max-width:320px" }, "A curated skills layer for AI agents. Validated at the door, signed with provenance, scoped per caller.")]),
        h("div", [h("h5", "Product"), h("a", { href: "/" }, "Overview"), h("a", { href: "/cloud" }, "Cloud launch"), h("a", { href: "/skills-directory" }, "Skills directory"), h("a", { href: "/compare" }, "Compare"), h("a", { href: "/changelog" }, "Changelog")]),
        h("div", [h("h5", "Develop"), h("a", { href: "/quick-start" }, "Quick start"), h("a", { href: "/authoring" }, "Authoring skills"), h("a", { href: "/api" }, "API reference"), h("a", { href: "/deploy" }, "Deploy remote"), h("a", { href: "/security" }, "Security model")]),
        h("div", [h("h5", "Org"), h("a", { href: "/about" }, "About"), h("a", { href: "https://github.com/autoworks-ai/autovault" }, "autoworks-ai"), h("a", { href: "https://automem.ai" }, "AutoMem"), h("a", { href: "https://drunk.support" }, "drunk.support"), h("a", { href: "https://github.com/autoworks-ai/autovault/security" }, "Security policy")])
      ]),
      h("div", { class: "credit-line" }, [
        "Brought to you by ",
        h("a", { href: "https://drunk.support/about/" }, "Jack Arturo"),
        ", ",
        h("a", { href: "https://drunk.support/category/autojack/" }, "AutoJack"),
        ", ",
        h("a", { href: "https://www.paidmembershipspro.com/" }, "Jason Coleman"),
        ", ",
        h("a", { href: "https://github.com/flintfromthebasement" }, "Flint"),
        ", ",
        h("a", { href: "https://www.gravitykit.com/" }, "Zack Katz"),
        ", and ",
        h("a", { href: "https://wppopupmaker.com/" }, "Daniel Iser"),
        "."
      ]),
      h("div", { class: "footer-bottom" }, [h("span", "© 2026 autoworks-ai · MIT"), h("span", "autovault.dev")])
    ]);
  }
});

const copied = ref(false);
const target = ref<TransformTarget>("claude-code");
const transformKeys = Object.keys(transforms) as TransformTarget[];
const activeTransform = computed(() => transforms[target.value]);
const engineState = ref<"locked" | "unlocked">("locked");
const tick = ref(0);
const running = ref(true);
const verifiedSeen = ref(false);
let gateTimer: number | undefined;
let engineLockTimer: number | undefined;

onMounted(() => {
  gateTimer = window.setInterval(() => {
    if (running.value) tick.value = (tick.value + 1) % (gateStages.length + 2);
  }, 1100);
});

onUnmounted(() => {
  if (gateTimer) window.clearInterval(gateTimer);
  if (engineLockTimer) window.clearTimeout(engineLockTimer);
});

async function copyInstall() {
  copied.value = await copyText("curl -fsSL https://autovault.sh | sh");
  window.setTimeout(() => (copied.value = false), 1400);
}

function replayGate() {
  tick.value = 0;
  running.value = true;
  verifiedSeen.value = false;
}

function stepClass(i: number) {
  if (tick.value === 0) return "";
  if (tick.value > gateStages.length) return "done";
  if (i < tick.value - 1) return "done";
  if (i === tick.value - 1) return "active";
  return "";
}

function stepStatus(i: number) {
  const state = stepClass(i);
  return state === "active" ? "RUNNING…" : state === "done" ? "PASSED" : "QUEUED";
}

watch(tick, (value) => {
  if (value > gateStages.length) verifiedSeen.value = true;
});

watch(target, () => {
  engineState.value = "unlocked";
  if (engineLockTimer) window.clearTimeout(engineLockTimer);
  engineLockTimer = window.setTimeout(() => {
    engineState.value = "locked";
    engineLockTimer = undefined;
  }, 560);
});

const problems = [
  { num: "01", title: "Skill drift", body: "The same SKILL.md gets copy-pasted across repos and adapted locally. No upstream tracking, no merge story.", badge: "no provenance" },
  { num: "02", title: "Supply chain attacks", body: "Public registries have shipped credential stealers disguised as utilities. No code signing, no permission manifests.", badge: "shipping malware" },
  { num: "03", title: "Duplicate explosion", body: "Agents write skills on the fly with no dedup. You end up with seventeen variants of extract-pdf-text.", badge: "no dedup" },
  { num: "04", title: "Platform inconsistency", body: "Same skill, three forks — each calling agent expects different tool names. Fork once, maintain three.", badge: "fork × 3" },
  { num: "05", title: "Context bloat", body: "Every agent loads every SKILL.md at startup. Forty skills means thousands of tokens burned before work begins.", badge: "token tax" },
  { num: "06", title: "No permission scoping", body: "Skills load globally. Dev-machine skills leak into prod, client A skills leak to client B.", badge: "leaks by default" }
];

const permissionCards = [
  { axis: "Axis 01 / Agent", title: "Per-caller profiles", body: "Codex, Claude Code, Cursor, AutoHub, custom — each gets a filtered view, transformed to native tool names.", chips: [{ label: "claude-code", on: true }, { label: "codex", on: true }, { label: "cursor" }, { label: "autohub" }] },
  { axis: "Axis 02 / Device", title: "Machine-bound skills", body: "Laptop, server, ephemeral CI runner — different sets per machine. Production never sees the dev sandbox.", chips: [{ label: "laptop-jack", on: true }, { label: "prod-runner-3" }, { label: "ci-ephemeral" }] },
  { axis: "Axis 03 / Project", title: "Project boundaries", body: "Project-scoped skills don't leak across repos. Client work stays inside the client's namespace.", chips: [{ label: "autovault", on: true }, { label: "client-foo" }, { label: "internal/ops" }] },
  { axis: "Axis 04 / Tool · User", title: "Fine-grained access", body: "Per-tool permissions, role-based access. Read-only roles see read-only skills.", chips: [{ label: "role:engineer", on: true }, { label: "role:design" }, { label: "role:ops" }] }
];

const compareRows = [
  ["Validation gate at install", "yes", "no", "no", "partial", "no"],
  ["Ed25519 signed provenance", "yes", "no", "no", "no", "no"],
  ["Per-caller transformation", "yes", "no", "no", "no", "no"],
  ["Four-axis permission scoping", "yes", "no", "partial", "no", "no"],
  ["Dedup at submission", "yes", "no", "no", "no", "no"],
  ["Local-first (no required cloud)", "yes", "no", "no", "yes", "yes"],
  ["Self-hostable team mode", "yes", "no", "yes", "no", "partial"],
  ["Local stdio + remote HTTP MCP", "yes", "partial", "no", "yes", "no"],
  ["Progressive disclosure (no bloat)", "yes", "no", "no", "no", "no"]
];

const quickSteps = [
  { title: "Install the local vault", body: '<div><span class="pmt">$</span> curl -fsSL https://autovault.sh | sh</div><div class="muted">↳ installed → ~/.autovault/app</div><div class="arg">● vault healthy · bundled skills bootstrapped</div>' },
  { title: "Add a validated skill", body: '<div><span class="pmt">$</span> autovault add github:autoworks-ai/skills/extract-pdf</div><div class="muted">↳ [1/5] yaml-repair: ok</div><div class="muted">↳ [5/5] sign: 0x9af4…2c81</div><div class="arg">✓ admitted to vault</div>' },
  { title: "Add a local bundle", body: '<div><span class="pmt">$</span> autovault add-local ./skills/railway --source railway/skills --sync-profiles</div><div class="muted">↳ source: local · resources collected</div><div class="arg">✓ signed · profiles refreshed</div>' },
  { title: "Run from either agent", body: '<div class="muted"># in claude-code</div><div>&gt; use extract-pdf to summarize report.pdf</div><div class="arg">✓ tool resolved: chrome-devtools, read</div><div class="muted" style="margin-top:12px"># in codex</div><div>&gt; use extract-pdf to summarize report.pdf</div><div class="arg">✓ tool resolved: browser_form, file_read</div>' }
];
</script>
