import { createClerkClient } from "@clerk/backend";
import { ApiError, redirectWithError, safeReturnTo } from "./http.js";
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

export async function createOAuthStart(request, env, provider, returnTo) {
  const config = providerConfig(provider, request, env);
  if (!config.clientId || !config.clientSecret) {
    return redirectWithError(request, returnTo, `${provider}_oauth_not_configured`);
  }

  const state = randomToken(24);
  await run(env, `
    insert into oauth_states (state, provider, return_to, expires_at, created_at)
    values (?, ?, ?, ?, ?)
  `, state, provider, safeReturnTo(returnTo), isoAfter(600), nowIso());

  const authorizeUrl = new URL(config.authorizeUrl);
  for (const [key, value] of Object.entries(config.authorizeParams)) {
    authorizeUrl.searchParams.set(key, value);
  }
  authorizeUrl.searchParams.set("state", state);
  return Response.redirect(authorizeUrl.toString(), 302);
}

export async function handleOAuthCallback(request, env, provider, fetcher = fetch) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const stored = await first(env, `
    select state, provider, return_to
    from oauth_states
    where state = ? and provider = ? and expires_at > ?
  `, state, provider, nowIso());

  if (!stored || !code) return redirectWithError(request, "/cloud#launch-path", "oauth_state_invalid");

  await run(env, "delete from oauth_states where state = ?", state);
  const config = providerConfig(provider, request, env);
  const profile = await fetchOAuthProfile(config, code, fetcher);
  const user = await upsertUser(env, provider, profile);
  const cookie = await createSession(request, env, user.id);
  const target = new URL(safeReturnTo(stored.return_to), request.url);
  return new Response(null, {
    status: 302,
    headers: { location: target.toString(), "set-cookie": cookie }
  });
}

export async function upsertUser(env, provider, profile) {
  const id = `${provider}_${profile.providerUserId}`;
  await run(env, `
    insert into users (id, provider, provider_user_id, email, name, avatar_url, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(provider, provider_user_id) do update set
      email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      updated_at = excluded.updated_at
  `, id, provider, profile.providerUserId, profile.email, profile.name, profile.avatarUrl, nowIso(), nowIso());

  return first(env, "select id, email, name, avatar_url, provider from users where provider = ? and provider_user_id = ?", provider, profile.providerUserId);
}

async function getClerkSessionUser(request, env) {
  if (!clerkModeEnabled(env)) return null;

  const secretKey = env.CLERK_SECRET_KEY;
  const publishableKey = clerkPublishableKey(env);
  if (!secretKey || !publishableKey) return null;

  try {
    const client = createClerkClient({ secretKey, publishableKey });
    const requestState = await client.authenticateRequest(request, {
      authorizedParties: authorizedPartiesFor(request, env)
    });
    if (!requestState.isAuthenticated) return null;

    const auth = requestState.toAuth();
    const clerkUserId = auth?.userId;
    if (!clerkUserId) return null;

    const profile = await clerkProfile(client, clerkUserId);
    return upsertUser(env, "clerk", profile);
  } catch {
    return null;
  }
}

function clerkModeEnabled(env) {
  return Boolean(env.CLERK_SECRET_KEY && clerkPublishableKey(env));
}

function clerkPublishableKey(env) {
  return env.VITE_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY || "";
}

function authorizedPartiesFor(request, env) {
  const origin = new URL(request.url).origin;
  const configured = String(env.CLERK_AUTHORIZED_PARTIES || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return unique([
    origin,
    "https://autovault.dev",
    "https://www.autovault.dev",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    ...configured
  ]);
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
    return { providerUserId: clerkUserId, email: null, name: null, avatarUrl: null };
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function providerConfig(provider, request, env) {
  const redirectUri = new URL(`/api/auth/callback/${provider}`, request.url).toString();
  if (provider === "github") {
    return {
      provider,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectUri,
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      authorizeParams: {
        client_id: env.GITHUB_CLIENT_ID || "",
        redirect_uri: redirectUri,
        scope: "read:user user:email"
      }
    };
  }

  if (provider === "google") {
    return {
      provider,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      authorizeParams: {
        client_id: env.GOOGLE_CLIENT_ID || "",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account"
      }
    };
  }

  throw new ApiError(400, "Unsupported auth provider.");
}

async function fetchOAuthProfile(config, code, fetcher) {
  const tokenBody = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri
  });
  if (config.provider === "google") tokenBody.set("grant_type", "authorization_code");

  const tokenResponse = await fetcher(config.tokenUrl, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) throw new ApiError(401, "OAuth token exchange failed.");

  return config.provider === "github"
    ? fetchGithubProfile(tokenPayload.access_token, fetcher)
    : fetchGoogleProfile(tokenPayload.access_token, fetcher);
}

async function fetchGithubProfile(accessToken, fetcher) {
  const [userResponse, emailsResponse] = await Promise.all([
    fetcher("https://api.github.com/user", {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${accessToken}`, "user-agent": "autovault-website" }
    }),
    fetcher("https://api.github.com/user/emails", {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${accessToken}`, "user-agent": "autovault-website" }
    })
  ]);
  const user = await userResponse.json();
  const emails = emailsResponse.ok ? await emailsResponse.json() : [];
  const primary = Array.isArray(emails) ? emails.find((email) => email.primary) || emails[0] : null;
  if (!userResponse.ok || !user.id) throw new ApiError(401, "GitHub profile lookup failed.");
  return {
    providerUserId: String(user.id),
    email: primary?.email || user.email || null,
    name: user.name || user.login || null,
    avatarUrl: user.avatar_url || null
  };
}

async function fetchGoogleProfile(accessToken, fetcher) {
  const response = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { accept: "application/json", authorization: `Bearer ${accessToken}` }
  });
  const user = await response.json();
  if (!response.ok || !user.sub) throw new ApiError(401, "Google profile lookup failed.");
  return {
    providerUserId: String(user.sub),
    email: user.email || null,
    name: user.name || null,
    avatarUrl: user.picture || null
  };
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
