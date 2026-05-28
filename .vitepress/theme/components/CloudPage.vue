<template>
  <section class="cloud-page cloud-dashboard">
    <div class="cloud-dashboard-head">
      <div>
        <div class="eyebrow"><span class="dash" /> Hosted vault</div>
        <h1>Your AutoVault, hosted.</h1>
        <p class="lede">{{ heroLede }}</p>
      </div>
      <div class="cloud-status-strip" aria-label="Hosted vault status">
        <div v-for="item in statusStrip" :key="item.label" class="cloud-status-pill" :class="item.state">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </div>

    <div class="cloud-layout" :class="vault ? 'has-vault' : 'pre-vault'">
      <template v-if="!vault">
        <main class="cloud-main">
          <HostedVaultFunnel entry="deploy" @state-change="syncCloudState" />
        </main>

        <aside class="cloud-side">
          <section class="cloud-panel cloud-preview-panel">
            <div class="cloud-panel-head compact">
              <div>
                <div class="mono-label">what subscribing gets you</div>
                <h2>Reserve your AutoVault namespace</h2>
              </div>
            </div>
            <ul class="cloud-preview-list">
              <li>
                <strong>A stable hosted URL</strong>
                <span>Reserve a paid hosted AutoVault namespace at <code>{{ hostedEndpoint }}</code>.</span>
              </li>
              <li>
                <strong>A tenant row in D1</strong>
                <span>Your team gets its own reserved namespace, ready when hosted sync ships.</span>
              </li>
              <li>
                <strong>Starter-skill drafts</strong>
                <span>Queue starter skills now; they attach to your vault and import once hosted sync arrives.</span>
              </li>
            </ul>
          </section>
        </aside>
      </template>

      <template v-else>
        <main class="cloud-main">
          <section class="cloud-panel cloud-vault-panel">
            <div class="cloud-panel-head">
              <div>
                <div class="mono-label">vault namespace</div>
                <h2>{{ vault.slug }}</h2>
              </div>
              <span class="cloud-chip reserved">reserved</span>
            </div>
            <div class="cloud-endpoint">
              <span>{{ hostedEndpoint }}</span>
              <button type="button" @click="copyEndpoint">{{ endpointCopied ? "Copied" : "Copy" }}</button>
            </div>
          </section>

          <section class="cloud-grid">
            <article class="cloud-mini-panel">
              <div class="cloud-mini-top">
                <span class="mono-label">starter skills</span>
                <span class="cloud-chip pending">{{ queuedSkillNames.length }} queued</span>
              </div>
              <h3>Queued starter skills</h3>
              <p>Toggle starter skills to attach drafts to your vault row. They import once hosted sync ships.</p>
              <div class="cloud-skill-list">
                <button
                  v-for="skill in starterSkills"
                  :key="skill.name"
                  type="button"
                  :class="{ queued: queuedSkillNames.includes(skill.name) }"
                  @click="toggleSkill(skill.name)"
                >
                  <span>{{ queuedSkillNames.includes(skill.name) ? "queued" : "queue" }}</span>
                  <strong>{{ skill.name }}</strong>
                </button>
              </div>
            </article>

            <article class="cloud-mini-panel">
              <div class="cloud-mini-top">
                <span class="mono-label">drafts in this vault</span>
                <span class="cloud-chip pending">coming soon</span>
              </div>
              <h3>Pending imports</h3>
              <p>Drafts attached through the funnel land here and import when hosted sync ships. Until then your local CLI stays the source of truth for signing and serving.</p>
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
            <button class="cloud-copy-command" type="button" @click="copyCommands">{{ commandsCopied ? "Copied" : "Copy commands" }}</button>
          </section>
        </aside>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import HostedVaultFunnel from "./HostedVaultFunnel.vue";
import { skills } from "../data/skills";
import { copyText as copyToClipboard } from "../utils/clipboard";
import { useClerkApiAuth } from "../utils/clerkApi";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";

type CloudUser = { id: string; email?: string | null; name?: string | null; avatar_url?: string | null };
type CloudSubscription = { active: boolean; status?: string | null } | null;
type CloudVault = { id?: string; slug: string; status: string; public_url: string; provisioned_at?: string | null } | null;
type CloudState = { user: CloudUser | null; subscription: CloudSubscription; vault: CloudVault };
type CloudStatePayload = { user: CloudUser | null; subscription?: CloudSubscription; vault?: CloudVault };
type StatusState = "done" | "ready" | "pending";

