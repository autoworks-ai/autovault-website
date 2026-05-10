<template>
  <div class="transform-stacker" :data-agent="agent">
    <div class="ts-controls">
      <div class="ts-agent-pick">
        <span class="mono-label">target agent</span>
        <div class="ts-agent-row" role="radiogroup" aria-label="Target agent">
          <button
            v-for="option in agentOptions"
            :key="option"
            type="button"
            class="ts-agent-btn"
            :class="{ active: agent === option }"
            role="radio"
            :aria-checked="agent === option"
            @click="agent = option"
          >{{ option }}</button>
        </div>
      </div>
    </div>

    <div class="ts-grid">
      <div class="ts-col ts-base">
        <div class="card-head">
          <span>base capabilities</span>
          <span class="muted">canonical SKILL.md</span>
        </div>
        <pre class="ts-pre">{{ baseYaml }}</pre>
      </div>

      <div class="ts-col ts-stack">
        <div class="card-head">
          <span>transforms</span>
          <span class="muted">applied in priority order</span>
        </div>
        <ul class="ts-transform-list">
          <li
            v-for="entry in stackedView"
            :key="entry.transform.id"
            class="ts-transform"
            :class="entry.statusClass"
          >
            <label class="ts-transform-head">
              <input
                type="checkbox"
                :checked="enabled.has(entry.transform.id)"
                @change="toggle(entry.transform.id)"
                :aria-label="`Toggle transform ${entry.transform.name}`"
              />
              <span class="ts-name">{{ entry.transform.name }}</span>
              <span class="ts-priority mono-label">priority {{ entry.transform.priority }}</span>
            </label>
            <div class="ts-targets">
              <span class="muted">targets.agents:</span>
              <template v-if="entry.transform.targets.agents.length === 0">
                <span class="ts-target all">all agents</span>
              </template>
              <template v-else>
                <span
                  v-for="target in entry.transform.targets.agents"
                  :key="target"
                  class="ts-target"
                  :class="{ on: target === agent }"
                >{{ target }}</span>
              </template>
            </div>
            <ul class="ts-overrides">
              <li v-if="entry.transform.capability_overrides.network !== undefined" class="ts-override flip">
                <span class="op">flip</span>
                <span>network = {{ entry.transform.capability_overrides.network }}</span>
              </li>
              <li v-if="entry.transform.capability_overrides.filesystem" class="ts-override flip">
                <span class="op">flip</span>
                <span>filesystem = {{ entry.transform.capability_overrides.filesystem }}</span>
              </li>
              <li
                v-for="tool in entry.transform.capability_overrides.tools?.add ?? []"
                :key="`add-${tool}`"
                class="ts-override add"
              ><span class="op">+ add</span><span>{{ tool }}</span></li>
              <li
                v-for="tool in entry.transform.capability_overrides.tools?.remove ?? []"
                :key="`remove-${tool}`"
                class="ts-override remove"
              ><span class="op">- remove</span><span>{{ tool }}</span></li>
            </ul>
            <div class="ts-status muted">{{ entry.statusLabel }}</div>
          </li>
        </ul>
      </div>

      <div class="ts-col ts-rendered">
        <div class="card-head">
          <span>rendered for {{ agent }}</span>
          <span class="muted">{{ appliedCount }} applied</span>
        </div>
        <pre class="ts-pre">{{ renderedYaml }}</pre>
        <div class="ts-foot muted">
          rendered/{{ agent }}/{{ baseSkillName }}/SKILL.md
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  agentOptions,
  baseSkill,
  formatCapabilitiesYaml,
  stackTransforms,
  transformExamples,
  type AgentChoice,
  type AppliedTransform
} from "../data/transformExamples";

const agent = ref<AgentChoice>("claude-code");
const enabled = ref<Set<string>>(new Set(transformExamples.map((t) => t.id)));

function toggle(id: string) {
  const next = new Set(enabled.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  enabled.value = next;
}

const baseSkillName = baseSkill.name;
const baseYaml = computed(() => formatCapabilitiesYaml(baseSkill.capabilities));

const stackResult = computed(() => stackTransforms(baseSkill.capabilities, agent.value, enabled.value));
const renderedYaml = computed(() => formatCapabilitiesYaml(stackResult.value.rendered));
const appliedCount = computed(() => stackResult.value.applied.filter((entry) => entry.reason === "applied").length);

type StackedView = {
  transform: AppliedTransform["transform"];
  statusClass: string;
  statusLabel: string;
};

const stackedView = computed<StackedView[]>(() =>
  stackResult.value.applied.map((entry) => {
    if (entry.reason === "applied") {
      return { transform: entry.transform, statusClass: "applied", statusLabel: "applied" };
    }
    if (entry.reason === "disabled") {
      return { transform: entry.transform, statusClass: "disabled", statusLabel: "disabled" };
    }
    return {
      transform: entry.transform,
      statusClass: "skipped",
      statusLabel: `skipped — targets.agents does not include ${agent.value}`
    };
  })
);
</script>
