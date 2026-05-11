<template>
  <section class="cloud-page cloud-dashboard">
    <div class="cloud-dashboard-head">
      <div>
        <div class="eyebrow"><span class="dash" /> Internal cloud prototype</div>
        <h1>Managed vault dashboard.</h1>
        <p class="lede">
          Reserve a paid hosted AutoVault namespace and inspect the future managed-vault surface. Runtime provisioning and cloud sync are not enabled yet.
        </p>
      </div>
      <div class="cloud-status-strip" aria-label="Cloud account status">
        <div v-for="item in statusStrip" :key="item.label" class="cloud-status-pill" :class="item.state">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </div>

    <section class="cloud-sim-strip" aria-label="Prototype simulation controls">
      <div>
        <div class="mono-label">prototype mode</div>
        <p>Use real account data by default, or preview internal states without writing to Clerk, Stripe, D1, or a managed runtime.</p>
      </div>
      <div class="cloud-sim-controls" role="radiogroup" aria-label="Prototype simulation mode">
        <button
          v-for="mode in simulationModes"
          :key="mode.id"
          type="button"
          role="radio"
          :aria-checked="simulationMode === mode.id"
          :class="{ active: simulationMode === mode.id }"
          @click="simulationMode = mode.id"
        >
          <span>{{ mode.label }}</span>
          <small>{{ mode.detail }}</small>
        </button>
      </div>
    </section>

    <div class="cloud-layout">
      <main class="cloud-main">
        <section class="cloud-panel cloud-vault-panel">
          <div class="cloud-panel-head">
            <div>
              <div class="mono-label">vault namespace</div>
              <h2>{{ vaultTitle }}</h2>
            </div>
            <span class="cloud-chip" :class="vault ? 'reserved' : 'pending'">{{ vault ? "reserved" : "planned" }}</span>
          </div>
          <div class="cloud-endpoint">
            <span>{{ hostedEndpoint }}</span>
            <button type="button" @click="copyEndpoint">Copy</button>
          </div>
          <div class="cloud-vault-meta">
            <div>
              <span>Runtime</span>
              <strong>{{ runtimeState }}</strong>
            </div>
            <div>
              <span>Tenant storage</span>
              <strong>{{ vault ? "reserved row in D1" : "not created" }}</strong>
            </div>
            <div>
              <span>Cloud sync</span>
              <strong>not enabled yet</strong>
            </div>
          </div>
        </section>

        <section class="cloud-panel">
          <div class="cloud-panel-head compact">
            <div>
              <div class="mono-label">provisioning timeline</div>
              <h2>Honest runtime state</h2>
            </div>
            <button class="cloud-link-btn" type="button" :disabled="loading" @click="loadCloudState">
              {{ loading ? "Refreshing..." : "Refresh state" }}
            </button>
          </div>
          <div class="cloud-timeline">
            <div v-for="step in lifecycle" :key="step.label" class="cloud-timeline-row" :class="step.state">
              <span class="cloud-timeline-dot" />
              <div>
                <strong>{{ step.label }}</strong>
                <p>{{ step.detail }}</p>
              </div>
              <span>{{ step.state }}</span>
            </div>
          </div>
        </section>

        <section class="cloud-grid">
          <article class="cloud-mini-panel">
            <div class="cloud-mini-top">
              <span class="mono-label">starter skills</span>
              <span class="cloud-chip pending">{{ queuedSkillNames.length }} queued</span>
            </div>
            <h3>Suggested imports</h3>
            <p>Queue starter skills for the future managed install flow. This is client-side prototype state.</p>
            <div class="cloud-skill-list">
              <button v-for="skill in starterSkills" :key="skill.name" type="button" :class="{ queued: queuedSkillNames.includes(skill.name) }" @click="toggleSkill(skill.name)">
                <span>{{ queuedSkillNames.includes(skill.name) ? "queued" : "queue" }}</span>
                <strong>{{ skill.name }}</strong>
              </button>
            </div>
          </article>

          <article class="cloud-mini-panel">
            <div class="cloud-mini-top">
              <span class="mono-label">pending imports</span>
              <span class="cloud-chip" :class="pendingImportSaved ? 'reserved' : 'pending'">{{ pendingImportSaved ? "saved" : "pending" }}</span>
            </div>
            <h3>Draft holding area</h3>
            <p>{{ pendingImportCopy }}</p>
            <button class="cloud-panel-action" type="button" :disabled="!vault" @click="pendingImportSaved = true">
              {{ pendingImportSaved ? "Import marked saved" : "Simulate pending import" }}
            </button>
          </article>

          <article class="cloud-mini-panel">
            <div class="cloud-mini-top">
              <span class="mono-label">mcp endpoint</span>
              <span class="cloud-chip pending">coming soon</span>
            </div>
            <h3>Hosted MCP surface</h3>
            <p>The endpoint preview is copyable for planning, but it returns pending runtime until managed provisioning exists.</p>
            <div class="cloud-endpoint compact">
              <span>{{ mcpEndpoint }}</span>
              <button type="button" @click="copyText(mcpEndpoint)">Copy</button>
            </div>
            <button class="cloud-panel-action" type="button" @click="mcpPinged = true">
              {{ mcpPinged ? "Preview ping recorded" : "Simulate MCP ping" }}
            </button>
          </article>

          <article class="cloud-mini-panel">
            <div class="cloud-mini-top">
              <span class="mono-label">audit log</span>
              <span class="cloud-chip pending">prototype</span>
            </div>
            <h3>Operational timeline</h3>
            <div class="cloud-audit-list">
              <div v-for="event in auditEvents" :key="event.label">
                <span>{{ event.time }}</span>
                <strong>{{ event.label }}</strong>
              </div>
            </div>
          </article>
        </section>
      </main>

      <aside class="cloud-side">
        <HostedVaultFunnel entry="deploy" @state-change="syncCloudState" />

        <section class="cloud-panel cloud-command-panel">
          <div class="cloud-panel-head compact">
            <div>
              <div class="mono-label">local handoff</div>
              <h2>Copy-safe CLI handoff</h2>
            </div>
          </div>
          <pre><code>{{ commandBlock }}</code></pre>
          <button class="cloud-copy-command" type="button" @click="copyCommands">{{ copied ? "Copied" : "Copy commands" }}</button>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import HostedVaultFunnel from "./HostedVaultFunnel.vue";
