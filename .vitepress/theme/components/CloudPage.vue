<template>
  <!-- `#launch-path` is the fragment on the Stripe success_url/cancel_url
       (functions/api/_lib/stripe.js), the Clerk post-auth redirect
       (theme/clerk.ts) and safeReturnTo's fallback. Nothing on the page
       carried the id, so every one of those returns landed on a dead
       fragment and never scrolled to the funnel. -->
  <section
    id="launch-path"
    class="cv-page"
    :class="`cv-stage-${stage}`"
    :aria-busy="!hydrated"
  >
    <!-- Loading veil. An OVERLAY rather than a branch, so the shell below is
         present in the prerendered HTML and there is no layout jump when
         /api/me resolves. -->
    <div v-if="!hydrated" class="cv-boot">
      <span class="cv-boot-mark"
        ><BrandMark :size="30" state="locked" show-depth
      /></span>
      <p>Opening your hosted vault…</p>
    </div>

    <!-- One shell, every stage. Signup used to render as a separate page with
         its own visual language and its own four-step rail, then hard-switch
         to this shell and a different two-step rail once a vault existed.
         Only the main area changes now; the chrome never moves. -->
    <div
      class="cv-shell"
      :class="{ locked: !signedIn, booting: !hydrated }"
      :inert="!hydrated">
      <aside class="cv-side" aria-label="Vault navigation">
        <div class="cv-brand">
          <span class="cv-brand-mark"
            ><BrandMark
              :size="22"
              :state="vault ? 'unlocked' : 'locked'"
              show-depth
          /></span>
          <span
            class="cv-brand-ns"
            :class="{ pending: !vault }"
            :title="vault ? undefined : 'Reserved after checkout'"
            ><span class="cv-slash">/</span>{{ vaultSlug }}</span
          >
        </div>

        <nav class="cv-nav">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="cv-nav-item"
            :class="item.cls"
            :disabled="item.disabled"
            @click="onNavClick(item)"
          >
            <span class="cv-nav-ic" aria-hidden="true" v-html="item.icon" />
            <span class="cv-nav-label">{{ item.label }}</span>
            <span v-if="item.badge === 'soon'" class="cv-nav-soon">soon</span>
            <span v-else-if="item.badge === 'new'" class="cv-nav-new">new</span>
            <span v-else-if="item.locked" class="cv-nav-lock" aria-hidden="true"
              >🔒</span
            >
          </button>
        </nav>

        <CloudAccountMenu
          :name="accountName"
          :email="accountEmailShort"
          :status-text="subscriptionState.text"
          :avatar-style="avatarStyle"
          :signed-in="signedIn"
          :busy="busy"
          @billing="openBillingPortal"
        />
      </aside>

      <main class="cv-content">
        <header class="cv-topbar">
          <div>
            <div class="cv-eyebrow"><span class="cv-spark" /> Hosted vault</div>
            <div class="cv-crumb">
              <span class="cv-crumb-host">vault.autovault.dev</span> /
              {{ vaultSlug }}
            </div>
            <h1>{{ pageTitle }}</h1>
          </div>
          <div class="cv-badges">
            <span v-if="vault" class="cv-pill ok"
              ><span class="cv-dot" /> Namespace reserved</span
            >
            <!-- Was a flat "Cloud CLI sync is coming soon". Device enrollment
                 is real now, so this reports what is actually true of THIS
                 vault rather than of the product. -->
            <span v-if="activeDevices.length" class="cv-pill ok"
              ><span class="cv-dot" />
              {{ activeDevices.length }}
              {{ activeDevices.length === 1 ? "machine" : "machines" }} linked</span
            >
            <span v-else-if="pendingDevices.length" class="cv-pill warn"
              ><span class="cv-dot" />
              {{ pendingDevices.length }} waiting to be admitted</span
            >
            <!-- v-else-if, not v-else: signed out, mid-checkout, or after a
                 failed load there is no vault whose device state we know, and
                 "no machines linked" states a fact about one that may not
                 exist. -->
            <span v-else-if="vault" class="cv-pill mut"
              ><span class="cv-dot" /> No machines linked yet</span
            >
          </div>
        </header>

        <!-- Focal while the vault is shut. This is the element that changes
             as you advance, which is why it earns the slot: it replaces a
             finished rail that kept a row to say nothing, plus the status
             pills that repeated it. Once the vault is open it shrinks into
             the strip below and the dashboard becomes the content. -->
        <!-- Held through the unlock. Admitting a machine flips the stage in
             the same tick, so gating purely on `!vaultOpen` unmounted this and
             played the celebration on the 34px strip mark instead — a gesture
             performed by an icon that had just teleported. The mark stays big
             for the ~700ms, then collapses. -->
        <div v-if="!vaultOpen || vaultUnlocking" class="cv-vaulthead">
        <div
          class="cv-vaultfocal"
          aria-hidden="true"
        >
          <BrandMark
            :size="72"
            :state="vaultOpen ? 'unlocked' : 'locked'"
            :working="vaultWorking"
            :unlocking="vaultUnlocking"
            show-depth
          />
        </div>

        <!-- The single progress model. One derivation, rendered two ways:
             labelled while there is still something to do, and collapsed into
             the vault strip once there is not. -->
        <ol
          v-if="!vaultOpen"
          class="cv-rail"
          :class="{ complete: onboardingComplete }"
          aria-label="Hosted vault setup progress"
        >
          <li
            v-for="(step, i) in onboardingSteps"
            :key="step.key"
            class="cv-rail-step"
            :class="step.state"
            :aria-current="step.state === 'active' ? 'step' : undefined"
          >
            <span class="cv-rail-dot" aria-hidden="true">{{
              step.state === "done" ? "✓" : step.index
            }}</span>
            <span class="cv-rail-copy">
              <strong>{{ step.label }}</strong>
              <small>{{ step.detail }}</small>
              <span class="visually-hidden">{{
                RAIL_STATE_LABEL[step.state]
              }}</span>
            </span>
            <span
              v-if="i < onboardingSteps.length - 1"
              class="cv-rail-line"
              aria-hidden="true"
            />
          </li>
        </ol>
        </div>

        <p
          v-if="notice"
          class="cv-notice"
          :class="notice.kind"
          role="status"
          aria-live="polite"
        >
          {{ notice.text }}
        </p>

        <!-- ---------- STAGE: ERROR ---------- -->
        <template v-if="stage === 'error'">
          <div class="cv-focal">
            <h2>We couldn't load your vault</h2>
            <p class="cv-focal-body">{{ loadError }}</p>
            <div class="cv-focal-actions">
              <button
                class="cv-btn"
                type="button"
                :disabled="busy"
                @click="retryLoad"
              >
                Try again
              </button>
            </div>
          </div>
        </template>

        <!-- ---------- PRE-VAULT: account / subscription / reserve ----------
             v-show, not v-if. provisionVault emits stateChange the moment a
             vault comes back, which flips this condition -- under v-if that
             destroyed the component mid-function, throwing away its success
             notice and the result of the savePendingImport still in flight.
             Kept mounted, it simply hides. -->
        <template v-if="stage !== 'error'">
          <div v-show="!vault" class="cv-focal">
            <div class="cv-focal-glow" aria-hidden="true" />
            <div class="cv-step-kicker">
              Step {{ activeStepNumber }} of {{ onboardingSteps.length }} · the
              only thing to do right now
            </div>
            <h2>{{ setupHeadline }}</h2>
            <p class="cv-focal-body">{{ setupLede }}</p>
            <p v-if="hostedPriceLabel && !paid" class="cv-price">
              <strong>{{ hostedPriceLabel }}</strong>
              <span>Cancel any time from the billing portal.</span>
            </p>
            <HostedVaultFunnel
              entry="deploy"
              :state="cloudState"
              @state-change="syncCloudState"
              @notice="setNotice"
            />
          </div>
        </template>

        <!-- ---------- STAGE A: CONNECT ---------- -->
        <template v-if="stage === 'connect'">
          <div class="cv-focal">
            <div class="cv-focal-glow" aria-hidden="true" />
            <div class="cv-focal-ns">
              <span class="cv-pill ok"><span class="cv-dot" /> Reserved</span>
              <span class="cv-endpoint-mono">{{ hostedEndpoint }}</span>
            </div>
            <h2>Connect your local CLI</h2>
            <p class="cv-focal-body">
              Run this on the machine you want to sync. It enrols that machine
              and then waits here for you to admit it.
            </p>
            <div class="cv-connect-terminal">
              <ConnectTerminal :slug="vaultSlug" />
            </div>

            <div class="cv-focal-actions">
              <a class="cv-btn ghost" :href="installDocsHref"
                >Installation guide</a
              >
            </div>
          </div>
        </template>

        <!-- ---------- STAGE B: EXPLORE  &  STAGE C: READY ---------- -->
        <template v-if="stage === 'explore' || stage === 'ready'">
          <!-- progress summary card (collapses stage A) -->
          <div class="cv-status-card" :class="{ allset: stage === 'ready' }">
            <!-- The same mark, compact. It carries the one fact this strip
                 exists to state — the vault is open — so the pill beside it
                 does not have to shout it. -->
            <!-- Hidden while the focal mark above is mid-celebration, so
                 there is never a moment with two vaults on screen. -->
            <span v-show="!vaultUnlocking" class="cv-status-mark" aria-hidden="true">
              <BrandMark
                :size="34"
                state="unlocked"
                :working="vaultWorking"
                show-depth
              />
            </span>
            <span class="cv-pill ok"
              ><span class="cv-dot" />
              {{ stage === "ready" ? "All set" : "CLI linked" }}</span
            >
            <span class="cv-status-text">
              <template v-if="stage === 'ready'">
                CLI linked · early access requested. We'll email you the moment
                hosted sync ships.
              </template>
              <template v-else>
                Your machine is pointed at <code>{{ vaultSlug }}</code
                >. Hosted sync turns on automatically when it ships.
              </template>
            </span>
          </div>

          <!-- reserved + sync engine -->
          <div class="cv-reveal cv-two" :style="revealDelay(0)">
            <article
              ref="billingCard"
              class="cv-card"
              :class="{ focusflash: focusedCard === 'billing' }"
            >
              <div class="cv-card-label">Subscription</div>
              <ul class="cv-kv">
                <li><span>Plan</span><strong>Hosted</strong></li>
                <li v-if="renewalLabel">
                  <span>Billing</span><strong>{{ renewalLabel }}</strong>
                </li>
                <li>
                  <span>Status</span
                  ><span
                    class="cv-pill sm"
                    :class="subscriptionState.tone"
                    ><span class="cv-dot" /> {{ subscriptionState.text }}</span
                  >
                </li>
              </ul>
              <p v-if="subscriptionNeedsAttention" class="cv-muted cv-sub-warn">
                Hosted access follows this status. If that looks wrong, reload
                after Stripe finishes processing, or contact support.
              </p>
              <ul class="cv-reserved">
                <li>
                  <span class="cv-chk">✓</span> Public + private namespace
                </li>
                <li>
                  <span class="cv-chk">✓</span> Starter skill slots, ready to
                  fill
                </li>
              </ul>
            </article>
            <article class="cv-card soft">
              <div class="cv-card-label">Sync engine</div>
              <span class="cv-pill warn"
                ><span class="cv-dot" /> Building — you'll be first to
                know</span
              >
              <p class="cv-muted">
                Until hosted sync ships, your local CLI is fully usable offline.
                Nothing is gated behind the cloud — this namespace and any
                skills carry over automatically.
              </p>
            </article>
          </div>

          <!-- app preview + early access -->
          <div ref="previewCard" class="cv-reveal" :style="revealDelay(1)">
            <article
              class="cv-preview"
              :class="{ focusflash: focusedCard === 'preview' }"
            >
              <div class="cv-appframe" aria-hidden="true">
                <div class="cv-appbar">
                  <span class="cv-tdot bad" /><span class="cv-tdot warn" /><span
                    class="cv-tdot ok"
                  />
                  <span class="cv-appurl"
                    >vault.autovault.dev/{{ vaultSlug }}</span
                  >
                </div>
                <div class="cv-appbody">
                  <div class="cv-appnav">
                    <span class="on">Skills</span><span>Sync log</span
                    ><span>Members</span><span>Settings</span>
                  </div>
                  <div class="cv-appmain">
                    <div class="cv-appsearch" />
                    <div
                      v-for="row in previewRows"
                      :key="row.w"
                      class="cv-approw"
                    >
                      <span class="cv-appicon" />
                      <span class="cv-appskel" :style="{ width: row.w }" />
                      <span class="cv-appsync">● synced</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="cv-preview-copy">
                <div class="cv-card-label violet">
                  {{
                    stage === "ready"
                      ? "You're on the list · preview"
                      : "Coming soon · preview"
                  }}
                </div>
                <h2>Manage your vault from the web</h2>
                <p>
                  Browse and search every synced skill, watch the live sync log
                  between your machines, and manage who has access — without
                  leaving the browser.
                </p>
                <div class="cv-feats">
                  <span>Skill browser</span><span>Live sync log</span
                  ><span>Team access</span>
                </div>
                <div v-if="stage === 'ready'" class="cv-confirm">
                  <span class="cv-confirm-ic">✓</span>
                  <span
                    >You're on the early-access list.<small
                      >Requested {{ earlyAccessDate }} · we'll email
                      {{ accountEmailShort }} first.</small
                    ></span
                  >
                </div>
                <template v-else>
                  <button
                    type="button"
                    class="cv-btn"
                    :disabled="busy"
                    @click="markProgress('early_access')"
                  >
                    {{ busy ? "Saving…" : "Get early access →" }}
                  </button>
                  <p class="cv-muted sm">
                    We'll email <strong>{{ accountEmailShort }}</strong> the
                    moment it's live.
                  </p>
                </template>
              </div>
            </article>
          </div>
        </template>
        <!-- Enrolled machines. This list IS the link step: there is no
             button to say a CLI is connected, because saying so was never
             evidence of anything. A row appears here when a real machine
             signs a real enrollment request. -->
        <div v-if="vault" ref="devicesCard" class="cv-devices standalone" :class="{ focusflash: focusedCard === 'devices' }" role="region" aria-labelledby="cv-devices-title">
          <h3 id="cv-devices-title" class="cv-devices-title">
            Machines
            <span v-if="pendingDevices.length" class="cv-devices-count">
              {{ pendingDevices.length }} waiting
            </span>
          </h3>

          <!-- The CLI enrols and only then opens this page, so arriving before
               the row exists is the normal case, not an error. Say what is
               happening and let the poll catch up -- never a warning notice. -->
          <p
            v-if="admitState === 'waiting'"
            class="cv-devices-waiting"
            :class="{ stalled: admitWaitExpired }"
          >
            <span class="cv-dot" />
            <!-- Once the budget is spent nothing is arriving, and a spinner
                 that never resolves is worse than saying so. -->
            <template v-if="admitWaitExpired">
              No machine matching <code>{{ admitFingerprint }}</code> has checked
              in. If you closed that terminal, run
              <code>autovault link</code> there again.
            </template>
            <template v-else>
              Waiting for <code>{{ admitFingerprint }}</code> to check in…
            </template>
          </p>

          <p v-else-if="!devices.length" class="cv-devices-empty">
            Nothing enrolled yet. Run the command above and this machine
            will appear here within a few seconds.
          </p>

          <ul v-if="devices.length" class="cv-device-list">
            <li
              v-for="device in devices"
              :key="device.id"
              class="cv-device"
              :class="[device.status, { 'admit-target': isAdmitTarget(device) }]"
            >
              <span class="cv-device-id">
                <strong>{{ device.hostname || "Unnamed machine" }}</strong>
                <!-- Matches what the CLI printed on that machine, so the
                     owner can tell two pending devices apart. -->
                <code>ed25519 {{ device.fingerprint }}</code>
              </span>
              <span class="cv-device-seen">
                <span class="cv-pill" :class="device.status === 'active' ? 'ok' : ''">
                  <span class="cv-dot" />{{ device.status }}
                </span>
                <small>first seen {{ formatWhen(device.first_seen_at) }}</small>
              </span>
              <span class="cv-device-actions">
                <button
                  v-if="device.status === 'pending'"
                  type="button"
                  class="cv-btn small"
                  :data-admit-target="isAdmitTarget(device) ? 'true' : undefined"
                  :disabled="deviceBusy === device.id"
                  @click="decideDevice(device.id, 'admit')"
                >
                  {{ deviceBusy === device.id ? "Working…" : "Admit" }}
                </button>
                <button
                  v-if="device.status !== 'revoked'"
                  type="button"
                  class="cv-btn ghost small"
                  :disabled="deviceBusy === device.id"
                  @click="decideDevice(device.id, 'revoke')"
                >
                  {{ device.status === "pending" ? "Deny" : "Revoke" }}
                </button>
              </span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import HostedVaultFunnel from "./HostedVaultFunnel.vue";
