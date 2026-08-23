<template>
  <!-- `#launch-path` is the fragment on the Stripe success_url/cancel_url
       (functions/api/_lib/stripe.js), the Clerk post-auth redirect
       (theme/clerk.ts) and safeReturnTo's fallback. Nothing on the page
       carried the id, so every one of those returns landed on a dead
       fragment and never scrolled to the funnel. -->
  <section
    id="launch-path"
    class="cv-page"
    :class="`cv-stage-${stage}`"
    :aria-busy="!revealed"
  >
    <!-- The load screen IS the vault. An OVERLAY rather than a branch, so the
         shell below is present in the prerendered HTML and there is no layout
         jump when /api/me resolves.

         That overlay is also what makes stage "loading" safe: the shell
         underneath is still rendering the pre-vault card, funnel and all,
         because keeping that component mounted across provisioning is
         load-bearing (see the v-show below). This veil is opaque and covers
         the whole shell, and `inert` takes the shell out of the focus and
         accessibility trees, so a checkout button behind it is unreachable
         rather than merely unpainted. Both properties are pinned by a test.

         The mark is the SAME 72px vault the focal card uses, with the same
         two documented props doing the work: `working` is BrandMark's own
         loading graphic (the dial sweeps; it is deliberately not a spinner),
         and `unlocking` is its one 700ms turn-and-retract. Its doc comment
         says to apply that in the same tick the state flips, which is why all
         three bindings read the same ref -- they cannot disagree. Nothing new
         is animated on the mark itself. -->
    <div v-if="!revealed" class="cv-boot" :class="{ opening: bootOpening }">
      <div class="cv-boot-vault" aria-hidden="true">
        <span class="cv-boot-halo" />
        <span class="cv-boot-ring inner" />
        <span class="cv-boot-ring mid" />
        <span class="cv-boot-ring outer" />
        <span class="cv-boot-mark"
          ><BrandMark
            :size="72"
            :state="bootOpening ? 'unlocked' : 'locked'"
            :working="!bootOpening"
            :unlocking="bootOpening"
            show-depth
        /></span>
      </div>
      <p>Opening your hosted vault…</p>
    </div>

    <!-- One shell, every stage. Signup used to render as a separate page with
         its own visual language and its own four-step rail, then hard-switch
         to this shell and a different two-step rail once a vault existed.
         Only the main area changes now; the chrome never moves. -->
    <div
      class="cv-shell"
      :class="{ locked: !signedIn, booting: !revealed }"
      :inert="!revealed">
      <aside class="cv-side" aria-label="Vault navigation">
        <div class="cv-brand">
          <span class="cv-brand-mark"
            ><BrandMark
              :size="22"
              :state="vault ? 'unlocked' : 'locked'"
              show-depth
          /></span>
          <span
            class="cv-brand-ns"
            :class="{ pending: !vault }"
            :title="vault ? undefined : 'Reserved after checkout'"
            ><span class="cv-slash">/</span>{{ vaultSlug }}</span
          >
        </div>

        <nav class="cv-nav">
          <!-- Docs and Support are plain destinations, not panels: item.href
               is set only for those two, and that is what decides the tag.
               An <a> gives them real navigation semantics -- open-in-new-tab,
               copy link, no JS required -- that a button standing in for a
               link would not. -->
          <component
            :is="item.href ? 'a' : 'button'"
            v-for="item in navItems"
            :key="item.key"
            :type="item.href ? undefined : 'button'"
            class="cv-nav-item"
            :class="item.cls"
            :href="item.href ?? undefined"
            :target="item.external ? '_blank' : undefined"
            :rel="item.external ? 'noopener' : undefined"
            :disabled="item.disabled"
            :aria-current="item.active ? 'true' : undefined"
            @click="onNavClick(item)"
          >
            <span class="cv-nav-ic" aria-hidden="true" v-html="item.icon" />
            <span class="cv-nav-label">{{ item.label }}</span>
            <span v-if="item.badge === 'soon'" class="cv-nav-soon">soon</span>
            <span v-else-if="item.badge === 'new'" class="cv-nav-new">new</span>
            <span v-else-if="item.locked" class="cv-nav-lock" aria-hidden="true"
              >🔒</span
            >
          </component>
        </nav>

        <CloudAccountMenu
          :name="accountName"
          :email="accountEmailShort"
          :status-text="subscriptionState.text"
          :avatar-style="avatarStyle"
          :signed-in="signedIn"
          :busy="busy"
          @billing="showBilling"
        />
      </aside>

      <main class="cv-content">
        <!-- Ambient vault. The page's subject, present in its own background
             at every stage rather than only where a card happens to show a
             mark. Decorative and inert: aria-hidden, pointer-events none, and
             it sits behind the content on z-index -1 (see .cv-content's
             stacking context in the style block).

             `state` follows vaultOpen because this page's rule is that the
             mark IS the progress indicator -- a background vault that showed
             "open" while the rail still had steps left would be the one
             element on the page saying something untrue.

             `unlocking` is the SAME BrandMark machinery the focal mark uses,
             driven by a separate ref: the arrival is a load-time gesture and
             the celebration is an event-time one, and giving them one ref
             would put the first-machine-admit ordering (PR #106) at the mercy
             of a page load. Only bound while the vault is genuinely open,
             because brand-mark-unlock ends on the UNLOCKED resting state --
             played over a locked mark it would animate the dial away and then
             transition it back, a vault that opens and shuts.

             No `working`: a dial sweeping in the background during a routine
             device poll is noise, and the focal/strip marks already report it. -->
        <div
          v-if="ambientVault"
          class="cv-ambient"
          :class="{ arriving: vaultArriving }"
          aria-hidden="true"
        >
          <span class="cv-ambient-halo" />
          <span class="cv-ambient-mark">
            <BrandMark
              :size="300"
              :state="vaultOpen ? 'unlocked' : 'locked'"
              :unlocking="vaultArriving && vaultOpen"
              show-depth
            />
          </span>
        </div>

        <header class="cv-topbar">
          <div>
            <div class="cv-eyebrow"><span class="cv-spark" /> Hosted vault</div>
            <div class="cv-crumb">
              <span class="cv-crumb-host">vault.autovault.dev</span> /
              {{ vaultSlug }}
            </div>
            <!-- Named, because each panel below points its region label here:
                 the heading is what tells assistive tech which panel the
                 sidebar just swapped in. -->
            <h1 id="cv-page-title">{{ pageTitle }}</h1>
          </div>
          <div class="cv-badges">
            <span v-if="vault" class="cv-pill ok"
              ><span class="cv-dot" /> Namespace reserved</span
            >
            <!-- Was a flat "Cloud CLI sync is coming soon". Device enrollment
                 is real now, so this reports what is actually true of THIS
                 vault rather than of the product. -->
            <span v-if="activeDevices.length" class="cv-pill ok"
              ><span class="cv-dot" />
              {{ activeDevices.length }}
              {{ activeDevices.length === 1 ? "machine" : "machines" }} linked</span
            >
            <span v-else-if="pendingDevices.length" class="cv-pill warn"
              ><span class="cv-dot" />
              {{ pendingDevices.length }} waiting to be admitted</span
            >
            <!-- v-else-if, not v-else: signed out, mid-checkout, or after a
                 failed load there is no vault whose device state we know, and
                 "no machines linked" states a fact about one that may not
                 exist. -->
            <span v-else-if="vault" class="cv-pill mut"
              ><span class="cv-dot" /> No machines linked yet</span
            >
          </div>
        </header>

        <!-- Focal while the vault is shut. This is the element that changes
             as you advance, which is why it earns the slot: it replaces a
             finished rail that kept a row to say nothing, plus the status
             pills that repeated it. Once the vault is open it shrinks into
             the strip below and the dashboard becomes the content. -->
        <!-- Held through the unlock. Admitting a machine flips the stage in
             the same tick, so gating purely on `!vaultOpen` unmounted this and
             played the celebration on the 34px strip mark instead — a gesture
             performed by an icon that had just teleported. The mark stays big
             for the ~700ms, then collapses. -->
        <div v-if="!vaultOpen || vaultUnlocking" class="cv-vaulthead">
        <div
          class="cv-vaultfocal"
          aria-hidden="true"
        >
          <BrandMark
            :size="72"
            :state="vaultOpen ? 'unlocked' : 'locked'"
            :working="vaultWorking"
            :unlocking="vaultUnlocking"
            show-depth
          />
        </div>

        <!-- The single progress model. One derivation, rendered two ways:
             labelled while there is still something to do, and collapsed into
             the vault strip once there is not. -->
        <ol
          v-if="!vaultOpen"
          class="cv-rail"
          :class="{ complete: onboardingComplete }"
          aria-label="Hosted vault setup progress"
        >
          <li
            v-for="(step, i) in onboardingSteps"
            :key="step.key"
            class="cv-rail-step"
            :class="step.state"
            :aria-current="step.state === 'active' ? 'step' : undefined"
          >
            <span class="cv-rail-dot" aria-hidden="true">{{
              step.state === "done" ? "✓" : step.index
            }}</span>
            <span class="cv-rail-copy">
              <strong>{{ step.label }}</strong>
              <small>{{ step.detail }}</small>
              <span class="visually-hidden">{{
                RAIL_STATE_LABEL[step.state]
              }}</span>
            </span>
            <span
              v-if="i < onboardingSteps.length - 1"
              class="cv-rail-line"
              aria-hidden="true"
            />
          </li>
        </ol>
        </div>

        <p
          v-if="notice"
          class="cv-notice"
          :class="notice.kind"
          role="status"
          aria-live="polite"
        >
          {{ notice.text }}
        </p>

        <!-- ---------- STAGE: ERROR ---------- -->
        <template v-if="stage === 'error'">
          <div class="cv-focal">
            <h2>We couldn't load your vault</h2>
            <p class="cv-focal-body">{{ loadError }}</p>
            <div class="cv-focal-actions">
              <button
                class="cv-btn"
                type="button"
                :disabled="busy"
                @click="retryLoad"
              >
                Try again
              </button>
            </div>
          </div>
        </template>

        <!-- ---------- PRE-VAULT: account / subscription / reserve ----------
             v-show, not v-if. provisionVault emits stateChange the moment a
             vault comes back, which flips this condition -- under v-if that
             destroyed the component mid-function, throwing away its success
             notice and the result of the savePendingImport still in flight.
             Kept mounted, it simply hides. -->
        <template v-if="stage !== 'error'">
          <div v-show="!vault" class="cv-focal">
            <div class="cv-focal-glow" aria-hidden="true" />
            <div class="cv-step-kicker">
              Step {{ activeStepNumber }} of {{ onboardingSteps.length }} · the
              only thing to do right now
            </div>
            <h2>{{ setupHeadline }}</h2>
            <p class="cv-focal-body">{{ setupLede }}</p>
            <p v-if="hostedPriceLabel && !paid" class="cv-price">
              <strong>{{ hostedPriceLabel }}</strong>
              <span>Cancel any time from the billing portal.</span>
            </p>
            <HostedVaultFunnel
              entry="deploy"
              :state="cloudState"
              @state-change="syncCloudState"
              @notice="setNotice"
            />
          </div>
        </template>

        <!-- ---------- STAGE A: CONNECT ---------- -->
        <template v-if="stage === 'connect'">
          <div class="cv-focal">
            <div class="cv-focal-glow" aria-hidden="true" />
            <div class="cv-focal-ns">
              <span class="cv-pill ok"><span class="cv-dot" /> Reserved</span>
              <span class="cv-endpoint-mono">{{ hostedEndpoint }}</span>
            </div>
            <h2>Connect your local CLI</h2>
            <p class="cv-focal-body">
              Run this on the machine you want to sync. It enrols that machine
              and then waits here for you to admit it.
            </p>
            <div class="cv-connect-terminal">
              <!-- Terminal chrome, matching the reserve-step block in
                   HostedVaultFunnel.vue. It lives in THIS template rather
                   than inside ConnectTerminal for two reasons: it is static,
                   and markup here gets CloudPage's scoped-style attribute
                   normally. Vue stamps only a child component's ROOT element
                   with that attribute, so anything inside ConnectTerminal has
                   to be styled by a global class or through :deep() — see the
                   .cv-connect-terminal :deep(...) rules in the style block. -->
              <div class="terminal-head">
                <span class="dot" style="background: #d97171"></span>
                <span class="dot" style="background: #e8a866"></span>
                <span class="dot live"></span>
                <span class="ttl">~ — autovault — bash</span>
              </div>
              <ConnectTerminal :slug="vaultSlug" />
            </div>

            <div class="cv-focal-actions">
              <a class="cv-btn ghost" :href="installDocsHref"
                >Installation guide</a
              >
            </div>
          </div>

          <!-- "below" made literal. The replay ends on "⧗ waiting for you to
               admit it below" and, until this existed, nothing on the page
               connected that sentence to the Machines card that renders next
               (see showsMachines). This is the bridge between the two: a rule
               down to the card, and the sentence that names what to do when
               you get there. Connect stage only — from `explore` on, Machines
               is a peer panel rather than the next step. -->
          <div class="cv-nextstep">
            <span class="cv-nextstep-rule" aria-hidden="true" />
            <p class="cv-nextstep-copy">
              <span class="cv-nextstep-caret" aria-hidden="true">↓</span>
              Next: your machine shows up under
              <strong>Machines</strong> below. Admit it there and the CLI
              stops waiting.
            </p>
          </div>
        </template>

        <!-- ---------- STAGE B: EXPLORE  &  STAGE C: READY ----------
             From here the sidebar is a real switcher: exactly one of the
             panels below is on screen, chosen by activeSection. The chain is
             deliberately flat and uniform — a new section is one more
             `v-else-if="activeSection === '…'"` template and nothing else. -->
        <template v-if="stage === 'explore' || stage === 'ready'">
          <!-- Progress summary, collapsing stage A. Stage chrome, ABOVE the
               panel chain and outside it: this is what the 72px focal mark
               shrinks into when a machine is admitted, and admitting happens
               from the machines panel. Inside `overview` it did not render at
               that moment, so the mark played its 700ms unlock and then
               vanished into nothing — the one gesture on the whole page that
               has to land somewhere. -->
          <div class="cv-status-card" :class="{ allset: stage === 'ready' }">
            <!-- The same mark, compact. It carries the one fact this strip
                 exists to state — the vault is open — so the pill beside it
                 does not have to shout it. -->
            <!-- Hidden while the focal mark above is mid-celebration, so
                 there is never a moment with two vaults on screen. -->
            <span v-show="!vaultUnlocking" class="cv-status-mark" aria-hidden="true">
              <BrandMark
                :size="34"
                state="unlocked"
                :working="vaultWorking"
                show-depth
              />
            </span>
            <span class="cv-pill ok"
              ><span class="cv-dot" />
              {{ stage === "ready" ? "All set" : "CLI linked" }}</span
            >
            <span class="cv-status-text">
              <template v-if="stage === 'ready'">
                CLI linked · early access requested. We'll email you the moment
                hosted sync ships.
              </template>
              <template v-else>
                Your machine is pointed at <code>{{ vaultSlug }}</code
                >. Hosted sync turns on automatically when it ships.
              </template>
            </span>
            <!-- The one thing a vaulted owner can still do, and it belongs to
                 the stage rather than to a panel. It used to live inside the
                 Skills panel, which meant the default landing panel had no
                 action on it at all: at `explore` you arrived on Overview,
                 and the only way to the sole remaining step was to guess
                 which nav item hid it. Here it survives every panel switch.
                 Gone at `ready` because the ask has been made -- the strip's
                 own text says so, and the Skills panel confirms it. -->
            <!-- "Working…", not "Saving…", which is what this button said
                 inside the Skills panel. `busy` is the shell's single request
                 lock, so it is also held by Manage billing — and the Billing
                 panel now renders with this button beside it every time, so
                 clicking Manage billing made the strip announce it was saving
                 something nobody had asked it to save. Same word the device
                 rows already use while a request they did not start is in
                 flight. -->
            <button
              v-if="stage !== 'ready'"
              type="button"
              class="cv-btn cv-status-cta"
              :disabled="busy"
              @click="markProgress('early_access')"
            >
              {{ busy ? "Working…" : "Get early access →" }}
            </button>
          </div>

          <!-- ---------- SECTION: OVERVIEW ---------- -->
          <template v-if="activeSection === 'overview'">
            <div
              class="cv-reveal"
              :style="revealDelay(0)"
              role="region"
              aria-labelledby="cv-page-title"
            >
              <article class="cv-card soft">
                <div class="cv-card-label">Sync engine</div>
                <span class="cv-pill warn"
                  ><span class="cv-dot" /> Building — you'll be first to
                  know</span
                >
                <p class="cv-muted">
                  Until hosted sync ships, your local CLI is fully usable offline.
                  Nothing is gated behind the cloud — this namespace and any
                  skills carry over automatically.
                </p>
              </article>
            </div>
          </template>

          <!-- ---------- SECTION: BILLING ----------
               The Subscription card, relocated rather than rebuilt: the same
               plan/period/status rows and the same label vocabulary, now with
               the price it never showed and the portal button that was only
               ever reachable from the account menu. This is the page's only
               subscription display — there is deliberately no second one on
               the overview. -->
          <template v-else-if="activeSection === 'billing'">
            <div
              class="cv-reveal"
              :style="revealDelay(0)"
              role="region"
              aria-labelledby="cv-page-title"
            >
              <article class="cv-card">
                <div class="cv-card-label">Subscription</div>
                <ul class="cv-kv">
                  <li><span>Plan</span><strong>Hosted</strong></li>
                  <!-- "Plan price", not "You pay": /api/pricing reports what the
                       configured plan costs in Stripe today, and nothing in
                       /api/me exposes what this particular subscription is
                       charged. Never a literal — see loadPricing. -->
                  <li v-if="hostedPriceLabel">
                    <span>Plan price</span><strong>{{ hostedPriceLabel }}</strong>
                  </li>
                  <li v-if="renewalLabel">
                    <span>Billing</span><strong>{{ renewalLabel }}</strong>
                  </li>
                  <li>
                    <span>Status</span
                    ><span
                      class="cv-pill sm"
                      :class="subscriptionState.tone"
                      ><span class="cv-dot" /> {{ subscriptionState.text }}</span
                    >
                  </li>
                </ul>
                <p v-if="subscriptionNeedsAttention" class="cv-muted cv-sub-warn">
                  Hosted access follows this status. If that looks wrong, reload
                  after Stripe finishes processing, or
                  <a :href="clerkBrand.supportUrl" target="_blank" rel="noopener"
                    >contact support</a
                  >.
                </p>
                <ul class="cv-reserved">
                  <li>
                    <span class="cv-chk">✓</span> Public + private namespace
                  </li>
                  <li>
                    <span class="cv-chk">✓</span> Starter skill slots, ready to
                    fill
                  </li>
                </ul>
                <div class="cv-card-actions">
                  <!-- "Working…", not "Opening…" — same shared `busy` lock as
                       the status strip's CTA above (see that button's
                       comment), so clicking Get early access from here makes
                       this button flip too. "Opening…" claimed a specific
                       action that was not the one running; "Working…" does
                       not, matching the mitigation already chosen for the
                       mirror-image case rather than adding a second
                       per-action lock next to the existing one. -->
                  <button
                    type="button"
                    class="cv-btn"
                    :disabled="busy"
                    @click="openBillingPortal"
                  >
                    {{ busy ? "Working…" : "Manage billing" }}
                  </button>
                </div>
                <p class="cv-muted sm">
                  Cards, invoices and cancellation live in Stripe's billing
                  portal — the same one the account menu opens.
                </p>
              </article>
            </div>
          </template>

          <!-- ---------- SECTION: SKILLS ----------
               A preview, and labelled as one. The browser-side skill list does
               not exist yet; what is real here is the early-access request. -->
          <template v-else-if="activeSection === 'skills'">
            <div
              class="cv-reveal"
              :style="revealDelay(0)"
              role="region"
              aria-labelledby="cv-page-title"
            >
              <article class="cv-preview">
                <div class="cv-appframe" aria-hidden="true">
                  <div class="cv-appbar">
                    <span class="cv-tdot bad" /><span class="cv-tdot warn" /><span
                      class="cv-tdot ok"
                    />
                    <span class="cv-appurl"
                      >vault.autovault.dev/{{ vaultSlug }}</span
                    >
                  </div>
                  <div class="cv-appbody">
                    <div class="cv-appnav">
                      <span class="on">Skills</span><span>Sync log</span
                      ><span>Members</span><span>Settings</span>
                    </div>
                    <div class="cv-appmain">
                      <div class="cv-appsearch" />
                      <div
                        v-for="row in previewRows"
                        :key="row.w"
                        class="cv-approw"
                      >
                        <span class="cv-appicon" />
                        <span class="cv-appskel" :style="{ width: row.w }" />
                        <span class="cv-appsync">● synced</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="cv-preview-copy">
                  <div class="cv-card-label violet">
                    {{
                      stage === "ready"
                        ? "You're on the list · preview"
                        : "Coming soon · preview"
                    }}
                  </div>
                  <h2>Manage your vault from the web</h2>
                  <p>
                    Browse and search every synced skill, watch the live sync log
                    between your machines, and manage who has access — without
                    leaving the browser.
                  </p>
                  <div class="cv-feats">
                    <span>Skill browser</span><span>Live sync log</span
                    ><span>Team access</span>
                  </div>
                  <div v-if="stage === 'ready'" class="cv-confirm">
                    <span class="cv-confirm-ic">✓</span>
                    <span
                      >You're on the early-access list.<small
                        >Requested {{ earlyAccessDate }} · we'll email
                        {{ accountEmailShort }} first.</small
                      ></span
                    >
                  </div>
                  <!-- The ask itself moved to the vault strip above, which is
                       on screen whichever panel you are reading. What is left
                       here is where it went: this panel is a preview, and a
                       preview is a bad place to keep the stage's only
                       action. -->
                  <p v-else class="cv-muted sm">
                    Ask for early access from the vault strip above, and we'll
                    email <strong>{{ accountEmailShort }}</strong> the moment
                    it's live.
                  </p>
                </div>
              </article>
            </div>
          </template>

          <!-- ---------- SECTION: CATALOG ----------
               Answers the confusion this task exists to fix -- "even I don't
               understand what a catalog is or how I'm supposed to use it or
               publish it" -- with what the file actually is, why a second
               linked machine does not get a copy of its own, and that there
               is no publish path yet. Agrees with the Sync engine card on
               the Overview panel rather than repeating or contradicting it:
               nothing here is gated behind the cloud today, and there is
               nothing to click on this panel either. -->
          <template v-else-if="activeSection === 'catalog'">
            <div
              class="cv-reveal"
              :style="revealDelay(0)"
              role="region"
              aria-labelledby="cv-page-title"
            >
              <article class="cv-card soft">
                <div class="cv-card-label">Vault catalog</div>
                <!-- Capability, not a per-vault fact: this panel does not
                     query AUTOVAULT_VAULT_OBJECTS, so it cannot know whether
                     a catalog happens to already sit in KV for this vault
                     (the documented manual `wrangler kv key put` path makes
                     that possible today). What is true regardless of that is
                     that self-serve publishing does not exist yet — say
                     that, not an unqueried "nothing published." -->
                <span class="cv-pill warn"
                  ><span class="cv-dot" /> No publish path yet</span
                >
                <p class="cv-muted">
                  Your vault catalog is the signed manifest your linked
                  machines pull skills from — a file, not a screen you
                  browse.
                </p>
                <p class="cv-muted">
                  Every machine you admit reads from that same vault catalog
                  once one exists. Link a second machine and it stays in
                  sync through that one file, not a copy of its own.
                </p>
                <p class="cv-muted">
                  Publishing ships with hosted sync, and that hasn't shipped
                  yet — there's nothing to publish or configure here today.
                  When it does, the signing key that makes a release
                  trustworthy still stays on your machine, the same way
                  signing and serving already work today: Cloud reads and
                  serves, it never holds that key.
                </p>
                <p class="cv-muted sm">
                  Not to be confused with
                  <a href="/skills-directory">the public skills directory</a>,
                  which lists public examples anyone can browse — your vault
                  catalog stays private to this namespace.
                </p>
              </article>
            </div>
          </template>
        </template>
        <!-- ---------- SECTION: MACHINES ----------
             Enrolled machines. This list IS the link step: there is no
             button to say a CLI is connected, because saying so was never
             evidence of anything. A row appears here when a real machine
             signs a real enrollment request.

             Outside the stage template because it renders from `connect` on,
             and shown on the overview as well as on its own panel — see
             showsMachines. The `v-if="vault"` gate below is the one that
             decides whether it exists at all. -->
        <template v-if="showsMachines">
          <!-- `awaiting` is the other half of .cv-nextstep above: at connect
               this card IS the next step, so it carries the accent rather
               than sitting there as one more neutral panel. Added to the
               existing binding, never replacing it -- `focusflash` is the
               transient flash the admit handshake drives. -->
          <div v-if="vault" ref="devicesCard" class="cv-devices standalone" :class="{ focusflash: devicesFlash, awaiting: stage === 'connect' }" role="region" aria-labelledby="cv-devices-title">
            <h3 id="cv-devices-title" class="cv-devices-title">
              Machines
              <span v-if="pendingDevices.length" class="cv-devices-count">
                {{ pendingDevices.length }} waiting
              </span>
            </h3>

            <!-- The CLI enrols and only then opens this page, so arriving before
                 the row exists is the normal case, not an error. Say what is
                 happening and let the poll catch up -- never a warning notice. -->
            <p
              v-if="admitState === 'waiting'"
              class="cv-devices-waiting"
              :class="{ stalled: admitWaitExpired }"
            >
              <span class="cv-dot" />
              <!-- Once the budget is spent nothing is arriving, and a spinner
                   that never resolves is worse than saying so. -->
              <template v-if="admitWaitExpired">
                No machine matching <code>{{ admitFingerprint }}</code> has checked
                in. If you closed that terminal, run
                <code>autovault link</code> there again.
              </template>
              <template v-else>
                Waiting for <code>{{ admitFingerprint }}</code> to check in…
              </template>
            </p>

            <p v-else-if="!devices.length" class="cv-devices-empty">
              Nothing enrolled yet. Run the command above and this machine
              will appear here within a few seconds.
            </p>

            <ul v-if="devices.length" class="cv-device-list">
              <li
                v-for="device in devices"
                :key="device.id"
                class="cv-device"
                :class="[device.status, { 'admit-target': isAdmitTarget(device) }]"
              >
                <span class="cv-device-id">
                  <strong>{{ device.hostname || "Unnamed machine" }}</strong>
                  <!-- Matches what the CLI printed on that machine, so the
                       owner can tell two pending devices apart. -->
                  <code>ed25519 {{ device.fingerprint }}</code>
                </span>
                <span class="cv-device-seen">
                  <span class="cv-pill" :class="device.status === 'active' ? 'ok' : ''">
                    <span class="cv-dot" />{{ device.status }}
                  </span>
                  <small>first seen {{ formatWhen(device.first_seen_at) }}</small>
                </span>
                <span class="cv-device-actions">
                  <button
                    v-if="device.status === 'pending'"
                    type="button"
                    class="cv-btn small"
                    :data-admit-target="isAdmitTarget(device) ? 'true' : undefined"
                    :disabled="deviceBusy === device.id"
                    @click="decideDevice(device.id, 'admit')"
                  >
                    {{ deviceBusy === device.id ? "Working…" : "Admit" }}
                  </button>
                  <button
                    v-if="device.status !== 'revoked'"
                    type="button"
                    class="cv-btn ghost small"
                    :disabled="deviceBusy === device.id"
                    @click="decideDevice(device.id, 'revoke')"
                  >
                    {{ device.status === "pending" ? "Deny" : "Revoke" }}
                  </button>
                </span>
              </li>
            </ul>
          </div>
        </template>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import HostedVaultFunnel from "./HostedVaultFunnel.vue";
