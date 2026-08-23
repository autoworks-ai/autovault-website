<template>
  <!--
    Chrome-free by design. CloudPage owns the shell, the page heading, the
    step kicker and the one progress rail; this component is now only the
    transport plus the single action for the current pre-vault step.

    It used to render a four-card status row, a five-row provisioning
    checklist and its own "Step N of 4" kicker -- three separate derivations
    of the same booleans, sitting inside a page that had a fourth. That is
    what made the funnel announce four steps and then hand over to a
    different two-step model partway through.
  -->
  <section class="hosted-funnel">
    <div v-if="staticPreview" class="hosted-notice warn">
      This preview can show Clerk, but the checkout and provisioning APIs run through Cloudflare Pages Functions. Use http://127.0.0.1:8788/cloud for an end-to-end local test.
    </div>

    <div v-if="!vault" class="hosted-stage-action">
      <ClerkAuthControls
        v-if="actionKind === 'auth'"
        variant="funnel"
        cta-label="Create your account"
        signed-in-label="Continue onboarding"
        @click.capture="persistDraft"
        @signed-in-action="startFlow"
      />
      <button v-else-if="actionKind === 'checkout'" class="hosted-primary" type="button" :disabled="busy" @click="startFlow">
        {{ checkoutStarted ? "Opening Checkout..." : "Open checkout" }}
      </button>
      <button v-else-if="actionKind === 'reserve'" class="hosted-primary" type="button" :disabled="busy" @click="startFlow">
        {{ provisioning ? "Reserving..." : "Reserve namespace" }}
      </button>
    </div>

    <div v-if="showSetupDetails" class="hosted-panel">
      <div class="panel-title">Starter skills to queue</div>
      <div class="starter-skills">
        <button v-for="skill in starterSkills" :key="skill.name" type="button" :class="{ queued: queuedSkillNames.includes(skill.name) }" :aria-pressed="queuedSkillNames.includes(skill.name)" @click="toggleSkill(skill.name)">
          <span class="skill-icon">{{ skill.icon }}</span>
          <span>
            <strong>{{ skill.name }}</strong>
            <small>{{ skill.desc }}</small>
          </span>
        </button>
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
import { computed, nextTick, onMounted, ref, watch } from "vue";
import ClerkAuthControls from "./ClerkAuthControls.vue";
import { skills } from "../data/skills";
import type { GateEvaluation } from "../utils/skillGate";
import { clerkAuthRecoveryMessage, isClerkApiAuthError, useClerkApiAuth } from "../utils/clerkApi";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";

const PENDING_DRAFT_KEY = "autovault.hostedVault.pendingDraft";

type Notice = { kind: "ok" | "warn" | "fail"; text: string };
type MeResponse = {
  user: { id: string; email?: string | null; name?: string | null; avatar_url?: string | null } | null;
  subscription?: { active: boolean; status?: string | null } | null;
  vault?: { id?: string; slug: string; status: string; public_url: string; cli_linked_at?: string | null; early_access_at?: string | null } | null;
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
  // The shell's authoritative /api/me. See `current` below.
  state?: MeResponse | null;
}>(), {
  skillSource: "",
  skillName: "",
  sourceLabel: "",
  evaluation: null,
  state: null
});
const emit = defineEmits<{
  stateChange: [state: MeResponse];
  notice: [notice: Notice | null];
}>();

const busy = ref(false);
const me = ref<MeResponse | null>(null);
const notice = ref<Notice | null>(null);
const provisioning = ref(false);
const reconciling = ref(false);
const pendingSaved = ref(false);
const checkoutStarted = ref(false);
const staticPreview = ref(false);
const queuedSkillNames = ref<string[]>(skills.filter((skill) => skill.featured).slice(0, 2).map((skill) => skill.name));
const { authHeaders, clerkAuthEnabled, isClerkLoaded, isClerkSignedIn, clerkUserLabel, clerkUserSlugSeed } = useClerkApiAuth();

function trackPirsch(name: string, meta: Record<string, unknown> = {}) {
  try {
    if (typeof window !== "undefined") {
      const pirsch = (window as any).pirsch;
      if (typeof pirsch === "function") {
        // pa.js uses a command dispatcher: first arg is the command ("event"),
        // second arg is the event name, third is options containing meta.
        pirsch("event", name, { meta });
      }
    }
  } catch {}
}
let meRequestSeq = 0;
let reconcileAttempted = false;

const starterSkills = computed(() => skills.filter((skill) => skill.featured).slice(0, 4));

