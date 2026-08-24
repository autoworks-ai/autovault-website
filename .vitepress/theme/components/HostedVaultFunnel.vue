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

    <!--
      The namespace field. Rendered at every pre-vault step rather than only at
      the reserve step, and that is not a lapse of the "one thing at a time"
      rule the starter-skill and local-handoff panels obey.

      Two facts force it. The slug is chosen at step one because that is where
      the user asked to choose it, and it is permanent -- the CLI's link command
      resolves it to a catalog URL that enrolled machines then pin, and there is
      no rename path -- so the value also has to be on screen at the moment it is
      actually claimed, three steps later. Hiding it in between would mean
      clicking "Reserve namespace" without seeing the name being reserved.

      Nothing is written to the database until that click. The value rides
      through Stripe in the same sessionStorage draft the skill playground uses.
    -->
    <div v-if="!vault" class="hosted-namespace">
      <label class="hosted-namespace-label" for="hosted-namespace">Your namespace</label>
      <div class="hosted-namespace-field" :class="namespaceState.tone">
        <span class="hosted-namespace-prefix" aria-hidden="true">vault.autovault.dev/</span>
        <input
          id="hosted-namespace"
          ref="namespaceInputRef"
          class="hosted-namespace-input"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="your-team"
          :maxlength="VAULT_SLUG_MAX_LENGTH"
          :value="namespaceInput"
          :aria-invalid="namespaceState.tone === 'fail' ? 'true' : undefined"
          aria-describedby="hosted-namespace-status hosted-namespace-note"
          @input="onNamespaceInput"
        />
      </div>
      <!--
        Described-by, not a live region. CloudPage owns the one aria-live region
        on this page; a second one that re-announces on every debounced keystroke
        would talk over it. The result of the action itself -- reserved, refused,
        already taken -- goes through that single region as a notice.
      -->
      <p id="hosted-namespace-status" class="hosted-namespace-status" :class="namespaceState.tone">
        {{ namespaceState.text }}
      </p>
      <p id="hosted-namespace-note" class="hosted-namespace-note">
        Your CLI links to this name and it cannot be changed later.
      </p>
    </div>

    <!--
      The marker is ANDed with the same predicate that enables the button, not
      just with `markedAction`. Those two arrived from different branches:
      `markedAction` is the shell's "this is the one thing to do", decided in
      utils/nextAction.ts, which knows nothing about this component's namespace
      field; `canCheckout`/`canReserve` gate the button on a name the server
      has not refused. Marked-but-disabled is the one combination that must not
      exist -- a halo saying "do this" on a control that cannot be clicked, at
      the exact moment the field above says why. `busy` is deliberately NOT in
      this condition: it is transient and the action is still the right one, so
      dropping the halo for the length of a request would just make it flicker.
    -->
    <div v-if="!vault" class="hosted-stage-action">
      <!--
        `markedAction` is the shell's answer to "is this component's button the
        one thing to do right now", and it is passed straight through to
        whichever of the three branches is live. The decision is not made here:
        this component only ever sees the pre-vault steps, and the marker has
        to be unique across the whole page — including the Machines card, which
        this component knows nothing about. See cloudNextAction() in
        utils/nextAction.ts.
      -->
      <ClerkAuthControls
        v-if="actionKind === 'auth'"
        variant="funnel"
        cta-label="Create your account"
        signed-in-label="Continue onboarding"
        :mark-primary="markedAction"
        @click.capture="persistDraft"
        @signed-in-action="startFlow"
      />
      <button v-else-if="actionKind === 'checkout'" class="hosted-primary" :class="{ 'av-nextaction': markedAction && canCheckout }" type="button" :disabled="busy || !canCheckout" @click="startFlow">
        {{ checkoutStarted ? "Opening Checkout..." : "Open checkout" }}
      </button>
      <button v-else-if="actionKind === 'reserve'" class="hosted-primary" :class="{ 'av-nextaction': markedAction && canReserve }" type="button" :disabled="busy || !canReserve" @click="startFlow">
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
      <!-- "Install", not the old "Local handoff": this block is only the
           install half. No namespace exists yet -- reserving it is what the
           button above does -- so there is no slug to link to and no link
           command to give. Calling it the handoff invited copying it and
           expecting a link, which is exactly what happened. -->
      <div class="panel-title">Install the CLI</div>
      <p class="hcc-note">
        Safe to run now — installing takes a moment.
        <code>autovault link</code> needs the namespace to exist, so it appears
        once you reserve it above.
      </p>
      <div class="hcc-terminal">
        <!-- Terminal chrome: header with dots and title -->
        <div class="terminal-head">
          <span class="dot" style="background:#d97171"></span>
          <span class="dot" style="background:#e8a866"></span>
          <span class="dot live"></span>
          <span class="ttl">~ — autovault — bash</span>
        </div>

        <!-- Accessible transcript: the animated body below is aria-hidden and
             types character by character, so this static copy (which also
             carries the namespace status lines) is what screen readers get. -->
        <pre class="visually-hidden"><code>{{ commandBlock }}</code></pre>
        <LocalHandoffTerminal />
      </div>

      <!-- Copy buttons -->
      <div class="hosted-copy-row">
        <button type="button" @click="copyCommands">Copy local commands</button>
        <button type="button" @click="copyAgentHandoff('claude-code')">Copy Claude Code handoff</button>
        <button type="button" @click="copyAgentHandoff('cursor')">Copy Cursor handoff</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, ref, watch } from "vue";
