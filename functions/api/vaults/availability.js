import { requireUser } from "../_lib/auth.js";
import { handleApi, json } from "../_lib/http.js";
import { isVaultSlugTaken, validateVaultSlug, VAULT_SLUG_TAKEN_MESSAGE } from "../_lib/vault.js";

/**
 * Is this namespace claimable? Answers the funnel's field while the user types.
 *
 * The verdict is the same one provisioning applies, because both call
 * validateVaultSlug -- so the field can never say "available" about a name the
 * reserve click then refuses on shape or reserved-word grounds. The one thing it
 * cannot promise is uniqueness: a slug free at 12:00:00 can be somebody else's at
 * 12:00:01, which is the race the funnel's design accepts and which
 * provisionVault turns into a 409 rather than a 500.
 */
export async function onRequestGet({ request, env }) {
  return handleApi(async () => {
    // Authenticated on purpose. Slugs are public once they exist, so this leaks
    // nothing new about any single name -- but an open endpoint that answers
    // "does this exist" for arbitrary input is a free enumeration oracle for the
    // whole customer list, and there is no rate limiter in front of Pages
    // Functions here. Requiring a session is the practical cost.
    await requireUser(request, env);

    const requested = new URL(request.url).searchParams.get("slug") ?? "";
    const verdict = validateVaultSlug(requested);
    if (!verdict.ok) {
      return json({
        slug: requested.trim().toLowerCase(),
        available: false,
        code: verdict.code,
        message: verdict.message
      });
    }

    if (await isVaultSlugTaken(env, verdict.slug)) {
      return json({ slug: verdict.slug, available: false, code: "taken", message: VAULT_SLUG_TAKEN_MESSAGE });
    }

    return json({ slug: verdict.slug, available: true, code: "available", message: "Available." });
  });
}
