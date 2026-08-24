import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSession } from "../functions/api/_lib/auth.js";
import { createTestEnv, seedUser } from "./support/d1.js";
import { generateUserCode, normalizeUserCode, PAIRING_POLL_INTERVAL_SECONDS } from "../functions/api/_lib/pairing.js";
import { onRequestPost as startPairing } from "../functions/api/devices/pair.js";
import { onRequestPost as pollToken } from "../functions/api/devices/token.js";
import {
  onRequestGet as readPairing,
  onRequestPost as decidePairing
} from "../functions/api/devices/pairings/[code].js";

const ORIGIN = "https://autovault.dev";
const SLUG = "demo-vault";

// The exact strings src/sync/contract.ts exports. Hard-coded rather than
// imported: this repo cannot import from the CLI, and a silent drift here is
// precisely the failure the client-is-the-spec rule exists to prevent.
const PAIR_PATH = "/api/devices/pair";
const TOKEN_PATH = "/api/devices/token";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

// src/sync/https.ts::devicePairingStartSchema, verbatim.
const USER_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

// Subscription defaults to active because admission follows entitlement, so an
// unsubscribed owner cannot confirm at all -- seeding a lapsed one is how the
// paywall gets tested, not the default every other case has to opt out of.
function seedVault(
  db: any,
  { vaultId = "vault_1", userId = "clerk_1", slug = SLUG, subscription = "active" } = {}
) {
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
  body?: unknown
) {
  const url = new URL(path, ORIGIN);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = `${method}\n${url.pathname}\n${timestamp}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, device.pair.privateKey, new TextEncoder().encode(message))
  );
  return new Request(url, {
    method,
    headers: {
      "x-autovault-device": device.publicKey,
      "x-autovault-timestamp": timestamp,
      "x-autovault-signature": Buffer.from(signature).toString("base64url"),
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function startFor(env: any, device: Awaited<ReturnType<typeof newDeviceKey>>) {
  const response = await startPairing({
    request: await signedRequest(device, "POST", PAIR_PATH, { public_key: device.publicKey, hostname: "workbench" }),
    env
  } as any);
  return { response, payload: (await response.json()) as any };
}

async function poll(env: any, device: Awaited<ReturnType<typeof newDeviceKey>>, deviceCode: string) {
  const response = await pollToken({
    request: await signedRequest(device, "POST", TOKEN_PATH, {
      device_code: deviceCode,
      grant_type: GRANT_TYPE
    }),
    env
  } as any);
  return { response, payload: (await response.json()) as any };
}

function ownerContext(env: any, cookie: string, code: string, body?: unknown) {
  return {
    request: new Request(`${ORIGIN}/api/devices/pairings/${encodeURIComponent(code)}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    env,
    params: { code }
  } as any;
}

describe("user codes", () => {
  it("only uses characters a human cannot misread, and the client accepts them", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateUserCode();
      expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
      // The confusable pairs RFC 8628 §6.1 warns about -- 0/O and 1/I -- plus
      // every vowel, so no code can spell a word at the owner. `L` stays: the
      // alphabet has no digits, so there is no 1 for it to be confused with.
      expect(code).not.toMatch(/[0-9]/);
      expect(code).not.toMatch(/[OIUAEY]/);
      // devicePairingStartSchema rejects anything else, and a rejected code
      // means the CLI throws instead of pairing.
      expect(code).toMatch(USER_CODE_RE);
      expect(code.length).toBeGreaterThanOrEqual(4);
      expect(code.length).toBeLessThanOrEqual(20);
    }
  });

  it("accepts the shapes an owner actually types", () => {
    expect(normalizeUserCode("bcdf-ghjk")).toBe("BCDF-GHJK");
    expect(normalizeUserCode("BCDFGHJK")).toBe("BCDF-GHJK");
    expect(normalizeUserCode(" bcdf ghjk ")).toBe("BCDF-GHJK");
    // Wrong LENGTH is the rejection; "too-short" is eight letters and so is
    // a perfectly well-formed code once the hyphen is stripped.
    expect(normalizeUserCode("SHORT")).toBe(null);
    expect(normalizeUserCode("BCDFGHJKX")).toBe(null);
    expect(normalizeUserCode("")).toBe(null);
  });
});

