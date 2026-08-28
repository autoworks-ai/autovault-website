<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { clerkBrand } from '../clerk'
import { HOSTED_TRIAL_DAYS } from '../data/product'
</script>

<template>
  <section class="av-section av-team" id="team">
    <div class="av-team-grid">
      <div>
        <div class="av-eyebrow"><span class="dash" /> Team mode</div>
        <h2 style="margin-top: 16px; max-width: 540px">
          Same vault.<br />
          <span class="ital">Made shareable.</span>
        </h2>
        <p class="av-lede" style="margin-top: 24px">
          When the folder needs to live somewhere your team can reach,
          AutoVault exposes the same engine over remote MCP. No new format,
          no new gate — same validation, same signatures, same
          per-caller transformation. Just routed through a server you run
          (or one we run for you).
        </p>

        <div class="av-team-routes">
          <div class="route">
            <div class="route-num">A</div>
            <div class="route-body">
              <div class="route-title">Self-host</div>
              <div class="route-desc">Drop the binary on your own server. Point your team's <code>~/.autovault</code> at it. MIT licensed, no phoning home. A catalog is a signed static file tree, so any host that serves JSON will do, and <code>autovault link</code> takes a plain directory too.</div>
            </div>
          </div>
          <div class="route">
            <div class="route-num">B</div>
            <div class="route-body">
              <div class="route-title">Hosted at autovault.dev <span class="route-tag">private beta</span></div>
              <div class="route-desc">For teams who'd rather not run a server. Pair a machine with a code, admit it from the browser, and it pulls signed skills over HTTPS. Same engine, same gate. Publishing a catalog is still hands-on in private beta.</div>
              <!-- The number is interpolated, never typed: HOSTED_TRIAL_DAYS
                   is pinned to the Cloudflare var that Checkout reads, so this
                   line cannot outlive the trial it advertises. See
                   tests/hostedTrial.test.ts. -->
              <div v-if="HOSTED_TRIAL_DAYS > 0" class="route-cta">
                <a class="route-btn" :href="clerkBrand.cloudPath">Try it free for {{ HOSTED_TRIAL_DAYS }} days</a>
                <span class="route-fine">No card up front. <a href="/hosted-sync">How hosted sync works</a></span>
              </div>
              <div v-else class="route-cta">
                <a class="route-btn" :href="clerkBrand.cloudPath">See pricing</a>
                <span class="route-fine"><a href="/hosted-sync">How hosted sync works</a></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="av-team-diagram">
        <p class="av-team-caption">Illustration — not a live deployment.</p>
        <div class="av-team-cloud" aria-hidden="true">
          <div class="cloud-head">
            <UiIcon name="check" :size="11" />
            <span>vault.team.acme.dev</span>
            <span class="status">healthy</span>
          </div>
          <div class="cloud-body">
            <div class="cloud-row"><span class="lbl">skills</span><span class="val">142 signed</span></div>
            <div class="cloud-row"><span class="lbl">members</span><span class="val">28</span></div>
            <div class="cloud-row"><span class="lbl">scopes</span><span class="val">14 projects · 3 roles</span></div>
            <div class="cloud-row"><span class="lbl">protocol</span><span class="val">remote MCP</span></div>
          </div>
        </div>

        <div class="av-team-clients" aria-hidden="true">
          <div class="client">
            <span class="cdot" /><span>jack@laptop</span><span class="ago">just now</span>
          </div>
          <div class="client">
            <span class="cdot" /><span>maya@laptop</span><span class="ago">2m</span>
          </div>
          <div class="client">
            <span class="cdot" /><span>ci-runner-3</span><span class="ago">14m</span>
          </div>
          <div class="client dim">
            <span class="cdot" style="background: var(--ink-4)" /><span>devon@laptop</span><span class="ago">offline</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.av-team-caption {
  margin: 0 0 10px;
  color: var(--ink-4);
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.route-cta {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.route-btn {
  display: inline-block;
  padding: 8px 15px;
  border-radius: 8px;
  background: var(--accent);
  color: #062821;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
}
.route-btn:hover {
  filter: brightness(1.08);
}
.route-fine {
  font-size: 12px;
  color: var(--ink-4);
}
.route-fine a {
  color: var(--ink-3);
}

.route-tag {
  margin-left: 8px;
  padding: 2px 7px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  vertical-align: middle;
}

.av-team-grid {
  display: grid;
  grid-template-columns: 1fr 0.85fr;
  gap: 80px;
  align-items: center;
}
.av-team-routes {
  margin-top: 36px;
  display: grid; gap: 16px;
}
.route {
  display: grid; grid-template-columns: 32px 1fr; gap: 16px;
  padding: 18px 20px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 8px;
}
.route-num {
  width: 28px; height: 28px;
  border: 1px solid var(--line-2); border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--mono); font-size: 12px; color: var(--ink-2);
  background: var(--bg-2);
}
.route-title { font-size: 14px; font-weight: 500; color: var(--ink); }
.route-desc {
  font-size: 13px; color: var(--ink-3); margin-top: 6px; line-height: 1.55;
}
.route-desc code {
  font-family: var(--mono); font-size: 0.92em;
  color: var(--ink-2); background: var(--bg-2);
  padding: 1px 5px; border-radius: 3px;
}

.av-team-diagram {
  display: grid; gap: 16px;
}
.av-team-cloud {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 10px; overflow: hidden;
}
.cloud-head {
  padding: 12px 16px; border-bottom: 1px solid var(--line);
  background: var(--bg-2);
  display: flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-size: 12px; color: var(--ink);
}
.cloud-head .status {
  margin-left: auto;
  font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--accent);
}
.cloud-body { padding: 16px 18px; display: grid; gap: 8px; }
.cloud-row {
  display: flex; justify-content: space-between;
  font-family: var(--mono); font-size: 12.5px;
}
.cloud-row .lbl { color: var(--ink-3); }
.cloud-row .val { color: var(--ink); }

.av-team-clients {
  display: grid; gap: 6px;
  padding: 12px 16px;
  background: var(--bg-2); border: 1px solid var(--line);
  border-radius: 8px;
}
.client {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-size: 12px; color: var(--ink-2);
  padding: 4px 0;
}
.client.dim { color: var(--ink-4); }
.client .cdot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 6px var(--accent);
}
.client .ago {
  margin-left: auto;
  font-size: 10.5px; letter-spacing: 0.04em;
  color: var(--ink-4);
}

@media (max-width: 1080px) {
  .av-team-grid { grid-template-columns: 1fr; gap: 48px; }
}
</style>
