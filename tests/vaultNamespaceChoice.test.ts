import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createSession } from "../functions/api/_lib/auth.js";
import { handleStripeEvent } from "../functions/api/_lib/stripe.js";
import {
  provisionVault,
  RESERVED_VAULT_SLUGS,
  validateVaultSlug,
  VAULT_SLUG_MAX_LENGTH,
  vaultSlugForUser
} from "../functions/api/_lib/vault.js";
import { onRequestGet as namespaceAvailability } from "../functions/api/vaults/availability.js";
import { onRequestPost as provisionHostedVault } from "../functions/api/vaults/provision.js";
import { createTestEnv, seedUser } from "./support/d1.js";
import { pageDocs } from "../.vitepress/shared/pageDocs.js";

// Everything below runs against REAL SQLite with the repo's real migrations
// applied (tests/support/d1.ts), not against a hand-rolled fake. That is
// load-bearing for this feature specifically: the whole point is what happens
// when `vaults.slug text not null unique` is violated, and a fake that models
// upserts in JavaScript cannot violate a constraint it does not have.

const USER = { id: "clerk_1", email: "jack@example.com", name: "Jack" };

function paidSubscriptionEvent(userId = USER.id) {
  return {
    id: "evt_paid",
    type: "customer.subscription.updated",
    created: 1000,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        current_period_end: 1800000000,
        items: { data: [{ price: { id: "price_hosted_vault" } }] },
        metadata: { user_id: userId }
      }
    }
  };
}

async function paidEnv() {
  const { db, env } = createTestEnv();
  seedUser(db);
  await handleStripeEvent(env, paidSubscriptionEvent());
  const cookie = await createSession(new Request("https://autovault.dev"), env, USER.id);
  return { db, env, cookie };
}

function seedForeignVault(db: ReturnType<typeof createTestEnv>["db"], slug: string) {
  const now = new Date().toISOString();
  seedUser(db, { id: "clerk_2", email: "other@example.com", name: "Other" });
  db.prepare(
    `insert into vaults (id, user_id, slug, status, public_url, created_at, provisioned_at)
     values ('vault_other', 'clerk_2', ?, 'reserved', ?, ?, ?)`
  ).run(slug, `https://vault.autovault.dev/${slug}`, now, now);
}

