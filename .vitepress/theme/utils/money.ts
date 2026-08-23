/**
 * Render a Stripe amount as a price label.
 *
 * Stripe expresses amounts in the currency's *minor* unit, and there are not
 * always a hundred of those to a major unit: JPY and KRW have none, so 1500
 * means 1500 yen rather than 15, and BHD/JOD/KWD have a thousand. Dividing by
 * 100 is right for USD and silently wrong elsewhere, so the exponent comes
 * from Intl rather than from an assumption.
 *
 * Pure and exported so the currency behaviour is actually testable — this file
 * exists because a hardcoded /100 shipped and had to be caught in review.
 */
export function formatPriceLabel(
  amount: number | null,
  currency: string | null,
  interval: string | null,
  // Defaults to the visitor's own locale. Only tests pass this, so that
  // grouping and decimal separators stay deterministic across CI machines.
  locale?: string
): string | null {
  if (amount === null || !currency) return null;

  const code = currency.toUpperCase();

  // Two different exponents, and conflating them is the bug this guards.
  //
  // Intl reports how a currency is DISPLAYED. Stripe's unit_amount is in
  // whatever unit Stripe BILLS in, and for three currencies those disagree,
  // per Stripe's own "special cases" table plus its minimum-charge list:
  //   ISK, UGX -- moved to zero-decimal, but backward compatibility means
  //               Stripe still takes them in hundredths, always ending 00.
  //               Stripe's example: amount 500 is 5 ISK. Intl says 0 digits.
  //   HUF      -- Stripe's zero-decimal handling is payouts-only; charges are
  //               two-decimal (its stated minimum charge is 175.00 HUF).
  //               Intl says 0 digits.
  // Display still follows Intl: nobody writes ISK or HUF with decimals.
  const STRIPE_MINOR_UNITS: Record<string, number> = { ISK: 2, UGX: 2, HUF: 2 };

  const displayExponent =
    new Intl.NumberFormat(locale, { style: "currency", currency: code })
      .resolvedOptions().maximumFractionDigits ?? 2;
  const amountExponent = STRIPE_MINOR_UNITS[code] ?? displayExponent;
  const major = amount / 10 ** amountExponent;

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    // Trim a trailing .00 — "$15 / month" reads better than "$15.00 / month" —
    // while leaving a genuinely fractional amount intact.
    minimumFractionDigits: Number.isInteger(major) ? 0 : displayExponent,
  }).format(major);

  return interval ? `${money} / ${interval}` : money;
}
