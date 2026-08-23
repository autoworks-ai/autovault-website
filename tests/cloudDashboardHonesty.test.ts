import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
  "utf-8"
);

const teamMode = readFileSync(
  new URL("../.vitepress/theme/components/AvTeamMode.vue", import.meta.url),
  "utf-8"
);

const accountMenu = readFileSync(
  new URL("../.vitepress/theme/components/CloudAccountMenu.vue", import.meta.url),
  "utf-8"
);

describe("cloud dashboard stage machine", () => {
  it("routes an auth failure to an error stage, not to the sign-up funnel", () => {
    // A signed-in, paying, provisioned user whose /api/me call failed used to
    // land on stage "setup" — i.e. "Set up your hosted vault" — because stage
    // keyed only off `vault`, and a failed load leaves `vault` null.
    expect(cloudPage).toContain('type Stage = "error"');
    const stageBody = cloudPage.slice(cloudPage.indexOf("const stage = computed<Stage>"));
    const errorReturn = stageBody.indexOf('return "error"');
    const setupReturn = stageBody.indexOf('return "setup"');
    expect(errorReturn).toBeGreaterThan(-1);
    expect(errorReturn).toBeLessThan(setupReturn);
    expect(stageBody.slice(0, errorReturn)).toContain("loadError.value");
  });

  it("carries the anchor every post-auth redirect targets", () => {
    // Stripe success_url/cancel_url, the Clerk redirect and safeReturnTo's
    // fallback all point at /cloud#launch-path.
    expect(cloudPage).toContain('id="launch-path"');
  });

  it("does not hardcode subscription status or price", () => {
    // The sidebar footer markup moved into CloudAccountMenu.vue, so this
    // guard has to read both files or it silently stops guarding anything.
    const shell = `${cloudPage}\n${accountMenu}`;
    expect(shell).not.toContain("$12 / mo");
    expect(shell).not.toContain("Hosted · Active</small>");
    expect(cloudPage).toContain("subscriptionState");
  });

  it("does not label a scheduled-to-cancel subscription as renewing", () => {
    // A subscription cancelled effective end-of-period keeps status "active"
    // (tone "ok") right up until that date, and the API doesn't persist
    // Stripe's cancel_at_period_end -- so this can't distinguish "will renew"
    // from "will end" for an otherwise-active row. "Renews" overclaims.
    expect(cloudPage).not.toMatch(/`Renews \$\{formatted\}`/);
    expect(cloudPage).toContain("Current period ends");
  });
});

describe("team mode copy", () => {
  it("does not promise signed skill sync as a live hosted-beta capability", () => {
    // HostedVaultFunnel.vue tells customers "sync is not enabled yet" --
    // team mode's own hosted route previously listed "signed skill sync" as
    // something a team gets today alongside the reserved namespace, directly
    // contradicting that. It must not claim sync ships now.
    expect(teamMode).not.toMatch(/reserved namespace, enrolled devices, signed skill sync/i);
    expect(teamMode).toContain("not enabled yet");
  });

  it("does not promise device enrollment as a live hosted-beta capability either", () => {
    // A local review caught that the first fix for the finding above swapped
    // one overclaim for another: the backend has no device table, issuance
    // endpoint, or enrollment flow -- only a self-attested "I've linked my
    // CLI" click (CloudPage.vue markProgress("cli_linked")). Only namespace
    // reservation is real today.
    expect(teamMode).not.toMatch(/reserved namespace and enrolled devices today/i);
    expect(teamMode).toContain("device enrollment and signed skill sync are not enabled yet");
  });
});

