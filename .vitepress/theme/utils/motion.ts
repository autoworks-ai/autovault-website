/**
 * Shared `prefers-reduced-motion` check for JS-driven animation.
 *
 * `styles.css` already zeroes CSS animations and transitions under the media
 * query, but the homepage also runs several `setInterval` loops that swap
 * content — those kept animating regardless, which is precisely the motion the
 * preference is meant to stop. `useTerminalReplay` had its own private copy of
 * this check; this is the same logic, shared.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