import { skills } from "../data/skills";
import { copyText as copyToClipboard } from "../utils/clipboard";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";

type CloudUser = { id: string; email?: string | null; name?: string | null; avatar_url?: string | null };
type CloudSubscription = { active: boolean; status?: string | null } | null;
type CloudVault = { id?: string; slug: string; status: string; public_url: string; provisioned_at?: string | null } | null;
type CloudState = { user: CloudUser | null; subscription: CloudSubscription; vault: CloudVault };
type CloudStatePayload = { user: CloudUser | null; subscription?: CloudSubscription; vault?: CloudVault };
type StatusState = "done" | "ready" | "pending";
type SimulationMode = "live" | "anonymous" | "unpaid" | "paid" | "reserved";

const loading = ref(false);
const cloudState = ref<CloudState>({ user: null, subscription: null, vault: null });
const copied = ref(false);
const simulationMode = ref<SimulationMode>("live");
const queuedSkillNames = ref<string[]>(skills.filter((skill) => skill.featured).slice(0, 2).map((skill) => skill.name));
const pendingImportSaved = ref(false);
const mcpPinged = ref(false);

const simulationModes: Array<{ id: SimulationMode; label: string; detail: string }> = [
  { id: "live", label: "Live", detail: "/api/me" },
  { id: "anonymous", label: "Anon", detail: "signed out" },
  { id: "unpaid", label: "Unpaid", detail: "checkout" },
  { id: "paid", label: "Paid", detail: "reserve" },
  { id: "reserved", label: "Reserved", detail: "dashboard" }
];

const starterSkills = computed(() => skills.filter((skill) => skill.featured).slice(0, 4));
const dashboardState = computed(() => simulationMode.value === "live" ? cloudState.value : simulatedState(simulationMode.value));
const user = computed(() => dashboardState.value.user);
const subscription = computed(() => dashboardState.value.subscription);
const vault = computed(() => dashboardState.value.vault);
const signedIn = computed(() => Boolean(user.value));
const paid = computed(() => Boolean(subscription.value?.active));
const plannedSlug = computed(() => slugify(user.value?.email || user.value?.name || "your-team"));
const hostedEndpoint = computed(() => vault.value?.public_url ?? `https://vault.autovault.dev/${plannedSlug.value}`);
const mcpEndpoint = computed(() => `${hostedEndpoint.value}/mcp`);
const vaultTitle = computed(() => vault.value ? vault.value.slug : `${plannedSlug.value} preview`);
const runtimeState = computed(() => vault.value ? "pending provisioning" : "not reserved");
const pendingImportCopy = computed(() => {
  if (!vault.value) return "Draft storage unlocks after namespace reservation.";
  if (pendingImportSaved.value) return "Simulated pending imports are attached to the reserved vault row.";
  return "Pending imports can be attached to the reserved vault row.";
});

const statusStrip = computed(() => [
  { label: "Account", value: user.value?.email || user.value?.name || "anonymous", state: signedIn.value ? "done" : "pending" },
  { label: "Billing", value: paid.value ? subscription.value?.status || "active" : signedIn.value ? "checkout needed" : "sign in first", state: paid.value ? "done" : signedIn.value ? "ready" : "pending" },
  { label: "Namespace", value: vault.value ? "reserved" : paid.value ? "ready to reserve" : "planned", state: vault.value ? "done" : paid.value ? "ready" : "pending" },
  { label: "Runtime", value: runtimeState.value, state: "pending" }
]);

