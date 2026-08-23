import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cloudStateIsKnown,
  deviceListIsKnown,
  type CloudStateSignals,
  type DeviceListSignals,
} from "../.vitepress/theme/utils/cloudLoadState";

const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
  "utf-8"
);

/** The stage computed's body, which is what most of the guards below read. */
function stageBody() {
  const at = cloudPage.indexOf("const stage = computed<Stage>");
  expect(at, "no stage computed").toBeGreaterThan(-1);
  return cloudPage.slice(at, cloudPage.indexOf("\n});", at));
}

function fnBody(name: string) {
  const at = cloudPage.indexOf(`function ${name}(`);
  expect(at, `no function ${name}`).toBeGreaterThan(-1);
  return cloudPage.slice(at, cloudPage.indexOf("\n}", at));
}

const NOTHING_KNOWN: CloudStateSignals = {
  hydrated: false,
  loadedSignedIn: null,
  authSettled: false,
  clerkSignedIn: false,
  patienceExpired: false,
};

/* ---------------------------------------------------------------------------
 * The part that is actually executed.
 *
 * Every other test in this repo reads source text, which is why a set of dead
 * CSS rules once survived a green suite. These run the decision.
 * ------------------------------------------------------------------------ */
describe("an empty response is not an answer", () => {
  it("knows nothing before any response lands", () => {
    expect(cloudStateIsKnown(NOTHING_KNOWN)).toBe(false);
    // Including on the server and on the client's first render, where Clerk is
    // reported settled-and-signed-out and the refs are still empty. If this
    // returned true, the prerendered HTML would contain the signup funnel
    // unveiled and the client would immediately disagree with it.
    expect(
      cloudStateIsKnown({ ...NOTHING_KNOWN, authSettled: true })
    ).toBe(false);
  });

  it("does not trust the anonymous mount request on behalf of a signed-in owner", () => {
    // THE BUG, as a truth table row. /api/me fired before Clerk resolved, came
    // back with no user, and the page announced "create an account" to a paid,
    // provisioned customer. `hydrated` was true, the response was real, and it
    // still could not answer the question.
    expect(
      cloudStateIsKnown({
        hydrated: true,
        loadedSignedIn: false,
        authSettled: true,
        clerkSignedIn: true,
        patienceExpired: false,
      })
    ).toBe(false);
  });

  it("trusts the follow-up request sent under the same context Clerk reports", () => {
    expect(
      cloudStateIsKnown({
        hydrated: true,
        loadedSignedIn: true,
        authSettled: true,
        clerkSignedIn: true,
        patienceExpired: false,
      })
    ).toBe(true);
  });

  it("lets a genuinely signed-out visitor through without a second round trip", () => {
    // The other required property: /cloud is the public sign-up entry point.
    // An anonymous response plus Clerk saying "signed out" IS a matching
    // context, so this resolves on the first load rather than waiting for the
    // watcher to fire a duplicate request.
    expect(
      cloudStateIsKnown({
        hydrated: true,
        loadedSignedIn: false,
        authSettled: true,
        clerkSignedIn: false,
        patienceExpired: false,
      })
    ).toBe(true);
  });

  it("waits while Clerk is still deciding, even with a response in hand", () => {
    expect(
      cloudStateIsKnown({
        hydrated: true,
        loadedSignedIn: false,
        authSettled: false,
        clerkSignedIn: false,
        patienceExpired: false,
      })
    ).toBe(false);
  });

  it("goes back to unknown when the session is lost mid-page", () => {
    // A signed-in view held over a session that Clerk now reports as gone is
    // the same lie pointed the other way.
    expect(
      cloudStateIsKnown({
        hydrated: true,
        loadedSignedIn: true,
        authSettled: true,
        clerkSignedIn: false,
        patienceExpired: false,
      })
    ).toBe(false);
  });

  it("stops waiting when patience runs out, but never with an empty hand", () => {
    // The backstop. A blocked Clerk bundle never resolves isLoaded, and this
    // page is also where people sign up -- a veil that never lifts there is
    // worse than the flash. When it fires the page degrades to exactly its
    // pre-fix behaviour rather than to a spinner.
    expect(
      cloudStateIsKnown({
        hydrated: true,
        loadedSignedIn: false,
        authSettled: false,
        clerkSignedIn: true,
        patienceExpired: true,
      })
    ).toBe(true);
    // But patience alone is not evidence: with no response at all there is
    // still nothing to render from.
    expect(cloudStateIsKnown({ ...NOTHING_KNOWN, patienceExpired: true })).toBe(false);
  });
});

