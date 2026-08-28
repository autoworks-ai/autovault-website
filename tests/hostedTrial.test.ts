import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOSTED_TRIAL_DAYS } from "../.vitepress/theme/data/product";
import {
  buildHostedVaultCheckoutParams,
  hostedTrialDays,
} from "../functions/api/_lib/stripe.js";
import { pageDocs } from "../.vitepress/shared/pageDocs";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf-8");

/**
 * A free trial is the one claim on this site that costs money to get wrong in
 * both directions: promise one that Checkout does not grant and the page lies
 * at the moment of payment; retire one that prose still advertises and the
 * same thing happens in reverse.
 *
 * Runtime surfaces are safe by construction -- /cloud renders every trial line
 * off /api/pricing, and that endpoint and the Checkout builder call the same
 * hostedTrialDays(). Build-time surfaces cannot do that, so they print
 * HOSTED_TRIAL_DAYS, and these cases are what tie that constant to the config
 * Stripe is actually handed.
 */
describe("the hosted trial is configured in exactly one place", () => {
  const wranglerTrialDays = () => {
    const match = /^AUTOVAULT_HOSTED_TRIAL_DAYS\s*=\s*"(\d+)"/m.exec(
      read("wrangler.toml"),
    );
    return match ? Number(match[1]) : 0;
  };

  it("matches the deployed Cloudflare var", () => {
    expect(HOSTED_TRIAL_DAYS).toBe(wranglerTrialDays());
  });

  it("is the number the Stripe resolver would return for that var", () => {
    // Not just string equality with the toml: the resolver clamps and rejects,
    // so a var of "9000" would leave the constant honest and Stripe sending
    // 730. Asserting through hostedTrialDays covers that gap.
    expect(
      hostedTrialDays({ AUTOVAULT_HOSTED_TRIAL_DAYS: String(wranglerTrialDays()) }),
    ).toBe(HOSTED_TRIAL_DAYS);
  });

  it("is documented in .dev.vars.example so local runs can reach the funnel", () => {
    expect(read(".dev.vars.example")).toContain("AUTOVAULT_HOSTED_TRIAL_DAYS");
  });
});

