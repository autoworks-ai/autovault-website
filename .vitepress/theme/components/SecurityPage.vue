<template>
  <div class="sec-page">
    <section class="sec-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> Security & provenance</div>
        <h1>Signing isn't the same as <span class="ital">safe.</span></h1>
        <p class="lede">A signature proves <em>who said what, when</em>. It does not prove the thing they said is correct or harmless. AutoVault's security model rests on three pillars — what we sign, what we don't sign, and where the trust boundary actually lives. This page is for staff engineers and security teams who want to inspect that model before they deploy.</p>
      </div>
      <VerifierDemo />
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> Trust model</div>
      <h2>Three actors. Three responsibilities. <span class="ital">No overlap.</span></h2>
      <p class="sub">AutoVault explicitly does <strong>not</strong> claim to make untrusted code safe. Instead, the system splits the job into three roles. Each role has a narrow, well-defined responsibility, and we never blur the lines between them.</p>

      <div class="trust-diagram">
        <article v-for="(role, index) in roles" :key="role.title" class="trust-col">
          <span class="role">role / {{ String(index + 1).padStart(2, "0") }}</span>
          <h3>{{ role.title }}</h3>
          <p class="desc">{{ role.desc }}</p>
          <div class="obj">
            <span class="seal" :class="role.seal"><UiIcon :name="role.icon" /></span>
            <div>
              <div class="name">{{ role.object }}</div>
              <div class="det">{{ role.detail }}</div>
            </div>
          </div>
          <div class="resp">RESPONSIBLE FOR
            <ul>
              <li v-for="item in role.responsibilities" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div v-if="index < roles.length - 1" class="trust-arrow">→</div>
        </article>
      </div>

      <div class="callout security-note">
        <span class="icn"><UiIcon name="tip" /></span>
        <div><strong>AutoVault never runs skills.</strong> It serves them. The agent on your machine executes locally, with its own tools, in its own sandbox.</div>
      </div>
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> The gate, in detail</div>
      <h2>What each of the five stages actually checks.</h2>
      <p class="sub">Every skill — installed, mirrored, or proposed by an agent at runtime — runs through these five stages in this order. Counts shown are from the public vault as of v0.4.1.</p>

      <div class="gate-stages-board panel">
        <div class="gsb-head">
          <span class="ttl">Gate v0.4.1 · last 30 days</span>
          <span class="meta">3,118 submissions · 11.4% rejected</span>
        </div>
        <div class="gsb-grid">
          <article v-for="(stage, index) in gateDetails" :key="stage.title" class="gsb-stage">
            <div class="stnum">STAGE / {{ String(index + 1).padStart(2, "0") }}</div>
            <h4>{{ stage.title }}</h4>
            <p class="stdesc">{{ stage.desc }}</p>
            <div v-for="row in stage.rows" :key="row.label" class="strow">
              <span class="dot" :class="row.kind" />
              <span class="lbl">{{ row.label }}</span>
              <span class="num">{{ row.count }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> Denylist inspector</div>
      <h2>Public, auditable, signed.</h2>
      <p class="sub">The denylist is itself an artifact under the same trust model — a signed, versioned bundle published at <code>autovault.dev/denylist/v1.json</code>. You can mirror it, audit it, propose additions through public review.</p>

      <div class="deny-grid">
        <div class="deny-list">
          <div class="deny-list-head">
            <span>Severity</span>
            <span>ID</span>
            <span>Pattern</span>
            <span>Source</span>
            <span>Age</span>
            <span class="count">{{ denyRows.length }} of 343</span>
          </div>
          <button v-for="row in denyRows" :key="row.id" class="deny-row" type="button" @click="selectedDeny = row.id">
            <span class="sev" :class="row.sev">{{ row.sev[0].toUpperCase() }}</span>
            <span class="id">{{ row.id }}</span>
            <span class="pat">{{ row.pat }}</span>
            <span class="src">{{ row.src }}</span>
            <span class="age">{{ row.age }}</span>
          </button>
        </div>
        <aside class="deny-side">
          <div>
            <h4>Patterns active</h4>
            <div class="denynum">343<span class="of">/ +12 this month</span></div>
          </div>
          <div class="breakdown">
            <h4>By severity</h4>
            <div v-for="row in severityBreakdown" :key="row.label" class="bd-row">
              <span class="lbl">{{ row.label }}</span>
              <span class="bar"><span :style="{ width: row.width, background: row.color }" /></span>
              <span class="num">{{ row.count }}</span>
            </div>
          </div>
          <div class="breakdown">
            <h4>Selected pattern</h4>
            <div class="mono-block selected-pattern">{{ selectedPattern?.id }} · {{ selectedPattern?.src }} · {{ selectedPattern?.pat }}</div>
          </div>
        </aside>
      </div>
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> Provenance chain</div>
      <h2>Every skill carries its <span class="ital">isnad.</span></h2>
      <p class="sub">An "isnad" is a chain of transmission — who said what, who heard it, who passed it on. Every signed skill in AutoVault carries one. Each link is its own ed25519 signature; tampering with any link breaks the chain.</p>

      <div class="prov-chain">
        <div class="prov-grid">
          <div v-for="link in provenance" :key="link.role" class="prov-link">
            <div class="role">{{ link.role }}</div>
            <div class="id">{{ link.id }}</div>
            <div class="when">{{ link.when }}</div>
          </div>
        </div>
        <div class="prov-caption">autovault verify --chain · any link broken = full rejection</div>
      </div>
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> Disclosure</div>
      <h2>Found something? Tell us.</h2>
      <p class="sub">We treat skill-ecosystem vulnerabilities the way mature infrastructure projects do. Coordinated disclosure, public CVE assignment, advisory published with the patch.</p>

      <div class="disc-grid">
        <article class="disc-card">
          <h3>Report a vulnerability</h3>
          <p>If you've found a vulnerability in the gate, the CLI, the renderer, or a denylist bypass — please report it before public disclosure. We respond within 48 hours and ship critical fixes within 7 days.</p>
          <div class="kv">
            <span class="k">Email</span><span class="v accent">security@autoworks-ai</span>
            <span class="k">PGP</span><span class="v">0xC4F9 7E10 A2C8 1B3D</span>
            <span class="k">Bounty</span><span class="v">case-by-case · max $5k</span>
            <span class="k">Window</span><span class="v">90-day coordinated disclosure</span>
          </div>
        </article>
        <article class="disc-card">
          <h3>Audit & transparency</h3>
          <p>The CLI is Apache-2.0 and self-buildable from a tagged commit. The denylist is a public, signed JSON artifact. The gate is reproducible — given the same skill bytes you should always get the same verdict.</p>
          <div class="kv">
            <span class="k">License</span><span class="v">Apache-2.0</span>
            <span class="k">Reproducible</span><span class="v accent">yes · gate v0.4+</span>
            <span class="k">External audit</span><span class="v">scheduled · Q3 2026</span>
            <span class="k">SBOM</span><span class="v">CycloneDX · per release</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, ref } from "vue";
