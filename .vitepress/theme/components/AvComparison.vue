<script setup lang="ts">
type Mark = 'yes' | 'no' | 'partial'
const ROWS: [string, Mark, Mark, Mark, Mark, Mark][] = [
  ['Validation gate at install',        'yes', 'no',      'no',      'partial', 'no'],
  ['Ed25519 signed provenance',         'yes', 'no',      'no',      'no',      'no'],
  ['Per-caller transformation',         'yes', 'no',      'no',      'no',      'no'],
  ['Four-axis permission scoping',      'yes', 'no',      'partial', 'no',      'no'],
  ['Dedup at submission',               'yes', 'no',      'no',      'no',      'no'],
  ['Local-first (no required cloud)',   'yes', 'no',      'no',      'yes',     'yes'],
  ['Self-hostable team mode',           'yes', 'no',      'yes',     'no',      'partial'],
  ['MCP-native + non-MCP bridge',       'yes', 'partial', 'no',      'yes',     'no'],
  ['Progressive disclosure (no bloat)', 'yes', 'no',      'no',      'no',      'no'],
]
function glyph(k: Mark) { return k === 'yes' ? '●' : k === 'partial' ? '◐' : '○' }
</script>

<template>
  <section class="av-section" id="compare">
    <div class="av-eyebrow"><span class="dash" /> Why a vault, not a registry</div>
    <h2 style="margin-top: 16px; max-width: 760px">
      Different shape.<br />
      <span class="ital">Different defaults.</span>
    </h2>
    <p class="av-lede" style="margin-top: 16px">
      A registry is a place other people publish to and you fetch from. A vault is a folder you own. Most of these capabilities only make sense once that distinction is made — they're consequences of the shape, not feature additions on top of a marketplace.
    </p>

    <div class="av-compare">
      <table>
        <thead>
          <tr>
            <th style="width: 34%">Capability</th>
            <th class="us">AutoVault</th>
            <th>Tessl</th>
            <th>ClawdHub</th>
            <th>agentskills.io</th>
            <th>TLC registry</th>
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
