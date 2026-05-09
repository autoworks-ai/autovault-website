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
        <p><strong>Skillfish</strong> is the closest direct neighbor: it has a strong open-source story for installing, updating, syncing, and bundling skills across many agents. AutoVault is built for a stricter path: admit skills into a local-first vault, validate and sign what passes, scope delivery, and render one canonical SKILL.md for the caller that needs it. If you mainly need public discovery, look at Tessl or SkillKit-style directories first. If you only have a few files, manual folders can still be enough.</p>
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
        <p><strong>Where AutoVault is genuinely behind.</strong> Skillfish currently has broader agent/runtime coverage and a clearer skill manager workflow for install, update, sync, and team bundles. Tessl and SkillKit-style ecosystems are better starting points when public discovery or standardization is the main job. Manual folders are still simpler for one person with a handful of trusted skills. AutoVault is intentionally narrower: local-first validation, signing, scoped delivery, transforms, remote MCP, and OAuth before a broader management surface.</p>
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
      <p class="sub">There is no magic importer for every ecosystem. The practical path is to bring source skills or local folders into the vault and let the same gate decide what gets admitted and signed.</p>
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
import { denyRows } from "../data/security";

type Verdict = "yes" | "no" | "partial" | "bad";
type ComparisonCell = { value: Verdict; title: string; detail: string };
type ComparisonRow =
  | { kind: "section"; label: string }
  | {
      kind?: never;
      feature: string;
      detail: string;
      av: ComparisonCell;
      sf: ComparisonCell;
      ts: ComparisonCell;
      sk: ComparisonCell;
      mn: ComparisonCell;
    };

const players = [
  { id: "av" as const, name: "AutoVault", desc: "Local-first vault. Gate, sign, scope, and render one SKILL.md per caller.", badge: "AV", color: "#5ad6c0", ink: "#062821", us: true, meta: ["v0.2.0", "MIT", "self-hosted"] },
  { id: "sf" as const, name: "Skillfish", desc: "Open-source skill manager for install, update, sync, and team bundles across many agents.", badge: "SF", color: "#5a9dd6", ink: "#06182a", meta: ["open source", "multi-agent", "team bundles"] },
  { id: "ts" as const, name: "Tessl", desc: "Package and distribution layer for skills and agents, strongest as a published ecosystem.", badge: "TS", color: "#b48ad6", ink: "#1d0f2a", meta: ["ecosystem", "distribution", "hosted"] },
  { id: "sk" as const, name: "SkillKit / specs", desc: "Directory and spec-oriented discovery surfaces for reusable skill source material.", badge: "SK", color: "#d6a85a", ink: "#2a1a06", meta: ["discovery", "specs", "source material"] },
  { id: "mn" as const, name: "Manual folders", desc: "Hand-maintained ~/.claude/skills, ~/.codex/skills, Cursor rules, and repo docs.", badge: "—", color: "#4a5b6b", ink: "#0a0d11", meta: ["zero tooling", "local", "high drift"] }
];