// The shell owns /api/me; this component must not decide what to render from
// its own copy.
//
// Both of them used to fetch the same endpoint independently, so the two could
// disagree -- and the disagreement had a price. If the shell's request
// succeeded and this one failed, the shell showed "Reserve your namespace"
// while the button here still said "Open checkout", and clicking it opened a
// second subscription-mode Stripe Checkout for somebody already paying.
//
// The local `me` survives only as a fallback for a mount with no shell around
// it, and as the write target for the Stripe-return and provisioning paths
// that then hand their result up. Whenever the shell has state, the shell wins.
const current = computed<MeResponse | null>(() => props.state ?? me.value);
const signedIn = computed(() => Boolean(current.value?.user) || isClerkSignedIn.value);
const paid = computed(() => Boolean(current.value?.subscription?.active));
const vault = computed(() => current.value?.vault ?? null);
const teamSlug = computed(() => vault.value?.slug ?? slugify(current.value?.user?.email || current.value?.user?.name || clerkUserSlugSeed.value || "your-team"));
const hostedEndpoint = computed(() => vault.value?.public_url ?? `https://vault.autovault.dev/${teamSlug.value}`);
const namespaceStatusLabel = computed(() => vault.value ? "Hosted namespace reserved:" : "Planned namespace:");
const commandBlock = computed(() => [
  AUTOVAULT_INSTALL_COMMAND,
  ". \"$HOME/.autovault/env\"",
  "autovault skill list",
  "",
  `# ${namespaceStatusLabel.value}`,
  `# ${hostedEndpoint.value}`,
  vault.value ? "# Cloud sync is not enabled yet." : "# Checkout must complete before this namespace is reserved."
].join("\n"));

// Which single action this step needs. CloudPage owns the kicker, heading
// and body copy now, so all that survives here is the branch that decides
// WHICH control renders -- not what it says about itself.
//
// Replaced stageFocus (a "Step N of 4" kicker), flowItems (four status
// cards) and provisionSteps (a five-row checklist): three separate
// derivations of signedIn/paid/vault that had to be kept in sync by hand,
// inside a page that maintained a fourth.
// Lift notices to the shell's single live region rather than rendering a
// second one here. Two competing aria-live regions on one page is an a11y
// defect the old split created.
watch(notice, (next) => emit("notice", next));

const actionKind = computed<"auth" | "checkout" | "reserve" | "local">(() => {
  if (!signedIn.value) return "auth";
  if (!paid.value) return "checkout";
  if (!vault.value) return "reserve";
  return "local";
});

// Both panels are scoped to the reserve step only.
//
// They used to render from sign-in onward, which meant the "Finish checkout"
// step showed a starter-skill picker and a block of install commands
// alongside its one button -- neither of which has anything to do with
// paying. The design spec's rule for this surface is "never show more than
// the one thing that matters right now", and a checkout step carrying two
// unrelated panels is exactly what that rule forbids.
//
// At the reserve step they are both on-topic: the skills are what gets
// queued into the namespace being created, and the handoff is what to do
// next locally.
const atReserveStep = computed(() => actionKind.value === "reserve");
const showSetupDetails = computed(() => atReserveStep.value);
const showLocalHandoff = computed(() => atReserveStep.value);


onMounted(async () => {
  staticPreview.value = canUseBrowser() && window.location.port === "5173";
  if (clerkAuthEnabled && !isClerkLoaded.value) return;
  await loadMe();
  await resumeCheckoutReturn();
});

watch([isClerkLoaded, isClerkSignedIn], ([loaded]) => {
  if (!loaded) return;
  void loadMe().then(() => resumeCheckoutReturn());
});