import BrandMark from "./BrandMark.vue";
import CloudAccountMenu from "./CloudAccountMenu.vue";
import { copyText as copyToClipboard } from "../utils/clipboard";
import { prefersReducedMotion } from "../utils/motion";
import { formatPriceLabel } from "../utils/money";
import {
  admitHandshakeState,
  findAdmitTarget,
  readAdmitFingerprint,
} from "../utils/admit";
import { clerkAuthRecoveryMessage, isClerkApiAuthError, useClerkApiAuth } from "../utils/clerkApi";
import {
  useTerminalReplay,
  type TerminalReplayLine,
} from "../composables/useTerminalReplay";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";

const ConnectTerminal = defineComponent({
  props: {
    slug: { type: String, required: true },
  },
  setup(props) {
    const bodyRef = ref<HTMLElement | null>(null);
    const copied = ref(false);
    const commands = computed(() => [
      AUTOVAULT_INSTALL_COMMAND,
      '. "$HOME/.autovault/env"',
      `autovault link ${props.slug}`,
    ]);
    const lines = computed<TerminalReplayLine[]>(() => [
      { type: "cmd", text: commands.value[0] },
      { type: "out", text: "↳ downloading autovault-installer" },
      { type: "ok", text: "✓ signature ok" },
      { type: "cmd", text: commands.value[1] },
      { type: "cmd", text: commands.value[2] },
      { type: "out", text: "↳ enrolling this machine" },
      // Not "✓ linked successfully". Linking ends PENDING and the CLI sits in
      // a spinner until the owner admits it on this page. Showing a tick here
      // taught people to expect something that does not happen, and then to
      // wonder what they had done wrong.
      { type: "out", text: "⧗ waiting for you to admit it below" },
    ]);
    const replay = useTerminalReplay(lines.value, {
      autoStart: true,
      scrollTarget: () => bodyRef.value,
    });

    async function handleCopy() {
      await copyToClipboard(commands.value.join("\n"));
      copied.value = true;
      setTimeout(() => (copied.value = false), 1600);
    }

    return () =>
      h("div", { class: "cv-terminal-wrapper" }, [
        // The terminal replay below is aria-hidden because it types character
        // by character; announcing that is noise. But it carried the only copy
        // of the commands on the page, which left the single required action
        // unreachable by screen readers. This static transcript is the
        // accessible equivalent.
        h("pre", { class: "visually-hidden" }, [
          h("code", commands.value.join("\n")),
        ]),
        h(
          "div",
          {
            class: "terminal-body cv-terminal-body",
            ref: bodyRef,
            "aria-hidden": "true",
          },
          [
          ...replay.visibleLines.value.map((line, index) =>
            line.type === "cmd"
              ? h("div", { class: "line terminal-line", key: index }, [
                  h("span", { class: "pmt cv-pmt" }, "$ "),
                  h("span", line.text),
                ])
              : h("div", { class: line.type, key: index }, line.text),
          ),
          !replay.complete.value
            ? h("span", { class: "cur cursor cv-cur" })
            : null,
        ]),
        h(
          "button",
          {
            class: "cv-cmd-copy",
            type: "button",
            onClick: handleCopy,
            "aria-label": copied.value
              ? "Install commands copied to clipboard"
              : "Copy install commands",
            "aria-live": "polite",
          },
          copied.value ? "Copied" : "Copy",
        ),
      ]);
  },
});

type CloudUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
};
type CloudSubscription = {
  active: boolean;
  status?: string | null;
  current_period_end?: number | null;
} | null;
type CloudVault = {
  id?: string;
  slug: string;
  status: string;
  public_url: string;
  provisioned_at?: string | null;
  cli_linked_at?: string | null;
  early_access_at?: string | null;
} | null;
type CloudState = {
  user: CloudUser | null;
  subscription: CloudSubscription;
  vault: CloudVault;
};
type CloudStatePayload = {
  user: CloudUser | null;
  subscription?: CloudSubscription;
  vault?: CloudVault;
};
type Stage = "error" | "account" | "subscription" | "setup" | "connect" | "explore" | "ready";
type NavItem = {
  key: string;
  label: string;
  icon: string;
  badge?: "soon" | "new";
  locked: boolean;
  disabled: boolean;
  cls: Record<string, boolean>;
  action: "none" | "preview" | "scroll-billing" | "scroll-devices";
};

const cloudState = ref<CloudState>({
  user: null,
  subscription: null,
  vault: null,
});
const hydrated = ref(false);
// Set when /api/me could not be resolved because auth failed — as opposed to
// resolving successfully and reporting no vault. Without this the two cases
// are indistinguishable downstream, and a signed-in, paying, provisioned user
// whose token refresh blipped was shown "Set up your hosted vault".
const loadError = ref<string | null>(null);
const busy = ref(false);
type CloudNotice = { kind: "ok" | "warn" | "fail"; text: string };
const notice = ref<CloudNotice | null>(null);

// The funnel used to render its own notice element. Now that it is chrome-
// free, its failures surface through this page's single live region --
// otherwise a cancelled Checkout or the expected webhook-delay 402 would
// leave the button simply re-enabling with no explanation.
function setNotice(next: CloudNotice | null) {
  notice.value = next;
}
const focusedCard = ref<"preview" | "billing" | "devices" | null>(null);
const previewCard = ref<HTMLElement | null>(null);
const billingCard = ref<HTMLElement | null>(null);
const devicesCard = ref<HTMLElement | null>(null);
const previewRows = [{ w: "55%" }, { w: "42%" }, { w: "60%" }];

const { authHeaders, clerkAuthEnabled, isClerkLoaded, isClerkSignedIn, clerkUserLabel } =
  useClerkApiAuth();
let cloudStateRequestSeq = 0;

type SyncDevice = {
  id: string;
  fingerprint: string;
  status: "pending" | "active" | "revoked";
  hostname: string | null;
  first_seen_at: string;
  last_seen_at: string | null;
};

const devices = ref<SyncDevice[]>([]);
const deviceBusy = ref<string | null>(null);
let devicesRequestSeq = 0;

const user = computed(() => cloudState.value.user);
const vault = computed(() => cloudState.value.vault);
// A device the owner actually admitted, not a checkbox somebody ticked.
//
// `vaults.cli_linked_at` used to drive this: a button that said "I've linked
// my CLI ✓" and wrote a timestamp. It proved nothing -- anyone could tick it
// without a machine anywhere near the vault, and the dashboard would then
// claim a CLI was connected. The column still exists (0002 is applied and
// migrations are not edited after shipping) but nothing reads it now.
const activeDevices = computed(() => devices.value.filter((device) => device.status === "active"));
const pendingDevices = computed(() => devices.value.filter((device) => device.status === "pending"));
const cliLinked = computed(() => activeDevices.value.length > 0);

// ---- CLI admit handshake -------------------------------------------------
//
// `autovault link` prints a fingerprint and opens /cloud?admit=<fingerprint>.
// All this does is *select* the row that is waiting: scroll to it, flash it,
// and put focus on its Admit button. The owner still clicks, exactly as they
// would confirm a code on GitHub's device page.
//
// Nothing below ever calls decideDevice(). If it did, the URL the CLI prints
// would become a credential that admits a machine to the vault on load.
const admitFingerprint = ref<string | null>(null);

const admitTarget = computed(() => findAdmitTarget(devices.value, admitFingerprint.value));

const admitState = computed(() => admitHandshakeState(devices.value, admitFingerprint.value));

// A `waiting` handshake is normally seconds long: the CLI enrols, then opens
// this page, so the row is usually one poll behind. But a stale, malformed, or
// wrong-account `?admit=` link never matches anything, and `waiting` would then
// be permanent -- pinning the poll at four seconds for the life of the tab.
// /api/vaults/current/devices goes through requireUser, which in Clerk mode
// does a profile lookup per call, so that is ~900 requests an hour in the one
// case where not one of them can succeed.
//
// Two minutes is far longer than the real path needs (a sign-in round trip
// reloads the page, restarting this) and short enough that a dead link stops
// costing anything.
const ADMIT_WAIT_BUDGET_MS = 120_000;
const admitWaitExpired = ref(false);
let admitWaitTimer: ReturnType<typeof setTimeout> | undefined;

function clearAdmitWaitTimer() {
  if (admitWaitTimer) clearTimeout(admitWaitTimer);
  admitWaitTimer = undefined;
}

watch(
  admitState,
  (state) => {
    if (state !== "waiting") {
      // Covers the row arriving late: expiry is reset, not latched, so a
      // machine that shows up after the budget still gets the full treatment.
      clearAdmitWaitTimer();
      admitWaitExpired.value = false;
      return;
    }
    if (admitWaitTimer) return;
    admitWaitTimer = setTimeout(() => {
      admitWaitExpired.value = true;
      admitWaitTimer = undefined;
    }, ADMIT_WAIT_BUDGET_MS);
  },
  { immediate: true }
);

onBeforeUnmount(clearAdmitWaitTimer);

function isAdmitTarget(device: SyncDevice) {
  return admitTarget.value?.id === device.id;
}

// Focus the row once per machine, not once per poll tick. The device list
// reloads every four seconds while this is open, and re-stealing focus (and
// re-running the flash) on every response would make the Admit button
// impossible to tab away from.
let admitFocusedId: string | null = null;

watch(
  () => admitTarget.value?.id ?? null,
  async (deviceId) => {
    if (!deviceId || admitFocusedId === deviceId) return;
    admitFocusedId = deviceId;
    await focusCard("devices", devicesCard.value);
    await nextTick();
    // Queried rather than held as a template ref: the button lives inside a
    // v-for, and the row it belongs to can arrive several polls after mount.
    const button = devicesCard.value?.querySelector<HTMLButtonElement>(
      "[data-admit-target='true']"
    );
    button?.focus();
  },
  { immediate: true }
);
const earlyAccess = computed(() => Boolean(vault.value?.early_access_at));

const subscription = computed(() => cloudState.value.subscription);

// ORs in the live Clerk flag, not just the /api/me payload. Clerk resolves
// after mount, so between those two moments `user` is still null -- without
// this the shell would blink back to "create an account" for someone who is
// demonstrably signed in.
const signedIn = computed(
  () => Boolean(user.value) || isClerkSignedIn.value,
);
const paid = computed(() => Boolean(subscription.value?.active));

const stage = computed<Stage>(() => {
  if (loadError.value && !vault.value) return "error";
  // Vault first. A reserved vault is proof the first three steps completed,
  // so checking `paid` ahead of it would bounce a past_due or canceled holder
  // back to "Finish checkout" -- getSubscription derives `active` from
  // isPaidStatus(status), so a lapse flips `paid` false while the vault row
  // survives untouched. A lapse belongs on the Subscription card, not in the
  // signup funnel.
  if (vault.value) {
    if (!cliLinked.value) return "connect";
    if (!earlyAccess.value) return "explore";
    return "ready";
  }
  if (!signedIn.value) return "account";
  if (!paid.value) return "subscription";
  return "setup";
});