const rows: ComparisonRow[] = [
  { kind: "section", label: "Install, sync, and source of truth" },
  row("Single source of truth", "One canonical SKILL.md vs. agent-specific copies", ["yes", "Single SKILL.md per skill", "Transformations rendered per caller"], ["yes", "Managed skill source", "Strong install/update/sync story"], ["partial", "Published artifact", "Best when consuming the ecosystem surface"], ["partial", "Spec source", "Useful upstream material, not a vault"], ["no", "Per-machine drift", "Each engineer keeps their own copy"]),
  row("Multi-agent sync", "Keep Claude Code, Codex, Cursor, and other hosts aligned", ["yes", "Scoped profile links", "Vault renders only what each profile can load"], ["yes", "Core strength", "Broad agent and IDE coverage"], ["partial", "Distribution surface", "Depends on the consuming agent"], ["partial", "Examples/specs", "Good source shape, sync is external"], ["no", "Manual copy", "Sync depends on memory and discipline"]),
  row("Team bundles", "Share a set of skills across a team", ["partial", "Remote vault / self-host", "Team mode exists, management surface is still narrow"], ["yes", "Strong fit", "Skillfish is positioned around team bundles and shared installs"], ["yes", "Distribution model", "Good for shared ecosystem packages"], ["partial", "Reference bundles", "Usable as inputs, not policy"], ["bad", "High drift", "Every machine becomes its own bundle"]),
  row("Local ownership", "Can the team keep the working vault local-first?", ["yes", "~/.autovault", "Plain files, SQLite, signatures, source sidecars"], ["yes", "Local manager", "Works well for local multi-agent setups"], ["partial", "Hosted-first posture", "Useful ecosystem, less vault-owned"], ["yes", "Plain source", "Local after you copy it"], ["yes", "By definition", "Local files with no shared policy"]),
  { kind: "section", label: "Validation & trust" },
  row("Admission gate", "Programmatic checks before a skill becomes usable", ["yes", "5 stages", "Repair -> denylist -> capability -> dedup -> sign"], ["partial", "Manager checks", "Not positioned around a reproducible security gate"], ["partial", "Ecosystem policy", "Hosted controls are not the same as local admission"], ["no", "Source only", "Validation belongs elsewhere"], ["no", "No gate", "Whatever gets pasted can run"]),
  row("Cryptographic signing", "Signatures bind content, source, and gate verdict", ["yes", "Ed25519 chain", "Author -> vault -> mirror"], ["no", "Not central", "No public positioning around signed gate verdicts"], ["partial", "Trust layer", "Treat as ecosystem trust, not AutoVault-style local signatures"], ["no", "Not central", "Specs do not imply a signer"], ["no", "No signing", "Trust is social and local"]),
  row("Reproducible verdicts", "Same bytes in = same gate verdict out", ["yes", "Gate v0.2+", "Run locally with autovault verify"], ["partial", "Operational checks", "Useful manager behavior, but not a signed verdict model"], ["partial", "Hosted review", "Not equivalent to local byte-for-byte replay"], ["no", "n/a", "No admission verdict"], ["no", "n/a", "No verdict to reproduce"]),
  row("Public denylist", "Auditable bad-pattern bundle", ["yes", `${denyRows.length} active patterns`, "Same artifact format as skills"], ["partial", "Safety posture", "Not documented as a reusable denylist artifact"], ["partial", "Hosted moderation", "Different layer"], ["no", "n/a", "No gate bundle"], ["no", "n/a", "No shared scanner"]),
  { kind: "section", label: "Rendering and scope" },
  row("Per-caller transformation", "Output adapted to the agent's idiom", ["yes", "Manifest-driven", "Author declares targets; vault renders each"], ["partial", "Sync formats", "Strong multi-agent reach, not the same as signed render output"], ["partial", "Agent ecosystem", "Depends on the runtime consuming it"], ["no", "Spec source", "Transformation is left to tooling"], ["no", "Manual edits", "Each target is its own copy"]),
  row("Scoped delivery", "Filter by agent, project, device, and profile", ["yes", "Four-axis scope", "Skill visibility is a vault policy decision"], ["partial", "Profiles/bundles", "Good grouping, less emphasis on policy gates"], ["partial", "Access model", "Registry access is not per-local-profile scope"], ["no", "n/a", "No local policy model"], ["no", "n/a", "Folders are blunt instruments"]),
  row("Progressive disclosure", "Agents can search first and fetch full instructions only when needed", ["yes", "MCP-native", "Inventory lookup, exact read, resources on demand"], ["partial", "Manager metadata", "Depends on host integration"], ["partial", "Hosted metadata", "Good browsing surface, different runtime model"], ["partial", "Spec metadata", "Useful if tooling uses it"], ["no", "Full file load", "Everything is just text in a folder"]),
  { kind: "section", label: "Operations and openness" },
  row("Dedup before local use", "Stops duplicate-skill sprawl before it reaches profiles", ["yes", "Gate stage", "Exact and near-exact checks before signing"], ["partial", "Manager view", "Can reduce drift, but not positioned as gate-stage dedup"], ["partial", "Discovery ranking", "Catalogs can group similar entries"], ["no", "n/a", "No local inventory"], ["no", "n/a", "Duplicates are easy to create"]),
  row("Self-hostable remote mode", "Run a private vault behind your VPN", ["yes", "Docker / Railway / Render", "Same gate, your keys, your mirror"], ["partial", "Local/team manager", "Good local story; remote vault is not the central shape"], ["partial", "Hosted ecosystem", "Use when hosted distribution is desired"], ["no", "n/a", "No vault service"], ["partial", "File shares", "Possible, but policy remains manual"]),
  row("Vendor lock-in risk", "If a project disappears tomorrow", ["yes", "Plain SKILL.md files", "Markdown + signed JSON + source sidecars"], ["yes", "Plain skill files", "Local installs survive"], ["partial", "Published ecosystem", "Artifacts may survive, workflow depends on service"], ["yes", "Plain source", "Spec/examples remain portable"], ["yes", "Your files", "The drift is yours too"])
];