import UiIcon from "./UiIcon.vue";
import { denyRows } from "../data/security";

type Phase = "idle" | "running" | "ok" | "fail";
type RowKind = "ok" | "warn" | "bad";

const roles = [
  {
    title: "The author",
    desc: "Writes the SKILL.md, declares its capabilities and permissions, signs it with a personal key. Owns what the skill claims to do.",
    object: "SKILL.md",
    detail: "+ frontmatter, transformations",
    seal: "signed",
    icon: "check" as const,
    responsibilities: ["Honest capability declarations", "Tightest reasonable permission scope", "Keeping the signing key private"]
  },
  {
    title: "The vault",
    desc: "Validates, signs, indexes, and delivers per caller. Owns what the skill looks like when it leaves the vault.",
    object: "vault sig",
    detail: "+ gate run record",
    seal: "scoped",
    icon: "tip" as const,
    responsibilities: ["Running the five-stage gate", "Producing a verifiable provenance chain", "Filtering by four-axis scope"]
  },
  {
    title: "The agent",
    desc: "Loads, interprets, and executes the skill within its own sandbox and tool-call boundary. Owns what the skill actually does at runtime.",
    object: "runtime",
    detail: "+ caller sandbox",
    seal: "executed",
    icon: "tip" as const,
    responsibilities: ["Enforcing declared permission boundaries", "Sandboxing tool invocations", "User-facing approval prompts"]
  }
];

const gateDetails = [
  { title: "YAML auto-repair", desc: "Frontmatter is the #1 source of breakage. Trailing commas, mixed indentation, unquoted special chars are fixed before the strict schema check.", rows: [{ label: "passed clean", count: "2,640", kind: "ok" }, { label: "repaired", count: "478", kind: "warn" }, { label: "rejected", count: "0", kind: "bad" }] },
  { title: "Security denylist", desc: "~340 known-bad patterns: credential stealers, fork bombs, exfil paths. Sourced from public CVEs, internal research, and community submissions.", rows: [{ label: "clean", count: "3,066", kind: "ok" }, { label: "flagged", count: "52", kind: "bad" }] },
  { title: "Capability vs. behavior", desc: "Does the skill actually do what its frontmatter claims? Mismatch between declared tools_required and observed behavior in the body = reject.", rows: [{ label: "aligned", count: "2,718", kind: "ok" }, { label: "over-declared", count: "220", kind: "warn" }, { label: "under-declared", count: "128", kind: "bad" }] },
  { title: "Dedup", desc: "Text similarity in V1, embedding-space matching in V2 preview. Stops the duplicate explosion at the door — too aggressive and authors complain, too lenient and the vault becomes ClawdHub.", rows: [{ label: "unique", count: "2,762", kind: "ok" }, { label: "near-duplicate", count: "176", kind: "bad" }] },
  { title: "Ed25519 sign", desc: "If we admit it, we sign it. Provenance becomes a first-class artifact with a verifiable chain back to the original author key.", rows: [{ label: "signed", count: "2,762", kind: "ok" }, { label: "key error", count: "0", kind: "bad" }] }
] satisfies Array<{ title: string; desc: string; rows: Array<{ label: string; count: string; kind: RowKind }> }>;