// The card used to render a hardcoded "Active" pill and a hardcoded monthly
// price as static markup, while the real
// subscription was fetched, typed, normalized — and then never read. A
// past_due or canceled subscriber was told everything was fine. Price is not
// rendered at all any more: the API does not expose the amount, and inventing
// one is how the "$12" got there in the first place.
const SUBSCRIPTION_LABELS: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  active: { text: "Active", tone: "ok" },
  trialing: { text: "Trialing", tone: "ok" },
  past_due: { text: "Past due", tone: "warn" },
  unpaid: { text: "Unpaid", tone: "bad" },
  incomplete: { text: "Incomplete", tone: "warn" },
  incomplete_expired: { text: "Expired", tone: "bad" },
  canceled: { text: "Canceled", tone: "bad" },
  paused: { text: "Paused", tone: "warn" },
};

const subscriptionState = computed(() => {
  const status = subscription.value?.status ?? null;
  if (!status) {
    return subscription.value?.active
      ? { text: "Active", tone: "ok" as const }
      : { text: "No subscription", tone: "warn" as const };
  }
  return SUBSCRIPTION_LABELS[status] ?? { text: status.replace(/_/g, " "), tone: "warn" as const };
});

const subscriptionNeedsAttention = computed(
  () => subscriptionState.value.tone !== "ok",
);

const renewalLabel = computed(() => {
  const seconds = subscription.value?.current_period_end;
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  // A subscription cancelled effective end-of-period keeps status "active"
  // (and therefore tone "ok") right up until that date -- the API persists
  // only status and current_period_end, not Stripe's cancel_at_period_end,
  // so this computed cannot tell "will renew" from "will end" for an
  // otherwise-active row. A neutral date label is accurate either way;
  // "Renews" is not.
  return subscriptionState.value.tone === "bad"
    ? `Ends ${formatted}`
    : `Current period ends ${formatted}`;
});

const vaultSlug = computed(() => vault.value?.slug ?? "your-vault");
const hostedEndpoint = computed(
  () =>
    vault.value?.public_url ?? `https://vault.autovault.dev/${vaultSlug.value}`,
);
const accountName = computed(
  () =>
    user.value?.name ||
    user.value?.email?.split("@")[0] ||
    clerkUserLabel.value ||
    "Your account",
);
const accountEmailShort = computed(() => {
  const email = user.value?.email;
  if (!email) return "your inbox";
  const [name, domain] = email.split("@");
  return domain ? `${name}@${domain}` : email;
});
// Typed rather than an inline `{}`: in a ternary/union position TS widens the
// empty branch to `{ backgroundImage?: undefined }`, which then fails the
// Record<string, string> index signature the menu prop expects.
const NO_AVATAR_STYLE: Record<string, string> = {};

const avatarStyle = computed<Record<string, string>>(() => {
  const avatarUrl = user.value?.avatar_url;
  if (!avatarUrl) return NO_AVATAR_STYLE;
  return {
    backgroundImage: `url(${avatarUrl})`,
    backgroundColor: "transparent",
  };
});

/* ---------------------------------------------------------------------------
 * Onboarding rail
 *
 * One derivation, replacing four that used to disagree: the funnel's
 * "Step N of 4" kicker, its four status cards, its five-row provisioning
 * checklist, and this page's own two-step rail. Those four are why the page
 * announced four steps and then switched to a different two-step model
 * partway through.
 *
 * "Sync" is deliberately NOT a step. Hosted sync does not exist server-side,
 * and a step you cannot complete is not a step -- it stays a locked
 * destination in the sidebar instead.
 * ------------------------------------------------------------------------ */
type StepKey = "account" | "subscription" | "namespace" | "connect";
type StepState = "done" | "active" | "pending" | "unknown";
type OnboardingStep = {
  key: StepKey;
  index: number;
  label: string;
  detail: string;
  state: StepState;
};

const ONBOARDING_STEP_KEYS: StepKey[] = [
  "account",
  "subscription",
  "namespace",
  "connect",
];
const ONBOARDING_STEP_LABELS: Record<StepKey, string> = {
  account: "Account",
  subscription: "Subscription",
  namespace: "Namespace",
  connect: "Connect CLI",
};
const RAIL_STATE_LABEL: Record<StepState, string> = {
  done: "completed",
  active: "current step",
  pending: "not started",
  unknown: "status unavailable",
};

const stepDone = computed<Record<StepKey, boolean>>(() => ({
  account: signedIn.value,
  // Stays ticked once a vault exists. A later lapse must not un-tick a step
  // the user genuinely completed -- it surfaces on the Subscription card.
  subscription: paid.value || Boolean(vault.value),
  namespace: Boolean(vault.value),
  connect: cliLinked.value,
}));

const activeStepKey = computed<StepKey | null>(
  () => ONBOARDING_STEP_KEYS.find((key) => !stepDone.value[key]) ?? null,
);

const stepDetail = computed<Record<StepKey, string>>(() => ({
  account: signedIn.value ? accountEmailShort.value : "Create an account or sign in",
  subscription: paid.value
    ? subscriptionState.value.text
    : vault.value
      ? `${subscriptionState.value.text} — needs attention`
      : "Stripe-hosted payment form",
  namespace: vault.value ? hostedEndpoint.value : "Reserved after checkout",
  connect: cliLinked.value
    ? "Linked from your machine"
    : "Point your CLI at the namespace",
}));

const onboardingSteps = computed<OnboardingStep[]>(() =>
  ONBOARDING_STEP_KEYS.map((key, index) => ({
    key,
    index: index + 1,
    label: ONBOARDING_STEP_LABELS[key],
    detail: stepDetail.value[key],
    // A failed /api/me leaves every downstream fact unknowable. Ticking step
    // one off isClerkSignedIn while greying the rest as "pending" would claim
    // knowledge we do not have.
    state:
      stage.value === "error"
        ? "unknown"
        : stepDone.value[key]
          ? "done"
          : key === activeStepKey.value
            ? "active"
            : "pending",
  })),
);

type HostedPrice = { amount: number | null; currency: string | null; interval: string | null };
const hostedPrice = ref<HostedPrice | null>(null);

// What the plan costs, read from Stripe. The funnel previously sent people to
// Checkout without naming a price anywhere -- the first number you saw was on
// Stripe's own page, after committing. A literal here would be worse: it
// drifts silently the moment the price changes in Stripe.
const hostedPriceLabel = computed(() => {
  const price = hostedPrice.value;
  if (!price) return null;
  return formatPriceLabel(price.amount, price.currency, price.interval);
});

