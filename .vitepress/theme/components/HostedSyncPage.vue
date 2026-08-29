<template>
  <div class="docs-rich docs-final">
    <section class="docs-hero au-hero au-final-hero">
      <AvDocBreadcrumb section="Reference" page="Hosted sync" />
      <div class="eyebrow"><span class="dash" /> Hosted sync · 8 min read</div>
      <h1>One vault.<br><span class="ital">Every machine you admit.</span></h1>
      <p class="lede">A hosted vault serves a signed catalog over HTTPS. You pair each machine with a short code, admit it from the browser, and from then on it pulls skills and verifies every release against a key it pinned when it enrolled. Signing stays on your machine. Cloud never holds a signing key.</p>
      <div class="pillrow">
        <span class="pill">autovault link</span>
        <span class="pill">pairing code</span>
        <span class="pill">admit</span>
        <span class="pill">Ed25519</span>
        <span class="pill">revoke</span>
      </div>
      <!-- Says a trial exists, never how long. The length is a build-time
           constant and eligibility is decided per account at checkout, so a
           static page can be stale about the first and is blind to the second.
           /cloud reads both at runtime and is one click away. -->
      <div class="hs-cta">
        <a class="hs-btn" :href="clerkBrand.cloudPath">
          {{ HOSTED_TRIAL_DAYS > 0 ? "Start a free trial" : "See pricing" }}
        </a>
        <span class="hs-cta-fine">
          <template v-if="HOSTED_TRIAL_DAYS > 0">First-time accounts, no card up front. </template>Or
          <a href="#self-hosting">host the catalog yourself</a>, which costs nothing
          and speaks the same protocol.
        </span>
      </div>
    </section>

    <h2 id="pair">Pair a machine</h2>
    <p>Run this on the machine you want to sync. No argument: the slug is something the machine learns, not something you type.</p>
    <CodeBlock lang="bash"><span class="pmt">$</span> autovault link</CodeBlock>
    <div class="process-ribbon hs-ribbon">
      <div class="step">
        <div class="num mono-label">01</div>
        <div class="step-title">The CLI mints a key</div>
        <div class="muted step-sub">An Ed25519 keypair, then a pairing code from Cloud. Codes look like <code>BKDF-QMTW</code>: eight characters from a 20-letter alphabet with no vowels, so a code can never spell a word.</div>
      </div>
      <div class="step">
        <div class="num mono-label">02</div>
        <div class="step-title">You confirm the code</div>
        <div class="muted step-sub">Your browser opens at <code>/cloud/pair</code>. Check the fingerprint on screen against the one in your terminal, then confirm. Confirming <em>is</em> the admission here: the machine comes back active, with no second step on the dashboard.</div>
      </div>
      <div class="step">
        <div class="num mono-label">03</div>
        <div class="step-title">The CLI picks it up</div>
        <div class="muted step-sub">It polls every 5 seconds while it waits, then prints the namespace it is now linked to.</div>
      </div>
    </div>
    <div class="callout security-note">
      <span class="icn" aria-hidden="true"><UiIcon name="tip" /></span>
      <div>
        <strong>The code expires in 15 minutes.</strong> Run <code>autovault link</code> again to mint a new one. A single key may hold 5 live pairings at once, which is a guard against runaway retries rather than a rate limit.
      </div>
    </div>

    <h2 id="admit">Admit and revoke</h2>
    <p>Every machine is listed under <strong>Machines</strong> on your cloud dashboard, identified by fingerprint. A fingerprint is the first four and last four characters of the machine's public key. The console never renders a full key.</p>
    <div class="kv hs-kv">
      <span class="k">Admit</span><span class="v">Moves a machine from <code>pending</code> to <code>active</code>. This is for a machine enrolled with <code>autovault link &lt;slug&gt;</code>, which lands pending. Confirming a pairing code already admitted that machine.</span>
      <span class="k">Revoke</span><span class="v">Moves it to <code>revoked</code>, effective on that machine's next request. This needs no active subscription, so a lapsed account can still remove a machine it no longer controls.</span>
      <span class="k">Deny</span><span class="v">Refuses a waiting pairing code. It writes a tombstone rather than deleting the record, so the CLI is told it was refused instead of timing out against a 404.</span>
    </div>
    <p class="muted">Re-admitting a revoked key is deliberately not possible from the console. Pair that machine again from the machine itself.</p>

    <h2 id="what-a-device-reads">What a machine may read</h2>
    <p>Access is scoped by enrollment status, and the catalog and the bundles are gated differently.</p>
    <div class="access-table" aria-label="What each enrollment status may read">
      <div class="access-row head">
        <span>Status</span>
        <span>May read</span>
        <span>May not read</span>
      </div>
      <div class="access-row">
        <span class="agent"><code>pending</code></span>
        <span class="via"><code>catalog.json</code>, its own device record</span>
        <span class="via">Bundles</span>
      </div>
      <div class="access-row">
        <span class="agent"><code>active</code></span>
        <span class="via"><code>catalog.json</code>, bundles, its own device record</span>
        <span class="via">Nothing withheld while the subscription is live</span>
      </div>
      <div class="access-row">
        <span class="agent"><code>revoked</code></span>
        <span class="via">Its own device record, so the CLI can report it and exit</span>
        <span class="via"><code>catalog.json</code>, bundles</span>
      </div>
    </div>
    <p>The catalog being readable at <code>pending</code> is deliberate rather than an oversight. <code>autovault link</code> reads it the moment it enrols, to pin <code>catalog.public_key</code> before you have admitted anything. Bundles are where skill content actually lives, so they need <code>active</code> status and a live subscription.</p>

    <h2 id="wire">How a request is signed</h2>
    <p>Every request under <code>/v/&lt;slug&gt;/</code> is signed. There are no bearer tokens and no cookies.</p>
    <CodeBlock lang="http">{{ SIGNED_HEADERS }}</CodeBlock>
    <p>The signed message is three lines: the HTTP method, the request path, and the timestamp.</p>
    <CodeBlock lang="text">{{ SIGNED_MESSAGE }}</CodeBlock>
    <p>Timestamps outside a 300 second window either side are rejected. That bounds replay rather than preventing it, and a seen-nonce store is deliberately out of scope for the beta.</p>
    <p class="muted">Enrollment is self-attested: the request that enrols a key is signed by that same key, and the body has to repeat it. Admitting is what grants access, not enrolling.</p>

    <h2 id="publishing">How content lands in your vault</h2>
    <p>This is the part most people assume works differently, so it is worth being blunt about.</p>
    <p><strong>There is no publish API, and the CLI has no publish command.</strong> AutoVault is a consumer of the catalog, not a producer of it. The key that signs a release lives on the owner's machine and never reaches Cloud, which is the property that makes a signature worth checking in the first place. Signed catalog and bundle objects are therefore placed in your namespace out of band while this is in private beta.</p>
    <div class="callout security-note">
      <span class="icn" aria-hidden="true"><UiIcon name="tip" /></span>
      <div>
        <strong>A newly reserved vault serves nothing.</strong> Its catalog returns <code>404</code> until the first release is published to it. Your machine will pair and be admitted normally, then report an empty catalog. That is the expected state, not a fault in your setup.
      </div>
    </div>

    <h2 id="limits">Limits worth knowing</h2>
    <p>All of these are current beta behaviour, and each one is a thing the product does rather than a thing it plans.</p>
    <div class="disc-grid">
      <div class="disc-card">
        <h3>Key rotation breaks enrolled machines</h3>
        <p>Each machine pins <code>catalog.public_key</code> when it enrols, so changing that key hard-fails every one of them. There is no rotation flow that avoids this.</p>
      </div>
      <div class="disc-card">
        <h3>Scope is machines, not people</h3>
        <p>There are no seats, roles, or invitations. Adding a colleague means admitting their machine to your vault.</p>
      </div>
      <div class="disc-card">
        <h3>One vault per account</h3>
        <p>Namespaces cannot be renamed, transferred, or deleted once reserved.</p>
      </div>
      <div class="disc-card">
        <h3>Skill drafts are stored, not read back</h3>
        <p>Drafts submitted from the dashboard are written down and go nowhere. There is no review queue behind them yet.</p>
      </div>
    </div>

    <h2 id="protocol">The protocol underneath</h2>
    <p>Hosted sync is one transport for something smaller and more boring: a signed catalog of releases, and a bundle per release. Cloud is a convenient place to put those files. It is not where their trustworthiness comes from.</p>
    <p>A catalog is one JSON document. Every release inside it carries its own detached signature, so the catalog is a manifest rather than an authority. Verification happens on your machine, against a key your machine pinned.</p>
    <CodeBlock lang="json">{{ CATALOG_SHAPE }}</CodeBlock>
    <p>Two fields do more work than the rest. <code>policy</code> decides what may happen without a human.</p>
    <div class="kv hs-kv">
      <span class="k">auto_apply</span><span class="v">Updates silently.</span>
      <span class="k">user_approve</span><span class="v">Waits for a person.</span>
      <span class="k">admin_hold</span><span class="v">Refuses until somebody with authority releases it.</span>
    </div>
    <p><code>capabilities</code> is the other one. It travels with the release, so what a skill is allowed to reach is part of the signed payload rather than a claim made after installation.</p>
    <div class="callout security-note">
      <span class="icn" aria-hidden="true"><UiIcon name="tip" /></span>
      <div>
        <strong>The domain prefix is the trust boundary.</strong> The signature covers the release object prefixed with <code>autovault-sync-release-v1</code>, so a signature minted for some other purpose cannot be replayed as a release. Changing that string invalidates every signature ever issued.
      </div>
    </div>
    <p><code>bundle_path</code> is inside the signature and the client re-derives it as <code>bundles/&lt;bundle_hash&gt;.json</code> relative to the catalog. Bundles cannot be renamed, moved, or redirected, and the bundle you receive is checked against both <code>bundle_hash</code> and the per-file <code>file_hashes</code> before a single byte reaches the vault.</p>

    <h2 id="upstreams">Upstreams</h2>
    <p>A vault holds a list of upstreams, and each one records where a catalog lives, the public key pinned for it, and this machine's own enrollment. <code>autovault link</code> is how one gets added.</p>
    <p>There are two kinds, and the difference is only transport.</p>
    <div class="disc-grid">
      <div class="disc-card">
        <h3><code>https</code></h3>
        <p>Points at a catalog URL. Requests are device-signed, which is what enrollment and admission exist for. AutoVault Cloud is one of these. So is any HTTPS host you run.</p>
      </div>
      <div class="disc-card">
        <h3><code>file</code></h3>
        <p>Points at a catalog path. A directory, a network mount, a checkout on disk. No server, no enrollment handshake to wait on, no account.</p>
      </div>
    </div>
    <p>Both go through the same verification. A <code>file</code> upstream is not the trusting option: the release signature is checked exactly as it is over HTTPS, because a shared drive is not a trust boundary either.</p>
    <CodeBlock lang="bash">{{ LINK_EXAMPLES }}</CodeBlock>
    <p>The argument decides the kind, and nothing else does.</p>
    <div class="kv hs-kv">
      <span class="k">https</span><span class="v">Anything that parses as a URL.</span>
      <span class="k">file</span><span class="v">A path separator anywhere, a leading <code>.</code>, <code>~</code> or <code>/</code>, or a <code>.json</code> ending.</span>
      <span class="k">slug</span><span class="v">A bare lowercase word, expanded against <code>autovault.dev</code>.</span>
    </div>
    <p class="muted">Slugs are lowercase. A capitalised one is rejected with the lowercase spelling rather than quietly downcased.</p>

    <h2 id="self-hosting">Self-hosting a catalog</h2>
    <p>A catalog is a static file tree. Anything that serves JSON over HTTPS can host one.</p>
    <CodeBlock lang="text">{{ CATALOG_TREE }}</CodeBlock>
    <p>Point a machine at it with <code>autovault link https://your-host/catalog.json</code>. Self-hosted catalogs carry no device enrollment, so there is no admit step and no console: access control is whatever your host already does, and the signature is what makes the content trustworthy either way.</p>
    <div class="callout security-note">
      <span class="icn" aria-hidden="true"><UiIcon name="tip" /></span>
      <div>
        <strong>Self-hosting does not solve the publishing gap. It relocates it.</strong> The CLI is a consumer of catalogs and has no command that produces one. <code>autovault link</code>, <code>add</code>, and <code>sync-profiles</code> all read; nothing signs a release. The signing primitives exist in the source and are reachable from the test helpers, not from a terminal.
        <p>So today, hosting your own catalog means generating and signing it yourself against the shape above. That is a real amount of work, and it is the honest answer rather than a link to a command that does not exist.</p>
      </div>
    </div>
    <p>Which makes the choice narrower than it looks. Cloud gives you enrollment, per-machine admission, and revocation, and publishing is hands-on. Self-hosting gives you the same verification with no account and no per-machine gate, and publishing is hands-on there too. Neither one has a publish button yet.</p>

    <h2 id="next">Where next</h2>
    <p>The <a href="/quick-start">quick start</a> covers the local CLI, which is where skills are validated and signed. <a href="/security">Security and provenance</a> covers the gate a skill passes through before it is ever signed, hosted or not.</p>
  </div>
