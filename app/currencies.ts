/**
 * Supported display currencies for the storefront pricing table (fixed-amount
 * discounts). Shared between the Settings route (client) and the settings model
 * (server) so validation uses a single source of truth. Keep this a plain,
 * non-`.server` module — it is imported into client component code.
 */

export const CURRENCY_OPTIONS: { label: string; value: string }[] = [
  { label: "USD – US Dollar", value: "USD" },
  { label: "EUR – Euro", value: "EUR" },
  { label: "GBP – British Pound", value: "GBP" },
  { label: "CAD – Canadian Dollar", value: "CAD" },
  { label: "AUD – Australian Dollar", value: "AUD" },
  { label: "JPY – Japanese Yen", value: "JPY" },
  { label: "INR – Indian Rupee", value: "INR" },
];

/** Set of allowed currency codes, for O(1) validation. */
export const CURRENCY_CODES = new Set(CURRENCY_OPTIONS.map((o) => o.value));

export function isSupportedCurrency(code: unknown): code is string {
  return typeof code === "string" && CURRENCY_CODES.has(code);
}

/**
 * The display symbol for a currency code (e.g. "EUR" → "€", "USD" → "$"),
 * derived via Intl so we don't maintain a symbol table. Falls back to the code
 * itself for anything Intl can't resolve, so the UI never shows the wrong
 * currency's symbol. Used for money prefixes/suffixes in the admin UI.
 */
export function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value || code;
  } catch {
    return code;
  }
}
