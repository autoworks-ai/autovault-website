<script setup lang="ts">
import { computed, ref } from 'vue'

const cards = [
  {
    axis: 'Axis 01 / Agent',
    enforcement: 'enforced by sync-profiles',
    title: 'Per-caller profiles',
    body: 'Codex, Claude Code, Cursor, AutoHub, custom — each gets its own filtered view, transformed to its native tool names.',
    chips: [['claude-code', true], ['codex', true], ['cursor', false], ['autohub', false]] as [string, boolean][],
    request: 'caller=codex · skill=extract-pdf',
    result: 'visible · rendered with file_read/browser_form',
  },
  {
    axis: 'Axis 02 / Device',
    enforcement: 'host policy',
    title: 'Machine-bound skills',
    body: 'Laptop, server, ephemeral CI runner — different sets per machine. Production never sees the dev sandbox.',
    chips: [['laptop-jack', true], ['prod-runner-3', false], ['ci-ephemeral', false]] as [string, boolean][],
    request: 'device=prod-runner-3 · skill=parse-csv',
    result: 'hidden · local-only write permission',
  },
  {
    axis: 'Axis 03 / Project',
    enforcement: 'host policy',
    title: 'Project boundaries',
    body: 'Project-scoped skills don\'t leak across repos. Client work stays inside the client\'s namespace.',
    chips: [['autovault', true], ['client-foo', false], ['internal/ops', false]] as [string, boolean][],
    request: 'project=client-foo · skill=extract-pdf',
    result: 'hidden · project mismatch',
  },
  {
    axis: 'Axis 04 / Tool · User',
    enforcement: 'host policy',
    title: 'Fine-grained access',
    body: 'Per-tool permissions, role-based access. Read-only roles see read-only skills.',
    chips: [['role:engineer', true], ['role:design', false], ['role:ops', false]] as [string, boolean][],
    request: 'role=design · tool=fs.write',
    result: 'blocked · role receives read-only render',
  },
]

const active = ref(0)
const activeCard = computed(() => cards[active.value])
</script>

<template>
  <section class="av-section" id="scope">
    <div class="av-eyebrow"><span class="dash" /> How the vault stays clean — 03</div>
    <h2 style="margin-top: 16px; max-width: 760px">
      The skill exists.<br />
      <span class="ital">Whether you can see it</span> is a separate question.
    </h2>
    <p class="av-lede" style="margin-top: 16px">
      Every request carries a context. Same folder, filtered four ways — agent, device, project, tool. Dev-machine skills don’t surface on a CI runner. Client A skills don’t leak into Client B’s project.
    </p>
    <p class="av-perm-note">
      The agent axis is enforced at sync time by <code>autovault sync-profiles</code>.
      Device, project and tool scoping are host-policy hooks the local installer
      composes — they are not validated by the admission gate.
      <a href="/permissions#install-scope">How the three layers differ →</a>
    </p>

    <div class="av-perm-grid">
      <button
        v-for="(c, index) in cards"
        :key="c.axis"
        class="av-perm-card"
        :class="{ active: active === index }"
        type="button"
        @click="active = index"
        @mouseenter="active = index"
      >
        <span class="axis"
          >{{ c.axis }}
          <span class="axis-enforcement">{{ c.enforcement }}</span></span
        >
        <h4>{{ c.title }}</h4>
        <p style="margin: 0; color: var(--ink-2); font-size: 13.5px">{{ c.body }}</p>
        <div class="examples">
          <span v-for="[label, on] in c.chips" :key="label" class="chip" :class="{ on }">{{ label }}</span>
        </div>
      </button>
    </div>

    <div class="av-scope-simulator" :key="active">
      <div class="sim-line">
        <span>incoming context</span>
        <strong>{{ activeCard.request }}</strong>
      </div>
      <div class="sim-flow">
        <span>request</span>
        <span>profile filter</span>
        <span>scoped render</span>
      </div>
      <div class="sim-line result">
        <span>vault response</span>
        <strong>{{ activeCard.result }}</strong>
      </div>
    </div>
  </section>
</template>
