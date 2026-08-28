<template>
  <div class="sec-page">
    <section class="sec-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> Security & provenance</div>
        <h1>Signing isn't the same as <span class="ital">safe.</span></h1>
        <p class="lede">A signature proves <em>who said what, when</em>. It does not prove the thing they said is correct or harmless. AutoVault's security model rests on three pillars: what we sign, what we don't sign, and where the trust boundary actually lives. This page is for staff engineers and security teams who want to inspect that model before local or remote MCP deployment.</p>
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
      <div class="callout security-note">
        <span class="icn"><UiIcon name="tip" /></span>
        <div>
          <p><strong>AutoVault is not a credential vault.</strong> Skill bundles can declare required secret names and signed setup actions, but secret values stay in SSH agent, Keychain, 1Password, provider CLIs, or deployment secrets.</p>
          <p>A <code>.env</code> file or private key inside a skill bundle is content, not protected secret storage.</p>
        </div>
      </div>
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> The gate, in detail</div>
      <h2>What each of the five stages actually checks.</h2>
      <p class="sub">Every skill installed, imported, proposed by an agent, or handed over through <code>autovault add</code> runs through these stages in order. The source implementation keeps the denylist extensible and currently documents {{ activePatternCount }} active patterns.</p>

      <div class="gate-stages-board panel">
        <div class="gsb-head">
          <span class="ttl">Gate {{ PRODUCT_VERSION }} · source sync</span>
          <span class="meta">schema · denylist · capability · dedup · sign</span>
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
      <p class="sub">The denylist is an auditable, versioned artifact under the same trust model. You can mirror it, audit it, and propose additions through public review.</p>

      <div class="deny-grid">
        <div class="deny-list">
          <div class="deny-list-head">
            <span>ID</span>
            <span>Pattern</span>
            <span>What it catches</span>
            <span class="count">{{ denyRows.length }} shown</span>
          </div>
          <button
            v-for="row in denyRows"
            :key="row.id"
            class="deny-row"
            type="button"
            :aria-pressed="selectedDeny === row.id"
            @click="selectedDeny = row.id"
          >
            <span class="id">{{ row.id }}</span>
            <span class="pat">{{ row.pat }}</span>
            <span class="reason">{{ row.reason }}</span>
          </button>
        </div>
        <aside class="deny-side">
          <div>
            <h4>Patterns active</h4>
            <div class="denynum">{{ activePatternCount }}<span class="of">/ extensible</span></div>
          </div>
          <div class="breakdown">
            <h4>Selected pattern</h4>
            <div class="mono-block selected-pattern">{{ selectedPattern?.id }} · {{ selectedPattern?.pat }}</div>
            <p class="deny-reason">{{ selectedPattern?.reason }}</p>
          </div>
          <div class="breakdown">
            <h4>Source</h4>
            <p class="deny-reason">
              Mirrored from <code>scripts/security/patterns.json</code> (schema
              v{{ DENYLIST_SCHEMA_VERSION }}) in the AutoVault CLI.
            </p>
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
        <div class="prov-caption">autovault doctor &lt;skill&gt; · reports every broken link, doesn't block on its own</div>
      </div>
    </section>

    <section id="hosted-sync" class="sec-section">
      <div class="eyebrow"><span class="dash" /> Hosted sync</div>
      <h2>Cloud serves the bytes. It never signs them.</h2>
      <p class="sub">AutoVault Cloud moves a signed catalog from your machine to the machines you admit. That is the whole job. The trust boundary does not move when a vault becomes hosted: the gate still ran on your workstation, the release was still signed by a key that stayed there, and Cloud stores the result without being able to produce one.</p>

      <div class="disc-grid">
        <article class="disc-card">
          <h3>What Cloud holds</h3>
          <p><strong>Sync artifacts:</strong> signed catalog and bundle objects byte for byte, enrolled device public keys with their status and hostname, and live pairing codes until they expire.</p>
          <p><strong>Account records:</strong> the email, name and avatar your identity provider returns, your Stripe customer and subscription ids, and the reserved namespace.</p>
          <p><strong>Skill drafts you submit:</strong> a draft posted from the dashboard is stored whole, body text included, and nothing reads it back yet.</p>
          <p class="muted">No signing key, in any of them. That is the one thing Cloud is built never to hold.</p>
          <div class="kv">
            <span class="k">Serves</span><span class="v">/v/&lt;slug&gt;/</span>
          </div>
        </article>
        <article class="disc-card">
          <h3>What Cloud never holds</h3>
          <p>A release signing key. There is no upload API and no publish button, because either one would need Cloud to hold the thing that makes a release trustworthy. Objects are placed by hand from the machine that signed them.</p>
          <div class="kv">
            <span class="k">Signing</span><span class="v">stays local</span>
          </div>
        </article>
      </div>

      <p class="sub">A device proves who it is with an Ed25519 keypair it generates locally. The private half never leaves that machine, and there is no API key to leak in its place. Every request under <code>/v/</code> carries a detached signature over <code>&lt;METHOD&gt;\n&lt;pathname&gt;\n&lt;unix-seconds&gt;</code>, and a timestamp more than 300 seconds out is refused, so a captured request stops working in five minutes. Admission is a person in the browser, not a token exchange. An enrolled key that nobody has admitted reads the catalog and its own status, never a bundle: it needs the catalog to pin the publisher key before anyone has decided about it, and bundles are where skill content actually lives.</p>

      <div class="callout security-note">
        <span class="icn"><UiIcon name="tip" /></span>
        <div>
          <p><strong>Rotating the catalog key breaks every enrolled device.</strong> A device pins <code>catalog.public_key</code> the first time it reads the catalog, which is what stops a compromised Cloud from swapping in releases of its own. The cost of that guarantee is real: there is no rotation path in beta, and changing the key means re-enrolling every machine.</p>
          <p>Revoking a device is immediate for catalog and bundle reads. It does not reach back onto that machine. Skills it already pulled are files on a disk you no longer control.</p>
        </div>
      </div>
    </section>

    <section class="sec-section">
      <div class="eyebrow"><span class="dash" /> Disclosure</div>
      <h2>Found something? Tell us.</h2>
      <p class="sub">Coordinated disclosure through GitHub Security Advisories. We work with you on the fix and credit you in the release notes if you want it.</p>

      <div class="disc-grid">
        <article class="disc-card">
          <h3>Report a vulnerability</h3>
          <p>If you've found a vulnerability in the gate, CLI, renderer, remote OAuth flow, or a denylist bypass, report it privately rather than opening a public issue.</p>
          <div class="kv">
            <span class="k">Report</span
            ><span class="v accent"
              ><a :href="SECURITY_ADVISORY_URL" rel="noopener"
                >GitHub Security Advisories</a
              ></span
            >
            <span class="k">Response</span><span class="v">within 3 business days</span>
            <span class="k">Supported</span><span class="v">latest minor · pre-1.0</span>
            <span class="k">Disclosure</span><span class="v">coordinated · credited</span>
          </div>
        </article>
        <article class="disc-card">
          <h3>Audit & transparency</h3>
          <p>The CLI is MIT licensed and self-buildable from a tagged commit. The denylist is public and versioned. The gate is reproducible: given the same skill bytes you should always get the same verdict.</p>
          <div class="kv">
            <span class="k">License</span><span class="v">MIT</span>
            <span class="k">Denylist</span><span class="v accent">public · schema v{{ DENYLIST_SCHEMA_VERSION }}</span>
            <span class="k">Container</span><span class="v">multi-arch · GHCR</span>
            <span class="k">SBOM</span><span class="v">SPDX + provenance · per release</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, ref } from "vue";