import BrandMark from "./BrandMark.vue";
import CloudAccountMenu from "./CloudAccountMenu.vue";
import { copyText as copyToClipboard } from "../utils/clipboard";
import { prefersReducedMotion } from "../utils/motion";
import { formatPriceLabel } from "../utils/money";
import { consumeVaultArrival } from "../utils/vaultArrival";
import { cloudStateIsKnown, deviceListIsKnown } from "../utils/cloudLoadState";
import {
  admitHandshakeState,
  findAdmitTarget,
  readAdmitFingerprint,
} from "../utils/admit";
import { clerkBrand } from "../clerk";
import { clerkAuthRecoveryMessage, isClerkApiAuthError, useClerkApiAuth } from "../utils/clerkApi";
import {
  useTerminalReplay,
  type TerminalReplayLine,
} from "../composables/useTerminalReplay";
import { AUTOVAULT_INSTALL_COMMAND } from "../../shared/bootstrap";

const ConnectTerminal = defineComponent({
  props: {
    slug: { type: String, required: true },
  },
  setup(props) {
    const bodyRef = ref<HTMLElement | null>(null);
    const copied = ref(false);
    const commands = computed(() => [
      AUTOVAULT_INSTALL_COMMAND,
      '. "$HOME/.autovault/env"',
      `autovault link ${props.slug}`,
    ]);
    const lines = computed<TerminalReplayLine[]>(() => [
      { type: "cmd", text: commands.value[0] },
      { type: "out", text: "↳ downloading autovault-installer" },
      { type: "ok", text: "✓ signature ok" },
      { type: "cmd", text: commands.value[1] },
      { type: "cmd", text: commands.value[2] },
      { type: "out", text: "↳ enrolling this machine" },
      // Not "✓ linked successfully". Linking ends PENDING and the CLI sits in
      // a spinner until the owner admits it on this page. Showing a tick here
      // taught people to expect something that does not happen, and then to
      // wonder what they had done wrong.
      { type: "out", text: "⧗ waiting for you to admit it below" },
    ]);
    const replay = useTerminalReplay(lines.value, {
      autoStart: true,
      scrollTarget: () => bodyRef.value,
    });

    async function handleCopy() {
      await copyToClipboard(commands.value.join("\n"));
      copied.value = true;
      setTimeout(() => (copied.value = false), 1600);
    }

    // Single root element, on purpose -- the same hazard LocalHandoffTerminal
    // documents in HostedVaultFunnel.vue. Vue stamps a child component's root,
    // and only its root, with the parent's scoped-style attribute. Everything
    // below this div is therefore unreachable from a plain rule in CloudPage's
    // <style scoped> block; those rules are written as
    // `.cv-connect-terminal :deep(...)` instead. Returning a fragment here
    // would strip the attribute off the root too and break even that.
    return () =>
      h("div", { class: "cv-terminal-wrapper" }, [
        // The terminal replay below is aria-hidden because it types character
        // by character; announcing that is noise. But it carried the only copy
        // of the commands on the page, which left the single required action
        // unreachable by screen readers. This static transcript is the
        // accessible equivalent.
        h("pre", { class: "visually-hidden" }, [
          h("code", commands.value.join("\n")),
        ]),
        h(
          "div",
          {
            class: "terminal-body cv-terminal-body",
            ref: bodyRef,
            "aria-hidden": "true",
          },
          [
          ...replay.visibleLines.value.map((line, index) =>
            line.type === "cmd"
              ? h("div", { class: "line terminal-line", key: index }, [
                  h("span", { class: "pmt cv-pmt" }, "$ "),
                  h("span", line.text),
                ])
              : h("div", { class: line.type, key: index }, line.text),
          ),
          !replay.complete.value
            ? h("span", { class: "cur cursor cv-cur" })
            : null,
        ]),
        // A footer row rather than an overlay pinned to the body's top-right.
        // The terminal head now occupies that corner, and the reference card
        // (.hosted-copy-row in HostedVaultFunnel.vue) already puts its copy
        // affordance in a row under the terminal. Same shape here.
        h("div", { class: "cv-copy-row" }, [
          h(
            "button",
            {
              class: "cv-cmd-copy",
              type: "button",
              onClick: handleCopy,
              "aria-label": copied.value
                ? "Install commands copied to clipboard"
                : "Copy install commands",
              "aria-live": "polite",
            },
            copied.value ? "Copied" : "Copy commands",
          ),
        ]),
      ]);
  },
});

type CloudUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
};
type CloudSubscription = {
  active: boolean;
  status?: string | null;
  current_period_end?: number | null;
} | null;
type CloudVault = {
  id?: string;
  slug: string;
  status: string;
  public_url: string;
  provisioned_at?: string | null;
  cli_linked_at?: string | null;
  early_access_at?: string | null;
} | null;
type CloudState = {
  user: CloudUser | null;
  subscription: CloudSubscription;
  vault: CloudVault;
};
type CloudStatePayload = {
  user: CloudUser | null;
  subscription?: CloudSubscription;
  vault?: CloudVault;
};
// "loading" is not a step in the funnel -- it is the honest answer while this
// page still has none. Every other member below is a claim about the account,
// and each one is read off state that starts empty, so without a member for
// "not yet known" the empty state is indistinguishable from a real answer.
// "error" stays first: cloudDashboardHonesty pins `type Stage = "error"`.
type Stage =
  | "error"
  | "loading"
  | "account"
  | "subscription"
  | "setup"
  | "connect"
  | "explore"
  | "ready";
// The main area renders exactly one of these at a time, chosen from the
// sidebar. Adding one means four edits and nothing else: a member here, a row
// in SECTION_REVEAL, an item() line in navItems, and a block in the template.
type Section = "overview" | "billing" | "machines" | "skills" | "catalog";
type NavItem = {
  key: string;
  label: string;
  icon: string;
  badge?: "soon" | "new";
  locked: boolean;
  disabled: boolean;
  active: boolean;
  cls: Record<string, boolean>;
  // Which panel this item selects, or null for an item that has none: Members
  // is permanently locked, and Settings has no panel built yet. A null section
  // is what makes onNavClick a no-op even if the disabled attribute were lost.
  section: Section | null;
  // Set only for a plain link item (Docs, Support): a destination outside the
  // switcher entirely, so it renders as a real <a> rather than a <button> that
  // pretends to select a panel. null for every section-switching item.
  href: string | null;
  // Whether href leaves the site, so the template can add target="_blank"
  // without a per-item flag the caller has to remember to set.
  external: boolean;
};

const cloudState = ref<CloudState>({
  user: null,
  subscription: null,
  vault: null,
});
const hydrated = ref(false);
// The auth context the last completed /api/me was sent under, or null while no
// response has landed at all.
//
// `hydrated` alone was never enough, and that is the whole of the flash. This
// page fires /api/me on mount, before Clerk has resolved, so that request goes
// out ANONYMOUS -- see the note on celebrateUnlock, which already documented
// the double load. It comes back "no user, no subscription, no vault" quickly,
// which is true of the request and says nothing about the person. Flipping
// `hydrated` on it dropped the boot veil and let the page announce a stage it
// had no evidence for: a paid, provisioned owner was shown a checkout button
// for the length of a Clerk round trip.
//
// Compared against Clerk's own answer below. A response only speaks for the
// visitor if it was sent under the auth context Clerk finally reports.
const loadedSignedIn = ref<boolean | null>(null);
// A bound on waits this page does not control. Clerk's script has no failure
// signal -- a blocked bundle leaves `isLoaded` false forever -- and the device
// list is deliberately silent on failure because it runs on a poll. Neither
// can be waited on indefinitely: /cloud is also the public sign-up entry
// point, and a veil that never lifts there is worse than the wrong-state flash
// this whole change exists to remove.
//
// This is a FAILURE signal, not a slowness budget, and the number says so.
// When it fires the page degrades to exactly its pre-fix behaviour -- which
// for a signed-in owner IS the wrong-state flash. So it must never fire on a
// page that is merely slow. Twenty seconds is far past any real Clerk load
// (sub-second in practice) and past any /api/me that is going to arrive at
// all; whoever reaches it has a Clerk bundle blocked outright, and could not
// have signed in either way.
//
// Written as 8s first, and watching it load is how that got caught: with the
// window widened the deadline landed while the authenticated /api/me was
// still on its way, un-veiled the page using the anonymous response, and
// reproduced the exact defect this task exists to remove. Both halves of the
// repair are here -- the long deadline, and the in-flight guard.
const LOAD_PATIENCE_MS = 20_000;
const loadPatienceExpired = ref(false);
let loadPatienceTimer: ReturnType<typeof setTimeout> | undefined;
// How many /api/me calls are outstanding. A request still in flight is a wait
// WITH an end -- it settles, or the browser ends it -- so giving up on it is
// never right. The deadline exists for the wait that has no end at all.
const cloudLoadsInFlight = ref(0);

// Called from onMounted, never at setup scope: on the server there is nothing
// to wait for and no timer to leak.
function armLoadPatience() {
  if (loadPatienceTimer) clearTimeout(loadPatienceTimer);
  loadPatienceTimer = setTimeout(() => {
    loadPatienceExpired.value = true;
    loadPatienceTimer = undefined;
  }, LOAD_PATIENCE_MS);
}
// Set when /api/me could not be resolved because auth failed — as opposed to
// resolving successfully and reporting no vault. Without this the two cases
// are indistinguishable downstream, and a signed-in, paying, provisioned user
// whose token refresh blipped was shown "Set up your hosted vault".
const loadError = ref<string | null>(null);
const busy = ref(false);
type CloudNotice = { kind: "ok" | "warn" | "fail"; text: string };
const notice = ref<CloudNotice | null>(null);

// The funnel used to render its own notice element. Now that it is chrome-
// free, its failures surface through this page's single live region --
// otherwise a cancelled Checkout or the expected webhook-delay 402 would
// leave the button simply re-enabling with no explanation.
function setNotice(next: CloudNotice | null) {
  notice.value = next;
}
// The panel the owner picked. What is actually on screen is `activeSection`,
// which falls back to overview whenever this one is not reachable at the
// current stage -- declared with SECTION_REVEAL and the nav, further down.
const selectedSection = ref<Section>("overview");
const devicesCard = ref<HTMLElement | null>(null);
// The machines list is the one thing still worth scrolling to and flashing:
// the CLI's ?admit= link points a person at one specific row. Nav items switch
// panels rather than scrolling now, so nothing else uses this.
const devicesFlash = ref(false);
const previewRows = [{ w: "55%" }, { w: "42%" }, { w: "60%" }];

const { authHeaders, clerkAuthEnabled, isClerkLoaded, isClerkSignedIn, clerkUserLabel } =
  useClerkApiAuth();
let cloudStateRequestSeq = 0;

type SyncDevice = {
  id: string;
  fingerprint: string;
  status: "pending" | "active" | "revoked";
  hostname: string | null;
  first_seen_at: string;
  last_seen_at: string | null;
};

const devices = ref<SyncDevice[]>([]);
const deviceBusy = ref<string | null>(null);
let devicesRequestSeq = 0;

const user = computed(() => cloudState.value.user);
const vault = computed(() => cloudState.value.vault);
// A device the owner actually admitted, not a checkbox somebody ticked.
//
// `vaults.cli_linked_at` used to drive this: a button that said "I've linked
// my CLI ✓" and wrote a timestamp. It proved nothing -- anyone could tick it
// without a machine anywhere near the vault, and the dashboard would then
// claim a CLI was connected. The column still exists (0002 is applied and
// migrations are not edited after shipping) but nothing reads it now.
const activeDevices = computed(() => devices.value.filter((device) => device.status === "active"));
const pendingDevices = computed(() => devices.value.filter((device) => device.status === "pending"));
const cliLinked = computed(() => activeDevices.value.length > 0);

// ---- CLI admit handshake -------------------------------------------------
//
// `autovault link` prints a fingerprint and opens /cloud?admit=<fingerprint>.
// All this does is *select* the row that is waiting: scroll to it, flash it,
// and put focus on its Admit button. The owner still clicks, exactly as they
// would confirm a code on GitHub's device page.
//
// Nothing below ever calls decideDevice(). If it did, the URL the CLI prints
// would become a credential that admits a machine to the vault on load.
const admitFingerprint = ref<string | null>(null);

const admitTarget = computed(() => findAdmitTarget(devices.value, admitFingerprint.value));

const admitState = computed(() => admitHandshakeState(devices.value, admitFingerprint.value));

// A `waiting` handshake is normally seconds long: the CLI enrols, then opens
// this page, so the row is usually one poll behind. But a stale, malformed, or
// wrong-account `?admit=` link never matches anything, and `waiting` would then
// be permanent -- pinning the poll at four seconds for the life of the tab.
// /api/vaults/current/devices goes through requireUser, which in Clerk mode
// does a profile lookup per call, so that is ~900 requests an hour in the one
// case where not one of them can succeed.
//
// Two minutes is far longer than the real path needs (a sign-in round trip
// reloads the page, restarting this) and short enough that a dead link stops
// costing anything.
const ADMIT_WAIT_BUDGET_MS = 120_000;
const admitWaitExpired = ref(false);
let admitWaitTimer: ReturnType<typeof setTimeout> | undefined;

function clearAdmitWaitTimer() {
  if (admitWaitTimer) clearTimeout(admitWaitTimer);
  admitWaitTimer = undefined;
}

watch(
  admitState,
  (state) => {
    if (state !== "waiting") {
      // Covers the row arriving late: expiry is reset, not latched, so a
      // machine that shows up after the budget still gets the full treatment.
      clearAdmitWaitTimer();
      admitWaitExpired.value = false;
      return;
    }
    if (admitWaitTimer) return;
    admitWaitTimer = setTimeout(() => {
      admitWaitExpired.value = true;
      admitWaitTimer = undefined;
    }, ADMIT_WAIT_BUDGET_MS);
  },
  { immediate: true }
);

onBeforeUnmount(clearAdmitWaitTimer);

onBeforeUnmount(() => {
  if (loadPatienceTimer) clearTimeout(loadPatienceTimer);
  loadPatienceTimer = undefined;
});

function isAdmitTarget(device: SyncDevice) {
  return admitTarget.value?.id === device.id;
}

// Focus the row once per machine, not once per poll tick. The device list
// reloads every four seconds while this is open, and re-stealing focus (and
// re-running the flash) on every response would make the Admit button
// impossible to tab away from.
let admitFocusedId: string | null = null;

watch(
  () => admitTarget.value?.id ?? null,
  async (deviceId) => {
    if (!deviceId || admitFocusedId === deviceId) return;
    admitFocusedId = deviceId;
    // Put the panel that holds the row on screen before reaching for it. At
    // connect the overview already shows the machines list, but a second
    // machine can check in while the owner is reading Billing -- and then the
    // button below is in a panel Vue is not rendering.
    selectedSection.value = "machines";
    await focusDevicesCard();
    await nextTick();
    // Queried rather than held as a template ref: the button lives inside a
    // v-for, and the row it belongs to can arrive several polls after mount.
    const button = devicesCard.value?.querySelector<HTMLButtonElement>(
      "[data-admit-target='true']"
    );
    button?.focus();
  },
  { immediate: true }
);
const earlyAccess = computed(() => Boolean(vault.value?.early_access_at));

const subscription = computed(() => cloudState.value.subscription);

// ORs in the live Clerk flag, not just the /api/me payload. Clerk resolves
// after mount, so between those two moments `user` is still null -- without
// this the shell would blink back to "create an account" for someone who is
// demonstrably signed in.
const signedIn = computed(
  () => Boolean(user.value) || isClerkSignedIn.value,
);
const paid = computed(() => Boolean(subscription.value?.active));

/* ---------------------------------------------------------------------------
 * What this page actually knows
 *
 * Three separate questions, and the page used to answer all of them from
 * whatever happened to be in the refs:
 *
 *   1. Has Clerk decided whether there is a session?      authSettled
 *   2. Do we hold an /api/me sent under that decision?    cloudStateKnown
 *   3. Has the device list answered for this vault?       devicesKnown
 *
 * Each starts out unknown and each has an empty value that looks exactly like
 * a real negative answer. Keeping them as named facts is what lets `stage`
 * say "loading" instead of guessing.
 * ------------------------------------------------------------------------ */

// Clerk is the authority on whether anyone is signed in; `user` from /api/me
// only ever confirms it. `clerkAuthEnabled` is false during SSR and in the
// legacy cookie mode, and isClerkLoaded is hardcoded true there, so this is
// settled from the start in both.
const authSettled = computed(() => !clerkAuthEnabled || isClerkLoaded.value);

// The rule itself lives in utils/cloudLoadState.ts so it can be tested by
// running it. This file's tests are source assertions -- they can see that a
// branch exists and cannot see that it decides correctly, and deciding
// correctly is the entire fix.
const cloudStateKnown = computed(() =>
  cloudStateIsKnown({
    hydrated: hydrated.value,
    loadedSignedIn: loadedSignedIn.value,
    authSettled: authSettled.value,
    clerkSignedIn: isClerkSignedIn.value,
    patienceExpired: loadPatienceExpired.value && cloudLoadsInFlight.value === 0,
  }),
);

// Whether the device list has answered for the vault currently in state. Reset
// whenever that vault changes, set only by a response this page actually
// parsed -- see loadDevices.
const devicesKnown = ref(false);
// Whether `cliLinked` is a question worth waiting for. Latched once, at the
// moment the account's real state first lands.
//
// A vault that already existed then may already have a machine linked, and
// `devices` starts empty, so reading cliLinked before the list answers is the
// same unknown-vs-false conflation one level down: it renders the connect
// terminal, with its typed replay, to someone who connected months ago.
//
// A vault provisioned later in this same session is seconds old and cannot
// have one, so the checkout path is never held behind a list whose answer is
// already known. Without the latch it would be: provisioning flips `vault`
// from null to a row, which resets devicesKnown, which would veil the owner
// who has just paid.
const devicesGateArmed = ref(false);
let devicesGateDecided = false;

watch(cloudStateKnown, (known) => {
  if (!known || devicesGateDecided) return;
  devicesGateDecided = true;
  devicesGateArmed.value = Boolean(vault.value);
});

const stage = computed<Stage>(() => {
  if (loadError.value && !vault.value) return "error";
  // Before this branch existed the three tests below ran against empty refs on
  // every load, and empty reads as "signed out, nothing bought, no vault" --
  // a confident, wrong claim, made to the one visitor who has already done all
  // three. Not knowing is a state of its own, and this is it.
  if (!cloudStateKnown.value) return "loading";
  // Vault first. A reserved vault is proof the first three steps completed,
  // so checking `paid` ahead of it would bounce a past_due or canceled holder
  // back to "Finish checkout" -- getSubscription derives `active` from
  // isPaidStatus(status), so a lapse flips `paid` false while the vault row
  // survives untouched. A lapse belongs on the Subscription card, not in the
  // signup funnel.
  if (vault.value) {
    // Same rule as above, one level down: `devices` starts empty, so cliLinked
    // is false before the list has said anything. See devicesGateArmed for why
    // this only holds a vault that predates this page load.
    if (
      !deviceListIsKnown({
        gateArmed: devicesGateArmed.value,
        listAnswered: devicesKnown.value,
        patienceExpired: loadPatienceExpired.value,
      })
    ) {
      return "loading";
    }
    if (!cliLinked.value) return "connect";
    if (!earlyAccess.value) return "explore";
    return "ready";
  }
  if (!signedIn.value) return "account";
  if (!paid.value) return "subscription";
  return "setup";
});

