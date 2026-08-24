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
  // ABSENT is the only case the derived fallback is for: callers that predate
  // this field, and the funnel when nobody typed a name (it sends `undefined`,
  // which JSON drops). Anything PRESENT is an opinion -- including "" and a
  // non-string -- and an opinion the validator refuses has to come back as the
  // 400 that says why.
  //
  // Treating a present-but-empty slug as absent reopened the exact hole this
  // function exists to close, one layer down: a crafted or stale client posting
  // { "slug": "" } was handed a permanent, unrenameable namespace it never
  // asked for, silently. validateVaultSlug already has an `empty` code for it.
  if (raw === undefined) return undefined;
  const verdict = validateVaultSlug(raw);
  if (!verdict.ok) throw new ApiError(400, verdict.message, verdict.code);
  return verdict.slug;
}
