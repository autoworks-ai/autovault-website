import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  consumeVaultArrival,
  isAuthenticatedCloudState,
  resetVaultArrivalLedger,
  vaultArrivalOccasion,
} from "../.vitepress/theme/utils/vaultArrival";

/**
 * "Ambient always, celebrate once."
 *
 * The trigger policy lives in utils/vaultArrival.ts precisely so that this
 * half can be tested by RUNNING it rather than by grepping for it. Everything
 * in this repo's suite is a source match (vitest.config.ts is
 * `environment: "node"` with no @vue/test-utils), and a source match cannot
 * tell "celebrates once" from "celebrates on every reload" — the two differ
 * only in behaviour. The describe blocks below are split on that line: real
 * assertions first, source assertions second, and the second group is honest
 * about being structural.
 */
const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
  "utf-8"
);

/** A sessionStorage stand-in. `broken` throws the way Safari private mode does. */
function fakeStorage(broken = false): Storage {
  const map = new Map<string, string>();
  const boom = () => {
    throw new DOMException("denied");
  };
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (broken ? boom() : map.get(key) ?? null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => {
      if (broken) boom();
      map.set(key, value);
    },
  } as Storage;
}

/** CloudPage's `<style scoped>` block. */
function styleBlock(): string {
  const at = cloudPage.indexOf("<style scoped>");
  expect(at, "CloudPage has no scoped style block").toBeGreaterThan(-1);
  return cloudPage.slice(at, cloudPage.indexOf("</style>", at));
}