function provisionRequest(cookie: string, body: Record<string, unknown>) {
  return new Request("https://autovault.dev/api/vaults/provision", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function availabilityRequest(slug: string, cookie?: string) {
  return new Request(`https://autovault.dev/api/vaults/availability?slug=${encodeURIComponent(slug)}`, {
    headers: cookie ? { cookie } : {}
  });
}

describe("namespace validation", () => {
  it("accepts the shapes a namespace is allowed to have", () => {
    for (const slug of ["jack", "auto-works", "team42", "a1b", "x".repeat(VAULT_SLUG_MAX_LENGTH)]) {
      expect(validateVaultSlug(slug), slug).toMatchObject({ ok: true, slug });
    }
  });

  it("normalises case and surrounding whitespace rather than refusing them", () => {
    // A slug is lowercase by definition -- the CLI errors on an uppercase one
    // with a "try the lowercase version" hint. Refusing "  Jack " here would be
    // pedantry; lowering it can only shrink the space of claimable names.
    expect(validateVaultSlug("  Jack ")).toMatchObject({ ok: true, slug: "jack" });
    // Which also means the denylist cannot be walked past with capitals.
    expect(validateVaultSlug("Admin")).toMatchObject({ ok: false, code: "reserved" });
  });

  it("refuses every shape that is not a namespace, with a reason for each", () => {
    const cases: Array<[unknown, string]> = [
      [undefined, "empty"],
      [null, "empty"],
      [42, "empty"],
      ["", "empty"],
      ["   ", "empty"],
      ["ab", "too_short"],
      ["x".repeat(VAULT_SLUG_MAX_LENGTH + 1), "too_long"],
      ["-jack", "invalid_characters"],
      ["jack-", "invalid_characters"],
      ["jack--son", "invalid_characters"],
      ["jack_son", "invalid_characters"],
      ["jack.son", "invalid_characters"],
      ["jack son", "invalid_characters"],
      ["jack/son", "invalid_characters"],
      ["jack%2f", "invalid_characters"],
      ["../etc", "invalid_characters"],
      ["jäck", "invalid_characters"],
      ["JACK!", "invalid_characters"]
    ];

    for (const [input, code] of cases) {
      const verdict = validateVaultSlug(input);
      expect(verdict.ok, String(input)).toBe(false);
      expect(verdict.code, String(input)).toBe(code);
      expect(verdict.message, String(input)).toBeTruthy();
    }
  });

  it("refuses every entry on the reserved list, and the brand prefix as a rule", () => {
    // Enumerated from the real list rather than a copy of it, so adding an
    // entry cannot quietly go untested. Pinned to the exact size, not a floor:
    // the count is quoted in the task report and in the commit message, and a
    // floor lets those drift out of date silently. Adding an entry is meant to
    // be a deliberate act with prose attached.
    //
    // 54 -> 55: "hosted-sync", added with the /hosted-sync docs page. The
    // derived-routes case below is what caught it. A customer holding that
    // slug would shadow a real route on this site.
    expect(RESERVED_VAULT_SLUGS.size).toBe(55);
    for (const reserved of RESERVED_VAULT_SLUGS) {
      const verdict = validateVaultSlug(reserved);
      expect(verdict.ok, reserved).toBe(false);
      // "_redirects" and "v" fail on shape before the list is consulted; both
      // are still unclaimable, which is the property that matters.
      expect(["reserved", "invalid_characters", "too_short"], reserved).toContain(verdict.code);
    }
    // The two categories the brief names, spelled out: a route collision and an
    // impersonation, each refused for the reserved reason rather than on shape.
    for (const reserved of ["api", "cloud", "skills", "catalog", "admin", "support", "official", "www"]) {
      expect(validateVaultSlug(reserved), reserved).toMatchObject({ ok: false, code: "reserved" });
    }
    // Brand protection is a prefix rule, not a list entry -- enumerating
    // "autovault-support", "autovault-official" and friends is a losing game.
    for (const slug of ["autovault", "autovault-support", "autovault-cloud", "autovault-1"]) {
      expect(validateVaultSlug(slug), slug).toMatchObject({ ok: false, code: "reserved" });
    }
    // But it must not swallow a legitimate name that merely starts with the
    // same letters.
    expect(validateVaultSlug("autovaulting")).toMatchObject({ ok: true });
  });

  it("reserves every route this site actually serves, derived not hand-listed", () => {
    // The list's own comment claims it is "sourced from the repo's root pages,
    // not guessed" -- but it was hand-maintained, and it drifted:
    // /author-autoworks-ai was missing, which is both a served page and the
    // first-party maintainer identity, so a customer could have claimed that
    // exact name. Deriving the expectation from pageDocs is what stops the list
    // silently falling behind the site again the next time a page is added.
    const missing = pageDocs
      .map((doc) => doc.route.replace(/^\//, "").split("/")[0])
      .filter((segment) => segment && !RESERVED_VAULT_SLUGS.has(segment));
    expect(missing).toEqual([]);
    // The one that drifted, named so this cannot regress quietly.
    expect(validateVaultSlug("author-autoworks-ai")).toMatchObject({ ok: false, code: "reserved" });
  });

  it("only accepts slugs the CLI can also resolve", () => {
    // CLOUD_SLUG_PATTERN in autovault's src/sync/target.ts. This rule has to be
    // a strict subset of it, or provisioning hands out names that
    // `autovault link` refuses -- which is the defect _lib/sync.js documents.
    const cliPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
    for (const slug of ["jack", "auto-works", "team42", "x".repeat(VAULT_SLUG_MAX_LENGTH)]) {
      expect(validateVaultSlug(slug).ok, slug).toBe(true);
      expect(cliPattern.test(slug), slug).toBe(true);
    }
  });
});

describe("the derived namespace stays a legal namespace", () => {
  it("truncates a long email local part instead of minting an untypeable slug", async () => {
    // The upstream defect functions/api/_lib/sync.js:74-82 describes as
    // "tracked separately": the base was never truncated, so a long address
    // produced a slug past the CLI's own 63-character cap and every sync route
    // 404'd for that vault. It now also has to hold because this value prefills
    // the namespace field.
    const slug = await vaultSlugForUser({ id: "clerk_long", email: `${"a".repeat(90)}@example.com` });
    expect(slug.length).toBeLessThanOrEqual(VAULT_SLUG_MAX_LENGTH);
    expect(validateVaultSlug(slug)).toMatchObject({ ok: true, slug });
  });

  it("does not suggest a name the field would immediately refuse", async () => {
    // An "autovault@" address slugifies to a base that trips the brand prefix
    // rule, so the derived slug would be born unclaimable and the prefill would
    // greet a first-time visitor with an error about a name they did not pick.
    const slug = await vaultSlugForUser({ id: "clerk_brand", email: "autovault@example.com" });
    expect(slug).toMatch(/^team-[a-f0-9]{6}$/);
    expect(validateVaultSlug(slug)).toMatchObject({ ok: true });

    // A reserved word plus the six-hex suffix is NOT reserved and does not need
    // to be: "admin-d002b5" is nobody's idea of an official AutoVault URL, and
    // refusing it would deny a legitimate address its own name.
    const adminish = await vaultSlugForUser({ id: "clerk_admin", email: "admin@example.com" });
    expect(adminish).toMatch(/^admin-[a-f0-9]{6}$/);
    expect(validateVaultSlug(adminish)).toMatchObject({ ok: true });
  });

  it("still derives the familiar <local-part>-<six hex> for an ordinary address", async () => {
    expect(await vaultSlugForUser(USER)).toMatch(/^jack-[a-f0-9]{6}$/);
  });
});

describe("provisioning with a requested namespace", () => {
  it("reserves the name the user asked for", async () => {
    const { db, env } = await paidEnv();
    const vault = await provisionVault(env, USER, "jacks-lab");

    expect(vault.slug).toBe("jacks-lab");
    expect(vault.public_url).toBe("https://vault.autovault.dev/jacks-lab");
    expect(db.prepare("select slug from vaults where user_id = ?").get(USER.id)).toEqual({ slug: "jacks-lab" });
  });

  it("falls back to the derived slug when nothing is requested", async () => {
    const { env } = await paidEnv();
    expect((await provisionVault(env, USER)).slug).toMatch(/^jack-[a-f0-9]{6}$/);
  });

  it("falls back rather than persisting a name that failed validation", async () => {
    // provisionVault is the library call, and its contract is that it never
    // writes a slug the validator would refuse. The HTTP boundary is stricter
    // (see the 400 tests below) because there is a person there to tell.
    for (const [id, requested] of [["clerk_1", "ADMIN"], ["clerk_1", "-nope-"], ["clerk_1", "ab"]] as const) {
      const { env } = await paidEnv();
      const vault = await provisionVault(env, { ...USER, id }, requested);
      expect(vault.slug, requested).toMatch(/^jack-[a-f0-9]{6}$/);
    }
  });

  it("refuses a name another vault already holds, cleanly", async () => {
    const { db, env } = await paidEnv();
    seedForeignVault(db, "jacks-lab");

    await expect(provisionVault(env, USER, "jacks-lab")).rejects.toMatchObject({ status: 409, code: "taken" });
    expect(db.prepare("select count(*) as n from vaults").get()).toEqual({ n: 1 });
  });
});

describe("the slug-collision race", () => {
  // The race Jack's design knowingly accepts: available when they looked,
  // claimed by somebody else before they clicked. The pre-check cannot close it
  // -- only the UNIQUE index can -- so what matters is that the index raising
  // produces a specific 409 rather than the uncaught 500 it used to.
  function blindToSlugLookups(env: Record<string, unknown>) {
    const real = env.AUTOVAULT_DB as { prepare: (sql: string) => unknown };
    env.AUTOVAULT_DB = {
      prepare(sql: string) {
        // Answer the availability pre-check "free" while the row genuinely
        // exists. That is precisely the state a real race puts the server in
        // between its SELECT and its INSERT, and it is the only way to drive
        // execution into the catch block on purpose.
        if (sql.includes("where slug = ?")) {
          return { bind: () => ({ first: async () => null }) };
        }
        return real.prepare(sql);
      }
    };
  }

  it("turns a real UNIQUE constraint violation into a 409, not a 500", async () => {
    const { db, env } = await paidEnv();
    seedForeignVault(db, "jacks-lab");
    blindToSlugLookups(env as unknown as Record<string, unknown>);

    // Real SQLite, real `vaults.slug` UNIQUE index, real thrown error.
    await expect(provisionVault(env, USER, "jacks-lab")).rejects.toMatchObject({ status: 409, code: "taken" });
    expect(db.prepare("select count(*) as n from vaults").get()).toEqual({ n: 1 });
  });

  it("surfaces that 409 through the HTTP handler rather than an unexpected error", async () => {
    const { db, env, cookie } = await paidEnv();
    seedForeignVault(db, "jacks-lab");
    blindToSlugLookups(env as unknown as Record<string, unknown>);

    const response = await provisionHostedVault({ request: provisionRequest(cookie, { slug: "jacks-lab" }), env });
    const payload = await response.json() as { error: string; code: string };

    expect(response.status).toBe(409);
    expect(payload.code).toBe("taken");
    expect(payload.error).toMatch(/already taken/i);
    // handleApi's catch-all. If the constraint error had escaped the classifier
    // this is what the user would have seen instead.
    expect(payload.error).not.toMatch(/unexpected/i);
  });

  it("re-mints rather than failing a user whose DERIVED slug was squatted", async () => {
    // Nobody can be asked to choose a different name when they never chose one,
    // so the fallback path retries with extra entropy instead of 409-ing.
    const { db, env } = await paidEnv();
    seedForeignVault(db, await vaultSlugForUser(USER));
    blindToSlugLookups(env as unknown as Record<string, unknown>);

    const vault = await provisionVault(env, USER);
    expect(vault.slug).toMatch(/^jack-[a-f0-9]{6}-[a-f0-9]{6}$/);
    expect(validateVaultSlug(vault.slug)).toMatchObject({ ok: true });
  });
});

describe("POST /api/vaults/provision", () => {
  it("passes a valid requested slug through from the body", async () => {
    const { env, cookie } = await paidEnv();
    const response = await provisionHostedVault({ request: provisionRequest(cookie, { slug: "jacks-lab" }), env });
    const payload = await response.json() as { vault: { slug: string } };

    expect(response.status).toBe(200);
    expect(payload.vault.slug).toBe("jacks-lab");
  });

  it("refuses a crafted request for a reserved name instead of quietly renaming it", async () => {
    // The security case: someone bypassing the UI must not be able to claim
    // "admin", and must not be told they succeeded either.
    const { db, env, cookie } = await paidEnv();
    const response = await provisionHostedVault({ request: provisionRequest(cookie, { slug: "admin" }), env });
    const payload = await response.json() as { error: string; code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe("reserved");
    expect(db.prepare("select count(*) as n from vaults").get()).toEqual({ n: 0 });
  });

  it("refuses a malformed slug with the reason, and writes nothing", async () => {
    const { db, env, cookie } = await paidEnv();
    for (const [slug, code] of [["-nope", "invalid_characters"], ["ab", "too_short"], ["x".repeat(80), "too_long"]] as const) {
      const response = await provisionHostedVault({ request: provisionRequest(cookie, { slug }), env });
      expect(response.status, slug).toBe(400);
      expect((await response.json() as { code: string }).code, slug).toBe(code);
    }
    expect(db.prepare("select count(*) as n from vaults").get()).toEqual({ n: 0 });
  });

  it("refuses an explicitly empty slug rather than deriving a permanent one", async () => {
    // Omitting `slug` means "no opinion" and legitimately derives. Sending one
    // that is present but unusable is an opinion the validator refuses, and
    // answering it with a silent permanent rename is the very outcome this
    // handler documents itself as preventing. The UI can no longer produce it,
    // but a crafted or stale client still can.
    const { db, env, cookie } = await paidEnv();
    for (const slug of ["", "   ", null, 42] as const) {
      const response = await provisionHostedVault({ request: provisionRequest(cookie, { slug }), env });
      expect(response.status, JSON.stringify(slug)).toBe(400);
      expect((await response.json() as { code: string }).code, JSON.stringify(slug)).toBe("empty");
    }
    expect(db.prepare("select count(*) as n from vaults").get()).toEqual({ n: 0 });
  });

  it("still derives a slug when the body omits one, so existing callers keep working", async () => {
    const { env, cookie } = await paidEnv();
    const response = await provisionHostedVault({
      request: new Request("https://autovault.dev/api/vaults/provision", { method: "POST", headers: { cookie } }),
      env
    });
    const payload = await response.json() as { vault: { slug: string } };

    expect(response.status).toBe(200);
    expect(payload.vault.slug).toMatch(/^jack-[a-f0-9]{6}$/);
  });
});

describe("GET /api/vaults/availability", () => {
  it("requires a session", async () => {
    // Slugs are public once they exist, but an open endpoint answering "does
    // this name exist" for arbitrary input enumerates the whole customer list,
    // and nothing rate-limits it. A session is the practical gate.
    const { env } = await paidEnv();
    const response = await namespaceAvailability({ request: availabilityRequest("jacks-lab"), env });

    expect(response.status).toBe(401);
    expect((await response.json() as { error: string }).error).toMatch(/authentication required/i);
  });

  it("reports a free name as available", async () => {
    const { env, cookie } = await paidEnv();
    const response = await namespaceAvailability({ request: availabilityRequest("jacks-lab", cookie), env });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ slug: "jacks-lab", available: true, code: "available" });
  });

  it("reports a name somebody else holds as taken", async () => {
    const { db, env, cookie } = await paidEnv();
    seedForeignVault(db, "jacks-lab");
    const response = await namespaceAvailability({ request: availabilityRequest("jacks-lab", cookie), env });

    expect(await response.json()).toMatchObject({ available: false, code: "taken" });
  });

  it("distinguishes 'not allowed' from 'already taken'", async () => {
    const { env, cookie } = await paidEnv();
    for (const [slug, code] of [["admin", "reserved"], ["-nope", "invalid_characters"], ["ab", "too_short"]] as const) {
      const response = await namespaceAvailability({ request: availabilityRequest(slug, cookie), env });
      const payload = await response.json() as { available: boolean; code: string; message: string };
      expect(payload.available, slug).toBe(false);
      expect(payload.code, slug).toBe(code);
      expect(payload.message, slug).toBeTruthy();
    }
  });

  it("gives the same verdict provisioning would, for the same input", async () => {
    // The brief's requirement, pinned: if this endpoint and the reserve click
    // ever disagreed, the field would greenlight a name the button then
    // refuses. They agree because both call validateVaultSlug -- this makes
    // that stay true.
    const { env, cookie } = await paidEnv();
    for (const slug of ["admin", "autovault-support", "-nope", "ab", "x".repeat(80), "jack.son"]) {
      const availability = await namespaceAvailability({ request: availabilityRequest(slug, cookie), env });
      const provision = await provisionHostedVault({ request: provisionRequest(cookie, { slug }), env });

      const availabilityPayload = await availability.json() as { code: string; message: string };
      const provisionPayload = await provision.json() as { code: string; error: string };

      expect(provision.status, slug).toBe(400);
      expect(provisionPayload.code, slug).toBe(availabilityPayload.code);
      expect(provisionPayload.error, slug).toBe(availabilityPayload.message);
    }
  });

  it("treats a missing slug parameter as an empty one rather than erroring", async () => {
    const { env, cookie } = await paidEnv();
    const response = await namespaceAvailability({
      request: new Request("https://autovault.dev/api/vaults/availability", { headers: { cookie } }),
      env
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: false, code: "empty" });
  });
});

describe("the namespace field in the funnel", () => {
  const funnel = readFileSync(
    new URL("../.vitepress/theme/components/HostedVaultFunnel.vue", import.meta.url),
    "utf-8"
  );

  it("renders at every pre-vault step, including the first one", () => {
    // Jack's ask verbatim: "I would like them to be able to enter a desired
    // namespace in the first step." Gated on `!vault` rather than on the
    // reserve step, so it is on screen from account creation through the click
    // that claims it.
    expect(funnel).toContain('<div v-if="!vault" class="hosted-namespace">');
    expect(funnel).toContain('id="hosted-namespace"');
    // And not by reusing either panel gate -- both are pinned as exactly
    // atReserveStep in cloudDashboardHonesty.test.ts.
    expect(funnel).toContain("const showSetupDetails = computed(() => atReserveStep.value);");
    expect(funnel).toContain("const showLocalHandoff = computed(() => atReserveStep.value);");
  });

  it("never suggests an empty namespace", () => {
    // clampSlug used to return "" for an email local part under three
    // characters. That is not "no opinion", it is three separate regressions:
    // syncNamespaceFromDraft reads "" as nothing to fill so the field never
    // prefills, the one-click default path disappears, and teamSlug collapses
    // hostedEndpoint to a bare origin -- which the local handoff card reads out
    // as the screen-reader transcript.
    expect(funnel).not.toContain('return clamped.length >= VAULT_SLUG_MIN_LENGTH ? clamped : "";');
    expect(funnel).toContain('return clamped.length >= VAULT_SLUG_MIN_LENGTH ? clamped : "your-team";');
  });

  it("says the choice is permanent, because it is", () => {
    // There is no rename path and there is not going to be one: enrolled
    // machines pin the slug.
    expect(funnel).toContain("cannot be changed later");
  });

  it("carries the choice through Stripe in the existing draft", () => {
    // One thing already survives checkout in this browser. A second storage key
    // would be a second thing to keep in sync.
    expect(funnel).toContain("desiredSlug");
    expect(funnel).toContain("readDraft()?.desiredSlug");
    expect(funnel.match(/const PENDING_DRAFT_KEY/g)?.length).toBe(1);
    expect(funnel).not.toMatch(/sessionStorage\.setItem\((?!PENDING_DRAFT_KEY)/);
  });

  it("carries a choice through Stripe, not the anonymous placeholder", () => {
    // A signed-out visitor is shown "your-team" -- a proposal, not a choice.
    // buildDraft stored it as `desiredSlug` on the account-creation click, and
    // syncNamespaceFromDraft preferred that stored value over the suggestion,
    // which only becomes personalised once Clerk supplies the email. So every
    // default signup reached checkout carrying "your-team": the first one to
    // reserve claims it permanently, and each later one is refused after paying
    // for a name nobody ever chose.
    expect(funnel).toContain('const desiredSlug = namespaceEdited.value ? namespaceSlug.value : "";');
    expect(funnel).toContain('const chosen = readDraft()?.desiredSlug || "";');
    expect(funnel).toContain("const next = chosen || namespaceSuggestion.value;");
    // Restoring a real choice re-marks it as one, so the suggestion cannot
    // overwrite it when /api/me lands and the next saveDraft still keeps it.
    expect(funnel).toContain("if (chosen) namespaceEdited.value = true;");
    // The unconditional preference for whatever was stored is what caused it.
    expect(funnel).not.toContain("readDraft()?.desiredSlug || namespaceSuggestion.value");
  });

  it("sends the chosen slug on the reserve click", () => {
    const fn = funnel.slice(funnel.indexOf("async function provisionVault"));
    expect(fn.slice(0, fn.indexOf("const payload"))).toContain("slug: namespaceSlug.value || undefined");
  });

  it("does not take money for a namespace it has already refused", () => {
    // The checkout button only tested `busy`, and startFlow never consulted the
    // verdict -- so a name the availability check had already refused (reserved,
    // taken, or malformed) could still be paid for, and the user found out at
    // the reserve click, after the charge.
    expect(funnel).toContain("const namespaceRefused = computed(");
    expect(funnel).toContain("const canCheckout = computed(() => canReserve.value && !namespaceRefused.value);");
    expect(funnel).toContain(':disabled="busy || !canCheckout"');
    // A stale verdict, about a string the user has since changed, gates nothing.
    expect(funnel).toContain("verdict.slug === namespaceSlug.value");

    const fn = funnel.slice(funnel.indexOf("async function startCheckout"));
    const head = fn.slice(0, fn.indexOf("checkoutStarted.value = true;"));
    expect(head).toContain("if (!canCheckout.value)");
    expect(head).toContain("focusNamespaceField()");

    // Reserve stays gated on shape only, on purpose: a lost race is the
    // server's to answer, and it does, with the 409 that lands on the field.
    expect(funnel).toContain(':disabled="busy || !canReserve"');
  });

  it("does not promise on the payment page what the funnel no longer does", () => {
    // wrangler.toml's Stripe submit text renders on the live Checkout page, so
    // it is read at the moment money changes hands. It said AutoVault reserves
    // the namespace "once Stripe confirms this subscription" -- true while
    // provisioning happened on the Stripe return, false now that reserving is a
    // deliberate click afterwards. The accepted check-then-claim race means the
    // name can even be gone by then, so this may promise the step, never the
    // outcome.
    const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf-8");
    const submit = wrangler.match(/^STRIPE_CHECKOUT_CUSTOM_TEXT_SUBMIT = "(.*)"$/m)?.[1];
    expect(submit).toBeTruthy();
    expect(submit).not.toMatch(/reserves your hosted namespace once/i);
    // A limitation still has to be stated here, but it is no longer the sync
    // one: hosted sync and the CLI handoff both shipped, so saying sync is
    // disabled is now the overclaim, in the other direction. What is still
    // true at the moment money changes hands is that publishing is manual.
    expect(submit).toMatch(/publishing/i);
    expect(submit).toMatch(/private beta/i);
    expect(submit).not.toMatch(/sync (remains|is) disabled|sync is not enabled/i);
    // ...and stating it may not tip into promising a publish path that does
    // not exist. There is no upload API and the CLI is a consumer only.
    expect(submit).not.toMatch(/publish your|upload your|push your/i);
    expect(submit).not.toMatch(/live vault|provisioned runtime/i);
    expect(submit).not.toMatch(/prototype mode/i);
  });

  it("refuses to reserve with no namespace rather than deriving one", () => {
    // Clearing the field left the button enabled, and the request then omits
    // `slug` -- which provisionVault reads as a legacy caller and answers with a
    // permanently derived `<local>-<six hex>`. The user would have reserved,
    // irreversibly, a name the field never showed, under a label that says it
    // cannot be changed later. That is the "arrived unbidden" defect this whole
    // change set exists to remove, re-entered through the back door.
    expect(funnel).toContain("const canReserve = computed(() => Boolean(namespaceSlug.value) && !localSlugProblem(namespaceSlug.value));");
    expect(funnel).toContain(':disabled="busy || !canReserve"');
    // The guard is on the call too, not only on the button.
    const fn = funnel.slice(funnel.indexOf("async function provisionVault"));
    const head = fn.slice(0, fn.indexOf("provisioning.value = true;"));
    expect(head).toContain("if (!canReserve.value)");
    expect(head).toContain("focusNamespaceField()");
  });

  it("forgets a namespace the user deleted instead of restoring it", () => {
    // buildDraft returns null once the field is empty and no skill is pasted,
    // and persistDraft simply returned -- leaving the previously typed slug in
    // sessionStorage. After the Stripe redirect remounted the component,
    // syncNamespaceFromDraft put that deleted name back and offered it for
    // permanent reservation.
    // One helper owns the stored namespace, and it touches only that field --
    // a skill pasted in the playground shares PENDING_DRAFT_KEY and is not this
    // component's to delete, so nothing here may drop the whole draft.
    const helper = funnel.slice(funnel.indexOf("function writeStoredSlug"), funnel.indexOf("function syncNamespaceFromDraft"));
    expect(helper).toContain("const stored = readDraft();");
    expect(helper).toContain("if (!stored) return;");
    expect(helper).toContain("delete next.desiredSlug;");
    expect(funnel).not.toContain("removeItem");

    // persistDraft alone is not enough: it only runs from startFlow, and the
    // reserve button is disabled while the field is empty -- so deleting a
    // namespace at the reserve step would never reach it at all. The edit
    // handler keeps storage in step directly.
    const input = funnel.slice(funnel.indexOf("function onNamespaceInput"), funnel.indexOf("function writeStoredSlug"));
    expect(input).toContain("writeStoredSlug(namespaceSlug.value);");
    const persist = funnel.slice(funnel.indexOf("function persistDraft"), funnel.indexOf("function buildDraft"));
    expect(persist).toContain('writeStoredSlug("")');
  });

  it("does not hand the next account the namespace this one just claimed", () => {
    // sessionStorage outlives a sign-out in the same tab, and nothing consumed
    // the stored slug once the vault existed. A second account signing in to
    // that tab was prefilled with the first one's claimed namespace, had it
    // marked as its own choice by syncNamespaceFromDraft, got it refused by the
    // availability check, and was then held out of checkout by the gate that
    // refuses an already-refused name.
    const fn = funnel.slice(funnel.indexOf("async function provisionVault"));
    const body = fn.slice(0, fn.indexOf("async function savePendingImport"));
    expect(body).toContain('writeStoredSlug("")');
    // After the vault is confirmed, not before -- the claim is what spends it.
    expect(body.indexOf('writeStoredSlug("")')).toBeGreaterThan(body.indexOf('emit("stateChange"'));
  });

  it("puts a refused name back on the field instead of reading as a crash", () => {
    const fn = funnel.slice(funnel.indexOf("async function provisionVault"));
    const branch = fn.indexOf("if (response.status === 400 || response.status === 409)");
    expect(branch).toBeGreaterThan(-1);
    const body = fn.slice(branch, branch + 600);
    expect(body).toContain("namespaceRefusal.value");
    expect(body).toContain("focusNamespaceField()");
    // A warn, not a fail: nothing broke and nothing was charged twice.
    expect(body).toContain('kind: "warn"');
  });

  it("debounces the availability check and drops stale answers", () => {
    // It fires while somebody types. Without a debounce that is a request per
    // keystroke; without a sequence guard a slow early answer overwrites a fast
    // later one and the field reports a verdict about a string that is no
    // longer in it.
    expect(funnel).toContain("NAMESPACE_CHECK_DELAY_MS");
    expect(funnel).toContain("clearTimeout(namespaceCheckTimer)");
    expect(funnel).toContain("if (seq !== namespaceCheckSeq) return;");
    // And an invalid shape never reaches the network -- it cannot become
    // available, so the round trip buys nothing.
    expect(funnel).toContain("if (!namespaceSlug.value || localSlugProblem(namespaceSlug.value) || !namespaceCheckReady.value) return;");
  });

  it("stops reporting a check that is no longer running", () => {
    // A non-2xx answer, or a fetch/JSON throw, left namespaceVerdict null and
    // cleared namespaceChecking in `finally`. The old single-line branch read a
    // missing verdict as a slug mismatch, so the field rendered "Checking
    // availability…" forever: a claim about the app's own state that was false,
    // with nothing in flight and no retry scheduled.
    expect(funnel).toContain("const namespaceCheckFailed = ref(false);");

    const computedStart = funnel.indexOf("const namespaceState = computed");
    const state = funnel.slice(computedStart, funnel.indexOf("function localSlugProblem", computedStart));
    expect(state).toContain('if (namespaceChecking.value) return { tone: "muted", text: "Checking availability…" };');
    expect(state).not.toContain("namespaceChecking.value || verdict?.slug !== slug");
    expect(state).toContain("namespaceCheckFailed.value");
    // Exactly one branch may say it is checking, and it is the one gated on an
    // actually-running check.
    expect(state.match(/Checking availability…/g)?.length).toBe(1);
    // The no-usable-verdict fall-through has to say something true instead.
    expect(state).toContain("if (!verdict || verdict.slug !== slug)");

    const checkStart = funnel.indexOf("async function runNamespaceCheck");
    const check = funnel.slice(checkStart, funnel.indexOf("function focusNamespaceField", checkStart));
    expect(check).toContain("namespaceCheckFailed.value = true;");
    // A stale failure must not land on the string the user has since typed.
    expect(check).toContain("if (seq === namespaceCheckSeq) namespaceCheckFailed.value = true;");

    const scheduleStart = funnel.indexOf("function scheduleNamespaceCheck");
    const schedule = funnel.slice(scheduleStart, checkStart);
    expect(schedule).toContain("namespaceCheckFailed.value = false;");
  });

  it("waits for the credential rather than firing a guaranteed 401", () => {
    // Observed in a browser against wrangler pages dev: gating on `signedIn`
    // fired the first check before Clerk had a token, because that computed
    // also trusts an /api/me that resolved first. One 401 per page load.
    expect(funnel).toContain("const namespaceCheckReady = computed(() => clerkAuthEnabled ? isClerkSignedIn.value : signedIn.value);");
  });

  it("does not mint a fresh Clerk token per keystroke", () => {
    // protectedAuthHeaders asks for `fresh: true`, which is right for an action
    // and wrong for a read that fires as you type.
    const fn = funnel.slice(funnel.indexOf("async function runNamespaceCheck"));
    const body = fn.slice(0, fn.indexOf("function focusNamespaceField"));
    // The call, not the word -- the comment above it explains the choice by
    // naming the helper it declines to use.
    expect(body).not.toContain("await protectedAuthHeaders(");
    expect(body).not.toContain("fresh: true");
    expect(body).toContain("await authHeaders(");
  });

  it("keeps the server authoritative and does not copy the reserved list client-side", () => {
    // Client validation is feedback. The reserved list lives in one place; a
    // second copy here would drift, and drift on this list is a security bug,
    // not a cosmetic one.
    for (const reserved of ["administrator", "postmaster", "skills-directory", "quick-start"]) {
      expect(funnel, reserved).not.toContain(`"${reserved}"`);
    }
    expect(funnel).toContain("the server re-validates everything");
  });
});