import ClerkAuthControls from "./ClerkAuthControls.vue";
import { skills } from "../data/skills";
import type { GateEvaluation } from "../utils/skillGate";
import { clerkAuthRecoveryMessage, isClerkApiAuthError, useClerkApiAuth } from "../utils/clerkApi";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";
import { copyText } from "../utils/clipboard";
import { useTerminalReplay, type TerminalReplayLine } from "../composables/useTerminalReplay";

const PENDING_DRAFT_KEY = "autovault.hostedVault.pendingDraft";

// Mirrors functions/api/_lib/vault.js. Shape only, and only so the field can
// answer instantly: the server re-validates everything, owns the reserved-word
// list, and is the only thing that decides what gets written. Duplicating the
// reserved list here would be a second copy to drift -- the server reports
// `reserved` through /api/vaults/availability instead.
const VAULT_SLUG_MIN_LENGTH = 3;
const VAULT_SLUG_MAX_LENGTH = 32;
const VAULT_SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAMESPACE_CHECK_DELAY_MS = 350;

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
  // The namespace the user typed before leaving for Stripe. Carried in the
  // existing draft rather than a second storage key: one thing already survives
  // checkout in this browser, and two would drift.
  desiredSlug?: string;
  createdAt: string;
};

type NamespaceVerdict = {
  slug: string;
  available: boolean;
  code: string;
  message: string;
};

