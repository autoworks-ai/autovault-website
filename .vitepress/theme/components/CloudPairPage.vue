<template>
  <section class="cp">
    <header class="cp-head">
      <div class="cp-kicker">AutoVault Cloud</div>
      <h1 class="cp-title">Confirm this machine</h1>
      <p class="cp-lede">
        A machine running <code>autovault link</code> is asking to join your vault.
        Check that what it printed matches what is below.
      </p>
    </header>

    <!-- Signed out. /cloud is the sign-in surface; sending them there with a
         return path is better than mounting a second Clerk widget here. -->
    <div v-if="!signedIn" class="cp-card cp-card--quiet">
      <p class="cp-msg">Sign in to confirm a machine.</p>
      <!-- Modal, not a navigation, AND an explicit redirect back to this exact
           URL. The code arrives in the query string, and clerk.ts sets a global
           signInFallbackRedirectUrl of /cloud, so without forceRedirectUrl a
           successful sign-in lands the owner on the dashboard with the code
           thrown away -- stranding precisely the signed-out visitor this flow is
           for, since `autovault link` sends them straight here. -->
      <SignInButton
        v-if="clerkAuthEnabled"
        mode="modal"
        :force-redirect-url="pairUrl"
        :sign-up-force-redirect-url="pairUrl"
      >
        <button class="cp-btn cp-btn--primary">Sign in</button>
      </SignInButton>
      <a v-else class="cp-btn cp-btn--primary" :href="cloudPath">Sign in</a>
    </div>

    <div v-else-if="outcome === 'confirmed'" class="cp-card cp-card--ok">
      <div class="cp-outcome">Machine confirmed</div>
      <p class="cp-msg">
        It is linked to <strong>{{ confirmedSlug }}</strong>. Your terminal should
        pick that up within a few seconds — you can close this tab.
      </p>
      <a class="cp-btn" :href="cloudPath">Open dashboard</a>
    </div>

    <div v-else-if="outcome === 'denied'" class="cp-card cp-card--quiet">
      <div class="cp-outcome">Refused</div>
      <!-- Two different truths, and saying the wrong one is a security problem
           rather than a wording problem. Refusing a pairing does not revoke a
           key that is ALREADY enrolled, so telling that owner "it never had
           access" would leave a machine holding their catalog while the page
           says it is handled. -->
      <p v-if="deniedWasActive" class="cp-msg">
        This code was refused, but that key is <strong>already a linked machine</strong>
        on your namespace — refusing a code does not remove access it already has.
        If it is not yours, revoke it in your console now.
      </p>
      <p v-else class="cp-msg">
        That machine was not linked. If it was not yours, nothing else is needed —
        it never had access.
      </p>
      <a v-if="deniedWasActive" class="cp-btn cp-btn--primary" :href="cloudPath">
        Revoke it in your console
      </a>
    </div>

    <div v-else class="cp-card">
      <label class="cp-field">
        <span class="cp-label">Code from your terminal</span>
        <input
          v-model="code"
          class="cp-input"
          spellcheck="false"
          autocapitalize="characters"
          autocomplete="off"
          placeholder="XXXX-XXXX"
          @keyup.enter="lookup"
        />
      </label>

      <p v-if="error" class="cp-error">{{ error }}</p>

      <template v-if="pairing">
        <div class="cp-verify">
          <div class="cp-verify-row">
            <span class="cp-verify-label">Key fingerprint</span>
            <code class="cp-fingerprint">ed25519 {{ pairing.fingerprint }}</code>
          </div>
          <div v-if="pairing.hostname" class="cp-verify-row">
            <span class="cp-verify-label">Machine</span>
            <span class="cp-verify-value">{{ pairing.hostname }}</span>
          </div>
          <div class="cp-verify-row">
            <span class="cp-verify-label">Joins</span>
            <span class="cp-verify-value">{{ pairing.vault?.slug ?? "no namespace yet" }}</span>
          </div>
        </div>

        <p v-if="pairing.previously_revoked" class="cp-warn">
          You revoked this key before. Confirming re-admits the same machine.
        </p>

        <!-- The whole security property. `?code=` is prefilled from a link, so
             the code alone proves only that someone opened a URL. The
             fingerprint is printed by the terminal at the same moment and is
             not in the link, so matching it is what makes this a confirmation
             rather than a click. -->
        <label class="cp-check">
          <input v-model="fingerprintMatches" type="checkbox" />
          <span>This fingerprint matches the one my terminal is showing.</span>
        </label>

        <div class="cp-actions">
          <button
            class="cp-btn cp-btn--primary"
            :disabled="!fingerprintMatches || busy"
            @click="decide('confirm')"
          >
            {{ busy ? "Working…" : "Confirm this machine" }}
          </button>
          <button class="cp-btn cp-btn--ghost" :disabled="busy" @click="decide('deny')">
            Not mine — refuse
          </button>
        </div>
      </template>

      <div v-else class="cp-actions">
        <button class="cp-btn cp-btn--primary" :disabled="busy || !code.trim()" @click="lookup">
          {{ busy ? "Checking…" : "Look up code" }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { SignInButton } from "@clerk/vue";
import { useClerkApiAuth } from "../utils/clerkApi";
import { clerkBrand } from "../clerk";

type Pairing = {
  user_code: string;
  fingerprint: string;
  hostname: string | null;
  expires_at: string;
  state: string;
  previously_revoked: boolean;
  already_active?: boolean;
  vault: { slug: string } | null;
};

const { authHeaders, clerkAuthEnabled, isClerkSignedIn } = useClerkApiAuth();

const code = ref("");
const pairing = ref<Pairing | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);
const fingerprintMatches = ref(false);
const outcome = ref<"confirmed" | "denied" | null>(null);
const confirmedSlug = ref("");

