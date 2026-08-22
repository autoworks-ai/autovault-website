import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "migrations");

/**
 * A D1-shaped binding backed by real SQLite, with the repo's real migrations
 * applied.
 *
 * The hand-rolled fakes elsewhere in this suite model upsert semantics in
 * JavaScript, which means they cannot catch bugs in the SQL itself — a
 * conflict target that doesn't match a UNIQUE constraint, a `where` clause on
 * a DO UPDATE, or a column that a migration never added all look fine to them.
 * Running the actual statements against actual SQLite is the only way those
 * show up in a test rather than in production.
 */
export function createTestDb() {
  const db = new DatabaseSync(":memory:");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf-8"));
  }

  const binding = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          const params = binds.map(normalizeBind);
          return {
            async first() {
              return db.prepare(sql).get(...params) ?? null;
            },
            async all() {
              return { results: db.prepare(sql).all(...params), success: true };
            },
            async run() {
              const result = db.prepare(sql).run(...params);
              return {
                success: true,
                meta: {
                  changes: Number(result.changes),
                  last_row_id: Number(result.lastInsertRowid)
                }
              };
            }
          };
        }
      };
    },
    _raw: db
  };

  return { db, binding };
}

// node:sqlite only accepts null/number/bigint/string/Uint8Array. D1 tolerates
// undefined and booleans, so normalize the way the real binding would.
function normalizeBind(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as string | number;
}

export function createTestEnv(overrides: Record<string, unknown> = {}) {
  const { db, binding } = createTestDb();
  return {
    db,
    env: {
      AUTOVAULT_DB: binding,
      SESSION_SECRET: "test-session-secret",
      STRIPE_SECRET_KEY: "rk_test",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      AUTOVAULT_HOSTED_PRICE_ID: "price_hosted_vault",
      AUTOVAULT_VAULT_OBJECTS: { async put() {} },
      ...overrides
    } as Record<string, unknown>
  };
}

export function seedUser(
  db: DatabaseSync,
  { id = "clerk_1", email = "jack@example.com", name = "Jack", provider = "clerk" } = {}
) {
  const now = new Date().toISOString();
  db.prepare(
    `insert into users (id, provider, provider_user_id, email, name, avatar_url, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, provider, id.split("_").slice(1).join("_"), email, name, null, now, now);
  return { id, email, name, avatar_url: null, provider };
}