// "The page is showing something it knows." Everything that used to key off
// `hydrated` keys off this instead, so the boot veil, the inert shell and the
// ambient vault all follow the one derivation rather than a flag that meant
// "a response landed" and was read as "the answer is in".
//
// Deliberately derived from `stage` rather than from cloudStateKnown: a load
// that fails outright reaches "error", and the error card has a Try again
// button on it. Veiling that would be the permanent spinner.
const settled = computed(() => stage.value !== "loading");

/* ---------------------------------------------------------------------------
 * The load screen is the vault opening
 *
 * `settled` says the data is in. This says the page is on screen. Between the
 * two sits one gesture: the boot vault, which has been sweeping its dial while
 * the page had nothing to show, turns and retracts, and the settled dashboard
 * is behind it.
 *
 * Three separate vault gestures now exist on this page and they must not be
 * confused with each other. Each has its own ref and its own timer:
 *
 *   celebrateUnlock   the owner admits their first machine. One call site,
 *                     inside decideDevice, with the pre-await `wasOpen`
 *                     capture (PR #106). Not touched by any of this -- the
 *                     shell is `inert` for the whole of the boot gesture, so
 *                     there is no click that could reach it.
 *   vaultArriving     this page arrived, in the background. Spent once per
 *                     occasion (Task D). Gated on `revealed` below, so it can
 *                     neither run under the veil nor overlap the boot unlock.
 *   bootOpening       this. At most once per mount, and only when the wait was
 *                     long enough to have registered as a wait.
 *
 * The precedence between the last two is structural rather than a rule anyone
 * has to remember: `revealed` is false for the whole of the boot gesture, and
 * `ambientVault` reads `revealed`, so the arrival cannot start until the boot
 * unlock has finished. They are sequential by construction, never concurrent.
 * ------------------------------------------------------------------------ */

// Matches brand-mark-unlock's own 700ms in styles.css. Kept as its own
// constant rather than reusing VAULT_UNLOCK_MS so the admit celebration's
// timing cannot be changed from here by accident.
const BOOT_UNLOCK_MS = 700;
// Below this, skip the gesture entirely and reveal at once.
//
// A brand moment that makes a fast page feel slower is a regression, and this
// is the line: under ~350ms the veil is a flicker rather than a state, so the
// visitor never registered a wait and there is nothing to resolve. Completing
// a beat nobody heard just adds 700ms to a page that was ready. Above it they
// have seen the vault and it should open rather than vanish.
const BOOT_MIN_VISIBLE_MS = 350;

// Three phases, not two booleans. `settled` flipping true is not the same
// moment as the veil lifting, and a plain `settled && !opening` would have
// been true for the frame between them -- the veil would vanish, the gesture
// would start, and it would come back. "waiting" holds that gap.
type BootPhase = "waiting" | "opening" | "open";
const bootPhase = ref<BootPhase>("waiting");
let bootOpenTimer: ReturnType<typeof setTimeout> | undefined;
let bootMountedAt = 0;

const bootOpening = computed(() => bootPhase.value === "opening");

// The veil is gone and the real page is on screen. Not a latch on `settled`:
// if the session is lost later the page honestly veils again, and what stops
// a second celebration is the arrival ledger, not this.
const revealed = computed(() => settled.value && bootPhase.value === "open");

// "Ready and settled", which is a stronger claim than "fetched". Vue has to
// have flushed the render that `settled` triggers AND the browser has to have
// painted a frame of it -- behind an opaque veil, where a reflow costs
// nothing -- before the veil starts to lift. Revealing on promise resolution
// and letting the layout settle in front of the visitor is the same defect
// this task exists to fix, wearing better clothes.
//
// Two frames: the first is the style and layout pass Vue's flush schedules,
// the second is evidence it was painted rather than merely scheduled.
//
// Raced against a deadline, and that is not defensive padding -- it is a bug
// found by watching this load. requestAnimationFrame does not fire in a
// background tab, and /cloud is opened in one routinely: people cmd-click, and
// the Stripe return can land in a new tab. Waiting on a frame that will never
// come held an opaque veil over the whole page until the tab was focused.
// Two frames is ~33ms at 60fps and ~66ms at 30, so this ceiling is generous
// where frames are being produced and instant where they are not.
const PAINT_WAIT_MAX_MS = 120;

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, PAINT_WAIT_MAX_MS);
  });
}

async function openBoot() {
  await nextTick();
  await afterNextPaint();
  // Lost the answer again while we waited; leave the phase alone so the next
  // flip retries.
  if (!settled.value || bootPhase.value !== "waiting") return;
  if (
    // A failed load did not open anything. Playing an unlock over "We couldn't
    // load your vault" would be the page celebrating its own error.
    stage.value === "error" ||
    // Neither did a visit by someone who has no vault to open. Measured on a
    // signed-out load: the gesture put 700ms between them and the sign-up
    // button, on the page that IS the public sign-up entry point -- and the
    // mark would have been claiming that something of theirs had just opened.
    // The dial still sweeps behind the veil while the page loads; there is
    // simply nothing to unlock at the end of it.
    !signedIn.value ||
    // Read inside the callback, never at setup scope: the PR #88 hydration
    // class, and the same placement the two existing gestures use.
    prefersReducedMotion() ||
    Date.now() - bootMountedAt < BOOT_MIN_VISIBLE_MS
  ) {
    bootPhase.value = "open";
    return;
  }
  bootPhase.value = "opening";
  if (bootOpenTimer) clearTimeout(bootOpenTimer);
  bootOpenTimer = setTimeout(() => {
    bootPhase.value = "open";
    bootOpenTimer = undefined;
  }, BOOT_UNLOCK_MS);
}

watch(settled, (isSettled) => {
  if (!isSettled || bootPhase.value !== "waiting") return;
  void openBoot();
});

onBeforeUnmount(() => {
  if (bootOpenTimer) clearTimeout(bootOpenTimer);
  bootOpenTimer = undefined;
});

// The card used to render a hardcoded "Active" pill and a hardcoded monthly
// price as static markup, while the real
// subscription was fetched, typed, normalized — and then never read. A
// past_due or canceled subscriber was told everything was fine.
//
// The Billing panel does show a price again, but never a literal: it comes
// from /api/pricing, which reads the configured plan out of Stripe. That is
// the plan's LIST price, not this subscription's charge — subscriptions.price_id
// is in D1 but /api/me exposes no amount — so it is labelled "Plan price" and
// Stripe's own portal remains the authority on what anyone is actually billed.
const SUBSCRIPTION_LABELS: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  active: { text: "Active", tone: "ok" },
  trialing: { text: "Trialing", tone: "ok" },
  past_due: { text: "Past due", tone: "warn" },
  unpaid: { text: "Unpaid", tone: "bad" },
  incomplete: { text: "Incomplete", tone: "warn" },
  incomplete_expired: { text: "Expired", tone: "bad" },
  canceled: { text: "Canceled", tone: "bad" },
  paused: { text: "Paused", tone: "warn" },
};

const subscriptionState = computed(() => {
  const status = subscription.value?.status ?? null;
  if (!status) {
    return subscription.value?.active
      ? { text: "Active", tone: "ok" as const }
      : { text: "No subscription", tone: "warn" as const };
  }
  return SUBSCRIPTION_LABELS[status] ?? { text: status.replace(/_/g, " "), tone: "warn" as const };
});

const subscriptionNeedsAttention = computed(
  () => subscriptionState.value.tone !== "ok",
);

const renewalLabel = computed(() => {
  const seconds = subscription.value?.current_period_end;
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  // A subscription cancelled effective end-of-period keeps status "active"
  // (and therefore tone "ok") right up until that date -- the API persists
  // only status and current_period_end, not Stripe's cancel_at_period_end,
  // so this computed cannot tell "will renew" from "will end" for an
  // otherwise-active row. A neutral date label is accurate either way;
  // "Renews" is not.
  return subscriptionState.value.tone === "bad"
    ? `Ends ${formatted}`
    : `Current period ends ${formatted}`;
});

const vaultSlug = computed(() => vault.value?.slug ?? "your-vault");
const hostedEndpoint = computed(
  () =>
    vault.value?.public_url ?? `https://vault.autovault.dev/${vaultSlug.value}`,
);
const accountName = computed(
  () =>
    user.value?.name ||
    user.value?.email?.split("@")[0] ||
    clerkUserLabel.value ||
    "Your account",
);
const accountEmailShort = computed(() => {
  const email = user.value?.email;
  if (!email) return "your inbox";
  const [name, domain] = email.split("@");
  return domain ? `${name}@${domain}` : email;
});
// Typed rather than an inline `{}`: in a ternary/union position TS widens the
// empty branch to `{ backgroundImage?: undefined }`, which then fails the
// Record<string, string> index signature the menu prop expects.
const NO_AVATAR_STYLE: Record<string, string> = {};

const avatarStyle = computed<Record<string, string>>(() => {
  const avatarUrl = user.value?.avatar_url;
  if (!avatarUrl) return NO_AVATAR_STYLE;
  return {
    backgroundImage: `url(${avatarUrl})`,
    backgroundColor: "transparent",
  };
});

/* ---------------------------------------------------------------------------
 * Onboarding rail
 *
 * One derivation, replacing four that used to disagree: the funnel's
 * "Step N of 4" kicker, its four status cards, its five-row provisioning
 * checklist, and this page's own two-step rail. Those four are why the page
 * announced four steps and then switched to a different two-step model
 * partway through.
 *
 * "Sync" is deliberately NOT a step. Hosted sync does not exist server-side,
 * and a step you cannot complete is not a step -- it stays a locked
 * destination in the sidebar instead.
 * ------------------------------------------------------------------------ */
type StepKey = "account" | "subscription" | "namespace" | "connect";
type StepState = "done" | "active" | "pending" | "unknown";
type OnboardingStep = {
  key: StepKey;
  index: number;
  label: string;
  detail: string;
  state: StepState;
};

const ONBOARDING_STEP_KEYS: StepKey[] = [
  "account",
  "subscription",
  "namespace",
  "connect",
];
const ONBOARDING_STEP_LABELS: Record<StepKey, string> = {
  account: "Account",
  subscription: "Subscription",
  namespace: "Namespace",
  connect: "Connect CLI",
};
const RAIL_STATE_LABEL: Record<StepState, string> = {
  done: "completed",
  active: "current step",
  pending: "not started",
  unknown: "status unavailable",
};

const stepDone = computed<Record<StepKey, boolean>>(() => ({
  account: signedIn.value,
  // Stays ticked once a vault exists. A later lapse must not un-tick a step
  // the user genuinely completed -- it surfaces on the Subscription card.
  subscription: paid.value || Boolean(vault.value),
  namespace: Boolean(vault.value),
  connect: cliLinked.value,
}));

const activeStepKey = computed<StepKey | null>(
  () => ONBOARDING_STEP_KEYS.find((key) => !stepDone.value[key]) ?? null,
);

const stepDetail = computed<Record<StepKey, string>>(() => ({
  account: signedIn.value ? accountEmailShort.value : "Create an account or sign in",
  subscription: paid.value
    ? subscriptionState.value.text
    : vault.value
      ? `${subscriptionState.value.text} — needs attention`
      : "Stripe-hosted payment form",
  namespace: vault.value ? hostedEndpoint.value : "Reserved after checkout",
  connect: cliLinked.value
    ? "Linked from your machine"
    : "Point your CLI at the namespace",
}));

const onboardingSteps = computed<OnboardingStep[]>(() =>
  ONBOARDING_STEP_KEYS.map((key, index) => ({
    key,
    index: index + 1,
    label: ONBOARDING_STEP_LABELS[key],
    detail: stepDetail.value[key],
    // A failed /api/me leaves every downstream fact unknowable. Ticking step
    // one off isClerkSignedIn while greying the rest as "pending" would claim
    // knowledge we do not have. "loading" is the same situation before the
    // fact rather than after it -- the rail is behind the boot veil there, but
    // "unknown" is what it actually is, and RAIL_STATE_LABEL already speaks
    // it to assistive tech.
    state:
      stage.value === "error" || stage.value === "loading"
        ? "unknown"
        : stepDone.value[key]
          ? "done"
          : key === activeStepKey.value
            ? "active"
            : "pending",
  })),
);

type HostedPrice = { amount: number | null; currency: string | null; interval: string | null };
const hostedPrice = ref<HostedPrice | null>(null);

// What the plan costs, read from Stripe. The funnel previously sent people to
// Checkout without naming a price anywhere -- the first number you saw was on
// Stripe's own page, after committing. A literal here would be worse: it
// drifts silently the moment the price changes in Stripe.
const hostedPriceLabel = computed(() => {
  const price = hostedPrice.value;
  if (!price) return null;
  return formatPriceLabel(price.amount, price.currency, price.interval);
});