async function loadPricing() {
  // Never blocks or breaks the funnel: if Stripe is unreachable the price
  // line simply does not render.
  try {
    const response = await fetch("/api/pricing", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    hostedPrice.value = await response.json();
  } catch {
    /* leave hostedPrice null */
  }
}

const onboardingComplete = computed(() => activeStepKey.value === null);
const activeStepNumber = computed(() =>
  activeStepKey.value
    ? ONBOARDING_STEP_KEYS.indexOf(activeStepKey.value) + 1
    : ONBOARDING_STEP_KEYS.length,
);

// Header copy follows the stage rather than being hardcoded to "Overview",
// which was only ever correct once a vault existed.
const pageTitle = computed(() => {
  if (stage.value === "error") return "We couldn't load your vault";
  return vault.value ? "Overview" : "Reserve a hosted AutoVault namespace";
});

// Headline and lede follow the active step, so the focal card always names
// the one thing to do rather than describing the whole journey.
const setupHeadline = computed(() => {
  if (stage.value === "account") return "Create your AutoVault account";
  if (stage.value === "subscription") return "Finish checkout";
  return "Reserve your namespace";
});

const setupLede = computed(() => {
  if (stage.value === "account") {
    return "Create your account, reserve a stable namespace, and keep your local CLI as the source of truth. Hosted sync ships next.";
  }
  if (stage.value === "subscription") {
    return "Stripe records the subscription through a webhook before AutoVault reserves your namespace.";
  }
  return "Your subscription is active. Reserve the namespace to finish setup — signing and serving stay on the local CLI today.";
});

const installDocsHref = "/quick-start#install";

const earlyAccessDate = computed(() =>
  formatDate(vault.value?.early_access_at),
);

const navItems = computed<NavItem[]>(() => {
  const s = stage.value;
  const item = (
    key: string,
    label: string,
    icon: string,
    opts: {
      active?: boolean;
      soon?: boolean;
      revealAt?: Stage;
      action?: NavItem["action"];
    } = {},
  ): NavItem => {
    const order: Stage[] = ["account", "subscription", "setup", "connect", "explore", "ready"];
    const revealed = opts.revealAt
      ? order.indexOf(s) >= order.indexOf(opts.revealAt)
      : true;
    const justRevealed = opts.revealAt === s;
    const locked = Boolean(opts.soon) || (opts.revealAt ? !revealed : false);
    return {
      key,
      label,
      icon,
      badge: opts.soon
        ? "soon"
        : justRevealed && !opts.active
          ? "new"
          : undefined,
      locked,
      disabled: locked,
      action: opts.action ?? "none",
      cls: {
        active: Boolean(opts.active),
        soon: Boolean(opts.soon),
        dimmed: !opts.soon && !revealed,
        revealed: justRevealed && !opts.active,
      },
    };
  };

  return [
    item("overview", "Overview", ICON.grid, { active: true }),
    // revealAt explore, not connect: this scrolls to previewCard, which only
    // exists inside the explore/ready template. Enabled any earlier it is a
    // live-looking nav item that silently does nothing.
    item("skills", "Skills", ICON.book, { revealAt: "explore", action: "preview" }),
    // Lands on the machines list. That IS the sync state today: which devices
    // are enrolled, which are admitted, and when each was last seen. Fuller
    // per-release history arrives with catalog publishing.
    item("sync", "Sync log", ICON.sync, { revealAt: "connect", action: "scroll-devices" }),
    item("members", "Members", ICON.users, { soon: true, action: "preview" }),
    item("billing", "Billing", ICON.card, {
      revealAt: "explore",
      action: "scroll-billing",
    }),
    item("settings", "Settings", ICON.gear, { revealAt: "ready" }),
  ];
});

onMounted(() => {
  void loadCloudState(true);
  void loadPricing();
  // Read once, on mount, rather than tracking the URL. The CLI opens this page
  // with the fingerprint already in it; nothing later in the session changes
  // which machine is asking.
  admitFingerprint.value = readAdmitFingerprint(window.location.search);
});

watch([isClerkLoaded, isClerkSignedIn], ([loaded]) => {
  if (!loaded) return;
  void loadCloudState();
});

// Devices only exist once a vault does, and the list is what the connect step
// renders, so start the moment a vault appears rather than on mount.
watch(
  () => vault.value?.id ?? null,
  (vaultId) => {
    if (!vaultId) {
      // Bump the sequence, do not just clear. A list request already in flight
      // for the OLD vault would otherwise pass both staleness checks and
      // repopulate this, leaving a dashboard with no vault claiming machines
      // are linked -- the same race the shell's own /api/me load guards.
      devicesRequestSeq += 1;
      devices.value = [];
      return;
    }
    // Always load once; the watcher above decides whether to keep polling.
    void loadDevices();
    startDevicePolling();
  },
  { immediate: true }
);

async function loadCloudState(initial = false) {
  const requestSeq = ++cloudStateRequestSeq;
  try {
    const headers = await authHeaders({ accept: "application/json" }, {
      required: clerkAuthEnabled && isClerkSignedIn.value,
      fresh: isClerkSignedIn.value,
    });
    const response = await fetch("/api/me", {
      credentials: "include",
      headers,
    });
    if (requestSeq !== cloudStateRequestSeq) return;
    cloudState.value = response.ok
      ? normalizeCloudState((await response.json()) as CloudStatePayload)
      : { user: null, subscription: null, vault: null };
    loadError.value = null;
  } catch (error) {
    if (requestSeq !== cloudStateRequestSeq) return;
    if (isClerkApiAuthError(error)) {
      if (error.reason !== "clerk-not-loaded") {
        const message = clerkAuthRecoveryMessage(error);
        notice.value = { kind: "warn", text: message };
        loadError.value = message;
      }
      return;
    }
    cloudState.value = { user: null, subscription: null, vault: null };
    loadError.value = null;
  } finally {
    // `initial` used to set hydrated outside the staleness guard, so a slow
    // first request could un-veil the page using a superseded response.
    if (requestSeq === cloudStateRequestSeq || initial) hydrated.value = true;
  }
}

async function retryLoad() {
  if (busy.value) return;
  busy.value = true;
  notice.value = null;
  try {
    await loadCloudState();
  } finally {
    busy.value = false;
  }
}

function syncCloudState(payload: CloudStatePayload) {
  // Bump the sequence so any /api/me this page already has in flight bails
  // out instead of overwriting freshly provisioned state.
  //
  // The race is real and lands exactly where it hurts: on a Stripe return
  // this page fires an /api/me before Clerk resolves (so it comes back
  // anonymous and slow), while the funnel reconciles and provisions. Without
  // this bump the stale anonymous response wins on arrival and drops a user
  // who has just paid straight back to "Finish checkout".
  //
  // The contract that makes the bump safe: the funnel only emits payloads it
  // actually knows to be true -- a 200 from /api/me, or a vault it just
  // provisioned. It stays silent when a request fails, precisely because
  // cancelling this page's own load is a side effect a guess cannot afford.
  cloudStateRequestSeq += 1;
  cloudState.value = normalizeCloudState(payload);
  loadError.value = null;
  hydrated.value = true;
}

function normalizeCloudState(payload: CloudStatePayload): CloudState {
  return {
    user: payload.user ?? null,
    subscription: payload.subscription ?? null,
    vault: payload.vault ?? null,
  };
}

async function openBillingPortal() {
  if (busy.value) {
    // The menu already renders Billing as aria-disabled while this lock is
    // held, so reaching here means the lock was taken between paint and
    // click. Say so rather than swallowing the choice: an apparently live
    // command that does nothing and explains nothing reads as a broken app.
    notice.value = { kind: "warn", text: "Just a moment — finishing the last request." };
    return;
  }
  busy.value = true;
  notice.value = null;
  try {
    const headers = await authHeaders({
      "content-type": "application/json",
      accept: "application/json",
    }, { required: true, fresh: true });
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ return_to: "/cloud#launch-path" }),
    });
    const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      // Covers the 409 "no billing account yet" case as well as a Stripe
      // outage — the server's own wording is more useful than anything
      // generic we could invent here.
      notice.value = {
        kind: "warn",
        text: payload.error || "Couldn't open billing just now. Try again in a moment.",
      };
      return;
    }
    window.location.assign(payload.url);
  } catch (error) {
    notice.value = {
      kind: "warn",
      text: isClerkApiAuthError(error)
        ? clerkAuthRecoveryMessage(error)
        : "Couldn't reach the server. Try again in a moment.",
    };
  } finally {
    busy.value = false;
  }
}

