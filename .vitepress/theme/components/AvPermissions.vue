<script setup lang="ts">
const cards = [
  {
    axis: 'Axis 01 / Agent',
    title: 'Per-caller profiles',
    body: 'Codex, Claude Code, Cursor, AutoHub, custom — each gets its own filtered view, transformed to its native tool names.',
    chips: [['claude-code', true], ['codex', true], ['cursor', false], ['autohub', false]] as [string, boolean][],
  },
  {
    axis: 'Axis 02 / Device',
    title: 'Machine-bound skills',
    body: 'Laptop, server, ephemeral CI runner — different sets per machine. Production never sees the dev sandbox.',
    chips: [['laptop-jack', true], ['prod-runner-3', false], ['ci-ephemeral', false]] as [string, boolean][],
  },
  {
    axis: 'Axis 03 / Project',
    title: 'Project boundaries',
    body: 'Project-scoped skills don\'t leak across repos. Client work stays inside the client\'s namespace.',
    chips: [['autovault', true], ['client-foo', false], ['internal/ops', false]] as [string, boolean][],
  },
  {
    axis: 'Axis 04 / Tool · User',
    title: 'Fine-grained access',
    body: 'Per-tool permissions, role-based access. Read-only roles see read-only skills.',
    chips: [['role:engineer', true], ['role:design', false], ['role:ops', false]] as [string, boolean][],
  },
]
</script>

<template>
  <section class="av-section" id="scope">
    <div class="av-eyebrow"><span class="dash" /> How the vault stays clean — 03</div>
    <h2 style="margin-top: 16px; max-width: 760px">
      The skill exists.<br />
      <span class="ital">Whether you can see it</span> is a separate question.
    </h2>
    <p class="av-lede" style="margin-top: 16px">
      Every request carries a context. Same folder, filtered four ways — agent, device, project, tool. Dev-machine skills don't surface on a CI runner. Client A skills don't leak into Client B's project.
    </p>

    <div class="av-perm-grid">
      <div v-for="c in cards" :key="c.axis" class="av-perm-card">
        <span class="axis">{{ c.axis }}</span>
        <h4>{{ c.title }}</h4>
        <p style="margin: 0; color: var(--ink-2); font-size: 13.5px">{{ c.body }}</p>
        <div class="examples">
          <span v-for="[label, on] in c.chips" :key="label" class="chip" :class="{ on }">{{ label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
