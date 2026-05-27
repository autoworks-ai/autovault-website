<template>
  <section class="hosted-funnel" :data-entry="entry">
    <div class="hosted-funnel-head">
      <div class="hosted-heading">
        <span class="hosted-vault-lock" :class="`is-${hostedVaultPhase}`">
          <BrandMark :size="34" :state="hostedVaultState" show-depth />
        </span>
        <div>
          <div class="mono-label">hosted vault</div>
          <h3>{{ headline }}</h3>
          <p>
            AutoVault reserves a paid tenant namespace and stores pending onboarding drafts.
            Cloud sync is not enabled yet; your local CLI remains the source of truth for gated, signed files.
          </p>
        </div>
      </div>
      <button class="hosted-primary" type="button" :disabled="busy" @click="startFlow">
        {{ busy ? "Working..." : primaryLabel }}
      </button>
    </div>

    <div v-if="staticPreview" class="hosted-notice warn">
      This preview can show Clerk, but the checkout and provisioning APIs run through Cloudflare Pages Functions. Use http://127.0.0.1:8788/cloud for an end-to-end local test.
    </div>

    <div v-if="notice" class="hosted-notice" :class="notice.kind">{{ notice.text }}</div>

    <div class="hosted-stage-card" :class="stageFocus.state">
      <div class="hosted-stage-kicker">{{ stageFocus.kicker }}</div>
      <h4>{{ stageFocus.title }}</h4>
      <p>{{ stageFocus.body }}</p>
      <div class="hosted-stage-action">
        <ClerkAuthControls
          v-if="stageFocus.action === 'auth'"
          variant="funnel"
          cta-label="Create your account"
          signed-in-label="Continue onboarding"
          @click.capture="persistDraft"
          @signed-in-action="startFlow"
        />
        <button v-else-if="stageFocus.action === 'checkout'" class="hosted-primary" type="button" :disabled="busy" @click="startFlow">
          {{ checkoutStarted ? "Opening Checkout..." : "Open test checkout" }}
        </button>
        <button v-else-if="stageFocus.action === 'reserve'" class="hosted-primary" type="button" :disabled="busy" @click="startFlow">
          {{ provisioning ? "Reserving..." : "Reserve namespace" }}
        </button>
      </div>
    </div>

    <div class="hosted-flow hosted-flow--compact" aria-label="Hosted onboarding steps">
      <div v-for="(item, index) in flowItems" :key="item.label" class="hosted-flow-item" :class="item.state" :style="{ '--step-index': index }">
        <span class="hosted-dot" />
        <span class="hosted-flow-copy">
          <strong>{{ item.label }}</strong>
          <span>{{ item.detail }}</span>
        </span>
      </div>
    </div>

    <div v-if="showSetupDetails" class="hosted-provision-grid">
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

    <div v-if="showLocalHandoff" class="hosted-command-card">
      <div class="panel-title">Local handoff</div>
      <pre><code>{{ commandBlock }}</code></pre>
      <div class="hosted-copy-row">
        <button type="button" @click="copyCommands">Copy local commands</button>
        <button type="button" @click="copyAgentHandoff('claude-code')">Copy Claude Code handoff</button>
        <button type="button" @click="copyAgentHandoff('cursor')">Copy Cursor handoff</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import BrandMark from "./BrandMark.vue";
import ClerkAuthControls from "./ClerkAuthControls.vue";
import { skills } from "../data/skills";
import type { GateEvaluation } from "../utils/skillGate";
import { useClerkApiAuth } from "../utils/clerkApi";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";

const PENDING_DRAFT_KEY = "autovault.hostedVault.pendingDraft";

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
const emit = defineEmits<{
  stateChange: [state: MeResponse];
}>();

const busy = ref(false);
const me = ref<MeResponse | null>(null);
const notice = ref<Notice | null>(null);
const provisioning = ref(false);
const pendingSaved = ref(false);
const checkoutStarted = ref(false);
const staticPreview = ref(false);
const queuedSkillNames = ref<string[]>(skills.filter((skill) => skill.featured).slice(0, 2).map((skill) => skill.name));
const { authHeaders, isClerkLoaded, isClerkSignedIn, clerkUserLabel, clerkUserSlugSeed } = useClerkApiAuth();

