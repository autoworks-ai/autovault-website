<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { clerkBrand } from "../clerk";
import {
  clerkAuthRecoveryMessage,
  isClerkApiAuthError,
  useClerkApiAuth,
} from "../utils/clerkApi";

// Mirrors CloudPage.vue's CloudVault/CloudSubscription shapes (not exported
// from there, so duplicated here rather than imported) -- see
// functions/api/_lib/vault.js for the source of truth.
type Vault = {
  slug: string;
  public_url: string;
} | null;
type Subscription = {
  active: boolean;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
} | null;
type MePayload = {
  subscription?: Subscription;
  vault?: Vault;
};
type SyncDevice = { status: "pending" | "active" | "revoked" };

const { authHeaders } = useClerkApiAuth();

// Mirrors CloudPage.vue's SUBSCRIPTION_LABELS map exactly. This repo has no
// shared composable for the vocabulary yet, so the small map is duplicated
// rather than invented. Keep these two in sync if either changes: the last time
// they drifted, `paused` reached one of them and not the other, and the two
// account surfaces offered different recovery paths for one Stripe status.
const SUBSCRIPTION_LABELS: Record<
  string,
  { text: string; tone: "ok" | "warn" | "bad" }
> = {
  active: { text: "Active", tone: "ok" },
  trialing: { text: "Trialing", tone: "ok" },
  past_due: { text: "Past due", tone: "warn" },
  unpaid: { text: "Unpaid", tone: "bad" },
  incomplete: { text: "Incomplete", tone: "warn" },
  incomplete_expired: { text: "Expired", tone: "bad" },
  canceled: { text: "Canceled", tone: "bad" },
  paused: { text: "Paused", tone: "warn" },
};

type LoadState = "loading" | "ready" | "error";

const loadState = ref<LoadState>("loading");
const vault = ref<Vault>(null);
const subscription = ref<Subscription>(null);
const activeDeviceCount = ref<number | null>(null);
const billingBusy = ref(false);
const billingNotice = ref<string | null>(null);

// Same rule as the dashboard's, and here for the same reason: a subscription
// cancelled from the portal keeps its status until the period closes, so
// "Trialing" and "Active" are both true of a cancelled one and both wrong to
// show as the headline.
// Same rule as the dashboard's, including that it does NOT also require
// `active`: a past_due or paused subscriber who has cancelled still has to be
// told the cancellation took.
const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

const cancelling = computed(() => {
  if (!subscription.value?.cancel_at_period_end) return false;
  return !ENDED_STATUSES.has(subscription.value?.status ?? "");
});

const subscriptionState = computed(() => {
  const status = subscription.value?.status ?? null;
  if (cancelling.value) return { text: "Cancelled", tone: "warn" as const };
  if (!status) {
    return subscription.value?.active
      ? { text: "Active", tone: "ok" as const }
      : { text: "No subscription", tone: "warn" as const };
  }
  return (
    SUBSCRIPTION_LABELS[status] ?? {
      text: status.replace(/_/g, " "),
      tone: "warn" as const,
    }
  );
});

// Kept in step with the copy in CloudPage.vue deliberately: two account
// surfaces offering different recovery paths for the same Stripe status is
// worse than either being wrong on its own. `paused` belongs here because the
// subscription still exists, so Checkout mints a second one instead of
// resuming it.
const PORTAL_ONLY_STATUSES = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

const canStartCheckout = computed(() => {
  if (subscription.value?.active) return false;
  const status = subscription.value?.status ?? null;
  return !status || !PORTAL_ONLY_STATUSES.has(status);
});

const canManageBilling = computed(
  () =>
    Boolean(subscription.value?.active) || Boolean(subscription.value?.status),
);

// Derived from the slug rather than the stored public_url. That column holds a
// vault.autovault.dev string and nothing routes that host; the address this
// namespace answers on is the /v/<slug>/ path.
const namespaceHost = computed(() => {
  const current = vault.value;
  if (!current) return null;
  return `autovault.dev/v/${current.slug}/`;
});

// Guards against writing to these refs after this tab's content unmounts.
// Clerk tears this subtree down the instant the popover navigates to a
// different custom page or closes, and a slow response landing after that
// would otherwise still flip these refs -- pointless (nothing left to render
// to) rather than harmful, but the same discipline CloudPage.vue applies to
// its own request races, so it is applied here too.
let componentActive = true;
onBeforeUnmount(() => {
  componentActive = false;
});

// This is the only fetch this file owns, and it is safe against the P1 this
// repo already paid for (see ClerkAuthControls.vue's comment on the
// UserProfilePage that renders this component) because this whole component
// -- including this onMounted -- only ever gets created once Clerk actually
// routes its popover to the "AutoVault cloud" custom page. Verified in the
// browser before writing this: with the UserButton popover open but this
// page not yet selected, `.clerk-profile-page` is absent from the DOM
// entirely; it only appears once "Cloud namespace" is clicked. ClerkAuthControls
// itself -- mounted on every page of the site -- never calls this.
onMounted(load);

