export class ApiError extends Error {
  // `code` is optional and machine-readable, for the cases where a client has
  // to branch on WHICH refusal it got rather than just render the sentence.
  // Namespace selection is the first: "that shape is not allowed" and "somebody
  // already has it" are both refusals of the same field but need different UI,
  // and matching on the human message would break the moment the wording
  // changes.
  constructor(status, message, code = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(status, message, code = null) {
  // Only emit `code` when there is one, so every existing response body is
  // byte-identical to what it was before codes existed.
  return json(code ? { error: message, code } : { error: message }, { status });
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

export function safeReturnTo(value, fallback = "/cloud#launch-path") {
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
    if (error instanceof ApiError) return apiError(error.status, error.message, error.code);
    return apiError(500, "Unexpected hosted vault error.");
  }
}
