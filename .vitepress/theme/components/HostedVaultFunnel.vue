<template>
  <section class="hosted-funnel" :data-entry="entry">
    <div class="hosted-funnel-head">
      <div>
        <div class="mono-label">hosted vault</div>
        <h3>{{ headline }}</h3>
        <p>
          AutoVault stores pending drafts, signed manifests, skill bundles, and rendered profiles in a tenant namespace.
          The host does not execute skills; your local CLI gates, signs, and syncs the files.
        </p>
      </div>
      <button class="hosted-primary" type="button" :disabled="busy" @click="startFlow">
        {{ busy ? "Working..." : primaryLabel }}
      </button>
    </div>

    <div v-if="notice" class="hosted-notice" :class="notice.kind">{{ notice.text }}</div>

    <div class="hosted-flow">
      <div v-for="item in flowItems" :key="item.label" class="hosted-flow-item" :class="item.state">
        <span class="hosted-dot" />
        <span class="hosted-flow-copy">
          <strong>{{ item.label }}</strong>
          <span>{{ item.detail }}</span>
        </span>
      </div>
    </div>

    <div v-if="showAuthActions" class="hosted-auth-actions">
      <a class="hosted-auth-btn" :href="authStartUrl('github')" @click="persistDraft">Continue with GitHub</a>
      <a class="hosted-auth-btn" :href="authStartUrl('google')" @click="persistDraft">Continue with Google</a>
    </div>

    <div class="hosted-provision-grid">
      <div class="hosted-panel">
        <div class="panel-title">Provisioning</div>
        <div class="provision-list">
          <div v-for="step in provisionSteps" :key="step.label" class="provision-step" :class="{ done: step.done, active: step.active }">
            <span class="provision-mark">{{ step.done ? "ok" : step.active ? ".." : "--" }}</span>
            <span>{{ step.label }}</span>
          </div>
        </div>
      </div>

      <div class="hosted-panel">
        <div class="panel-title">Suggested starter skills</div>
        <div class="starter-skills">
          <button v-for="skill in starterSkills" :key="skill.name" type="button" :class="{ queued: queuedSkillNames.includes(skill.name) }" @click="toggleSkill(skill.name)">
            <span class="skill-icon">{{ skill.icon }}</span>
            <span>
              <strong>{{ skill.name }}</strong>
              <small>{{ skill.desc }}</small>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="hosted-command-card">
      <div class="panel-title">Agent handoff</div>
      <pre><code>{{ commandBlock }}</code></pre>
      <div class="hosted-copy-row">
        <button type="button" @click="copyCommands">Copy terminal commands</button>
        <button type="button" @click="copyAgentHandoff('claude-code')">Copy Claude Code handoff</button>
        <button type="button" @click="copyAgentHandoff('cursor')">Copy Cursor handoff</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { skills } from "../data/skills";
import type { GateEvaluation } from "../utils/skillGate";

const PENDING_DRAFT_KEY = "autovault.hostedVault.pendingDraft";

type AuthProvider = "github" | "google";
type Notice = { kind: "ok" | "warn" | "fail"; text: string };
type MeResponse = {
  user: { id: string; email?: string | null; name?: string | null; avatar_url?: string | null } | null;
  subscription?: { active: boolean; status?: string | null } | null;
  vault?: { id?: string; slug: string; status: string; public_url: string } | null;
};

type PendingDraft = {
  sourceText: string;
  skillName: string;
  version?: string;
  sourceLabel?: string;
  signature?: string;
  createdAt: string;
};

const props = withDefaults(defineProps<{
  entry: "playground" | "deploy";
  skillSource?: string;
  skillName?: string;
  sourceLabel?: string;
  evaluation?: GateEvaluation | null;
}>(), {
  skillSource: "",
  skillName: "",
  sourceLabel: "",
  evaluation: null
});

const busy = ref(false);
const me = ref<MeResponse | null>(null);
const notice = ref<Notice | null>(null);
const provisioning = ref(false);
const pendingSaved = ref(false);
const checkoutStarted = ref(false);
const queuedSkillNames = ref<string[]>(skills.filter((skill) => skill.featured).slice(0, 2).map((skill) => skill.name));

