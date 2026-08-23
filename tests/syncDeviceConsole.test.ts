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

async function seedOwner({ userId = "clerk_1", vaultId = "vault_1", slug = "demo-vault" } = {}) {
  const { db, env } = createTestEnv();
  seedUser(db, { id: userId });
  db.prepare(
    `insert into vaults (id, user_id, slug, status, public_url, created_at)
     values (?, ?, ?, 'reserved', ?, ?)`
  ).run(vaultId, userId, slug, `${ORIGIN}/v/${slug}`, new Date().toISOString());
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
