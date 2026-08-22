import { describe, expect, it } from "vitest";
import { createTestEnv, seedUser } from "./support/d1.js";
import { handleStripeEvent, upsertCustomer } from "../functions/api/_lib/stripe.js";
import { upsertUser } from "../functions/api/_lib/auth.js";
import { getSubscription, markVaultProgress, provisionVault } from "../functions/api/_lib/vault.js";

function subscriptionEvent({
  id,
  type = "customer.subscription.updated",
  created,
  status,
  userId = "clerk_1",
  periodEnd = 1800000000
}: {
  id: string;
  type?: string;
  created: number;
  status: string;
  userId?: string;
  periodEnd?: number | null;
}) {
  return {
    id,
    type,
    created,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status,
        metadata: { user_id: userId },
        items: { data: [{ price: { id: "price_1" }, current_period_end: periodEnd }] }
      }
    }
  };
}

// Wraps a D1 binding so the first prepare() matching `matchSql` throws once
// (simulating a transient D1 failure) and every call after that behaves
// normally. Used to prove an event is not marked "claimed" until its state
// write actually succeeds.
function failOnceOn(binding: any, matchSql: string) {
  let failed = false;
  return {
    prepare(sql: string) {
      if (!failed && sql.includes(matchSql)) {
        failed = true;
        return {
          bind() {
            return {
              async run() {
                throw new Error("simulated transient D1 failure");
              },
              async first() {
                throw new Error("simulated transient D1 failure");
              },
              async all() {
                throw new Error("simulated transient D1 failure");
              }
            };
          }
        };
      }
      return binding.prepare(sql);
    }
  };
}

describe("Stripe webhook state handling", () => {
  it("does not claim an event whose state write fails, so a retry can succeed", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);
    const event = subscriptionEvent({ id: "evt_flaky", created: 1000, status: "active" });

    const flakyEnv = { ...env, AUTOVAULT_DB: failOnceOn(env.AUTOVAULT_DB, "insert into subscriptions") };
    await expect(handleStripeEvent(flakyEnv, event)).rejects.toThrow("simulated transient D1 failure");

    // The write failed, so this must NOT be recorded as claimed -- otherwise
    // Stripe's retry hits `isStripeEventClaimed` and the subscription state
    // this event carried is permanently lost.
    const claimed = db.prepare("select count(*) as n from stripe_events where event_id = ?").get("evt_flaky") as { n: number };
    expect(claimed.n).toBe(0);

    // The retry, against the real (non-flaky) binding, must succeed.
    expect(await handleStripeEvent(env, event)).toEqual({ stored: true });
    expect((await getSubscription(env, "clerk_1")).active).toBe(true);
  });

  it("drops a same-timestamp conflicting event instead of letting arrival order decide", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // Two different events for the same subscription share a `created`
    // second -- Stripe's timestamp resolution can't tell them apart.
    await handleStripeEvent(env, subscriptionEvent({
      id: "evt_cancel_tie",
      type: "customer.subscription.deleted",
      created: 5000,
      status: "canceled"
    }));
    await handleStripeEvent(env, subscriptionEvent({
      id: "evt_active_tie",
      created: 5000,
      status: "active"
    }));

    // On a tie, the update is dropped -- arrival order must not decide access.
    const subscription = await getSubscription(env, "clerk_1");
    expect(subscription.status).toBe("canceled");
    expect(subscription.active).toBe(false);
  });

  it("still applies a same-timestamp cancellation that arrives after an active tie", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // Opposite arrival order from the test above. A blanket "drop every tie"
    // rule would fail this case: it would leave the account wrongly active
    // forever, because the genuine cancellation never gets applied.
    await handleStripeEvent(env, subscriptionEvent({ id: "evt_active_tie2", created: 6000, status: "active" }));
    await handleStripeEvent(env, subscriptionEvent({
      id: "evt_cancel_tie2",
      type: "customer.subscription.deleted",
      created: 6000,
      status: "canceled"
    }));

    const subscription = await getSubscription(env, "clerk_1");
    expect(subscription.status).toBe("canceled");
    expect(subscription.active).toBe(false);
  });

  it("applies an event once and ignores the redelivery", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);
    const event = subscriptionEvent({ id: "evt_1", created: 1000, status: "active" });

    expect(await handleStripeEvent(env, event)).toEqual({ stored: true });
    // Stripe retries on any non-2xx and also redelivers on its own schedule.
    expect(await handleStripeEvent(env, event)).toEqual({ stored: false, duplicate: true });

    const rows = db.prepare("select count(*) as n from stripe_events").get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it("does not let a stale 'active' event resurrect a cancelled subscription", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    // The cancellation is generated later but arrives first.
    await handleStripeEvent(env, subscriptionEvent({
      id: "evt_cancel",
      type: "customer.subscription.deleted",
      created: 2000,
      status: "canceled"
    }));
    expect((await getSubscription(env, "clerk_1")).active).toBe(false);

    // A delayed retry of the earlier "active" update now lands.
    await handleStripeEvent(env, subscriptionEvent({
      id: "evt_active",
      created: 1000,
      status: "active"
    }));

    const subscription = await getSubscription(env, "clerk_1");
    expect(subscription.status).toBe("canceled");
    expect(subscription.active).toBe(false);
  });

  it("still applies events that arrive in order", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);

    await handleStripeEvent(env, subscriptionEvent({ id: "evt_a", created: 1000, status: "active" }));
    expect((await getSubscription(env, "clerk_1")).active).toBe(true);

    await handleStripeEvent(env, subscriptionEvent({
      id: "evt_b",
      type: "customer.subscription.deleted",
      created: 2000,
      status: "canceled"
    }));
    expect((await getSubscription(env, "clerk_1")).active).toBe(false);
  });

  it("reads current_period_end from the subscription item", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);
    await handleStripeEvent(env, subscriptionEvent({ id: "evt_p", created: 1000, status: "active", periodEnd: 1899999999 }));

    const row = db.prepare("select current_period_end from subscriptions where user_id = ?").get("clerk_1") as { current_period_end: number };
    expect(row.current_period_end).toBe(1899999999);
  });

  it("falls back to the legacy top-level current_period_end", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);
    await handleStripeEvent(env, {
      id: "evt_legacy",
      type: "customer.subscription.updated",
      created: 1000,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          current_period_end: 1777777777,
          metadata: { user_id: "clerk_1" },
          items: { data: [{ price: { id: "price_1" } }] }
        }
      }
    });

    const row = db.prepare("select current_period_end from subscriptions where user_id = ?").get("clerk_1") as { current_period_end: number };
    expect(row.current_period_end).toBe(1777777777);
  });

  it("reassigns a Stripe customer to a new user without violating the unique index", async () => {
    const { db, env } = createTestEnv();
    seedUser(db, { id: "clerk_1", email: "jack@example.com" });
    seedUser(db, { id: "clerk_2", email: "other@example.com" });

    await upsertCustomer(env, { userId: "clerk_1", customerId: "cus_shared" });
    // customers.stripe_customer_id is UNIQUE; the upsert conflict-resolves on
    // user_id, so this used to raise an uncaught constraint error -> 500 ->
    // Stripe retrying the same 500 forever.
    await expect(upsertCustomer(env, { userId: "clerk_2", customerId: "cus_shared" })).resolves.toBe(true);

    const rows = db.prepare("select user_id from customers where stripe_customer_id = ?").all("cus_shared");
    expect(rows).toHaveLength(1);
    expect((rows[0] as { user_id: string }).user_id).toBe("clerk_2");
  });
});