const starterSkills = computed(() => skills.filter((skill) => skill.featured).slice(0, 4));
const signedIn = computed(() => Boolean(me.value?.user) || isClerkSignedIn.value);
const paid = computed(() => Boolean(me.value?.subscription?.active));
const vault = computed(() => me.value?.vault ?? null);
const teamSlug = computed(() => vault.value?.slug ?? slugify(me.value?.user?.email || me.value?.user?.name || clerkUserSlugSeed.value || "your-team"));
const hostedEndpoint = computed(() => vault.value?.public_url ?? `https://vault.autovault.dev/${teamSlug.value}`);
const headline = computed(() => props.entry === "playground" ? "Reserve a namespace for this passing skill" : "Reserve a hosted AutoVault namespace");
const primaryLabel = computed(() => props.entry === "playground" ? "Reserve namespace" : "Start paid onboarding");
const showSetupDetails = computed(() => signedIn.value || paid.value || Boolean(vault.value) || props.entry === "playground");
const showLocalHandoff = computed(() => signedIn.value || Boolean(vault.value));
const namespaceStatusLabel = computed(() => vault.value ? "Hosted namespace reserved:" : "Planned namespace:");
const hostedVaultState = computed<"locked" | "unlocked">(() => (vault.value || provisioning.value ? "unlocked" : "locked"));
const hostedVaultPhase = computed(() => (vault.value ? "ready" : provisioning.value ? "active" : "locked"));
const commandBlock = computed(() => [
  AUTOVAULT_INSTALL_COMMAND,
  ". \"$HOME/.autovault/env\"",
  "autovault skill list",
  "",
  `# ${namespaceStatusLabel.value}`,
  `# ${hostedEndpoint.value}`,
  vault.value ? "# Cloud sync is not enabled yet." : "# Checkout must complete before this namespace is reserved."
].join("\n"));

const stageFocus = computed(() => {
  if (!signedIn.value) {
    return {
      kicker: "Step 1 of 4",
      title: "Create your AutoVault account",
      body: "Clerk will open a secure sign-up window. After it finishes, this page will unlock checkout without asking you to restart.",
      action: "auth",
      state: "ready"
    };
  }
  if (!paid.value) {
    return {
      kicker: "Step 2 of 4",
      title: "Finish test checkout",
      body: "Stripe Checkout records the subscription state through a webhook before AutoVault reserves your namespace.",
      action: "checkout",
      state: checkoutStarted.value ? "active" : "ready"
    };
  }
  if (!vault.value) {
    return {
      kicker: "Step 3 of 4",
      title: "Reserve your namespace",
      body: "AutoVault will create the stable hosted URL now. Cloud sync stays disabled until the CLI commands ship.",
      action: "reserve",
      state: provisioning.value ? "active" : "ready"
    };
  }
  return {
    kicker: "Step 4 of 4",
    title: "Namespace reserved",
    body: `${hostedEndpoint.value} is held for this account. Keep using the local CLI for signing and profile sync while hosted sync is in progress.`,
    action: "local",
    state: "done"
  };
});

const flowItems = computed(() => [
  {
    label: "Auth",
    detail: signedIn.value ? userLabel.value : "Create an account or sign in",
    state: signedIn.value ? "done" : "ready"
  },
  {
    label: "Checkout",
    detail: paid.value ? "Stripe subscription active" : checkoutStarted.value ? "Redirecting to Stripe Checkout" : "Stripe-hosted test-mode payment form",
    state: paid.value ? "done" : signedIn.value ? "ready" : "pending"
  },
  {
    label: "Namespace",
    detail: vault.value ? `${hostedEndpoint.value} reserved` : "Reserved namespace anchor",
    state: vault.value ? "done" : provisioning.value ? "active" : paid.value ? "ready" : "pending"
  },
  {
    label: "Sync",
    detail: pendingSaved.value ? "Pending import saved for later cloud sync" : "Cloud CLI sync is coming soon",
    state: pendingSaved.value ? "done" : vault.value ? "ready" : "pending"
  }
]);

