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
  const exponent =
    new Intl.NumberFormat(locale, { style: "currency", currency: code })
      .resolvedOptions().maximumFractionDigits ?? 2;
  const major = amount / 10 ** exponent;

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    // Trim a trailing .00 — "$15 / month" reads better than "$15.00 / month" —
    // while leaving a genuinely fractional amount intact.
    minimumFractionDigits: Number.isInteger(major) ? 0 : exponent,
  }).format(major);

  return interval ? `${money} / ${interval}` : money;
}
