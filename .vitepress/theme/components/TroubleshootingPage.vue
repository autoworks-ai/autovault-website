<template>
  <div class="docs-rich docs-final troubleshooting-final">
    <section class="docs-hero au-hero au-final-hero">
      <AvDocBreadcrumb section="Reference" page="Troubleshooting" />
      <div class="eyebrow"><span class="dash" /> Troubleshooting · 6 min read</div>
      <h1>Something didn't import?<br><span class="ital">Re-run the wizard from a real terminal.</span></h1>
      <p class="lede">Most install-time confusion comes down to two things: the setup wizard was skipped because it ran without a TTY, or the wizard ran in <code>augment</code> mode when you wanted <code>backup</code>. Removal issues usually mean an old agent session still has cached filesystem skills, or native profile discovery was intentionally skipped.</p>
      <div class="pillrow">
        <span class="pill">setup wizard</span>
        <span class="pill">adoption modes</span>
        <span class="pill">no TTY</span>
        <span class="pill">sync-profiles</span>
        <span class="pill">remove</span>
        <span class="pill">doctor</span>
      </div>
    </section>

    <h2 id="faq">Frequently asked questions</h2>
    <p>Each entry links the symptom you're seeing to the recovery command and explains what each command actually changes on disk.</p>

    <h3 id="faq-import">My existing <code>~/.claude/skills</code> didn't import after install</h3>
    <p>"I installed AutoVault via Claude Code. My existing <code>~/.claude/skills</code> didn't get imported. How do I force an import now?"</p>
    <ol>
      <li><strong>Open a real terminal</strong> — not a shell tool inside another agent. Installers run there as subprocesses without a TTY, so the interactive wizard is silently skipped.</li>
      <li>Run <code>autovault setup</code>.</li>
      <li>When the wizard reports your native skills, choose the <strong><code>backup</code></strong> adoption mode. <code>augment</code> (the safe default) only refreshes profile links — it does <em>not</em> ingest your existing content. This is the single most common point of confusion.</li>
      <li>Reload your Claude Code session so the new skill list is picked up.</li>
    </ol>
    <div class="callout security-note">
      <span class="icn" aria-hidden="true"><UiIcon name="tip" /></span>
      <div>
        <strong>Why this is a footgun.</strong> <code>augment</code> is the safe default because it never touches your existing native skill directories. If you came expecting "import my existing skills," you'll see nothing change — and conclude AutoVault didn't work. The fix is to re-run <code>autovault setup</code> and pick <code>backup</code>.
      </div>
    </div>

    <h3 id="faq-tty">"<code>autovault setup</code> requires an interactive terminal"</h3>
    <p>The wizard cannot run inside a subprocess without a TTY. Two options:</p>
    <ul>
      <li>Open a real terminal (Terminal.app, iTerm, your OS shell) and re-run <code>autovault setup</code>.</li>
      <li>For a non-interactive scan (CI, automation, dry-run), use <code>autovault setup --json</code>. That emits a <code>DriftReport</code> describing what would be adopted without prompting and without making any change.</li>
    </ul>
    <p class="muted">Verified: <code>autovault setup</code> exits with code <code>2</code> and a <code>NoTtyError</code> when invoked without a TTY — see <code>autovault/src/cli/ui/tty.ts:13</code>.</p>

    <h3 id="faq-modes">What's the difference between <code>augment</code>, <code>backup</code>, and <code>in-place</code>?</h3>
    <p>These are the three adoption modes the wizard offers. They differ in what they do to your existing native skill directories on disk.</p>
    <div class="man-grid perms-overlay">
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#5ad6c0;display:inline-block;margin-right:8px" />augment <span class="muted">· safe default</span></div>
        <p class="card-p">Refreshes profile symlinks for skills already in the vault. Your existing native skill directories are <strong>not touched</strong>. Nothing under <code>~/.claude/skills</code> moves.</p>
        <p class="muted">Pick this when you want bundled AutoVault skills available alongside your native ones without importing the native ones.</p>
      </div>
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#f7c97a;display:inline-block;margin-right:8px" />backup <span class="muted">· the import path</span></div>
        <p class="card-p"><code>fs.rename</code>s each native skill directory to <code>&lt;root&gt;.bak/&lt;name&gt;</code>, admits the bytes into the vault through the validation gate, then replaces the original with a managed symlink. Refuses to overwrite an existing backup.</p>
        <p class="muted">Pick this when you want to "import my existing skills." Originals stay on disk under <code>.bak/</code> so you can roll back.</p>
      </div>
      <div class="man-card">
        <div class="mono-label"><span class="swatch" style="background:#d97171;display:inline-block;margin-right:8px" />in-place <span class="muted">· destructive</span></div>
        <p class="card-p">Admits the native bytes into the vault, then <code>rm -rf</code>s the native directory and replaces it with a managed symlink. <strong>No backup.</strong></p>
        <p class="muted">Only pick this when you're certain you want to delete the originals. There is no undo.</p>
      </div>
    </div>
    <p class="muted">Source: <code>autovault/src/cli/setup/apply.ts</code> — <code>backup</code> at lines 45–57, <code>in-place</code> at lines 119–131, <code>augment</code> short-circuits collision handling at line 195+.</p>

    <h3 id="faq-sync-enoent"><code>autovault sync-profiles --discover</code> crashed with <code>ENOENT scandir '.autovault/skills'</code></h3>
    <p>The vault directory was initialized but no skills have been installed yet — typically because both bundled bootstrap and the setup wizard were skipped at install time. Run <code>autovault setup</code> first. The wizard creates the expected directory tree and admits any bundled skills.</p>
    <p class="muted">Upstream issue: sync should treat an empty vault as a no-op rather than crash. File a report at <a href="https://github.com/autoworks-ai/autovault/issues" rel="noreferrer">autoworks-ai/autovault</a> if this persists after the next release.</p>

    <h3 id="faq-doctor-mismatch"><code>autovault doctor</code> reports a signature mismatch on one of my skills</h3>
    <p>Run <code>autovault doctor --repair</code>. The repair flow re-signs unsigned local skills only — it refuses tampered metadata and remote sources. Today the doctor logs mismatches but does not enforce; future versions may reject mismatched signatures at load time.</p>
    <pre class="mono-block">$ autovault doctor --repair</pre>
    <p class="muted">Source: <code>autovault/src/cli/doctor.ts:157–226</code>. Added in autovault commit <code>0c0d78a</code> (PR #51).</p>

    <h3 id="faq-not-visible">A skill was admitted but doesn't show up in Claude Code</h3>
    <p>Reload your Claude Code session. The setup wizard runs <code>sync-profiles</code> as its final step, which reports <code>restart_required: true</code> when symlinks change — agents like Claude Code need a session reload to pick up the new skill list.</p>
    <p>Confirm where the skill is resolved from:</p>
    <pre class="mono-block">$ autovault skill which &lt;name&gt;</pre>
    <p>That prints the resolved script path(s) — vault, bundled, or native — so you can verify the symlink actually exists.</p>

    <h3 id="faq-add-skip-wizard">Can I move an existing skill into the vault without using the setup wizard?</h3>
    <p>Yes. Add the existing directory directly and mark it as a local source:</p>
    <pre class="mono-block">$ autovault add &lt;skill-dir&gt; --source local --sync-profiles --yes</pre>
    <p>Sync refuses to overwrite an existing user-managed native directory, so move the native dir aside first if you want the managed symlink:</p>
    <pre class="mono-block">$ mv ~/.claude/skills/&lt;name&gt; ~/.claude/skills.bak/&lt;name&gt;
$ autovault add ~/.claude/skills.bak/&lt;name&gt; --source local --sync-profiles --yes</pre>

    <h3 id="faq-remove-still-visible">I removed a skill but it still shows up in an agent</h3>
    <p>Start with the normal removal path:</p>
    <pre class="mono-block">$ autovault remove &lt;name&gt;
$ autovault remove &lt;name&gt; --json</pre>
    <p><code>autovault remove</code> deletes the vaulted skill, removes its vault-local transforms, regenerates the internal profile tree, and prunes AutoVault-managed symlinks from discovered native host roots by default. Reload the agent session afterward, because hosts can cache filesystem skill lists.</p>
    <p>If you used <code>--no-discover</code>, AutoVault refreshed only its internal profile tree and intentionally left discovered native host roots untouched. Re-run without that flag, or pass the host root explicitly:</p>
    <pre class="mono-block">$ autovault remove &lt;name&gt; --link codex=~/.codex/skills</pre>
    <p class="muted">This does not clean arbitrary orphan symlinks created outside AutoVault. Dedicated <code>doctor</code> orphan detection and cleanup is a follow-up, not current behavior.</p>

    <h2 id="matrix">Troubleshooting matrix</h2>
    <p>If you know the symptom but not the cause, start here.</p>
    <div class="access-table" aria-label="Troubleshooting matrix">
      <div class="access-row head">
        <span>Symptom</span>
        <span>Diagnostic</span>
        <span>Likely cause</span>
        <span>Fix</span>
      </div>
      <div class="access-row">
        <span class="agent">Installer finished but <code>autovault</code> is not on PATH</span>
        <span class="path"><code>which autovault</code></span>
        <span class="via">Shell profile not sourced after install.</span>
        <span class="via">Run <code>. ~/.autovault/env</code> or open a new shell.</span>
      </div>
      <div class="access-row">
        <span class="agent">Setup wizard skipped silently after install</span>
        <span class="path"><code>autovault setup --json</code></span>
        <span class="via">Installer ran without a TTY (e.g., inside another agent's shell tool).</span>
        <span class="via">Run <code>autovault setup</code> from a real terminal.</span>
      </div>
      <div class="access-row">
        <span class="agent">Adoption ran but the native directory still shows the old content</span>
        <span class="path"><code>ls -la ~/.claude/skills/&lt;name&gt;</code></span>
        <span class="via"><code>augment</code> mode was picked — native dirs were intentionally left untouched.</span>
        <span class="via">Re-run <code>autovault setup</code> and pick <code>backup</code>.</span>
      </div>
      <div class="access-row">
        <span class="agent">MCP server fails to start in Claude Code</span>
        <span class="path">Check <code>~/.claude/mcp.json</code> (or <code>~/.config/claude/mcp.json</code>)</span>
        <span class="via">Wrong path to <code>dist/index.js</code> or missing binding.</span>
        <span class="via">Fix the path. See <code>INSTALL.md</code> in the autovault repo for the host config snippets.</span>
      </div>
      <div class="access-row">
        <span class="agent">Signature mismatch reported by doctor</span>
        <span class="path"><code>autovault doctor --json</code></span>
        <span class="via">Local skill admitted before the signing key existed, or content rewritten outside the gate.</span>
        <span class="via">Run <code>autovault doctor --repair</code> on unsigned local skills.</span>
      </div>
      <div class="access-row">
        <span class="agent">Removed skill still appears in an agent</span>
        <span class="path"><code>autovault remove &lt;name&gt; --json</code></span>
        <span class="via">Agent session cache, or removal was run with <code>--no-discover</code>.</span>
        <span class="via">Reload the agent; re-run without <code>--no-discover</code> or with <code>--link agent=/path</code>.</span>
      </div>
    </div>

    <h2 id="next">Where next</h2>
    <div class="next-grid">
      <a class="next-card" href="/api#cli-setup">
        <span class="next-num">01</span>
        <span class="next-title">Read the setup reference</span>
        <span class="next-body">Full flag list, the three adoption modes, and the TTY requirement.</span>
        <span class="next-cta">Open API reference →</span>
      </a>
      <a class="next-card" href="/quick-start">
        <span class="next-num">02</span>
        <span class="next-title">Restart from Quick start</span>
        <span class="next-body">Install, run the setup wizard, scope your first skill end-to-end.</span>
        <span class="next-cta">Open quick start →</span>
      </a>
      <a class="next-card" href="https://github.com/autoworks-ai/autovault/issues">
        <span class="next-num">03</span>
        <span class="next-title">File an issue</span>
        <span class="next-body">If the recovery commands don't resolve it, open an issue against the autovault repo.</span>
        <span class="next-cta">Open GitHub →</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import AvDocBreadcrumb from "./AvDocBreadcrumb.vue";
import UiIcon from "./UiIcon.vue";
</script>
