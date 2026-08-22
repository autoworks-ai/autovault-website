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
    <!-- Loading veil: avoids a flash of the setup funnel before /api/me resolves -->
    <div v-if="!hydrated" class="cv-boot">
      <span class="cv-boot-mark"
        ><BrandMark :size="30" state="locked" show-depth
      /></span>
      <p>Opening your hosted vault…</p>
    </div>

    <!-- Auth resolved to an error, not to "no vault". Showing the sign-up
         funnel here would tell an existing paying customer to create an
         account they already have. -->
    <div v-else-if="stage === 'error'" class="cv-setup">
      <header class="cv-setup-head">
        <div class="cv-eyebrow"><span class="cv-spark" /> Hosted vault</div>
        <h1>We couldn't load your vault</h1>
        <p>{{ loadError }}</p>
      </header>
      <div class="cv-setup-body">
        <button class="cv-btn" type="button" :disabled="busy" @click="retryLoad">
          Try again
        </button>
      </div>
    </div>

    <!-- ============ PRE-VAULT: focused sign-up funnel ============ -->
    <div v-else-if="stage === 'setup'" class="cv-setup">
      <header class="cv-setup-head">
        <div class="cv-eyebrow"><span class="cv-spark" /> Hosted vault</div>
        <h1>Set up your hosted vault</h1>
        <p>{{ setupLede }}</p>
      </header>
      <div class="cv-setup-body">
        <HostedVaultFunnel entry="deploy" @state-change="syncCloudState" />
      </div>
    </div>

    <!-- ============ POST-VAULT: progressive product shell ============ -->
    <div v-else class="cv-shell">
      <aside class="cv-side" aria-label="Vault navigation">
        <div class="cv-brand">
          <span class="cv-brand-mark"
            ><BrandMark :size="22" state="unlocked"
          /></span>
          <span class="cv-brand-ns"
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
          @billing="openBillingPortal"
        />
      </aside>

      <main class="cv-content">
        <header class="cv-topbar">
          <div>
            <div class="cv-crumb">
              <span class="cv-crumb-host">vault.autovault.dev</span> /
              {{ vaultSlug }}
            </div>
            <h1>Overview</h1>
          </div>
          <div class="cv-badges">
            <span class="cv-pill ok"
              ><span class="cv-dot" /> Namespace reserved</span
            >
            <span class="cv-pill mut"
              ><span class="cv-dot" /> Hosted sync · building</span
            >
          </div>
        </header>

        <p
          v-if="notice"
          class="cv-notice"
          :class="notice.kind"
          role="status"
          aria-live="polite"
        >
          {{ notice.text }}
        </p>

        <!-- ---------- STAGE A: CONNECT ---------- -->
        <template v-if="stage === 'connect'">
          <p class="cv-greeting">
            Welcome — your vault is reserved. Here's the one thing to do now.
          </p>
          <div class="cv-focal">
            <div class="cv-focal-glow" aria-hidden="true" />
            <div class="cv-focal-ns">
              <span class="cv-pill ok"><span class="cv-dot" /> Reserved</span>
              <span class="cv-endpoint-mono">{{ hostedEndpoint }}</span>
            </div>
            <div class="cv-step-kicker">
              Step 1 of 2 · the only thing to do right now
            </div>
            <h2>Connect your local CLI</h2>
            <p class="cv-focal-body">
              Point your machine at the reserved namespace. This is what works
              today — everything else unlocks as you go.
            </p>
            <div class="cv-connect-terminal">
              <ConnectTerminal :slug="vaultSlug" />
            </div>
            <div class="cv-focal-actions">
              <button
                type="button"
                class="cv-btn"
                :disabled="busy"
                @click="markProgress('cli_linked')"
              >
                {{ busy ? "Saving…" : "I've linked my CLI ✓" }}
              </button>
              <a class="cv-btn ghost" :href="installDocsHref"
                >Installation guide</a
              >
            </div>
            <div class="cv-rail">
              <div class="cv-rail-step now">
                <span class="cv-rail-dot">1</span> Connect CLI
              </div>
              <span class="cv-rail-line" />
              <div class="cv-rail-step">
                <span class="cv-rail-dot">2</span> Explore what's next
              </div>
            </div>
          </div>
        </template>

        <!-- ---------- STAGE B: EXPLORE  &  STAGE C: READY ---------- -->
        <template v-else>
          <!-- progress summary card (collapses stage A) -->
          <div class="cv-status-card" :class="{ allset: stage === 'ready' }">
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
  onMounted,
  ref,
  watch,
} from "vue";
import HostedVaultFunnel from "./HostedVaultFunnel.vue";
import BrandMark from "./BrandMark.vue";
import CloudAccountMenu from "./CloudAccountMenu.vue";
import { copyText as copyToClipboard } from "../utils/clipboard";
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
      { type: "out", text: "↳ verifying local environment" },
      { type: "ok", text: "✓ namespace linked successfully" },
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
type Stage = "error" | "setup" | "connect" | "explore" | "ready";
type NavItem = {
  key: string;
  label: string;
  icon: string;
  badge?: "soon" | "new";
  locked: boolean;
  disabled: boolean;
  cls: Record<string, boolean>;
  action: "none" | "preview" | "scroll-billing";
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
const notice = ref<{ kind: "ok" | "warn"; text: string } | null>(null);
const focusedCard = ref<"preview" | "billing" | null>(null);
const previewCard = ref<HTMLElement | null>(null);
const billingCard = ref<HTMLElement | null>(null);
const previewRows = [{ w: "55%" }, { w: "42%" }, { w: "60%" }];

const { authHeaders, clerkAuthEnabled, isClerkLoaded, isClerkSignedIn, clerkUserLabel } =
  useClerkApiAuth();
let cloudStateRequestSeq = 0;

const user = computed(() => cloudState.value.user);
const vault = computed(() => cloudState.value.vault);
const cliLinked = computed(() => Boolean(vault.value?.cli_linked_at));
const earlyAccess = computed(() => Boolean(vault.value?.early_access_at));

const stage = computed<Stage>(() => {
  if (loadError.value && !vault.value) return "error";
  if (!vault.value) return "setup";
  if (!cliLinked.value) return "connect";
  if (!earlyAccess.value) return "explore";
  return "ready";
});

const subscription = computed(() => cloudState.value.subscription);

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

const setupLede = computed(() =>
  isClerkSignedIn.value
    ? "A couple of steps left — finish checkout to reserve your namespace. Signing and serving stay on the local CLI today."
    : "Create your account, reserve a stable namespace, and keep your local CLI as the source of truth. Hosted sync ships next.",
);

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
    const order: Stage[] = ["setup", "connect", "explore", "ready"];
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
    item("skills", "Skills", ICON.book, { soon: true, action: "preview" }),
    item("sync", "Sync log", ICON.sync, { soon: true, action: "preview" }),
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
});

