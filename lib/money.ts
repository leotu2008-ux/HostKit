/**
 * Money is stored and passed around as integer cents, everywhere, always.
 * Floats are never used for currency: 0.1 + 0.2 !== 0.3, and a budget that
 * drifts by a cent per operation loses the user's trust faster than a bug.
 */

/** Formats cents as currency. Whole amounts drop the ".00" — budgets are
 *  read at a glance, and "$12,000" scans faster than "$12,000.00". */
export function formatCents(cents: number, currency = "USD"): string {
  const hasFraction = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(cents / 100);
}

/** Compact form for dense UI like listing cards: $4.2k, $12k, $1.1M. */
export function formatCentsCompact(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars < 1000) return `$${dollars}`;
  if (dollars < 1_000_000) {
    const k = dollars / 1000;
    // 4.2k below ten thousand, then 12k — one significant decimal is enough.
    return k < 10 ? `$${trimZero(k.toFixed(1))}k` : `$${Math.round(k)}k`;
  }
  const m = dollars / 1_000_000;
  return m < 10 ? `$${trimZero(m.toFixed(1))}M` : `$${Math.round(m)}M`;
}

function trimZero(value: string): string {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

/** Parses user input ("1,200", "$1200.50", "1200") into cents.
 *  Returns null for anything that isn't a non-negative amount, so callers are
 *  forced to handle bad input rather than silently banking a NaN. */
export function parseCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Splits `totalCents` across weights that sum to 1, without losing or
 *  inventing a cent. The largest remainder takes the rounding drift, so the
 *  parts always add back up to exactly the total. */
export function allocateCents(
  totalCents: number,
  weights: number[],
): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (totalCents * w) / weightSum);
  const floored = exact.map(Math.floor);
  let remainder = totalCents - floored.reduce((a, b) => a + b, 0);

  // Hand the leftover cents to the largest fractional parts first.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    result[order[i].index] += 1;
  }
  return result;
}

/** Percentage of `totalCents` that `partCents` represents, 0-100, rounded.
 *  A zero total yields 0 rather than Infinity — an unallocated budget category
 *  should read as "no budget set", not crash the page. */
export function percentOf(partCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round((partCents / totalCents) * 100);
}
