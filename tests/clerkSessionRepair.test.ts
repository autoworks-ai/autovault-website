import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const controls = readFileSync(
  new URL("../.vitepress/theme/components/ClerkAuthControls.vue", import.meta.url),
  "utf-8"
);

describe("Clerk modal sign-up session repair", () => {
  it("activates a created-but-inactive session instead of stranding the user", () => {
    // Reproduced in a real browser: Clerk's modal sign-up finishes by
    // navigating to its forced redirect URL, which on /cloud IS /cloud —
    // a same-document hash change. The browser never reloads and Clerk never
    // activates the session it just created. Observable end state:
    //   client.sessions -> [{ status: "active" }]
    //   Clerk.session   -> null
    //   Clerk.user      -> null
    // Both <Show when="signed-out"> and <Show when="signed-in"> then render
    // nothing, so the funnel sits on step 1 behind an empty box with no way
    // forward except a manual reload.
    expect(controls).toContain("function activatePendingSession");
    expect(controls).toContain("setActive");
    expect(controls).toContain('s.status === "active"');
  });

  it("only repairs the broken state, never a healthy or in-flight one", () => {
    // Guards matter more than the repair: without the clerk.session check
    // this would fight Clerk during normal sign-in, and without the
    // re-entrancy flag the interval would stack setActive calls.
    const fn = controls.slice(controls.indexOf("async function activatePendingSession"));
    const body = fn.slice(0, 600);
    expect(body).toContain("clerk.session");
    expect(body).toContain("repairingSession");
  });

  it("gives up rather than retrying a failing activation forever", () => {
    // The interval is 400ms. If Clerk keeps rejecting while the created
    // session stays visible -- a persistent outage, an offline tab -- an
    // unbounded retry is roughly 150 failed activation calls a minute, per
    // tab, indefinitely. The budget is keyed to the session id so a genuinely
    // new sign-up still gets its own attempts instead of inheriting a spent
    // counter. Anchor on the identifiers, not on the comment explaining them.
    expect(controls).toContain("SESSION_REPAIR_ATTEMPTS");
    expect(controls).toContain("repairTargetId");
    const fn = controls.slice(controls.indexOf("async function activatePendingSession"));
    const body = fn.slice(0, 1200);
    expect(body).toContain("if (repairsLeft <= 0) return;");
    expect(body).toContain("repairsLeft -= 1;");
    expect(body).toContain("stopSessionRepair()");
  });

  it("tears its interval down on unmount", () => {
    expect(controls).toContain("sessionRepairInterval = window.setInterval");
    expect(controls).toContain("if (sessionRepairInterval) window.clearInterval(sessionRepairInterval)");
    // The teardown moved into stopSessionRepair when the retry budget landed;
    // assert unmount still reaches it, or this guard stops guarding.
    const unmount = controls.slice(controls.indexOf("onBeforeUnmount(()"));
    expect(unmount.slice(0, 400)).toContain("stopSessionRepair()");
  });
});
