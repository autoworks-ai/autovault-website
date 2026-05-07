<template>
  <div class="cm-page reveal-page">
    <section class="cm-hero reveal-item">
      <div class="eyebrow"><span class="dash" /> Comparison · v0.2.0 · 2026-05</div>
      <h1>The honest breakdown of <span class="ital">where AutoVault wins, ties, and doesn't.</span></h1>
      <p class="lede">The homepage table is a teaser. This page is the long form — including the cases where another approach is genuinely better. We re-evaluate every release; if a competitor closes a gap, we say so here first.</p>
    </section>

    <section class="cm-tldr reveal-item">
      <div>
        <div class="lbl">In one paragraph</div>
        <div class="readtime">~30s read</div>
      </div>
      <div class="body">
        <p>If you publish skills for <strong>more than one agent</strong> and care about <strong>provenance</strong>, AutoVault is the only option that solves both with a single SKILL.md and a public, reproducible gate. If you only publish for one agent and don't care about signing, <strong>RawHub</strong> is fine and free. If your team has been hand-maintaining <strong>per-agent forks</strong> of the same skill, you're paying the ForkFlow tax — that's the case AutoVault was built to retire.</p>
      </div>
    </section>

    <section class="cm-players reveal-item">
      <article v-for="player in players" :key="player.id" :class="['cm-player', { us: player.us }]">
        <div class="row1">
          <div class="badge" :style="{ background: player.color, color: player.ink }">{{ player.badge }}</div>
          <span class="nm">{{ player.name }}</span>
          <span v-if="player.us" class="us-tag">us</span>
        </div>
        <div class="desc">{{ player.desc }}</div>
        <div class="meta-row"><span v-for="meta in player.meta" :key="meta">{{ meta }}</span></div>
      </article>
    </section>

    <section class="cm-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Feature matrix</div>
      <h2>Feature-by-feature.</h2>
      <p class="sub">Twelve dimensions across four sections. Cells show the verdict plus a one-line explanation — never a flat checkmark, because flat checkmarks lie.</p>

      <div class="cm-grid" role="table" aria-label="AutoVault feature comparison">
        <div class="cm-row head" role="row">
          <div class="cell">Capability</div>
          <div v-for="player in players" :key="player.id" :class="['cell', { us: player.us }]">
            <div class="player-head">
              <span class="badge" :style="{ background: player.color, color: player.ink }">{{ player.badge }}</span>
              <span>{{ player.name }}</span>
            </div>
          </div>
        </div>
        <template v-for="(row, index) in rows" :key="index">
          <div v-if="row.kind === 'section'" class="cm-row section-head">
            <div class="cell">{{ row.label }}</div>
          </div>
          <div v-else class="cm-row">
            <div class="cell row-head">
              <div>{{ row.feature }}</div>
              <div class="detail">{{ row.detail }}</div>
            </div>
            <div v-for="player in players" :key="player.id" :class="['cell', { us: player.us }]">
              <div :class="['verdict', row[player.id].value]">{{ verdictText(row[player.id].value) }} · {{ row[player.id].title }}</div>
              <div class="det">{{ row[player.id].detail }}</div>
            </div>
          </div>
        </template>
      </div>

      <div class="cm-honest">
        <div class="ttl">Honesty box</div>
        <p><strong>Where AutoVault is genuinely behind.</strong> RawHub has more skills (3,400 vs. our 241) — community indexes always do. ForkFlow has a richer GUI for browsing per-agent forks; if you live mostly in one agent's tooling and don't care about cross-agent skills, that may matter to you. Hosted AutoVault is intentionally narrow right now: fast launch, remote MCP, OAuth, and signed skill delivery before the broader team-management surface grows.</p>
      </div>
    </section>

    <section class="cm-section reveal-item">
      <div class="eyebrow"><span class="dash" /> When to pick what</div>
      <h2>Pick by situation, not by feature count.</h2>
      <p class="sub">Four short cards with the real-world signals that should push you toward each option. We try not to recommend ourselves when we shouldn't.</p>
      <div class="cm-when">
        <article v-for="card in whenCards" :key="card.title" :class="['cm-when-card', { us: card.us }]">
          <div class="h">
            <div class="badge" :style="{ background: card.color, color: card.ink }">{{ card.badge }}</div>
            <h3>{{ card.title }}</h3>
          </div>
          <p class="pick">{{ card.pick }}</p>
          <div class="ul">Real signals</div>
          <ul class="signals">
            <li v-for="signal in card.signals" :key="signal">{{ signal }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="cm-section reveal-item">
      <div class="eyebrow"><span class="dash" /> The two big bets</div>
      <h2>What we believe that the alternatives don't.</h2>
      <p class="sub">Below the feature matrix, AutoVault is shaped by two opinions about where the agent-skill ecosystem is heading.</p>
      <div class="cm-dive">
        <article v-for="bet in bets" :key="bet.title" class="cm-dive-card">
          <h3>{{ bet.title }}</h3>
          <p class="sub">{{ bet.subtitle }}</p>
          <div v-for="point in bet.points" :key="point.axis" class="point">
            <div class="axis">{{ point.axis }}</div>
            <div class="body" v-html="point.body" />
          </div>
        </article>
      </div>
    </section>

    <section class="cm-section reveal-item">
      <div class="eyebrow"><span class="dash" /> Migrating in</div>
      <h2>Already using one of the others? Here's the path.</h2>
      <p class="sub">We provide first-class importers for the three common starting points. Migration runs through the same gate as authoring, so what you import is what gets signed.</p>
      <article v-for="migration in migrations" :key="migration.title" class="cm-mig">
        <div>
          <h3>{{ migration.title }}</h3>
          <p>{{ migration.body }}</p>
        </div>
        <pre class="code"><code>{{ migration.code }}</code></pre>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
type Verdict = "yes" | "no" | "partial" | "bad";
type ComparisonCell = { value: Verdict; title: string; detail: string };
type ComparisonRow =
  | { kind: "section"; label: string }
  | {
      kind?: never;
      feature: string;
      detail: string;
      av: ComparisonCell;
      rh: ComparisonCell;
      fl: ComparisonCell;
      ml: ComparisonCell;
    };

const players = [
  { id: "av" as const, name: "AutoVault", desc: "Validating registry. Author once, render per caller. Local CLI; signed; reproducible.", badge: "AV", color: "#5ad6c0", ink: "#062821", us: true, meta: ["v0.2.0", "MIT", "self-hosted"] },
  { id: "rh" as const, name: "RawHub", desc: "Public skill index. No gate, no signing. Browse and copy-paste from a community wiki.", badge: "RH", color: "#5a9dd6", ink: "#06182a", meta: ["community", "no validation", "browser only"] },
  { id: "fl" as const, name: "ForkFlow", desc: "Fork-and-edit catalog. Each agent maintains its own format-specific fork of every skill.", badge: "FF", color: "#d6a85a", ink: "#2a1a06", meta: ["per-agent forks", "manual sync"] },
  { id: "ml" as const, name: "ManualOps", desc: "No tooling. Engineers paste skills directly into CLAUDE.md / .cursorrules / AGENTS.md by hand.", badge: "—", color: "#4a5b6b", ink: "#0a0d11", meta: ["zero tooling", "high drift"] }
];

const rows: ComparisonRow[] = [
  { kind: "section", label: "Authoring & format" },
  row("Single source of truth", "One canonical SKILL.md vs. N agent-specific forks", ["yes", "Single SKILL.md per skill", "Transformations rendered per caller"], ["yes", "One per skill", "Caller copy-pastes raw"], ["no", "N forks per skill", "Separate CLAUDE.md, AGENTS.md, .cursorrules"], ["no", "Per-machine drift", "Each engineer keeps their own version"]),
  row("Per-caller transformation", "Output adapted to the agent's idiom", ["yes", "Manifest-driven", "Author declares targets; vault renders and signs each"], ["no", "—", "Caller is on their own"], ["partial", "Manual fork", "Each fork is a separate copy"], ["no", "—", "Whatever the engineer pasted is what runs"]),
  row("Author-once delivery", "Write once and reach every supported agent", ["yes", "4 agents from one source", "Claude Code, Codex, Cursor, AutoHub"], ["partial", "1 format per skill", "Author picks one; rest is copy work"], ["no", "Up to N times", "One write per agent fork"], ["no", "1× per machine × N agents", "Compounding manual work"]),
  { kind: "section", label: "Validation & trust" },
  row("Pre-publish gate", "Programmatic checks before admission", ["yes", "5 stages, reproducible", "Repair → denylist → capability → dedup → sign"], ["no", "—", "Best-effort community moderation"], ["partial", "Per-fork lint", "Inconsistent across forks"], ["no", "—", "Whatever ships, ships"]),
  row("Cryptographic signing", "Ed25519 sigs bind author + content + gate verdict", ["yes", "Ed25519 chain", "Author → vault → mirror"], ["no", "—", "Trust by URL only"], ["no", "—", "No signing"], ["no", "—", "No signing"]),
  row("Reproducible verdicts", "Same bytes in = same gate verdict out", ["yes", "Gate v0.2+", "Run locally with autovault verify"], ["no", "n/a", "No verdict to reproduce"], ["partial", "Best-effort", "Depends on fork lint"], ["no", "n/a", "—"]),
  row("Public denylist", "Auditable, signed bad-pattern bundle", ["yes", "343 patterns, signed", "Same artifact format as skills"], ["no", "—", "—"], ["no", "—", "—"], ["no", "—", "—"]),
  { kind: "section", label: "Operations" },
  row("Dedup at submission", "Stops duplicate-skill explosion before it starts", ["yes", "Text in V1", "Embedding in V2 preview"], ["no", "Browser ranking only", "Near-duplicates surface"], ["no", "—", "Forks are duplicates by design"], ["no", "—", "—"]),
  row("Self-hostable", "Run a private vault behind your VPN", ["yes", "Docker / Railway / Render", "Same gate, your keys, your mirror"], ["partial", "Mirrors only", "No gate to self-host"], ["no", "Cloud only", "—"], ["yes", "By definition", "Each machine is the host"]),
  row("Remote MCP endpoint", "Mobile and sandboxed agents fetch over HTTPS", ["yes", "Bundled MCP server", "One-click deploy, signed responses"], ["no", "—", "Browser-only"], ["partial", "Per-agent", "Format-specific endpoints"], ["no", "—", "—"]),
  row("License clarity", "SPDX license declared and surfaced", ["yes", "Required field", "Gate-checked"], ["partial", "Optional", "Often blank"], ["partial", "Per-fork inconsistency", "—"], ["no", "Lost in copy-paste", "—"]),
  { kind: "section", label: "Cost & openness" },
  row("Pricing", "Cost to author, host, or consume", ["yes", "Free, MIT", "All open. No paid plans."], ["yes", "Free", "Donations"], ["partial", "Free tier + paid", "Private forks behind paywall"], ["yes", "Free", "Labor cost is high"]),
  row("Vendor lock-in risk", "If the project disappears tomorrow", ["yes", "Plain SKILL.md files", "Markdown + signed JSON"], ["yes", "Plain text", "Caller has copies"], ["partial", "Forks survive", "Formats drift"], ["yes", "Yours already", "—"])
];

const whenCards = [
  { title: "Pick AutoVault when…", badge: "AV", color: "#5ad6c0", ink: "#062821", us: true, pick: "You ship skills for two or more agents, can't tolerate drift, and need a verifiable provenance chain before anything reaches a developer's machine.", signals: ["We have CLAUDE.md, .cursorrules, and AGENTS.md, and they keep diverging", "Security blocked a registry because there's no signing", "We need to audit which skills loaded last week", "We want a private vault behind our VPN"] },
  { title: "Pick RawHub when…", badge: "RH", color: "#5a9dd6", ink: "#06182a", pick: "You're a solo developer using one agent, breadth matters more than provenance, and you'd rather copy-paste five skills today than configure anything.", signals: ["Personal projects, not work product", "Single-agent setup", "You're fine reading every skill before pasting", "Discovery matters more than trust"] },
  { title: "Pick ForkFlow when…", badge: "FF", color: "#d6a85a", ink: "#2a1a06", pick: "You're already deep in one agent's ecosystem, you don't write skills, and per-agent UX matters more than a unified source.", signals: ["You consume skills, never publish them", "Marketplace UI matters more than CLI", "Installing the same skill twice is acceptable"] },
  { title: "Skip tooling entirely when…", badge: "—", color: "#4a5b6b", ink: "#0a0d11", pick: "You have fewer than five skills total, your team is one or two people, and any registry would be larger than the problem.", signals: ["The whole skill folder fits in one screenshot", "You can name every skill from memory", "Your agents don't support skill autoloading yet"] }
];

const bets = [
  { title: "Bet #1 · Skills are infrastructure, not content", subtitle: "Treat them like SBOMs, not Stack Overflow answers", points: [
    { axis: "Implication", body: "A skill that runs in your agent's tool boundary is <strong>code in your trust path</strong>. Distributing it without a signature is the equivalent of curl | bash." },
    { axis: "Bet", body: "In 18 months, unsigned skills will look tolerated for personal use and blocked at the enterprise edge." },
    { axis: "If wrong", body: "Provenance becomes overhead nobody asked for, and RawHub-shaped indexes win on volume." }
  ] },
  { title: "Bet #2 · The agent format wars are permanent", subtitle: "There will not be one universal skill format", points: [
    { axis: "Implication", body: "Each agent's idiom reflects how that agent's <strong>controller actually reasons</strong>. Lowest-common-denominator output degrades every agent." },
    { axis: "Bet", body: "The right abstraction is one canonical SKILL.md plus a transformation manifest, not one universal output." },
    { axis: "If wrong", body: "A standard emerges and the manifest layer collapses into plain SKILL.md." }
  ] }
];

const migrations = [
  { title: "From RawHub", body: "The CLI walks RawHub's index, downloads each skill, and runs it through the gate before it lands in your vault.", code: "autovault import rawhub --user you\n# found 47 skills · running gate…\n✓ 41 imported · 5 repaired · 1 rejected" },
  { title: "From ForkFlow (per-agent forks)", body: "Point the importer at all three forks of the same skill. It merges them into one canonical SKILL.md plus a populated transformation manifest.", code: "autovault import forkflow \\\n  --claude ./forks/extract-pdf.cc \\\n  --codex  ./forks/extract-pdf.cx \\\n  --cursor ./forks/extract-pdf.cu\n# merged 3 forks → 1 SKILL.md + 3 transformations" },
  { title: "From hand-maintained CLAUDE.md / AGENTS.md / .cursorrules", body: "The importer parses each file, identifies skill-shaped sections, and proposes one SKILL.md per section.", code: "autovault import manual ./CLAUDE.md\n# detected 6 skill-shaped sections\n✓ 6 SKILL.md drafts written to ./drafts/\nautovault publish ./drafts/*.md" }
];

function row(feature: string, detail: string, av: [Verdict, string, string], rh: [Verdict, string, string], fl: [Verdict, string, string], ml: [Verdict, string, string]): ComparisonRow {
  return { feature, detail, av: cell(av), rh: cell(rh), fl: cell(fl), ml: cell(ml) };
}

function cell(input: [Verdict, string, string]): ComparisonCell {
  return { value: input[0], title: input[1], detail: input[2] };
}

function verdictText(value: Verdict) {
  return value === "yes" ? "Yes" : value === "partial" ? "Partial" : value === "bad" ? "Risky" : "No";
}
</script>
