<template>
  <section class="cloud-page">
    <div class="cloud-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> Hosted launch</div>
        <h1>Launch AutoVault for free in 5 minutes on our hardware.</h1>
        <p class="lede">
          Use the hosted path when you want remote Streamable HTTP MCP, OAuth, role-aware access, bundled skills, and drift checks without standing up your own vault first.
        </p>
        <div class="about-actions">
          <a class="pill-btn primary" href="#launch-path">Start hosted launch <UiIcon name="arrow" /></a>
          <a class="pill-btn" href="/quick-start">Run local instead</a>
          <a class="pill-btn" href="https://github.com/autoworks-ai/autovault">Source</a>
        </div>
      </div>
      <div class="cloud-terminal" aria-label="Hosted launch preview">
        <div class="terminal-head"><span class="dot live" /><span class="dot" /><span class="dot" /><span class="ttl">autovault cloud</span></div>
        <div class="cloud-terminal-body">
          <div><span class="pmt">$</span> autovault cloud launch</div>
          <div class="out">plan: free beta</div>
          <div class="out">region: autoworks-ai hardware</div>
          <div class="ok">remote_mcp: /mcp</div>
          <div class="ok">oauth: enabled</div>
          <div class="ok">bundled_skills: synced</div>
          <div class="out">ready in 04:37</div>
        </div>
      </div>
    </div>

    <div id="launch-path" class="cloud-section">
      <div class="cloud-section-head">
        <div>
          <div class="eyebrow"><span class="dash" /> Launch path</div>
          <h2>Hosted first, portable forever.</h2>
        </div>
        <p class="sub">The cloud flow should feel like the local installer: small surface area, no mystery setup, and the same MIT source available when you want to self-host.</p>
      </div>
      <div class="cloud-steps">
        <article v-for="step in launchSteps" :key="step.title" class="cloud-step">
          <span class="mono-label">{{ step.kicker }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.body }}</p>
        </article>
      </div>
    </div>

    <div class="cloud-band">
      <div>
        <div class="mono-label">What the header button does</div>
        <h2>It routes people to a single hosted deployment page.</h2>
        <p>
          The docs still teach local-first setup. The main action now speaks to the fastest path for new users: a free hosted vault on AutoVault hardware with a remote MCP endpoint they can connect from an agent.
        </p>
      </div>
      <a class="pill-btn primary" href="/quick-start">Read the local docs <UiIcon name="arrow" /></a>
    </div>
  </section>
</template>

<script setup lang="ts">
import UiIcon from "./UiIcon.vue";

const launchSteps = [
  {
    kicker: "01",
    title: "Create the hosted vault",
    body: "Start with a free vault, seeded with bundled skills and the same validation gate used by local installs."
  },
  {
    kicker: "02",
    title: "Connect an agent",
    body: "Point Claude Code, Codex, Cursor, AutoHub, or another MCP client at the remote Streamable HTTP endpoint."
  },
  {
    kicker: "03",
    title: "Invite the team",
    body: "Use OAuth and role-aware filtering so read-only users and owners see the right skill set."
  },
  {
    kicker: "04",
    title: "Stay portable",
    body: "Export, self-host, or run local-only later. Hosted launch is the shortest path, not a lock-in story."
  }
];
</script>
