<template>
  <section class="about-page">
    <div class="about-hero">
      <div>
        <div class="eyebrow"><span class="dash" /> About</div>
        <h1>Brought to you by Jack, Jason, Flint, Zack, and Daniel — with AutoJack in the loop.</h1>
        <p class="lede">
          AutoVault is built in the open by people who spend their days shipping WordPress products, agent infrastructure, memory systems, and automation workflows.
        </p>
        <div class="about-actions">
          <a class="pill-btn primary" href="/quick-start">Install locally <UiIcon name="arrow" /></a>
          <a class="pill-btn" href="https://drunk.support/">Jack's build notes</a>
          <a class="pill-btn" href="https://automem.ai/">AutoMem</a>
        </div>
      </div>
      <aside class="about-note" aria-label="About AutoVault">
        <div class="mono-label">Why this exists</div>
        <p>
          Skills are becoming agent infrastructure. AutoVault gives teams a small, inspectable place to validate, sign, scope, transform, and serve them before they enter a working agent.
        </p>
        <div class="about-note-grid">
          <div><span>License</span><strong>MIT</strong></div>
          <div><span>Access</span><strong>Local + remote MCP</strong></div>
          <div><span>Mode</span><strong>Local-first</strong></div>
        </div>
      </aside>
    </div>

    <div class="about-team-head">
      <div>
        <div class="eyebrow"><span class="dash" /> People</div>
        <h2>Builders, collaborators, and the agent in the loop.</h2>
      </div>
      <p class="sub">Public profile copy stays deliberately short. Each card links to the source site or profile for the living version.</p>
    </div>

    <div class="about-team-grid">
      <article v-for="member in teamMembers" :key="member.name" class="person-card">
        <a class="person-photo-link" :href="member.href" :aria-label="member.name">
          <span class="person-photo" :class="{ contained: member.imageFit === 'contain' }">
            <img :src="member.image" :alt="member.imageAlt" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
          </span>
        </a>
        <div class="person-body">
          <div class="person-meta">
            <span>{{ member.role }}</span>
            <span>{{ member.company }}</span>
          </div>
          <h3>{{ member.name }}</h3>
          <p>{{ member.bio }}</p>
        </div>
        <div class="person-links">
          <a v-for="link in member.links" :key="link.href" :href="link.href">{{ link.label }}</a>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import UiIcon from "./UiIcon.vue";
import { teamMembers } from "../data/team";
</script>
