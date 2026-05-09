<template>
  <div class="deploy-shell reveal-page">
    <section class="deploy-hero reveal-item">
      <div>
        <div class="eyebrow">
          <span class="dash" />
          Deploy a remote vault
          <span class="pr">PR #11 · merging</span>
        </div>
        <h1>From a local CLI to <span class="ital">a network service</span> in two minutes.</h1>
        <p class="lede">In remote mode, the same vault binary speaks Streamable HTTP MCP with OAuth auth-code + PKCE. Stand it up on a real host so your agents — wherever they run, sandboxed or not — can resolve, verify, and install signed skills without ever touching a local filesystem.</p>
        <div class="hero-meta">
          <div class="m">Transport: <strong>Streamable HTTP MCP</strong></div>
          <div class="m">Auth: <strong>OAuth 2.1 + PKCE</strong></div>
          <div class="m">Storage: <strong>SQLite or Postgres</strong></div>
        </div>
      </div>
      <div class="topology">
        <div class="ttl"><span>Remote topology</span><span class="live"><span class="pulse" />live trace</span></div>
        <svg viewBox="0 0 480 340" aria-label="Remote topology diagram">
          <g>
            <rect x="20" y="40" width="120" height="60" rx="6" class="box-fill-1" />
            <text x="80" y="62" text-anchor="middle" class="ltext">Agent</text>
            <text x="80" y="78" text-anchor="middle" class="label-d">Claude Code</text>
            <text x="80" y="91" text-anchor="middle" class="label-d">Codex · Cursor</text>
          </g>
          <line x1="140" y1="62" x2="200" y2="62" class="lline" marker-end="url(#arrR)" />
          <text x="170" y="55" text-anchor="middle" class="label">HTTPS</text>
          <line x1="200" y1="82" x2="140" y2="82" class="ldash" marker-end="url(#arrL)" />
          <text x="170" y="96" text-anchor="middle" class="label">OAuth</text>
          <rect x="200" y="20" width="170" height="270" rx="8" class="box-fill-2" />
          <text x="285" y="38" text-anchor="middle" class="ltext">autovault-remote</text>
          <rect v-for="route in topoRoutes" :key="route.label" x="216" :y="route.y" width="138" height="38" rx="5" class="box-fill-1" />
          <g v-for="route in topoRoutes" :key="`${route.label}-text`">
            <text x="285" :y="route.y + 15" text-anchor="middle" class="ltext">{{ route.label }}</text>
            <text x="285" :y="route.y + 29" text-anchor="middle" class="label-d">{{ route.desc }}</text>
          </g>
          <line x1="370" y1="155" x2="412" y2="155" class="lline" marker-end="url(#arrR)" />
          <rect x="412" y="120" width="56" height="80" rx="5" class="box-fill-3" />
          <text x="440" y="155" text-anchor="middle" class="ltext">SQLite</text>
          <text x="440" y="170" text-anchor="middle" class="label-d">users</text>
          <text x="440" y="183" text-anchor="middle" class="label-d">tokens</text>
          <defs>
            <marker id="arrR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" class="arrow" /></marker>
            <marker id="arrL" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6 Z" class="arrow" /></marker>
          </defs>
        </svg>
      </div>
    </section>

    <section id="hosts" class="providers-section reveal-item">
      <h2>Pick a host</h2>
      <p class="lede">Self-host the remote MCP service with the documented Docker or Railway paths. Local installs remain the source of truth; remote mode adds OAuth-protected HTTPS access for agents that cannot read your local filesystem.</p>
      <div class="providers">
        <button v-for="provider in providers" :key="provider.id" type="button" :class="['provider', { active: active === provider.id }]" @click="active = provider.id">
          <span class="head">
            <span class="logo" :style="{ background: provider.logoBg, color: provider.logoFg }">{{ provider.short }}</span>
            <span class="name">{{ provider.name }}</span>
            <span class="deploy-time">{{ provider.time }}</span>
          </span>
          <span class="desc">{{ provider.desc }}</span>
          <span class="feat"><span v-for="feature in provider.feat" :key="feature">{{ feature }}</span></span>
          <span class="cta">View walkthrough <span class="arrow">→</span></span>
        </button>
      </div>

      <div class="deploy-detail">
        <div class="head">
          <div class="logo" :style="{ background: activeProvider.logoBg, color: activeProvider.logoFg }">{{ activeProvider.short }}</div>
          <div class="ttl">Deploy to <strong>{{ activeProvider.name }}</strong> · 4 steps · {{ activeProvider.time }}</div>
          <button class="copy-btn" type="button" @click="copyProvider">{{ copied ? "Copied" : "Copy all commands" }}</button>
        </div>
        <div class="body">
          <div class="steps">
            <div v-for="(step, index) in activeProvider.steps" :key="step.title" class="step">
              <div class="num">{{ index + 1 }}</div>
              <div class="body-step">
                <h4>{{ step.title }}</h4>
                <p>{{ step.body }}</p>
                <pre v-if="step.command" class="cmd"><code>{{ step.command }}</code></pre>
              </div>
            </div>
          </div>
          <div class="preview">
            <div class="ttl-prev">After deploy</div>
            <TerminalBlock title="autovault status" :lines="statusLines" />
          </div>
        </div>
      </div>
    </section>

    <section class="env-section reveal-item">
      <h2>Environment</h2>
      <p class="lede">All knobs are env-var driven. The first card is the breaking change in remote mode — Compose now hard-fails if these aren't set, instead of falling back to a known-default password.</p>
      <div class="env-grid">
        <div v-for="group in envGroups" :key="group.title" class="env-card">
          <div class="head">{{ group.title }} <span :class="['req-chip', group.required ? 'req' : 'opt']">{{ group.required ? "required" : "optional" }}</span></div>
          <div v-for="row in group.rows" :key="row.key" class="env-row">
            <div class="k">{{ row.key }}</div>
            <div class="v" v-html="row.value" />
          </div>
        </div>
      </div>
    </section>

    <section class="oauth-section reveal-item">
      <h2>OAuth handshake</h2>
      <p class="lede">Streamable HTTP MCP layered on OAuth 2.1 — auth-code flow with mandatory PKCE, dynamic client registration, refresh rotation, and revoke. Below is the exact sequence the bundled smoke suite walks for every release.</p>
      <div class="oauth-flow">
        <svg viewBox="0 0 620 480" aria-label="OAuth sequence diagram">
          <defs>
            <marker id="oa-r" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" class="arrhead" /></marker>
            <marker id="oa-l" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6 Z" class="arrhead-back" /></marker>
          </defs>
          <g v-for="actor in oauthActors" :key="actor.label">
            <rect :x="actor.x - 50" y="16" width="100" height="28" rx="4" :class="actor.accent ? 'actor-box-acc' : 'actor-box'" />
            <text :x="actor.x" y="35" text-anchor="middle" class="actor">{{ actor.label }}</text>
            <line :x1="actor.x" y1="50" :x2="actor.x" y2="460" class="lifeline" />
          </g>
          <g v-for="step in oauthSteps" :key="step.n">
            <line :x1="oauthActors[step.from].x" :x2="oauthActors[step.to].x" :y1="step.y" :y2="step.y" :class="step.back ? 'arr-back' : 'arr'" :marker-end="step.back ? 'url(#oa-l)' : 'url(#oa-r)'" />
            <text :x="midpoint(step.from, step.to)" :y="step.y - 11" text-anchor="middle" class="step-num">{{ step.n }}</text>
            <text :x="midpoint(step.from, step.to)" :y="step.y - 1" text-anchor="middle" class="step-lbl">{{ step.label }}</text>
            <text :x="midpoint(step.from, step.to)" :y="step.y + 13" text-anchor="middle" class="step-meta">{{ step.meta }}</text>
          </g>
        </svg>
      </div>
    </section>

    <section class="routes-section reveal-item">
      <h2>Endpoint reference</h2>
      <p class="lede">Every route the remote service exposes. Public routes are reachable pre-auth; bearer routes need a valid access token; owner routes additionally require <code>role:owner</code>.</p>
      <div class="routes-table">
        <div class="h"><span>Method</span><span>Path</span><span>Description</span><span>Auth</span></div>
        <div v-for="route in routes" :key="route.path" class="r">
          <span><span :class="['meth', route.method]">{{ route.method }}</span></span>
          <span class="path">{{ route.path }}</span>
          <span class="desc">{{ route.desc }}</span>
          <span :class="['scope', route.auth]">{{ route.auth }}</span>
        </div>
      </div>
    </section>

    <section class="security-row reveal-item">
      <article v-for="card in securityCards" :key="card.title" class="sec-card">
        <UiIcon :name="card.icon" class="icon" :size="32" />
        <h4>{{ card.title }}</h4>
        <p v-html="card.body" />
        <div class="meta">{{ card.file }}</div>
      </article>
    </section>

    <section class="smoke-section reveal-item">
      <h2>Verify with <code>npm run smoke:remote</code></h2>
      <p class="lede">Bundled in the repo. Walks the full OAuth flow against your live deployment, calls real MCP tools, and verifies policy enforcement end-to-end. Wire it into CI to catch drift before users do.</p>
      <TerminalBlock title="npm run smoke:remote — bash" :lines="smokeLines" tall />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from "vue";