const provisionSteps = computed(() => [
  { label: props.entry === "playground" ? "Store browser draft in session" : "Queue selected starter skills", done: props.entry === "playground" ? hasDraft() : queuedSkillNames.value.length > 0, active: false },
  { label: "Confirm paid access from webhook state", done: paid.value, active: signedIn.value && !paid.value },
  { label: "Reserve tenant namespace", done: Boolean(vault.value), active: provisioning.value },
  { label: "Save pending onboarding import", done: pendingSaved.value, active: Boolean(vault.value) && !pendingSaved.value },
  { label: "Cloud CLI sync coming soon", done: false, active: Boolean(vault.value) }
]);

const userLabel = computed(() => {
  const user = me.value?.user;
  return user?.email || user?.name || clerkUserLabel.value || "Signed in";
});

onMounted(async () => {
  staticPreview.value = canUseBrowser() && window.location.port === "5173";
  await loadMe();
  resumeCheckoutReturn();
});

watch([isClerkLoaded, isClerkSignedIn], ([loaded]) => {
  if (!loaded) return;
  void loadMe().then(() => {
    resumeCheckoutReturn();
  });
});

async function startFlow() {
  persistDraft();
  busy.value = true;
  notice.value = null;

  try {
    await loadMe();
    if (!signedIn.value) {
      notice.value = { kind: "warn", text: "Create your account first. The draft will stay in this browser through checkout." };
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
    const response = await fetch("/api/me", { credentials: "include", headers: await authHeaders({ accept: "application/json" }) });
    if (!response.ok) {
      me.value = { user: null };
      emit("stateChange", me.value);
      return;
    }
    me.value = await response.json() as MeResponse;
    emit("stateChange", me.value);
  } catch {
    me.value = { user: null };
    emit("stateChange", me.value);
  }
}

async function startCheckout() {
  checkoutStarted.value = true;
  const response = await fetch("/api/checkout/hosted-vault", {
    method: "POST",
    credentials: "include",
    headers: await authHeaders({ "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({ return_to: currentReturnPath(), source: props.entry })
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    notice.value = { kind: "warn", text: payload.error || "Your session expired. Sign in again to resume." };
    checkoutStarted.value = false;
    return;
  }

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
    headers: await authHeaders({ "content-type": "application/json", accept: "application/json" }),
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
  emit("stateChange", me.value);
  await savePendingImport();
  provisioning.value = false;
  notice.value = { kind: "ok", text: "Hosted namespace reserved. Cloud sync is not enabled yet; keep signing and serving skills locally for now." };
}

async function savePendingImport() {
  const draft = buildDraft() || readDraft();
  if (!draft && queuedSkillNames.value.length === 0) return;

  const response = await fetch("/api/vaults/current/pending-skills", {
    method: "POST",
    credentials: "include",
    headers: await authHeaders({ "content-type": "application/json", accept: "application/json" }),
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

  notice.value = { kind: "warn", text: "Checkout returned. Waiting for Stripe webhook state before reserving the namespace." };
  if (paid.value) {
    void provisionVault();
  }
}

function currentReturnPath() {
  if (!canUseBrowser()) return "/cloud#launch-path";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function toggleSkill(name: string) {
  queuedSkillNames.value = queuedSkillNames.value.includes(name)
    ? queuedSkillNames.value.filter((skillName) => skillName !== name)
    : [...queuedSkillNames.value, name];
}

async function copyCommands() {
  await copyText(commandBlock.value);
  notice.value = { kind: "ok", text: "Local commands copied." };
}

async function copyAgentHandoff(agent: "claude-code" | "cursor") {
  const label = agent === "claude-code" ? "Claude Code" : "Cursor";
  await copyText(`# ${label} paid hosted AutoVault handoff\n${commandBlock.value}\n\nCloud sync commands are not enabled in this MVP. Keep using the local AutoVault CLI until hosted sync ships.\n`);
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
