import { requireUser } from "../_lib/auth.js";
import { ApiError, handleApi, json, readJson } from "../_lib/http.js";
import { provisionVault, validateVaultSlug } from "../_lib/vault.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const body = await readJson(request);
    const vault = await provisionVault(env, user, requestedSlug(body));
    return json({ vault });
  });
}

// The client never gets to decide this. It validates as you type so the field
// can say something useful, but the shape rule, the reserved list and the
// uniqueness check all live server-side and run again here -- a request crafted
// outside the UI asking for "admin" is refused by the same validator the field
// consults, not by the field.
//
// Stricter than provisionVault, deliberately. That falls back to a derived slug
// for anything it cannot use, which is the right default for a library call with
// no user in front of it. Here there IS a user, and they just typed a name into
// a field: quietly reserving something else, permanently, with no rename path
// and their CLI pinned to it, is a worse outcome than a 400 that says why.
function requestedSlug(body) {
  const raw = body?.slug;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const verdict = validateVaultSlug(raw);
  if (!verdict.ok) throw new ApiError(400, verdict.message, verdict.code);
  return verdict.slug;
}
