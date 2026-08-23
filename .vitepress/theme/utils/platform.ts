/**
 * Which install command to preselect for the machine a visitor is on.
 *
 * Pure and exported so the user-agent rules are actually testable — the
 * component can only read `navigator`, and the interesting cases are all
 * user-agent strings that lie.
 */
export type InstallMethod = "npm" | "curl" | "brew";

export interface DetectedPlatform {
  method: InstallMethod;
  label: string;
}

/**
 * Returns null when we should not guess at all, and the caller should leave
 * the default tab alone.
 *
 * @param userAgent      `navigator.userAgent`
 * @param maxTouchPoints `navigator.maxTouchPoints`
 */
export function installMethodFor(
  userAgent: string,
  maxTouchPoints: number
): DetectedPlatform | null {
  if (!userAgent) return null;

  // Phones and tablets first, because none of the three commands can run on
  // one and every branch below would otherwise claim one of them.
  //
  // Android reports "Linux", so the Linux branch would offer `curl … | sh`.
  // iPadOS is worse: since 13 it reports a desktop "Macintosh; Intel Mac OS X"
  // user agent that is character-for-character a Mac. maxTouchPoints is the
  // only reliable way to tell them apart — a Mac reports 0 (or 1 with a
  // touchpad), an iPad reports 5.
  if (/iPhone|iPod|iPad|Android/i.test(userAgent)) return null;
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return null;

  // ChromeOS reports "X11; CrOS x86_64", which the X11 fallback below would
  // read as Linux. A Chromebook has no shell for `curl … | sh` unless the
  // optional Linux development environment has been turned on, and nothing in
  // the user agent says whether it has -- so decline rather than present an
  // installer as detected-compatible.
  if (/CrOS/.test(userAgent)) return null;

  // Windows declines too, for the same reason as everything above it: the
  // user agent cannot answer the question that matters. This page states
  // Windows support as WSL2, and nothing in a browser UA reveals whether WSL2
  // is installed or which shell the visitor will paste into — so labelling the
  // tab "Windows" would claim a compatibility we cannot see.
  //
  // Declining costs nothing here: npm is already the default, so a Windows
  // visitor sees exactly what they saw before, minus a claim we cannot back.
  if (/Windows|Win64|Win32/i.test(userAgent)) return null;

  // curl elsewhere: it is the only channel with no prerequisite of its own
  // (brew needs Homebrew, npm needs Node 24+) and the one that provisions
  // ~/.autovault and bootstraps the bundled skills.
  if (/Mac OS X|Macintosh/i.test(userAgent)) return { method: "curl", label: "macOS" };
  if (/Linux|X11/i.test(userAgent)) return { method: "curl", label: "Linux" };

  return null;
}