const cloudPath = clerkBrand.cloudPath;
const signedIn = computed(() => !clerkAuthEnabled || isClerkSignedIn.value);
// Only the code the CLI put in the URL is looked up automatically. Watching
// `code` itself would fire a request on every keystroke, because it is
// v-model'd to the field below.
const urlCode = ref("");
// Where Clerk must return after sign-in: this page, with the code still on it.
// Filled on mount rather than computed, so it never runs during SSR.
const pairUrl = ref("/cloud/pair");
const deniedWasActive = ref(false);
let autoLookupDone = false;

onMounted(() => {
  urlCode.value = new URLSearchParams(window.location.search).get("code") ?? "";
  if (urlCode.value) code.value = urlCode.value;
  pairUrl.value = `${window.location.pathname}${window.location.search}`;
});

// Look it up once auth settles, not once on mount. Clerk resolves after mount
// on a cold load, so a mount-time check reads "signed out" for a visitor who is
// signed in, and would leave the code sitting behind a sign-in prompt they do
// not need. Same ordering trap the dashboard's boot veil hit.
//
// Read-only, and it stops there: it never confirms. A prefilled code is a
// display convenience, never consent.
watch(
  [signedIn, urlCode],
  ([isIn, value]) => {
    if (autoLookupDone || !isIn || !value) return;
    autoLookupDone = true;
    void lookup();
  },
  { immediate: true }
);

// Any edit to the code field retires what is on screen. Without this the page
// can show code A's fingerprint above code B's text, and a ticked checkbox that
// refers to neither.
watch(code, () => {
  if (!pairing.value) return;
  pairing.value = null;
  fingerprintMatches.value = false;
  error.value = null;
});

