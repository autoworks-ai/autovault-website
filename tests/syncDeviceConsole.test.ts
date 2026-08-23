import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestEnv, seedUser } from "./support/d1.js";
import { createSession } from "../functions/api/_lib/auth.js";
import { onRequestGet as listDevices } from "../functions/api/vaults/current/devices.js";
import { onRequestPost as decideDevice } from "../functions/api/vaults/current/devices/[device].js";
import { deviceFingerprint } from "../functions/api/_lib/sync.js";
import {
  admitHandshakeState,
  findAdmitTarget,
  readAdmitFingerprint,
  withAdmitParam
} from "../.vitepress/theme/utils/admit";

const ORIGIN = "https://autovault.dev";
const cloudPage = readFileSync(
  new URL("../.vitepress/theme/components/CloudPage.vue", import.meta.url),
  "utf-8"
);

const KEY_A = "DdiEpLBSOYMhWReWNz7t7Oh0BAgq6X0h2yb-wL4NJLw";
const KEY_B = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo";

async function seedOwner({
  userId = "clerk_1",
  vaultId = "vault_1",
  slug = "demo-vault",
  subscription = "active"
} = {}) {
  const { db, env } = createTestEnv();
  seedUser(db, { id: userId });
  db.prepare(
    `insert into vaults (id, user_id, slug, status, public_url, created_at)
     values (?, ?, ?, 'reserved', ?, ?)`
  ).run(vaultId, userId, slug, `${ORIGIN}/v/${slug}`, new Date().toISOString());
  if (subscription) {
    db.prepare(
      `insert into subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, price_id, current_period_end, created_at, updated_at)
       values (?, ?, ?, ?, 'price_hosted_vault', ?, ?, ?)`
    ).run(userId, `sub_${vaultId}`, `cus_${vaultId}`, subscription, 4102444800,
          new Date().toISOString(), new Date().toISOString());
  }
  const cookie = await createSession(new Request(ORIGIN), env, userId);
  return { db, env, cookie, vaultId, userId };
}

function addDevice(db: any, vaultId: string, id: string, publicKey: string, status: string, firstSeen: string) {
  db.prepare(
    `insert into sync_devices (id, vault_id, public_key, status, hostname, first_seen_at)
     values (?, ?, ?, ?, ?, ?)`
  ).run(id, vaultId, publicKey, status, null, firstSeen);
}

function deviceRow(db: any, id: string) {
  return db.prepare(
    "select status, admitted_at, revoked_at from sync_devices where id = ?"
  ).get(id) as { status: string; admitted_at: string | null; revoked_at: string | null };
}