const starterSkills = computed(() => skills.filter((skill) => skill.featured).slice(0, 4));
const signedIn = computed(() => Boolean(me.value?.user));
const paid = computed(() => Boolean(me.value?.subscription?.active));
const vault = computed(() => me.value?.vault ?? null);
const teamSlug = computed(() => vault.value?.slug ?? slugify(me.value?.user?.email || me.value?.user?.name || "your-team"));
const hostedEndpoint = computed(() => vault.value?.public_url ?? `https://vault.autovault.dev/${teamSlug.value}`);
const headline = computed(() => props.entry === "playground" ? "Move this passing skill into a hosted vault" : "Create a hosted static vault namespace");
const primaryLabel = computed(() => props.entry === "playground" ? "Move this skill to hosted vault" : "Start hosted vault");
const showAuthActions = computed(() => !signedIn.value);
const commandBlock = computed(() => [
  `autovault cloud connect ${hostedEndpoint.value}`,
  "autovault sync --cloud",
  "autovault cloud pull --pending"
].join("\n"));

const flowItems = computed(() => [
  {
    label: "Auth",
    detail: signedIn.value ? userLabel.value : "Continue with GitHub or Google",
    state: signedIn.value ? "done" : "ready"
  },
  {
    label: "Checkout",
    detail: paid.value ? "Stripe subscription active" : checkoutStarted.value ? "Redirecting to Stripe Checkout" : "Stripe-hosted payment form",
    state: paid.value ? "done" : signedIn.value ? "ready" : "pending"
  },
  {
    label: "Namespace",
    detail: vault.value ? hostedEndpoint.value : "Shared static vault storage",
    state: vault.value ? "done" : provisioning.value ? "active" : paid.value ? "ready" : "pending"
  },
  {
    label: "Sync",
    detail: pendingSaved.value ? "Pending cloud import saved" : "CLI signs and syncs local files",
    state: pendingSaved.value ? "done" : vault.value ? "ready" : "pending"
  }
]);

const provisionSteps = computed(() => [
  { label: props.entry === "playground" ? "Store browser draft in session" : "Queue selected starter skills", done: props.entry === "playground" ? hasDraft() : queuedSkillNames.value.length > 0, active: false },
  { label: "Confirm paid access from webhook state", done: paid.value, active: signedIn.value && !paid.value },
  { label: "Allocate tenant namespace", done: Boolean(vault.value), active: provisioning.value },
  { label: "Save pending cloud import", done: pendingSaved.value, active: Boolean(vault.value) && !pendingSaved.value },
  { label: "Sync signed bundles from CLI", done: false, active: Boolean(vault.value) }
]);

const userLabel = computed(() => {
  const user = me.value?.user;
  return user?.email || user?.name || "Signed in";
});

onMounted(async () => {
  await loadMe();
  resumeCheckoutReturn();
});

async function startFlow() {
  persistDraft();
  busy.value = true;
  notice.value = null;

  try {
    await loadMe();
    if (!signedIn.value) {
      notice.value = { kind: "warn", text: "Sign in first; the draft will stay in this browser through checkout." };
      return;
    }
    if (!paid.value) {
      await startCheckout();
      return;
    }
    await provisionVault();
  } finally {
    busy.value = false;
  }
}

function persistDraft() {
  if (!canUseBrowser()) return;
  const draft = buildDraft();
  if (!draft) return;
  window.sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft));
}

function buildDraft(): PendingDraft | null {
  const sourceText = props.skillSource.trim();
  if (!sourceText) return null;
  return {
    sourceText,
    skillName: props.skillName || props.evaluation?.skill?.name || "pasted-skill",
    version: props.evaluation?.skill?.version,
    sourceLabel: props.sourceLabel || "browser playground",
    signature: props.evaluation?.signature ?? undefined,
    createdAt: new Date().toISOString()
  };
}

function readDraft(): PendingDraft | null {
  if (!canUseBrowser()) return null;
  const raw = window.sessionStorage.getItem(PENDING_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingDraft;
  } catch {
    return null;
  }
}