describe("the device list is the same conflation one level down", () => {
  const armed: DeviceListSignals = {
    gateArmed: true,
    listAnswered: false,
    patienceExpired: false,
  };

  it("holds a pre-existing vault until the list answers", () => {
    // `devices` starts empty, so cliLinked is false before the list says
    // anything, so an owner who linked months ago gets stage "connect" and
    // watches the typed terminal replay again.
    expect(deviceListIsKnown(armed)).toBe(false);
    expect(deviceListIsKnown({ ...armed, listAnswered: true })).toBe(true);
  });

  it("never holds a vault that was provisioned during this session", () => {
    // The checkout path. Provisioning flips `vault` from null to a row, which
    // resets the list flag -- without the gate the owner who has just paid
    // would be veiled waiting for a list whose answer is known to be empty.
    expect(deviceListIsKnown({ ...armed, gateArmed: false })).toBe(true);
  });

  it("gives up rather than veiling forever on a list that never succeeds", () => {
    expect(deviceListIsKnown({ ...armed, patienceExpired: true })).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * Source assertions for the wiring: that the page asks these questions in the
 * right order, and records the inputs honestly.
 * ------------------------------------------------------------------------ */
describe("the stage machine has a state for not knowing", () => {
  it("declares loading as a member without displacing error", () => {
    // cloudDashboardHonesty pins `type Stage = "error"`, so error stays first.
    expect(cloudPage).toContain('type Stage =\n  | "error"\n  | "loading"');
  });

  it("checks loading after error and before every claim about the account", () => {
    const body = stageBody();
    const error = body.indexOf('return "error"');
    const loading = body.indexOf('return "loading"');
    const account = body.indexOf('return "account"');
    // Error first: a load that failed outright has an answer, and it is not
    // "still loading". This is what stops the veil becoming permanent.
    expect(error).toBeGreaterThan(-1);
    expect(loading).toBeGreaterThan(error);
    // And before the three branches that read state which starts empty.
    expect(account).toBeGreaterThan(loading);
    expect(body.indexOf('return "subscription"')).toBeGreaterThan(loading);
    expect(body.indexOf('return "setup"')).toBeGreaterThan(loading);
    // Including the vault branch, which is the one a paid customer lands in.
    expect(body.indexOf("if (vault.value)")).toBeGreaterThan(loading);
  });

  it("holds connect behind the device list rather than behind an empty array", () => {
    const body = stageBody();
    const gate = body.indexOf("deviceListIsKnown({");
    expect(gate).toBeGreaterThan(-1);
    expect(body.indexOf('return "connect"')).toBeGreaterThan(gate);
  });

  it("keeps loading out of STAGE_ORDER so no panel treats it as progress", () => {
    const at = cloudPage.indexOf("const STAGE_ORDER: Stage[] =");
    const line = cloudPage.slice(at, cloudPage.indexOf("\n", at));
    expect(line).not.toContain('"loading"');
    expect(line).not.toContain('"error"');
  });
});

describe("the boot veil is what makes 'not for one frame' true", () => {
  it("is driven by the stage, not by a flag that only means a response arrived", () => {
    expect(cloudPage).toContain('const settled = computed(() => stage.value !== "loading");');
    expect(cloudPage).toContain('<div v-if="!revealed" class="cv-boot"');
    expect(cloudPage).toContain(':aria-busy="!revealed"');
    // `hydrated` must no longer gate anything the visitor can perceive: it now
    // means only that some response landed, and the first one is anonymous.
    expect(cloudPage).not.toContain('v-if="!hydrated"');
    expect(cloudPage).not.toContain(':aria-busy="!hydrated"');
    expect(cloudPage).not.toContain(':inert="!hydrated"');
  });

  it("covers the shell opaquely and takes it out of the focus tree", () => {
    // The pre-vault card, funnel and all, stays MOUNTED underneath while
    // loading -- keeping that component alive across provisioning is
    // load-bearing (see the v-show it renders under). So "never sees a
    // checkout CTA" rests on these two properties rather than on the element
    // being absent: an opaque overlay above it, and `inert`, which removes it
    // from the accessibility and focus trees as well as from pointer events.
    const at = cloudPage.indexOf(".cv-boot {");
    expect(at, "no .cv-boot rule").toBeGreaterThan(-1);
    const rule = cloudPage.slice(at, cloudPage.indexOf("}", at));
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("inset: 24px 0 0");
    expect(rule).toContain("z-index: 2");
    // A token, not a transparent or alpha value: the veil has to hide what is
    // behind it, not tint it.
    expect(rule).toMatch(/background: var\(--bg[^,)]*\);/);
    expect(cloudPage).toContain(':inert="!revealed"');
    expect(cloudPage).toContain("booting: !revealed");
  });

  it("does not let the rail or the heading name a step it has not established", () => {
    expect(cloudPage).toContain('stage.value === "error" || stage.value === "loading"');
    const at = cloudPage.indexOf("const pageTitle = computed");
    const body = cloudPage.slice(at, cloudPage.indexOf("});", at));
    const loading = body.indexOf('if (stage.value === "loading")');
    expect(loading).toBeGreaterThan(-1);
    // Ahead of the pre-vault branch, which is true while loading for exactly
    // the reason this whole change exists.
    expect(body.indexOf("if (!vault.value)")).toBeGreaterThan(loading);
  });
});

describe("the auth context is recorded honestly", () => {
  it("captures it before the request, not after it", () => {
    // Clerk can resolve while the fetch is in flight. Reading it back at
    // completion time would relabel the anonymous mount request as an
    // authenticated one and re-open the hole.
    const body = fnBody("loadCloudState");
    const capture = body.indexOf("const requestSignedIn = isClerkSignedIn.value;");
    expect(capture).toBeGreaterThan(-1);
    expect(body.indexOf("await authHeaders(")).toBeGreaterThan(capture);
  });

  it("does not let the superseded mount request pull the veil back down", () => {
    // `hydrated` is deliberately set under `|| initial` so a slow first
    // request still un-veils. The context must NOT be: if the anonymous mount
    // request lands after the authenticated follow-up, recording its context
    // would flip cloudStateKnown false again over a page already correct.
    const body = fnBody("loadCloudState");
    expect(body).toContain(
      "if (requestSeq === cloudStateRequestSeq) loadedSignedIn.value = requestSignedIn;"
    );
    expect(body).not.toContain(
      "if (requestSeq === cloudStateRequestSeq || initial) loadedSignedIn.value"
    );
  });

  it("resolves the wait even when /api/me fails outright", () => {
    // In the finally, so a network failure -- which leaves loadError null and
    // the state empty -- still reaches a rendered stage instead of spinning.
    const body = fnBody("loadCloudState");
    expect(body.indexOf("loadedSignedIn.value = requestSignedIn;")).toBeGreaterThan(
      body.indexOf("} finally {")
    );
  });

  it("lets a provisioning payload settle the page on its own", () => {
    // syncCloudState bumps the request sequence, so the /api/me this page has
    // in flight bails out. Without recording the context here the page would
    // stay veiled behind a response that is never coming.
    expect(fnBody("syncCloudState")).toContain(
      "loadedSignedIn.value = isClerkSignedIn.value;"
    );
  });
});

describe("the device gate is latched and guarded", () => {
  it("is armed once, from whether a vault predates the first known state", () => {
    expect(cloudPage).toContain("watch(cloudStateKnown, (known) => {");
    expect(cloudPage).toContain("if (!known || devicesGateDecided) return;");
    expect(cloudPage).toContain("devicesGateArmed.value = Boolean(vault.value);");
  });

  it("marks the list known only for a response it parsed, inside the staleness guard", () => {
    // The two early returns above it -- a superseded request and a non-2xx --
    // have not answered the question. A transient 401 marked "known" drops a
    // linked owner onto the connect terminal, which is the symptom this exists
    // to prevent; the poll retries every four seconds instead.
    const body = fnBody("loadDevices");
    const known = body.indexOf("devicesKnown.value = true;");
    expect(known).toBeGreaterThan(-1);
    expect(known).toBeGreaterThan(body.indexOf("devices.value = payload.devices ?? [];"));
    expect(body.indexOf("if (!response.ok) return;")).toBeLessThan(known);
    // Not in the finally, where the guarded returns above would skip past it.
    const fin = body.indexOf("} finally {");
    expect(fin === -1 || known < fin).toBe(true);
  });

  it("forgets the list whenever the vault it described changes", () => {
    const at = cloudPage.indexOf("() => vault.value?.id ?? null,");
    const body = cloudPage.slice(at, cloudPage.indexOf("{ immediate: true }", at));
    expect(body).toContain("devicesKnown.value = false;");
    // Before the null branch returns, so dropping a vault clears it too.
    expect(body.indexOf("devicesKnown.value = false;")).toBeLessThan(
      body.indexOf("if (!vaultId) {")
    );
  });
});

describe("the wait is bounded", () => {
  it("arms a backstop on mount and clears it on unmount", () => {
    expect(cloudPage).toContain("const LOAD_PATIENCE_MS = 8000;");
    const mountAt = cloudPage.indexOf("onMounted(() => {");
    const mount = cloudPage.slice(mountAt, cloudPage.indexOf("\n});", mountAt));
    expect(mount).toContain("armLoadPatience();");
    expect(cloudPage).toContain("if (loadPatienceTimer) clearTimeout(loadPatienceTimer);");
    // A timer set at setup scope would run on the server too.
    const body = fnBody("armLoadPatience");
    expect(body).toContain("loadPatienceExpired.value = true;");
  });

  it("feeds both gates, so neither can hang the page alone", () => {
    const body = stageBody();
    expect(body).toContain("patienceExpired: loadPatienceExpired.value,");
    expect(cloudPage).toContain("patienceExpired: loadPatienceExpired.value,");
    const known = cloudPage.indexOf("const cloudStateKnown = computed(");
    const block = cloudPage.slice(known, cloudPage.indexOf("\n);", known));
    expect(block).toContain("patienceExpired: loadPatienceExpired.value,");
  });
});

describe("the load screen is the vault, not a new graphic", () => {
  it("reuses BrandMark's two documented transient props and authors no new mark motion", () => {
    // `working` is BrandMark's own loading graphic ("the dial sweeps"), and
    // `unlocking` is its one 700ms turn-and-retract. Its doc comment says to
    // apply that in the same tick the state flips -- all three bindings read
    // the same ref, so they cannot disagree and the keyframe lands exactly on
    // the `unlocked` resting state instead of snapping.
    const at = cloudPage.indexOf('<div v-if="!revealed" class="cv-boot"');
    expect(at, "no boot veil").toBeGreaterThan(-1);
    const veil = cloudPage.slice(at, cloudPage.indexOf("</div>\n    </div>", at));
    expect(veil).toContain(":state=\"bootOpening ? 'unlocked' : 'locked'\"");
    expect(veil).toContain(':working="!bootOpening"');
    expect(veil).toContain(':unlocking="bootOpening"');
    // Same 72px as the focal mark, so it reads as one object moving between
    // two places rather than two different vaults.
    expect(veil).toContain(':size="72"');
    // And no second definition of the mark's own gestures.
    const style = cloudPage.slice(cloudPage.indexOf("<style scoped>"));
    expect(style).not.toContain("@keyframes brand-mark");
  });

  it("keeps the boot gesture off the first-machine celebration's ref and timer", () => {
    // PR #106: celebrateUnlock owns vaultUnlocking and vaultUnlockTimer, has
    // one call site inside decideDevice, and captures wasOpen before any
    // await. The boot gesture must not borrow any of that -- sharing a flag
    // is what would let a page load reorder an admit.
    const at = cloudPage.indexOf("async function openBoot()");
    expect(at, "no openBoot").toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("\n}", at));
    expect(body).not.toContain("vaultUnlocking");
    expect(body).not.toContain("vaultUnlockTimer");
    expect(body).not.toContain("celebrateUnlock");
    expect(body).not.toContain("vaultArriving");
    expect(cloudPage).toContain("const BOOT_UNLOCK_MS = 700;");
  });

  it("never runs at the same time as the ambient arrival", () => {
    // Structural, not a rule to remember: `revealed` is false for the whole
    // of the boot gesture and ambientVault reads `revealed`, so the arrival
    // cannot start until the unlock has finished. Sequential by construction.
    expect(cloudPage).toContain(
      'const revealed = computed(() => settled.value && bootPhase.value === "open");'
    );
    expect(cloudPage).toContain(
      "const ambientVault = computed(() => revealed.value && signedIn.value);"
    );
  });

  it("does not make a fast page feel slower", () => {
    // If the veil was up for less than the threshold the visitor never
    // registered a wait, so there is no beat to resolve -- adding 700ms to a
    // page that was already ready is the regression this guards.
    expect(cloudPage).toContain("const BOOT_MIN_VISIBLE_MS = 350;");
    const body = cloudPage.slice(
      cloudPage.indexOf("async function openBoot()"),
      cloudPage.indexOf("watch(settled, (isSettled)")
    );
    expect(body).toContain("Date.now() - bootMountedAt < BOOT_MIN_VISIBLE_MS");
    // The skip sets the phase straight to open rather than falling through
    // into the gesture.
    expect(body.indexOf('bootPhase.value = "open";')).toBeLessThan(
      body.indexOf('bootPhase.value = "opening";')
    );
  });

  it("waits for the settled layout to be painted, not merely fetched", () => {
    // "Settled" is a stronger claim than "fetched". Revealing on promise
    // resolution and letting the layout reflow in front of the visitor is the
    // same defect as the flash, in better clothes.
    const body = cloudPage.slice(
      cloudPage.indexOf("async function openBoot()"),
      cloudPage.indexOf("watch(settled, (isSettled)")
    );
    expect(body).toContain("await nextTick();");
    expect(body).toContain("await afterNextPaint();");
    expect(cloudPage).toContain(
      "requestAnimationFrame(() => requestAnimationFrame(() => resolve()));"
    );
  });

  it("does not celebrate a failed load, and does not move under reduced motion", () => {
    const body = cloudPage.slice(
      cloudPage.indexOf("async function openBoot()"),
      cloudPage.indexOf("watch(settled, (isSettled)")
    );
    expect(body).toContain('stage.value === "error"');
    expect(body).toContain("prefersReducedMotion()");
    // Read inside the callback, never at setup scope: the PR #88 hydration
    // class. Both existing gestures place their guard the same way.
    expect(cloudPage).not.toContain("watch(settled, (isSettled) => {\n  if (prefersReducedMotion");
    // CSS half, independent of the JS half: the rings stop, and the reveal
    // lands on its destination rather than freezing an opaque veil in place.
    const style = cloudPage.slice(cloudPage.indexOf("@media (prefers-reduced-motion: reduce)"));
    const list = style.slice(0, style.indexOf("animation: none;"));
    expect(list).toContain(".cv-boot-ring.mid,");
    expect(list).toContain(".cv-boot-ring.outer,");
    expect(style).toContain(".cv-boot.opening {\n    animation: none;\n    opacity: 0;\n  }");
  });

  it("leaves the phase alone if the answer is lost again mid-decision", () => {
    const body = cloudPage.slice(
      cloudPage.indexOf("async function openBoot()"),
      cloudPage.indexOf("watch(settled, (isSettled)")
    );
    expect(body).toContain('if (!settled.value || bootPhase.value !== "waiting") return;');
    // And the watcher itself only ever starts from "waiting", so the gesture
    // is once per mount however many times `settled` flips.
    expect(cloudPage).toContain('if (!isSettled || bootPhase.value !== "waiting") return;');
  });

  it("clears its timer on unmount and leaves no dead keyframes behind", () => {
    expect(cloudPage).toContain("if (bootOpenTimer) clearTimeout(bootOpenTimer);");
    const style = cloudPage.slice(cloudPage.indexOf("<style scoped>"));
    // cv-pulse drove the mark this replaced. An unused @keyframes is the same
    // dead weight as the unused rules Task A found by compiling.
    expect(style).not.toContain("@keyframes cv-pulse");
    for (const name of ["cv-boot-open", "cv-boot-turn", "cv-boot-breathe"]) {
      expect(style, `${name} defined`).toContain(`@keyframes ${name}`);
      expect(style, `${name} used`).toContain(`animation: ${name}`);
    }
  });
});

describe("nothing in the new code logs", () => {
  it("adds no console calls", () => {
    const util = readFileSync(
      new URL("../.vitepress/theme/utils/cloudLoadState.ts", import.meta.url),
      "utf-8"
    );
    expect(util).not.toContain("console.");
  });
});