async function request(path: string, init?: RequestInit) {
  const headers = await authHeaders(
    { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
    { required: clerkAuthEnabled, fresh: false }
  );
  return fetch(path, { credentials: "include", headers, ...init });
}

async function lookup() {
  const value = code.value.trim();
  if (!value || busy.value) return;
  busy.value = true;
  error.value = null;
  pairing.value = null;
  fingerprintMatches.value = false;
  try {
    const response = await request(`/api/devices/pairings/${encodeURIComponent(value)}`);
    const payload = (await response.json()) as Pairing & { error?: string };
    // The field can change while this is in flight -- a slow automatic lookup
    // of the linked code, and the owner pastes a different one meanwhile. The
    // watcher below cannot catch that, because `pairing` is still null for the
    // whole request and it has nothing to retire yet. Without this guard the
    // late response installs code A's fingerprint beside code B's text, and
    // confirming would then act on A. Answers for a code that is no longer in
    // the box are discarded, errors included.
    if (code.value.trim() !== value) return;
    if (!response.ok) {
      error.value = payload.error ?? "That code could not be checked.";
      return;
    }
    if (payload.state !== "pending") {
      error.value = stateMessage(payload.state);
      return;
    }
    pairing.value = payload;
  } catch {
    if (code.value.trim() !== value) return;
    error.value = "Could not reach AutoVault Cloud. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}

async function decide(action: "confirm" | "deny") {
  if (busy.value || !pairing.value) return;
  busy.value = true;
  error.value = null;
  try {
    // Submit the code that was LOOKED UP, never the input's current value. The
    // field stays editable while the fingerprint is on screen, so reading it
    // here would let someone tick "this fingerprint matches", paste a different
    // code, and confirm that one -- approving a machine whose fingerprint was
    // never displayed, which is exactly the property the checkbox exists to
    // provide. The watcher below is the other half: editing the field drops the
    // pairing, so a stale fingerprint can never sit next to a changed code.
    const response = await request(`/api/devices/pairings/${encodeURIComponent(pairing.value.user_code)}`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    const payload = (await response.json()) as { error?: string; slug?: string };
    if (!response.ok) {
      error.value = payload.error ?? "That did not go through.";
      return;
    }
    // Captured before the outcome renders: the copy has to reflect what was
    // true for the key that was just refused.
    deniedWasActive.value = action === "deny" && pairing.value?.already_active === true;
    confirmedSlug.value = payload.slug ?? "";
    outcome.value = action === "confirm" ? "confirmed" : "denied";
  } catch {
    error.value = "Could not reach AutoVault Cloud. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}

function stateMessage(state: string) {
  if (state === "confirmed") return "That code was already confirmed.";
  if (state === "denied") return "That code was already refused.";
  if (state === "expired") return "That code expired. Run autovault link again.";
  return "That pairing code is not valid.";
}
</script>

<style scoped>
.cp {
  max-width: 34rem;
  margin: 0 auto;
  padding: clamp(2rem, 6vw, 4rem) 1.25rem;
}
.cp-kicker {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}
.cp-title {
  margin: 0.4rem 0 0;
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  line-height: 1.15;
}
.cp-lede {
  margin: 0.6rem 0 0;
  color: var(--ink-2);
  line-height: 1.5;
}
.cp-card {
  margin-top: 1.75rem;
  padding: 1.25rem;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  background: var(--panel);
}
.cp-card--quiet { text-align: center; }
.cp-card--ok { border-color: var(--accent); }
.cp-outcome {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 0.4rem;
}
.cp-msg { color: var(--ink-2); line-height: 1.5; margin: 0 0 1rem; }
.cp-field { display: block; }
.cp-label {
  display: block;
  font-size: 0.8rem;
  color: var(--ink-2);
  margin-bottom: 0.35rem;
}
.cp-input {
  width: 100%;
  padding: 0.7rem 0.85rem;
  font: inherit;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 1.15rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: 8px;
}
.cp-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.cp-verify {
  margin-top: 1.1rem;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  overflow: hidden;
}
.cp-verify-row {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--line-2);
}
.cp-verify-row:last-child { border-bottom: 0; }
.cp-verify-label { font-size: 0.8rem; color: var(--ink-2); }
.cp-verify-value { font-size: 0.95rem; }
.cp-fingerprint {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 0.95rem;
  color: var(--accent);
}
.cp-check {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin-top: 1.1rem;
  font-size: 0.9rem;
  line-height: 1.45;
  cursor: pointer;
}
.cp-check input { margin-top: 0.2rem; flex: none; }
.cp-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.25rem; }
.cp-btn {
  appearance: none;
  font: inherit;
  padding: 0.6rem 1.05rem;
  border-radius: 8px;
  border: 1px solid var(--line-2);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.cp-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 600;
}
.cp-btn--ghost { color: var(--ink-2); }
.cp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-error, .cp-warn {
  margin: 0.9rem 0 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  line-height: 1.45;
}
.cp-error { border: 1px solid var(--line-2); color: var(--ink); }
.cp-warn { border: 1px solid var(--accent); color: var(--ink); }
</style>