function hasDraft() {
  return Boolean(buildDraft() || readDraft());
}

async function loadMe() {
  try {
    const response = await fetch("/api/me", { credentials: "include", headers: { accept: "application/json" } });
    if (!response.ok) {
      me.value = { user: null };
      return;
    }
    me.value = await response.json() as MeResponse;
  } catch {
    me.value = { user: null };
  }
}

async function startCheckout() {
  checkoutStarted.value = true;
  const response = await fetch("/api/checkout/hosted-vault", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ return_to: currentReturnPath(), source: props.entry })
  });

  if (response.status === 401) {
    notice.value = { kind: "warn", text: "Your session expired. Continue with GitHub or Google to resume." };
    checkoutStarted.value = false;
    return;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.url) {
    checkoutStarted.value = false;
    notice.value = { kind: "fail", text: payload.error || "Stripe Checkout is not configured for this environment yet." };
    return;
  }

  window.location.assign(payload.url);
}

async function provisionVault() {
  provisioning.value = true;
  const response = await fetch("/api/vaults/provision", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ queued_skills: queuedSkillNames.value })
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 402) {
    notice.value = { kind: "warn", text: "Checkout completed, but the Stripe webhook has not marked the subscription active yet. Refresh in a moment." };
    provisioning.value = false;
    return;
  }

  if (!response.ok || !payload.vault) {
    notice.value = { kind: "fail", text: payload.error || "Could not provision the hosted namespace." };
    provisioning.value = false;
    return;
  }

  me.value = { ...(me.value ?? { user: null }), vault: payload.vault };
  await savePendingImport();
  provisioning.value = false;
  notice.value = { kind: "ok", text: "Hosted namespace ready. Run the CLI commands to sign, sync, and pull pending imports." };
}

async function savePendingImport() {
  const draft = buildDraft() || readDraft();
  if (!draft && queuedSkillNames.value.length === 0) return;

  const response = await fetch("/api/vaults/current/pending-skills", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      skill_name: draft?.skillName,
      version: draft?.version,
      source_label: draft?.sourceLabel,
      source_text: draft?.sourceText,
      signature: draft?.signature,
      queued_skills: queuedSkillNames.value
    })
  });

  if (response.ok) pendingSaved.value = true;
}

function resumeCheckoutReturn() {
  if (!canUseBrowser()) return;
  const params = new URLSearchParams(window.location.search);
  const hosted = params.get("hosted");
  if (hosted === "cancelled") {
    notice.value = { kind: "warn", text: "Checkout was cancelled. The browser draft is still available here." };
    return;
  }
  if (hosted !== "success") return;

  notice.value = { kind: "warn", text: "Checkout returned. Waiting for Stripe webhook state before final vault activation." };
  if (paid.value) {
    void provisionVault();
  }
}

function authStartUrl(provider: AuthProvider) {
  return `/api/auth/start?provider=${provider}&return_to=${encodeURIComponent(currentReturnPath())}`;
}

function currentReturnPath() {
  if (!canUseBrowser()) return "/deploy.html#hosts";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function toggleSkill(name: string) {
  queuedSkillNames.value = queuedSkillNames.value.includes(name)
    ? queuedSkillNames.value.filter((skillName) => skillName !== name)
    : [...queuedSkillNames.value, name];
}

async function copyCommands() {
  await copyText(commandBlock.value);
  notice.value = { kind: "ok", text: "Terminal commands copied." };
}

async function copyAgentHandoff(agent: "claude-code" | "cursor") {
  const label = agent === "claude-code" ? "Claude Code" : "Cursor";
  await copyText(`# ${label} hosted AutoVault handoff\n${commandBlock.value}\n`);
  notice.value = { kind: "ok", text: `${label} handoff copied.` };
}

async function copyText(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // Copy buttons are a browser convenience; the command block remains visible.
  }
}

function slugify(value: string) {
  const slug = value.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "your-team";
}

function canUseBrowser() {
  return typeof window !== "undefined";
}
</script>
