export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(status, message) {
  return json({ error: message }, { status });
}

export async function readJson(request, limit = 120_000) {
  const text = await request.text();
  if (text.length > limit) throw new ApiError(413, "Request body is too large.");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

export function safeReturnTo(value, fallback = "/deploy.html#hosts") {
  if (!value || typeof value !== "string") return fallback;
  try {
    const url = new URL(value, "https://autovault.dev");
    if (url.origin !== "https://autovault.dev") return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
  }
}

export function redirectWithError(request, returnTo, code) {
  const url = new URL(safeReturnTo(returnTo), request.url);
  url.searchParams.set("hosted_error", code);
  return Response.redirect(url.toString(), 302);
}

export async function handleApi(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) return apiError(error.status, error.message);
    return apiError(500, "Unexpected hosted vault error.");
  }
}