import { PRODUCT_VERSION_SHORT } from "../data/product";
import UiIcon from "./UiIcon.vue";

type Provider = {
  id: string;
  name: string;
  short: string;
  logoBg: string;
  logoFg: string;
  time: string;
  desc: string;
  feat: string[];
  steps: Array<{ title: string; body: string; command?: string }>;
};

const active = ref("railway");
const copied = ref(false);

const providers: Provider[] = [
  {
    id: "railway",
    name: "Railway",
    short: "RWY",
    logoBg: "#0B0D0E",
    logoFg: "#fff",
    time: "~2 min",
    desc: "One-click template. Provisions Postgres + persistent volume, sets env vars, exposes HTTPS endpoint.",
    feat: ["one-click", "Postgres", "managed TLS", "auto-deploy"],
    steps: [
      { title: "Click 'Deploy on Railway'", body: "Forks the autovault template into your account. You'll be asked to fill three required env vars before the build starts." },
      { title: "Set required environment", body: "Railway prompts for these at template time. They go straight into the deployment config — never committed to git.", command: "AUTOVAULT_ADMIN_EMAIL=admin@example.com\nAUTOVAULT_ADMIN_PASSWORD=<long-random-string>\nAUTOVAULT_PUBLIC_URL=https://your-vault.up.railway.app" },
      { title: "Wait for build", body: "Build runs npm run build, copies bundled skills, starts the remote service on $PORT. Health check at /healthz.", command: "→ npm ci\n→ npm run build\n→ node dist/remote.js" },
      { title: "Connect from your agent", body: "Add the MCP endpoint to your agent's config. The first call kicks off the OAuth dance.", command: "autovault add autoworks-ai/extract-pdf \\\n  --remote https://your-vault.up.railway.app/mcp" }
    ]
  },
  {
    id: "docker",
    name: "Docker",
    short: "DKR",
    logoBg: "#2496ED",
    logoFg: "#fff",
    time: "~5 min",
    desc: "Self-host with Compose. Brings up the remote MCP service, SQLite volume, and reverse proxy.",
    feat: ["self-hosted", "SQLite", "Compose", "BYO TLS"],
    steps: [
      { title: "Pull image and seed env", body: "The container defaults to remote mode. Compose now requires explicit admin credentials.", command: `docker pull autoworks/autovault:${PRODUCT_VERSION_SHORT}\ncp .env.example .env\n$EDITOR .env` },
      { title: "Validate compose", body: "Compose hard-fails if the admin vars are unset.", command: "docker compose config\n✓ AUTOVAULT_ADMIN_EMAIL set\n✓ AUTOVAULT_ADMIN_PASSWORD set" },
      { title: "Bring it up", body: "Service binds to 8080 inside the container. Put Caddy, Traefik, or nginx in front for TLS.", command: "docker compose up -d\n✓ autovault-remote running on :8080" },
      { title: "Test the MCP endpoint", body: "POST a discovery request to /mcp to confirm transport, auth middleware, and CORS.", command: "curl -X POST https://your.vault/mcp \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"method\":\"initialize\"}'" }
    ]
  }
];

