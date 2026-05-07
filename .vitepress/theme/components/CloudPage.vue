<template>
  <section class="cloud-page">
    <div class="cloud-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> Hosted launch</div>
        <h1>Reserve a paid hosted AutoVault namespace.</h1>
        <p class="lede">
          Use the hosted path when you want an account, Stripe-backed access, and a reserved vault URL while cloud sync is being built.
        </p>
        <div class="about-actions">
          <a class="pill-btn primary" href="#launch-path">Start hosted launch <UiIcon name="arrow" /></a>
          <a class="pill-btn" href="/quick-start">Run local instead</a>
          <a class="pill-btn" href="https://github.com/autoworks-ai/autovault">Source</a>
        </div>
      </div>
      <div class="cloud-terminal" aria-label="Hosted onboarding preview">
        <div class="terminal-head"><span class="dot live" /><span class="dot" /><span class="dot" /><span class="ttl">autovault local</span></div>
        <div class="cloud-terminal-body">
          <div><span class="pmt">$</span> curl -fsSL https://autovault.sh | sh</div>
          <div class="ok">local_cli: installed</div>
          <div class="ok">clerk: account created</div>
          <div class="ok">stripe: test subscription active</div>
          <div class="ok">namespace: https://vault.autovault.dev/your-team</div>
          <div class="out">cloud_sync: coming soon</div>
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

    <HostedVaultFunnel entry="deploy" />

    <div class="cloud-band">
      <div>
        <div class="mono-label">What the header button does</div>
        <h2>It routes people to a single hosted deployment page.</h2>
        <p>
          The docs still teach local-first setup. The main action now speaks to the first paid milestone for new users: create an account, subscribe, and reserve the namespace they will sync to once hosted sync ships.
        </p>
      </div>
      <a class="pill-btn primary" href="/quick-start">Read the local docs <UiIcon name="arrow" /></a>
    </div>
  </section>
</template>

<script setup lang="ts">
import HostedVaultFunnel from "./HostedVaultFunnel.vue";
import UiIcon from "./UiIcon.vue";

const launchSteps = [
  {
    kicker: "01",
    title: "Create the account",
    body: "Start with Clerk sign-in so hosted onboarding can map the session to an internal AutoVault user."
  },
  {
    kicker: "02",
    title: "Subscribe in Stripe",
    body: "Use test-mode Checkout first. The webhook records subscription state before namespace reservation."
  },
  {
    kicker: "03",
    title: "Reserve the namespace",
    body: "Hold a stable vault URL like https://vault.autovault.dev/your-team while the cloud sync commands are still disabled."
  },
  {
    kicker: "04",
    title: "Stay portable",
    body: "Keep using the local CLI for signing and profile sync. Hosted onboarding is the shortest path, not a lock-in story."
  }
];
</script>