describe("unified shell", () => {
  const funnel = readFileSync(
    new URL("../.vitepress/theme/components/HostedVaultFunnel.vue", import.meta.url),
    "utf-8"
  );

  it("renders one shell at every stage instead of swapping experiences", () => {
    // Signup used to render as a bare .cv-setup page with its own visual
    // language, then hard-switch to this shell once a vault existed. That
    // switch is the whole complaint being fixed.
    expect(cloudPage).not.toContain('class="cv-setup"');
    expect(cloudPage.match(/class="cv-shell"/g)?.length).toBe(1);
  });

  it("derives one progress rail, not four", () => {
    // stageFocus (a "Step N of 4" kicker), flowItems (four status cards) and
    // provisionSteps (a five-row checklist) each re-derived the same
    // booleans, inside a page that maintained a fourth model of its own.
    // Anchor on declarations, not bare names: the comments explaining what
    // was removed necessarily mention them.
    expect(cloudPage).toContain("const onboardingSteps = computed");
    expect(funnel).not.toContain("const flowItems = computed");
    expect(funnel).not.toContain("const provisionSteps = computed");
    expect(funnel).not.toContain("const stageFocus = computed");
    expect(funnel).not.toMatch(/"Step \d of \d"/);
    expect(cloudPage).not.toContain("Step 1 of 2");
  });

  it("does not bounce a lapsed subscriber with a vault back to checkout", () => {
    // getSubscription derives `active` from isPaidStatus(status), so past_due
    // flips `paid` false while the vault row survives. Checking `paid` first
    // would show an existing customer the signup funnel again.
    const body = cloudPage.slice(cloudPage.indexOf("const stage = computed<Stage>"));
    expect(body.indexOf("if (vault.value)")).toBeLessThan(body.indexOf("paid.value"));
  });

  it("keeps Sync a locked destination rather than an onboarding step", () => {
    // Hosted sync does not exist server-side. A step you cannot complete is
    // not a step.
    expect(cloudPage).toContain('"Sync log"');
    const labels = cloudPage.slice(cloudPage.indexOf("ONBOARDING_STEP_LABELS"), cloudPage.indexOf("ONBOARDING_STEP_LABELS") + 300);
    expect(labels).not.toContain("Sync");
  });

  it("reports every rail step as unknown when the load failed", () => {
    // A failed /api/me leaves every downstream fact unknowable; ticking step
    // one off isClerkSignedIn would claim knowledge we do not have.
    expect(cloudPage).toContain('stage.value === "error"');
    expect(cloudPage).toContain('"unknown"');
  });

  it("stacks the rail on narrow viewports instead of wrapping it per character", () => {
    // Four labelled steps flexed across a 375px viewport wrap one character
    // per line. Verified in a real browser before this was written.
    const narrow = cloudPage.slice(cloudPage.indexOf("@media (max-width: 640px)"));
    expect(narrow.slice(0, 600)).toContain("flex-direction: column");
  });

  it("server-renders the shell so there is no post-hydration layout jump", () => {
    // The boot veil overlays the shell rather than replacing it.
    const bootBlock = cloudPage.slice(cloudPage.indexOf(".cv-boot {"), cloudPage.indexOf(".cv-boot {") + 400);
    expect(bootBlock).toContain("position: absolute");
  });
});

describe("funnel/shell handoff", () => {
  const funnel = readFileSync(
    new URL("../.vitepress/theme/components/HostedVaultFunnel.vue", import.meta.url),
    "utf-8"
  );

  it("surfaces funnel failures instead of swallowing them", () => {
    // Stripping the funnel's chrome removed the element that rendered its own
    // notice. Without lifting them, a cancelled Checkout or the expected
    // webhook-delay 402 would leave the button merely re-enabling, with no
    // reason and no retry guidance.
    expect(funnel).toContain("watch(notice, (next) => emit(\"notice\", next));");
    expect(funnel).toContain("notice: [notice: Notice | null];");
    expect(cloudPage).toContain('@notice="setNotice"');
    // And the third tone has to be styleable, or hard failures render bare.
    expect(cloudPage).toContain(".cv-notice.fail");
  });

  it("invalidates an in-flight load when the funnel hands over new state", () => {
    // On a Stripe return this page fires an /api/me before Clerk resolves, so
    // it comes back anonymous and slow, while the funnel reconciles and
    // provisions. Without bumping the sequence the stale response wins and
    // drops a user who has just paid back to "Finish checkout".
    const fn = cloudPage.slice(cloudPage.indexOf("function syncCloudState"));
    expect(fn.slice(0, 900)).toContain("cloudStateRequestSeq += 1;");
  });

  it("only hands over state the funnel actually knows to be true", () => {
    // The invalidation above is a side effect a guess cannot afford. The shell
    // cancels its own in-flight load for every payload it receives, so a
    // failed child request that broadcast an anonymous payload would discard a
    // possibly-successful parent load and demote a signed-in subscriber back
    // to the checkout step. A non-OK response means "could not find out", not
    // "signed out": /api/me answers a genuinely signed-out visitor with 200
    // and a null user, so the ok path is the only authoritative one.
    const at = funnel.indexOf("async function loadMe()");
    const end = funnel.indexOf("async function startCheckout", at);
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    const body = funnel.slice(at, end);
    expect(body.split('emit("stateChange"').length - 1).toBe(1);
    expect(body).not.toContain("me.value = { user: null }");
  });

  it("renders from the shell's state, not from its own copy of /api/me", () => {
    // Two components fetching the same endpoint could disagree, and the
    // disagreement had a price: with the shell's request succeeding and the
    // funnel's failing, the shell showed "Reserve your namespace" while this
    // button still said "Open checkout", and clicking it opened a SECOND
    // subscription-mode Stripe Checkout for somebody already paying.
    expect(cloudPage).toContain(':state="cloudState"');
    expect(funnel).toContain("const current = computed<MeResponse | null>(() => props.state ?? me.value)");
    for (const derived of [
      "const signedIn = computed(() => Boolean(current.value?.user)",
      "const paid = computed(() => Boolean(current.value?.subscription?.active))",
      "const vault = computed(() => current.value?.vault ?? null)"
    ]) {
      expect(funnel).toContain(derived);
    }
    // A prop only updates once the parent has re-rendered, and every caller
    // reads those computeds straight after awaiting loadMe.
    expect(funnel).toContain("await nextTick();");
    // And the provisioning hand-off must merge onto the authoritative state,
    // or a failed local load turns "namespace reserved" into "signed out".
    expect(funnel).toContain("{ ...(current.value ?? { user: null }), vault: payload.vault }");
  });
});