const activeProvider = computed(() => providers.find((provider) => provider.id === active.value) ?? providers[0]);

const topoRoutes = [
  { y: 50, label: "/mcp", desc: "Streamable HTTP" },
  { y: 98, label: "/oauth/*", desc: "auth-code · PKCE · refresh" },
  { y: 146, label: "/admin/*", desc: "owner routes" },
  { y: 194, label: "policy layer", desc: "scopes · roles · filter" },
  { y: 236, label: "CORS · origin guard", desc: "allowed origins" }
];

const remoteStatusLines = [
  "$ autovault status --remote https://your.vault",
  "",
  "endpoint      https://your.vault/mcp",
  "issuer        https://your.vault",
  `version       ${PRODUCT_VERSION_SHORT}`,
  "transport     streamable-http",
  "auth          oauth2.1 · pkce required",
  "storage       sqlite (3.2 MB · 47 caps)",
  "",
  "recent",
  "  02:14:08  POST /mcp         200  get_skill extract-pdf",
  "  02:14:01  POST /oauth/token 200  refresh +900s",
  "  02:11:55  POST /mcp         403  add_skill (scope)",
  "",
  "✓ healthy · uptime 4d 02:11:09"
];

const statusLines = computed(() => remoteStatusLines);

const smokeLines = [
  "$ AUTOVAULT_REMOTE_URL=https://vault.acme.dev npm run smoke:remote",
  "",
  "▸ phase 1 · discovery",
  "  GET  /.well-known/oauth-authorization-server   200",
  "  GET  /.well-known/openid-configuration         200",
  "  → issuer matches AUTOVAULT_PUBLIC_URL          ✓",
  "",
  "▸ phase 2 · dynamic registration",
  "  POST /oauth/register                           201",
  "  → client_id: smk_8f3c…21a4                    ✓",
  "",
  "▸ phase 3 · auth-code + PKCE",
  "  GET  /oauth/authorize                          302",
  "  POST /oauth/token                              200",
  "  POST /oauth/token refresh                      200",
  "",
  "▸ phase 4 · MCP tool calls",
  "  POST /mcp initialize                           200",
  "  POST /mcp list_skills                          200",
  "  POST /mcp get_skill autoworks-ai/extract-pdf   200",
  "  → ed25519 signature verified                  ✓",
  "",
  "▸ phase 5 · policy enforcement",
  "  POST /mcp add_skill (non-owner)                403",
  "  → expected denial: scope:write missing        ✓",
  "",
  "✓ remote smoke complete · 18/18 checks passed · 4.2s"
];