import UiIcon from "./UiIcon.vue";
import { PRODUCT_VERSION } from "../data/product";
import { denyRows, DENYLIST_SCHEMA_VERSION } from "../data/security";

// Matches .github/SECURITY.md in autoworks-ai/autovault, which is the
// authoritative policy. The previous block advertised a security@ address with
// no TLD, a PGP key, a bounty, a response/fix SLA and a scheduled external
// audit — none of which appear in that policy.
const SECURITY_ADVISORY_URL =
  "https://github.com/autoworks-ai/autovault/security/advisories/new";

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

const activePatternCount = denyRows.length;

const gateDetails = [
  { title: "YAML auto-repair", desc: "Frontmatter is the most common source of breakage. Trailing commas, mixed indentation, and unquoted special chars are normalized before the strict schema check.", rows: [{ label: "frontmatter parsed", count: "required", kind: "ok" }, { label: "schema checked", count: "zod", kind: "ok" }, { label: "invalid yaml", count: "blocked", kind: "bad" }] },
  { title: "Security denylist", desc: "Known-bad patterns include credential reads, pipe-to-shell installs, decoded shell execution, setuid chmod, and insecure transport flags.", rows: [{ label: "strict mode", count: "blocks", kind: "ok" }, { label: "non-strict mode", count: "warns", kind: "warn" }, { label: "active patterns", count: String(activePatternCount), kind: "bad" }] },
  { title: "Capability vs. behavior", desc: "Does the skill actually do what its frontmatter claims? Mismatch between declared capabilities and observed behavior is rejected.", rows: [{ label: "network false + curl", count: "blocked", kind: "bad" }, { label: "readonly + write", count: "blocked", kind: "bad" }, { label: "declared tools align", count: "passed", kind: "ok" }] },
  { title: "Dedup", desc: "Three tiers catch exact content matches, near-exact similarity, and functional overlap warnings before the vault fills with clones.", rows: [{ label: "exact hash", count: "duplicate", kind: "bad" }, { label: "near exact", count: ">=0.9", kind: "bad" }, { label: "functional overlap", count: ">=0.75", kind: "warn" }] },
  { title: "Ed25519 sign", desc: "If AutoVault admits a skill, it writes a detached signature sidecar and records source metadata for drift checks.", rows: [{ label: "stored skill", count: "signed", kind: "ok" }, { label: "source sidecar", count: "hash", kind: "ok" }, { label: "tamper check", count: "warns", kind: "warn" }] }
] satisfies Array<{ title: string; desc: string; rows: Array<{ label: string; count: string; kind: RowKind }> }>;

