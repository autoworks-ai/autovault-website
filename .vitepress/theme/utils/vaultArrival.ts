/**
 * One-shot gate for the hosted vault's arrival flourish.
 *
 * The policy is "ambient always, celebrate once": the vault is quietly present
 * behind the dashboard on every load, and swells exactly once — on the first
 * load after checkout, or on the first load of a browsing session (which is
 * what a fresh sign-in produces, since Clerk hands the user back to
 * `/cloud#launch-path` in a tab that has not shown this page yet).
 *
 * Two occasions rather than one flag, because one flag cannot express both:
 *
 * - `session` is spent by the first signed-in load in a tab. That is the
 *   fresh-login case, and it is also what stops every subsequent reload and
 *   every SPA navigation back to /cloud from re-celebrating.
 * - `checkout` is spent by the return from Stripe, which carries
 *   `?hosted=success` (functions/api/_lib/stripe.js builds the success_url).
 *   It is deliberately independent: the owner was already on /cloud before
 *   they left for Stripe, so `session` is normally already spent by the time
 *   they come back, and a single flag would swallow the one moment the ask
 *   named first.
 *
 * Keying each occasion under its own storage key — rather than storing "the
 * last occasion seen" — is what makes the order safe. Storing one value meant
 * that after the checkout celebration, a plain reload (occasion `session`)
 * differed from the stored `checkout` and celebrated again.
 *
 * The relationship between the two is one-way: any arrival spends `session`,
 * because it *was* this session's arrival, while only a checkout return spends
 * `checkout`. Without that, a tab whose very first load is the Stripe return
 * has never spent `session`, and the next plain reload celebrates a second
 * time.
 */
export type VaultArrivalOccasion = "checkout" | "session";

const CONSUMED_PREFIX = "av-cloud-vault-arrival:";

/**
 * Fallback ledger for when sessionStorage is unreachable — Safari private
 * browsing throws on write, and embedded/partitioned contexts can throw on the
 * property access itself. Module scope, so it lives exactly as long as the
 * document does; that is shorter than a tab session but long enough to cover
 * the VitePress SPA remounts that would otherwise re-fire on every navigation
 * back to /cloud.
 */
const consumedInMemory = new Set<string>();

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    const candidate = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

/** Which arrival this load is, from the page's query string. */
export function vaultArrivalOccasion(search: string): VaultArrivalOccasion {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search ?? "");
  } catch {
    return "session";
  }
  return params.get("hosted") === "success" ? "checkout" : "session";
}

/**
 * True at most once per occasion, and marks it spent.
 *
 * Both ledgers are consulted, never one or the other: the in-memory set is a
 * strict subset of what storage would hold when storage works, so checking it
 * as well can only ever suppress a duplicate, never invent one.
 */
export function consumeVaultArrival(search: string, storage?: Storage | null): boolean {
  const occasion = vaultArrivalOccasion(search);
  const key = `${CONSUMED_PREFIX}${occasion}`;
  const store = resolveStorage(storage);

  if (consumedInMemory.has(key)) return false;
  try {
    if (store?.getItem(key)) {
      // Storage remembers a celebration this document has not seen — a reload,
      // or a second tab. Mirror it so the check above answers next time.
      consumedInMemory.add(key);
      return false;
    }
  } catch {
    // Unreadable storage is not evidence of anything; fall through to the
    // in-memory ledger, which has already said no.
  }

  // Spend the occasion, and `session` along with it. See the header comment:
  // every arrival is this session's arrival, so a checkout return has to close
  // the door on the plain reload that follows it.
  for (const spent of new Set([key, `${CONSUMED_PREFIX}session`])) {
    consumedInMemory.add(spent);
    try {
      store?.setItem(spent, "1");
    } catch {
      // Write refused (private browsing). The in-memory ledger still holds for
      // this document, which is the case that actually repeats.
    }
  }
  return true;
}

/**
 * Is this cloud state the *authenticated* answer, or still the anonymous one?
 *
 * The arrival has to wait for this, because the page's `signedIn` deliberately
 * ORs in the live Clerk flag: it turns true a whole `/api/me` before the
 * authenticated payload lands, so a returning owner would otherwise spend
 * their one arrival watching a LOCKED mark swell while their open vault is
 * still in flight -- and the occasion is one-shot, so the real one never
 * plays.
 *
 * `user` alone is not the test. The funnel's provisioning path emits
 * `{ ...(current ?? { user: null }), vault }` (HostedVaultFunnel.vue), so the
 * checkout return -- the occasion the ask named first -- can carry a real
 * vault with a null user. Either field is proof: `/api/me` answers an
 * anonymous request with 200 and both null, and hands back a vault only for a
 * session it authenticated.
 */
export function isAuthenticatedCloudState(
  state:
    | { user?: unknown; vault?: unknown; [key: string]: unknown }
    | null
    | undefined
): boolean {
  return Boolean(state?.user) || Boolean(state?.vault);
}

/** Test seam. Never called from the page. */
export function resetVaultArrivalLedger(): void {
  consumedInMemory.clear();
}
