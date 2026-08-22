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
