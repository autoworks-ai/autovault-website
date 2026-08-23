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

  // Windows before the rest: `curl … | sh` has no shell to run in on
  // PowerShell or cmd, and brew does not exist there, so npm is the only line
  // that works. A WSL2 user still reports a Windows UA, and npm works there.
  if (/Windows|Win64|Win32/i.test(userAgent)) return { method: "npm", label: "Windows" };

  // curl elsewhere: it is the only channel with no prerequisite of its own
  // (brew needs Homebrew, npm needs Node 24+) and the one that provisions
  // ~/.autovault and bootstraps the bundled skills.
  if (/Mac OS X|Macintosh/i.test(userAgent)) return { method: "curl", label: "macOS" };
  if (/Linux|X11/i.test(userAgent)) return { method: "curl", label: "Linux" };

  return null;
}
