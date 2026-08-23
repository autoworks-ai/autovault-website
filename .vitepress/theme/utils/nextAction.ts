/**
 * Which control is the one thing to do next.
 *
 * The complaint this answers, verbatim: "it's not always clear what you need
 * to do to proceed to the next step because there's one button on each page
 * that completes that page and it moves around sometimes in the center,
 * sometimes it's in the far right."
 *
 * The fix is NOT to move the buttons to a common position. That was considered
 * and rejected for a concrete reason: Admit is bound to a specific device row,
 * and with two machines pending, a centred "Admit" is ambiguous about which one
 * — which is how the wrong box gets vault access. Consistent *treatment*, not
 * consistent *position*: one shared marker (`.av-nextaction`), applied to
 * whichever control is currently the single required action, wherever that
 * control happens to live.
 *
 * This module exists so that "exactly one marker on screen" is a property of a
 * pure function that can be tested by RUNNING it, rather than a claim about
 * three `v-if`s in two components that a source match could only pretend to
 * check. Every branch below returns one site or none — never a set — so two
 * markers is not a bug that can be introduced by editing a template.
 */

/**
 * `funnel`        — the pre-vault primary: Create your account / Open checkout
 *                   / Reserve namespace, in HostedVaultFunnel.
 * `admit`         — the Admit button on the `?admit=` target row, in
 *                   CloudPage's Machines card.
 * `early-access`  — the status strip's "Get early access", in CloudPage.
 * `null`          — nothing to mark: the page does not know its state yet, the
 *                   load failed, everything is done, or the only remaining
 *                   action is one this page cannot single out.
 */
export type CloudNextAction = "funnel" | "admit" | "early-access" | null;

export interface CloudNextActionInput {
  /** CloudPage's `stage`. */
  stage: string;
  /**
   * A pending machine this page did not choose: the `?admit=` target, whose
   * fingerprint the CLI put in the URL.
   *
   * Named rather than merely present. "The only pending row there is" looks
   * equally unambiguous and is not — see the trace in CloudPage's call site.
   */
  namedPendingMachine: boolean;
  /** The Machines card is one of the panels currently rendered. */
  machinesOnScreen: boolean;
}

export function cloudNextAction({
  stage,
  namedPendingMachine,
  machinesOnScreen,
}: CloudNextActionInput): CloudNextAction {
  // Three stages have nothing to mark, for three different reasons, and they
  // come first so no later branch can talk over them.
  //
  // `loading`: the page does not know what state this account is in — marking
  // the funnel's button here is the same class of confident-and-wrong claim
  // the loading stage was introduced to stop making. It is also behind the
  // boot veil, so the marker would be spent where nobody could see it.
  // `error`: the only control is Try again, which is a recovery, not a step.
  // `ready`: nothing is left to do, and a marker pointing at nothing is worse
  // than none — it is the page insisting there is another step.
  if (stage === "loading" || stage === "error" || stage === "ready") return null;

  // A machine sitting in a spinner outranks anything else on screen: a CLI on
  // the other end of it is blocked until this click happens. This is also what
  // keeps `explore` from showing two markers — a second machine can enrol long
  // after the first one opened the vault, and then both this and the status
  // strip's CTA are rendered at once.
  //
  // Gated on the card actually being rendered rather than merely on the
  // machine existing: the owner can be reading Billing, where the Admit button
  // is in a panel Vue is not rendering, and a marker on an element that is not
  // in the DOM is no marker at all. In that case the fall-through below marks
  // the action that IS on screen.
  if (namedPendingMachine && machinesOnScreen) return "admit";

  // The vault is open and the one thing left is asking for early access.
  if (stage === "explore") return "early-access";

  // Pre-vault: account -> subscription -> setup, one primary button each.
  if (stage === "account" || stage === "subscription" || stage === "setup") {
    return "funnel";
  }

  // `connect`, with no machine this page can name. Deliberately unmarked, and
  // this is the branch that carries the whole restraint.
  //
  // Machines pending and nothing in the URL naming one is the exact ambiguity
  // the marker must not manufacture: whichever Admit it pointed at would be a
  // guess presented as an instruction, and the thing being granted is vault
  // access. That holds at one pending row as firmly as at two — see the call
  // site — because the count changes under the owner's hand.
  //
  // With none pending there is no button here at all: the action is running a
  // command in a terminal this page cannot reach, which the transcript above
  // already spells out.
  return null;
}
