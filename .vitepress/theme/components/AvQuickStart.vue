<template>
  <section class="av-section" id="start">
    <div class="av-eyebrow"><span class="dash" /> Five minutes, two agents</div>
    <h2 style="margin-top: 16px; max-width: 760px">Same skill, two callers, zero forks.</h2>

    <div class="av-qs-grid">
      <div class="av-qs-step">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 01</span>
          <span class="av-qs-step-title">Install the local vault</span>
        </div>
        <div class="av-qs-step-body">
          <div class="row"><span class="pmt">$</span><span>curl -fsSL autovault.sh | sh</span></div>
          <div class="out" style="margin-top: 6px">↳ installed → ~/.autovault</div>
          <div class="out">↳ profile dirs symlinked: ~/.claude/skills, ~/.codex/skills</div>
          <div class="row" style="margin-top: 10px"><span class="pmt">$</span><span>autovault status</span></div>
          <div class="ok" style="margin-top: 6px">● vault healthy · 0 skills · ed25519 keypair generated</div>
        </div>
      </div>

      <div class="av-qs-step">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 02</span>
          <span class="av-qs-step-title">Add a validated skill</span>
        </div>
        <div class="av-qs-step-body">
          <div class="row"><span class="pmt">$</span><span>autovault add github:autoworks-ai/skills/extract-pdf</span></div>
          <div class="out" style="margin-top: 6px">↳ fetching… 1.4kb</div>
          <div class="out">↳ <span class="ok">[1/5]</span> yaml-repair: ok</div>
          <div class="out">↳ <span class="ok">[2/5]</span> denylist: ok</div>
          <div class="out">↳ <span class="ok">[3/5]</span> capability/behavior: ok</div>
          <div class="out">↳ <span class="ok">[4/5]</span> dedup: ok (no near matches)</div>
          <div class="out">↳ <span class="ok">[5/5]</span> sign: 0x9af4…2c81</div>
          <div class="ok" style="margin-top: 6px">✓ admitted to vault</div>
        </div>
      </div>

      <div class="av-qs-step">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 03</span>
          <span class="av-qs-step-title">Scope to a project</span>
        </div>
        <div class="av-qs-step-body">
          <div class="row"><span class="pmt">$</span><span>autovault scope extract-pdf --project autovault-website --agent claude-code,codex</span></div>
          <div class="out" style="margin-top: 6px">↳ scoped: 2 agents × 1 project</div>
          <div class="out">↳ rendering for claude-code → fs.read → read</div>
          <div class="out">↳ rendering for codex → fs.read → file_read</div>
          <div class="ok" style="margin-top: 6px">✓ ready · cached</div>
        </div>
      </div>

      <div class="av-qs-step">
        <div class="av-qs-step-head">
          <span class="av-qs-step-num">STEP / 04</span>
          <span class="av-qs-step-title">Run from either agent</span>
        </div>
        <div class="av-qs-step-body">
          <div style="color: var(--ink-3)"># in claude-code</div>
          <div>&gt; use extract-pdf to summarize report.pdf</div>
          <div class="ok" style="margin-top: 4px">✓ tool resolved: chrome-devtools, read</div>
          <div style="color: var(--ink-3); margin-top: 12px"># in codex</div>
          <div>&gt; use extract-pdf to summarize report.pdf</div>
          <div class="ok" style="margin-top: 4px">✓ tool resolved: browser_form, file_read</div>
        </div>
      </div>
    </div>
  </section>
</template>
