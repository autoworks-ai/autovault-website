<template>
  <div class="dir-page">
    <header class="dir-header">
      <div>
        <div class="eyebrow"><span class="dash" /> Skills directory</div>
        <h1>Browse signed skills.</h1>
        <p class="lede">Browse 241 community skills, all signed, all dedup'd, all transformation-mapped to the major agents. Filter by what you run, what you need, who you trust.</p>
      </div>
      <div class="dir-stats">
        <div class="stat"><div class="mono-label">Skills</div><div class="val">241</div><div class="arg" style="font-size: 10.5px">+18 this week</div></div>
        <div class="stat"><div class="mono-label">Orgs</div><div class="val">38</div><div class="arg" style="font-size: 10.5px">verified</div></div>
        <div class="stat"><div class="mono-label">Installs</div><div class="val">14.2k</div><div class="arg" style="font-size: 10.5px">local-first</div></div>
        <div class="stat"><div class="mono-label">Rejects</div><div class="val">11.4%</div><div class="arg" style="font-size: 10.5px">caught by gate</div></div>
      </div>
    </header>

    <div class="dir-shell">
      <aside class="dir-side">
        <FilterGroup title="Agent" :items="agentRows" :selected="selectedAgents" @toggle="toggleAgent" @clear="selectedAgents.clear()" />
        <FilterGroup title="Category" :items="categoryRows" :selected="selectedCategories" @toggle="toggleCategory" @clear="selectedCategories.clear()" />
        <FilterGroup title="Org" :items="orgRows" :selected="selectedOrgs" @toggle="toggleOrg" @clear="selectedOrgs.clear()" />
      </aside>

      <main class="dir-main">
        <div class="toolbar">
          <label class="dir-search"><UiIcon name="search" /><span class="visually-hidden">Search skills</span><input v-model="query" type="text" placeholder="Search skills, authors, capabilities..." /><span class="chip">⌘K</span></label>
          <div class="segmented" aria-label="Sort skills">
            <button class="seg-btn" :class="{ active: sort === 'installs' }" type="button" @click="sort = 'installs'">Most installed</button>
            <button class="seg-btn" :class="{ active: sort === 'recent' }" type="button" @click="sort = 'recent'">Recent</button>
            <button class="seg-btn" :class="{ active: sort === 'name' }" type="button" @click="sort = 'name'">Name</button>
          </div>
          <div class="segmented" aria-label="View">
            <button class="seg-btn" :class="{ active: view === 'grid' }" type="button" @click="view = 'grid'">Grid</button>
            <button class="seg-btn" :class="{ active: view === 'list' }" type="button" @click="view = 'list'">List</button>
          </div>
        </div>

        <div v-if="activeChips.length" class="dir-active">
          <span v-for="chip in activeChips" :key="chip.label" class="chip on">{{ chip.label }} <button type="button" style="background: none; border: 0; color: inherit; cursor: pointer" @click="chip.clear">×</button></span>
          <button class="seg-btn" type="button" @click="clearAll">clear all</button>
        </div>

        <div class="mono-label">{{ filtered.length }} {{ filtered.length === 1 ? "skill" : "skills" }}</div>

        <template v-if="filtered.length">
          <div v-if="view === 'grid'">
            <div v-if="!activeChips.length && !query" class="dir-featured-row">
              <SkillTile v-for="(skill, index) in featured" :key="skill.name" :skill="skill" :big="index === 0" />
            </div>
            <div class="dir-grid">
              <SkillTile v-for="skill in gridSkills" :key="skill.name" :skill="skill" />
            </div>
          </div>
          <div v-else class="dir-list">
            <SkillListItem v-for="skill in filtered" :key="skill.name" :skill="skill" />
          </div>
        </template>
        <div v-else class="empty">no skills match — <button class="seg-btn" type="button" @click="clearAll">clear filters</button></div>

        <div class="footer-row" style="justify-content: space-between"><span>Showing {{ filtered.length }} of 241 skills</span><span>Page 1 / 14</span></div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref } from "vue";
import UiIcon from "./UiIcon.vue";
import { agents, categories, filterSkills, orgs, skills, sortSkills, type AgentId, type Skill, type SkillCategory, type SkillSort } from "../data/skills";

const query = ref("");
const sort = ref<SkillSort>("installs");
const view = ref<"grid" | "list">("grid");
const selectedAgents = reactive(new Set<AgentId>());
const selectedCategories = reactive(new Set<SkillCategory>());
const selectedOrgs = reactive(new Set<string>());

const filtered = computed(() => sortSkills(filterSkills(skills, {
  query: query.value,
  agents: selectedAgents,
  categories: selectedCategories,
  orgs: selectedOrgs
}), sort.value));

const featured = computed(() => filtered.value.filter((skill) => skill.featured).slice(0, 3));
const gridSkills = computed(() => (activeChips.value.length || query.value ? filtered.value : filtered.value.filter((skill) => !featured.value.includes(skill))));