const selectedDeny = ref(denyRows[0].id);
const selectedPattern = computed(() => denyRows.find((row) => row.id === selectedDeny.value));
const provenance = [
  { role: "LINK / 01 · author", id: "@autoworks-ai", when: "2026-04-28 12:14Z" },
  { role: "LINK / 02 · gate", id: "vault.autoworks-ai", when: "2026-04-28 12:18Z" },
  { role: "LINK / 03 · admit", id: "0x9af4…2c81", when: "2026-04-28 14:21Z" },
  { role: "LINK / 04 · mirror", id: "cdn.autovault.dev", when: "2026-04-28 14:22Z" },
  { role: "LINK / 05 · install", id: "your machine", when: "on demand" }
];

const VerifierDemo = defineComponent({
  setup() {
    const input = ref("skill-author");
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
      // `autovault doctor [skill-name]` inspects an INSTALLED skill by its
      // plain name — not a source/version pair, which isn't valid syntax and
      // can't be replayed against the real CLI (ApiReferencePage.vue:137).
      input.value = "weather-skill";
      run("fail");
    }

    function reset() {
      if (timer) clearInterval(timer);
      timer = null;
      phase.value = "idle";
      step.value = 0;
      input.value = "skill-author";
    }

    onBeforeUnmount(() => {
      if (timer) clearInterval(timer);
    });

    return () => h("div", { class: "verifier" }, [
      h("div", { class: "verifier-head" }, [
        h("span", { class: "lights" }, [h("span", { class: "red" }), h("span", { class: "amber" }), h("span", { class: "green" })]),
        h("span", { class: "ttl" }, "autovault doctor · simulated")
      ]),
      h("div", { class: "verifier-input" }, [
        h("label", { class: "row" }, [
          h("span", { class: "pmt" }, "$"),
          h("span", { class: "muted" }, "autovault doctor"),
          h("input", { value: input.value, spellcheck: false, "aria-label": "Skill artifact", onInput: (event: Event) => { input.value = (event.target as HTMLInputElement).value; } })
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "vbtn run", type: "button", disabled: phase.value === "running", onClick: () => run("ok") }, phase.value === "running" ? "Running" : "Verify"),
          h("button", { class: "vbtn", type: "button", onClick: forged }, "Try a forged skill"),
          h("button", { class: "vbtn", type: "button", onClick: reset }, "Reset")
        ])
      ]),
      h("div", { class: "verifier-body" }, phase.value === "idle"
        ? h("div", { class: "muted" }, [h("span", "Click "), h("strong", { class: "arg" }, "Verify"), h("span", " to simulate the provenance walk. Sample output — run the real check locally.")])
        : [
            step.value >= 1 ? line("artifact", input.value) : null,
            step.value >= 2 ? line("digest", "sha256:c4f9…e10a · 2,847 bytes", "dim") : null,
            step.value >= 3 ? line("signature", phase.value === "fail" ? "INVALID — keypair mismatch" : "ed25519 · 0x9af42c81…7e7e", phase.value === "fail" ? "err" : "ok") : null,
            step.value >= 4 ? line("signer", "vault.example (key:ed25519:sample) · trust: anchored") : null,
            step.value >= 5 ? line("gate run", "5/5 stages passed · 2026-04-28 14:21Z", "ok") : null,
            step.value >= 6 && phase.value !== "fail" ? line("isnad chain", "3 links · author → vault → mirror", "ok") : null,
            phase.value === "ok" ? verdict("ok", "Verified.", "Provenance chain intact, signature valid, gate stages all green.") : null,
            phase.value === "fail" ? verdict("fail", "Signature mismatch.", "Does not match the signing key for this artifact's signer. doctor reports this — it does not itself block the skill from running. --repair only re-signs unsigned local skills; it refuses tampered metadata and remote sources like this one, so reject or remove it instead.") : null
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
