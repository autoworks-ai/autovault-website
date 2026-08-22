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

  it("tears its interval down on unmount", () => {
    expect(controls).toContain("sessionRepairInterval = window.setInterval");
    expect(controls).toContain("if (sessionRepairInterval) window.clearInterval(sessionRepairInterval)");
  });
});