const agentRows = computed(() => agents.map((agent) => ({ id: agent.id, label: agent.label, count: skills.filter((skill) => skill.agents.includes(agent.id)).length, color: agent.color })));
const categoryRows = computed(() => categories.map((category) => ({ id: category.id, label: category.label, count: skills.filter((skill) => skill.category === category.id).length })));
const orgRows = computed(() => orgs.map((org) => ({ id: org.id, label: org.label, count: skills.filter((skill) => skill.org === org.id).length })));

const activeChips = computed(() => [
  ...agents.filter((agent) => selectedAgents.has(agent.id)).map((agent) => ({ label: agent.label, clear: () => selectedAgents.delete(agent.id) })),
  ...categories.filter((category) => selectedCategories.has(category.id)).map((category) => ({ label: category.label, clear: () => selectedCategories.delete(category.id) })),
  ...orgs.filter((org) => selectedOrgs.has(org.id)).map((org) => ({ label: org.label, clear: () => selectedOrgs.delete(org.id) }))
]);

function toggleAgent(id: string) {
  toggleSet(selectedAgents, id as AgentId);
}
function toggleCategory(id: string) {
  toggleSet(selectedCategories, id as SkillCategory);
}
function toggleOrg(id: string) {
  toggleSet(selectedOrgs, id);
}
function toggleSet<T>(set: Set<T>, value: T) {
  set.has(value) ? set.delete(value) : set.add(value);
}
function clearAll() {
  selectedAgents.clear();
  selectedCategories.clear();
  selectedOrgs.clear();
  query.value = "";
}

const FilterGroup = defineComponent({
  props: {
    title: { type: String, required: true },
    items: { type: Array as () => Array<{ id: string; label: string; count: number; color?: string }>, required: true },
    selected: { type: Object as () => Set<string>, required: true }
  },
  emits: ["toggle", "clear"],
  setup(props, { emit }) {
    return () => h("div", { class: "filter-block", style: "margin-bottom:28px" }, [
      h("div", { class: "mono-label", style: "display:flex;justify-content:space-between" }, [h("span", props.title), props.selected.size ? h("button", { class: "seg-btn", onClick: () => emit("clear") }, "clear") : null]),
      ...props.items.map((item) => h("button", { class: ["fg-row", props.selected.has(item.id) ? "on" : ""], type: "button", onClick: () => emit("toggle", item.id) }, [
        h("span", { class: "cb" }, props.selected.has(item.id) ? "✓" : ""),
        item.color ? h("span", { class: "swatch", style: { background: item.color } }) : null,
        h("span", { style: "flex:1;text-align:left" }, item.label),
        h("span", { class: "muted" }, item.count)
      ]))
    ]);
  }
});

function skillAgents(skill: Skill) {
  return agents.map((agent) => ({ ...agent, on: skill.agents.includes(agent.id) }));
}

const SkillTile = defineComponent({
  props: { skill: { type: Object as () => Skill, required: true }, big: Boolean },
  setup(props) {
    return () => h("article", { class: ["skill-tile", props.skill.featured ? "featured" : "", props.big ? "big" : ""] }, [
      h("a", { class: "stl-main", href: "/skill-detail.html" }, [
        h("div", { class: "stl-head" }, [
          h("span", { class: "stl-icon" }, props.skill.icon),
          h("div", { class: "stl-name" }, [h("span", { class: "name" }, props.skill.name), h("span", { class: "org" }, props.skill.org)]),
          h("span", { class: "verified" }, "SIGNED")
        ]),
        h("p", { class: "stl-desc" }, props.skill.desc),
        h("div", { class: "stl-agents" }, skillAgents(props.skill).map((agent) => h("span", { class: "ag", style: agent.on ? { background: agent.color, color: "#0a0d11", borderColor: agent.color } : undefined }, agent.id)))
      ]),
      h("div", { class: "stl-meta" }, [h("span", `v${props.skill.v}`), h("span", props.skill.license), h("span", { style: "flex:1" }), h("span", `${props.skill.installs.toLocaleString()} installs`), h("button", { class: "copy-btn", type: "button" }, "Install")])
    ]);
  }
});

const SkillListItem = defineComponent({
  props: { skill: { type: Object as () => Skill, required: true } },
  setup(props) {
    return () => h("a", { class: "dir-list-item", href: "/skill-detail.html" }, [
      h("div", { class: "stl-head" }, [h("span", { class: "stl-icon" }, props.skill.icon), h("div", { class: "stl-name" }, [h("span", { class: "name" }, props.skill.name), h("span", { class: "org" }, props.skill.org)])]),
      h("div", { class: "desc-cell" }, props.skill.desc),
      h("div", { class: "agents-cell" }, skillAgents(props.skill).map((agent) => h("span", { class: "ag", style: agent.on ? { background: agent.color, color: "#0a0d11", borderColor: agent.color } : undefined }, agent.id))),
      h("span", { class: "meta-cell" }, `v${props.skill.v}`),
      h("span", { class: "meta-cell" }, props.skill.installs.toLocaleString())
    ]);
  }
});
</script>