// The console's live view of enrolled machines.
//
// Polled rather than pushed: `autovault link` sits in a spinner asking the
// owner to admit it, so a pending row that only appears on reload is a
// deadlock -- the person is looking at this page waiting for it. Four seconds
// is well inside the CLI's own five-minute wait.
// Relative for anything recent, absolute once it stops being "just now".
// A device the owner is admitting right this second appeared seconds ago, and
// "2026-08-23T01:44:02Z" is a worse answer than "just now" for that.
function formatWhen(iso: string): string {
  const when = Date.parse(iso);
  if (!Number.isFinite(when)) return "recently";
  const seconds = Math.max(0, Math.round((Date.now() - when) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

let deviceLoadInFlight = false;

async function loadDevices() {
  if (!vault.value) return;
  deviceLoadInFlight = true;
  const requestSeq = ++devicesRequestSeq;
  try {
    const headers = await authHeaders({ accept: "application/json" }, {
      required: true,
      fresh: false,
    });
    const response = await fetch("/api/vaults/current/devices", {
      credentials: "include",
      headers,
    });
    if (requestSeq !== devicesRequestSeq) return;
    if (!response.ok) return;
    const payload = (await response.json()) as { devices?: SyncDevice[] };
    if (requestSeq !== devicesRequestSeq) return;
    devices.value = payload.devices ?? [];
  } catch {
    // Silent on purpose. This runs on a timer; a transient failure must not
    // stack up notices on a page the owner is reading.
  } finally {
    deviceLoadInFlight = false;
  }
}


// Two speeds, never off.
//
// Fast while something is waiting on the owner -- the connect step, or a
// pending device -- because `autovault link` is sitting in a spinner and four
// seconds is well inside its five-minute wait.
//
// Slow the rest of the time, but NOT stopped. Stopping was the obvious
// optimisation and it was wrong: a second machine running `autovault link`
// against an already-set-up vault creates a pending row that only polling can
// discover, so the condition would gate on the very thing it is meant to find.
// The owner would sit looking at a dashboard that never mentions the machine
// waiting on them.
//
// The cost is why this is throttled at all: /api/vaults/current/devices goes
// through requireUser, which in Clerk mode calls client.users.getUser and
// upserts the user on every request. Thirty seconds idle is ~120 of those an
// hour rather than ~900. The real fix is caching that profile sync in
// getClerkSessionUser, where it would benefit every endpoint; this is the
// version that does not add a second auth path.
const DEVICE_POLL_ACTIVE_MS = 4000;
const DEVICE_POLL_IDLE_MS = 30_000;

let devicePollTimer: ReturnType<typeof setInterval> | undefined;
let devicePollInterval = 0;

// ---- vault motion --------------------------------------------------------
//
// The mark IS the progress indicator: shut while setup is unfinished, open
// once a machine is linked. That is the whole reason it earns a focal slot —
// it is the one element that changes as you advance, so it replaces a rail
// that duplicated the status pills that duplicated the card contents.

const VAULT_UNLOCK_MS = 700;

const vaultOpen = computed(() => stage.value === "explore" || stage.value === "ready");

// The dial sweeps only while something is genuinely in flight. Not a spinner:
// a dial that turns forever reads as a component somebody forgot to stop.
const vaultWorking = computed(
  () => !hydrated.value || admitState.value === "waiting" || deviceBusy.value !== null
);

const vaultUnlocking = ref(false);
let vaultUnlockTimer: ReturnType<typeof setTimeout> | undefined;

// Fired from exactly one place — see decideDevice.
//
// NOT from watch(stage), which is the obvious implementation and is wrong.
// This page loads /api/me twice: once on mount, then again when Clerk
// resolves. The first comes back anonymous and computes stage "setup"; the
// second returns the real vault and jumps to "ready". So any guard of the
// form "previous was non-null" celebrates on EVERY reload for EVERY returning
// customer, which is exactly how an animation stops meaning anything.
function celebrateUnlock() {
  // Inside the handler, never at setup scope: this only ever runs from a user
  // action, so it cannot contribute to a hydration mismatch the way a
  // setup-time media query read would.
  if (prefersReducedMotion()) return;
  if (vaultUnlockTimer) clearTimeout(vaultUnlockTimer);
  vaultUnlocking.value = true;
  vaultUnlockTimer = setTimeout(() => {
    vaultUnlocking.value = false;
    vaultUnlockTimer = undefined;
  }, VAULT_UNLOCK_MS);
}

onBeforeUnmount(() => {
  if (vaultUnlockTimer) clearTimeout(vaultUnlockTimer);
});

const devicePollUrgent = computed(
  () =>
    stage.value === "connect" ||
    pendingDevices.value.length > 0 ||
    // A machine linking against an already-set-up vault reaches neither of the
    // conditions above until its row lands, so on the idle 30s cadence the
    // owner could sit for half a minute on a page that came from the CLI and
    // shows nothing. `?admit=` is positive evidence that a row is inbound --
    // but only until the budget above runs out, because a link that matches
    // nothing is evidence of nothing.
    (admitState.value === "waiting" && !admitWaitExpired.value)
);

function stopDevicePolling() {
  if (devicePollTimer) clearInterval(devicePollTimer);
  devicePollTimer = undefined;
  devicePollInterval = 0;
}

function startDevicePolling() {
  if (typeof window === "undefined" || !vault.value) return;
  const wanted = devicePollUrgent.value ? DEVICE_POLL_ACTIVE_MS : DEVICE_POLL_IDLE_MS;
  if (devicePollTimer && devicePollInterval === wanted) return;
  stopDevicePolling();
  devicePollInterval = wanted;
  devicePollTimer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    // Skip the tick rather than stacking a second request. Each call bumps
    // devicesRequestSeq, so an overlapping poll invalidates the one already in
    // flight -- and if latency stays above the interval, every response is
    // superseded before it lands and the list never updates at all, while the
    // backend takes the load of all of them. Explicit refreshes after an
    // action still go through: those are newer on purpose.
    if (deviceLoadInFlight) return;
    void loadDevices();
  }, wanted);
}

watch(devicePollUrgent, () => startDevicePolling());

onBeforeUnmount(stopDevicePolling);

async function decideDevice(deviceId: string, action: "admit" | "revoke") {
  if (deviceBusy.value) return;
  deviceBusy.value = deviceId;
  notice.value = null;
  // Read before anything awaits. Captured after the request instead, the
  // four-second device poll can land between the server committing the admit
  // and this handler resuming — it sees the device already active, flips
  // vaultOpen, and `wasOpen` then reads true, so the owner's *first* machine
  // silently gets no celebration. This is also what the comment below means
  // by the state the owner actually saw: the state at the moment they clicked.
  const wasOpen = vaultOpen.value;
  try {
    const headers = await authHeaders({
      "content-type": "application/json",
      accept: "application/json",
    }, { required: true, fresh: true });
    const response = await fetch(`/api/vaults/current/devices/${encodeURIComponent(deviceId)}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      notice.value = { kind: "warn", text: payload.error || "Couldn't update that device just now." };
      return;
    }
    // Only a closed vault becoming open celebrates — admitting a second
    // machine to an already-open vault is routine.
    //
    // Deliberately NOT gated on vaultOpen.value after the refresh. A 2xx from
    // the admit endpoint means the server activated the device, so a vault
    // that had no active machine before now has one — whether or not the
    // follow-up list request succeeded. loadDevices() is silent on failure by
    // design (it also runs on a timer), so reading state back from it made a
    // transient network blip swallow the one celebration that matters, with
    // no stage watcher to catch it later.
    const opened = action === "admit" && !wasOpen;
    await loadDevices();
    if (opened) celebrateUnlock();
    notice.value = {
      kind: "ok",
      text: action === "admit"
        ? "Device admitted. Its CLI will pick that up within a couple of seconds."
        : "Device revoked. It can no longer pull from this vault.",
    };
  } catch (error) {
    notice.value = {
      kind: "warn",
      text: isClerkApiAuthError(error)
        ? clerkAuthRecoveryMessage(error)
        : "Couldn't reach the device endpoint just now.",
    };
  } finally {
    deviceBusy.value = null;
  }
}

async function markProgress(step: "early_access") {
  if (busy.value || !vault.value) return;
  busy.value = true;
  notice.value = null;
  try {
    const headers = await authHeaders({
      "content-type": "application/json",
      accept: "application/json",
    }, { required: true, fresh: true });
    const response = await fetch("/api/vaults/current/progress", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ step }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.vault) {
      notice.value = {
        kind: "warn",
        text:
          payload.error ||
          "Couldn't save that just now — try again in a moment.",
      };
      return;
    }
    cloudState.value = { ...cloudState.value, vault: payload.vault };
    notice.value = {
      kind: "ok",
      text: "You're on the early-access list. We'll be in touch.",
    };
  } catch (error) {
    if (isClerkApiAuthError(error)) {
      notice.value = { kind: "warn", text: clerkAuthRecoveryMessage(error) };
      return;
    }
    notice.value = {
      kind: "warn",
      text: "Couldn't reach the server — try again in a moment.",
    };
  } finally {
    busy.value = false;
  }
}

function onNavClick(item: NavItem) {
  if (item.action === "preview") void focusCard("preview", previewCard.value);
  else if (item.action === "scroll-billing")
    void focusCard("billing", billingCard.value);
  else if (item.action === "scroll-devices")
    void focusCard("devices", devicesCard.value);
}

async function focusCard(name: "preview" | "billing" | "devices", el: HTMLElement | null) {
  await nextTick();
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  focusedCard.value = name;
  setTimeout(() => {
    if (focusedCard.value === name) focusedCard.value = null;
  }, 1400);
}

function revealDelay(index: number) {
  return { animationDelay: `${index * 90}ms` };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ICON = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V6a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v14H6a2 2 0 0 1-2-2Z"/><path d="M8 7h8"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>`,
} as const;
</script>

<style scoped>
.cv-page {
  --cv-radius: 14px;
  --cv-radius-sm: 9px;
  position: relative;
  width: 100%;
  padding-top: 24px;
  color: var(--ink);
}

/* ---------------- boot veil ---------------- */
/* Overlays the shell rather than replacing it, so the prerendered HTML
   already contains the real layout and nothing jumps when /api/me lands. */
.cv-boot {
  position: absolute;
  inset: 24px 0 0;
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 14px;
  border-radius: var(--cv-radius);
  background: var(--bg);
  color: var(--ink-3);
  font-size: 14px;
}
.cv-boot-mark {
  opacity: 0.7;
  animation: cv-pulse 1.8s var(--ease) infinite;
}

/* Eyebrow + spark moved from the deleted pre-vault header into the topbar,
   where they now render at every stage as persistent chrome. */
.cv-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.cv-spark {
  width: 16px;
  height: 1px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

/* ---------------- product shell ---------------- */
.cv-shell {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--cv-radius);
  background: var(--bg);
  overflow: hidden;
  min-height: 640px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}

/* sidebar */
.cv-side {
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  background: var(--bg-2);
  border-right: 1px solid var(--line);
}
.cv-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line-2);
}
.cv-brand-mark {
  display: inline-flex;
}
.cv-brand-ns {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
}
.cv-slash {
  color: var(--accent);
}

.cv-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.cv-nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease);
}
.cv-nav-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.035);
  color: var(--ink);
}
.cv-nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: rgba(90, 214, 192, 0.22);
}
.cv-nav-item.dimmed {
  color: var(--ink-4);
  cursor: default;
}
.cv-nav-item.soon {
  color: var(--ink-3);
  cursor: default;
}
.cv-nav-item:disabled {
  cursor: default;
}
.cv-nav-item.revealed {
  animation: cv-nav-pop 0.5s var(--ease) both;
}
.cv-nav-ic {
  display: inline-flex;
  flex: none;
}
.cv-nav-ic :deep(svg) {
  width: 15px;
  height: 15px;
  opacity: 0.85;
}
.cv-nav-label {
  flex: 1;
}
.cv-nav-soon {
  font-family: var(--mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--violet);
  border: 1px solid rgba(180, 138, 214, 0.4);
  background: rgba(180, 138, 214, 0.1);
  border-radius: 5px;
  padding: 1px 6px;
}
.cv-nav-new {
  font-family: var(--mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid rgba(90, 214, 192, 0.45);
  border-radius: 5px;
  padding: 1px 6px;
  animation: cv-nav-pop 0.5s var(--ease) both;
}
.cv-nav-lock {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.5;
}


/* main content */
.cv-content {
  padding: 26px 30px 40px;
  min-width: 0;
}
.cv-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}
.cv-crumb {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-3);
}
.cv-crumb-host {
  color: var(--accent);
}
.cv-topbar h1 {
  margin: 5px 0 0;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.cv-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cv-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 11px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  white-space: nowrap;
}
.cv-pill.sm {
  padding: 2px 9px;
}
.cv-pill .cv-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.cv-pill.ok {
  color: var(--ok);
  border-color: rgba(123, 216, 143, 0.36);
  background: rgba(123, 216, 143, 0.08);
}
.cv-pill.warn {
  color: var(--warn);
  border-color: rgba(232, 168, 102, 0.36);
  background: rgba(232, 168, 102, 0.08);
}
.cv-pill.bad {
  color: var(--bad);
  border-color: rgba(217, 113, 113, 0.36);
  background: rgba(217, 113, 113, 0.08);
}
.cv-pill.mut {
  color: var(--ink-3);
}