/** The body of one rule, given its exact selector text. */
function ruleBody(selector: string): string {
  const css = styleBlock();
  const at = css.indexOf(`${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

/** `opacity` and `transform` out of a rule body or a keyframe frame. */
function restingValues(text: string): { opacity: string; transform: string } {
  const opacity = /opacity:\s*([^;]+);/.exec(text);
  const transform = /transform:\s*([^;]+);/.exec(text);
  expect(opacity?.[1], `no opacity in ${text.slice(0, 40)}`).toBeTruthy();
  expect(transform?.[1], `no transform in ${text.slice(0, 40)}`).toBeTruthy();
  return { opacity: opacity![1].trim(), transform: transform![1].trim() };
}

/** One `@keyframes` block, by name. */
function keyframes(name: string): string {
  const css = styleBlock();
  const at = css.indexOf(`@keyframes ${name} {`);
  expect(at, `no @keyframes ${name}`).toBeGreaterThan(-1);
  // Frames are one nesting level deep, so the block ends at the first `\n}`
  // that sits in column 0.
  const end = css.indexOf("\n}", at);
  expect(end).toBeGreaterThan(at);
  return css.slice(at, end);
}

/** The `<script setup>` body of one named function. */
function fnBody(name: string): string {
  const at = cloudPage.indexOf(`function ${name}(`);
  expect(at, `no function ${name}`).toBeGreaterThan(-1);
  const end = cloudPage.indexOf("\n}", at);
  expect(end).toBeGreaterThan(at);
  return cloudPage.slice(at, end);
}

describe("the arrival fires once per occasion", () => {
  beforeEach(() => resetVaultArrivalLedger());

  it("celebrates the first signed-in load of a browsing session", () => {
    const storage = fakeStorage();
    expect(consumeVaultArrival("", storage)).toBe(true);
  });

  it("does not celebrate again on a reload, or on a return navigation", () => {
    const storage = fakeStorage();
    expect(consumeVaultArrival("", storage)).toBe(true);
    // Same document (SPA navigation back to /cloud).
    expect(consumeVaultArrival("", storage)).toBe(false);
    // New document, same tab (a reload) — the in-memory ledger is gone and
    // only the storage entry stands between this and a second celebration.
    resetVaultArrivalLedger();
    expect(consumeVaultArrival("", storage)).toBe(false);
  });

  it("still celebrates the checkout return after the session arrival is spent", () => {
    // The order that actually happens: land on /cloud, buy, come back. A
    // single flag would have been spent by the first of those, swallowing the
    // one moment the ask named first.
    const storage = fakeStorage();
    expect(consumeVaultArrival("", storage)).toBe(true);
    expect(consumeVaultArrival("?hosted=success&session_id=cs_test_1", storage)).toBe(true);
  });

  it("does not re-celebrate when the checkout params survive a reload", () => {
    const storage = fakeStorage();
    expect(consumeVaultArrival("?hosted=success&session_id=cs_test_1", storage)).toBe(true);
    resetVaultArrivalLedger();
    expect(consumeVaultArrival("?hosted=success&session_id=cs_test_1", storage)).toBe(false);
  });

  it("does not re-celebrate on a plain reload after a checkout arrival", () => {
    // The bug in the obvious one-key design: store "checkout", then a reload
    // whose occasion is "session" compares unequal and fires again. Each
    // occasion gets its own key for exactly this reason. HostedVaultFunnel
    // strips ?hosted=success with replaceState, so this reload is the normal
    // next event, not an edge case.
    const storage = fakeStorage();
    expect(consumeVaultArrival("?hosted=success", storage)).toBe(true);
    resetVaultArrivalLedger();
    expect(consumeVaultArrival("", storage)).toBe(false);
  });

  it("reads the occasion off the query string", () => {
    expect(vaultArrivalOccasion("?hosted=success")).toBe("checkout");
    expect(vaultArrivalOccasion("hosted=success")).toBe("checkout");
    expect(vaultArrivalOccasion("?session_id=cs_1&hosted=success")).toBe("checkout");
    // The cancel URL is a return too, and it is not a celebration.
    expect(vaultArrivalOccasion("?hosted=cancelled")).toBe("session");
    expect(vaultArrivalOccasion("")).toBe("session");
    expect(vaultArrivalOccasion("?admit=abc123")).toBe("session");
  });

  it("still dedupes within a document when there is no storage at all", () => {
    expect(consumeVaultArrival("", null)).toBe(true);
    expect(consumeVaultArrival("", null)).toBe(false);
  });

  it("survives storage that throws, rather than taking the page down", () => {
    const storage = fakeStorage(true);
    expect(() => consumeVaultArrival("", storage)).not.toThrow();
    resetVaultArrivalLedger();
    expect(consumeVaultArrival("", storage)).toBe(true);
    expect(consumeVaultArrival("", storage)).toBe(false);
  });

  it("relates the two occasions one way, not symmetrically", () => {
    // Any arrival spends `session`, because it WAS this session's arrival.
    // Only a checkout return spends `checkout`. That asymmetry is the whole
    // design: it lets the Stripe return escape a spent session flag, without
    // letting a first-load-is-the-return tab celebrate twice.
    const afterCheckout = fakeStorage();
    expect(consumeVaultArrival("?hosted=success", afterCheckout)).toBe(true);
    expect(consumeVaultArrival("", afterCheckout)).toBe(false);

    resetVaultArrivalLedger();
    const afterSession = fakeStorage();
    expect(consumeVaultArrival("", afterSession)).toBe(true);
    expect(consumeVaultArrival("?hosted=success", afterSession)).toBe(true);
  });
});

describe("the arrival waits for the authenticated answer, not the Clerk flag", () => {
  // The race this closes: /cloud loads /api/me twice. The first goes out
  // anonymous and its `finally` sets `hydrated` even when the response is
  // discarded as stale, because it passes `initial`. Clerk resolves in
  // between, which flips `signedIn` through its live-flag OR. So `hydrated &&
  // signedIn` is true a whole request before the authenticated payload lands,
  // and gating the one-shot arrival on it spends the occasion on the empty
  // state -- a returning owner watches a LOCKED mark swell and never gets the
  // real one, because there is only ever one.
  //
  // These run the predicate rather than grepping for it, which is the reason
  // it lives in the util module at all.

  it("does not treat the anonymous answer as authenticated", () => {
    // /api/me answers a request it could not authenticate with 200 and nulls,
    // so "the response came back" is not the same question as "we know who
    // this is".
    expect(isAuthenticatedCloudState({ user: null, subscription: null, vault: null }))
      .toBe(false);
  });

  it("treats a user as proof", () => {
    expect(isAuthenticatedCloudState({ user: { id: "clerk_1" }, vault: null }))
      .toBe(true);
  });

  it("treats a vault as proof too, which is what saves the checkout return", () => {
    // HostedVaultFunnel emits `{ ...(current ?? { user: null }), vault }` after
    // it provisions, so the occasion the ask named FIRST can arrive carrying a
    // real vault and a null user. A `user`-only gate would silently drop the
    // post-checkout celebration -- trading this bug for a worse one.
    expect(isAuthenticatedCloudState({ user: null, vault: { id: "v_1" } })).toBe(true);
  });

  it("answers nothing with false rather than throwing", () => {
    expect(isAuthenticatedCloudState(null)).toBe(false);
    expect(isAuthenticatedCloudState(undefined)).toBe(false);
    expect(isAuthenticatedCloudState({})).toBe(false);
  });
});

describe("the arrival cannot disturb the first-machine celebration", () => {
  // The load trigger and the admit trigger are separate refs on separate
  // timers on purpose. These are structural assertions — they pin the shape
  // that makes the runtime behaviour possible, not the behaviour itself.

  it("never routes the load trigger through the admit celebration", () => {
    // vaultMotion.test.ts pins the call-site count; this states the reason
    // from the other side. A second caller would put `vaultUnlocking` and
    // `vaultUnlockTimer` under two owners.
    expect(fnBody("startVaultArrival")).not.toContain("celebrateUnlock");
    expect(cloudPage).toContain("const vaultArriving = ref(false);");
    expect(cloudPage).toContain("let vaultArrivalTimer:");
    // Distinct timers, so neither can clear the other's.
    expect(fnBody("cancelVaultArrival")).toContain("clearTimeout(vaultArrivalTimer)");
    expect(fnBody("cancelVaultArrival")).not.toContain("vaultUnlockTimer");
  });

  it("states precedence in both directions", () => {
    // Event beats load: an admit lands mid-arrival and the arrival is dropped.
    expect(fnBody("celebrateUnlock")).toContain("cancelVaultArrival();");
    // And load does not start on top of an event already running.
    expect(fnBody("startVaultArrival")).toContain("if (vaultUnlocking.value) return;");
  });

  it("cannot strand either transient flag", () => {
    // Both gestures clear on unmount. The arrival additionally clears its own
    // pending timer before starting a new one, so a re-entry cannot leave a
    // stale timeout that flips the flag off under a later run.
    expect(cloudPage).toContain("onBeforeUnmount(cancelVaultArrival);");
    expect(fnBody("cancelVaultArrival")).toContain("vaultArriving.value = false;");
    const start = fnBody("startVaultArrival");
    expect(start.indexOf("if (vaultArrivalTimer) clearTimeout(vaultArrivalTimer);"))
      .toBeLessThan(start.indexOf("vaultArriving.value = true;"));
  });

  it("fires from the load, not from a state transition", () => {
    // Same hazard vaultMotion.test.ts guards for the admit celebration: this
    // page loads /api/me twice, and any "previous was non-null" watcher on the
    // stage celebrates on every reload for every returning customer.
    // `vaultArrivalReady` is monotonic per mount — it goes false -> true once,
    // in the tick whichever of its two conditions lands last: the boot veil
    // lifting, or the authenticated payload arriving. Usually that is the
    // veil, because the payload is what settles the stage; on the bounded-wait
    // path it is the payload, which is the case the auth gate is there for.
    // The one-shot ledger covers the remount case.
    expect(cloudPage).toContain("watch(vaultArrivalReady, (ready) => {");
    expect(cloudPage).not.toContain("watch(vaultOpen");
    expect(cloudPage).not.toContain("watch(() => vaultOpen");
    // Presence is still the plain gate; only the trigger waits for more.
    //
    // The gate is the moment the veil ACTUALLY lifts, and that moved twice.
    // `hydrated` now means only that some /api/me response arrived, and the
    // first one is anonymous and lands while the veil is still up. `settled`
    // means the data is in, which is when the boot vault STARTS its unlock.
    // Keyed to either, consumeVaultArrival would spend the once-per-session
    // occasion behind the veil or underneath the foreground gesture.
    expect(cloudPage).toContain(
      "const ambientVault = computed(() => revealed.value && signedIn.value);"
    );
    expect(cloudPage).toContain('const settled = computed(() => stage.value !== "loading");');
    expect(cloudPage).toContain(
      'const revealed = computed(() => settled.value && bootPhase.value === "open");'
    );
    expect(cloudPage).toContain('<div v-if="!revealed" class="cv-boot"');
    // And the trigger is NOT that gate on its own. This is the assertion that
    // fails if someone reverts the arrival to the Clerk flag plus `hydrated`:
    // the predicate above proves the rule, this proves the page still asks it.
    //
    // Both gates survive the merge of #113 and #114 on purpose, and this pair
    // is what stops the plausible-sounding collapse. `revealed` is a stronger
    // claim than the `hydrated` #113 was written against, but not a strictly
    // sufficient one: cloudStateIsKnown short-circuits true on `hydrated &&
    // patienceExpired` without auth settling (cloudLoadState.test.ts runs that
    // rule), so `revealed` can be reached against an anonymous payload and
    // only cloudStateAuthenticated still says no.
    expect(cloudPage).not.toContain("watch(ambientVault");
    expect(cloudPage).toContain(
      "const cloudStateAuthenticated = computed(() =>\n  isAuthenticatedCloudState(cloudState.value),\n);"
    );
    expect(cloudPage).toContain(
      "const vaultArrivalReady = computed(\n  () => ambientVault.value && cloudStateAuthenticated.value,\n);"
    );
  });

  it("consumes the occasion rather than peeking at it", () => {
    // A read-only check plus a separate write is two steps a remount can
    // interleave. One call decides and records.
    expect(fnBody("startVaultArrival")).toContain(
      "if (!consumeVaultArrival(arrivalSearch.value)) return;"
    );
  });

  it("captures the query string at mount, before the funnel rewrites it", () => {
    // HostedVaultFunnel calls history.replaceState to strip ?hosted=success
    // once provisioning settles. The arrival runs after /api/me resolves,
    // which can be later than that, so reading window.location.search at
    // trigger time would miss the checkout occasion entirely.
    const at = cloudPage.indexOf("onMounted(() => {");
    const mount = cloudPage.slice(at, cloudPage.indexOf("\n});", at));
    expect(mount).toContain("arrivalSearch.value = window.location.search;");
    expect(fnBody("startVaultArrival")).not.toContain("window.location");
  });
});

describe("what makes the load-triggered arrival safe: opening needs an admitted machine", () => {
  // Codex raised, twice and correctly on mechanism, that the one-shot arrival
  // can be consumed on a `?hosted=success` return before the vault row exists.
  // The reason that is not a defect is the coupling pinned here: `vaultOpen`
  // needs an ADMITTED MACHINE, not merely a vault.
  //
  // Scope that precisely, because "every checkout return is locked" would be
  // false. The finding is about the `{ user, vault: null }` window, and only a
  // FIRST vault is ever in it -- an owner provisioning their first vault has
  // no admitted device, so the mark renders `locked` with no dial both before
  // provisioning (stage `setup`) and after it (stage `connect`). Waiting for
  // the vault would relocate that same locked swell without changing a pixel.
  //
  // A RESUBSCRIBING owner is the case that is not locked: `getCurrentVault`
  // still returns the vault they already had, so with an admitted device they
  // land on `explore`/`ready` and the dial does fire. The finding does not
  // reach them either, for a different reason -- /api/me answers with `user`
  // and `vault` in one payload (functions/api/me.js), so `{ user, vault: null }`
  // never arises for someone who already has a vault.
  //
  // Declining the vault-triggered change is what keeps the trigger
  // load-driven -- and the load-driven trigger is what stops this page's TWO
  // /api/me loads from celebrating on every reload for every returning
  // customer, which is the hazard "fires from the load, not from a state
  // transition" exists to guard.
  //
  // So these pin the COUPLING, not the conclusion. If the locked-swell
  // decision is ever revisited, the moot-ness stops holding and this is what
  // notices first.

  /** The body of the `stage` computed. */
  const stageBody = (() => {
    const at = cloudPage.indexOf("const stage = computed<Stage>(() => {");
    expect(at, "no stage computed").toBeGreaterThan(-1);
    return cloudPage.slice(at, cloudPage.indexOf("\n});", at));
  })();

  it("cannot open the vault without an admitted machine", () => {
    expect(cloudPage).toContain(
      'const vaultOpen = computed(() => stage.value === "ready");'
    );
    // A vault on its own is `connect`. `ready` is on the far side of an
    // admit, so a fresh checkout return cannot reach it.
    expect(stageBody).toContain('if (!cliLinked.value) return "connect";');
    expect(cloudPage).toContain(
      "const cliLinked = computed(() => activeDevices.value.length > 0);"
    );
  });

  it("has no vault to open before a first provisioning either", () => {
    // The other half of the first-vault window: with no vault row the stage
    // machine falls through to these three, none of which is explore or ready.
    expect(stageBody).toContain('if (!signedIn.value) return "account";');
    expect(stageBody).toContain('if (!paid.value) return "subscription";');
    expect(stageBody).toContain('return "setup";');
  });
});

describe("reduced motion gets a vault, just not a moving one", () => {
  it("never sets the transient class", () => {
    const start = fnBody("startVaultArrival");
    expect(start.indexOf("if (prefersReducedMotion()) return;")).toBeGreaterThan(-1);
    // Before the flag is set, not merely present in the function.
    expect(start.indexOf("if (prefersReducedMotion()) return;"))
      .toBeLessThan(start.indexOf("vaultArriving.value = true;"));
  });

  it("stops the idle drift in CSS as well", () => {
    // Two independent guards: the JS one above stops the arrival, this one
    // stops the loop that runs without any JS trigger at all.
    const css = styleBlock();
    const at = css.indexOf("@media (prefers-reduced-motion: reduce) {");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at);
    const list = block.slice(0, block.indexOf("animation: none;"));
    expect(list).toContain(".cv-ambient-mark,");
    expect(list).toContain(".cv-ambient-halo,");
  });

  it("leaves both layers at a resting state that exists outside the keyframes", () => {
    // `animation: none` reveals whatever the rule itself declares. If the
    // resting opacity only existed in a 0% frame, a reduced-motion visitor
    // would get the UA default — a fully opaque vault, or none at all. Same
    // hazard styles.css documents for brand-mark-unlock's `forwards`.
    const mark = restingValues(ruleBody(".cv-ambient-mark"));
    expect(mark.opacity).toBe("0.055");
    expect(mark.transform).toBe("scale(1)");
    const halo = restingValues(ruleBody(".cv-ambient-halo"));
    expect(halo.opacity).toBe("1");
    expect(halo.transform).toBe("scale(1)");
  });

  it("adds nothing to the prerendered HTML, so there is nothing to mismatch", () => {
    // `hydrated` is false at setup on the server AND on the client's first
    // render, which makes stage "loading" and therefore `settled` false on
    // both, so this element is in neither. No media query is read at setup
    // scope, which is the PR #88 hydration class.
    expect(cloudPage).toContain('v-if="ambientVault"');
    expect(cloudPage).toContain("const hydrated = ref(false);");
    // The chain that carries that from `hydrated` to `settled`: nothing in
    // cloudStateKnown can be true before a response lands. The rule itself is
    // executed in cloudLoadState.test.ts.
    expect(cloudPage).toContain("hydrated: hydrated.value,");
  });
});

