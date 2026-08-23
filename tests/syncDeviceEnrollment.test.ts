import { describe, expect, it } from "vitest";
import { createTestEnv, seedUser } from "./support/d1.js";
import {
  DEVICE_TIMESTAMP_SKEW_SECONDS,
  deviceFingerprint,
  verifyDeviceSignature
} from "../functions/api/_lib/sync.js";
import { onRequestPost as enrollDevice } from "../functions/v/[slug]/devices.js";
import { onRequestGet as deviceStatus } from "../functions/v/[slug]/devices/current.js";
import { onRequestGet as readCatalog } from "../functions/v/[slug]/catalog.json.js";
import { onRequestGet as readBundle } from "../functions/v/[slug]/bundles/[bundle].js";
import { onRequest as siteMiddleware } from "../functions/_middleware.js";

const ORIGIN = "https://autovault.dev";
const SLUG = "demo-vault";

function kv(entries: Record<string, string> = {}) {
  const store = new Map(Object.entries(entries));
  const reads: string[] = [];
  return {
    reads,
    async get(key: string) {
      reads.push(key);
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    _store: store
  };
}

function deviceRowCount(db: any): number {
  return Number((db.prepare("select count(*) as n from sync_devices").get() as { n: number }).n);
}

function seedVault(db: any, { vaultId = "vault_1", userId = "clerk_1", slug = SLUG } = {}) {
  seedUser(db, { id: userId });
  db.prepare(
    `insert into vaults (id, user_id, slug, status, public_url, created_at)
     values (?, ?, ?, 'reserved', ?, ?)`
  ).run(vaultId, userId, slug, `${ORIGIN}/v/${slug}`, new Date().toISOString());
  return vaultId;
}

async function newDeviceKey() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { pair, publicKey: Buffer.from(raw).toString("base64url") };
}

async function signedRequest(
  device: { pair: CryptoKeyPair; publicKey: string },
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; timestamp?: string; signPath?: string } = {}
) {
  const url = new URL(path, ORIGIN);
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const message = `${method}\n${options.signPath ?? url.pathname}\n${timestamp}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, device.pair.privateKey, new TextEncoder().encode(message))
  );
  return new Request(url, {
    method,
    headers: {
      "x-autovault-device": device.publicKey,
      "x-autovault-timestamp": timestamp,
      "x-autovault-signature": Buffer.from(signature).toString("base64url"),
      ...(options.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
}

describe("device signature verification", () => {
  it("accepts a signature produced by the CLI's own library", async () => {
    // Fixture generated with tweetnacl -- the exact library sync/contract.ts
    // signs with -- and verified here through WebCrypto. The two must agree on
    // raw ed25519 and on base64url, and nothing else in this suite proves that
    // because every other signature here is made by WebCrypto too.
    const publicKey = "DdiEpLBSOYMhWReWNz7t7Oh0BAgq6X0h2yb-wL4NJLw";
    const signature = "5-qGIXdp9RI0i3jnqJZcVHa1JPsMjrZvQEZoYax74_E-MlJ_637hjPet8RQevXc11ttJsEq18xhsKYRACXUPDw";
    const message = "GET\n/v/demo/catalog.json\n1756000000";

    expect(await verifyDeviceSignature(publicKey, message, signature)).toBe(true);
    expect(await verifyDeviceSignature(publicKey, `${message} `, signature)).toBe(false);
  });

  it("renders the fingerprint the way the CLI prints it", () => {
    // cli/link.ts shows `ed25519 <first4>…<last4>`; the owner reads that off
    // the terminal and matches it against the console. A different
    // abbreviation makes the two unmatchable, which is the whole job.
    expect(deviceFingerprint("DdiEpLBSOYMhWReWNz7t7Oh0BAgq6X0h2yb-wL4NJLw")).toBe("DdiE…NJLw");
  });
});

describe("device enrollment", () => {
  it("creates a pending device and is idempotent on re-link", async () => {
    const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: kv() });
    seedVault(db);
    const device = await newDeviceKey();

    const first = await enrollDevice({
      request: await signedRequest(device, "POST", `/v/${SLUG}/devices`, { body: { public_key: device.publicKey } }),
      env,
      params: { slug: SLUG }
    });
    expect(first.status).toBe(200);
    const enrolled = await first.json();
    expect(enrolled.status).toBe("pending");
    expect(enrolled.device_id).toMatch(/^device-/);

    // `autovault link` run twice must not pile up rows, and must report the
    // same device_id -- the CLI polls devices/current expecting that id.
    const second = await enrollDevice({
      request: await signedRequest(device, "POST", `/v/${SLUG}/devices`, { body: { public_key: device.publicKey } }),
      env,
      params: { slug: SLUG }
    });
    expect(await second.json()).toEqual(enrolled);
    expect(deviceRowCount(db)).toBe(1);
  });

  it("refuses a body that names a key the request was not signed with", async () => {
    const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: kv() });
    seedVault(db);
    const device = await newDeviceKey();
    const other = await newDeviceKey();

    const response = await enrollDevice({
      request: await signedRequest(device, "POST", `/v/${SLUG}/devices`, { body: { public_key: other.publicKey } }),
      env,
      params: { slug: SLUG }
    });

    // Otherwise a caller enrols a key it cannot sign for.
    expect(response.status).toBe(400);
    expect(deviceRowCount(db)).toBe(0);
  });

  it("does not resurrect a revoked device", async () => {
    const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: kv() });
    const vaultId = seedVault(db);
    const device = await newDeviceKey();
    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, first_seen_at, revoked_at)
       values ('device-old', ?, ?, 'revoked', ?, ?)`
    ).run(vaultId, device.publicKey, new Date().toISOString(), new Date().toISOString());

    const response = await enrollDevice({
      request: await signedRequest(device, "POST", `/v/${SLUG}/devices`, { body: { public_key: device.publicKey } }),
      env,
      params: { slug: SLUG }
    });

    // Re-linking must not turn a revocation back into a pending request the
    // owner might wave through. Revocation is a decision, not a speed bump.
    expect(await response.json()).toEqual({ device_id: "device-old", status: "revoked" });
  });
});

