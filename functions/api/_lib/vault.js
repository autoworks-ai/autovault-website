import { ApiError } from "./http.js";
import { first, nowIso, run } from "./db.js";
import { sha256Hex } from "./crypto.js";
import { isPaidStatus } from "./stripe.js";

export async function getSubscription(env, userId) {
  const row = await first(env, `
    select status, stripe_subscription_id, price_id, current_period_end
    from subscriptions
    where user_id = ?
  `, userId);
  return row ? { ...row, active: isPaidStatus(row.status) } : { active: false, status: null };
}

export async function getCurrentVault(env, userId) {
  return first(env, `
    select id, user_id, slug, status, public_url, created_at, provisioned_at, cli_linked_at, early_access_at
    from vaults
    where user_id = ?
  `, userId);
}

// Onboarding steps the dashboard can mark complete, mapped to their vault
// timestamp columns. Values come from this fixed allowlist only — never from
// request input — so interpolating the column name into SQL below is safe.
const VAULT_PROGRESS_COLUMNS = {
  cli_linked: "cli_linked_at",
  early_access: "early_access_at"
};

export async function markVaultProgress(env, user, step) {
  // `step` is raw request input. Plain property access would resolve inherited
  // keys — "__proto__", "constructor", "toString" and "valueOf" all return a
  // truthy value and sail past a `if (!column)` guard, reaching the
  // interpolated `update vaults set ${column}` below as e.g. "[object Object]".
  // Not injectable (the attacker cannot place their own text there), but it
  // turns a clean 400 into an opaque 500. hasOwn keeps the lookup on the
  // allowlist's own keys.
  if (typeof step !== "string" || !Object.hasOwn(VAULT_PROGRESS_COLUMNS, step)) {
    throw new ApiError(400, "Unknown onboarding step.");
  }
  const column = VAULT_PROGRESS_COLUMNS[step];

  const vault = await getCurrentVault(env, user.id);
  if (!vault) throw new ApiError(409, "Reserve a hosted vault before recording onboarding progress.");

  // Idempotent: only the first request stamps the column. The `is null` guard
  // keeps concurrent requests from clobbering an existing timestamp.
  if (!vault[column]) {
    await run(env, `update vaults set ${column} = ? where user_id = ? and ${column} is null`, nowIso(), user.id);
    // Re-read so the response reflects the actually-persisted timestamp, even if
    // a concurrent request won the guarded update with a different value.
    return (await getCurrentVault(env, user.id)) ?? vault;
  }

  return vault;
}

export const VAULT_SLUG_MIN_LENGTH = 3;
export const VAULT_SLUG_MAX_LENGTH = 32;

export const VAULT_SLUG_TAKEN_MESSAGE = "That namespace is already taken. Choose another.";

// Lowercase letters and digits, single hyphens only between them: no leading
// hyphen, no trailing hyphen, no doubled hyphen.
//
// Deliberately a strict SUBSET of the CLI's own CLOUD_SLUG_PATTERN
// (/^[a-z0-9][a-z0-9-]{0,62}$/ in autovault's src/sync/target.ts). Anything this
// accepts, `autovault link <slug>` resolves. The reverse is not true and must
// not be: the CLI has to keep resolving every slug that already exists, while a
// name being minted now can be held to a tighter shape. Same reason the bound
// is 32 rather than the CLI's 63 -- a slug is a permanent public path segment
// with no rename path, so it has to stay typeable.
const VAULT_SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Namespaces nobody may claim. A slug is not decoration: it is a public path
// segment at `/v/<slug>/` on autovault.dev (which the CLI resolves and enrolled
// devices pin to) and the root of vault.autovault.dev/<slug>. A name in this set
// is a route, or reads as one.
export const RESERVED_VAULT_SLUGS = new Set([
  // Paths this site already serves, plus the two prefixes its own routing owns
  // ("api", "v"). Claiming one lets a customer namespace pass for an AutoVault
  // page. Sourced from the repo's root pages, not guessed.
  "_redirects",
  "about",
  "api",
  "assets",
  // A served root page AND the first-party maintainer identity, so it lands in
  // both categories at once: `/author-autoworks-ai` is a real route, and a
  // customer holding that exact name answers as AutoWorks itself.
  "author-autoworks-ai",
  "authoring",
  "changelog",
  "cloud",
  "compare",
  "deploy",
  "docs",
  "hosted-sync",
  "index",
  "permissions",
  "public",
  "quick-start",
  "security",
  "skill",
  "skill-detail",
  "skills",
  "skills-directory",
  "static",
  "troubleshooting",
  "v",
  // The account and money surface. Every one of these is a URL a credential
  // harvesting page would like to be served from.
  "account",
  "auth",
  "billing",
  "callback",
  "dashboard",
  "login",
  "logout",
  "oauth",
  "settings",
  "signin",
  "signup",
  // The sync vocabulary -- these are the literal segments that live UNDER
  // `/v/<slug>/`, so a vault named "catalog" produces `/v/catalog/catalog.json`,
  // which reads as an official artifact rather than one customer's namespace.
  "bundles",
  "catalog",
  "devices",
  "sync",
  "vault",
  "vaults",
  // Impersonation: names that let one customer answer as AutoVault, as its
  // staff, or as infrastructure.
  "admin",
  "administrator",
  "help",
  "info",
  "mail",
  "moderator",
  "official",
  "postmaster",
  "root",
  "staff",
  "support",
  "system",
  "webmaster",
  "www"
]);