const whenCards = [
  { title: "Pick AutoVault when…", badge: "AV", color: "#5ad6c0", ink: "#062821", us: true, pick: "You need skills to pass a local gate, carry provenance, stay scoped to specific profiles, and render cleanly across more than one agent.", signals: ["We have ~/.claude, ~/.codex, and Cursor rules drifting apart", "Security wants signatures before skills reach developer machines", "We need to audit which skills loaded last week", "We want a private vault behind our VPN"] },
  { title: "Pick Skillfish when…", badge: "SF", color: "#5a9dd6", ink: "#06182a", pick: "You mainly need broad multi-agent install, update, sync, and team bundle workflows, and a signed local admission gate is not the primary requirement.", signals: ["Agent coverage matters most", "Team bundles are the core workflow", "You want a skill manager more than a vault policy layer", "You are comfortable reviewing trust outside the tool"] },
  { title: "Pick Tessl or SkillKit-style sources when…", badge: "TS", color: "#b48ad6", ink: "#1d0f2a", pick: "You are looking for public ecosystem discovery, reusable specs, or source material before deciding what belongs in your local vault.", signals: ["Discovery matters more than local policy", "You want examples to adapt", "You are evaluating agent-skill standards", "You will still review before local use"] },
  { title: "Skip tooling entirely when…", badge: "—", color: "#4a5b6b", ink: "#0a0d11", pick: "You have fewer than five trusted skills, your team is one or two people, and manual folders are smaller than the tooling overhead.", signals: ["The whole skill folder fits in one screenshot", "You can name every skill from memory", "Your agents don't support skill autoloading yet"] }
];

const bets = [
  { title: "Bet #1 · Skills are infrastructure, not content", subtitle: "Treat them like SBOMs, not Stack Overflow answers", points: [
    { axis: "Implication", body: "A skill that runs in your agent's tool boundary is <strong>code in your trust path</strong>. Distributing it without a signature is the equivalent of curl | bash." },
    { axis: "Bet", body: "In 18 months, unsigned skills will look tolerated for personal use and blocked at the enterprise edge." },
    { axis: "If wrong", body: "Provenance becomes overhead nobody asked for, and broad skill managers or discovery surfaces win on convenience." }
  ] },
  { title: "Bet #2 · The agent format wars are permanent", subtitle: "There will not be one universal skill format", points: [
    { axis: "Implication", body: "Each agent's idiom reflects how that agent's <strong>controller actually reasons</strong>. Lowest-common-denominator output degrades every agent." },
    { axis: "Bet", body: "The right abstraction is one canonical SKILL.md plus a transformation manifest, not one universal output." },
    { axis: "If wrong", body: "A standard emerges and the manifest layer collapses into plain SKILL.md." }
  ] }
];

const migrations = [
  { title: "From Skillfish-managed skills", body: "Keep Skillfish where it is useful for broad agent coverage, then admit selected local skill folders into AutoVault when you need signing, scope, and transforms.", code: "autovault add-local ./skills/extract-pdf \\\n  --source skillfish/extract-pdf \\\n  --sync-profiles\n# gate passed · signed · profiles refreshed" },
  { title: "From Tessl, SkillKit, or spec repos", body: "Treat external ecosystem entries as source material. Pull the SKILL.md or repo locally, review it, then let the AutoVault gate decide whether it belongs in the vault.", code: "autovault add github:owner/skills/extract-pdf\n# fetched source · running gate\n# admitted to ~/.autovault with provenance sidecar" },
  { title: "From hand-maintained CLAUDE.md / AGENTS.md / .cursorrules", body: "Extract the reusable instructions into one SKILL.md, declare permissions and target agents, then admit that source instead of maintaining separate copies.", code: "mkdir -p ./drafts/extract-pdf\n$EDITOR ./drafts/extract-pdf/SKILL.md\nautovault add-local ./drafts/extract-pdf --sync-profiles" }
];

function row(feature: string, detail: string, av: [Verdict, string, string], sf: [Verdict, string, string], ts: [Verdict, string, string], sk: [Verdict, string, string], mn: [Verdict, string, string]): ComparisonRow {
  return { feature, detail, av: cell(av), sf: cell(sf), ts: cell(ts), sk: cell(sk), mn: cell(mn) };
}

function cell(input: [Verdict, string, string]): ComparisonCell {
  return { value: input[0], title: input[1], detail: input[2] };
}

function verdictText(value: Verdict) {
  return value === "yes" ? "Yes" : value === "partial" ? "Partial" : value === "bad" ? "Risky" : "No";
}
</script>