</template>

<script setup lang="ts">
import AvDocBreadcrumb from "./AvDocBreadcrumb.vue";
import CodeBlock from "./CodeBlock.vue";
import UiIcon from "./UiIcon.vue";
import { clerkBrand } from "../clerk";
import { HOSTED_TRIAL_DAYS } from "../data/product";

// Bound rather than written inline. CodeBlock renders its slot inside a
// `white-space: pre` <pre>, so a multi-line block written in the template
// gets the source indentation and an extra newline per <br /> baked in.
const SIGNED_HEADERS = `X-AutoVault-Device      base64url Ed25519 public key
X-AutoVault-Timestamp   whole seconds since epoch
X-AutoVault-Signature   base64url Ed25519 detached signature`;

const CATALOG_SHAPE = `catalog.json
  schema_version  1
  id              vault identifier
  name            display name
  public_key      base64url Ed25519, pinned by each machine
  releases[]      one entry per publishable thing

releases[]
  kind            skill | agent | mcp_server | collection
  name            stable identifier
  version         semver, compared on every check
  channel         stable, beta, or your own
  publisher       who signed it
  policy          auto_apply | user_approve | admin_hold
  capabilities    network, filesystem, tools[]
  breaking        refuse a silent upgrade
  file_hashes[]   path plus sha256, per file
  bundle_hash     sha256 of the bundle
  bundle_path     bundles/<bundle_hash>.json
  signature       ed25519 over the release, domain-separated`;