// Brand protection expressed as a rule rather than list entries, because
// enumerating "autovault-support", "autovault-official", "autovault-billing" and
// the rest is a game you lose. Blocks the bare word and anything hyphen-prefixed
// with it.
const RESERVED_VAULT_SLUG_PREFIX = "autovault";

/**
 * The single authority on whether a namespace may be claimed. The availability
 * endpoint and the provisioning path both call this, so a candidate can never
 * be told "available" by one and refused by the other.
 *
 * Returns a normalized slug on success, and a machine-readable `code` plus a
 * sentence on refusal. Callers decide the HTTP status; this decides validity.
 */
export function validateVaultSlug(value) {
  if (typeof value !== "string") return refuseSlug("empty", "Choose a namespace.");
  const slug = value.trim().toLowerCase();
  if (!slug) return refuseSlug("empty", "Choose a namespace.");
  if (slug.length < VAULT_SLUG_MIN_LENGTH) {
    return refuseSlug("too_short", `Namespaces are at least ${VAULT_SLUG_MIN_LENGTH} characters.`);
  }
  if (slug.length > VAULT_SLUG_MAX_LENGTH) {
    return refuseSlug("too_long", `Namespaces are at most ${VAULT_SLUG_MAX_LENGTH} characters.`);
  }
  if (!VAULT_SLUG_SHAPE.test(slug)) {
    return refuseSlug("invalid_characters", "Use lowercase letters and numbers, with single hyphens between them.");
  }
  if (isReservedVaultSlug(slug)) {
    return refuseSlug("reserved", "That namespace is reserved. Choose another.");
  }
  return { ok: true, slug, code: "available", message: "" };
}

function isReservedVaultSlug(slug) {
  if (RESERVED_VAULT_SLUGS.has(slug)) return true;
  return slug === RESERVED_VAULT_SLUG_PREFIX || slug.startsWith(`${RESERVED_VAULT_SLUG_PREFIX}-`);
}

function refuseSlug(code, message) {
  return { ok: false, slug: null, code, message };
}

export async function isVaultSlugTaken(env, slug) {
  const row = await first(env, `select id from vaults where slug = ?`, slug);
  return Boolean(row);
}

/**
 * @param {string} [requestedSlug] The namespace the user typed, if any.
 *
 * Anything this cannot use falls back to the derived slug, so existing callers
 * that pass nothing keep their exact behavior and no future caller can persist
 * a name that never passed the validator. The HTTP boundary in
 * `vaults/provision.js` is stricter on purpose: a person who just typed a name
 * gets a 400 explaining why, because silently renaming a permanent,
 * CLI-pinned identifier is worse than refusing it.
 */
export async function provisionVault(env, user, requestedSlug) {
  const subscription = await getSubscription(env, user.id);
  if (!subscription.active) throw new ApiError(402, "Active hosted vault subscription required.");

  const existing = await getCurrentVault(env, user.id);
  if (existing) return existing;

  const requested = validateVaultSlug(requestedSlug);
  const chosen = requested.ok ? requested.slug : null;

  // Only the requested path pays for this lookup. The derived path deliberately
  // does not pre-check: it is unique by construction (six hex of sha256 of the
  // user id), so a query there would be a round trip per provision to catch a
  // case the catch block below already handles.
  if (chosen && await isVaultSlugTaken(env, chosen)) {
    throw new ApiError(409, VAULT_SLUG_TAKEN_MESSAGE, "taken");
  }

  const slug = chosen ?? await vaultSlugForUser(user);

  try {
    return await insertVault(env, user, slug);
  } catch (error) {
    if (!isSlugCollision(error)) throw error;

    // Same-user concurrency can arrive here rather than through the user_id
    // conflict target: when the loser's slug is identical to the winner's, both
    // UNIQUE indexes are violated and which error surfaces is SQLite's choice.
    // Their row exists either way, and it is the answer both callers want.
    const landed = await getCurrentVault(env, user.id);
    if (landed) return landed;

    // The requested-slug race, which the funnel's design accepts: availability
    // said free, somebody claimed it between the check and this insert. It is
    // the user's decision to remake, so say so rather than renaming them.
    if (chosen) throw new ApiError(409, VAULT_SLUG_TAKEN_MESSAGE, "taken");

    // A slug the server derived. The user never chose it and cannot be asked to
    // choose another, so re-mint with extra entropy instead of failing them.
    return retryDerivedSlug(env, user, slug);
  }
}