async function load() {
  loadState.value = "loading";
  try {
    const headers = await authHeaders(
      { accept: "application/json" },
      { required: true, fresh: true },
    );
    const response = await fetch("/api/me", {
      credentials: "include",
      headers,
    });
    if (!componentActive) return;
    // A non-OK /api/me means "could not find out", not "no vault" -- see
    // commit 2a81d91 (this repo already paid for the demoted-subscriber
    // version of that confusion once). Fall to the error state instead of
    // rendering an empty-namespace message off a guess.
    if (!response.ok) throw new Error(`/api/me responded ${response.status}`);
    const payload = (await response.json()) as MePayload;
    if (!componentActive) return;
    subscription.value = payload.subscription ?? null;
    vault.value = payload.vault ?? null;
    // Device count is explicitly optional (see loadActiveDeviceCount's own
    // comment) -- flip to ready off /api/me alone and let the count arrive
    // independently, so a slow or stalled /api/vaults/current/devices cannot
    // hold the whole tab on "Loading your cloud status…" behind data it
    // already has.
    loadState.value = "ready";
    if (payload.vault) {
      void loadActiveDeviceCount().then((count) => {
        if (!componentActive) return;
        activeDeviceCount.value = count;
      });
    }
  } catch (error) {
    if (!componentActive) return;
    loadState.value = "error";
  }
}

// Same endpoint and header shape as CloudPage.vue's own loadDevices -- no new
// endpoint added for this. Failure here is quiet (returns null, hides the
// count) rather than failing the whole tab: a machine count is a nice-to-have
// on top of an otherwise-successful /api/me load, not load-bearing for it.
async function loadActiveDeviceCount(): Promise<number | null> {
  try {
    const headers = await authHeaders(
      { accept: "application/json" },
      { required: true, fresh: false },
    );
    const response = await fetch("/api/vaults/current/devices", {
      credentials: "include",
      headers,
    });
    if (!componentActive || !response.ok) return null;
    const payload = (await response.json()) as { devices?: SyncDevice[] };
    return (payload.devices ?? []).filter(
      (device) => device.status === "active",
    ).length;
  } catch {
    return null;
  }
}

// Identical request shape to CloudPage.vue's openBillingPortal (headers,
// body, success/failure handling). Kept local to this component rather than
// shared: this tab and CloudPage.vue have no parent/child relationship to
// share a request lock through, and inventing a cross-surface store for it is
// out of scope here -- see ClerkAuthControls.vue for why that boundary is
// deliberate.
async function openBillingPortal() {
  if (billingBusy.value) return;
  billingBusy.value = true;
  billingNotice.value = null;
  try {
    const headers = await authHeaders(
      {
        "content-type": "application/json",
        accept: "application/json",
      },
      { required: true, fresh: true },
    );
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ return_to: "/cloud#launch-path" }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!response.ok || !payload.url) {
      billingNotice.value =
        payload.error ||
        "Couldn't open billing just now. Try again in a moment.";
      return;
    }
    window.location.assign(payload.url);
  } catch (error) {
    billingNotice.value = isClerkApiAuthError(error)
      ? clerkAuthRecoveryMessage(error)
      : "Couldn't reach the server. Try again in a moment.";
  } finally {
    billingBusy.value = false;
  }
}
</script>

<template>
  <div class="clerk-profile-page">
    <p class="clerk-profile-kicker">Hosted namespace</p>
    <h2>AutoVault cloud</h2>

    <p v-if="loadState === 'loading'">Loading your cloud status…</p>

    <template v-else-if="loadState === 'error'">
      <p>
        Couldn't load your cloud status right now. Account identity and security
        stay in Clerk regardless.
      </p>
      <div class="clerk-profile-actions">
        <a class="clerk-profile-action" :href="clerkBrand.cloudPath"
          >Open dashboard</a
        >
        <a class="clerk-profile-action" :href="clerkBrand.docsPath">Docs</a>
      </div>
    </template>

    <template v-else-if="!vault">
      <p>
        Manage your reserved namespace from the cloud dashboard. Account
        identity and security stay in Clerk.
      </p>
      <div class="clerk-profile-actions">
        <a class="clerk-profile-action" :href="clerkBrand.cloudPath"
          >Open cloud dashboard</a
        >
      </div>
    </template>

    <template v-else>
      <p class="clerk-profile-slug">{{ namespaceHost }}</p>
      <ul class="clerk-profile-meta">
        <li>
          <span
            class="clerk-profile-pill"
            :class="`is-${subscriptionState.tone}`"
          >
            <span class="clerk-profile-dot" aria-hidden="true" />
            {{ subscriptionState.text }}
          </span>
        </li>
        <li v-if="activeDeviceCount !== null">
          {{ activeDeviceCount }}
          {{ activeDeviceCount === 1 ? "machine" : "machines" }} linked
        </li>
      </ul>
      <p v-if="billingNotice" class="clerk-profile-notice">
        {{ billingNotice }}
      </p>
      <div class="clerk-profile-actions">
        <a class="clerk-profile-action" :href="clerkBrand.cloudPath"
          >Open dashboard</a
        >
        <a
          v-if="canStartCheckout"
          class="clerk-profile-action"
          :href="clerkBrand.cloudPath"
          >Start subscription</a
        >
        <button
          v-if="canManageBilling"
          type="button"
          class="clerk-profile-action"
          :disabled="billingBusy"
          @click="openBillingPortal"
        >
          Manage billing
        </button>
        <a class="clerk-profile-action" :href="clerkBrand.docsPath">Docs</a>
      </div>
    </template>
  </div>
</template>
