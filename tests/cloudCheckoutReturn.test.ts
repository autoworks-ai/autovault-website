import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const funnel = readFileSync(
  new URL("../.vitepress/theme/components/HostedVaultFunnel.vue", import.meta.url),
  "utf-8"
);

// resumeCheckoutReturn only -- sliced with both anchors, the way the funnel
// assertions in cloudDashboardHonesty.test.ts are. A negative assertion run
// against the whole file would be wrong here: startFlow calls provisionVault
// legitimately, and that call is the entire point of this change.
const at = funnel.indexOf("async function resumeCheckoutReturn()");
const end = funnel.indexOf("async function reconcileCheckout", at);
const body = funnel.slice(at, end);

describe("checkout return does not reserve the namespace for you", () => {
  it("slices the function it claims to be testing", () => {
    // If either anchor moves, every assertion below silently reads the wrong
    // text (or an empty string, which passes a `not.toContain`).
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    expect(body).toContain('params.get("session_id")');
  });

  it("never provisions a vault on the way back from Stripe", () => {
    // The complaint this fixes, verbatim: "The step before this only displays
    // quickly and then flashes to the next. It should be at user interaction."
    //
    // The reserve step is real -- actionKind returns "reserve" and the template
    // renders a "Reserve namespace" button -- but returning from Checkout used
    // to call provisionVault() here. CloudPage derives its stage from vault
    // truthiness, so provisioning flipped the shell to "connect" and the button
    // rendered for roughly one frame. Reserving is now a click, only a click.
    // Matched with an open paren, not the bare name: the comment explaining the
    // removal names the function, and the next task on this branch changes its
    // signature, so `provisionVault(anything)` has to be caught as well.
    expect(body).not.toMatch(/provisionVault\(/);
    // It is still called -- from startFlow, which is the button's handler.
    expect(funnel).toMatch(/await provisionVault\(/);
  });

  it("still reconciles the Stripe session, behind its latch", () => {
    // Removing the auto-provision must not take the payment confirmation with
    // it: reconcile is what turns a just-completed Checkout into an active
    // subscription when the webhook has not landed yet, and it is what the
    // clear-the-params condition below depends on.
    expect(body).toContain("await reconcileCheckout(sessionId);");
    expect(body).toContain("!reconcileAttempted");
    expect(body).toContain("reconcileAttempted = true;");
  });

  it("tells a paying customer the payment landed rather than leaving them at a bare button", () => {
    // Landing on an un-clicked "Reserve namespace" with no feedback after
    // paying is worse than the flash it replaces.
    const paidBranch = body.indexOf("if (paid.value) {");
    expect(paidBranch).toBeGreaterThan(-1);
    expect(body.slice(paidBranch, paidBranch + 400)).toContain('kind: "ok"');
  });
});

describe("checkout return params always get cleared once handled", () => {
  it("clears them on confirmed payment, not on a vault that no longer appears", () => {
    // The trap in removing the auto-provision: the tail of this function used
    // to read `if (vault.value) clearCheckoutReturnParams();`, and the only
    // reason vault was ever truthy there was the auto-provision itself. Left
    // alone it would strand ?hosted=success&session_id=... in the address bar
    // indefinitely, and re-run the return path on every reload.
    expect(body).not.toContain("if (vault.value) clearCheckoutReturnParams();");
    const paidBranch = body.indexOf("if (paid.value) {");
    const clearInPaidBranch = body.indexOf("clearCheckoutReturnParams();", paidBranch);
    expect(clearInPaidBranch).toBeGreaterThan(paidBranch);
    expect(clearInPaidBranch).toBeLessThan(paidBranch + 900);
  });

  it("keeps them while the subscription is still unconfirmed", () => {
    // session_id is the only thing a later load can hand to
    // /api/billing/reconcile, and reconcileAttempted is not reset within a page
    // life -- so a reload is the recovery path when the webhook has not landed.
    // Clearing on "we tried" instead of "it worked" would delete it.
    //
    // Exactly three clears in this function: the cancelled return, the early
    // return for a user who already has a vault, and the confirmed-payment
    // branch -- every path that has finished with the params. A fourth would
    // mean some not-yet-handled path started dropping the session id.
    expect(body.split("clearCheckoutReturnParams()").length - 1).toBe(3);
    const cancelled = body.indexOf('hosted === "cancelled"');
    const vaultEarlyReturn = body.indexOf("if (vault.value) {");
    expect(cancelled).toBeGreaterThan(-1);
    expect(vaultEarlyReturn).toBeGreaterThan(cancelled);
  });

  it("still warns, and still holds the params, when Stripe has not confirmed yet", () => {
    // The unconfirmed tail is the one path that must fall out of the function
    // without clearing anything, so it has to sit after the paid branch's
    // early return -- not before it, where it would fire for everyone.
    const paidBranch = body.indexOf("if (paid.value) {");
    const unconfirmedWarn = body.indexOf("Waiting for Stripe to confirm your subscription");
    expect(unconfirmedWarn).toBeGreaterThan(paidBranch);
    expect(body.slice(unconfirmedWarn)).not.toContain("clearCheckoutReturnParams()");
  });
});

describe("the reserve step's own copy", () => {
  it("does not tell a customer who has paid that checkout must still complete", () => {
    // commandBlock's non-vault branch renders inside the local-handoff card,
    // which is gated on showLocalHandoff -> atReserveStep -> paid && !vault. It
    // is therefore only ever read by someone who has already paid. That line
    // survived only because the auto-provision made the state last one frame;
    // now it is the durable post-checkout screen and the screen-reader
    // transcript in <pre class="visually-hidden">.
    expect(funnel).not.toContain("# Checkout must complete before this namespace is reserved.");
    expect(funnel).toContain("# Checkout is complete. Reserve the namespace above to claim it.");
  });

  it("presents the command card as install-only, since it has no link command to give", () => {
    // Jack copied this block expecting to link with it and got install commands
    // ending in `autovault skill list`. That is correct -- at the reserve step
    // no namespace exists, so there is no slug to link to -- but titling it
    // "Local handoff" implied it was the whole handoff.
    expect(funnel).not.toContain('<div class="panel-title">Local handoff</div>');
    expect(funnel).toContain('<div class="panel-title">Install the CLI</div>');
    // The caveat must be on screen BEFORE the copy buttons...
    const title = funnel.indexOf('<div class="panel-title">Install the CLI</div>');
    const copyRow = funnel.indexOf('class="hosted-copy-row"');
    const note = funnel.indexOf('class="hcc-note"');
    expect(note).toBeGreaterThan(title);
    expect(note).toBeLessThan(copyRow);
  });

  it("carries the same caveat into the copied text, not just the page", () => {
    // Someone pasting into a terminal is not looking at the page any more, so
    // the block itself has to say why it contains no `autovault link`.
    expect(funnel).toContain("# `autovault link` appears here once you reserve it.");
    // Only while there is no vault -- once reserved, the connect step owns the
    // real link command and repeating the caveat there would be wrong.
    const block = funnel.slice(funnel.indexOf("const commandBlock = computed"));
    const line = block.indexOf("appears here once you reserve it");
    expect(block.slice(0, line)).toContain("vault.value ? [] :");
  });
});