const lifecycle = computed<Array<{ label: string; detail: string; state: StatusState }>>(() => [
  {
    label: "Clerk account",
    detail: signedIn.value ? user.value?.email || user.value?.name || "Signed in" : "Create or sign in to an AutoVault account.",
    state: signedIn.value ? "done" : "ready"
  },
  {
    label: "Stripe subscription",
    detail: paid.value ? `Webhook state: ${subscription.value?.status || "active"}` : "Open test checkout after signing in.",
    state: paid.value ? "done" : signedIn.value ? "ready" : "pending"
  },
  {
    label: "D1 namespace row",
    detail: vault.value ? `${hostedEndpoint.value} is reserved.` : "Reserve the namespace after billing is active.",
    state: vault.value ? "done" : paid.value ? "ready" : "pending"
  },
  {
    label: "Managed vault runtime",
    detail: "Prototype only: per-tenant runtime provisioning is still pending.",
    state: "pending"
  },
  {
    label: "Cloud sync",
    detail: "Cloud sync is not enabled yet; local CLI remains the source of truth.",
    state: "pending"
  }
]);

const auditEvents = computed(() => [
  { time: "now", label: simulationMode.value === "live" ? "Loaded live /api/me state" : `Previewed ${simulationMode.value} state` },
  ...(signedIn.value ? [{ time: "-1m", label: "Clerk account mapped to AutoVault user" }] : []),
  ...(paid.value ? [{ time: "-2m", label: "Stripe webhook state active" }] : []),
  ...(vault.value ? [{ time: "-3m", label: "D1 namespace row reserved" }] : []),
  ...(queuedSkillNames.value.length ? [{ time: "-4m", label: `${queuedSkillNames.value.length} starter skills queued` }] : []),
  ...(pendingImportSaved.value ? [{ time: "-5m", label: "Pending import save simulated" }] : []),
  ...(mcpPinged.value ? [{ time: "-6m", label: "MCP ping preview returned pending runtime" }] : [])
]);

const commandBlock = computed(() => [
  AUTOVAULT_INSTALL_COMMAND,
  ". \"$HOME/.autovault/env\"",
  "autovault skill list",
  "",
  `# Reserved namespace preview: ${hostedEndpoint.value}`,
  "# Cloud sync is not enabled yet.",
  "# Keep signing and serving skills from the local AutoVault CLI."
].join("\n"));

onMounted(() => {
  void loadCloudState();
});

async function loadCloudState() {
  loading.value = true;
  try {
    const response = await fetch("/api/me", { credentials: "include", headers: await authHeaders({ accept: "application/json" }) });
    if (!response.ok) {
      cloudState.value = { user: null, subscription: null, vault: null };
      return;
    }
    cloudState.value = normalizeCloudState(await response.json() as CloudStatePayload);
  } catch {
    cloudState.value = { user: null, subscription: null, vault: null };
  } finally {
    loading.value = false;
  }
}

function syncCloudState(payload: CloudStatePayload) {
  cloudState.value = normalizeCloudState(payload);
}

function normalizeCloudState(payload: CloudStatePayload): CloudState {
  return {
    user: payload.user ?? null,
    subscription: payload.subscription ?? null,
    vault: payload.vault ?? null
  };
}

function simulatedState(mode: SimulationMode): CloudState {
  if (mode === "anonymous") return { user: null, subscription: null, vault: null };

  const fakeUser = { id: "clerk_internal", email: "internal@autovault.dev", name: "Internal Tester", avatar_url: null };
  if (mode === "unpaid") return { user: fakeUser, subscription: { active: false, status: "incomplete" }, vault: null };
  if (mode === "paid") return { user: fakeUser, subscription: { active: true, status: "active" }, vault: null };

  return {
    user: fakeUser,
    subscription: { active: true, status: "active" },
    vault: {
      id: "vault_internal_preview",
      slug: "internal-preview",
      status: "reserved",
      public_url: "https://vault.autovault.dev/internal-preview",
      provisioned_at: new Date(0).toISOString()
    }
  };
}

async function copyEndpoint() {
  await copyText(hostedEndpoint.value);
}

async function copyCommands() {
  await copyText(commandBlock.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1600);
}

function toggleSkill(name: string) {
  queuedSkillNames.value = queuedSkillNames.value.includes(name)
    ? queuedSkillNames.value.filter((skillName) => skillName !== name)
    : [...queuedSkillNames.value, name];
}

async function copyText(text: string) {
  await copyToClipboard(text);
}

function slugify(value: string) {
  const slug = value.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "your-team";
}

async function authHeaders(headers: Record<string, string>) {
  const token = await clerkSessionToken();
  return token ? { ...headers, authorization: `Bearer ${token}` } : headers;
}

async function clerkSessionToken() {
  if (typeof window === "undefined") return null;
  const clerk = (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk;
  return await clerk?.session?.getToken?.() ?? null;
}
</script>