describe("POST /api/devices/pair", () => {
  it("returns the RFC 8628 start payload the client parses", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();

    const { response, payload } = await startFor(env, device);

    expect(response.status).toBe(200);
    expect(payload.device_code.length).toBeGreaterThanOrEqual(16);
    expect(payload.device_code.length).toBeLessThanOrEqual(128);
    expect(payload.user_code).toMatch(USER_CODE_RE);
    // Absolute and on this origin, or the CLI's isCloudOriginUrl guard refuses
    // to open the browser and the owner sees a code with nowhere to confirm it.
    expect(payload.verification_uri).toBe(`${ORIGIN}/cloud/pair`);
    expect(payload.verification_uri_complete).toBe(
      `${ORIGIN}/cloud/pair?code=${encodeURIComponent(payload.user_code)}`
    );
    expect(payload.expires_in).toBeGreaterThan(0);
    // completeCloudPairing sleeps `interval` seconds between polls and obeys a
    // zero literally. Pages Functions bill per request, so zero would be a
    // tight loop for the whole TTL.
    expect(payload.interval).toBe(PAIRING_POLL_INTERVAL_SECONDS);
    expect(payload.interval).toBeGreaterThan(0);
  });

  it("never redirects", async () => {
    // The CLI fetches with redirect: "manual" and throws on any 3xx.
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { response } = await startFor(env, device);
    expect(response.status).toBeLessThan(300);
  });

  it("refuses a body naming a key it cannot sign for", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const other = await newDeviceKey();

    const response = await startPairing({
      request: await signedRequest(device, "POST", PAIR_PATH, { public_key: other.publicKey }),
      env
    } as any);
    expect(response.status).toBe(400);
  });

  it("refuses an unsigned request", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const response = await startPairing({
      request: new Request(`${ORIGIN}${PAIR_PATH}`, { method: "POST", body: "{}" }),
      env
    } as any);
    expect(response.status).toBe(401);
  });

  it("does not need a vault to exist -- pairing precedes the namespace", async () => {
    const { env } = createTestEnv();
    const device = await newDeviceKey();
    const { response } = await startFor(env, device);
    expect(response.status).toBe(200);
  });
});

describe("POST /api/devices/token", () => {
  it("answers authorization_pending until the owner confirms", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);

    const { response, payload } = await poll(env, device, started.device_code);
    expect(response.status).toBe(400);
    expect(payload.error).toBe("authorization_pending");
  });

  it("refuses a device_code minted for a different key", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const thief = await newDeviceKey();
    const { payload: started } = await startFor(env, device);

    // A stolen device_code is useless without the secret half, and the answer
    // is deliberately identical to an unknown code so this is not an oracle.
    const { response, payload } = await poll(env, thief, started.device_code);
    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_grant");
  });

  it("rejects an unknown grant type", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);

    const response = await pollToken({
      request: await signedRequest(device, "POST", TOKEN_PATH, {
        device_code: started.device_code,
        grant_type: "password"
      }),
      env
    } as any);
    expect(response.status).toBe(400);
    expect((await response.json() as any).error).toBe("unsupported_grant_type");
  });

  it("returns access_denied after the owner refuses", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    const refused = await decidePairing(ownerContext(env, cookie, started.user_code, { action: "deny" }));
    expect(refused.status).toBe(200);

    const { payload } = await poll(env, device, started.device_code);
    expect(payload.error).toBe("access_denied");
  });

  it("returns expired_token once the window closes", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);

    db.prepare("update device_pairings set expires_at = ? where device_code = ?")
      .run(new Date(Date.now() - 1000).toISOString(), started.device_code);

    const { payload } = await poll(env, device, started.device_code);
    expect(payload.error).toBe("expired_token");
  });
});

