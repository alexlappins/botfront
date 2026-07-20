/**
 * Shop prices are stored in CENTS (integer, shop TZ §3): $99.99 → 9999.
 * Every display goes through these helpers so no page divides by 100 on its
 * own (or forgets to).
 */

/** 9999 → "$99.99" (or "99.99 EUR" for non-USD). */
export function formatCents(cents: number, currency: string): string {
  const v = (cents / 100).toFixed(2)
  return currency === "USD" ? `$${v}` : `${v} ${currency}`
}

/**
 * Admin price input → cents. Accepts both "." and "," as the decimal
 * separator ("99.99" / "99,99"), max 2 decimals kept. Returns null for
 * unparseable input.
 */
export function parsePriceToCents(input: string): number | null {
  const norm = input.trim().replace(",", ".")
  if (!norm) return null
  const n = Number(norm)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/** Cents → "99.99" for prefilling the admin input. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "")
}