.cv-sub-warn {
  margin: 10px 0 0;
  font-size: 12px;
}

.cv-notice {
  margin: 0 0 18px;
  padding: 10px 14px;
  border-radius: var(--cv-radius-sm);
  font-size: 13px;
}
.cv-notice.ok {
  color: var(--ok);
  border: 1px solid rgba(123, 216, 143, 0.3);
  background: rgba(123, 216, 143, 0.07);
}
.cv-notice.warn {
  color: var(--warn);
  border: 1px solid rgba(232, 168, 102, 0.3);
  background: rgba(232, 168, 102, 0.07);
}
/* The funnel emits a third tone for hard failures (Stripe not configured,
   provisioning refused). Without this rule those rendered unstyled. */
.cv-notice.fail {
  color: var(--bad);
  border: 1px solid rgba(217, 113, 113, 0.3);
  background: rgba(217, 113, 113, 0.07);
}

.cv-greeting {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 14px;
}

/* focal card (stage A) */
.cv-focal {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(90, 214, 192, 0.24);
  border-radius: var(--cv-radius);
  background: linear-gradient(125deg, #11212b 0%, #0e1820 58%, #0d161d 100%);
  padding: 26px 28px;
  max-width: 640px;
}
.cv-focal-glow {
  position: absolute;
  right: -50px;
  top: -50px;
  width: 220px;
  height: 220px;
  background: radial-gradient(
    circle,
    rgba(90, 214, 192, 0.16),
    transparent 70%
  );
  pointer-events: none;
  animation: cv-breathe 6s var(--ease) infinite;
}
.cv-focal-ns {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.cv-endpoint-mono {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
  min-width: 0;
  overflow-wrap: anywhere;
}
.cv-step-kicker {
  margin-top: 16px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.cv-focal h2 {
  margin: 6px 0 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.cv-focal-body {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.55;
  max-width: 520px;
}

.cv-terminal-wrapper {
  position: relative;
}
.cv-terminal-body {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  border: 1px solid var(--line-2);
  border-radius: var(--cv-radius-sm);
  background: #0a0f13;
  min-height: auto;
  max-height: none;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--ink);
  white-space: pre;
}
.cv-cmd-copy {
  position: absolute;
  top: 10px;
  right: 10px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  background: rgba(15, 22, 28, 0.9);
  color: var(--accent);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 9px;
  cursor: pointer;
}
.cv-cmd-copy:hover {
  border-color: var(--accent);
}

.cv-devices {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
/* Inside the focal card it borrowed that card's frame. On its own it needs
   one, and it is now the only route to revoking a machine. */
.cv-devices.standalone {
  margin-top: 20px;
  padding: 16px 18px 18px;
  border: 1px solid var(--line);
  border-radius: var(--cv-radius);
  background: var(--bg-1);
}
.cv-devices.standalone.focusflash {
  border-color: var(--accent);
}

.cv-devices-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ink-2);
}
.cv-devices-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(230, 180, 90, 0.16);
  color: #e6b45a;
  font-size: 11px;
  font-weight: 500;
}
.cv-devices-empty {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cv-device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cv-device {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--cv-radius-sm);
  background: var(--bg-2);
}
.cv-device.pending {
  border-color: rgba(230, 180, 90, 0.4);
}
/* The row the CLI sent this owner here to act on. Focus lands on its Admit
   button, so this only has to make the target obvious among siblings -- the
   keyboard affordance is already handled. */
.cv-device.admit-target {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent);
}
.cv-devices-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cv-devices-waiting code {
  font-size: 11.5px;
  color: var(--ink-2);
}
.cv-devices-waiting .cv-dot {
  animation: cv-admit-pulse 1.6s ease-in-out infinite;
}
/* Stop pulsing once nothing is coming — the animation reads as progress. */
.cv-devices-waiting.stalled .cv-dot {
  animation: none;
  opacity: 0.35;
}
@keyframes cv-admit-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}
.cv-device-id {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.cv-device-id strong {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cv-device-id code {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
.cv-device-seen {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
  flex: 0 0 auto;
}
.cv-device-seen small {
  font-size: 11px;
  color: var(--ink-3);
}
.cv-device-actions {
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
}
.cv-btn.small {
  padding: 5px 10px;
  font-size: 12px;
}

/* Below 640px the three columns stop fitting side by side; the actions want
   to stay reachable rather than shrink to nothing. */
@media (max-width: 640px) {
  .cv-device {
    flex-wrap: wrap;
  }
  .cv-device-seen {
    align-items: flex-start;
  }
  .cv-device-actions {
    width: 100%;
  }
  .cv-device-actions .cv-btn {
    flex: 1 1 auto;
  }
}

.cv-focal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.cv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: var(--cv-radius-sm);
  background: var(--accent);
  color: var(--accent-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 18px;
  cursor: pointer;
  text-decoration: none;
  transition:
    filter var(--dur-fast) var(--ease),
    transform var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
}
.cv-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(90, 214, 192, 0.22);
}
.cv-btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: none;
}
.cv-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.cv-btn.ghost {
  background: transparent;
  border-color: var(--line);
  color: var(--ink-2);
}
.cv-btn.ghost:hover {
  border-color: var(--ink-3);
  color: var(--ink);
  filter: none;
  box-shadow: none;
}

/* keyboard focus — interactive elements get a clear mint ring */
.cv-btn:focus-visible,
.cv-nav-item:focus-visible,
.cv-cmd-copy:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* The vault, focal. Sized so it reads as the subject of the page rather than
   an icon, and centered because at these stages there is exactly one thing to
   do and nothing should compete with it. */
/* Mark and progress as one unit rather than two stacked strangers. The
   connect stage used to read as four separate things down the page — mark,
   rail, a greeting that paraphrased the card under it, then the card. This is
   the first two of those becoming one, and the greeting is gone. */
.cv-vaulthead {
  display: grid;
  justify-items: center;
  gap: 2px;
  margin-bottom: 26px;
}
/* Inside the head the rail is a caption, not a section: centered, quieter,
   and it keeps its labels because they say what is left to do — which is the
   whole reason it is still here rather than being reduced to dots. */
.cv-vaulthead .cv-rail {
  margin: 0;
  justify-content: center;
  flex-wrap: wrap;
  row-gap: 8px;
}
.cv-vaulthead .cv-rail-step {
  font-size: 11.5px;
}
.cv-vaulthead .cv-rail-copy small {
  display: none;
}
/* The detail line is the one thing that goes: it is per-step prose and turns
   a caption back into a section. `active` keeps it, because that is the step
   the reader is actually on. */
.cv-vaulthead .cv-rail-step.active .cv-rail-copy small {
  display: block;
  /* The base rule caps this at 150px with nowrap + ellipsis, which is right
     for a four-across row of fixed columns and wrong for a centered caption:
     it clipped "Point your CLI at the namespace" to "…at the nama…". The one
     line that is meant to tell you what to do next should be readable. */
  max-width: none;
  white-space: normal;
  overflow: visible;
  text-align: center;
}

.cv-vaultfocal {
  display: grid;
  place-items: center;
  padding: 6px 0 18px;
  color: var(--accent);
}
.cv-vaultfocal :deep(.brand-mark-svg),
.cv-status-mark :deep(.brand-mark-svg) {
  color: inherit;
}
/* Compact once the vault is open: it states the one fact this strip exists
   for, so the pill beside it does not have to. */
.cv-status-mark {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--accent);
}