const props = withDefaults(defineProps<{
  entry: "playground" | "deploy";
  skillSource?: string;
  skillName?: string;
  sourceLabel?: string;
  evaluation?: GateEvaluation | null;
  // The shell's authoritative /api/me. See `current` below.
  state?: MeResponse | null;
  // Whether this component's one primary button is the page's single required
  // action, and therefore the one control allowed to carry `.av-nextaction`.
  // Decided by the shell (cloudNextAction), never here — this component cannot
  // see the Machines card, and the marker has to be unique across both.
  markedAction?: boolean;
}>(), {
  skillSource: "",
  skillName: "",
  sourceLabel: "",
  evaluation: null,
  state: null,
  markedAction: false
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

// Starts empty rather than pre-seeded, because this component server-renders:
// the suggestion depends on /api/me and on Clerk, neither of which exists during
// SSR, so seeding it here would put one value in the server's HTML and a
// different one in the first client render. Filled on mount instead.
const namespaceInput = ref("");
const namespaceInputRef = ref<HTMLInputElement | null>(null);
// Once they have typed, the prefill stops overwriting them -- /api/me can land
// after the first keystroke and would otherwise clobber it.
const namespaceEdited = ref(false);
const namespaceVerdict = ref<NamespaceVerdict | null>(null);
const namespaceChecking = ref(false);
// The endpoint could not answer -- a transient 401, a 5xx, or the network. It is
// a third state, not "no verdict yet": the field has to stop reporting progress
// for a check that has already stopped, without inventing a verdict it does not
// have.
const namespaceCheckFailed = ref(false);
// A refusal from the reserve attempt itself, which outranks any earlier
// availability answer: it is the newer and more authoritative fact.
const namespaceRefusal = ref("");
let namespaceCheckSeq = 0;
let namespaceCheckTimer: ReturnType<typeof setTimeout> | null = null;
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
// What the funnel proposes when the user expresses no preference. Mirrors the
// server's derived slug minus its six-hex suffix -- the suffix exists to
// guarantee uniqueness for a name nobody chose, and a name somebody IS about to
// choose does not need it. The availability check is what settles uniqueness
// here, and a clean "johngarturo" is the whole point of letting them pick.
const namespaceSuggestion = computed(() => clampSlug(
  slugify(current.value?.user?.email || current.value?.user?.name || clerkUserSlugSeed.value || "your-team")
));
const namespaceSlug = computed(() => namespaceInput.value.trim().toLowerCase());
// Not `signedIn`, which also trusts an /api/me that resolved first. The
// availability endpoint needs a credential, and authHeaders only attaches a
// Clerk token once Clerk itself reports a session -- asking before that sends a
// guaranteed 401 on every page load. Observed, not theorised.
const namespaceCheckReady = computed(() => clerkAuthEnabled ? isClerkSignedIn.value : signedIn.value);
// Follows the field before a vault exists, so the endpoint quoted in the local
// handoff card is the one they are about to reserve.
const teamSlug = computed(() => vault.value?.slug || namespaceSlug.value || namespaceSuggestion.value);
const hostedEndpoint = computed(() => vault.value?.public_url ?? `https://vault.autovault.dev/${teamSlug.value}`);
const namespaceStatusLabel = computed(() => vault.value ? "Hosted namespace reserved:" : "Planned namespace:");
const commandBlock = computed(() => [
  AUTOVAULT_INSTALL_COMMAND,
  ". \"$HOME/.autovault/env\"",
  "autovault skill list",
  "",
  `# ${namespaceStatusLabel.value}`,
  `# ${hostedEndpoint.value}`,
  // The false branch is only ever read by somebody who has already paid:
  // this block renders (and its copy buttons exist) only under
  // showLocalHandoff, which is the reserve step, which requires paid && !vault.
  // It used to say "Checkout must complete before this namespace is reserved",
  // which was survivable while the auto-provision made that state last one
  // frame; now that reserving waits for a click, it is the durable
  // post-checkout screen -- and the screen-reader transcript.
  vault.value ? "# Cloud sync is not enabled yet." : "# Checkout is complete. Reserve the namespace above to claim it.",
  // The copied text has to carry the caveat too. Somebody who pastes this into
  // a terminal is not looking at the page any more, and the block deliberately
  // has no `autovault link` in it -- there is no namespace to link to yet.
  // Without this line the paste just ends, and the reasonable conclusion is
  // that the link command is missing rather than not-yet-applicable.
  ...(vault.value ? [] : ["# `autovault link` appears here once you reserve it."])
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

// Terminal setup for the local handoff command display.
//
// This used to be `terminalReplay = computed(() => useTerminalReplay(...))`,
// read only from the template inside `v-if="showLocalHandoff"`. A computed
// getter doesn't run until first read, so `useTerminalReplay` (and the
// onMounted/onBeforeUnmount it registers internally) never executed during
// this component's setup() -- only during render, by which point Vue's
// lifecycle-hook registration (keyed off the module-scoped `currentInstance`,
// which is only set while setup() runs) silently no-ops. Result: the replay
// never started and the terminal rendered permanently empty.
//
// A top-level `useTerminalReplay(...)` call right here would run into a
// different problem: this component mounts at page load, long before
// showLocalHandoff flips true, so the whole 3-line replay would finish
// off-screen and the card would appear already fully typed with no cursor.
//
// Extracting the replay into its own child component -- mirroring
// ConnectTerminal (CloudPage.vue) -- fixes both: the child's setup() (which
// calls useTerminalReplay directly, not through a computed) only runs once
// Vue actually mounts it, which is exactly when `v-if="showLocalHandoff"`
// makes the card appear.
const LOCAL_HANDOFF_LINES: TerminalReplayLine[] = [
  { type: "cmd", text: AUTOVAULT_INSTALL_COMMAND },
  { type: "cmd", text: ". \"$HOME/.autovault/env\"" },
  { type: "cmd", text: "autovault skill list" },
];

const LocalHandoffTerminal = defineComponent({
  setup() {
    const bodyRef = ref<HTMLElement | null>(null);
    const replay = useTerminalReplay(LOCAL_HANDOFF_LINES, {
      autoStart: true,
      scrollTarget: () => bodyRef.value,
    });

    // Single root element, on purpose: Vue stamps a child component's root
    // (and only its root) with the parent's scoped-style attribute, which is
    // what lets the parent's `<style scoped>` .hcc-terminal-body rule (the
    // 180px height / mono font override) keep matching this div. Returning a
    // fragment/array here would drop that and silently revert to the global
    // 400px terminal-body height.
    return () =>
      h(
        "div",
        { class: "terminal-body hcc-terminal-body", ref: bodyRef, "aria-hidden": "true" },
        [
          ...replay.visibleLines.value.map((line, index) =>
            line.type === "cmd"
              ? h("div", { class: "line terminal-line", key: index }, [
                  h("span", { class: "pmt" }, "$"),
                  h("span", line.text),
                ])
              : h("div", { class: line.type, key: index }, line.text)
          ),
          !replay.complete.value ? h("span", { class: "cursor" }) : null,
        ]
      );
  },
});

// One sentence about the field, in priority order: the newest refusal beats an
// older availability answer, a broken shape beats a network round trip, and a
// verdict about a different string than the one on screen is stale.
const namespaceState = computed<{ tone: "ok" | "warn" | "fail" | "muted"; text: string }>(() => {
  if (namespaceRefusal.value) return { tone: "fail", text: namespaceRefusal.value };

  const slug = namespaceSlug.value;
  if (!slug) return { tone: "muted", text: "Choose the name your CLI will link to." };

  const problem = localSlugProblem(slug);
  if (problem) return { tone: "fail", text: problem };

  // /api/vaults/availability requires a session, so before sign-in there is
  // genuinely nothing to report. Saying "available" here would be a guess, and
  // the guess a user acts on is the one that hurts.
  if (!namespaceCheckReady.value) return { tone: "muted", text: "Availability is confirmed once your account exists." };

  // Only a check that is actually debouncing or in flight may claim to be one.
  if (namespaceChecking.value) return { tone: "muted", text: "Checking availability…" };
  // A failed lookup is not a verdict, but a progress line for a request that
  // already stopped is worse than saying nothing: it is a claim about the app's
  // own state that is false, and it never resolves because nothing retries.
  if (namespaceCheckFailed.value) {
    return { tone: "warn", text: "Could not check availability just now. Reserving confirms the name." };
  }
  const verdict = namespaceVerdict.value;
  // Structural rather than a reachability argument: whatever else leaves the
  // field with no usable answer and nothing running, it must not say "checking".
  if (!verdict || verdict.slug !== slug) return { tone: "muted", text: "Availability is confirmed when you reserve." };
  return verdict.available
    ? { tone: "ok", text: `${slug} is available.` }
    : { tone: "fail", text: verdict.message };
});

// The reserve click is what makes the name permanent, so it may not fall
// through to the server's derived slug. provision.js documents that fallback as
// the right default for "a library call with no user in front of it" -- at this
// step there IS one, looking at a field they just emptied, and handing them a
// `<local>-<six hex>` they never saw and cannot rename is the exact "the name
// arrived unbidden" defect this whole change set exists to remove.
const canReserve = computed(() => Boolean(namespaceSlug.value) && !localSlugProblem(namespaceSlug.value));

// A verdict that refuses the name currently in the field. `namespaceVerdict` is
// cleared on every edit, so a stale answer cannot gate anything; comparing the
// slug as well is belt and braces.
const namespaceRefused = computed(() => {
  if (namespaceRefusal.value) return true;
  const verdict = namespaceVerdict.value;
  return Boolean(verdict && verdict.slug === namespaceSlug.value && !verdict.available);
});

// Checkout must not take money for a name we have already refused ON SCREEN --
// malformed, reserved, or known-taken. It deliberately does NOT require a
// POSITIVE verdict: a transient 401 or 5xx on the availability read must not
// stand between somebody and paying, and the accepted check-then-claim race
// means even a clean "available" can go stale before the reserve click. This
// narrows the window to "we already said no"; it cannot close it, and the
// reserve step's 409 stays the authority. Reserve itself is deliberately NOT
// gated on the verdict for that reason -- there the server answers a lost race
// directly, and refusing client-side would only duplicate it worse.
const canCheckout = computed(() => canReserve.value && !namespaceRefused.value);

// Shape only, matching the server's rule. Anything this rejects never reaches
// the network: an invalid string cannot become available, so a round trip per
// keystroke would buy nothing.
function localSlugProblem(slug: string) {
  if (slug.length < VAULT_SLUG_MIN_LENGTH) return `Namespaces are at least ${VAULT_SLUG_MIN_LENGTH} characters.`;
  if (slug.length > VAULT_SLUG_MAX_LENGTH) return `Namespaces are at most ${VAULT_SLUG_MAX_LENGTH} characters.`;
  if (!VAULT_SLUG_SHAPE.test(slug)) return "Use lowercase letters and numbers, with single hyphens between them.";
  return "";
}

function onNamespaceInput(event: Event) {
  const input = event.target as HTMLInputElement;
  // Drop characters that could never be part of a slug rather than letting the
  // user type them and then explaining why they are wrong. Hyphens survive --
  // they are legal in the middle, and the message handles the edges.
  const cleaned = input.value.toLowerCase().replace(/[\s_.]+/g, "-").replace(/[^a-z0-9-]/g, "");
  namespaceEdited.value = true;
  namespaceInput.value = cleaned;
  // Vue only patches the DOM when the bound value changed. When normalising
  // produced the same string as last render (typing a second "!" for instance)
  // it did not, so the rejected character would sit in the field. Write it back.
  if (input.value !== cleaned) input.value = cleaned;
  writeStoredSlug(namespaceSlug.value);
  scheduleNamespaceCheck();
}

// The single owner of the stored namespace: writes `slug`, or drops the field
// when it is empty. Three things can invalidate it and all three come here.
//
// Editing the field, because persistDraft() only runs from startFlow and the
// reserve button is disabled while the field is empty -- so a paid user who
// deleted their namespace and reloaded would get it restored and could reserve
// the name they removed. Reserving, because the stored slug has done its whole
// job the moment the vault exists and sessionStorage outlives a sign-out in the
// same tab. And startFlow, when nothing is left worth storing.
//
// It touches only this one field, and only on a draft that already exists:
// creating one is startFlow's job, and `sourceText` belongs to the playground,
// which shares this key.
function writeStoredSlug(slug: string) {
  if (!canUseBrowser()) return;
  const stored = readDraft();
  if (!stored) return;
  if ((stored.desiredSlug || "") === slug) return;
  const next: PendingDraft = { ...stored };
  if (slug) next.desiredSlug = slug;
  else delete next.desiredSlug;
  window.sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(next));
}

function syncNamespaceFromDraft() {
  if (namespaceEdited.value) return;
  // A stored slug is a choice -- buildDraft now keeps one only when the user
  // typed it -- so it outranks the suggestion. Anything else means no choice has
  // been made yet, and the suggestion wins: after sign-in it stops being
  // "your-team" and becomes a name worth offering.
  const chosen = readDraft()?.desiredSlug || "";
  // Restoring their own choice makes it a choice again, so /api/me landing later
  // cannot overwrite it and the next saveDraft still keeps it.
  if (chosen) namespaceEdited.value = true;
  const next = chosen || namespaceSuggestion.value;
  if (!next || next === namespaceInput.value) return;
  namespaceInput.value = next;
  scheduleNamespaceCheck();
}

function scheduleNamespaceCheck() {
  namespaceRefusal.value = "";
  namespaceVerdict.value = null;
  namespaceCheckFailed.value = false;
  if (namespaceCheckTimer) clearTimeout(namespaceCheckTimer);
  // Invalidate anything already in flight: its answer is about a string the
  // user has since changed.
  namespaceCheckSeq += 1;
  namespaceChecking.value = false;
  if (!canUseBrowser()) return;
  if (!namespaceSlug.value || localSlugProblem(namespaceSlug.value) || !namespaceCheckReady.value) return;
  namespaceChecking.value = true;
  namespaceCheckTimer = setTimeout(() => void runNamespaceCheck(), NAMESPACE_CHECK_DELAY_MS);
}

async function runNamespaceCheck() {
  const slug = namespaceSlug.value;
  const seq = ++namespaceCheckSeq;
  try {
    // Not protectedAuthHeaders: that asks Clerk for a FRESH token every call,
    // which is the right cost for an action and the wrong one for something
    // that fires while somebody types. A failure here also must not raise a
    // notice -- it is a read whose answer is optional.
    const headers = await authHeaders({ accept: "application/json" }, {
      required: clerkAuthEnabled && isClerkSignedIn.value
    });
    const response = await fetch(`/api/vaults/availability?slug=${encodeURIComponent(slug)}`, {
      credentials: "include",
      headers
    });
    if (seq !== namespaceCheckSeq) return;
    // Same reasoning as fetchMe's non-OK branch: "could not find out" is not a
    // verdict, and rendering one would be inventing an answer.
    if (!response.ok) {
      namespaceCheckFailed.value = true;
      return;
    }
    const payload = await response.json() as NamespaceVerdict;
    if (seq !== namespaceCheckSeq) return;
    namespaceVerdict.value = payload;
  } catch {
    // Still no verdict -- but the field says so rather than showing a check that
    // is not running. Guarded on seq so a stale failure cannot land on the
    // string the user has since typed.
    if (seq === namespaceCheckSeq) namespaceCheckFailed.value = true;
  } finally {
    if (seq === namespaceCheckSeq) namespaceChecking.value = false;
  }
}

function focusNamespaceField() {
  const input = namespaceInputRef.value;
  if (!input) return;
  input.focus();
  input.select();
}

onMounted(async () => {
  staticPreview.value = canUseBrowser() && window.location.port === "5173";
  // Before the /api/me round trip, so a value carried through Stripe is on
  // screen immediately rather than after the network settles.
  syncNamespaceFromDraft();
  if (clerkAuthEnabled && !isClerkLoaded.value) return;
  await loadMe();
  await resumeCheckoutReturn();
});

// The suggestion only resolves once the user is known, and signing in is what
// makes the availability endpoint answerable at all.
watch([namespaceSuggestion, namespaceCheckReady], () => {
  syncNamespaceFromDraft();
  if (namespaceCheckReady.value && namespaceSlug.value && !namespaceVerdict.value) scheduleNamespaceCheck();
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
  if (draft) {
    window.sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft));
    return;
  }
  // Nothing here is worth storing -- but a draft already in storage can still
  // carry a namespace this page has since cleared, and syncNamespaceFromDraft
  // would restore it after the Stripe redirect and offer it for permanent
  // reservation, silently undoing the deletion.
  writeStoredSlug("");
}

function buildDraft(): PendingDraft | null {
  const sourceText = props.skillSource.trim();
  // Only a namespace the user actually typed. An unedited field is showing a
  // PROPOSAL -- "your-team" before sign-in, the derived suggestion after -- and
  // storing a proposal as `desiredSlug` is how it outlives what proposed it:
  // syncNamespaceFromDraft prefers the stored value, so a visitor who never
  // touched the field carried "your-team" through signup and checkout. The
  // first one to reserve claims it permanently; every later default signup is
  // then refused a name it never chose, after paying.
  const desiredSlug = namespaceEdited.value ? namespaceSlug.value : "";
  // A chosen namespace is now reason enough to keep a draft on its own. On
  // /cloud there is never a pasted skill, so before this the draft was always
  // null there and nothing survived the trip to Stripe.
  if (!sourceText && !desiredSlug) return null;
  return {
    sourceText,
    skillName: props.skillName || props.evaluation?.skill?.name || "pasted-skill",
    version: props.evaluation?.skill?.version,
    sourceLabel: props.sourceLabel || "browser playground",
    signature: props.evaluation?.signature ?? undefined,
    desiredSlug: desiredSlug || undefined,
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
  // The button is disabled for this, but the refusal lives here too: charging
  // for a name the screen has already refused is the one outcome this step must
  // never produce. No message is written onto the field -- it is already showing
  // the specific reason, and a generic one would overwrite it.
  if (!canCheckout.value) {
    notice.value = { kind: "warn", text: "Choose an available namespace before checking out." };
    await nextTick();
    focusNamespaceField();
    return;
  }
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
  // The button is disabled for this, but the refusal lives here too: this is the
  // call that omits `slug` and lets the server derive a permanent one, and it
  // must never be reachable with nothing in the field.
  if (!canReserve.value) {
    namespaceRefusal.value = "Choose a namespace before reserving it.";
    notice.value = { kind: "warn", text: namespaceRefusal.value };
    await nextTick();
    focusNamespaceField();
    return;
  }
  provisioning.value = true;
  trackPirsch("Hosted Vault: Provision Requested", { entry: props.entry, skills: queuedSkillNames.value.length });
  try {
    const headers = await protectedAuthHeaders({ "content-type": "application/json", accept: "application/json" });
    if (!headers) return;
    const response = await fetch("/api/vaults/provision", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        queued_skills: queuedSkillNames.value,
        // Omitted when empty, so the server falls back to its derived slug
        // rather than being handed a blank string to reject.
        slug: namespaceSlug.value || undefined
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 402) {
      notice.value = { kind: "warn", text: "Checkout completed, but the Stripe webhook has not marked the subscription active yet. Refresh in a moment." };
      return;
    }

    // The name was refused: 400 for shape or a reserved word, 409 for the race
    // this flow knowingly accepts -- available when they looked, claimed by
    // somebody else before they clicked. Nothing is broken and nothing was
    // charged twice, so it must not read as a crash: put the message on the
    // field, put the cursor back in it, and let them pick again.
    if (response.status === 400 || response.status === 409) {
      namespaceRefusal.value = payload.error || "That namespace is not available. Choose another.";
      namespaceVerdict.value = null;
      notice.value = { kind: "warn", text: namespaceRefusal.value };
      await nextTick();
      focusNamespaceField();
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
    // The state just handed up comes back as a PROP, so `vault` is still null
    // until Vue flushes. Settle it before the finally blocks re-enable the
    // button: otherwise it renders clickable for one frame at a step the shell
    // has already left, and a fast second click double-provisions.
    await nextTick();
    // The stored slug is spent: it existed only to survive the trip to Stripe,
    // and the vault now exists. sessionStorage outlives a sign-out in the same
    // tab, so leaving it means the NEXT account to sign in here is prefilled
    // with this one's claimed namespace, has it marked as its own choice by
    // syncNamespaceFromDraft, gets it refused by the availability check, and is
    // then held out of checkout by the gate that refuses an already-refused
    // name. The skill draft, if there is one, is left alone.
    writeStoredSlug("");
    // Runs after the shell has already advanced. It only persists queued
    // skills; nothing user-visible depends on its result.
    await savePendingImport();
  } finally {
    provisioning.value = false;
  }
}

async function savePendingImport() {
  const draft = buildDraft() || readDraft();
  // Keyed on the draft's source text, not on the draft existing. A draft now
  // exists whenever a namespace was typed, and posting one with no skill and no
  // queued starters is a request the API answers 400 for by design.
  if (!draft?.sourceText && queuedSkillNames.value.length === 0) return;
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

  // Reserving the namespace is a step the user takes, not something that
  // happens to them. This used to call provisionVault right here, which made
  // `vault` truthy before the reserve step had rendered a single interactive
  // frame -- the shell derives its stage from vault truthiness, so it flipped
  // straight to "connect" and the "Reserve namespace" button existed for about
  // one frame. Confirm the payment landed, say so, and stop.
  if (paid.value) {
    notice.value = {
      kind: "ok",
      text: "Payment confirmed. Reserve your hosted namespace to finish setting up."
    };
    // Clear on "the return has been handled", which here means the payment is
    // confirmed -- NOT on `vault`, which no longer becomes truthy on this path
    // and would leave ?hosted=success&session_id=... in the address bar forever.
    //
    // The unpaid branch deliberately keeps them: session_id is the only thing a
    // later load can hand to /api/billing/reconcile, and reconcileAttempted is
    // never reset within a page life, so reloading is the recovery path for a
    // webhook that has not landed yet. Dropping the params would remove it.
    clearCheckoutReturnParams();
    return;
  }

  notice.value = {
    kind: "warn",
    text: "Checkout returned. Waiting for Stripe to confirm your subscription before reserving the namespace."
  };
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

function slugify(value: string) {
  const slug = value.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "your-team";
}

// A suggestion the validator would reject is not a suggestion. Long email local
// parts are the real case: without this the field would open on an over-length
// value and greet a first-time visitor with an error about a name they did not
// choose.
//
// The short case falls back rather than returning "", mirroring what
// vaultSlugForUser does server-side. An empty suggestion is worse than a generic
// one three ways over: syncNamespaceFromDraft treats it as nothing to fill so
// the field never prefills at all, the default path stops being one click, and
// teamSlug collapses hostedEndpoint to a bare "https://vault.autovault.dev/" --
// which is the string the screen-reader transcript in the local handoff card
// reads out. "your-team" is also exactly what this surface showed before there
// was a field.
function clampSlug(slug: string) {
  const clamped = slug.slice(0, VAULT_SLUG_MAX_LENGTH).replace(/-+$/, "");
  return clamped.length >= VAULT_SLUG_MIN_LENGTH ? clamped : "your-team";
}

function canUseBrowser() {
  return typeof window !== "undefined";
}
</script>

<style scoped>
.hosted-namespace {
  display: grid;
  gap: 6px;
  margin-top: 16px;
}

.hosted-namespace-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
}

/* One bordered box holding an inert prefix and the input, so the field reads
   as the URL it becomes rather than as a bare text box. */
.hosted-namespace-field {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  font-family: var(--mono);
  font-size: 13px;
  overflow: hidden;
}

.hosted-namespace-field:focus-within {
  border-color: color-mix(in srgb, var(--ink-2) 45%, var(--line));
}

.hosted-namespace-field.ok {
  border-color: color-mix(in srgb, var(--ok) 50%, var(--line));
}

.hosted-namespace-field.fail {
  border-color: color-mix(in srgb, var(--bad) 55%, var(--line));
}

.hosted-namespace-prefix {
  padding: 8px 0 8px 10px;
  color: var(--ink-2);
  opacity: 0.7;
  white-space: nowrap;
}

.hosted-namespace-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 10px 8px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.hosted-namespace-input:focus {
  outline: none;
}

.hosted-namespace-status,
.hosted-namespace-note {
  margin: 0;
  font-size: 12px;
  color: var(--ink-2);
}

.hosted-namespace-status.ok {
  color: var(--ok);
}

.hosted-namespace-status.fail {
  color: var(--bad);
}

.hosted-namespace-status.warn {
  color: var(--warn);
}

.hosted-namespace-note {
  opacity: 0.75;
}

.hosted-command-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hosted-command-card > .panel-title {
  padding: 14px 14px 0 14px;
}

/* Sits between the title and the terminal, so the "this is install only"
   caveat is read before the commands are copied rather than after. Matches
   .hosted-namespace-note's size/colour so the two notes in this funnel read
   as the same kind of aside. */
.hcc-note {
  margin: 6px 0 0;
  padding: 0 14px;
  font-size: 12px;
  color: var(--ink-2);
}

.hcc-note code {
  font-size: 11px;
}

.hcc-terminal {
  border-bottom: 1px solid var(--line);
  border-radius: 8px 8px 0 0;
  overflow: hidden;
}

.hcc-terminal-body {
  min-height: 180px;
  max-height: 180px;
  background: var(--panel);
  font-family: var(--mono);
  font-size: 12px;
}

/* display/flex-wrap/gap match the global `.hosted-auth-actions,
   .hosted-copy-row` rule in styles.css exactly -- only padding and
   margin-top are genuinely specific to this card's layout (it has no
   ancestor padding to inherit spacing from, unlike .hosted-panel), so only
   those live here. Button appearance is intentionally NOT overridden here
   any more: the global `.hosted-copy-row button` rules already style these
   buttons the same as .hosted-primary/.hosted-auth-btn/.starter-skills
   button elsewhere on this panel, and a scoped duplicate previously drifted
   from those values (different border color, radius, text color, font-size,
   plus a hover background the global rule doesn't have). */
.hosted-copy-row {
  padding: 14px;
  margin-top: 0;
}
</style>