const envGroups = [
  { title: "Admin seed", required: true, rows: [
    { key: "AUTOVAULT_ADMIN_EMAIL", value: "Email address for the bootstrap owner. Created on first boot only." },
    { key: "AUTOVAULT_ADMIN_PASSWORD", value: "Min 12 chars. Compose and Railway templates refuse to start without this." }
  ] },
  { title: "Public surface", required: true, rows: [
    { key: "AUTOVAULT_PUBLIC_URL", value: "Public HTTPS origin. Used as the OAuth issuer and embedded in <code>/.well-known</code> docs." },
    { key: "AUTOVAULT_PORT", value: "Bind port. Default <code>8080</code>. PaaS providers usually inject <code>$PORT</code>." }
  ] },
  { title: "CORS & origin guard", required: false, rows: [
    { key: "AUTOVAULT_ALLOWED_ORIGINS", value: "Comma-separated origin list. Browsers calling <code>/mcp</code> must come from one of these." },
    { key: "AUTOVAULT_TRUSTED_PROXIES", value: "CIDR list for X-Forwarded-* trust behind Caddy, Cloudflare, or fly-proxy." }
  ] },
  { title: "Storage & tokens", required: false, rows: [
    { key: "AUTOVAULT_DATABASE_URL", value: "SQLite path or Postgres URL. Default: <code>./data/vault.db</code>." },
    { key: "AUTOVAULT_TOKEN_TTL", value: "Access token lifetime in seconds. Default <code>900</code>; refresh tokens rotate on use." }
  ] }
];