watch([isClerkLoaded, isClerkSignedIn], ([loaded]) => {
  if (!loaded) return;
  void loadCloudState();
});

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
  if (busy.value) return;
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

async function markProgress(step: "cli_linked" | "early_access") {
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
      text:
        step === "cli_linked"
          ? "Nice — CLI linked. A few more details are unlocked below."
          : "You're on the early-access list. We'll be in touch.",
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
}

async function focusCard(name: "preview" | "billing", el: HTMLElement | null) {
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
  width: 100%;
  padding-top: 24px;
  color: var(--ink);
}

/* ---------------- boot veil ---------------- */
.cv-boot {
  display: grid;
  justify-items: center;
  gap: 14px;
  padding: 120px 0;
  color: var(--ink-3);
  font-size: 14px;
}
.cv-boot-mark {
  opacity: 0.7;
  animation: cv-pulse 1.8s var(--ease) infinite;
}

/* ---------------- pre-vault setup ---------------- */
.cv-setup {
  max-width: 760px;
  margin: 0 auto;
}
.cv-setup-head {
  margin-bottom: 26px;
}
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
.cv-setup-head h1 {
  margin: 14px 0 8px;
  font-size: 40px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.cv-setup-head p {
  margin: 0;
  max-width: 580px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.55;
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

.cv-rail {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 22px;
}
.cv-rail-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-3);
}
.cv-rail-step.now {
  color: var(--ink);
}
.cv-rail-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  border: 1.5px solid var(--line-2);
  font-size: 10px;
  flex: none;
}
.cv-rail-step.now .cv-rail-dot {
  border-color: var(--accent);
  color: var(--accent);
}
.cv-rail-line {
  flex: 1;
  max-width: 60px;
  height: 1.5px;
  margin: 0 12px;
  background: var(--line-2);
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
  .cv-appskel {
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