async function loadPricing() {
  // Never blocks or breaks the funnel: if Stripe is unreachable the price
  // line simply does not render.
  try {
    const response = await fetch("/api/pricing", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    hostedPrice.value = await response.json();
  } catch {
    /* leave hostedPrice null */
  }
}

const onboardingComplete = computed(() => activeStepKey.value === null);
const activeStepNumber = computed(() =>
  activeStepKey.value
    ? ONBOARDING_STEP_KEYS.indexOf(activeStepKey.value) + 1
    : ONBOARDING_STEP_KEYS.length,
);

// Headline and lede follow the active step, so the focal card always names
// the one thing to do rather than describing the whole journey.
const setupHeadline = computed(() => {
  if (stage.value === "account") return "Create your AutoVault account";
  if (stage.value === "subscription") return "Finish checkout";
  return "Reserve your namespace";
});

const setupLede = computed(() => {
  if (stage.value === "account") {
    return "Create your account, reserve a stable namespace, and keep your local CLI as the source of truth. Hosted sync ships next.";
  }
  if (stage.value === "subscription") {
    return "Stripe records the subscription through a webhook before AutoVault reserves your namespace.";
  }
  return "Your subscription is active. Reserve the namespace to finish setup — signing and serving stay on the local CLI today.";
});

const installDocsHref = "/quick-start#install";

const earlyAccessDate = computed(() =>
  formatDate(vault.value?.early_access_at),
);

/* ---------------------------------------------------------------------------
 * Section switcher
 *
 * No router. /cloud is one page whose main area swaps panels, and a URL that
 * named a panel would have to survive the Stripe and Clerk round trips that
 * already own this page's query string and fragment.
 *
 * The switcher only does real work at explore/ready. Before that nearly every
 * nav item is still locked, so there is nothing to switch between and the
 * stage templates simply render — which is why this is a ref and a computed
 * rather than a routing layer.
 * ------------------------------------------------------------------------ */
const STAGE_ORDER: Stage[] = ["account", "subscription", "setup", "connect", "explore", "ready"];

// The stage at which each panel's content first exists, and the single source
// of truth for it: the nav item that selects a panel is locked until this
// stage, and a panel already selected stops being shown if the stage falls
// back below it. Keeping one table is what stops a nav item unlocking before
// the thing it selects is rendered — the defect the old per-item `revealAt`
// duplication invited.
const SECTION_REVEAL: Record<Section, Stage | null> = {
  overview: null,
  machines: "connect",
  skills: "explore",
  billing: "explore",
  // Not "connect", even though the copy is about linked machines and machines
  // itself reveals there: machines only gets away with "connect" because its
  // panel is the one rendered OUTSIDE the explore/ready template (see
  // showsMachines, below). The catalog panel lives inside that template, in
  // the same v-else-if chain as skills and billing -- so "connect" here would
  // unlock the nav item two stages before the template that renders its
  // panel ever mounts, leaving a highlighted item with nothing to show. It
  // also would have described machines nobody has admitted yet: at "connect"
  // cliLinked is false by definition, before "how it relates to your linked
  // machines" is even true.
  catalog: "explore",
};

// What the page's one <h1> says while each panel is on screen. Separate from
// the nav label on purpose: the sidebar names a destination ("Sync log"), the
// heading names the panel's own content, and "Vault catalog" has to stay
// disambiguated from the public skills directory wherever it is written.
const SECTION_TITLE: Record<Section, string> = {
  overview: "Overview",
  billing: "Billing",
  machines: "Machines",
  skills: "Skills",
  catalog: "Vault catalog",
};

// "error" and "loading" are deliberately absent, so indexOf returns -1 for
// both: at either one nothing but overview is reachable, and overview passes
// on the null branch. Adding "loading" to the front of this array would make
// every gated panel compare against it as if it were a step in the funnel,
// which is exactly what it is not.
function stageReached(at: Stage | null, current: Stage) {
  return at === null || STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(at);
}

// What is actually on screen. Revoking the last machine drops the stage from
// explore back to connect, which re-locks Billing and Skills — so a selection
// made before that has to stop being honoured rather than leaving the main
// area rendering a panel whose nav item is disabled.
const activeSection = computed<Section>(() =>
  stageReached(SECTION_REVEAL[selectedSection.value], stage.value)
    ? selectedSection.value
    : "overview",
);

// Header copy follows the stage rather than being hardcoded to "Overview",
// which was only ever correct once a vault existed. The first three branches
// are stage facts that outrank any selection: at error/pre-vault/connect the
// switcher is not what is on screen, so the heading must not describe it.
//
// Past those, the panel IS the page, and the heading has to name the one that
// is showing -- otherwise the sidebar moves aria-current onto Billing while
// the only <h1> still says "Overview", and the DOM states two contradictory
// things about where the reader is. Lives here, below activeSection, because
// that is what the last branch reads.
const pageTitle = computed(() => {
  // Ahead of the pre-vault branch below, which reads `!vault.value` -- true
  // while loading for the same reason it is true for a new visitor. The
  // heading is behind the boot veil either way, but it is also the accessible
  // name every panel region points at, so it must not name a step.
  if (stage.value === "loading") return "Opening your hosted vault…";
  if (stage.value === "error") return "We couldn't load your vault";
  if (!vault.value) return "Reserve a hosted AutoVault namespace";
  if (stage.value === "connect") return "Connect your CLI";
  return SECTION_TITLE[activeSection.value];
});

// Machines is the one panel that is also part of the overview. At connect it
// is the only thing to look at — the CLI is sitting in a spinner waiting to be
// admitted — and once the vault is open, which machines hold it IS the state
// of the vault. Sync log then gives the same list a panel of its own.
const showsMachines = computed(
  () => activeSection.value === "overview" || activeSection.value === "machines",
);

const navItems = computed<NavItem[]>(() => {
  const s = stage.value;
  const current = activeSection.value;
  const item = (
    key: string,
    label: string,
    icon: string,
    opts: {
      soon?: boolean;
      revealAt?: Stage;
      section?: Section;
      // A plain destination (Docs, Support) rather than a panel to switch to.
      // Leaving section/revealAt/soon unset for these falls straight through
      // to revealAt = null below, i.e. always unlocked -- there is no gate to
      // add, only one to not add.
      href?: string;
    } = {},
  ): NavItem => {
    // Resolved once and read by all three of revealed/justRevealed/locked. An
    // item that selects a panel inherits that panel's reveal stage, so the two
    // cannot drift apart; `revealAt` stays available for an item with no panel.
    const revealAt = opts.revealAt ?? (opts.section ? SECTION_REVEAL[opts.section] : null);
    const revealed = stageReached(revealAt, s);
    const justRevealed = revealAt !== null && revealAt === s;
    const locked = Boolean(opts.soon) || !revealed;
    const section = opts.section ?? null;
    const active = !locked && section !== null && section === current;
    const href = opts.href ?? null;
    const external = href !== null && /^https?:\/\//.test(href);
    return {
      key,
      label,
      icon,
      // Not `justRevealed && !active`. That term was vestigial — it only ever
      // suppressed the badge on Overview, which has no reveal stage and so
      // never carried one — and once `active` started moving with the
      // selection it made the badge blink off on the panel you were reading
      // and back on when you left. "New" is a fact about the stage having just
      // unlocked this item, not about what you happen to be looking at.
      badge: opts.soon ? "soon" : justRevealed ? "new" : undefined,
      locked,
      disabled: locked,
      active,
      section,
      href,
      external,
      cls: {
        active,
        soon: Boolean(opts.soon),
        dimmed: !opts.soon && !revealed,
        revealed: justRevealed,
      },
    };
  };

  return [
    item("overview", "Overview", ICON.grid, { section: "overview" }),
    // The skills panel only exists inside the explore/ready template, which is
    // what SECTION_REVEAL.skills says. Enabled any earlier it is a live-looking
    // nav item that silently does nothing.
    item("skills", "Skills", ICON.book, { section: "skills" }),
    // Lands on the machines list. That IS the sync state today: which devices
    // are enrolled, which are admitted, and when each was last seen. Fuller
    // per-release history arrives with catalog publishing.
    item("sync", "Sync log", ICON.sync, { section: "machines" }),
    // Explains what a vault catalog actually is, once there is a linked
    // machine to explain it in the context of. The catalog item below reveals
    // at explore rather than connect -- see the comment on SECTION_REVEAL
    // above for why the two cannot match here the way they do for machines.
    item("catalog", "Catalog", ICON.layers, { section: "catalog" }),
    item("members", "Members", ICON.users, { soon: true }),
    item("billing", "Billing", ICON.card, { section: "billing" }),
    // No panel of its own yet, so this stays what it has always been: an item
    // that reveals at ready and does nothing when clicked. Giving it a section
    // would mean inventing settings there are none of.
    item("settings", "Settings", ICON.gear, { revealAt: "ready" }),
    // Plain links, not panels: useful at every stage, including before a
    // vault exists, so neither carries a section or a reveal stage. Same
    // destinations as the account dropdown (ClerkAuthControls.vue's
    // UserButton menu), reached through the one shared brand config instead
    // of a second copy of these two URLs.
    item("docs", "Docs", ICON.fileText, { href: clerkBrand.docsPath }),
    item("support", "Support", ICON.helpCircle, { href: clerkBrand.supportUrl }),
  ];
});

onMounted(() => {
  void loadCloudState(true);
  void loadPricing();
  // Read once, on mount, rather than tracking the URL. The CLI opens this page
  // with the fingerprint already in it; nothing later in the session changes
  // which machine is asking.
  admitFingerprint.value = readAdmitFingerprint(window.location.search);
  // Same idiom, sharper need: the funnel strips ?hosted=success with
  // replaceState once provisioning settles, and the arrival fires after
  // /api/me -- later than that. See arrivalSearch.
  arrivalSearch.value = window.location.search;
  armLoadPatience();
  bootMountedAt = Date.now();
});

watch([isClerkLoaded, isClerkSignedIn], ([loaded]) => {
  if (!loaded) return;
  void loadCloudState();
});

// Devices only exist once a vault does, and the list is what the connect step
// renders, so start the moment a vault appears rather than on mount.
watch(
  () => vault.value?.id ?? null,
  (vaultId) => {
    // Whatever the list said was about a different vault, or about no vault.
    devicesKnown.value = false;
    if (!vaultId) {
      // Bump the sequence, do not just clear. A list request already in flight
      // for the OLD vault would otherwise pass both staleness checks and
      // repopulate this, leaving a dashboard with no vault claiming machines
      // are linked -- the same race the shell's own /api/me load guards.
      devicesRequestSeq += 1;
      devices.value = [];
      return;
    }
    // Always load once; the watcher above decides whether to keep polling.
    void loadDevices();
    startDevicePolling();
  },
  { immediate: true }
);

async function loadCloudState(initial = false) {
  const requestSeq = ++cloudStateRequestSeq;
  // Captured here, not in the finally. This is the context the request is
  // actually sent under -- authHeaders reads isClerkSignedIn synchronously on
  // the line below -- and Clerk can resolve while the fetch is in flight.
  // Reading it back at completion time would relabel an anonymous request as
  // an authenticated one, which is the flash wearing a different hat.
  const requestSignedIn = isClerkSignedIn.value;
  cloudLoadsInFlight.value += 1;
  try {
    const headers = await authHeaders({ accept: "application/json" }, {
      required: clerkAuthEnabled && isClerkSignedIn.value,
      fresh: isClerkSignedIn.value,
    });
    const response = await fetch("/api/me", {
      credentials: "include",
      headers,
    });
    if (requestSeq !== cloudStateRequestSeq) return;
    cloudState.value = response.ok
      ? normalizeCloudState((await response.json()) as CloudStatePayload)
      : { user: null, subscription: null, vault: null };
    // A 5xx is the server saying it could not answer, and the empty state
    // above is a placeholder, not a report. Reading it as "no subscription,
    // no vault" is the same conflation the loading stage exists to end -- and
    // it lands in the same place: watched live, an /api/me returning 500
    // showed a paying, provisioned owner "Finish checkout". The error stage
    // and its Try again button are for exactly this, and they were reachable
    // only from an auth failure.
    //
    // Deliberately 5xx only. A 4xx here is auth-shaped, and the signed-out
    // path is not one: /api/me answers an anonymous request with 200 and a
    // null user, so no ordinary visitor can reach this branch.
    loadError.value =
      response.status >= 500
        ? "We couldn't reach your vault just now. Nothing has changed on your account."
        : null;
  } catch (error) {
    if (requestSeq !== cloudStateRequestSeq) return;
    if (isClerkApiAuthError(error)) {
      if (error.reason !== "clerk-not-loaded") {
        const message = clerkAuthRecoveryMessage(error);
        notice.value = { kind: "warn", text: message };
        loadError.value = message;
      }
      return;
    }
    cloudState.value = { user: null, subscription: null, vault: null };
    loadError.value = null;
  } finally {
    cloudLoadsInFlight.value -= 1;
    // `initial` used to set hydrated outside the staleness guard, so a slow
    // first request could un-veil the page using a superseded response.
    if (requestSeq === cloudStateRequestSeq || initial) hydrated.value = true;
    // NOT under `|| initial`, and that difference is load-bearing. The mount
    // request is the anonymous one; if it lands after the authenticated
    // follow-up has already resolved, recording its context here would flip
    // cloudStateKnown back to false and pull the veil down over a page that
    // was already correct. It is stale, so it says nothing.
    //
    // Set in the finally rather than on success so a network failure still
    // resolves the wait: /api/me failing leaves loadError null and the state
    // empty, and that has to reach a rendered stage rather than spin.
    if (requestSeq === cloudStateRequestSeq) loadedSignedIn.value = requestSignedIn;
  }
}

async function retryLoad() {
  if (busy.value) return;
  busy.value = true;
  notice.value = null;
  try {
    await loadCloudState();
  } finally {
    busy.value = false;
  }
}

function syncCloudState(payload: CloudStatePayload) {
  // Bump the sequence so any /api/me this page already has in flight bails
  // out instead of overwriting freshly provisioned state.
  //
  // The race is real and lands exactly where it hurts: on a Stripe return
  // this page fires an /api/me before Clerk resolves (so it comes back
  // anonymous and slow), while the funnel reconciles and provisions. Without
  // this bump the stale anonymous response wins on arrival and drops a user
  // who has just paid straight back to "Finish checkout".
  //
  // The contract that makes the bump safe: the funnel only emits payloads it
  // actually knows to be true -- a 200 from /api/me, or a vault it just
  // provisioned. It stays silent when a request fails, precisely because
  // cancelling this page's own load is a side effect a guess cannot afford.
  cloudStateRequestSeq += 1;
  cloudState.value = normalizeCloudState(payload);
  loadError.value = null;
  hydrated.value = true;
  // The funnel only emits what it knows to be true, and it is signed in to
  // have learned it, so this payload speaks for the current context. Without
  // this line the page would stay veiled behind an /api/me it no longer needs.
  loadedSignedIn.value = isClerkSignedIn.value;
}

function normalizeCloudState(payload: CloudStatePayload): CloudState {
  return {
    user: payload.user ?? null,
    subscription: payload.subscription ?? null,
    vault: payload.vault ?? null,
  };
}

// What the account menu's Billing item does. It selects the panel rather than
// jumping straight to Stripe: every other item that navigates this page now
// selects a section, and the panel is where the plan, price, status and period
// end are. Being handed to Stripe's portal without seeing any of that first is
// exactly what the panel exists to fix — the portal is one click further, on
// the panel's own Manage billing button.
//
// Before `explore` there IS no panel (SECTION_REVEAL.billing), and this menu is
// rendered from sign-in onward, so those stages fall through to the portal as
// they did before. Otherwise the item would become a live-looking command that
// does nothing and says nothing, which is the defect openBillingPortal's own
// busy guard was written against. That path stays useful even with no billing
// account yet: the endpoint's 409 wording lands in the notice channel.
function showBilling() {
  if (!stageReached(SECTION_REVEAL.billing, stage.value)) {
    void openBillingPortal();
    return;
  }
  selectedSection.value = "billing";
}

async function openBillingPortal() {
  if (busy.value) {
    // The menu already renders Billing as aria-disabled while this lock is
    // held, so reaching here means the lock was taken between paint and
    // click. Say so rather than swallowing the choice: an apparently live
    // command that does nothing and explains nothing reads as a broken app.
    notice.value = { kind: "warn", text: "Just a moment — finishing the last request." };
    return;
  }
  busy.value = true;
  notice.value = null;
  try {
    const headers = await authHeaders({
      "content-type": "application/json",
      accept: "application/json",
    }, { required: true, fresh: true });
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ return_to: "/cloud#launch-path" }),
    });
    const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      // Covers the 409 "no billing account yet" case as well as a Stripe
      // outage — the server's own wording is more useful than anything
      // generic we could invent here.
      notice.value = {
        kind: "warn",
        text: payload.error || "Couldn't open billing just now. Try again in a moment.",
      };
      return;
    }
    window.location.assign(payload.url);
  } catch (error) {
    notice.value = {
      kind: "warn",
      text: isClerkApiAuthError(error)
        ? clerkAuthRecoveryMessage(error)
        : "Couldn't reach the server. Try again in a moment.",
    };
  } finally {
    busy.value = false;
  }
}