async function startFlow() {
  persistDraft();
  busy.value = true;
  notice.value = null;

  try {
    await loadMe();
    trackPirsch("Hosted Vault: Flow Started", { entry: props.entry, signedIn: signedIn.value });
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

// Every caller reads signedIn / paid / vault straight after awaiting this, and
// those now come from a PROP, which only updates once the shell has re-rendered
// with the state this hands up. Settle that round trip in one place rather than
// making four call sites remember to.
async function loadMe() {
  await fetchMe();
  await nextTick();
}

async function fetchMe() {
  const requestSeq = ++meRequestSeq;
  try {
    const headers = await authHeaders({ accept: "application/json" }, {
      required: clerkAuthEnabled && isClerkSignedIn.value,
      fresh: isClerkSignedIn.value
    });
    const response = await fetch("/api/me", { credentials: "include", headers });
    if (requestSeq !== meRequestSeq) return;
    if (!response.ok) {
      // A non-OK /api/me means "we could not find out", not "signed out", so
      // it must not be broadcast. The shell treats every payload it receives
      // as authoritative and bumps its own request sequence on arrival, so a
      // single transient failure here would cancel the shell's in-flight --
      // possibly successful -- load and install an anonymous state over it,
      // dropping a signed-in subscriber back to the checkout step.
      //
      // Nothing authoritative is lost by staying quiet: /api/me answers a
      // genuinely signed-out visitor with 200 and a null user, which does get
      // emitted, and the shell runs its own load with its own error handling.
      return;
    }
    me.value = await response.json() as MeResponse;
    emit("stateChange", me.value);
  } catch (error) {
    if (requestSeq !== meRequestSeq) return;
    if (isClerkApiAuthError(error)) {
      if (error.reason !== "clerk-not-loaded") {
        notice.value = { kind: "warn", text: clerkAuthRecoveryMessage(error) };
      }
      return;
    }
    // Same reasoning as the non-OK branch above: a thrown fetch is not
    // evidence that anybody signed out. Leave the last known state alone.
  }
}

async function startCheckout() {
  checkoutStarted.value = true;
  trackPirsch("Hosted Vault: Checkout Started", { entry: props.entry });
  const headers = await protectedAuthHeaders({ "content-type": "application/json", accept: "application/json" });
  if (!headers) {
    checkoutStarted.value = false;
    return;
  }
  const response = await fetch("/api/checkout/hosted-vault", {
    method: "POST",
    credentials: "include",
    headers,
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
  if (provisioning.value) return;
  provisioning.value = true;
  trackPirsch("Hosted Vault: Provision Requested", { entry: props.entry, skills: queuedSkillNames.value.length });
  try {
    const headers = await protectedAuthHeaders({ "content-type": "application/json", accept: "application/json" });
    if (!headers) return;
    const response = await fetch("/api/vaults/provision", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ queued_skills: queuedSkillNames.value })
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 402) {
      notice.value = { kind: "warn", text: "Checkout completed, but the Stripe webhook has not marked the subscription active yet. Refresh in a moment." };
      return;
    }

    if (!response.ok || !payload.vault) {
      notice.value = { kind: "fail", text: payload.error || "Could not provision the hosted namespace." };
      return;
    }

    // Success notice FIRST. This also clears any stale warn from an earlier
    // attempt ("waiting for the webhook") that would otherwise still be on
    // screen when the shell advances to the connect step.
    notice.value = { kind: "ok", text: "Hosted namespace reserved. Keep signing and serving skills locally — hosted sync ships next." };
    // Merge onto `current`, not onto the local copy. If this component's own
    // /api/me failed earlier the local copy is still null, and handing the
    // shell { user: null, vault } would install an anonymous state over the
    // good one it already has -- signing the user out at the exact moment
    // their namespace was created.
    me.value = { ...(current.value ?? { user: null }), vault: payload.vault };
    emit("stateChange", me.value);
    // Same reason loadMe settles one: the state this just handed up comes back
    // as a prop, and resumeCheckoutReturn reads vault.value immediately after
    // awaiting this call -- to decide whether to clear ?hosted=success from
    // the URL. Without settling, that read races Vue's render flush.
    await nextTick();
    // Runs after the shell has already advanced. It only persists queued
    // skills; nothing user-visible depends on its result.
    await savePendingImport();
  } finally {
    provisioning.value = false;
  }
}

async function savePendingImport() {
  const draft = buildDraft() || readDraft();
  if (!draft && queuedSkillNames.value.length === 0) return;
  const headers = await protectedAuthHeaders({ "content-type": "application/json", accept: "application/json" });
  if (!headers) return;

  const response = await fetch("/api/vaults/current/pending-skills", {
    method: "POST",
    credentials: "include",
    headers,
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

async function resumeCheckoutReturn() {
  if (!canUseBrowser()) return;
  const params = new URLSearchParams(window.location.search);
  const hosted = params.get("hosted");
  const sessionId = params.get("session_id");

  if (hosted === "cancelled") {
    notice.value = { kind: "warn", text: "Checkout was cancelled. The browser draft is still available here." };
    clearCheckoutReturnParams();
    return;
  }
  if (hosted !== "success") return;
  if (vault.value) {
    clearCheckoutReturnParams();
    return;
  }

  if (!paid.value && sessionId && signedIn.value && !reconcileAttempted && !reconciling.value) {
    reconcileAttempted = true;
    await reconcileCheckout(sessionId);
  }

  if (paid.value && !vault.value) {
    await provisionVault();
  } else if (!paid.value) {
    notice.value = {
      kind: "warn",
      text: "Checkout returned. Waiting for Stripe to confirm your subscription before reserving the namespace."
    };
  }

  if (vault.value) clearCheckoutReturnParams();
}

async function reconcileCheckout(sessionId: string) {
  reconciling.value = true;
  try {
    const headers = await protectedAuthHeaders({ "content-type": "application/json", accept: "application/json" });
    if (!headers) return;
    const response = await fetch("/api/billing/reconcile", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ session_id: sessionId })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      notice.value = {
        kind: "warn",
        text: payload.error || "Could not confirm the checkout session yet. Refresh in a moment."
      };
      return;
    }
    await loadMe();
  } catch {
    notice.value = {
      kind: "warn",
      text: "Could not reach the reconcile endpoint. Refresh in a moment."
    };
  } finally {
    reconciling.value = false;
  }
}

async function protectedAuthHeaders(headers: Record<string, string>) {
  try {
    return await authHeaders(headers, { required: true, fresh: true });
  } catch (error) {
    notice.value = { kind: "warn", text: clerkAuthRecoveryMessage(error) };
    return null;
  }
}

function clearCheckoutReturnParams() {
  if (!canUseBrowser()) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("hosted") && !url.searchParams.has("session_id")) return;
  url.searchParams.delete("hosted");
  url.searchParams.delete("session_id");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
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
  await copyText(`# ${label} paid hosted AutoVault handoff\n${commandBlock.value}\n\nHosted sync is not enabled yet. Keep using the local AutoVault CLI; this namespace and any skills carry over when it ships.\n`);
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