describe("trial copy never outlives the trial", () => {
  const TRIAL_WORDS = /free trial|days free|trial/i;

  // Two different questions, asked of two different things.
  //
  // "Does this still claim a trial?" is about what a reader receives, so it is
  // asked of the RENDERED text -- pageDocs markdown is already interpolated by
  // the time anyone reads it.
  //
  // "Is the number hardcoded?" cannot be asked of rendered text at all: the
  // interpolated output contains the literal either way, which is exactly how
  // this case failed the first time it ran. It is asked of SOURCE.
  const RENDERED = [
    { name: "cloud agent markdown", text: pageDocs.find((d) => d.key === "cloud")?.markdown ?? "" },
    { name: "hosted-sync agent markdown", text: pageDocs.find((d) => d.key === "hosted-sync")?.markdown ?? "" },
    { name: "AvTeamMode.vue", text: read(".vitepress/theme/components/AvTeamMode.vue") },
    { name: "HostedSyncPage.vue", text: read(".vitepress/theme/components/HostedSyncPage.vue") },
  ];

  const SOURCE = [
    { name: "pageDocs.ts", text: read(".vitepress/shared/pageDocs.ts") },
    { name: "AvTeamMode.vue", text: read(".vitepress/theme/components/AvTeamMode.vue") },
    { name: "HostedSyncPage.vue", text: read(".vitepress/theme/components/HostedSyncPage.vue") },
  ];

  for (const surface of RENDERED) {
    it(`${surface.name}: mentions a trial only while one is configured`, () => {
      if (HOSTED_TRIAL_DAYS > 0) return;
      expect(surface.text).not.toMatch(TRIAL_WORDS);
    });
  }

  // Interpolation, stripped. `${...}` in a template literal and `{{ ... }}` in
  // a Vue template are the two ways a build-time surface is allowed to print
  // the number; whatever is left after removing them is text somebody typed.
  //
  // The first version of this case used a lookbehind for HOSTED_TRIAL_DAYS
  // "nearby" instead, which exempted any literal sitting next to the constant
  // -- precisely where a hardcode hides. It passed a planted one.
  const withoutInterpolation = (text: string) =>
    text.replace(/\$\{[^}]*\}/g, "").replace(/\{\{[\s\S]*?\}\}/g, "");

  for (const surface of SOURCE) {
    it(`${surface.name}: writes the trial length as HOSTED_TRIAL_DAYS, never as a number`, () => {
      if (HOSTED_TRIAL_DAYS === 0) return;
      const hardcoded = new RegExp(`\\b${HOSTED_TRIAL_DAYS}[\\s-]?days?\\b`, "i");
      const found = withoutInterpolation(surface.text).match(hardcoded);
      expect(found, `${surface.name} hardcodes "${found?.[0]}"`).toBeNull();
      expect(surface.text).toContain("HOSTED_TRIAL_DAYS");
    });
  }

  it("the runtime funnel reads the trial rather than printing one", () => {
    const cloudPage = read(".vitepress/theme/components/CloudPage.vue");
    const funnel = read(".vitepress/theme/components/HostedVaultFunnel.vue");

    // /cloud has a runtime, so it does not use the constant at all: trialDays
    // comes off the /api/pricing payload and is threaded into the funnel.
    // Neither file may state a length of its own.
    expect(cloudPage).toContain("hostedPrice.value?.trial_days");
    expect(cloudPage).toContain(':trial-days="trialDays"');
    expect(funnel).toContain("props.trialDays");
    expect(cloudPage).not.toMatch(/\b\d+[\s-]?days? (free|trial)/i);
    expect(funnel).not.toMatch(/\b\d+[\s-]?days? (free|trial)/i);
  });

  it("states the trial on the Checkout page, from the same number Stripe is sent", () => {
    const env = {
      AUTOVAULT_HOSTED_PRICE_ID: "price_x",
      // A value that is deliberately not the configured one: the sentence has
      // to be built from whatever env says, not from the number this repo ships.
      AUTOVAULT_HOSTED_TRIAL_DAYS: "21",
      STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT: "Configured sentence about publishing.",
    };
    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/cloud"),
      env,
      user: { id: "u_1" },
    });
    const message = params.get("custom_text[submit][message]") ?? "";
    const days = params.get("subscription_data[trial_period_days]");

    // The sentence a buyer reads above the pay button and the parameter that
    // decides what they are charged come from one call to hostedTrialDays. A
    // Checkout page quoting a length Stripe was not sent is the failure this
    // exists to make impossible.
    expect(days).toBe(String(hostedTrialDays(env)));
    expect(message).toContain(`first ${days} days are free`);
    expect(message).toContain("no card is collected today");
    // The configured half survives. It carries the publishing disclosure, which
    // is the other thing that has to be true at the moment money moves.
    expect(message).toContain("Configured sentence about publishing.");
    expect(message.length).toBeLessThanOrEqual(1200);
  });

  it("ends a cardless trial rather than leaving it to a Stripe default", () => {
    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/cloud"),
      env: { AUTOVAULT_HOSTED_PRICE_ID: "price_x", AUTOVAULT_HOSTED_TRIAL_DAYS: "14" },
      user: { id: "u_1" },
    });

    // payment_method_collection is "if_required", so a trial can start with no
    // card. Stripe's unset default is create_invoice, which a test clock shows
    // landing on past_due: entitlement stops either way, but only because
    // ACTIVE_SUBSCRIPTION_STATUSES happens to exclude it, and the customer gets
    // dunned for a card they were told they did not need. State the ending.
    expect(
      params.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
    ).toBe("cancel");
    expect(params.get("payment_method_collection")).toBe("if_required");
  });

  it("offers the trial once per account, in the params and in the sentence", () => {
    const env = { AUTOVAULT_HOSTED_PRICE_ID: "price_x", AUTOVAULT_HOSTED_TRIAL_DAYS: "14" };
    const build = (allowTrial: boolean) =>
      buildHostedVaultCheckoutParams({
        request: new Request("https://autovault.dev/cloud"),
        env,
        user: { id: "u_1" },
        allowTrial,
      });

    const first = build(true);
    expect(first.get("subscription_data[trial_period_days]")).toBe("14");
    expect(first.get("custom_text[submit][message]")).toContain("14 days are free");

    // A trial that ends in "cancel" leaves the customer free to check out
    // again. Without this gate that is a subscription which renews forever and
    // never bills, so the second session must carry no trial AND must not say
    // it does: an ineligible buyer reading "your first 14 days are free" above
    // a $15 total is the worse half of the bug.
    const repeat = build(false);
    expect(repeat.get("subscription_data[trial_period_days]")).toBeNull();
    expect(
      repeat.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
    ).toBeNull();
    expect(repeat.get("custom_text[submit][message]") ?? "").not.toMatch(/days are free/);
  });

  it("does not advertise a trial to an account that already had one", () => {
    const cloudPage = read(".vitepress/theme/components/CloudPage.vue");
    const at = cloudPage.indexOf("const trialDays = computed");
    expect(at, "no trialDays computed").toBeGreaterThan(-1);
    const body = cloudPage.slice(at, cloudPage.indexOf("const trialLabel", at));

    // /api/pricing is edge-cached and answers for everybody, so the page has to
    // apply the same eligibility the checkout route does.
    expect(body).toContain("subscription.value?.status");
  });

  it("sets no trial-end behaviour when there is no trial to end", () => {
    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/cloud"),
      env: { AUTOVAULT_HOSTED_PRICE_ID: "price_x", AUTOVAULT_HOSTED_TRIAL_DAYS: "0" },
      user: { id: "u_1" },
    });

    expect(
      params.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
    ).toBeNull();
  });

  it("says nothing about a trial when none is configured", () => {
    const params = buildHostedVaultCheckoutParams({
      request: new Request("https://autovault.dev/cloud"),
      env: {
        AUTOVAULT_HOSTED_PRICE_ID: "price_x",
        AUTOVAULT_HOSTED_TRIAL_DAYS: "0",
        STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT: "Configured sentence about publishing.",
      },
      user: { id: "u_1" },
    });

    expect(params.get("subscription_data[trial_period_days]")).toBeNull();
    expect(params.get("custom_text[submit][message]")).toBe(
      "Configured sentence about publishing.",
    );
  });
});
