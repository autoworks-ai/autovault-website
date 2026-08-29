import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestEnv, seedUser } from "./support/d1.js";
import {
  attachTrialSession,
  claimTrial,
  getTrialClaim,
  IN_FLIGHT_MS,
  isTrialClaimInFlight,
  releaseTrialClaim,
} from "../functions/api/_lib/trials.js";
import { HOSTED_TRIAL_DAYS } from "../.vitepress/theme/data/product";
import {
  buildHostedVaultCheckoutParams,
  CHECKOUT_CREATE_TIMEOUT_MS,
  createCheckoutSession,
  findOutstandingTrialSession,
  hasPriorStripeSubscription,
  hostedTrialDays,
  resolveStripeCustomerId,
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
    it(`${surface.name}: states that a trial exists, never how long or for whom`, () => {
      if (HOSTED_TRIAL_DAYS === 0) return;

      // The rule tightened. It used to be "interpolate the number, never type
      // it", which stopped the copy going stale against wrangler.toml but not
      // against reality: HOSTED_TRIAL_DAYS is fixed at build, and eligibility is
      // decided per account at checkout, so a static page is blind to both. It
      // may say a trial exists. /cloud reads the length and the eligibility at
      // runtime and is one click away.
      const rendersLength = /\{\{[^}]*HOSTED_TRIAL_DAYS[^}]*\}\}|\$\{[^}]*HOSTED_TRIAL_DAYS[^}]*\}/;
      const printed = surface.text.match(rendersLength);
      // `${HOSTED_TRIAL_DAYS > 0 ? ... : ...}` is a gate, not a print: it picks
      // between two strings rather than putting the number in one.
      const isGateOnly = printed ? /HOSTED_TRIAL_DAYS\s*[><=]/.test(printed[0]) : true;
      expect(isGateOnly, `${surface.name} prints the trial length: ${printed?.[0]}`).toBe(true);
    });

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

  it("asks Stripe, not the local table, whether a trial was already had", async () => {
    // The local row lands after Checkout completes, so it cannot answer this
    // question during the window it is actually asked. These cases pin the
    // lookup that can.
    const calls: string[] = [];
    const stub = (routes: Record<string, unknown>) =>
      (async (url: URL | RequestInfo) => {
        const path = String(url).replace("https://api.stripe.com/v1/", "");
        calls.push(path);
        const key = Object.keys(routes).find((k) => path.startsWith(k));
        return new Response(JSON.stringify(key ? routes[key] : { data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }) as typeof fetch;

    const env = { STRIPE_SECRET_KEY: "sk_test_x" };

    // A canceled subscription still counts. Cancelling is the whole route back
    // for a second free trial, so status=all has to be on the request.
    calls.length = 0;
    await expect(
      hasPriorStripeSubscription(
        { ...env },
        { customerId: "cus_known", email: "a@b.test" },
        stub({ customers: { data: [{ id: "cus_1" }] }, subscriptions: { data: [{ id: "sub_1", status: "canceled" }] } })
      )
    ).resolves.toBe(true);
    expect(calls.some((c) => c.includes("status=all"))).toBe(true);

    // Nothing anywhere means eligible.
    calls.length = 0;
    await expect(
      hasPriorStripeSubscription(
        { ...env },
        { customerId: "cus_known", email: "a@b.test" },
        stub({ customers: { data: [] }, subscriptions: { data: [] } })
      )
    ).resolves.toBe(false);

    // A Stripe failure throws rather than guessing. Guessing false hands out a
    // second trial; guessing true charges somebody who was promised one.
    await expect(
      hasPriorStripeSubscription(
        { ...env },
        { customerId: "cus_known", email: "a@b.test" },
        async () =>
          new Response(JSON.stringify({ error: { message: "boom" } }), {
            status: 500,
            headers: { "content-type": "application/json" }
          })
      )
    ).rejects.toThrow(/Stripe|boom/i);
  });

  it("finds history under a customer the local tables never recorded", async () => {
    // The case a D1-only check gets wrong: the completed-checkout webhook never
    // landed, so there is no customers row and no subscriptions row, while
    // Stripe has both. Without the email fallback this account is handed a
    // second trial for free, indefinitely.
    const seen: string[] = [];
    const fetcher = (async (url: URL | RequestInfo) => {
      const path = String(url).replace("https://api.stripe.com/v1/", "");
      seen.push(path);
      const body = path.startsWith("customers")
        ? { data: [{ id: "cus_orphan" }] }
        : { data: [{ id: "sub_old", status: "canceled" }] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    await expect(
      hasPriorStripeSubscription(
        { STRIPE_SECRET_KEY: "sk_test_x" },
        { customerId: null, email: "orphan@b.test" },
        fetcher
      )
    ).resolves.toBe(true);
    expect(seen[0]).toContain("customers?email=orphan%40b.test");
    expect(seen.some((p) => p.startsWith("subscriptions?customer=cus_orphan"))).toBe(true);
  });

  it("keeps the checkout route's eligibility question on Stripe", () => {
    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );

    // The local row is allowed as a short-circuit, never as the answer on its
    // own: it is written after Checkout completes, so between opening a session
    // and finishing it there is no local record that a trial was offered.
    expect(route).toContain("hasPriorStripeSubscription");
    expect(route).toContain("resolveStripeCustomerId");
    const at = route.indexOf("const hadTrialBefore");
    expect(at, "no eligibility check").toBeGreaterThan(-1);
    const block = route.slice(at, route.indexOf("};", at));
    expect(block).toContain("subscription?.status");
    expect(block).toContain("hasPriorStripeSubscription");
  });

  it("lets exactly one of two overlapping requests claim the trial", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // The atomic step. Everything else in the eligibility sequence is a
    // check-then-act against Stripe, so two overlapping requests can both
    // believe they are the first. D1's primary key is the only arbiter in the
    // stack, and `on conflict do nothing ... returning` makes the answer
    // unambiguous: a row back means this call won.
    const [a, b] = await Promise.all([
      claimTrial(env, "clerk_1", "cs_a"),
      claimTrial(env, "clerk_1", "cs_b")
    ]);
    // The winner gets the token back, because the token has to reach the
    // Checkout Session's metadata: it is the only durable link from a session
    // Stripe finished creating after an abort back to the claim that paid.
    expect([a, b].filter(Boolean)).toHaveLength(1);

    // And it stays claimed for every later attempt.
    expect(await claimTrial(env, "clerk_1", "cs_c")).toBeNull();

    // Released only when the caller has established the offer lapsed, after
    // which the account may try again.
    const held = await getTrialClaim(env, "clerk_1");
    expect(held).toBeTruthy();
    await releaseTrialClaim(env, "clerk_1", held);
    expect(await getTrialClaim(env, "clerk_1")).toBeNull();
    expect(await claimTrial(env, "clerk_1", "cs_d")).toBeTruthy();
  });

  it("does not release a claim whose session is still being created", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // The failure this guard exists for. Request A inserts its claim and pauses
    // to create a Stripe session. Request B looks, finds no session in Stripe
    // because A has not finished, and used to delete A's claim as stale, claim
    // for itself, and hand out a second trial. The delete defeated the primary
    // key it was there to respect.
    await claimTrial(env, "clerk_1");
    const inFlight = await getTrialClaim(env, "clerk_1");
    expect(isTrialClaimInFlight(inFlight)).toBe(true);

    // Once a session is attached it is no longer in flight: from then on its
    // liveness is Stripe's answer about that session, not a clock.
    await attachTrialSession(env, "clerk_1", "cs_open");
    expect(isTrialClaimInFlight(await getTrialClaim(env, "clerk_1"))).toBe(false);
  });

  it("stops treating a claim as in flight once the window passes", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // Otherwise a request that died between claiming and creating a session
    // would block that account forever.
    await claimTrial(env, "clerk_1");
    const claim = await getTrialClaim(env, "clerk_1");
    expect(isTrialClaimInFlight(claim, Date.parse(claim.claimed_at) + IN_FLIGHT_MS + 1)).toBe(false);
  });

  it("releases only the exact claim it looked at", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    await claimTrial(env, "clerk_1", "cs_old");
    const stale = await getTrialClaim(env, "clerk_1");

    // Somebody re-claims in the gap between the read and the delete.
    await releaseTrialClaim(env, "clerk_1", stale);
    await claimTrial(env, "clerk_1", "cs_new");

    // Replaying the stale release must not throw the new claim away. An
    // unconditional delete would, and so would one matched on claimed_at:
    // these two claims are made inside the same millisecond and carry the same
    // timestamp, which is why the identity is the rowid.
    expect(stale.claim_token).not.toBe((await getTrialClaim(env, "clerk_1"))?.claim_token);
    await releaseTrialClaim(env, "clerk_1", stale);
    expect((await getTrialClaim(env, "clerk_1"))?.session_id).toBe("cs_new");
  });

  it("records which session a claim was spent on", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // Without this a later request cannot tell a claim waiting on a live
    // checkout from one whose checkout is gone, and would either strand the
    // account or hand out a second trial.
    await claimTrial(env, "clerk_1");
    expect((await getTrialClaim(env, "clerk_1"))?.session_id).toBeNull();
    await attachTrialSession(env, "clerk_1", "cs_real");
    expect((await getTrialClaim(env, "clerk_1"))?.session_id).toBe("cs_real");
  });

  it("claims before building the session, and only when no trial was had", () => {
    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );

    const claimAt = route.indexOf("await claimTrial(");
    const buildAt = route.indexOf("buildHostedVaultCheckoutParams({");
    expect(claimAt, "no claimTrial call").toBeGreaterThan(-1);
    expect(claimAt, "the claim must precede the session").toBeLessThan(buildAt);

    // Losing the race must not silently sell somebody a full-price
    // subscription they did not ask for.
    expect(route).toContain("A checkout session is already being created");
    expect(route).toContain("await claimTrial(env, user.id)");
    // A claim still being spent by another request is not a claim to take.
    expect(route).toContain("isTrialClaimInFlight");
    expect(route).toContain("if (claim && !inFlight)");

    // And a claim is only released after asking Stripe about its OWN session by
    // id. Inferring from the customer does not hold: two first-time requests
    // can each create a Stripe customer, so the winner's session sits under one
    // and a later email lookup resolves the other. The outstanding search then
    // finds nothing and the release throws away a claim whose session is open
    // under a customer this request never looked at.
    const releaseAt = route.indexOf("releaseTrialClaim(env, user.id, claim)");
    const verifyAt = route.indexOf("retrieveCheckoutSession(env, claim.session_id)");
    expect(verifyAt, "no session verification").toBeGreaterThan(-1);
    expect(verifyAt, "verify before releasing").toBeLessThan(releaseAt);
    expect(route).toContain('recorded?.status === "open"');
  });

  it("creates at most one Stripe customer per account, even concurrently", async () => {
    const calls: Array<{ path: string; key: string | null; method: string; body: string }> = [];
    const fetcher = (async (url: URL | RequestInfo, init?: RequestInit) => {
      const path = String(url).replace("https://api.stripe.com/v1/", "");
      const headers = new Headers(init?.headers as HeadersInit);
      calls.push({
        path,
        key: headers.get("idempotency-key"),
        method: init?.method ?? "GET",
        body: String(init?.body ?? "")
      });
      const body = path.startsWith("customers?") || path.startsWith("customers/search")
        ? { data: [] }
        : { id: "cus_new" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const env = {
      STRIPE_SECRET_KEY: "sk_test_x",
      AUTOVAULT_DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) }
    };
    await resolveStripeCustomerId(env, { userId: "u_1", email: "a@b.test" }, fetcher);

    // Two first-time requests reaching here at once used to create a customer
    // each, and from then on the two halves of the trial machinery looked at
    // different ones: the winner's session under one, a later email lookup
    // resolving the other, so an open session went unseen and a live claim read
    // as stale. The body is stable per user, which is what makes a key safe
    // here and not on the Checkout Session, whose params vary by source.
    const create = calls.find((c) => c.path === "customers" && c.method === "POST");
    expect(create?.key).toBe("av-customer-u_1");

    // The keyed body carries the user id and nothing else. Stripe refuses a key
    // reused with different parameters, so a mutable field in here blocks
    // checkout for anyone who edits their email inside the retention window and
    // hands them a second customer once the key ages out. Verified against real
    // Stripe: with a stable body, a resolve with a changed email returns the
    // same customer.
    expect(create?.body).toContain("metadata%5Buser_id%5D=u_1");
    expect(create?.body).not.toContain("email");

    // The address is set immediately after, off the keyed path, where failing
    // costs an email rather than a checkout.
    const update = calls.find((c) => c.path.startsWith("customers/cus_"));
    expect(update?.key).toBeNull();
    expect(update?.body).toContain("email=");
  });

  it("treats an in-progress idempotent create as the other request winning", async () => {
    // Verified against Stripe rather than assumed: two requests using one key
    // at the same instant do not serialise, the second is refused. That refusal
    // means the other request is creating the customer right now, so it must
    // not surface as a 502 at somebody trying to pay.
    const fetcher = (async (url: URL | RequestInfo) => {
      const path = String(url).replace("https://api.stripe.com/v1/", "");
      if (path === "customers") {
        return new Response(
          JSON.stringify({
            error: { message: "There is currently another in-progress request using this Idempotent Key: av-customer-u_1" }
          }),
          { status: 409, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ data: [{ id: "cus_winner" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const env = {
      STRIPE_SECRET_KEY: "sk_test_x",
      AUTOVAULT_DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) }
    };
    await expect(
      resolveStripeCustomerId(env, { userId: "u_1", email: "a@b.test" }, fetcher)
    ).resolves.toBe("cus_winner");
  });

  it("releases a claim written before claim_token existed", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // 0008 rows carry a null token. Refusing to release them strands the
    // account rather than the claim: the release is a permanent no-op, the next
    // claimTrial conflicts on user_id, and checkout answers 409 for that user
    // forever. 0010 backfills them, and this stays for a database that has not
    // run it yet.
    db.prepare(
      "insert into trial_claims (user_id, session_id, claimed_at, claim_token) values (?, ?, ?, null)"
    ).run("clerk_1", "cs_legacy", new Date(0).toISOString());

    const legacy = await getTrialClaim(env, "clerk_1");
    expect(legacy?.claim_token).toBeNull();

    await releaseTrialClaim(env, "clerk_1", legacy);
    expect(await getTrialClaim(env, "clerk_1")).toBeNull();
    // And the account is usable again rather than 409 forever.
    expect(await claimTrial(env, "clerk_1", "cs_after")).toBeTruthy();
  });

  it("cannot outlive the claim window it is covered by", async () => {
    // The window is a guess unless the call underneath it is bounded. An owner
    // still inside createCheckoutSession when IN_FLIGHT_MS elapses would have
    // its claim released and a second trial session created behind it, and then
    // succeed. The abort makes the window an upper bound instead.
    expect(CHECKOUT_CREATE_TIMEOUT_MS).toBeLessThan(IN_FLIGHT_MS);

    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );
    expect(route).toContain("AbortSignal.timeout(CHECKOUT_CREATE_TIMEOUT_MS)");
    // Bounded only where a claim is held. A full-price session has no window to
    // stay inside and no reason to be cut short.
    expect(route).toContain("allowTrial ? AbortSignal.timeout");

    // And the signal actually reaches fetch rather than being accepted and
    // dropped.
    let sawSignal = false;
    const fetcher = (async (_url: URL | RequestInfo, init?: RequestInit) => {
      sawSignal = Boolean(init?.signal);
      return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout/x" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;
    await createCheckoutSession(
      { STRIPE_SECRET_KEY: "sk_test_x" },
      new URLSearchParams({ mode: "subscription" }),
      fetcher,
      AbortSignal.timeout(1000)
    );
    expect(sawSignal).toBe(true);
  });

  it("finds a session Stripe finished creating after the abort", async () => {
    // Aborting our fetch does not stop Stripe's server-side work, so a create
    // that timed out can still produce a session this side never saw the id of.
    // The claim token stamped into that session's metadata is the link back;
    // without it the claim looks like it bought nothing and a second trial goes
    // out behind it.
    const orphan = {
      id: "cs_orphan",
      url: "https://checkout/orphan",
      metadata: { trial_days: "14", claim_token: "tok_mine" }
    };
    const other = {
      id: "cs_other",
      url: "https://checkout/other",
      metadata: { trial_days: "14", claim_token: "tok_someone_else" }
    };
    const fetcher = (async () =>
      new Response(JSON.stringify({ data: [other, orphan] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })) as typeof fetch;
    const env = { STRIPE_SECRET_KEY: "sk_test_x" };

    await expect(
      findOutstandingTrialSession(env, "cus_1", fetcher, "tok_mine")
    ).resolves.toMatchObject({ id: "cs_orphan" });

    // A token that matches nothing must not fall back to somebody else's
    // session, which would hand this account a checkout it does not own.
    await expect(
      findOutstandingTrialSession(env, "cus_1", fetcher, "tok_absent")
    ).resolves.toBeNull();

    // Without a token the older behaviour stands: any open trial session.
    await expect(
      findOutstandingTrialSession(env, "cus_1", fetcher)
    ).resolves.toBeTruthy();
  });

  it("treats a completed checkout as spent rather than stale", () => {
    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );

    // status "complete" means the session was paid and a subscription exists,
    // even if its webhook has not landed here yet. Releasing on it hands the
    // same account a second trial off a checkout it already finished. Only
    // "expired", or no record at all, frees a claim.
    expect(route).toContain('recorded.status !== "expired"');
    expect(route).toContain("already used its trial checkout");

    // And the recovery runs before the release, not after it.
    const orphanAt = route.indexOf("findOutstandingTrialSession(\n            env,");
    const releaseAt = route.indexOf("releaseTrialClaim(env, user.id, claim)");
    expect(orphanAt, "no orphan recovery").toBeGreaterThan(-1);
    expect(orphanAt).toBeLessThan(releaseAt);
  });

  it("does not claim a trial that is not configured", () => {
    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );

    // The claim arbitrates an offer. With no trial configured there is no
    // offer, and claiming anyway records a full-price session as the one this
    // account's trial was spent on: switch the trial on later and an eligible
    // first-timer gets their own old non-trial checkout handed back through the
    // reuse path.
    expect(route).toContain("!hadTrialBefore && hostedTrialDays(env) > 0");
  });

  it("keeps the claim when Stripe cannot say whether its session is open", () => {
    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );

    // `.catch(() => null)` read a 429 or a network blip as "the session is
    // gone", released a claim whose session was very likely still open, and
    // issued a second trial off the back of it. Only a positive answer releases
    // a claim: a 404 means Stripe has no such session, anything else means
    // Stripe did not answer.
    expect(route).not.toContain("retrieveCheckoutSession(env, claim.session_id).catch");
    expect(route).toContain("error?.status !== 404");
    expect(route).toContain("Could not confirm your existing checkout with Stripe");
  });

  it("reuses an outstanding trial session instead of issuing a second", () => {
    const route = readFileSync(
      new URL("../functions/api/checkout/hosted-vault.js", import.meta.url),
      "utf-8"
    );

    // A subscription lookup structurally cannot see a trial that has been
    // offered and not yet taken, because no subscription exists until a session
    // completes. The open session is the only object alive in that window, so
    // it is what the second request has to find.
    expect(route).toContain("findOutstandingTrialSession");
    // The condition gained the trial-configured gate, so match its stem.
    const at = route.indexOf("if (!hadTrialBefore");
    expect(at, "no outstanding-session check").toBeGreaterThan(-1);
    const block = route.slice(at, route.indexOf("const params", at));
    expect(block).toContain("findOutstandingTrialSession");
    expect(block).toContain("reused: true");

    // And it has to run before the session is built, not after.
    expect(at).toBeLessThan(route.indexOf("buildHostedVaultCheckoutParams({"));
  });

  it("finds an open trial session and ignores the ones that are not", async () => {
    const stub = (sessions: unknown[]) =>
      (async (url: URL | RequestInfo) => {
        expect(String(url)).toContain("status=open");
        expect(String(url)).toContain("customer=cus_1");
        return new Response(JSON.stringify({ data: sessions }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }) as typeof fetch;

    const env = { STRIPE_SECRET_KEY: "sk_test_x" };

    // A session without the trial stamp is somebody paying full price; reusing
    // it would be wrong, and so would refusing a trial because of it.
    await expect(
      findOutstandingTrialSession(env, "cus_1", stub([
        { id: "cs_paid", url: "https://checkout/paid", metadata: {} }
      ]))
    ).resolves.toBeNull();

    await expect(
      findOutstandingTrialSession(env, "cus_1", stub([
        { id: "cs_paid", url: "https://checkout/paid", metadata: {} },
        { id: "cs_trial", url: "https://checkout/trial", metadata: { trial_days: "14" } }
      ]))
    ).resolves.toMatchObject({ id: "cs_trial" });

    // trial_days "0" is a session built with the trial switched off.
    await expect(
      findOutstandingTrialSession(env, "cus_1", stub([
        { id: "cs_zero", url: "https://checkout/zero", metadata: { trial_days: "0" } }
      ]))
    ).resolves.toBeNull();

    // No customer means no session list to read, and no Stripe call either.
    await expect(
      findOutstandingTrialSession(env, null, (() => {
        throw new Error("must not call Stripe without a customer");
      }) as unknown as typeof fetch)
    ).resolves.toBeNull();
  });

  it("does not record a billing relationship that has not started", () => {
    const stripe = readFileSync(
      new URL("../functions/api/_lib/stripe.js", import.meta.url),
      "utf-8"
    );
    const at = stripe.indexOf("export async function resolveStripeCustomerId");
    expect(at, "no resolveStripeCustomerId").toBeGreaterThan(-1);
    const fn = stripe.slice(at, stripe.indexOf("\nexport ", at + 10));

    // /api/billing/portal returns 409 on the ABSENCE of a customers row, to
    // mean no billing relationship has ever existed. Somebody who opened
    // Checkout and walked away has not started one, so resolving a customer
    // here must not write that row. The billing webhook still does, on
    // completion.
    expect(fn).toContain("getStripeCustomerId");
    expect(fn).not.toContain("upsertCustomer");
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
