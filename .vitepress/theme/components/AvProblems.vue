<script setup lang="ts">
const items = [
  { num: '01', title: 'Skill drift',           body: 'The same SKILL.md gets copy-pasted across repos and adapted locally. No upstream tracking, no merge story. Vendored code without a lockfile.', badge: 'no provenance' },
  { num: '02', title: 'Supply chain attacks',  body: 'The same supply-chain attacks that hit package registries will hit skills too. AutoVault assumes that and gates before admission.',          badge: 'gate first' },
  { num: '03', title: 'Duplicate explosion',   body: 'Agents write skills on the fly with no dedup. You end up with seventeen variants of extract-pdf-text and the agent picks one at random.',     badge: 'no dedup' },
  { num: '04', title: 'Platform inconsistency',body: 'Same skill, three forks — each calling agent expects different tool names. Fork once, maintain three.',                                       badge: 'fork × 3' },
  { num: '05', title: 'Context bloat',         body: 'Every agent loads every SKILL.md at startup. Forty skills means thousands of tokens burned before the conversation begins.',                  badge: 'token tax' },
  { num: '06', title: 'No permission scoping', body: 'Skills load globally. No per-project, per-device, per-tool gating. Dev-machine skills leak into prod, client A skills leak to client B.',     badge: 'leaks by default' },
]
</script>

<template>
  <section class="av-section" id="problems">
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; gap: 32px">
      <div>
        <h2 style="max-width: 720px">If you're running AI <a href="https://agentskills.io" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; text-underline-offset: 4px">skills</a>, you have these problems.</h2>
      </div>
      <p class="av-lede" style="max-width: 380px">
        The format itself is fine. What's missing is everything around it. Six small papercuts that compound the more skills you keep around.
      </p>
    </div>
    <div class="av-problems">
      <div v-for="p in items" :key="p.num" class="av-problem">
        <div class="num">PROBLEM / {{ p.num }}</div>
        <h3>{{ p.title }}</h3>
        <p>{{ p.body }}</p>
        <span class="badge">{{ p.badge }}</span>
      </div>
    </div>
  </section>
</template>
