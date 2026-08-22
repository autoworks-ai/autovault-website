import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
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
    expect(cloudPage).not.toContain("$12 / mo");
    expect(cloudPage).not.toContain("Hosted · Active</small>");
    expect(cloudPage).toContain("subscriptionState");
  });
});