const cloudState = ref<CloudState>({ user: null, subscription: null, vault: null });
const endpointCopied = ref(false);
const commandsCopied = ref(false);
const queuedSkillNames = ref<string[]>(skills.filter((skill) => skill.featured).slice(0, 2).map((skill) => skill.name));
const { authHeaders, isClerkLoaded, isClerkSignedIn, clerkUserLabel, clerkUserSlugSeed } = useClerkApiAuth();
let cloudStateRequestSeq = 0;

const starterSkills = computed(() => skills.filter((skill) => skill.featured).slice(0, 4));
const user = computed(() => cloudState.value.user);
const subscription = computed(() => cloudState.value.subscription);
const vault = computed(() => cloudState.value.vault);
const signedIn = computed(() => Boolean(user.value) || isClerkSignedIn.value);
const paid = computed(() => Boolean(subscription.value?.active));
const plannedSlug = computed(() => slugify(user.value?.email || user.value?.name || clerkUserSlugSeed.value || "your-team"));
const hostedEndpoint = computed(() => vault.value?.public_url ?? `https://vault.autovault.dev/${plannedSlug.value}`);

const heroLede = computed(() => {
  if (vault.value) {
    return `${hostedEndpoint.value} is yours. Keep signing and serving from the local CLI; hosted sync ships next.`;
  }
  return "Reserve your AutoVault namespace and queue starter skills. Hosted sync ships next; signing and serving stay on the local CLI today.";
});

const statusStrip = computed<Array<{ label: string; value: string; state: StatusState }>>(() => [
  {
    label: "Account",
    value: user.value?.email || user.value?.name || (isClerkSignedIn.value ? clerkUserLabel.value || "signed in" : "anonymous"),
    state: signedIn.value ? "done" : "pending"
  },
  {
    label: "Billing",
    value: paid.value ? subscription.value?.status || "active" : signedIn.value ? "checkout needed" : "sign in first",
    state: paid.value ? "done" : signedIn.value ? "ready" : "pending"
  },
  {
    label: "Namespace",
    value: vault.value ? "reserved" : paid.value ? "ready to reserve" : "planned",
    state: vault.value ? "done" : paid.value ? "ready" : "pending"
  }
]);

const commandBlock = computed(() => [
  AUTOVAULT_INSTALL_COMMAND,
  ". \"$HOME/.autovault/env\"",
  "autovault skill list",
  "",
  `# Reserved namespace: ${hostedEndpoint.value}`,
  "# Cloud sync is not enabled yet.",
  "# Keep signing and serving skills from the local AutoVault CLI."
].join("\n"));

onMounted(() => {
  void loadCloudState();
});

watch([isClerkLoaded, isClerkSignedIn], ([loaded]) => {
  if (!loaded) return;
  void loadCloudState();
});

async function loadCloudState() {
  const requestSeq = ++cloudStateRequestSeq;
  try {
    const response = await fetch("/api/me", { credentials: "include", headers: await authHeaders({ accept: "application/json" }) });
    if (requestSeq !== cloudStateRequestSeq) return;
    if (!response.ok) {
      cloudState.value = { user: null, subscription: null, vault: null };
      return;
    }
    cloudState.value = normalizeCloudState(await response.json() as CloudStatePayload);
  } catch {
    if (requestSeq !== cloudStateRequestSeq) return;
    cloudState.value = { user: null, subscription: null, vault: null };
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

async function copyEndpoint() {
  await copyToClipboard(hostedEndpoint.value);
  endpointCopied.value = true;
  setTimeout(() => {
    endpointCopied.value = false;
  }, 1600);
}

async function copyCommands() {
  await copyToClipboard(commandBlock.value);
  commandsCopied.value = true;
  setTimeout(() => {
    commandsCopied.value = false;
  }, 1600);
}

function toggleSkill(name: string) {
  queuedSkillNames.value = queuedSkillNames.value.includes(name)
    ? queuedSkillNames.value.filter((skillName) => skillName !== name)
    : [...queuedSkillNames.value, name];
}

function slugify(value: string) {
  const slug = value.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "your-team";
}
</script>
