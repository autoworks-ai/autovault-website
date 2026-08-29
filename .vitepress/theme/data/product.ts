export const PRODUCT_VERSION = "v0.5.0";
export const PRODUCT_VERSION_SHORT = "0.5.0";
export const PRODUCT_STATUS = "pre-1.0";
export const PRODUCT_VERSION_BADGE = `${PRODUCT_VERSION} · ${PRODUCT_STATUS} · MIT`;
export const PRODUCT_RELEASE_LABEL = `${PRODUCT_VERSION} · 2026-08`;

/**
 * Hosted trial length, in days, for copy that is rendered at BUILD time.
 *
 * The running site does not read this. /cloud reads trial_days off
 * /api/pricing, which reads hostedTrialDays(env), which reads the same
 * AUTOVAULT_HOSTED_TRIAL_DAYS that buildHostedVaultCheckoutParams sends to
 * Stripe. That chain has no literals in it and cannot drift.
 *
 * Static surfaces have no runtime, so agent markdown and the landing page need
 * a number they can print at build time. This is that number, and
 * tests/hostedTrial.test.ts fails if it stops matching wrangler.toml. Set the
 * var to 0 and the pair still has to move together, which is the point: the
 * test is the thing that stops a retired trial living on in prose.
 */
// Annotated `number`, not left as the literal 14: every guard that asks
// whether a trial exists is meaningful, and a literal type makes TypeScript
// call those comparisons unreachable and refuse to compile them.
export const HOSTED_TRIAL_DAYS: number = 14;
