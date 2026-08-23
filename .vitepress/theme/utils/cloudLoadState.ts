/**
 * When /cloud is allowed to stop saying "loading" and make a claim.
 *
 * This lives outside CloudPage.vue on purpose. Everything else that decides
 * what the dashboard renders is a source-asserted computed inside a single-file
 * component, which a node-environment test can read but cannot run — and the
 * defect these two predicates exist to fix is a *logic* one, not a structural
 * one. The page rendered "you are signed out and have not paid" to a signed-in,
 * paying owner, from code that looked entirely reasonable, because the values
 * it read had not arrived yet. That is exactly the kind of mistake a truth
 * table catches and a grep does not.
 *
 * The rule underneath both functions is one sentence: an empty value is not an
 * answer. `user`, `subscription`, `vault` and `devices` all start empty, and
 * empty is indistinguishable from "no account", "not subscribed", "no vault"
 * and "no machine linked" — the four claims the funnel is built to make.
 */

export type CloudStateSignals = {
  /** An /api/me response — any /api/me response — has landed. */
  hydrated: boolean;
  /**
   * Whether the visitor was signed in at the moment that response was
   * REQUESTED, or null if none has landed. Captured at request time because
   * Clerk can resolve while the fetch is in flight.
   */
  loadedSignedIn: boolean | null;
  /** Clerk has decided whether there is a session (always true without Clerk). */
  authSettled: boolean;
  /** Clerk's answer, once it has one. */
  clerkSignedIn: boolean;
  /** The bounded-wait backstop has fired; stop waiting and render something. */
  patienceExpired: boolean;
};

/**
 * True when the page holds an /api/me that can actually speak for this visitor.
 *
 * The load this page fires on mount goes out before Clerk resolves, so it is
 * anonymous, and it comes back "no user, no subscription, no vault" — true of
 * the request, and silent about the person. Trusting it is the whole bug: the
 * boot veil dropped and a provisioned owner was shown a checkout button until
 * the authenticated follow-up landed.
 *
 * So a response counts only when the auth context it was sent under matches
 * the one Clerk finally reports. That single comparison also covers the
 * reverse: a visitor who signs out mid-session goes back to unknown until a
 * fresh anonymous load confirms it, rather than keeping a stale signed-in view.
 */
export function cloudStateIsKnown(signals: CloudStateSignals): boolean {
  // Never claim knowledge with nothing in hand, patience or no patience. This
  // conjunct is what keeps the prerendered HTML and the client's first render
  // identical: `hydrated` is false in both.
  if (!signals.hydrated) return false;
  if (signals.patienceExpired) return true;
  if (!signals.authSettled) return false;
  return signals.loadedSignedIn === signals.clerkSignedIn;
}

export type DeviceListSignals = {
  /**
   * Whether the vault predates this page load. A vault that already existed
   * may already have a machine linked; one provisioned during this session is
   * seconds old and cannot, so there is nothing to wait for.
   */
  gateArmed: boolean;
  /** A device list request was parsed for the vault currently in state. */
  listAnswered: boolean;
  patienceExpired: boolean;
};

/**
 * True when `cliLinked` is safe to read.
 *
 * The same conflation one level down, and the cause of the second half of the
 * complaint: `devices` starts as an empty array, so cliLinked is false before
 * the list has said anything, so a returning owner's stage resolves to
 * "connect" and the typed connect-terminal replay plays at somebody who
 * connected months ago.
 */
export function deviceListIsKnown(signals: DeviceListSignals): boolean {
  if (!signals.gateArmed) return true;
  return signals.listAnswered || signals.patienceExpired;
}