describe("the owner confirms in the browser", () => {
  it("binds the device to the confirming session's vault and hands the CLI its slug", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    const view = await readPairing(ownerContext(env, cookie, started.user_code));
    const shown = (await view.json()) as any;
    expect(view.status).toBe(200);
    // The fingerprint is the out-of-band check: it is printed by the terminal
    // and is NOT in the verification link, so matching it is what makes this a
    // confirmation rather than a click on a URL somebody sent.
    expect(shown.fingerprint).toBe(`${device.publicKey.slice(0, 4)}…${device.publicKey.slice(-4)}`);
    expect(shown.hostname).toBe("workbench");
    expect(shown.state).toBe("pending");
    expect(shown.vault.slug).toBe(SLUG);
    // The public key itself never reaches the browser.
    expect(JSON.stringify(shown)).not.toContain(device.publicKey);

    const confirmed = await decidePairing(
      ownerContext(env, cookie, started.user_code, { action: "confirm" })
    );
    expect(confirmed.status).toBe(200);

    const { response, payload } = await poll(env, device, started.device_code);
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      slug: SLUG,
      catalog_url: `${ORIGIN}/v/${SLUG}/catalog.json`,
      status: "active"
    });
    expect(payload.device_id).toBeTruthy();
  });

  it("refuses to admit a machine on a lapsed subscription", async () => {
    const { db, env } = createTestEnv();
    seedVault(db, { subscription: "canceled" });
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    const refused = await decidePairing(
      ownerContext(env, cookie, started.user_code, { action: "confirm" })
    );
    expect(refused.status).toBe(402);
    expect((await refused.json()).code).toBe("inactive-subscription");

    // Nothing was admitted, and the CLI is still waiting rather than being told
    // something fatal -- reactivating and confirming again has to just work.
    expect((db.prepare("select count(*) as n from sync_devices").get() as any).n).toBe(0);
    const { payload } = await poll(env, device, started.device_code);
    expect(payload.error).toBe("authorization_pending");
  });

  it("refuses a confirm that lost the race, and admits nothing", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    // The interleaving a sequential test cannot otherwise produce: another
    // session decides the pairing after this request read it as pending but
    // before the claim lands. Without the conditional update, this request
    // would go on to admit the device anyway.
    let raced = false;
    const racingEnv = {
      ...env,
      AUTOVAULT_DB: {
        prepare(sql: string) {
          if (!raced && sql.includes("set confirmed_at")) {
            raced = true;
            db.prepare("update device_pairings set denied_at = ? where device_code = ?")
              .run(new Date().toISOString(), started.device_code);
          }
          return (env.AUTOVAULT_DB as any).prepare(sql);
        }
      }
    };

    const lost = await decidePairing(
      ownerContext(racingEnv, cookie, started.user_code, { action: "confirm" })
    );
    expect(lost.status).toBe(409);
    // The refusal names the decision that actually won, not a generic conflict.
    expect((await lost.json()).code).toBe("denied");
    expect((db.prepare("select count(*) as n from sync_devices").get() as any).n).toBe(0);
    expect(raced).toBe(true);
  });

  it("is idempotent, because the CLI retries", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    const first = await poll(env, device, started.device_code);
    const second = await poll(env, device, started.device_code);
    expect(second.response.status).toBe(200);
    expect(second.payload).toEqual(first.payload);
  });

  it("admits an already-enrolled machine instead of duplicating it", async () => {
    const { db, env } = createTestEnv();
    const vaultId = seedVault(db);
    const device = await newDeviceKey();
    // Enrolled the old way -- autovault link <slug> -- and still waiting.
    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, first_seen_at)
       values ('device-old', ?, ?, 'pending', ?)`
    ).run(vaultId, device.publicKey, new Date().toISOString());

    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    const rows = db.prepare("select id, status from sync_devices where vault_id = ?").all(vaultId) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "device-old", status: "active" });
  });

  it("refuses an owner with no namespace, and leaves the pairing open", async () => {
    const { db, env } = createTestEnv();
    seedUser(db, { id: "clerk_1" });
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    const refused = await decidePairing(
      ownerContext(env, cookie, started.user_code, { action: "confirm" })
    );
    expect(refused.status).toBe(409);
    expect((await refused.json() as any).code).toBe("no-vault");

    // Still pending, not failed: the owner can reserve a namespace in another
    // tab and confirm the SAME code, with no restart and no new code.
    const { payload } = await poll(env, device, started.device_code);
    expect(payload.error).toBe("authorization_pending");
  });

  it("requires a session -- a code alone confirms nothing", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);

    const anonymous = await decidePairing({
      request: new Request(`${ORIGIN}/api/devices/pairings/${started.user_code}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm" })
      }),
      env,
      params: { code: started.user_code }
    } as any);
    expect(anonymous.status).toBe(401);
  });

  it("does not let one owner confirm a code into another owner's vault", async () => {
    const { db, env } = createTestEnv();
    seedVault(db, { vaultId: "vault_1", userId: "clerk_1", slug: SLUG });
    seedVault(db, { vaultId: "vault_2", userId: "clerk_2", slug: "other-vault" });
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);

    // Whoever confirms binds it to THEIR vault -- the session is the authority,
    // and nothing the device sent names a vault at all.
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_2");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    const { payload } = await poll(env, device, started.device_code);
    expect(payload.slug).toBe("other-vault");
    const rows = db.prepare("select vault_id from sync_devices").all() as any[];
    expect(rows).toEqual([{ vault_id: "vault_2" }]);
  });
});

