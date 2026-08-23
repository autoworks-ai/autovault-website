<script setup lang="ts">
import { comparisonPlayers, comparisonSources, homepageComparisonRows, type ComparisonMark } from '../data/marketing'

function glyph(k: ComparisonMark) { return k === 'yes' ? '●' : k === 'partial' ? '◐' : '○' }
// Screen readers announced this 40-cell grid as forty repetitions of "●" with
// the legend in a separate, purely visual div. The glyph stays decorative; the
// word is what gets announced.
function markLabel(k: ComparisonMark) { return k === 'yes' ? 'shipped' : k === 'partial' ? 'partial' : 'absent' }
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
      Skillfish is the closest direct neighbor for broad install, update, sync, and team bundle workflows across many agents. Managers and registries place skills; AutoVault admits trusted source, signs it, scopes it, and renders caller-specific output from one canonical skill without long-lived forks.
    </p>

    <div class="av-compare">
      <table>
        <thead>
          <tr>
            <th scope="col" style="width: 34%">Capability</th>
            <th
              v-for="player in comparisonPlayers"
              :key="player.key"
              scope="col"
              :class="{ us: player.us }"
            >
              <a v-if="player.href" :href="player.href">{{ player.name }}</a>
              <span v-else>{{ player.name }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in homepageComparisonRows" :key="r[0]">
            <th scope="row" class="feat">{{ r[0] }}</th>
            <td
              v-for="(mark, index) in rowMarks(r)"
              :key="comparisonPlayers[index]?.key ?? index"
              :class="{ us: comparisonPlayers[index]?.us }"
            >
              <span :class="mark" aria-hidden="true">{{ glyph(mark) }}</span>
              <span class="visually-hidden">{{ markLabel(mark) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="av-compare-legend" aria-hidden="true">
      <span><span class="yes">●</span> shipped</span>
      <span><span class="partial">◐</span> partial</span>
      <span><span class="no">○</span> absent</span>
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