describe("checkout cannot double-charge", () => {
  const checkout = readFileSync(
    new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
    "utf-8"
  );

  it("refuses a second subscription for an already-active subscriber", () => {
    // Defence in depth for the same defect: whatever the UI believes, Stripe
    // will happily take a second subscription-mode session, so the money path
    // must not depend on the client being right.
    expect(checkout).toContain("getSubscription");
    const handler = checkout.slice(checkout.indexOf("const user = await requireUser"));
    const guard = handler.slice(0, handler.indexOf("buildHostedVaultCheckoutParams"));
    expect(guard).toContain("subscription?.active");
    expect(guard).toContain("409");
    // The guard must sit BEFORE the session is built, not after.
    expect(guard).toContain("ApiError");
  });
});

describe("provisioning transition", () => {
  const funnel = readFileSync(
    new URL("../.vitepress/theme/components/HostedVaultFunnel.vue", import.meta.url),
    "utf-8"
  );

  it("keeps the funnel mounted across the transition it triggers", () => {
    // provisionVault emits stateChange the moment a vault comes back, which
    // flips the pre-vault condition. Under v-if that destroyed the component
    // mid-function, discarding its success notice and the savePendingImport
    // still in flight. v-show keeps the instance alive.
    const block = cloudPage.slice(cloudPage.indexOf("PRE-VAULT: account"));
    expect(block.slice(0, 700)).toContain('v-show="!vault"');
    expect(block.slice(0, 700)).not.toContain('v-else-if="!vault"');
  });

  it("sets the success notice before handing state to the shell", () => {
    // Belt and braces for the same defect: emitting first meant the ok
    // notice landed after the shell had already advanced, and any stale
    // "waiting for the webhook" warn stayed on screen.
    const fn = funnel.slice(funnel.indexOf("async function provisionVault"));
    const noticeAt = fn.indexOf('kind: "ok"');
    const emitAt = fn.indexOf('emit("stateChange"');
    expect(noticeAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeLessThan(emitAt);
  });
});

describe("one thing at a time", () => {
  const funnel = readFileSync(
    new URL("../.vitepress/theme/components/HostedVaultFunnel.vue", import.meta.url),
    "utf-8"
  );

  it("does not show starter skills or install commands during checkout", () => {
    // Both panels used to render from sign-in onward, so "Finish checkout"
    // carried a starter-skill picker and a block of install commands next to
    // its one button — neither related to paying. The design spec's rule for
    // this surface is "never show more than the one thing that matters right
    // now"; they belong to the reserve step, where the skills are what gets
    // queued and the handoff is the actual next action.
    expect(funnel).toContain("const atReserveStep = computed");
    expect(funnel).toContain("const showSetupDetails = computed(() => atReserveStep.value);");
    expect(funnel).toContain("const showLocalHandoff = computed(() => atReserveStep.value);");
    expect(funnel).not.toContain("signedIn.value || paid.value");
  });
});