function req(cookie: string, path: string, body?: unknown) {
  return new Request(`${ORIGIN}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("owner device console", () => {
  it("shows fingerprints, never whole public keys", async () => {
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    const response = await listDevices({ request: req(cookie, "/api/vaults/current/devices"), env });
    const payload = await response.json();

    expect(payload.devices[0].fingerprint).toBe("DdiE…NJLw");
    // The whole key is the device's identity. The console has no use for it,
    // and shipping it into a browser is gratuitous.
    expect(JSON.stringify(payload)).not.toContain(KEY_A);
  });

  it("puts devices waiting on a decision at the top", async () => {
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-active", KEY_A, "active", "2026-08-23T02:00:00.000Z");
    addDevice(db, vaultId, "device-pending", KEY_B, "pending", "2026-08-23T01:00:00.000Z");

    const response = await listDevices({ request: req(cookie, "/api/vaults/current/devices"), env });
    const payload = await response.json();

    // Pending is the only row that needs the owner to do something, so it
    // leads regardless of being older.
    expect(payload.devices.map((d: any) => d.id)).toEqual(["device-pending", "device-active"]);
  });

  it("still lists devices for an owner with no active subscription", async () => {
    // Deliberately not gated on billing. Someone whose subscription lapsed
    // still needs to see and revoke the machines holding their catalog --
    // taking that away is a security regression dressed as a paywall.
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "active", "2026-08-23T01:00:00.000Z");

    const response = await listDevices({ request: req(cookie, "/api/vaults/current/devices"), env });
    expect(response.status).toBe(200);
  });

  it("admits and revokes, and stamps when", async () => {
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    const admitted = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "admit" }),
      env,
      params: { device: "device-1" }
    });
    expect(admitted.status).toBe(200);
    let row = deviceRow(db, "device-1");
    expect(row.status).toBe("active");
    expect(row.admitted_at).toBeTruthy();

    const revoked = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "revoke" }),
      env,
      params: { device: "device-1" }
    });
    expect(revoked.status).toBe(200);
    row = deviceRow(db, "device-1");
    expect(row.status).toBe("revoked");
    expect(row.revoked_at).toBeTruthy();
  });

  it("will not un-revoke a device", async () => {
    // Revoking ends that key's access. Getting back in means re-linking from
    // the machine, which lands as a fresh pending row the owner can see --
    // rather than an admit click quietly undoing a security decision.
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "revoked", "2026-08-23T01:00:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "admit" }),
      env,
      params: { device: "device-1" }
    });

    expect(response.status).toBe(409);
    expect(deviceRow(db, "device-1").status).toBe("revoked");
  });

  it("cannot admit a device that belongs to somebody else's vault", async () => {
    // Device ids are server-generated but they travel through a CLI and a
    // browser. An id alone must never be enough.
    const { db, env, cookie } = await seedOwner();
    seedUser(db, { id: "clerk_2", email: "other@example.com" });
    db.prepare(
      `insert into vaults (id, user_id, slug, status, public_url, created_at)
       values ('vault_2', 'clerk_2', 'other-vault', 'reserved', ?, ?)`
    ).run(`${ORIGIN}/v/other-vault`, new Date().toISOString());
    addDevice(db, "vault_2", "device-theirs", KEY_B, "pending", "2026-08-23T01:00:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-theirs", { action: "admit" }),
      env,
      params: { device: "device-theirs" }
    });

    expect(response.status).toBe(404);
    expect(deviceRow(db, "device-theirs").status).toBe("pending");
  });

  it("rejects inherited property names, not just unknown ones", async () => {
    // ACTIONS[body.action] resolves `constructor`, `toString` and `__proto__`
    // to inherited Object properties, so a truthiness guard waves them past --
    // and action.stamp is then undefined, interpolated into the update's SET
    // clause. A request body should not be able to reach a SQL error.
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    for (const action of ["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"]) {
      const response = await decideDevice({
        request: req(cookie, "/api/vaults/current/devices/device-1", { action }),
        env,
        params: { device: "device-1" }
      });
      expect(response.status, action).toBe(400);
    }
    expect(deviceRow(db, "device-1").status).toBe("pending");
  });

  it("rejects an unknown action rather than guessing", async () => {
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");
    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "delete" }),
      env,
      params: { device: "device-1" }
    });
    expect(response.status).toBe(400);
  });

  it("refuses anonymous callers", async () => {
    const { env } = await seedOwner();
    const response = await listDevices({
      request: new Request(`${ORIGIN}/api/vaults/current/devices`),
      env
    });
    expect(response.status).toBe(401);
  });
});

describe("the honour-system checkbox is gone", () => {
  it("no longer offers a button that claims a CLI is linked", () => {
    // It wrote vaults.cli_linked_at and proved nothing: anyone could tick it
    // with no machine anywhere near the vault, and the dashboard would then
    // report a connected CLI.
    expect(cloudPage).not.toContain("I've linked my CLI");
    expect(cloudPage).not.toContain('markProgress("cli_linked")');
    expect(cloudPage).not.toContain("markProgress('cli_linked')");
    // markProgress survives for early access only.
    expect(cloudPage).toContain('async function markProgress(step: "early_access")');
  });

  it("derives 'linked' from an admitted device, not from a timestamp column", () => {
    expect(cloudPage).toContain("const cliLinked = computed(() => activeDevices.value.length > 0)");
    expect(cloudPage).not.toContain("Boolean(vault.value?.cli_linked_at)");
  });

  it("does not tell people linking succeeded when it ends pending", () => {
    // The replay used to finish on "✓ namespace linked successfully". Linking
    // ends PENDING and the CLI waits for an admit, so the tick taught people
    // to expect something that does not happen.
    expect(cloudPage).not.toContain("namespace linked successfully");
    expect(cloudPage).toContain("waiting for you to admit it below");
  });
});

describe("Skills and Sync log are real destinations now", () => {
  it("stops badging them as soon", () => {
    // Neither carries a "soon" badge any more. Skills reveals at explore
    // rather than connect -- see the nav-destination test below for why.
    expect(cloudPage).toContain('item("skills", "Skills", ICON.book, { revealAt: "explore", action: "preview" })');
    expect(cloudPage).toContain('action: "scroll-devices"');
    expect(cloudPage).not.toContain('item("skills", "Skills", ICON.book, { soon: true');
    expect(cloudPage).not.toContain('item("sync", "Sync log", ICON.sync, { soon: true');
    // Members stays soon: beta is pending/active/revoked devices, not roles.
    expect(cloudPage).toContain('item("members", "Members", ICON.users, { soon: true');
  });

  it("keeps the machines list reachable after the connect step", () => {
    // It started life inside the connect stage, so admitting the first device
    // advanced the stage and the list vanished -- leaving no way back to
    // revoke a machine. Sync log lands here, so it has to exist there too.
    const at = cloudPage.indexOf('ref="devicesCard"');
    expect(at).toBeGreaterThan(-1);
    expect(cloudPage.slice(at - 120, at + 60)).toContain('v-if="vault"');
    // And it must sit outside the stage-specific templates.
    const connectStage = cloudPage.indexOf("STAGE A: CONNECT");
    const exploreStage = cloudPage.indexOf("STAGE B: EXPLORE");
    expect(at).toBeGreaterThan(exploreStage);
    expect(connectStage).toBeGreaterThan(-1);
  });
});

describe("admission follows entitlement and current state", () => {
  it("refuses to admit a new machine on a lapsed subscription", async () => {
    // Admission is the grant, so it follows billing. Bundles are 402'd
    // separately, but a lapsed account should not be able to mint an active
    // device at all -- the dashboard would then report machines linked.
    const { db, env, cookie, vaultId } = await seedOwner({ subscription: "canceled" });
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "admit" }),
      env,
      params: { device: "device-1" }
    });

    expect(response.status).toBe(402);
    expect(deviceRow(db, "device-1").status).toBe("pending");
  });

  it("still lets a lapsed owner revoke", async () => {
    // The other direction stays open on purpose. Removing a machine from a
    // vault you can no longer pay for is exactly when you need it most.
    const { db, env, cookie, vaultId } = await seedOwner({ subscription: "canceled" });
    addDevice(db, vaultId, "device-1", KEY_A, "active", "2026-08-23T01:00:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "revoke" }),
      env,
      params: { device: "device-1" }
    });

    expect(response.status).toBe(200);
    expect(deviceRow(db, "device-1").status).toBe("revoked");
  });

  it("cannot admit a device that changed underneath the decision", async () => {
    // Two tabs: admit reads `pending`, revoke commits, then the admit writes
    // `active` over it and a revoked key has bundle access again. The update
    // is narrowed to the status that was read, so the loser changes nothing.
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    const request = req(cookie, "/api/vaults/current/devices/device-1", { action: "admit" });
    // Simulate the interleaving: the row moves on after the handler's read
    // would have happened.
    db.prepare("update sync_devices set status = 'revoked' where id = 'device-1'").run();

    const response = await decideDevice({ request, env, params: { device: "device-1" } });

    // Caught by the revoked guard here; the conditional update is the backstop
    // for the interleaving that slips past it.
    expect([409]).toContain(response.status);
    expect(deviceRow(db, "device-1").status).toBe("revoked");
  });

  it("narrows the write to the status it read", () => {
    const source = readFileSync(
      new URL("../functions/api/vaults/current/devices/[device].js", import.meta.url),
      "utf-8"
    );
    // The guard above is a check-then-act; without this the write is
    // unconditional and the loser of the race silently wins.
    expect(source).toContain("and status = ?");
    expect(source).toContain("result?.meta?.changes");
  });
});

describe("nav items only enable once their destination exists", () => {
  it("keeps Skills locked until the card it scrolls to is rendered", () => {
    // previewCard only exists inside the explore/ready template, so enabling
    // Skills at connect gave a live-looking nav item that did nothing.
    expect(cloudPage).toContain('item("skills", "Skills", ICON.book, { revealAt: "explore", action: "preview" })');
    // Sync log's target renders wherever a vault does, so connect is right.
    expect(cloudPage).toContain('{ revealAt: "connect", action: "scroll-devices" }');
  });

  it("invalidates an in-flight device list when the vault goes away", () => {
    // Otherwise a response for the previous vault repopulates the list and a
    // dashboard with no vault claims machines are linked.
    const at = cloudPage.indexOf("if (!vaultId) {");
    expect(at).toBeGreaterThan(-1);
    expect(cloudPage.slice(at, at + 420)).toContain("devicesRequestSeq += 1;");
  });
});

describe("the console does not cost more than it is worth", () => {
  it("leaves a tombstone when denying, so the waiting machine hears about it", async () => {
    // Deleting the row outright is the obvious way to stop denied devices
    // accumulating, and it breaks the machine on the other end: `autovault
    // link` polls devices/current, and a missing row 404s, so the CLI dumps a
    // raw HTTP error instead of its clean "device was revoked" exit.
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "revoke" }),
      env,
      params: { device: "device-1" }
    });

    expect(response.status).toBe(200);
    expect(deviceRow(db, "device-1").status).toBe("revoked");
    // And the pending slot is freed, since the cap counts `pending`.
    expect(
      Number((db.prepare("select count(*) as n from sync_devices where status='pending'").get() as { n: number }).n)
    ).toBe(0);
  });

  it("prunes old denied tombstones so spam-and-clear cannot grow the table", async () => {
    // Denying frees a pending slot, so without a bound a spam-and-clear loop
    // accumulates rows for ever -- which is the growth this whole thread is
    // about. Only never-admitted rows are pruned.
    const { db, env, cookie, vaultId } = await seedOwner();
    for (let index = 0; index < 40; index += 1) {
      db.prepare(
        `insert into sync_devices (id, vault_id, public_key, status, first_seen_at)
         values (?, ?, ?, 'revoked', ?)`
      ).run(`old-${index}`, vaultId, `old-key-${index}`, `2026-08-0${(index % 9) + 1}T01:00:00.000Z`);
    }
    // A genuinely admitted-then-revoked device must survive the prune: that
    // row is a security record, not queue litter.
    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, first_seen_at, admitted_at)
       values ('real-device', ?, 'real-key', 'revoked', '2026-08-01T00:00:00.000Z', '2026-08-01T00:05:00.000Z')`
    ).run(vaultId);
    addDevice(db, vaultId, "device-new", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-new", { action: "revoke" }),
      env,
      params: { device: "device-new" }
    });

    const denied = Number((db.prepare(
      "select count(*) as n from sync_devices where status='revoked' and admitted_at is null"
    ).get() as { n: number }).n);
    expect(denied).toBeLessThanOrEqual(25);
    expect(deviceRow(db, "real-device").status).toBe("revoked");
  });

  it("keeps the row when revoking a device that WAS admitted", async () => {
    // Here the tombstone is the point: it blocks the key, and it is how the
    // CLI hears "revoked" and exits rather than sitting in its spinner.
    const { db, env, cookie, vaultId } = await seedOwner();
    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, first_seen_at, admitted_at)
       values ('device-1', ?, ?, 'active', ?, ?)`
    ).run(vaultId, KEY_A, "2026-08-23T01:00:00.000Z", "2026-08-23T01:05:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "revoke" }),
      env,
      params: { device: "device-1" }
    });

    expect(response.status).toBe(200);
    expect(deviceRow(db, "device-1").status).toBe("revoked");
  });

  it("never caps live devices, only settled history", async () => {
    // A single capped query starts omitting the oldest ACTIVE rows once live
    // devices exceed the cap -- and this response is the console's only source
    // of device ids and revoke controls, so those keys become unrevocable
    // through the UI. Whatever a cap does, it must not make a key harder to
    // take away.
    const { db, env, cookie, vaultId } = await seedOwner();
    for (let index = 0; index < 120; index += 1) {
      db.prepare(
        `insert into sync_devices (id, vault_id, public_key, status, first_seen_at, admitted_at)
         values (?, ?, ?, 'active', ?, ?)`
      ).run(`active-${index}`, vaultId, `active-key-${index}`,
            `2026-08-01T00:00:00.000Z`, `2026-08-01T00:05:00.000Z`);
    }

    const payload = await (await listDevices({ request: req(cookie, "/api/vaults/current/devices"), env })).json();
    const activeIds = payload.devices.filter((d: any) => d.status === "active").map((d: any) => d.id);
    expect(activeIds).toHaveLength(120);
    expect(activeIds).toContain("active-0");
  });

  it("still bounds settled history", async () => {
    const { db, env, cookie, vaultId } = await seedOwner();
    for (let index = 0; index < 150; index += 1) {
      db.prepare(
        `insert into sync_devices (id, vault_id, public_key, status, first_seen_at)
         values (?, ?, ?, 'revoked', ?)`
      ).run(`gone-${index}`, vaultId, `gone-key-${index}`, "2026-08-01T00:00:00.000Z");
    }
    const payload = await (await listDevices({ request: req(cookie, "/api/vaults/current/devices"), env })).json();
    expect(payload.devices.filter((d: any) => d.status === "revoked").length).toBeLessThanOrEqual(100);
  });

  it("throttles polling but never stops it", () => {
    // Stopping when nothing is pending is the obvious optimisation and it is
    // wrong: a SECOND machine running `autovault link` creates a pending row
    // that only polling can discover, so the condition would gate on the very
    // thing it exists to find. The owner would sit looking at a dashboard that
    // never mentions the machine waiting on them.
    expect(cloudPage).toContain("DEVICE_POLL_ACTIVE_MS = 4000");
    expect(cloudPage).toContain("DEVICE_POLL_IDLE_MS = 30_000");

    // Each term asserted on its own rather than as one source line: the
    // condition has grown a third case (an inbound `?admit=` machine) and will
    // grow more. Pinning the exact formatting only guards the layout, and
    // reflowing it would look like a failure while dropping `pendingDevices`
    // -- the case this test exists for -- would not.
    const urgentAt = cloudPage.indexOf("const devicePollUrgent");
    const urgent = cloudPage.slice(urgentAt, cloudPage.indexOf(");", urgentAt));
    expect(urgentAt).toBeGreaterThan(-1);
    expect(urgent).toContain('stage.value === "connect"');
    expect(urgent).toContain("pendingDevices.value.length > 0");

    // The idle branch must still schedule a timer, not clear one.
    const at = cloudPage.indexOf("function startDevicePolling");
    const body = cloudPage.slice(at, at + 600);
    expect(body).toContain("devicePollUrgent.value ? DEVICE_POLL_ACTIVE_MS : DEVICE_POLL_IDLE_MS");
    expect(body).toContain("setInterval");
  });
});