const SIGNED_MESSAGE = `<METHOD>
<pathname>
<unix-seconds>`;

// Written with real newlines for the same reason SIGNED_HEADERS is. This block
// used to be three template lines joined by <br />, which renders as three
// lines and copies as one: CodeBlock's copy button reads textContent, and a
// <br /> leaves nothing behind in it. A pasted command that silently ran the
// three examples together is worse than an uncoloured one.
const LINK_EXAMPLES = `$ autovault link acme-skills                             # a Cloud slug
$ autovault link https://skills.acme.dev/catalog.json    # your own host
$ autovault link ./team-catalog                          # a directory`;

const CATALOG_TREE = `your-catalog/
  catalog.json
  bundles/
    3f1a...c92e.json
    a704...11bd.json`;
</script>

<style scoped>
/* The shared ribbon is built for five steps. This page has three, and without
   an override the third one stretches across two empty columns. Scoped styles
   outrank the shared 760px collapse rule on specificity, so the breakpoint has
   to be repeated here or the three columns survive onto a phone at 105px each. */
@media (min-width: 761px) {
  .hs-ribbon {
    grid-template-columns: repeat(3, 1fr);
  }
}
/* The shared kv reserves 110px for the key. These keys are enum values rather
   than short labels, so they need the room. */
.hs-kv {
  grid-template-columns: 130px 1fr;
  margin: 18px 0 22px;
  font-size: 12.5px;
}
.hs-kv .v {
  font-family: var(--sans, inherit);
  color: var(--ink-2);
}
.hs-cta {
  margin-top: 26px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.hs-btn {
  display: inline-block;
  padding: 10px 18px;
  border-radius: 8px;
  background: var(--accent);
  color: #062821;
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
}
.hs-btn:hover {
  filter: brightness(1.08);
}
.hs-cta-fine {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink-4);
  max-width: 34ch;
}
.hs-cta-fine a {
  color: var(--ink-3);
}
</style>
