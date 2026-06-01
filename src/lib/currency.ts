/**
 * Currency + region helpers shared by client and server.
 *
 * - Subscription currency is binary: EUR for Europe, USD everywhere else.
 * - The profile lets the user pick a display currency (EUR / USD / CZK / PLN)
 *   for product prices; that choice also decides which catalogue market
 *   (EU vs US) they see.
 */

export type Currency = "EUR" | "USD" | "CZK" | "PLN";
export type SubCurrency = "EUR" | "USD";
export type Market = "EU" | "US";

export const PROFILE_CURRENCIES: Currency[] = ["EUR", "USD", "CZK", "PLN"];

/** FX table — units per 1 EUR (same basis as the feed importer). */
export const FX: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  CZK: 25.0,
  PLN: 4.3,
  CAD: 1.47,
  GBP: 0.85,
};

const PREFIX_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  CAD: "CA$",
  GBP: "£",
};
const SUFFIX_SYMBOL: Record<string, string> = {
  CZK: "Kč",
  PLN: "zł",
};

/** ISO-3166 alpha-2 codes treated as "Europe" → EUR subscription pricing. */
export const EUROPE = new Set([
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA + UK + CH + micro-states
  "IS", "LI", "NO", "GB", "CH", "MC", "AD", "SM", "VA",
]);

/** Convert an EUR amount into the target currency. */
export function convertFromEur(eur: number, currency?: string | null): number {
  const rate = FX[(currency || "EUR").toUpperCase()] ?? 1;
  return eur * rate;
}

/** Format an EUR amount in the target currency (rounded, localized symbol). */
export function formatMoney(
  eur: number,
  currency?: Currency | string | null,
): string {
  const cur = (currency || "EUR").toUpperCase();
  const value = Math.round(convertFromEur(eur, cur));
  const amount = value.toLocaleString("en-US");
  if (SUFFIX_SYMBOL[cur]) return `${amount} ${SUFFIX_SYMBOL[cur]}`;
  return `${PREFIX_SYMBOL[cur] ?? ""}${amount}`;
}

/** Subscription currency for a visitor country (ISO2). Europe → EUR, else USD. */
export function subscriptionCurrency(country?: string | null): SubCurrency {
  if (country && EUROPE.has(country.toUpperCase())) return "EUR";
  return "USD";
}

/** Default profile currency for a visitor country (ISO2). */
export function defaultCurrencyForCountry(country?: string | null): Currency {
  const c = country?.toUpperCase();
  if (c === "CZ") return "CZK";
  if (c === "PL") return "PLN";
  if (c && EUROPE.has(c)) return "EUR";
  return "USD";
}

/** Which catalogue market a profile currency maps to. */
export function marketForCurrency(currency?: string | null): Market {
  return currency?.toUpperCase() === "USD" ? "US" : "EU";
}

/**
 * Subscription tier prices per currency. Kept as clean, market-appropriate
 * numbers rather than raw FX conversions of the EUR list.
 */
export const TIER_PRICES: Record<
  SubCurrency,
  {
    free: string;
    basic: string;
    lookbook: string;
    premium: string;
    membership: string;
    business: string;
  }
> = {
  EUR: {
    free: "€0",
    basic: "€24",
    lookbook: "€44",
    premium: "€89",
    membership: "€14.99",
    business: "€99",
  },
  USD: {
    free: "$0",
    basic: "$26",
    lookbook: "$48",
    premium: "$96",
    membership: "$16.99",
    business: "$109",
  },
};