const oauthActors = [
  { x: 80, label: "Agent CLI", accent: false },
  { x: 220, label: "Browser", accent: false },
  { x: 380, label: "/oauth/*", accent: true },
  { x: 540, label: "/mcp", accent: true }
];
const oauthSteps = [
  { from: 0, to: 1, n: "1", label: "open authorize URL", meta: "PKCE challenge", y: 80 },
  { from: 1, to: 2, n: "2", label: "GET /oauth/authorize", meta: "code_challenge + redirect_uri", y: 130 },
  { from: 2, to: 1, n: "3", label: "consent screen", meta: "session cookie set", y: 180, back: true },
  { from: 1, to: 0, n: "4", label: "redirect with code", meta: "?code=...&state=...", y: 230, back: true },
  { from: 0, to: 2, n: "5", label: "POST /oauth/token", meta: "code + verifier", y: 290 },
  { from: 2, to: 0, n: "6", label: "access + refresh tokens", meta: "scopes: read write", y: 340, back: true },
  { from: 0, to: 3, n: "7", label: "POST /mcp", meta: "Authorization: Bearer …", y: 400 },
  { from: 3, to: 0, n: "8", label: "tool result", meta: "policy-filtered by scope", y: 440, back: true }
];

const routes = [
  { method: "GET", path: "/.well-known/oauth-authorization-server", desc: "RFC 8414 metadata. Issuer, endpoints, supported flows.", auth: "public" },
  { method: "POST", path: "/oauth/register", desc: "Dynamic client registration. Returns client_id.", auth: "public" },
  { method: "GET", path: "/oauth/authorize", desc: "Auth-code endpoint. Requires PKCE challenge.", auth: "public" },
  { method: "POST", path: "/oauth/token", desc: "Code → token, refresh → token. Rotates refresh on use.", auth: "public" },
  { method: "POST", path: "/oauth/revoke", desc: "Revoke an access or refresh token.", auth: "bearer" },
  { method: "POST", path: "/mcp", desc: "Streamable HTTP MCP transport. All tool calls land here.", auth: "bearer" },
  { method: "GET", path: "/admin/users", desc: "List users with roles and last-seen timestamps.", auth: "owner" },
  { method: "POST", path: "/admin/users/:id/scopes", desc: "Grant or revoke scopes. Audit-logged.", auth: "owner" },
  { method: "DELETE", path: "/admin/clients/:id", desc: "Force-revoke a client and all tokens.", auth: "owner" },
  { method: "GET", path: "/healthz", desc: "Liveness probe. Returns boot time and DB ping.", auth: "public" }
];

const securityCards = [
  { icon: "shield" as const, title: "Policy gate on every call", body: "The same role + scope filter runs at the MCP boundary. Non-owner reads are filtered by capability access; writes require explicit <code>scope:write</code>.", file: "src/remote/policy.ts" },
  { icon: "lock" as const, title: "PKCE is mandatory", body: "The <code>/oauth/authorize</code> endpoint rejects requests without a <code>code_challenge</code>. Refresh tokens rotate on use.", file: "src/remote/auth.ts" },
  { icon: "tip" as const, title: "CORS & origin pinning", body: "Browser access is opt-in. <code>AUTOVAULT_ALLOWED_ORIGINS</code> is a strict allowlist; server-to-server calls bypass cleanly.", file: "src/remote/server.ts" }
];

const TerminalBlock = defineComponent({
  props: {
    title: { type: String, required: true },
    lines: { type: Array as () => string[], required: true },
    tall: Boolean
  },
  setup(props) {
    return () => h("div", { class: ["term", props.tall ? "tall" : ""] }, [
      h("div", { class: "term-head" }, [
        h("span", { class: "dot", style: "background:#ff5f57" }),
        h("span", { class: "dot", style: "background:#ffbd2e" }),
        h("span", { class: "dot", style: "background:#28c941" }),
        h("span", { style: "margin-left:10px" }, props.title)
      ]),
      h("div", { class: "term-body" }, props.lines.map((line) => h("div", { class: lineClass(line) }, line || "\u00a0")))
    ]);
  }
});

function lineClass(line: string) {
  if (line.startsWith("$")) return "cmdline";
  if (line.includes("✓") || line.includes("200") || line.includes("201")) return "ok";
  if (line.includes("403") || line.includes("401")) return "warn";
  if (line.startsWith("▸")) return "h";
  if (!line.trim()) return "dim";
  return "";
}

function midpoint(from: number, to: number) {
  return (oauthActors[from].x + oauthActors[to].x) / 2;
}

async function copyProvider() {
  copied.value = true;
  try {
    await navigator.clipboard?.writeText(activeProvider.value.steps.map((step) => step.command).filter(Boolean).join("\n\n"));
  } catch {
    // Clipboard is a progressive enhancement in the static docs.
  }
  window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}
</script>
