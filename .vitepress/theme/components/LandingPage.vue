<script setup lang="ts">
import AvTopbar from "./AvTopbar.vue";
import AvFooter from "./AvFooter.vue";
import AvSpecHero from "./AvSpecHero.vue";
import AvProblems from "./AvProblems.vue";
import AvDriftDiagram from "./AvDriftDiagram.vue";
import AvFolderHero from "./AvFolderHero.vue";
import AvValidationGate from "./AvValidationGate.vue";
import AvTransformationDiagram from "./AvTransformationDiagram.vue";
import AvPermissions from "./AvPermissions.vue";
import AvTeamMode from "./AvTeamMode.vue";
import AvQuickStart from "./AvQuickStart.vue";
import AvComparison from "./AvComparison.vue";
</script>

<template>
  <div class="av-home">
    <AvTopbar />
    <main class="av-page" data-screen-label="01 Home">
      <AvSpecHero />
      <AvProblems />
      <AvDriftDiagram />
      <AvFolderHero />

      <div class="av-tech-marker">
        <span class="line" />
        <span class="lbl">How the vault stays clean</span>
        <span class="line" />
      </div>

      <AvValidationGate />
      <AvTransformationDiagram />
      <AvPermissions />
      <AvTeamMode />
      <AvQuickStart />
      <AvComparison />
    </main>
    <AvFooter />
  </div>
</template>

<style scoped>
.av-tech-marker {
  display: flex;
  align-items: center;
  gap: 18px;
  max-width: 720px;
  margin: 80px auto 0;
  padding: 0 0 16px;
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.av-tech-marker .line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--line-2), transparent);
}
</style>