describe("the tombstone survives its own pruning", () => {
  it("keeps the device just denied, even when it enrolled long ago", async () => {
    // first_seen_at is enrollment time. A machine that sat pending for a while
    // and is then denied looks old the instant its tombstone is written, so
    // ordering the prune by it deletes the row by its own denial -- handing
    // that machine's CLI the 404 the tombstone exists to prevent, and freeing
    // the key to enrol again.
    const { db, env, cookie, vaultId } = await seedOwner();
    for (let index = 0; index < 30; index += 1) {
      db.prepare(
        `insert into sync_devices (id, vault_id, public_key, status, first_seen_at, revoked_at)
         values (?, ?, ?, 'revoked', ?, ?)`
      ).run(`recent-${index}`, vaultId, `recent-key-${index}`,
            "2026-08-22T00:00:00.000Z", "2026-08-22T00:00:00.000Z");
    }
    // Enrolled before every one of those, denied after all of them.
    addDevice(db, vaultId, "old-pending", KEY_A, "pending", "2026-01-01T00:00:00.000Z");

    await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/old-pending", { action: "revoke" }),
      env,
      params: { device: "old-pending" }
    });

    const row = db.prepare("select status from sync_devices where id = 'old-pending'").get() as
      { status: string } | undefined;
    expect(row?.status).toBe("revoked");
  });
});