async function insertVault(env, user, slug) {
  const vault = {
    id: crypto.randomUUID(),
    user_id: user.id,
    slug,
    status: "reserved",
    public_url: `https://vault.autovault.dev/${slug}`,
    created_at: nowIso(),
    provisioned_at: nowIso(),
    cli_linked_at: null,
    early_access_at: null
  };

  // vaults.user_id is UNIQUE, and the read above is not in a transaction with
  // this write. Two concurrent provision requests both see `existing === null`
  // and the loser used to raise an uncaught constraint error -> 500. `do
  // nothing` makes the loser a no-op; the re-read below returns whichever row
  // actually landed, so both callers get the same vault.
  //
  // vaults.slug is a SEPARATE UNIQUE index and this conflict target does not
  // cover it, so a slug clash still raises. That is deliberate: swallowing it
  // would leave the re-read empty and hand the caller a vault object that was
  // never written. provisionVault catches it above and turns it into a 409.
  await run(env, `
    insert into vaults (id, user_id, slug, status, public_url, created_at, provisioned_at)
    values (?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do nothing
  `, vault.id, vault.user_id, vault.slug, vault.status, vault.public_url, vault.created_at, vault.provisioned_at);

  return (await getCurrentVault(env, user.id)) ?? vault;
}

async function retryDerivedSlug(env, user, slug) {
  const base = truncateSlugBase(slug, 7);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await insertVault(env, user, `${base}-${randomHex(3)}`);
    } catch (error) {
      if (!isSlugCollision(error)) throw error;
      const landed = await getCurrentVault(env, user.id);
      if (landed) return landed;
    }
  }
  throw new ApiError(409, VAULT_SLUG_TAKEN_MESSAGE, "taken");
}

// Matched on the message rather than on a code: node:sqlite reports
// `SQLITE_CONSTRAINT_UNIQUE` on `error.code`, D1 reports a string like
// "D1_ERROR: UNIQUE constraint failed: vaults.slug: SQLITE_CONSTRAINT" and no
// code at all. The constraint name is the one part both spell identically.
function isSlugCollision(error) {
  const text = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
  return /unique constraint failed:\s*vaults\.slug/i.test(text);
}

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function savePendingSkill(env, user, vault, input) {
  const sourceText = typeof input.source_text === "string" ? input.source_text : "";
  const queuedSkills = Array.isArray(input.queued_skills) ? input.queued_skills.slice(0, 12).map(String) : [];
  if (!sourceText && queuedSkills.length === 0) throw new ApiError(400, "Pending import requires a skill draft or queued starter skills.");
  if (sourceText.length > 100_000) throw new ApiError(413, "Skill draft is too large.");
  if (sourceText && !env.AUTOVAULT_VAULT_OBJECTS) throw new ApiError(503, "AUTOVAULT_VAULT_OBJECTS binding is not configured.");

  const id = crypto.randomUUID();
  const sourceHash = sourceText ? await sha256Hex(sourceText) : null;
  const skillName = sanitizeSkillName(input.skill_name) || (sourceText ? "pasted-skill" : "starter-skills");
  const createdAt = nowIso();

  await run(env, `
    insert into pending_skills (id, vault_id, user_id, name, version, source_label, source_hash, source_text, signature, queued_skills_json, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, id, vault.id, user.id, skillName, cleanString(input.version), cleanString(input.source_label), sourceHash, sourceText || null, cleanString(input.signature), JSON.stringify(queuedSkills), createdAt);

  if (sourceText) {
    await env.AUTOVAULT_VAULT_OBJECTS.put(`vaults/${vault.id}/pending/${id}.md`, sourceText, {
      metadata: { user_id: user.id, vault_id: vault.id, skill_name: skillName, source_hash: sourceHash }
    });
  }

  return { id, vault_id: vault.id, name: skillName, source_hash: sourceHash, queued_skills: queuedSkills, created_at: createdAt };
}

// The name a user gets when they express no preference.
//
// Now truncated so the result satisfies validateVaultSlug. It used to append
// "-" plus six characters to an unbounded base, which is the upstream defect
// _lib/sync.js documents at SLUG_SHAPE: provisioning could mint a slug past the
// CLI's own 63-character CLOUD_SLUG_PATTERN, and `autovault link <slug>` then
// refused to resolve a namespace this service had handed out. It also has to
// hold now for a second reason -- this value prefills the namespace field, so a
// suggestion the validator rejects would present the default path as broken.
export async function vaultSlugForUser(user) {
  const suffix = (await sha256Hex(user.id)).slice(0, 6);
  const base = truncateSlugBase(slugify(user.email || user.name || "team"), suffix.length + 1);
  const candidate = `${base}-${suffix}`;
  // A base that lands on a reserved word ("admin@", "support@") or the brand
  // prefix would otherwise mint a suggestion the field immediately refuses.
  return validateVaultSlug(candidate).ok ? candidate : `team-${suffix}`;
}

// Cuts a base down so `<base>-<suffix>` still fits VAULT_SLUG_MAX_LENGTH, and
// never leaves it ending on a hyphen (which the shape rule forbids).
function truncateSlugBase(base, reservedLength) {
  const trimmed = base.slice(0, VAULT_SLUG_MAX_LENGTH - reservedLength).replace(/-+$/, "");
  return trimmed || "team";
}

function slugify(value) {
  const slug = String(value).split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "team";
}

function sanitizeSkillName(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return "";
  return cleaned.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function cleanString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 240) : null;
}