// The confirm page is a source-level check like the rest of this repo's Vue
// coverage: there is no DOM harness here, and these two properties are exactly
// the ones that fail silently -- the page still renders, it just quietly loses
// the code or quietly stops asking whether the fingerprint matched.
describe("races against the browser half", () => {
  it("keeps the CLI polling while admission is still settling", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    // Exactly the window between claiming the pairing and writing device_id.
    // A poll landing here used to get the terminal `expired_token` -- telling
    // the CLI the link failed while the browser was busy succeeding.
    db.prepare("update device_pairings set device_id = null where device_code = ?")
      .run(started.device_code);

    const { payload } = await poll(env, device, started.device_code);
    expect(payload.error).toBe("authorization_pending");
  });

  it("calls it dead once no admission could still be in flight", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    db.prepare("update device_pairings set device_id = null, confirmed_at = ? where device_code = ?")
      .run(new Date(Date.now() - 10 * 60_000).toISOString(), started.device_code);

    const { payload } = await poll(env, device, started.device_code);
    expect(payload.error).toBe("expired_token");
  });

  it("does not undo a revocation that landed mid-confirm", async () => {
    const { db, env } = createTestEnv();
    const vaultId = seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, hostname, first_seen_at, admitted_at)
       values ('device-old', ?, ?, 'active', 'workbench', ?, ?)`
    ).run(vaultId, device.publicKey, new Date().toISOString(), new Date().toISOString());

    // The owner revokes this key in another tab after the confirm handler has
    // read it as active. The unconditional update used to write 'active' back
    // over the newer 'revoked', silently restoring bundle access with no
    // warning ever shown.
    let raced = false;
    const racingEnv = {
      ...env,
      AUTOVAULT_DB: {
        prepare(sql: string) {
          if (!raced && sql.includes("update sync_devices set status = 'active'")) {
            raced = true;
            db.prepare("update sync_devices set status = 'revoked', revoked_at = ? where id = 'device-old'")
              .run(new Date().toISOString());
          }
          return (env.AUTOVAULT_DB as any).prepare(sql);
        }
      }
    };

    const lost = await decidePairing(
      ownerContext(racingEnv, cookie, started.user_code, { action: "confirm" })
    );
    expect(lost.status).toBe(409);
    expect((await lost.json()).code).toBe("device-changed");
    expect((db.prepare("select status from sync_devices where id = 'device-old'").get() as any).status)
      .toBe("revoked");
    expect(raced).toBe(true);
  });

  it("tells the owner when the key they refused is already linked", async () => {
    const { db, env } = createTestEnv();
    const vaultId = seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    db.prepare(
      `insert into sync_devices (id, vault_id, public_key, status, hostname, first_seen_at, admitted_at)
       values ('device-live', ?, ?, 'active', 'workbench', ?, ?)`
    ).run(vaultId, device.publicKey, new Date().toISOString(), new Date().toISOString());

    // Deny marks the pairing and leaves the enrolled device alone, so the page
    // must not tell this owner the machine "never had access".
    const view = await readPairing(ownerContext(env, cookie, started.user_code));
    expect((await view.json()).already_active).toBe(true);
  });
});

describe("the TTL and the mint cap", () => {
  it("refuses a claim that lands after the code expired", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    // The confirm read the pairing while it was still live, then spent time
    // loading the vault and subscription. Because a confirmed pairing outranks
    // an expired one by design, a late write here would resurrect a dead code
    // for the whole grace window -- so the claim re-checks expiry itself.
    let raced = false;
    const racingEnv = {
      ...env,
      AUTOVAULT_DB: {
        prepare(sql: string) {
          if (!raced && sql.includes("set confirmed_at")) {
            raced = true;
            db.prepare("update device_pairings set expires_at = ? where device_code = ?")
              .run(new Date(Date.now() - 1_000).toISOString(), started.device_code);
          }
          return (env.AUTOVAULT_DB as any).prepare(sql);
        }
      }
    };

    const lost = await decidePairing(
      ownerContext(racingEnv, cookie, started.user_code, { action: "confirm" })
    );
    expect(lost.status).toBe(409);
    expect((await lost.json()).code).toBe("expired");
    expect((db.prepare("select count(*) as n from sync_devices").get() as any).n).toBe(0);
    expect(raced).toBe(true);
  });

  it("caps live pairings per key in the insert itself", async () => {
    const { env } = createTestEnv();
    const device = await newDeviceKey();
    for (let i = 0; i < 5; i += 1) {
      const { response } = await startFor(env, device);
      expect(response.status).toBe(200);
    }
    // A separate count-then-insert could not cap parallel mints at all; the
    // predicate lives in the statement so the sixth is refused by the write.
    const { response } = await startFor(env, device);
    expect(response.status).toBe(429);
  });
});

describe("a grant that outlives its code", () => {
  it("still redeems after expires_at, because the machine is already admitted", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");

    const confirmed = await decidePairing(
      ownerContext(env, cookie, started.user_code, { action: "confirm" })
    );
    expect(confirmed.status).toBe(200);

    // The owner confirmed inside the last polling interval and the TTL lapsed
    // before the CLI's next poll. The device row is active either way, so
    // answering `expired_token` would report a linked machine as a failure.
    db.prepare("update device_pairings set expires_at = ? where device_code = ?")
      .run(new Date(Date.now() - 60_000).toISOString(), started.device_code);

    const { response, payload } = await poll(env, device, started.device_code);
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ slug: SLUG, status: "active" });
  });

  it("survives another device's prune sweep", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    db.prepare("update device_pairings set expires_at = ? where device_code = ?")
      .run(new Date(Date.now() - 60_000).toISOString(), started.device_code);

    // Minting for an unrelated key runs prunePairings, which used to delete
    // every expired row -- including this confirmed one, out from under a CLI
    // still polling it.
    const other = await newDeviceKey();
    await startFor(env, other);

    const { response } = await poll(env, device, started.device_code);
    expect(response.status).toBe(200);
  });

  it("tells the CLI a revoked machine is refused, not pending", async () => {
    const { db, env } = createTestEnv();
    seedVault(db);
    const device = await newDeviceKey();
    const { payload: started } = await startFor(env, device);
    const cookie = await createSession(new Request(ORIGIN), env, "clerk_1");
    await decidePairing(ownerContext(env, cookie, started.user_code, { action: "confirm" }));

    // Revoked between confirming in the browser and the next poll. Reporting
    // `pending` would hand the CLI an authorized pairing whose every catalog
    // request is then refused.
    db.prepare("update sync_devices set status = 'revoked' where public_key = ?").run(device.publicKey);

    const { response, payload } = await poll(env, device, started.device_code);
    expect(response.status).toBe(400);
    expect(payload.error).toBe("access_denied");
  });
});

describe("the confirm page", () => {
  const source = readFileSync(
    join(import.meta.dirname, "..", ".vitepress", "theme", "components", "CloudPairPage.vue"),
    "utf-8"
  );

  it("returns to this page after sign-in instead of the global /cloud fallback", () => {
    // clerk.ts sets signInFallbackRedirectUrl globally, so a bare SignInButton
    // sends a freshly signed-in owner to the dashboard and drops the ?code=.
    // `autovault link` sends signed-out people straight here, so that is the
    // main path, not an edge case.
    expect(source).toContain(':force-redirect-url="pairUrl"');
    expect(source).toContain("pairUrl.value = `${window.location.pathname}${window.location.search}`");
  });

  it("submits the code whose fingerprint was shown, not the input's value", () => {
    // The field stays editable while the fingerprint is displayed. Reading it
    // at submit time would let someone tick the box for code A, paste code B,
    // and confirm a machine whose fingerprint was never on screen.
    expect(source).toContain("encodeURIComponent(pairing.value.user_code)");
    expect(source).not.toContain("encodeURIComponent(code.value.trim())");
    // The other half: editing the field retires the displayed pairing.
    expect(source).toMatch(/watch\(code, \(\) => \{[\s\S]*?fingerprintMatches\.value = false;/);
  });

  it("discards a lookup answer for a code that is no longer in the box", () => {
    // The watcher cannot cover this: during an in-flight lookup `pairing` is
    // already null, so it has nothing to retire, and the late response would
    // install code A's fingerprint next to code B's text.
    expect(source).toContain("if (code.value.trim() !== value) return;");
    // Both the success path and the failure path, or a stale error survives.
    expect(source.split("if (code.value.trim() !== value) return;").length - 1).toBe(2);
  });

  it("does not claim a refusal removed access it never touched", () => {
    expect(source).toContain("deniedWasActive");
    expect(source).toMatch(/v-if="deniedWasActive"[\s\S]*?already a linked machine/);
  });

  it("keeps confirm behind the fingerprint check", () => {
    // The server cannot verify a human compared anything, so this checkbox is
    // the entire both-ends-match property (RFC 8628 s5.4). If the disabled
    // binding stops mentioning it, confirming becomes a bare click.
    expect(source).toContain("fingerprintMatches");
    expect(source).toMatch(/:disabled="[^"]*!fingerprintMatches[^"]*"/);
  });
});