describe("the ambient settles onto its resting state instead of snapping", () => {
  it("ends the mark's arrival exactly where the mark rests", () => {
    const rest = restingValues(ruleBody(".cv-ambient-mark"));
    const kf = keyframes("cv-ambient-arrive");
    const last = kf.slice(kf.indexOf("100% {"));
    expect(restingValues(last)).toEqual(rest);
  });

  it("ends the halo's arrival exactly where the halo rests", () => {
    const rest = restingValues(ruleBody(".cv-ambient-halo"));
    const kf = keyframes("cv-ambient-arrive-halo");
    const last = kf.slice(kf.indexOf("100% {"));
    expect(restingValues(last)).toEqual(rest);
  });

  it("starts and ends the idle drift on that same resting state", () => {
    // The arrival replaces this animation while it runs; when the class drops,
    // the drift restarts from 0%. If 0% disagreed with the rest, every loop
    // would begin with a jump.
    const rest = restingValues(ruleBody(".cv-ambient-mark"));
    const kf = keyframes("cv-ambient-drift");
    const first = kf.slice(kf.indexOf("0%,"));
    expect(restingValues(first)).toEqual(rest);
  });
});

describe("the ambient is background, not another glow", () => {
  it("is behind the content and inert", () => {
    const wrapper = ruleBody(".cv-ambient");
    expect(wrapper).toContain("z-index: -1");
    expect(wrapper).toContain("pointer-events: none");
    expect(wrapper).toContain("overflow: hidden");
    expect(cloudPage).toContain('class="cv-ambient"');
    expect(
      cloudPage.slice(cloudPage.indexOf('class="cv-ambient"'), cloudPage.indexOf('class="cv-ambient-halo"'))
    ).toContain('aria-hidden="true"');
  });

  it("has the stacking context that makes z-index -1 mean 'behind the content'", () => {
    // `position: relative` alone does not create one, and without it the layer
    // escapes to an ancestor context and lands behind .cv-shell's opaque
    // background — present in the DOM, matched by its rules, and invisible.
    const content = ruleBody(".cv-content");
    expect(content).toContain("position: relative");
    expect(content).toContain("z-index: 0");
  });

  it("is an order of magnitude quieter and three times slower than the focal glow", () => {
    const glow = ruleBody(".cv-focal-glow");
    expect(glow).toContain("cv-breathe 6s");
    expect(ruleBody(".cv-ambient-mark")).toContain("cv-ambient-drift 18s");
    // The glow peaks at 0.16 alpha; the ambient mark's brightest idle frame is
    // 0.085 on a stroke, and its halo is 0.075.
    const drift = keyframes("cv-ambient-drift");
    expect(drift).toContain("opacity: 0.085");
    expect(ruleBody(".cv-ambient-halo")).toContain("rgba(90, 214, 192, 0.075)");
  });

  it("never claims the vault is open when it is not", () => {
    // brand-mark-unlock ends on the UNLOCKED resting state, so playing it over
    // a locked mark animates the dial away and then transitions it back — the
    // "opens and shuts again" defect the admit path already has a comment
    // about. At `connect` the arrival is the swell only.
    const markup = cloudPage.slice(
      cloudPage.indexOf('class="cv-ambient-mark"'),
      cloudPage.indexOf("</span>", cloudPage.indexOf('class="cv-ambient-mark"'))
    );
    expect(markup).toContain(":state=\"vaultOpen ? 'unlocked' : 'locked'\"");
    expect(markup).toContain(':unlocking="vaultArriving && vaultOpen"');
    // No `working`: a dial sweeping in the background on a routine device poll
    // is noise, and two marks on screen already report it.
    expect(markup).not.toContain(":working");
  });
});

describe("the machines card has a background again", () => {
  it("uses a token this repo actually declares", () => {
    const styles = readFileSync(
      new URL("../.vitepress/theme/styles.css", import.meta.url),
      "utf-8"
    );
    // The defect: var(--bg-1) is declared nowhere, so the card the connect
    // stage points at painted transparent.
    expect(styles).not.toContain("--bg-1:");
    expect(styleBlock()).not.toContain("var(--bg-1)");
    expect(styles).toContain("--panel:");
    expect(ruleBody(".cv-devices.standalone")).toContain("background: var(--panel)");
  });

  it("keeps the rows readable as rows", () => {
    // .cv-device sits on the darker --bg-2, so it reads as inset in the card
    // rather than as the card itself.
    expect(ruleBody(".cv-device")).toContain("background: var(--bg-2)");
  });
});
