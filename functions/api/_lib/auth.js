import { createClerkClient } from "@clerk/backend";
import { ApiError } from "./http.js";
import { first, isoAfter, nowIso, run } from "./db.js";
import { randomToken, sha256Hex } from "./crypto.js";

export const SESSION_COOKIE = "av_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function parseCookies(header) {
  const cookies = {};
  for (const part of (header || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export async function getSessionUser(request, env) {
  const clerkUser = await getClerkSessionUser(request, env);
  if (clerkUser) return clerkUser;
  if (clerkModeEnabled(env)) return null;

  // Below is the non-Clerk fallback. Nothing in the API issues one of these
  // cookies any more — the GitHub/Google OAuth routes that used to call
  // createSession() were removed, because their `state` was never bound to the
  // requesting browser (no nonce cookie), which made the parameter useless as
  // CSRF protection. createSession() itself is kept for tests and for local
  // development without Clerk configured.

  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  if (!env.SESSION_SECRET) return null;
  const tokenHash = await sessionHash(env, token);
  const user = await first(env, `
    select users.id, users.email, users.name, users.avatar_url, users.provider
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
  `, tokenHash, nowIso());

  return user ?? null;
}

export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) throw new ApiError(401, "Authentication required.");
  return user;
}

export async function createSession(request, env, userId) {
  const token = randomToken(32);
  if (!env.SESSION_SECRET) throw new ApiError(503, "SESSION_SECRET is not configured.");
  const tokenHash = await sessionHash(env, token);
  const expiresAt = isoAfter(SESSION_TTL_SECONDS);
  await run(env, `
    insert into sessions (token_hash, user_id, expires_at, created_at)
    values (?, ?, ?, ?)
  `, tokenHash, userId, expiresAt, nowIso());
  return sessionCookie(request, token, SESSION_TTL_SECONDS);
}

export async function destroySession(request, env) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (token) {
    if (!env.SESSION_SECRET) return clearSessionCookie(request);
    const tokenHash = await sessionHash(env, token);
    await run(env, "delete from sessions where token_hash = ?", tokenHash);
  }
  return clearSessionCookie(request);
}

export async function upsertUser(env, provider, profile) {
  const id = `${provider}_${profile.providerUserId}`;
  // `fetchFailed` distinguishes "clerkProfile() couldn't reach Clerk" (keep
  // whatever we already had) from "Clerk answered and this field is really
  // null" (a user who cleared their name/avatar). Both used to look identical
  // — an all-null profile object — so a coalesce-always upsert also blocked
  // legitimate clears. Callers that omit it (existing profile data, e.g.
  // early tests) get the plain-overwrite path, which is the correct default:
  // a fetch failure must opt into the preserve behavior explicitly.
  if (profile.fetchFailed) {
    await run(env, `
      insert into users (id, provider, provider_user_id, email, name, avatar_url, created_at, updated_at)
      values (?, ?, ?, null, null, null, ?, ?)
      on conflict(provider, provider_user_id) do update set updated_at = excluded.updated_at
    `, id, provider, profile.providerUserId, nowIso(), nowIso());
  } else {
    await run(env, `
      insert into users (id, provider, provider_user_id, email, name, avatar_url, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(provider, provider_user_id) do update set
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at
    `, id, provider, profile.providerUserId, profile.email, profile.name, profile.avatarUrl, nowIso(), nowIso());
  }

  return first(env, "select id, email, name, avatar_url, provider from users where provider = ? and provider_user_id = ?", provider, profile.providerUserId);
}

async function getClerkSessionUser(request, env) {
  if (!clerkModeEnabled(env)) return null;

  const secretKey = env.CLERK_SECRET_KEY;
  const publishableKey = clerkPublishableKey(env);
  if (!secretKey || !publishableKey) return null;
  const hasBearerToken = Boolean(clerkBearerToken(request));

  try {
    const client = createClerkClient({ secretKey, publishableKey });
    const requestState = await client.authenticateRequest(request, {
      authorizedParties: authorizedPartiesFor(request, env)
    });
    if (!requestState.isAuthenticated) {
      if (hasBearerToken) throw new ApiError(401, "Invalid Clerk session.");
      return null;
    }

    const auth = requestState.toAuth();
    const clerkUserId = auth?.userId;
    if (!clerkUserId) {
      if (hasBearerToken) throw new ApiError(401, "Invalid Clerk session.");
      return null;
    }

    const profile = await clerkProfile(client, clerkUserId);
    return upsertUser(env, "clerk", profile);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (hasBearerToken) throw new ApiError(401, "Invalid Clerk session.");
    return null;
  }
}

function clerkBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^\s*Bearer\s+(.+?)\s*$/i);
  return match?.[1] || null;
}

function clerkModeEnabled(env) {
  return Boolean(env.CLERK_SECRET_KEY && clerkPublishableKey(env));
}

function clerkPublishableKey(env) {
  return env.VITE_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY || "";
}

function authorizedPartiesFor(request, env) {
  const url = new URL(request.url);
  const configured = String(env.CLERK_AUTHORIZED_PARTIES || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // `origin` stays in the list because Pages preview deployments get dynamic
  // *.pages.dev hostnames that cannot be enumerated ahead of time, and an
  // attacker cannot make their own host serve these Functions. The localhost
  // entries are the real problem: they were unconditional, so production
  // accepted tokens minted for a dev frontend. Gate them on a local request.
  const local = isLocalHost(url.hostname)
    ? [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173"
      ]
    : [];
  return unique([
    url.origin,
    "https://autovault.dev",
    "https://www.autovault.dev",
    ...local,
    ...configured
  ]);
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

async function clerkProfile(client, clerkUserId) {
  try {
    const user = await client.users.getUser(clerkUserId);
    return {
      providerUserId: clerkUserId,
      email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null,
      name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null,
      avatarUrl: user.imageUrl || null
    };
  } catch {
    return { providerUserId: clerkUserId, email: null, name: null, avatarUrl: null, fetchFailed: true };
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sessionCookie(request, token, maxAge) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureAttr(request)}`;
}

function clearSessionCookie(request) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttr(request)}`;
}

function secureAttr(request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

function sessionHash(env, token) {
  return sha256Hex(`${env.SESSION_SECRET}:${token}`);
}
