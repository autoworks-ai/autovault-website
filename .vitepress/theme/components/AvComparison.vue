<script setup lang="ts">
type Mark = 'yes' | 'no' | 'partial'
const ROWS: [string, Mark, Mark, Mark, Mark, Mark][] = [
  ['Multi-agent install and sync',      'yes', 'yes',     'partial', 'partial', 'no'],
  ['Validation gate at admission',      'yes', 'partial', 'partial', 'no',      'no'],
  ['Ed25519 signed provenance',         'yes', 'no',      'partial', 'no',      'no'],
  ['Per-caller transformation',         'yes', 'partial', 'partial', 'no',      'no'],
  ['Four-axis permission scoping',      'yes', 'partial', 'partial', 'no',      'no'],
  ['Dedup before local use',            'yes', 'partial', 'partial', 'no',      'no'],
  ['Local-first (no required cloud)',   'yes', 'yes',     'partial', 'yes',     'yes'],
  ['Self-hostable team mode',           'yes', 'partial', 'partial', 'no',      'partial'],
  ['Progressive disclosure (no bloat)', 'yes', 'partial', 'partial', 'no',      'no'],
]
function glyph(k: Mark) { return k === 'yes' ? '●' : k === 'partial' ? '◐' : '○' }
</script>

<template>
  <section class="av-section" id="compare">
    <div class="av-eyebrow"><span class="dash" /> Vault vs managers and registries</div>
    <h2 style="margin-top: 16px; max-width: 760px">
      Different shape.<br />
      <span class="ital">Different defaults.</span>
    </h2>
    <p class="av-lede" style="margin-top: 16px">
      Skillfish is the closest direct neighbor: broad install, update, sync, and team bundle workflows across many agents. AutoVault is narrower on purpose: every skill enters a local vault through a gate, gets signed, scoped, and rendered from one canonical source.
    </p>

    <div class="av-compare">
      <table>
        <thead>
          <tr>
            <th style="width: 34%">Capability</th>
            <th class="us">AutoVault</th>
            <th>Skillfish</th>
            <th>Tessl</th>
            <th>SkillKit / specs</th>
            <th>Manual folders</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in ROWS" :key="r[0]">
            <td class="feat">{{ r[0] }}</td>
            <td class="us"><span :class="r[1]">{{ glyph(r[1]) }}</span></td>
            <td><span :class="r[2]">{{ glyph(r[2]) }}</span></td>
            <td><span :class="r[3]">{{ glyph(r[3]) }}</span></td>
            <td><span :class="r[4]">{{ glyph(r[4]) }}</span></td>
            <td><span :class="r[5]">{{ glyph(r[5]) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top: 16px; font-family: var(--mono); font-size: 11px; color: var(--ink-3); display: flex; gap: 24px; justify-content: center">
      <span><span class="yes" style="color: var(--accent)">●</span> shipped</span>
      <span><span class="partial" style="color: var(--warn)">◐</span> partial</span>
      <span><span class="no" style="color: var(--ink-4)">○</span> absent</span>
    </div>
  </section>
</template>