describe("device request authentication", () => {
  const cases: Array<[string, (d: any) => Promise<Request>]> = [
    ["a signature for a different path", (d) =>
      signedRequest(d, "GET", `/v/${SLUG}/devices/current`, { signPath: `/v/${SLUG}/catalog.json` })],
    ["a stale timestamp", (d) =>
      signedRequest(d, "GET", `/v/${SLUG}/devices/current`, {
        timestamp: String(Math.floor(Date.now() / 1000) - DEVICE_TIMESTAMP_SKEW_SECONDS - 5)
      })],
    ["a timestamp far in the future", (d) =>
      signedRequest(d, "GET", `/v/${SLUG}/devices/current`, {
        timestamp: String(Math.floor(Date.now() / 1000) + DEVICE_TIMESTAMP_SKEW_SECONDS + 5)
      })]
  ];

  for (const [label, build] of cases) {
    it(`rejects ${label}`, async () => {
      const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: kv() });
      const vaultId = seedVault(db);
      const device = await newDeviceKey();
      db.prepare(
        `insert into sync_devices (id, vault_id, public_key, status, first_seen_at)
         values ('device-1', ?, ?, 'active', ?)`
      ).run(vaultId, device.publicKey, new Date().toISOString());

      const response = await deviceStatus({ request: await build(device), env, params: { slug: SLUG } });
      expect(response.status).toBe(401);
    });
  }

  it("rejects a request with no signature headers at all", async () => {
    const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: kv() });
    seedVault(db);
    const response = await deviceStatus({
      request: new Request(`${ORIGIN}/v/${SLUG}/devices/current`),
      env,
      params: { slug: SLUG }
    });
    expect(response.status).toBe(401);
  });

  it("tells an unenrolled key it is unknown, not that it was revoked", async () => {
    // Different facts, and the CLI acts differently on them: `revoked` exits 1.
    const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: kv() });
    seedVault(db);
    const device = await newDeviceKey();

    const response = await deviceStatus({
      request: await signedRequest(device, "GET", `/v/${SLUG}/devices/current`),
      env,
      params: { slug: SLUG }
    });
    expect(response.status).toBe(404);
  });
});