describe("polls do not trip over each other", () => {
  it("skips a tick while a request is still in flight", () => {
    // Every call bumps devicesRequestSeq, so an overlapping poll invalidates
    // the one already running. Above the poll interval that means every
    // response is superseded before it lands: the list never updates, a
    // pending machine never appears, and the backend carries all of it.
    const at = cloudPage.indexOf("devicePollTimer = setInterval");
    expect(at).toBeGreaterThan(-1);
    expect(cloudPage.slice(at, at + 700)).toContain("if (deviceLoadInFlight) return;");
    // The flag has to clear on the failure path too, or one error stops
    // polling for the life of the page.
    const load = cloudPage.indexOf("async function loadDevices");
    const body = cloudPage.slice(load, cloudPage.indexOf("function stopDevicePolling", load));
    expect(body).toContain("finally {");
    expect(body).toContain("deviceLoadInFlight = false;");
  });
});

describe("one snapshot, and no claims about a vault that is not there", () => {
  it("reads live devices and history in a single statement", () => {
    // Two queries meant another tab revoking between them put the same id in
    // both halves -- once stale, once revoked -- so the console rendered
    // duplicate v-for keys and offered a revoke control for a device already
    // gone. One statement is one snapshot.
    const source = readFileSync(
      new URL("../functions/api/vaults/current/devices.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("union all");
    // Exactly one round trip.
    expect(source.split("await all(env").length - 1).toBe(1);
    // And the union must not reintroduce the cap on live rows.
    const live = source.slice(source.indexOf("select id"), source.indexOf("union all"));
    expect(live).not.toContain("limit");
  });

  it("returns no duplicate ids even with a device in both halves", async () => {
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-a", KEY_A, "active", "2026-08-23T01:00:00.000Z");
    addDevice(db, vaultId, "device-b", KEY_B, "revoked", "2026-08-23T00:00:00.000Z");

    const payload = await (await listDevices({ request: req(cookie, "/api/vaults/current/devices"), env })).json();
    const ids = payload.devices.map((d: any) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Live still leads.
    expect(ids[0]).toBe("device-a");
  });

  it("does not report machine state when there is no vault", () => {
    // Signed out, mid-checkout, or after a failed load there is no vault whose
    // device state is known -- and "No machines linked yet" states a fact
    // about one that may not exist.
    const at = cloudPage.indexOf("No machines linked yet");
    expect(at).toBeGreaterThan(-1);
    expect(cloudPage.slice(at - 200, at)).toContain('v-else-if="vault"');
  });
});

// ---------------------------------------------------------------------------
// The CLI admit handshake: /cloud?admit=<url-encoded fingerprint>
//
// `autovault link` enrols, prints the fingerprint, and opens this URL. The page
// selects the row; the owner still clicks Admit. Everything here guards one of
// those two halves -- that the right row is selected, and that selection never
// becomes admission.
// ---------------------------------------------------------------------------

const clerkAuthControls = readFileSync(
  new URL("../.vitepress/theme/components/ClerkAuthControls.vue", import.meta.url),
  "utf-8"
);

function pending(publicKey: string, id: string) {
  return { id, fingerprint: deviceFingerprint(publicKey), status: "pending" };
}

describe("the admit link selects a machine", () => {
  it("derives the fingerprint the CLI prints, U+2026 and all", () => {
    // Pinned against the CLI's own deviceFingerprint (src/sync/target.ts). If
    // these ever diverge the URL still parses and simply matches nothing, so
    // the handshake fails silently -- which is exactly why it is asserted.
    expect(deviceFingerprint(KEY_A)).toBe("DdiE…NJLw");
    expect(encodeURIComponent(deviceFingerprint(KEY_A))).toBe("DdiE%E2%80%A6NJLw");
  });

  it("selects the matching pending device and not a sibling", () => {
    const devices = [pending(KEY_B, "device-b"), pending(KEY_A, "device-a")];
    const fingerprint = readAdmitFingerprint("?admit=DdiE%E2%80%A6NJLw");

    expect(fingerprint).toBe("DdiE…NJLw");
    expect(findAdmitTarget(devices, fingerprint)?.id).toBe("device-a");
    expect(admitHandshakeState(devices, fingerprint)).toBe("ready");
  });

  it("selects nothing when the fingerprint is unknown", () => {
    // Never fall back to "the one that is waiting". With two machines pending,
    // guessing hands vault access to the box the owner did not mean.
    const devices = [pending(KEY_A, "device-a"), pending(KEY_B, "device-b")];
    const fingerprint = readAdmitFingerprint("?admit=Zzzz%E2%80%A6zzzz");

    expect(findAdmitTarget(devices, fingerprint)).toBeNull();
    expect(admitHandshakeState(devices, fingerprint)).toBe("waiting");
  });

  it("selects nothing when there is no admit param at all", () => {
    const devices = [pending(KEY_A, "device-a")];

    expect(readAdmitFingerprint("")).toBeNull();
    expect(readAdmitFingerprint("?hosted=success")).toBeNull();
    expect(findAdmitTarget(devices, readAdmitFingerprint("?hosted=success"))).toBeNull();
    expect(admitHandshakeState(devices, null)).toBe("idle");
  });

  it("will not select a device that is already admitted or denied", () => {
    // A settled row is not an error and must not re-arm the waiting state --
    // otherwise the page nags forever about a machine it already let in.
    const fingerprint = deviceFingerprint(KEY_A);
    for (const status of ["active", "revoked"]) {
      const devices = [{ id: "device-a", fingerprint, status }];
      expect(findAdmitTarget(devices, fingerprint)).toBeNull();
      expect(admitHandshakeState(devices, fingerprint)).toBe("settled");
    }
  });

  it("stops polling fast for an admit link that matches nothing", () => {
    // A stale, malformed, or wrong-account ?admit= never matches a row, so
    // `waiting` would be permanent and the four-second poll would run for the
    // life of the tab. /api/vaults/current/devices does a Clerk profile lookup
    // per call, so that is ~900 requests an hour that cannot ever succeed.
    expect(cloudPage).toContain("ADMIT_WAIT_BUDGET_MS = 120_000");

    const urgentAt = cloudPage.indexOf("const devicePollUrgent");
    const urgent = cloudPage.slice(urgentAt, cloudPage.indexOf(");", urgentAt));
    expect(urgent).toContain('admitState.value === "waiting" && !admitWaitExpired.value');

    // Reset, not latched: a row arriving after the budget still gets the full
    // scroll-highlight-focus treatment.
    expect(cloudPage).toContain("admitWaitExpired.value = false;");
    // And the timer is cleaned up rather than left to fire into a dead page.
    expect(cloudPage).toContain("onBeforeUnmount(clearAdmitWaitTimer)");
  });

  it("says so instead of spinning forever", () => {
    // A spinner that never resolves is worse than an answer. Asserted on the
    // branch and its stable phrases rather than the rendered sentence, whose
    // line breaks are template indentation and would fail on a reflow.
    expect(cloudPage).toContain('v-if="admitWaitExpired"');
    expect(cloudPage).toContain("No machine matching");
    expect(cloudPage).toContain("run");
    expect(cloudPage).toContain("there again.");
    expect(cloudPage).toContain(".cv-devices-waiting.stalled .cv-dot");
  });

  it("waits quietly for a row that has not arrived yet", () => {
    // The CLI enrols and *then* opens the browser, so an empty list on the
    // first fetch is the normal path through this code.
    expect(admitHandshakeState([], deviceFingerprint(KEY_A))).toBe("waiting");
    expect(cloudPage).toContain("admitState === 'waiting'");
    expect(cloudPage).toContain("to check in…");
  });
});

describe("the admit link survives sign-in", () => {
  it("keeps admit= on the Clerk return URL, ahead of the fragment", () => {
    const returnPath = withAdmitParam("/cloud#launch-path", "?admit=DdiE%E2%80%A6NJLw");

    expect(returnPath).toBe("/cloud?admit=DdiE%E2%80%A6NJLw#launch-path");
    // #launch-path is load-bearing: Stripe's success_url and the Clerk
    // post-auth redirect both target it.
    expect(returnPath.endsWith("#launch-path")).toBe(true);
  });

  it("leaves the return URL alone when no handshake is in progress", () => {
    expect(withAdmitParam("/cloud#launch-path", "")).toBe("/cloud#launch-path");
    expect(withAdmitParam("/cloud#launch-path", "?hosted=success")).toBe("/cloud#launch-path");
  });

  it("wires that through the sign-in buttons rather than a bare constant", () => {
    // Every Clerk redirect prop on this component reads authReturnPath, so
    // fixing it in one place covers sign-in, sign-up and their fallbacks.
    expect(clerkAuthControls).toContain("withAdmitParam(clerkBrand.cloudPath, window.location.search)");
    expect(clerkAuthControls).toContain(':force-redirect-url="authReturnPath"');
    expect(clerkAuthControls).toContain(':fallback-redirect-url="authReturnPath"');
  });
});

describe("selecting a machine is not admitting it", () => {
  it("never calls decideDevice from the admit handshake", () => {
    // The whole safety property in one assertion. If the URL could admit, then
    // the link the CLI prints -- and anything that copies it -- becomes a
    // credential that grants a machine access to the vault on page load.
    const at = cloudPage.indexOf("const admitFingerprint");
    expect(at).toBeGreaterThan(-1);
    const handshake = cloudPage.slice(at, cloudPage.indexOf("const devicePollUrgent"));

    expect(handshake).not.toContain("decideDevice");
    expect(handshake).not.toContain("'admit'");
  });

  it("only ever reaches admit through a click on the owner's own button", () => {
    // decideDevice(..., "admit") must have exactly one call site, and it must
    // be the @click on the Admit button.
    const calls = cloudPage.match(/decideDevice\([^)]*'admit'\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(cloudPage).toContain("@click=\"decideDevice(device.id, 'admit')\"");
  });

  it("does not admit on mount", () => {
    const at = cloudPage.indexOf("onMounted(() => {");
    const mount = cloudPage.slice(at, at + 500);

    expect(mount).toContain("readAdmitFingerprint");
    expect(mount).not.toContain("decideDevice");
  });

  it("focuses the target row once per machine, not once per poll", () => {
    // The list reloads every four seconds while this page is open; re-stealing
    // focus on each response would trap the keyboard on the Admit button.
    expect(cloudPage).toContain("admitFocusedId");
    expect(cloudPage).toContain("if (!deviceId || admitFocusedId === deviceId) return;");
  });
});
