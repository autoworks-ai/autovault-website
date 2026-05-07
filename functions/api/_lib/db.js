import { ApiError } from "./http.js";

export function requireDb(env) {
  if (!env.AUTOVAULT_DB) throw new ApiError(503, "AUTOVAULT_DB binding is not configured.");
  return env.AUTOVAULT_DB;
}

export async function first(env, sql, ...binds) {
  return requireDb(env).prepare(sql).bind(...binds).first();
}

export async function run(env, sql, ...binds) {
  return requireDb(env).prepare(sql).bind(...binds).run();
}

export async function all(env, sql, ...binds) {
  return requireDb(env).prepare(sql).bind(...binds).all();
}

export function nowIso() {
  return new Date().toISOString();
}

export function isoAfter(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