.cv-rail {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
}
.cv-rail-step {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  font-size: 12px;
  color: var(--ink-3);
}
.cv-rail-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.cv-rail-copy strong {
  font-weight: 500;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cv-rail-copy small {
  font-size: 11px;
  color: var(--ink-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}
.cv-rail-step.active .cv-rail-copy strong,
.cv-rail-step.done .cv-rail-copy strong {
  color: var(--ink);
}
.cv-rail-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  margin-top: 1px;
  border-radius: 50%;
  border: 1.5px solid var(--line-2);
  font-size: 10px;
  flex: none;
  transition:
    border-color var(--dur-base) var(--ease),
    color var(--dur-base) var(--ease);
}
.cv-rail-step.active .cv-rail-dot {
  border-color: var(--accent);
  color: var(--accent);
}
.cv-rail-step.done .cv-rail-dot {
  border-color: var(--ok);
  color: var(--ok);
}
/* A failed /api/me means we know nothing about any step -- render that
   honestly rather than implying "not started". */
.cv-rail-step.unknown .cv-rail-dot {
  border-style: dashed;
  border-color: var(--line-2);
  color: var(--ink-4);
}
.cv-rail-line {
  flex: 1;
  max-width: 44px;
  height: 1.5px;
  margin: 10px 12px 0;
  background: var(--line-2);
}
/* Once every step is done the rail has no job left, so it collapses to a
   quiet completed row instead of parking a finished progress bar on the
   resting dashboard forever. */
.cv-rail.complete .cv-rail-copy small,
.cv-rail.complete .cv-rail-line {
  display: none;
}
.cv-rail.complete .cv-rail-step {
  gap: 6px;
}
.cv-rail.complete .cv-rail-step + .cv-rail-step {
  margin-left: 16px;
}
.cv-rail.complete .cv-rail-dot {
  width: 15px;
  height: 15px;
  font-size: 8.5px;
}
.cv-rail.complete .cv-rail-copy strong {
  font-size: 11.5px;
  color: var(--ink-3);
}

/* Signed-out: the shell is visible but obviously not yours yet. Opacity
   rather than blur -- blur is unreadable and reads as motion. */
.cv-shell.locked .cv-nav,
.cv-shell.locked .cv-acct {
  opacity: 0.55;
}
.cv-shell.booting {
  pointer-events: none;
}
.cv-price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 20px;
}
.cv-price strong {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.cv-price span {
  font-size: 12.5px;
  color: var(--ink-3);
}

.cv-brand-ns.pending {
  color: var(--ink-4);
}

/* Four labelled steps cannot sit side by side on a phone -- flexed across,
   the labels wrap one character per line. Stack them instead and drop the
   connector, which has no meaning in a vertical list. */
@media (max-width: 640px) {
  .cv-rail {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .cv-rail-line {
    display: none;
  }
  .cv-rail-copy small {
    max-width: none;
  }
  .cv-rail.complete {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 10px 0;
  }
}

/* status card (stage B/C) */
.cv-status-card {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  border: 1px solid rgba(123, 216, 143, 0.24);
  border-radius: var(--cv-radius);
  background: rgba(123, 216, 143, 0.04);
  padding: 15px 18px;
  margin-bottom: 16px;
  animation: cv-reveal 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.cv-status-text {
  color: var(--ink-2);
  font-size: 13px;
}
.cv-status-text code {
  font-family: var(--mono);
  color: var(--ink);
}

/* cards & reveal */
.cv-reveal {
  animation: cv-reveal 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  margin-bottom: 16px;
}
.cv-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.cv-card {
  border: 1px solid var(--line);
  border-radius: var(--cv-radius);
  background: var(--panel);
  padding: 18px 20px;
  transition:
    box-shadow var(--dur-base) var(--ease),
    border-color var(--dur-base) var(--ease);
}
.cv-card.soft {
  background: var(--bg-2);
}
.cv-card.focusflash,
.cv-preview.focusflash {
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 0 30px rgba(90, 214, 192, 0.18);
}
.cv-card-label {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 12px;
}
.cv-card-label.violet {
  color: var(--violet);
}
.cv-kv {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
}
.cv-kv li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--line-2);
  font-size: 13px;
}
.cv-kv li:last-child {
  border-bottom: 0;
}
.cv-kv span {
  color: var(--ink-3);
}
.cv-kv strong {
  font-weight: 500;
  color: var(--ink);
}
.cv-reserved {
  list-style: none;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--line-2);
}
.cv-reserved li {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 0;
  font-size: 12.5px;
  color: var(--ink-2);
}
.cv-chk {
  color: var(--ok);
  font-weight: 700;
}
.cv-muted {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.5;
  margin: 10px 0 0;
}
.cv-muted.sm {
  font-size: 12px;
  margin-top: 10px;
}

/* app preview */
.cv-preview {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 26px;
  align-items: center;
  border: 1px solid rgba(180, 138, 214, 0.28);
  border-radius: var(--cv-radius);
  background: var(--panel);
  padding: 22px;
  transition:
    box-shadow var(--dur-base) var(--ease),
    border-color var(--dur-base) var(--ease);
}
.cv-appframe {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--cv-radius-sm);
  background: #0a0f13;
}
.cv-appframe::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 52%, rgba(7, 11, 14, 0.5));
  pointer-events: none;
}
.cv-appbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 13px;
  border-bottom: 1px solid var(--line-2);
  background: #0d141a;
}
.cv-tdot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.cv-tdot.bad {
  background: var(--bad);
}
.cv-tdot.warn {
  background: var(--warn);
}
.cv-tdot.ok {
  background: var(--ok);
}
.cv-appurl {
  margin-left: 8px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
.cv-appbody {
  display: flex;
  min-height: 188px;
}
.cv-appnav {
  width: 100px;
  border-right: 1px solid var(--line-2);
  padding: 11px 8px;
  background: #0b1117;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cv-appnav span {
  font-size: 11px;
  color: var(--ink-3);
  padding: 5px 8px;
  border-radius: 5px;
}
.cv-appnav span.on {
  background: var(--accent-soft);
  color: var(--accent);
}
.cv-appmain {
  flex: 1;
  padding: 13px;
}
.cv-appsearch {
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--line-2);
  background: #0b1117;
  margin-bottom: 10px;
}
.cv-approw {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid var(--line-2);
  border-radius: 7px;
  margin-bottom: 7px;
  background: var(--panel);
}
.cv-appicon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--accent-soft);
  flex: none;
}
.cv-appskel {
  height: 7px;
  border-radius: 4px;
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0.06) 30%,
    rgba(90, 214, 192, 0.18) 50%,
    rgba(255, 255, 255, 0.06) 70%
  );
  background-size: 220% 100%;
  animation: cv-shimmer 2.6s var(--ease) infinite;
}
.cv-approw:nth-child(3) .cv-appskel {
  animation-delay: 0.25s;
}
.cv-approw:nth-child(4) .cv-appskel {
  animation-delay: 0.5s;
}
.cv-appsync {
  margin-left: auto;
  font-size: 9px;
  color: var(--ok);
  white-space: nowrap;
  animation: cv-sync-pulse 2.2s var(--ease) infinite;
}

.cv-preview-copy h2 {
  margin: 8px 0;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.cv-preview-copy p {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.55;
}
.cv-feats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.cv-feats span {
  font-size: 11px;
  color: var(--ink-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 11px;
}
.cv-confirm {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid rgba(123, 216, 143, 0.3);
  border-radius: var(--cv-radius-sm);
  background: rgba(123, 216, 143, 0.07);
  padding: 12px 14px;
}
.cv-confirm-ic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(123, 216, 143, 0.18);
  color: var(--ok);
  font-weight: 700;
  flex: none;
}
.cv-confirm span {
  font-size: 13px;
  color: var(--ink);
}
.cv-confirm small {
  display: block;
  color: var(--ink-3);
  font-size: 11.5px;
  margin-top: 2px;
}

/* animations */
@keyframes cv-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cv-nav-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cv-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
@keyframes cv-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -100% 0;
  }
}
@keyframes cv-sync-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@keyframes cv-breathe {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cv-reveal,
  .cv-nav-item.revealed,
  .cv-nav-new,
  .cv-boot-mark,
  .cv-status-card,
  .cv-appsync,
  .cv-focal-glow,
  .cv-appskel,
  .cv-devices-waiting .cv-dot {
    animation: none;
  }
  .cv-appskel {
    background: rgba(255, 255, 255, 0.08);
  }
  /* Neutralize decorative hover motion too — keep state changes, drop the travel */
  .cv-btn,
  .cv-nav-item,
  .cv-card,
  .cv-preview,
  .cv-cmd-copy {
    transition: none;
  }
  .cv-btn:hover:not(:disabled),
  .cv-btn:active:not(:disabled) {
    transform: none;
  }
}

/* responsive */
@media (max-width: 960px) {
  .cv-shell {
    grid-template-columns: 1fr;
  }
  .cv-side {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .cv-brand {
    border-bottom: 0;
    padding: 0 8px 0 4px;
    margin: 0;
  }
  .cv-nav {
    flex-direction: row;
    flex-wrap: wrap;
    flex: 1;
  }
  .cv-nav-item {
    width: auto;
  }
  .cv-nav-label {
    flex: none;
  }
  .cv-preview,
  .cv-two {
    grid-template-columns: 1fr;
  }
  .cv-appframe {
    order: 2;
  }
}
/* The 960px rule turns the sidebar into a horizontal strip. At phone widths
   that strip has to wrap, and `flex: 1` on the nav pushed the items to the
   right of the brand, leaving the vault name stranded on its own line. Stack
   the three regions instead so everything stays left-aligned. */
@media (max-width: 640px) {
  .cv-side {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding-bottom: 12px;
  }
  .cv-brand {
    padding: 0 0 10px;
    border-bottom: 1px solid var(--line);
  }
  .cv-nav {
    flex: none;
    gap: 6px;
  }
}

@media (max-width: 560px) {
  .cv-content {
    padding: 20px 18px 32px;
  }
  .cv-focal {
    padding: 20px;
  }
  .cv-topbar {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
