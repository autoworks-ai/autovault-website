<script setup lang="ts">
import { comparisonPlayers, comparisonSources, homepageComparisonRows, type ComparisonMark } from '../data/marketing'

function glyph(k: ComparisonMark) { return k === 'yes' ? '●' : k === 'partial' ? '◐' : '○' }
function rowMarks(row: (typeof homepageComparisonRows)[number]) { return row.slice(1) as ComparisonMark[] }
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
            <th
              v-for="player in comparisonPlayers"
              :key="player.key"
              :class="{ us: player.us }"
            >
              <a v-if="player.href" :href="player.href">{{ player.name }}</a>
              <span v-else>{{ player.name }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in homepageComparisonRows" :key="r[0]">
            <td class="feat">{{ r[0] }}</td>
            <td
              v-for="(mark, index) in rowMarks(r)"
              :key="comparisonPlayers[index]?.key ?? index"
              :class="{ us: comparisonPlayers[index]?.us }"
            >
              <span :class="mark">{{ glyph(mark) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top: 16px; font-family: var(--mono); font-size: 11px; color: var(--ink-3); display: flex; gap: 24px; justify-content: center">
      <span><span class="yes" style="color: var(--accent)">●</span> shipped</span>
      <span><span class="partial" style="color: var(--warn)">◐</span> partial</span>
      <span><span class="no" style="color: var(--ink-4)">○</span> absent</span>
    </div>
    <nav class="av-compare-sources" aria-label="Comparison source checks">
      <span>Source checks</span>
      <ul>
        <li v-for="source in comparisonSources" :key="source.href">
          <a :href="source.href">{{ source.label }}</a>
        </li>
      </ul>
    </nav>
  </section>
</template>