describe("vault provisioning and progress", () => {
  const user = { id: "clerk_1", email: "jack@example.com", name: "Jack" };

  async function paidEnv() {
    const { db, env } = createTestEnv();
    seedUser(db);
    await handleStripeEvent(env, subscriptionEvent({ id: "evt_paid", created: 1000, status: "active" }));
    return { db, env };
  }

  it("is idempotent under concurrent provision requests", async () => {
    const { db, env } = await paidEnv();

    // Both calls read "no vault yet" before either writes.
    const [a, b] = await Promise.all([provisionVault(env, user), provisionVault(env, user)]);

    const rows = db.prepare("select id from vaults where user_id = ?").all("clerk_1");
    expect(rows).toHaveLength(1);
    expect(a.id).toBe(b.id);
    expect(a.id).toBe((rows[0] as { id: string }).id);
  });

  it("rejects an unpaid provision request with 402", async () => {
    const { db, env } = createTestEnv();
    seedUser(db);
    await expect(provisionVault(env, user)).rejects.toMatchObject({ status: 402 });
  });

  it("rejects inherited object keys as onboarding steps", async () => {
    const { env } = await paidEnv();
    await provisionVault(env, user);

    for (const step of ["__proto__", "constructor", "toString", "valueOf"]) {
      await expect(markVaultProgress(env, user, step)).rejects.toMatchObject({ status: 400 });
    }
    await expect(markVaultProgress(env, user, "nope")).rejects.toMatchObject({ status: 400 });
  });

  it("stamps a real onboarding step once and stays idempotent", async () => {
    const { env } = await paidEnv();
    await provisionVault(env, user);

    const first = await markVaultProgress(env, user, "cli_linked");
    expect(first.cli_linked_at).toBeTruthy();
    const second = await markVaultProgress(env, user, "cli_linked");
    expect(second.cli_linked_at).toBe(first.cli_linked_at);
  });
});

describe("user profile upserts", () => {
  it("keeps stored profile data when Clerk returns nothing", async () => {
    const { db, env } = createTestEnv();
    await upsertUser(env, "clerk", {
      providerUserId: "abc",
      email: "jack@example.com",
      name: "Jack",
      avatarUrl: "https://img.example/a.png"
    });

    // clerkProfile() degrades to all-nulls when the Clerk backend API fails,
    // and this upsert runs on every authenticated request. A plain assignment
    // would wipe the row.
    await upsertUser(env, "clerk", {
      providerUserId: "abc",
      email: null,
      name: null,
      avatarUrl: null
    });

    const row = db
      .prepare("select email, name, avatar_url from users where provider = ? and provider_user_id = ?")
      .get("clerk", "abc") as { email: string; name: string; avatar_url: string };
    expect(row.email).toBe("jack@example.com");
    expect(row.name).toBe("Jack");
    expect(row.avatar_url).toBe("https://img.example/a.png");
  });

  it("still applies real profile updates", async () => {
    const { db, env } = createTestEnv();
    await upsertUser(env, "clerk", { providerUserId: "abc", email: "old@example.com", name: "Old", avatarUrl: null });
    await upsertUser(env, "clerk", { providerUserId: "abc", email: "new@example.com", name: "New", avatarUrl: null });

    const row = db
      .prepare("select email, name from users where provider = ? and provider_user_id = ?")
      .get("clerk", "abc") as { email: string; name: string };
    expect(row.email).toBe("new@example.com");
    expect(row.name).toBe("New");
  });
});