const selectedDeny = ref(denyRows[0].id);
const selectedPattern = computed(() => denyRows.find((row) => row.id === selectedDeny.value));
const severityBreakdown = [
  { label: "Critical", count: 109, width: "32%", color: "var(--bad)" },
  { label: "High", count: 152, width: "44%", color: "var(--warn)" },
  { label: "Medium", count: 82, width: "24%", color: "var(--ink-4)" }
];
const provenance = [
  { role: "LINK / 01 · author", id: "@autoworks-ai", when: "2026-04-28 12:14Z" },
  { role: "LINK / 02 · gate", id: "vault.autoworks-ai", when: "2026-04-28 12:18Z" },
  { role: "LINK / 03 · publish", id: "0x9af4…2c81", when: "2026-04-28 14:21Z" },
  { role: "LINK / 04 · mirror", id: "cdn.autovault.dev", when: "2026-04-28 14:22Z" },
  { role: "LINK / 05 · install", id: "your machine", when: "on demand" }
];

const VerifierDemo = defineComponent({
  setup() {
    const input = ref("autoworks-ai/extract-pdf@1.4.0");
    const phase = ref<Phase>("idle");
    const step = ref(0);
    let timer: ReturnType<typeof setInterval> | null = null;

    function run(target: "ok" | "fail") {
      if (timer) clearInterval(timer);
      phase.value = "running";
      step.value = 0;
      timer = setInterval(() => {
        step.value += 1;
        if (step.value >= 6) {
          if (timer) clearInterval(timer);
          timer = null;
          phase.value = target;
        }
      }, 350);
    }

    function forged() {
      input.value = "attacker/weather-skill@9.9.9";
      run("fail");
    }

    function reset() {
      if (timer) clearInterval(timer);
      timer = null;
      phase.value = "idle";
      step.value = 0;
      input.value = "autoworks-ai/extract-pdf@1.4.0";
    }

    onBeforeUnmount(() => {
      if (timer) clearInterval(timer);
    });

    return () => h("div", { class: "verifier" }, [
      h("div", { class: "verifier-head" }, [
        h("span", { class: "lights" }, [h("span", { class: "red" }), h("span", { class: "amber" }), h("span", { class: "green" })]),
        h("span", { class: "ttl" }, "autovault verify · interactive")
      ]),
      h("div", { class: "verifier-input" }, [
        h("label", { class: "row" }, [
          h("span", { class: "pmt" }, "$"),
          h("span", { class: "muted" }, "autovault verify"),
          h("input", { value: input.value, spellcheck: false, "aria-label": "Skill artifact", onInput: (event: Event) => { input.value = (event.target as HTMLInputElement).value; } })
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "vbtn run", type: "button", disabled: phase.value === "running", onClick: () => run("ok") }, phase.value === "running" ? "Running" : "Verify"),
          h("button", { class: "vbtn", type: "button", onClick: forged }, "Try a forged skill"),
          h("button", { class: "vbtn", type: "button", onClick: reset }, "Reset")
        ])
      ]),
      h("div", { class: "verifier-body" }, phase.value === "idle"
        ? h("div", { class: "muted" }, [h("span", "Click "), h("strong", { class: "arg" }, "Verify"), h("span", " to walk the provenance chain for any skill in the public vault.")])
        : [
            step.value >= 1 ? line("artifact", input.value) : null,
            step.value >= 2 ? line("digest", "sha256:c4f9…e10a · 2,847 bytes", "dim") : null,
            step.value >= 3 ? line("signature", phase.value === "fail" ? "INVALID — keypair mismatch" : "ed25519 · 0x9af42c81…7e7e", phase.value === "fail" ? "err" : "ok") : null,
            step.value >= 4 ? line("signer", "vault.autoworks-ai (key:0xC4F9…E10A) · trust: anchored") : null,
            step.value >= 5 ? line("gate run", "5/5 stages passed · 2026-04-28 14:21Z", "ok") : null,
            step.value >= 6 && phase.value !== "fail" ? line("isnad chain", "3 links · author → vault → mirror", "ok") : null,
            phase.value === "ok" ? verdict("ok", "Verified.", "Provenance chain intact, signature valid, gate stages all green.") : null,
            phase.value === "fail" ? verdict("fail", "Rejected.", "Signature does not match the published key for this artifact's signer. Do not install.") : null
          ])
    ]);
  }
});

function line(label: string, value: string, kind = "") {
  return h("div", { class: "verifier-line" }, [h("span", { class: "lab" }, label), h("span", { class: ["v", kind] }, value)]);
}

function verdict(kind: "ok" | "fail", strong: string, rest: string) {
  return h("div", { class: ["verdict", kind === "fail" ? "fail" : ""] }, [
    h("span", { class: "seal" }, h(UiIcon, { name: kind === "ok" ? "check" : "x" })),
    h("span", [h("strong", strong), ` ${rest}`])
  ]);
}
</script>