// The console's live view of enrolled machines.
//
// Polled rather than pushed: `autovault link` sits in a spinner asking the
// owner to admit it, so a pending row that only appears on reload is a
// deadlock -- the person is looking at this page waiting for it. Four seconds
// is well inside the CLI's own five-minute wait.
// Relative for anything recent, absolute once it stops being "just now".
// A device the owner is admitting right this second appeared seconds ago, and
// "2026-08-23T01:44:02Z" is a worse answer than "just now" for that.
function formatWhen(iso: string): string {
  const when = Date.parse(iso);
  if (!Number.isFinite(when)) return "recently";
  const seconds = Math.max(0, Math.round((Date.now() - when) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

let deviceLoadInFlight = false;

async function loadDevices() {
  if (!vault.value) return;
  deviceLoadInFlight = true;
  const requestSeq = ++devicesRequestSeq;
  try {
    const headers = await authHeaders({ accept: "application/json" }, {
      required: true,
      fresh: false,
    });
    const response = await fetch("/api/vaults/current/devices", {
      credentials: "include",
      headers,
    });
    if (requestSeq !== devicesRequestSeq) return;
    if (!response.ok) return;
    const payload = (await response.json()) as { devices?: SyncDevice[] };
    if (requestSeq !== devicesRequestSeq) return;
    devices.value = payload.devices ?? [];
    // Only here: inside the staleness guard, and only for a response this
    // page actually parsed. The two early returns above -- a superseded
    // request and a non-2xx -- have not answered the question, and a transient
    // 401 marked "known" would drop a linked owner onto the connect terminal,
    // which is the exact symptom this flag exists to prevent. The poll retries
    // every four seconds, and loadPatienceExpired is the backstop if it never
    // succeeds.
    devicesKnown.value = true;
  } catch {
    // Silent on purpose. This runs on a timer; a transient failure must not
    // stack up notices on a page the owner is reading.
  } finally {
    deviceLoadInFlight = false;
  }
}


// Two speeds, never off.
//
// Fast while something is waiting on the owner -- the connect step, or a
// pending device -- because `autovault link` is sitting in a spinner and four
// seconds is well inside its five-minute wait.
//
// Slow the rest of the time, but NOT stopped. Stopping was the obvious
// optimisation and it was wrong: a second machine running `autovault link`
// against an already-set-up vault creates a pending row that only polling can
// discover, so the condition would gate on the very thing it is meant to find.
// The owner would sit looking at a dashboard that never mentions the machine
// waiting on them.
//
// The cost is why this is throttled at all: /api/vaults/current/devices goes
// through requireUser, which in Clerk mode calls client.users.getUser and
// upserts the user on every request. Thirty seconds idle is ~120 of those an
// hour rather than ~900. The real fix is caching that profile sync in
// getClerkSessionUser, where it would benefit every endpoint; this is the
// version that does not add a second auth path.
const DEVICE_POLL_ACTIVE_MS = 4000;
const DEVICE_POLL_IDLE_MS = 30_000;

let devicePollTimer: ReturnType<typeof setInterval> | undefined;
let devicePollInterval = 0;

// ---- vault motion --------------------------------------------------------
//
// The mark IS the progress indicator: shut while setup is unfinished, open
// once a machine is linked. That is the whole reason it earns a focal slot —
// it is the one element that changes as you advance, so it replaces a rail
// that duplicated the status pills that duplicated the card contents.

const VAULT_UNLOCK_MS = 700;

const vaultOpen = computed(() => stage.value === "explore" || stage.value === "ready");

// The dial sweeps only while something is genuinely in flight. Not a spinner:
// a dial that turns forever reads as a component somebody forgot to stop.
const vaultWorking = computed(
  () =>
    !settled.value ||
    // Same predicate the poll uses. A stale, malformed, or wrong-account
    // `?admit=` never matches a row, so `waiting` is permanent — and without
    // this the dial advertised active work forever, long after the budget had
    // expired, polling had dropped to idle, and the copy had already switched
    // to explaining that nothing was coming.
    (admitState.value === "waiting" && !admitWaitExpired.value) ||
    deviceBusy.value !== null
);

const vaultUnlocking = ref(false);
let vaultUnlockTimer: ReturnType<typeof setTimeout> | undefined;

// Fired from exactly one place — see decideDevice.
//
// NOT from watch(stage), which is the obvious implementation and is wrong.
// This page loads /api/me twice: once on mount, then again when Clerk
// resolves. The first comes back anonymous and computes stage "setup"; the
// second returns the real vault and jumps to "ready". So any guard of the
// form "previous was non-null" celebrates on EVERY reload for EVERY returning
// customer, which is exactly how an animation stops meaning anything.
function celebrateUnlock() {
  // The event beats the load. If the ambient arrival is still running -- which
  // needs an admit within ~1.8s of the page settling, so it is rare rather
  // than impossible -- it is dropped here rather than left to finish
  // underneath. Two vaults moving at once is the same defect the
  // `v-show="!vaultUnlocking"` on the status mark exists to prevent, one layer
  // further back. Deliberately BEFORE the reduced-motion return: this is
  // cleanup, and a preference that changed mid-session must not strand it.
  cancelVaultArrival();
  // Inside the handler, never at setup scope: this only ever runs from a user
  // action, so it cannot contribute to a hydration mismatch the way a
  // setup-time media query read would.
  if (prefersReducedMotion()) return;
  if (vaultUnlockTimer) clearTimeout(vaultUnlockTimer);
  vaultUnlocking.value = true;
  vaultUnlockTimer = setTimeout(() => {
    vaultUnlocking.value = false;
    vaultUnlockTimer = undefined;
  }, VAULT_UNLOCK_MS);
}

onBeforeUnmount(() => {
  if (vaultUnlockTimer) clearTimeout(vaultUnlockTimer);
});

// ---- ambient vault -------------------------------------------------------
//
// "Ambient always, celebrate once." The mark above is the page's progress
// indicator and only exists where a card puts it; this is the same vault
// living in the dashboard's own background at every stage, so the page reads
// as a vault rather than as a form that mentions one.
//
// It is a SECOND, deliberately separate gesture from celebrateUnlock. Note
// the bare identifier in this comment: the call-site count in
// vaultMotion.test.ts reads the raw file, so writing it with parentheses here
// would fail a test whose whole job is to notice a second caller.
//
//   celebrateUnlock    the owner's first machine is admitted. One call site,
//                      inside decideDevice, captured against the state the
//                      owner saw when they clicked (PR #106). Untouched here.
//   vaultArriving      this page arrived. Fires from a load, never from a
//                      state transition, and at most once per occasion.
//
// Routing the load trigger through that function was the obvious
// alternative and is what puts the first-machine ordering at risk: the two
// would share `vaultUnlocking` and `vaultUnlockTimer`, so an overlap could
// leave the transient flag stuck on -- and vaultMotion.test.ts pins the single
// call site precisely because that is the invariant worth keeping. Separate
// ref, separate timer, one stated precedence rule in both directions.
const VAULT_ARRIVAL_MS = 1800;

// Read once, on mount, for the same reason readAdmitFingerprint is: the
// checkout return carries ?hosted=success, and HostedVaultFunnel strips it
// with history.replaceState as soon as provisioning settles. This trigger runs
// after /api/me resolves, which can be well after that -- reading
// window.location.search then would miss the one arrival the ask named first.
const arrivalSearch = ref("");

// Signed up, and past the boot veil. `revealed` is false in the prerendered
// HTML and in the client's first render -- `hydrated` starts false on both
// sides, which makes stage "loading", which makes `settled` false -- so this
// element is absent from both and cannot contribute a hydration mismatch.
//
// It gates on `revealed` rather than on `hydrated`, and the distance between
// those two grew twice in one change, so it is worth stating what each one
// would have cost. The arrival is spent once per occasion
// (consumeVaultArrival) and the watcher below fires the instant this flips:
//
//   `hydrated`  flips on the anonymous mount response, while the veil is
//               still up. The whole 1800ms swell would run behind an opaque
//               overlay and the occasion would be spent on a frame nobody
//               saw -- once per session, so it would not come back.
//   `settled`   flips when the data lands, which is when the boot vault
//               STARTS its unlock. The background arrival would then swell
//               underneath the foreground gesture: two vaults moving at once,
//               which is the defect `v-show="!vaultUnlocking"` on the status
//               mark exists to prevent one layer forward.
//   `revealed`  flips in the tick the veil is removed, which is the first
//               frame of the real page and the only honest place for it.
const ambientVault = computed(() => revealed.value && signedIn.value);

const vaultArriving = ref(false);
let vaultArrivalTimer: ReturnType<typeof setTimeout> | undefined;

function cancelVaultArrival() {
  if (vaultArrivalTimer) clearTimeout(vaultArrivalTimer);
  vaultArrivalTimer = undefined;
  vaultArriving.value = false;
}

function startVaultArrival() {
  // In a watcher callback, never at setup scope -- the same hydration hazard,
  // and the same placement, as the admit celebration's own guard.
  if (prefersReducedMotion()) return;
  // The other half of the precedence rule its counterpart states: whichever
  // gesture is already running owns the moment, and neither can start on top
  // of the other.
  if (vaultUnlocking.value) return;
  // Consume, don't peek. Returns true at most once per occasion, so a reload,
  // an SPA navigation back to /cloud, or a second render of this component
  // cannot re-celebrate.
  if (!consumeVaultArrival(arrivalSearch.value)) return;
  if (vaultArrivalTimer) clearTimeout(vaultArrivalTimer);
  vaultArriving.value = true;
  vaultArrivalTimer = setTimeout(() => {
    vaultArriving.value = false;
    vaultArrivalTimer = undefined;
  }, VAULT_ARRIVAL_MS);
}

// Not `{ immediate: true }`: immediate runs at setup scope, where reading the
// motion preference is the hydration-mismatch class fixed in PR #88.
// `ambientVault` is false at setup on both server and client anyway -- it
// cannot flip before /api/me lands, which is post-mount by construction.
watch(ambientVault, (visible) => {
  if (visible) startVaultArrival();
});

onBeforeUnmount(cancelVaultArrival);

const devicePollUrgent = computed(
  () =>
    stage.value === "connect" ||
    pendingDevices.value.length > 0 ||
    // A machine linking against an already-set-up vault reaches neither of the
    // conditions above until its row lands, so on the idle 30s cadence the
    // owner could sit for half a minute on a page that came from the CLI and
    // shows nothing. `?admit=` is positive evidence that a row is inbound --
    // but only until the budget above runs out, because a link that matches
    // nothing is evidence of nothing.
    (admitState.value === "waiting" && !admitWaitExpired.value)
);

function stopDevicePolling() {
  if (devicePollTimer) clearInterval(devicePollTimer);
  devicePollTimer = undefined;
  devicePollInterval = 0;
}

function startDevicePolling() {
  if (typeof window === "undefined" || !vault.value) return;
  const wanted = devicePollUrgent.value ? DEVICE_POLL_ACTIVE_MS : DEVICE_POLL_IDLE_MS;
  if (devicePollTimer && devicePollInterval === wanted) return;
  stopDevicePolling();
  devicePollInterval = wanted;
  devicePollTimer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    // Skip the tick rather than stacking a second request. Each call bumps
    // devicesRequestSeq, so an overlapping poll invalidates the one already in
    // flight -- and if latency stays above the interval, every response is
    // superseded before it lands and the list never updates at all, while the
    // backend takes the load of all of them. Explicit refreshes after an
    // action still go through: those are newer on purpose.
    if (deviceLoadInFlight) return;
    void loadDevices();
  }, wanted);
}

watch(devicePollUrgent, () => startDevicePolling());

onBeforeUnmount(stopDevicePolling);

async function decideDevice(deviceId: string, action: "admit" | "revoke") {
  if (deviceBusy.value) return;
  deviceBusy.value = deviceId;
  notice.value = null;
  // Read before anything awaits. Captured after the request instead, the
  // four-second device poll can land between the server committing the admit
  // and this handler resuming — it sees the device already active, flips
  // vaultOpen, and `wasOpen` then reads true, so the owner's *first* machine
  // silently gets no celebration. This is also what the comment below means
  // by the state the owner actually saw: the state at the moment they clicked.
  const wasOpen = vaultOpen.value;
  try {
    const headers = await authHeaders({
      "content-type": "application/json",
      accept: "application/json",
    }, { required: true, fresh: true });
    const response = await fetch(`/api/vaults/current/devices/${encodeURIComponent(deviceId)}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      notice.value = { kind: "warn", text: payload.error || "Couldn't update that device just now." };
      return;
    }
    // Only a closed vault becoming open celebrates — admitting a second
    // machine to an already-open vault is routine.
    //
    // Deliberately NOT gated on vaultOpen.value after the refresh. A 2xx from
    // the admit endpoint means the server activated the device, so a vault
    // that had no active machine before now has one — whether or not the
    // follow-up list request succeeded. loadDevices() is silent on failure by
    // design (it also runs on a timer), so reading state back from it made a
    // transient network blip swallow the one celebration that matters, with
    // no stage watcher to catch it later.
    const opened = action === "admit" && !wasOpen;

    // Apply what the server just confirmed, before the refresh and without
    // depending on it. A 2xx means this device's status changed; holding that
    // only in the response and re-deriving it from a separate request made the
    // open state hostage to that request succeeding.
    //
    // Without this the previous fix traded one bug for a worse one: the
    // celebration fired unconditionally, but `devices` still held the pending
    // row, so the mark played the unlock and then dropped back to locked when
    // the 700ms timer cleared. A vault that visibly opens and shuts again is
    // worse than one that never animated.
    //
    // Safe in both directions because both reflect a confirmed write, and the
    // poll reconciles either way a few seconds later.
    devices.value = devices.value.map((device) =>
      device.id === deviceId
        ? { ...device, status: action === "admit" ? "active" : "revoked" }
        : device
    );

    // Same tick as the write above, before anything yields. Awaiting first let
    // Vue render once with vaultOpen already true and vaultUnlocking still
    // false — the focal mark gone, the strip in its place — and then reverse
    // that when the celebration finally started. A slow refresh made the
    // teleport conspicuous; a hanging one meant no animation at all.
    if (opened) celebrateUnlock();

    await loadDevices();
    notice.value = {
      kind: "ok",
      text: action === "admit"
        ? "Device admitted. Its CLI will pick that up within a couple of seconds."
        : "Device revoked. It can no longer pull from this vault.",
    };
  } catch (error) {
    notice.value = {
      kind: "warn",
      text: isClerkApiAuthError(error)
        ? clerkAuthRecoveryMessage(error)
        : "Couldn't reach the device endpoint just now.",
    };
  } finally {
    deviceBusy.value = null;
  }
}

async function markProgress(step: "early_access") {
  if (busy.value || !vault.value) return;
  busy.value = true;
  notice.value = null;
  try {
    const headers = await authHeaders({
      "content-type": "application/json",
      accept: "application/json",
    }, { required: true, fresh: true });
    const response = await fetch("/api/vaults/current/progress", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ step }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.vault) {
      notice.value = {
        kind: "warn",
        text:
          payload.error ||
          "Couldn't save that just now — try again in a moment.",
      };
      return;
    }
    cloudState.value = { ...cloudState.value, vault: payload.vault };
    notice.value = {
      kind: "ok",
      text: "You're on the early-access list. We'll be in touch.",
    };
  } catch (error) {
    if (isClerkApiAuthError(error)) {
      notice.value = { kind: "warn", text: clerkAuthRecoveryMessage(error) };
      return;
    }
    notice.value = {
      kind: "warn",
      text: "Couldn't reach the server — try again in a moment.",
    };
  } finally {
    busy.value = false;
  }
}

function onNavClick(item: NavItem) {
  // Belt and braces with :disabled on the button. A locked item has no panel
  // to show — Members has none at all, a stage-gated one has not been reached
  // — so selecting it would leave the sidebar highlighting something the main
  // area cannot render.
  if (item.locked || !item.section) return;
  selectedSection.value = item.section;
  // Machines has no template block of its own — see showsMachines above the
  // devices list — so selecting it can leave the page looking identical to
  // Overview, with only aria-current moving. That reads as a broken click
  // right when someone is watching for their first device to show up.
  // Scroll to the list so it visibly does something; every other item's own
  // panel is feedback enough on its own.
  if (item.section === "machines") void focusDevicesCard();
}

let devicesFlashTimer: ReturnType<typeof setTimeout> | undefined;

// Scroll the machines list into view and flash it. The admit handshake is the
// only caller: nav items switch panels instead of scrolling now.
async function focusDevicesCard() {
  await nextTick();
  // Read after the tick rather than taken as an argument. The caller may have
  // just switched to the panel that renders this, in which case the ref was
  // still null at call time.
  devicesCard.value?.scrollIntoView({ behavior: "smooth", block: "center" });
  devicesFlash.value = true;
  if (devicesFlashTimer) clearTimeout(devicesFlashTimer);
  devicesFlashTimer = setTimeout(() => {
    devicesFlash.value = false;
    devicesFlashTimer = undefined;
  }, 1400);
}

onBeforeUnmount(() => {
  if (devicesFlashTimer) clearTimeout(devicesFlashTimer);
});

function revealDelay(index: number) {
  return { animationDelay: `${index * 90}ms` };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ICON = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V6a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v14H6a2 2 0 0 1-2-2Z"/><path d="M8 7h8"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
  helpCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
} as const;
</script>

<style scoped>
.cv-page {
  --cv-radius: 14px;
  --cv-radius-sm: 9px;
  position: relative;
  width: 100%;
  padding-top: 24px;
  color: var(--ink);
}

/* ---------------- boot veil ---------------- */
/* Overlays the shell rather than replacing it, so the prerendered HTML
   already contains the real layout and nothing jumps when /api/me lands.
   The background is an opaque token, not an alpha: this has to hide the
   pre-vault card underneath, not tint it. */
.cv-boot {
  position: absolute;
  inset: 24px 0 0;
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 26px;
  border-radius: var(--cv-radius);
  background: var(--bg);
  color: var(--ink-3);
  font-size: 14px;
}
/* The reveal, and the reason it is 700ms with a hold: opacity stays at 1
   through the dial's 140deg turn and clears only as the dial retracts. 55% is
   the exact frame brand-mark-unlock changes direction on, so the dashboard
   appears from behind a vault that is opening rather than after one that has
   already opened. Perceived cost is the tail, not the whole gesture. */
.cv-boot.opening {
  animation: cv-boot-open 700ms var(--ease) forwards;
  pointer-events: none;
}

.cv-boot-vault {
  position: relative;
  display: grid;
  place-items: center;
  width: 232px;
  height: 232px;
}
/* Concentric rings, in the mark's own vocabulary rather than a new one: the
   middle ring is dashed because the vault's interior is (brand-mark-depth),
   and the outer breathes on brand-mark-breathe's 2.2s so the whole
   composition pulses as one object instead of two. */
.cv-boot-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid var(--line);
  pointer-events: none;
}
.cv-boot-ring.inner {
  width: 124px;
  height: 124px;
  border-color: var(--line-2);
}
.cv-boot-ring.mid {
  width: 176px;
  height: 176px;
  border-style: dashed;
  border-color: rgba(90, 214, 192, 0.22);
  animation: cv-boot-turn 16s linear infinite;
}
.cv-boot-ring.outer {
  width: 232px;
  height: 232px;
  animation: cv-boot-breathe 2.2s ease-in-out infinite;
}
.cv-boot-halo {
  position: absolute;
  width: 232px;
  height: 232px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(90, 214, 192, 0.1), transparent 68%);
  pointer-events: none;
}
.cv-boot-mark {
  position: relative;
  color: var(--accent);
}

/* Eyebrow + spark moved from the deleted pre-vault header into the topbar,
   where they now render at every stage as persistent chrome. */
.cv-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.cv-spark {
  width: 16px;
  height: 1px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

/* ---------------- product shell ---------------- */
.cv-shell {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--cv-radius);
  background: var(--bg);
  overflow: hidden;
  min-height: 640px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}

/* sidebar */
.cv-side {
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  background: var(--bg-2);
  border-right: 1px solid var(--line);
}
.cv-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line-2);
}
.cv-brand-mark {
  display: inline-flex;
}
.cv-brand-ns {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
}
.cv-slash {
  color: var(--accent);
}

.cv-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.cv-nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease);
}
.cv-nav-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.035);
  color: var(--ink);
}
.cv-nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: rgba(90, 214, 192, 0.22);
}
.cv-nav-item.dimmed {
  color: var(--ink-4);
  cursor: default;
}
.cv-nav-item.soon {
  color: var(--ink-3);
  cursor: default;
}
.cv-nav-item:disabled {
  cursor: default;
}
.cv-nav-item.revealed {
  animation: cv-nav-pop 0.5s var(--ease) both;
}
.cv-nav-ic {
  display: inline-flex;
  flex: none;
}
.cv-nav-ic :deep(svg) {
  width: 15px;
  height: 15px;
  opacity: 0.85;
}
.cv-nav-label {
  flex: 1;
}
.cv-nav-soon {
  font-family: var(--mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--violet);
  border: 1px solid rgba(180, 138, 214, 0.4);
  background: rgba(180, 138, 214, 0.1);
  border-radius: 5px;
  padding: 1px 6px;
}
.cv-nav-new {
  font-family: var(--mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid rgba(90, 214, 192, 0.45);
  border-radius: 5px;
  padding: 1px 6px;
  animation: cv-nav-pop 0.5s var(--ease) both;
}
.cv-nav-lock {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.5;
}


/* main content */
.cv-content {
  /* Both properties are load-bearing for the ambient vault below, and
     `z-index: 0` is the half that is easy to delete as redundant. `position:
     relative` alone does NOT create a stacking context, so .cv-ambient's
     `z-index: -1` would escape to whatever ancestor does -- landing behind
     .cv-shell's opaque `background: var(--bg)`, where it is invisible.
     Together they make this element the context, so -1 means "above this
     element's own background, below its in-flow children", which is exactly
     what a page background is. */
  position: relative;
  z-index: 0;
  padding: 26px 30px 40px;
  min-width: 0;
}

/* ---------------- ambient vault ----------------
   Subtle by construction, and kept out of .cv-focal-glow's way on every axis
   that could make the two read as one effect: opposite corner of the content
   area (that glow is 220px at the focal card's top-right, this is bottom-right
   of the whole column), three times slower, and an order of magnitude fainter
   -- 0.055 alpha against the glow's 0.16. It is also BEHIND every card, so
   wherever the glow is on screen this is painted under an opaque panel.

   The resting opacity and transform are declared here rather than living only
   in the keyframes. Under `prefers-reduced-motion` the block at the bottom of
   this file kills the animation, and an element whose rest state existed only
   in a 0% frame would be left wherever the UA put it. Same hazard styles.css
   documents for brand-mark-unlock. */
.cv-ambient {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.cv-ambient-halo {
  position: absolute;
  right: -150px;
  bottom: -170px;
  width: 540px;
  height: 540px;
  border-radius: 50%;
  opacity: 1;
  transform: scale(1);
  background: radial-gradient(
    circle,
    rgba(90, 214, 192, 0.075),
    transparent 68%
  );
}
.cv-ambient-mark {
  position: absolute;
  right: -44px;
  bottom: -30px;
  display: block;
  line-height: 0;
  color: var(--accent);
  opacity: 0.055;
  transform: scale(1);
  animation: cv-ambient-drift 18s var(--ease) infinite;
}

/* The arrival: one swell, then it settles into the resting values above. Both
   keyframes end exactly on those values -- if they did not, dropping
   `.arriving` would snap, the same rule brand-mark-unlock's 100% frame
   follows. `both` holds the 0% frame during any delay and the 100% frame
   after, so there is no flash of full-strength ambient before it starts. */
.cv-ambient.arriving .cv-ambient-mark {
  animation: cv-ambient-arrive 1800ms var(--ease) both;
}
.cv-ambient.arriving .cv-ambient-halo {
  animation: cv-ambient-arrive-halo 1800ms var(--ease) both;
}
.cv-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}
.cv-crumb {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-3);
}
.cv-crumb-host {
  color: var(--accent);
}
.cv-topbar h1 {
  margin: 5px 0 0;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.cv-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cv-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 11px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  white-space: nowrap;
}
.cv-pill.sm {
  padding: 2px 9px;
}
.cv-pill .cv-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.cv-pill.ok {
  color: var(--ok);
  border-color: rgba(123, 216, 143, 0.36);
  background: rgba(123, 216, 143, 0.08);
}
.cv-pill.warn {
  color: var(--warn);
  border-color: rgba(232, 168, 102, 0.36);
  background: rgba(232, 168, 102, 0.08);
}
.cv-pill.bad {
  color: var(--bad);
  border-color: rgba(217, 113, 113, 0.36);
  background: rgba(217, 113, 113, 0.08);
}
.cv-pill.mut {
  color: var(--ink-3);
}

.cv-sub-warn {
  margin: 10px 0 0;
  font-size: 12px;
}

.cv-notice {
  margin: 0 0 18px;
  padding: 10px 14px;
  border-radius: var(--cv-radius-sm);
  font-size: 13px;
}
.cv-notice.ok {
  color: var(--ok);
  border: 1px solid rgba(123, 216, 143, 0.3);
  background: rgba(123, 216, 143, 0.07);
}
.cv-notice.warn {
  color: var(--warn);
  border: 1px solid rgba(232, 168, 102, 0.3);
  background: rgba(232, 168, 102, 0.07);
}
/* The funnel emits a third tone for hard failures (Stripe not configured,
   provisioning refused). Without this rule those rendered unstyled. */
.cv-notice.fail {
  color: var(--bad);
  border: 1px solid rgba(217, 113, 113, 0.3);
  background: rgba(217, 113, 113, 0.07);
}

.cv-greeting {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 14px;
}

/* focal card (stage A) */
.cv-focal {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(90, 214, 192, 0.24);
  border-radius: var(--cv-radius);
  background: linear-gradient(125deg, #11212b 0%, #0e1820 58%, #0d161d 100%);
  padding: 26px 28px;
  max-width: 640px;
}
.cv-focal-glow {
  position: absolute;
  right: -50px;
  top: -50px;
  width: 220px;
  height: 220px;
  background: radial-gradient(
    circle,
    rgba(90, 214, 192, 0.16),
    transparent 70%
  );
  pointer-events: none;
  animation: cv-breathe 6s var(--ease) infinite;
}
.cv-focal-ns {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.cv-endpoint-mono {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
  min-width: 0;
  overflow-wrap: anywhere;
}
.cv-step-kicker {
  margin-top: 16px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.cv-focal h2 {
  margin: 6px 0 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.cv-focal-body {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.55;
  max-width: 520px;
}

/* ---------------- connect-stage terminal ----------------
   The card. Everything from .terminal-head down is inside it, and
   `overflow: hidden` is what makes the head's top corners follow this
   radius instead of squaring off over it. Mirrors .hcc-terminal /
   .hosted-command-card in HostedVaultFunnel.vue -- one terminal language on
   this site, not two.

   Everything below this rule is inside the ConnectTerminal child, whose
   non-root elements never receive this block's scope attribute (see the
   comment on its render function). Written flat, these rules compiled to
   selectors that matched nothing, which is why the connect terminal shipped
   with the global 400px .terminal-body and a browser-default "Copy" button.
   :deep() is what carries them across that boundary; .cv-connect-terminal
   itself lives in CloudPage's own template, so it anchors them correctly. */
.cv-connect-terminal {
  margin-bottom: 4px;
  border: 1px solid var(--line-2);
  border-radius: var(--cv-radius-sm);
  /* The head bar's own colour, from the global .terminal-head rule, so the
     copy row under the terminal matches it and the whole thing reads as one
     card. Not var(--panel), which is what the .cv-devices.standalone card
     below uses: this one has to agree with .terminal-head, that one with
     .cv-card. Neither is the --bg-1 token, which this repo never declares --
     that is why the card below used to paint transparent. */
  background: var(--bg-2);
  overflow: hidden;
}
.cv-connect-terminal :deep(.cv-terminal-wrapper) {
  position: relative;
}
.cv-connect-terminal :deep(.cv-terminal-body) {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  background: #0a0f13;
  /* Beats the global .terminal-body 400px min/max, which sized this for a
     full-screen demo terminal and left two thirds of it empty here. */
  min-height: auto;
  max-height: none;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--ink);
  white-space: pre;
}
.cv-connect-terminal :deep(.cv-copy-row) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
}
/* Deliberately the same shape as the global `.hosted-copy-row button` the
   reference card uses -- mono, 11px, 32px tall, accent on hover -- expressed
   in this page's own tokens rather than by borrowing that class, so the
   button sits in the .cv-btn family it is surrounded by. */
.cv-connect-terminal :deep(.cv-cmd-copy) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  /* The label swaps to "Copied" for 1.6s on click. Without a floor the button
     shrinks by ~40px and snaps back, which reads as a glitch on the one
     control this stage is asking people to press. */
  min-width: 7rem;
  padding: 7px 11px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--ink-2);
  font: 11px var(--mono);
  cursor: pointer;
  transition:
    border-color 140ms var(--ease),
    color 140ms var(--ease);
}
.cv-connect-terminal :deep(.cv-cmd-copy:hover) {
  border-color: var(--accent);
  color: var(--accent);
}

/* ---------------- connect → machines bridge ----------------
   The terminal signs off with "waiting for you to admit it below" and this
   is what makes "below" point at something. The rule is the physical link
   down to the Machines card; the sentence says what to do once the eye
   arrives. Both are connect-stage only. */
.cv-nextstep {
  display: grid;
  justify-items: start;
  gap: 6px;
  margin: 14px 0 0;
  max-width: 640px;
}
.cv-nextstep-rule {
  width: 1px;
  height: 22px;
  /* Lands on the caret's centre, so the rule and the arrow read as one
     stroke rather than two marks that nearly line up. */
  margin-left: 4px;
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--accent) 55%, transparent)
  );
}
.cv-nextstep-copy {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.5;
}
.cv-nextstep-copy strong {
  color: var(--ink);
  font-weight: 600;
}
.cv-nextstep-caret {
  color: var(--accent);
  font-size: 12px;
  line-height: 1;
}

.cv-devices {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
/* Inside the focal card it borrowed that card's frame. On its own it needs
   one, and it is now the only route to revoking a machine. */
.cv-devices.standalone {
  margin-top: 20px;
  padding: 16px 18px 18px;
  border: 1px solid var(--line);
  border-radius: var(--cv-radius);
  /* Was the --bg-1 token, which is declared nowhere in this repo -- so this
     card, the one the connect stage points at, painted transparent and read as
     a bare border on the page background. --panel is what .cv-card uses, and
     this is a card in the same column; the .cv-device rows inside stay on the
     darker --bg-2 and now read as inset rather than as the card itself. */
  background: var(--panel);
}
.cv-devices.standalone.focusflash {
  border-color: var(--accent);
}
/* At connect this card is the next step, not a peer panel -- the same accent
   focusflash uses, held rather than flashed, so the sentence above it lands
   somewhere visibly live. Dropped from `explore` on, where Machines stops
   being the thing to do next and going on shouting would be a lie. */
.cv-devices.standalone.awaiting {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent);
}

.cv-devices-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ink-2);
}
.cv-devices-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(230, 180, 90, 0.16);
  color: #e6b45a;
  font-size: 11px;
  font-weight: 500;
}
.cv-devices-empty {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cv-device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cv-device {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--cv-radius-sm);
  background: var(--bg-2);
}
.cv-device.pending {
  border-color: rgba(230, 180, 90, 0.4);
}
/* The row the CLI sent this owner here to act on. Focus lands on its Admit
   button, so this only has to make the target obvious among siblings -- the
   keyboard affordance is already handled. */
.cv-device.admit-target {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent);
}
.cv-devices-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cv-devices-waiting code {
  font-size: 11.5px;
  color: var(--ink-2);
}
.cv-devices-waiting .cv-dot {
  animation: cv-admit-pulse 1.6s ease-in-out infinite;
}
/* Stop pulsing once nothing is coming — the animation reads as progress. */
.cv-devices-waiting.stalled .cv-dot {
  animation: none;
  opacity: 0.35;
}
@keyframes cv-admit-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}
.cv-device-id {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.cv-device-id strong {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cv-device-id code {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
.cv-device-seen {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
  flex: 0 0 auto;
}
.cv-device-seen small {
  font-size: 11px;
  color: var(--ink-3);
}
.cv-device-actions {
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
}
.cv-btn.small {
  padding: 5px 10px;
  font-size: 12px;
}

/* Below 640px the three columns stop fitting side by side; the actions want
   to stay reachable rather than shrink to nothing. */
@media (max-width: 640px) {
  .cv-device {
    flex-wrap: wrap;
  }
  .cv-device-seen {
    align-items: flex-start;
  }
  .cv-device-actions {
    width: 100%;
  }
  .cv-device-actions .cv-btn {
    flex: 1 1 auto;
  }
}

.cv-focal-actions,
/* Same row, inside a card rather than a focal block — the Billing panel's
   Manage-billing button. */
.cv-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.cv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: var(--cv-radius-sm);
  background: var(--accent);
  color: var(--accent-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 18px;
  cursor: pointer;
  text-decoration: none;
  transition:
    filter var(--dur-fast) var(--ease),
    transform var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
}
.cv-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(90, 214, 192, 0.22);
}
.cv-btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: none;
}
.cv-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.cv-btn.ghost {
  background: transparent;
  border-color: var(--line);
  color: var(--ink-2);
}
.cv-btn.ghost:hover {
  border-color: var(--ink-3);
  color: var(--ink);
  filter: none;
  box-shadow: none;
}

/* keyboard focus — interactive elements get a clear mint ring.
   The copy button is split out because it lives inside ConnectTerminal and
   needs :deep() to be reached at all; listed flat here it silently gave that
   one button no focus ring. */
.cv-btn:focus-visible,
.cv-nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.cv-connect-terminal :deep(.cv-cmd-copy:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* The vault, focal. Sized so it reads as the subject of the page rather than
   an icon, and centered because at these stages there is exactly one thing to
   do and nothing should compete with it. */
/* Mark and progress as one unit rather than two stacked strangers. The
   connect stage used to read as four separate things down the page — mark,
   rail, a greeting that paraphrased the card under it, then the card. This is
   the first two of those becoming one, and the greeting is gone. */
.cv-vaulthead {
  display: grid;
  justify-items: center;
  gap: 2px;
  margin-bottom: 26px;
}
/* Inside the head the rail is a caption, not a section: centered, quieter,
   and it keeps its labels because they say what is left to do — which is the
   whole reason it is still here rather than being reduced to dots. */
.cv-vaulthead .cv-rail {
  margin: 0;
  justify-content: center;
  flex-wrap: wrap;
  row-gap: 8px;
}
.cv-vaulthead .cv-rail-step {
  font-size: 11.5px;
}
.cv-vaulthead .cv-rail-copy small {
  display: none;
}
/* The detail line is the one thing that goes: it is per-step prose and turns
   a caption back into a section. `active` keeps it, because that is the step
   the reader is actually on. */
.cv-vaulthead .cv-rail-step.active .cv-rail-copy small {
  display: block;
  /* The base rule caps this at 150px with nowrap + ellipsis, which is right
     for a four-across row of fixed columns and wrong for a centered caption:
     it clipped "Point your CLI at the namespace" to "…at the nama…". The one
     line that is meant to tell you what to do next should be readable. */
  max-width: none;
  white-space: normal;
  overflow: visible;
  text-align: center;
}

.cv-vaultfocal {
  display: grid;
  place-items: center;
  padding: 6px 0 18px;
  color: var(--accent);
}
.cv-vaultfocal :deep(.brand-mark-svg),
.cv-status-mark :deep(.brand-mark-svg),
.cv-boot-mark :deep(.brand-mark-svg),
.cv-ambient-mark :deep(.brand-mark-svg) {
  color: inherit;
}
/* Compact once the vault is open: it states the one fact this strip exists
   for, so the pill beside it does not have to. */
.cv-status-mark {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--accent);
}

.cv-rail {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
}
.cv-rail-step {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  font-size: 12px;
  color: var(--ink-3);
}
.cv-rail-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.cv-rail-copy strong {
  font-weight: 500;
  font-size: 12.5px;
  color: var(--ink-3);
}
.cv-rail-copy small {
  font-size: 11px;
  color: var(--ink-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}
.cv-rail-step.active .cv-rail-copy strong,
.cv-rail-step.done .cv-rail-copy strong {
  color: var(--ink);
}
.cv-rail-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  margin-top: 1px;
  border-radius: 50%;
  border: 1.5px solid var(--line-2);
  font-size: 10px;
  flex: none;
  transition:
    border-color var(--dur-base) var(--ease),
    color var(--dur-base) var(--ease);
}
.cv-rail-step.active .cv-rail-dot {
  border-color: var(--accent);
  color: var(--accent);
}
.cv-rail-step.done .cv-rail-dot {
  border-color: var(--ok);
  color: var(--ok);
}
/* A failed /api/me means we know nothing about any step -- render that
   honestly rather than implying "not started". */
.cv-rail-step.unknown .cv-rail-dot {
  border-style: dashed;
  border-color: var(--line-2);
  color: var(--ink-4);
}
.cv-rail-line {
  flex: 1;
  max-width: 44px;
  height: 1.5px;
  margin: 10px 12px 0;
  background: var(--line-2);
}
/* Once every step is done the rail has no job left, so it collapses to a
   quiet completed row instead of parking a finished progress bar on the
   resting dashboard forever. */
.cv-rail.complete .cv-rail-copy small,
.cv-rail.complete .cv-rail-line {
  display: none;
}
.cv-rail.complete .cv-rail-step {
  gap: 6px;
}
.cv-rail.complete .cv-rail-step + .cv-rail-step {
  margin-left: 16px;
}
.cv-rail.complete .cv-rail-dot {
  width: 15px;
  height: 15px;
  font-size: 8.5px;
}
.cv-rail.complete .cv-rail-copy strong {
  font-size: 11.5px;
  color: var(--ink-3);
}

/* Signed-out: the shell is visible but obviously not yours yet. Opacity
   rather than blur -- blur is unreadable and reads as motion. */
.cv-shell.locked .cv-nav,
.cv-shell.locked .cv-acct {
  opacity: 0.55;
}
.cv-shell.booting {
  pointer-events: none;
}
.cv-price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 20px;
}
.cv-price strong {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.cv-price span {
  font-size: 12.5px;
  color: var(--ink-3);
}

.cv-brand-ns.pending {
  color: var(--ink-4);
}

/* Four labelled steps cannot sit side by side on a phone -- flexed across,
   the labels wrap one character per line. Stack them instead and drop the
   connector, which has no meaning in a vertical list. */
@media (max-width: 640px) {
  .cv-rail {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .cv-rail-line {
    display: none;
  }
  .cv-rail-copy small {
    max-width: none;
  }
  .cv-rail.complete {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 10px 0;
  }
}

/* status card (stage B/C) */
.cv-status-card {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  border: 1px solid rgba(123, 216, 143, 0.24);
  border-radius: var(--cv-radius);
  background: rgba(123, 216, 143, 0.04);
  padding: 15px 18px;
  margin-bottom: 16px;
  animation: cv-reveal 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.cv-status-text {
  color: var(--ink-2);
  font-size: 13px;
}
.cv-status-text code {
  font-family: var(--mono);
  color: var(--ink);
}
/* Pushed to the trailing edge so the strip reads state-then-action, and
   allowed to wrap onto its own line under the text on narrow viewports --
   the parent is already flex-wrap: wrap, so this only has to stop claiming
   the leftover space. */
.cv-status-cta {
  margin-left: auto;
  flex: 0 0 auto;
}

/* cards & reveal */
.cv-reveal {
  animation: cv-reveal 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  margin-bottom: 16px;
}
.cv-card {
  border: 1px solid var(--line);
  border-radius: var(--cv-radius);
  background: var(--panel);
  padding: 18px 20px;
  transition:
    box-shadow var(--dur-base) var(--ease),
    border-color var(--dur-base) var(--ease);
}
.cv-card.soft {
  background: var(--bg-2);
}
.cv-card-label {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 12px;
}
.cv-card-label.violet {
  color: var(--violet);
}
.cv-kv {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
}
.cv-kv li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--line-2);
  font-size: 13px;
}
.cv-kv li:last-child {
  border-bottom: 0;
}
.cv-kv span {
  color: var(--ink-3);
}
.cv-kv strong {
  font-weight: 500;
  color: var(--ink);
}
.cv-reserved {
  list-style: none;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--line-2);
}
.cv-reserved li {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 0;
  font-size: 12.5px;
  color: var(--ink-2);
}
.cv-chk {
  color: var(--ok);
  font-weight: 700;
}
.cv-muted {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.5;
  margin: 10px 0 0;
}
.cv-muted.sm {
  font-size: 12px;
  margin-top: 10px;
}
.cv-muted a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--line-2);
}
.cv-muted a:hover {
  text-decoration-color: var(--accent);
}

/* app preview */
.cv-preview {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 26px;
  align-items: center;
  border: 1px solid rgba(180, 138, 214, 0.28);
  border-radius: var(--cv-radius);
  background: var(--panel);
  padding: 22px;
  transition:
    box-shadow var(--dur-base) var(--ease),
    border-color var(--dur-base) var(--ease);
}
.cv-appframe {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--cv-radius-sm);
  background: #0a0f13;
}
.cv-appframe::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 52%, rgba(7, 11, 14, 0.5));
  pointer-events: none;
}
.cv-appbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 13px;
  border-bottom: 1px solid var(--line-2);
  background: #0d141a;
}
.cv-tdot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.cv-tdot.bad {
  background: var(--bad);
}
.cv-tdot.warn {
  background: var(--warn);
}
.cv-tdot.ok {
  background: var(--ok);
}
.cv-appurl {
  margin-left: 8px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
.cv-appbody {
  display: flex;
  min-height: 188px;
}
.cv-appnav {
  width: 100px;
  border-right: 1px solid var(--line-2);
  padding: 11px 8px;
  background: #0b1117;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cv-appnav span {
  font-size: 11px;
  color: var(--ink-3);
  padding: 5px 8px;
  border-radius: 5px;
}
.cv-appnav span.on {
  background: var(--accent-soft);
  color: var(--accent);
}
.cv-appmain {
  flex: 1;
  padding: 13px;
}
.cv-appsearch {
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--line-2);
  background: #0b1117;
  margin-bottom: 10px;
}
.cv-approw {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid var(--line-2);
  border-radius: 7px;
  margin-bottom: 7px;
  background: var(--panel);
}
.cv-appicon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--accent-soft);
  flex: none;
}
.cv-appskel {
  height: 7px;
  border-radius: 4px;
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0.06) 30%,
    rgba(90, 214, 192, 0.18) 50%,
    rgba(255, 255, 255, 0.06) 70%
  );
  background-size: 220% 100%;
  animation: cv-shimmer 2.6s var(--ease) infinite;
}
.cv-approw:nth-child(3) .cv-appskel {
  animation-delay: 0.25s;
}
.cv-approw:nth-child(4) .cv-appskel {
  animation-delay: 0.5s;
}
.cv-appsync {
  margin-left: auto;
  font-size: 9px;
  color: var(--ok);
  white-space: nowrap;
  animation: cv-sync-pulse 2.2s var(--ease) infinite;
}

.cv-preview-copy h2 {
  margin: 8px 0;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.02em;
}
.cv-preview-copy p {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.55;
}
.cv-feats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.cv-feats span {
  font-size: 11px;
  color: var(--ink-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 11px;
}
.cv-confirm {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid rgba(123, 216, 143, 0.3);
  border-radius: var(--cv-radius-sm);
  background: rgba(123, 216, 143, 0.07);
  padding: 12px 14px;
}
.cv-confirm-ic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(123, 216, 143, 0.18);
  color: var(--ok);
  font-weight: 700;
  flex: none;
}
.cv-confirm span {
  font-size: 13px;
  color: var(--ink);
}
.cv-confirm small {
  display: block;
  color: var(--ink-3);
  font-size: 11.5px;
  margin-top: 2px;
}

/* animations */
@keyframes cv-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cv-nav-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* cv-pulse used to live here, driving the old 30px boot mark. The mark's own
   `working` prop is the loading graphic now, so the wrapper animation went
   with it -- and an unused @keyframes is the same dead weight as the unused
   rules Task A found by compiling the stylesheet. */

/* The reveal. See .cv-boot.opening for why the hold runs to 55%. */
@keyframes cv-boot-open {
  0%,
  55% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes cv-boot-turn {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
/* Restates its resting values at 0/100% rather than only travelling from
   them, so `animation: none` under reduced motion lands on a ring that is
   present and still -- the hazard styles.css documents for the mark itself. */
@keyframes cv-boot-breathe {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(1.035);
  }
}
@keyframes cv-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -100% 0;
  }
}
@keyframes cv-sync-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@keyframes cv-breathe {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

/* 18s, and 0.055 -> 0.085. Slow and shallow enough that it reads as the room
   the dashboard is in rather than as something asking to be looked at --
   cv-breathe next door is 6s and swings 0.6 -> 1. */
@keyframes cv-ambient-drift {
  0%,
  100% {
    opacity: 0.055;
    transform: scale(1);
  }
  50% {
    opacity: 0.085;
    transform: scale(1.035);
  }
}
/* The 100% frames below are the resting declarations on .cv-ambient-mark and
   .cv-ambient-halo, restated. Keep them in step. */
@keyframes cv-ambient-arrive {
  0% {
    opacity: 0;
    transform: scale(0.84);
  }
  34% {
    opacity: 0.2;
    transform: scale(1.06);
  }
  100% {
    opacity: 0.055;
    transform: scale(1);
  }
}
@keyframes cv-ambient-arrive-halo {
  0% {
    opacity: 0;
    transform: scale(0.72);
  }
  34% {
    opacity: 1;
    transform: scale(1.22);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cv-reveal,
  .cv-nav-item.revealed,
  .cv-nav-new,
  /* The load screen's rings. The mark inside them needs nothing here: its own
     `is-working` and `is-unlocking` rules are already handled in styles.css,
     which lands them on their resting states rather than freezing them
     mid-travel. */
  .cv-boot-ring.mid,
  .cv-boot-ring.outer,
  .cv-status-card,
  .cv-appsync,
  .cv-focal-glow,
  .cv-appskel,
  /* Both halves of the ambient vault. Killing the animation leaves each at
     the resting opacity/transform declared on its own rule, so the vault is
     still there -- just still. The JS half never sets `arriving` under this
     preference either (startVaultArrival), so this is the second of two
     independent guards, not the only one. */
  .cv-ambient-mark,
  .cv-ambient-halo,
  .cv-devices-waiting .cv-dot {
    animation: none;
  }
  .cv-appskel {
    background: rgba(255, 255, 255, 0.08);
  }
  /* Belt and braces, exactly as brand-mark's own reduced-motion rule does it:
     openBoot never sets the phase that applies this class under the
     preference, but if it somehow did, land on the destination rather than
     freezing an opaque veil over the page forever. */
  .cv-boot.opening {
    animation: none;
    opacity: 0;
  }
  /* Neutralize decorative hover motion too — keep state changes, drop the travel */
  .cv-btn,
  .cv-nav-item,
  .cv-card,
  .cv-preview {
    transition: none;
  }
  /* Same intent, one selector out on its own: the copy button is inside
     ConnectTerminal, so a flat .cv-cmd-copy in the list above reaches it no
     more here than it does anywhere else in this block. */
  .cv-connect-terminal :deep(.cv-cmd-copy) {
    transition: none;
  }
  .cv-btn:hover:not(:disabled),
  .cv-btn:active:not(:disabled) {
    transform: none;
  }
}

/* responsive */
@media (max-width: 960px) {
  .cv-shell {
    grid-template-columns: 1fr;
  }
  /* The veil covers the whole shell, and once the sidebar stacks, the shell is
     far taller than the screen -- so centring in it put the vault most of a
     viewport below the fold, leaving the load screen looking like an empty
     page. Seen at 375px. Anchored near the top instead, where the composition
     is the first thing on screen; desktop keeps the centring, which is right
     there because the shell and the viewport are about the same height. */
  .cv-boot {
    align-content: start;
    padding-top: 88px;
  }
  .cv-side {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .cv-brand {
    border-bottom: 0;
    padding: 0 8px 0 4px;
    margin: 0;
  }
  .cv-nav {
    flex-direction: row;
    flex-wrap: wrap;
    flex: 1;
  }
  .cv-nav-item {
    width: auto;
  }
  .cv-nav-label {
    flex: none;
  }
  .cv-preview {
    grid-template-columns: 1fr;
  }
  .cv-appframe {
    order: 2;
  }
}
/* The 960px rule turns the sidebar into a horizontal strip. At phone widths
   that strip has to wrap, and `flex: 1` on the nav pushed the items to the
   right of the brand, leaving the vault name stranded on its own line. Stack
   the three regions instead so everything stays left-aligned. */
@media (max-width: 640px) {
  .cv-side {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding-bottom: 12px;
  }
  .cv-brand {
    padding: 0 0 10px;
    border-bottom: 1px solid var(--line);
  }
  .cv-nav {
    flex: none;
    gap: 6px;
  }
}

@media (max-width: 560px) {
  .cv-content {
    padding: 20px 18px 32px;
  }
  .cv-focal {
    padding: 20px;
  }
  .cv-topbar {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
