<template>
  <div class="docs-rich docs-final perms-final">
    <section class="docs-hero au-hero au-final-hero">
      <AvDocBreadcrumb section="Permissions" page="Three-layer permission model" />
      <div class="eyebrow"><span class="dash" /> Permissions · 8 min read</div>
      <h1>You already use a permission&nbsp;model.<br><span class="ital">AutoVault gives it a place to live for skills.</span></h1>
      <p class="lede">If you have ever pinned an instruction to a Claude Desktop project, or kept your work directory separate from your home directory, you have used the same idea AutoVault organises here. A skill is a small program; AutoVault keeps three independent answers to "what can it do, where, and for whom" so the skill stays portable while you stay in control.</p>
      <div class="pillrow">
        <span class="pill">capabilities</span>
        <span class="pill">transforms</span>
        <span class="pill">install scope</span>
        <span class="pill">agents handle install</span>
      </div>
    </section>

    <h2 id="story">Start with what you already know</h2>
    <p>Claude Desktop has Projects. The instructions you put in a project apply only when you are inside that project — they do not leak into another conversation. That is a <em>scope</em>: a rule about where something is allowed to apply. AutoVault keeps that idea, then adds two more layers that skills make necessary: what the skill says it needs, and what each agent calls the tools it expects.</p>
    <p>Three layers, all configured separately, all visible in plain text:</p>

    <div class="man-grid perms-overlay">
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#5ad6c0;display:inline-block;margin-right:8px" />01 / capabilities</div>
        <p class="card-p">Inside the SKILL.md, the author declares what the skill expects: network on or off, filesystem read-only or read-write, the canonical tool names it calls.</p>
        <p class="muted">Lives in the skill. Visible to anyone reading the file.</p>
      </div>
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#f7c97a;display:inline-block;margin-right:8px" />02 / transforms</div>
        <p class="card-p">A separate <code>TRANSFORM.md</code> rewrites those declarations per agent — adding, removing, or renaming tools so one source skill becomes Claude-shaped, Codex-shaped, or Cursor-shaped output.</p>
        <p class="muted">Lives next to the skill. One canonical source, multiple rendered profiles.</p>
      </div>
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#9ab7ff;display:inline-block;margin-right:8px" />03 / install scope</div>
        <p class="card-p">When you (or your agent on your behalf) install a rendered profile, install scope decides which agents on which projects on which devices may load it.</p>
        <p class="muted">Lives outside the skill. Host policy, set at install time.</p>
      </div>
    </div>

    <h2 id="capabilities">Layer 1 — What the skill needs</h2>
    <p>The author of a skill puts a small <code>capabilities</code> block at the top of the SKILL.md. Three fields, no surprises:</p>
    <pre class="mono-block">capabilities:
  network: false
  filesystem: readonly
  tools:
    - fs.read
    - fs.write</pre>
    <p>This is the author's signal: "I read files, I do not need the network, and these are the canonical tool names I call." It is not enforcement — the agent on your machine still owns what actually happens at runtime — but it makes the skill's expectations explicit and reviewable. AutoVault's admission gate validates the shape (types, enums, list contents) and runs a small denylist on the body; the agent at install time is what compares the declaration against what the skill actually does.</p>
    <p class="muted">A skill without a <code>capabilities</code> block is accepted with a warning. AutoVault treats the block as optional metadata that improves on the open SKILL.md shape rather than as a new mandatory contract.</p>

    <h2 id="transforms">Layer 2 — What each agent calls those tools</h2>
    <p>Different agents call the same tool by different names. Claude Code calls it <code>read</code>; Codex calls it <code>file_read</code>; Cursor's tool surface differs again. Without transforms, the author would have to fork the skill three times to ship to three agents. With transforms, the author writes <em>once</em> against canonical names, and AutoVault renders one profile per agent at install time.</p>
    <p>One canonical SKILL.md, rendered for two agents:</p>

    <div class="man-grid">
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#5ad6c0;display:inline-block;margin-right:8px" />rendered/claude-code/extract-pdf/SKILL.md</div>
        <pre class="mono-block">capabilities:
  network: false
  filesystem: readonly
  tools:
    - read
    - write</pre>
        <p class="muted">A <code>claude-code-defaults</code> transform with priority 10 renamed <code>fs.read</code>/<code>fs.write</code> to Claude Code's native names.</p>
      </div>
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#f7c97a;display:inline-block;margin-right:8px" />rendered/codex/extract-pdf/SKILL.md</div>
        <pre class="mono-block">capabilities:
  network: false
  filesystem: readonly
  tools:
    - file_read
    - file_write</pre>
        <p class="muted">A <code>codex-defaults</code> transform did the same rename for Codex's native names.</p>
      </div>
    </div>

    <p>Transforms stack: a vault may install several, each with a <code>priority</code>, applied in order. A site-wide <code>readonly-clamp</code> transform with priority 100 might strip <code>fs.write</code> entirely for Codex regardless of what an earlier transform added. The order is deterministic and the diff is auditable. The interactive sandbox at the <a href="#deep-dive">bottom of this page</a> walks the exact <code>applyCapabilityOverrides()</code> logic if you want to see the stacking up close.</p>

    <h2 id="install-scope">Layer 3 — Where the skill is allowed to run</h2>
    <p>After AutoVault renders a profile for an agent, install scope decides whether that profile is symlinked into a host's <code>~/.claude/skills</code> or <code>~/.codex/skills</code>. Same idea as Claude Desktop's project boundary, but for skills, with a few more axes the agent ecosystem actually uses.</p>

    <div class="scope-rows perms-storyboard" aria-label="Install-scope axes">
      <div class="scope-row">
        <span class="axis">agents</span>
        <span class="vals">
          <span class="v on">claude-code</span>
          <span class="v on">codex</span>
          <span class="v off">cursor</span>
        </span>
      </div>
      <div class="scope-row">
        <span class="axis">project</span>
        <span class="vals">
          <span class="v on">autovault-website</span>
          <span class="v off">client-foo</span>
          <span class="v off">internal/*</span>
        </span>
      </div>
      <div class="scope-row">
        <span class="axis">device</span>
        <span class="vals">
          <span class="v on">this host</span>
          <span class="v off">ci runner</span>
        </span>
      </div>
      <div class="scope-row">
        <span class="axis">profile link</span>
        <span class="vals">
          <span class="v on">~/.claude/skills</span>
          <span class="v on">~/.codex/skills</span>
          <span class="v off">global fallback</span>
        </span>
      </div>
    </div>
    <p class="muted">The <code>agents</code> axis is enforced by <code>autovault sync-profiles</code>, which only writes to hosts a skill targets. <code>project</code>, <code>device</code>, and <code>profile link</code> are host-policy hooks the local installer composes; they are not validated by the admission gate.</p>

    <h2 id="agents-do-the-work">You do not have to write any of this</h2>
    <p>If you are using a skill someone else wrote, you do not write a <code>capabilities</code> block, you do not write a <code>TRANSFORM.md</code>, and you do not edit install scope by hand. Agents understand the model. When you ask an agent to install a skill, it walks you through the install-scope questions in plain English:</p>

    <div class="process-ribbon">
      <div class="step"><div class="num mono-label">01</div><div class="step-title">Agent fetches SKILL.md</div><div class="muted step-sub">It reads the capabilities block out loud.</div></div>
      <div class="step"><div class="num mono-label">02</div><div class="step-title">Agent asks who</div><div class="muted step-sub">"Should this be available to claude-code and codex, or just one of them?"</div></div>
      <div class="step"><div class="num mono-label">03</div><div class="step-title">Agent asks where</div><div class="muted step-sub">"Just this project, or anywhere on this machine?"</div></div>
      <div class="step"><div class="num mono-label">04</div><div class="step-title">Agent runs sync</div><div class="muted step-sub">AutoVault renders the right profile and writes the symlink.</div></div>
    </div>

    <p>You stay in control of the answers; the agent translates your answers into the right transform priority and install scope. The skill author wrote intent; you supplied policy; AutoVault is the place those two meet.</p>

    <h2 id="open-skill-md">Compatible with open SKILL.md, stricter where it matters</h2>
    <p>An "open" SKILL.md — the shape used in Claude Code's published skills — is markdown with YAML frontmatter, body underneath. AutoVault's SKILL.md keeps that shape. The fields the open spec defines (<code>name</code>, <code>version</code>, <code>description</code>, body) work unchanged. AutoVault adds optional fields (<code>capabilities</code>, <code>transformations</code>, <code>agents</code>) and validates everything through the admission gate before signing.</p>

    <div class="dodont">
      <div class="col do">
        <div class="mono-label arg">Same shape as open SKILL.md</div>
        <ul>
          <li>YAML frontmatter, markdown body, no proprietary file format.</li>
          <li>An open SKILL.md without <code>capabilities</code> still loads. The gate warns rather than fails.</li>
          <li>The author keeps writing the skill the way they always have — frontmatter and prose.</li>
        </ul>
      </div>
      <div class="col dont">
        <div class="mono-label bad">Stricter where the open spec is silent</div>
        <ul>
          <li>Capabilities make implicit assumptions explicit and machine-checkable.</li>
          <li>Transforms remove the need to fork a skill per agent, so the canonical source stays one file.</li>
          <li>Install scope keeps client work out of unrelated projects without changing the skill itself.</li>
        </ul>
      </div>
    </div>

    <h2 id="deep-dive">Deep dive: stack transforms in priority order</h2>
    <p>The interactive sandbox below mirrors <code>applyCapabilityOverrides()</code> from <code>autovault/src/transforms/index.ts</code>. Pick a target agent, toggle the transforms, and watch the rendered profile update. Use it when you want to see how priority stacking and per-agent matching produce the final SKILL.md a host actually loads.</p>
    <TransformStacker />

    <h2 id="next">Where next</h2>
    <div class="next-grid">
      <a class="next-card" href="/authoring#perms">
        <span class="next-num">01</span>
        <span class="next-title">Author the capabilities block</span>
        <span class="next-body">Field-by-field reference for the <code>capabilities</code> shape inside SKILL.md.</span>
        <span class="next-cta">Open authoring →</span>
      </a>
      <a class="next-card" href="/security">
        <span class="next-num">02</span>
        <span class="next-title">See where the gate enforces this</span>
        <span class="next-body">The five-stage admission gate that validates capabilities, scans the body, and signs what passes.</span>
        <span class="next-cta">Open security →</span>
      </a>
      <a class="next-card" href="/quick-start#first">
        <span class="next-num">03</span>
        <span class="next-title">Install your first skill</span>
        <span class="next-body">Watch your agent ask the install-scope questions and write the right symlinks.</span>
        <span class="next-cta">Open quick start →</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import AvDocBreadcrumb from "./AvDocBreadcrumb.vue";
import TransformStacker from "./TransformStacker.vue";
</script>