describe("catalog and bundle access", () => {
  const CATALOG = JSON.stringify({ schema_version: 1, id: "vault_1", name: "Demo", public_key: "pk", releases: [] });
  const BUNDLE_HASH = "a".repeat(64);
  const BUNDLE = JSON.stringify({ skill_md: "# Demo", resources: [] });

  async function withDevice(status: string) {
    const objects = kv({
      "sync:vault_1:catalog": CATALOG,
      [`sync:vault_1:bundle:${BUNDLE_HASH}`]: BUNDLE
    });
    const { db, env } = createTestEnv({ AUTOVAULT_VAULT_OBJECTS: objects });
    const vaultId = seedVault(db);
    const device = await newDeviceKey();
    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, first_seen_at)
       values ('device-1', ?, ?, ?, ?)`
    ).run(vaultId, device.publicKey, status, new Date().toISOString());
    return { db, env, device };
  }

  it("lets a PENDING device read the catalog, because that is how it pins the key", async () => {
    // enrollHttpsFromCatalogUrl posts devices, THEN reads catalog.json to pin
    // public_key -- all before the owner has admitted anything. Gate the
    // catalog on active and linking can never complete.
    const { env, device } = await withDevice("pending");
    const response = await readCatalog({
      request: await signedRequest(device, "GET", `/v/${SLUG}/catalog.json`),
      env,
      params: { slug: SLUG }
    });

    expect(response.status).toBe(200);
    // Byte-for-byte: re-serialising would change the bytes the owner signed.
    expect(await response.text()).toBe(CATALOG);
  });

  it("refuses the catalog to a revoked device", async () => {
    const { env, device } = await withDevice("revoked");
    const response = await readCatalog({
      request: await signedRequest(device, "GET", `/v/${SLUG}/catalog.json`),
      env,
      params: { slug: SLUG }
    });
    expect(response.status).toBe(403);
  });

  it("gives bundles only to an ADMITTED device", async () => {
    // The catalog is readable while pending so the key can be pinned; actual
    // content is what admission gates. If pending could read bundles, admit
    // would be decoration.
    const pending = await withDevice("pending");
    const refused = await readBundle({
      request: await signedRequest(pending.device, "GET", `/v/${SLUG}/bundles/${BUNDLE_HASH}.json`),
      env: pending.env,
      params: { slug: SLUG, bundle: `${BUNDLE_HASH}.json` }
    });
    expect(refused.status).toBe(403);

    const active = await withDevice("active");
    const allowed = await readBundle({
      request: await signedRequest(active.device, "GET", `/v/${SLUG}/bundles/${BUNDLE_HASH}.json`),
      env: active.env,
      params: { slug: SLUG, bundle: `${BUNDLE_HASH}.json` }
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toBe(BUNDLE);
  });

  it("only addresses bundles as <bundle_hash>.json", async () => {
    // bundle_path is inside the release signature and the client re-derives it
    // as bundles/<bundle_hash>.json. Anything else is not a bundle this vault
    // can serve, and must not become a lookup key.
    //
    // Asserting on the 404 alone would be vacuous: every malformed name misses
    // KV and 404s anyway, so the test would pass just as happily with no
    // validation at all. What matters is that a rejected name never reaches
    // the store, so assert the store was never asked.
    const { env, device } = await withDevice("active");
    const objects = env.AUTOVAULT_VAULT_OBJECTS as { reads: string[] };
    objects.reads.length = 0;

    for (const name of [
      "not-a-hash.json",
      `${BUNDLE_HASH}.txt`,
      "../catalog.json",
      `${"A".repeat(64)}.json`,
      `${BUNDLE_HASH}.json.json`
    ]) {
      const response = await readBundle({
        request: await signedRequest(device, "GET", `/v/${SLUG}/bundles/${name}`),
        env,
        params: { slug: SLUG, bundle: name }
      });
      expect(response.status, name).toBe(404);
    }

    expect(objects.reads).toEqual([]);
  });

  it("never marks device responses publicly cacheable", async () => {
    // These are per-device authorized. An edge cache keyed on URL alone would
    // hand an admitted device's bundle to one that was never admitted.
    const { env, device } = await withDevice("active");
    const response = await readCatalog({
      request: await signedRequest(device, "GET", `/v/${SLUG}/catalog.json`),
      env,
      params: { slug: SLUG }
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).not.toContain("public");
  });
});

describe("sync routes are never redirected", () => {
  // The CLI fetches with `redirect: "manual"` and throws on ANY 3xx --
  // "HTTPS sync refused redirect". That is the right call on its side: a
  // redirect can move a signed request to a path its signature does not cover.
  // It does mean a stray redirect here breaks sync with an error that names
  // the redirect and not the cause.
  const paths = [
    `/v/${SLUG}/catalog.json`,
    `/v/${SLUG}/devices`,
    `/v/${SLUG}/devices/current`,
    `/v/${SLUG}/bundles/${"a".repeat(64)}.json`
  ];

  it("passes every sync path straight through on the canonical host", async () => {
    for (const path of paths) {
      let reached = false;
      const response = await siteMiddleware({
        request: new Request(`https://autovault.dev${path}`),
        env: {},
        next: async () => {
          reached = true;
          return new Response("handler");
        }
      });
      expect(reached, path).toBe(true);
      expect(response.status, path).toBe(200);
    }
  });

  it("still redirects the installer host, which is why this guard is needed", async () => {
    // autovault.sh redirects everything to autovault.dev, so a device pointed
    // at the wrong origin fails with "refused redirect" rather than silently
    // following. DEFAULT_CLOUD_ORIGIN is autovault.dev, so the CLI never
    // constructs these itself -- this pins the asymmetry as intentional.
    const response = await siteMiddleware({
      request: new Request(`https://autovault.sh/v/${SLUG}/catalog.json`),
      env: {},
      next: async () => new Response("handler")
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`https://autovault.dev/v/${SLUG}/catalog.json`);
  });
});
