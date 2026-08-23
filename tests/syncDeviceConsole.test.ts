import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestEnv, seedUser } from "./support/d1.js";
import { createSession } from "../functions/api/_lib/auth.js";
import { onRequestGet as listDevices } from "../functions/api/vaults/current/devices.js";
import { onRequestPost as decideDevice } from "../functions/api/vaults/current/devices/[device].js";

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
  it("denies a never-admitted device by removing it, not by leaving a tombstone", async () => {
    // A pending row is a queue entry, not an access grant -- there is nothing
    // to revoke. Keeping it would also leak: denying frees a pending slot
    // while the row stays for ever, so spam-and-clear grows the list without
    // bound and the four-second poll carries all of it.
    const { db, env, cookie, vaultId } = await seedOwner();
    addDevice(db, vaultId, "device-1", KEY_A, "pending", "2026-08-23T01:00:00.000Z");

    const response = await decideDevice({
      request: req(cookie, "/api/vaults/current/devices/device-1", { action: "revoke" }),
      env,
      params: { device: "device-1" }
    });

    expect(response.status).toBe(200);
    expect((await response.json()).device.status).toBe("denied");
    expect(Number((db.prepare("select count(*) as n from sync_devices").get() as { n: number }).n)).toBe(0);
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

  it("bounds the list it returns on every poll", () => {
    const source = readFileSync(
      new URL("../functions/api/vaults/current/devices.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("MAX_LISTED_DEVICES");
    expect(source).toContain("limit ?");
    // Ordered pending-first, so the cap can only hide settled history and
    // never a device waiting on a decision.
    expect(source.indexOf("order by")).toBeLessThan(source.indexOf("limit ?"));
  });

  it("only polls while something is waiting on the owner", () => {
    // requireUser hits Clerk's getUser and upserts on every call, so a flat
    // four-second timer is ~900 profile fetches and 900 D1 writes per hour per
    // open tab on a dashboard where nothing is happening.
    expect(cloudPage).toContain('stage.value === "connect" || pendingDevices.value.length > 0');
    expect(cloudPage).toContain("watch(devicePollWanted");
    expect(cloudPage).toContain("else stopDevicePolling();");
  });
});
