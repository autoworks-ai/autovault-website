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

export async function provisionVault(env, user) {
  const subscription = await getSubscription(env, user.id);
  if (!subscription.active) throw new ApiError(402, "Active hosted vault subscription required.");

  const existing = await getCurrentVault(env, user.id);
  if (existing) return existing;

  const slug = await vaultSlugForUser(user);
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
  await run(env, `
    insert into vaults (id, user_id, slug, status, public_url, created_at, provisioned_at)
    values (?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do nothing
  `, vault.id, vault.user_id, vault.slug, vault.status, vault.public_url, vault.created_at, vault.provisioned_at);

  return (await getCurrentVault(env, user.id)) ?? vault;
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

async function vaultSlugForUser(user) {
  const base = slugify(user.email || user.name || "team");
  const suffix = (await sha256Hex(user.id)).slice(0, 6);
  return `${base}-${suffix}`;
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
