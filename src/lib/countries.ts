/**
 * Countries offered in the profile dropdown: all EU member states plus a set of
 * supported non-EU markets. `code` is the ISO-3166 alpha-2 used to match Vercel
 * geolocation; `name` is what we store on the profile (climate inference etc.).
 */
export type Country = { code: string; name: string };

const EU: Country[] = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
];

const OTHER: Country[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "PA", name: "Panama" },
  { code: "GB", name: "United Kingdom" },
  { code: "RS", name: "Serbia" },
  { code: "UA", name: "Ukraine" },
  { code: "MD", name: "Moldova" },
  { code: "GE", name: "Georgia" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "TR", name: "Turkey" },
  { code: "ME", name: "Montenegro" },
];

export const COUNTRIES: Country[] = [...EU, ...OTHER].sort((a, b) =>
  a.name.localeCompare(b.name),
);

/** Canonical country name for a given ISO2 code, if supported. */
export function countryNameFromCode(code?: string | null): string | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name;
}
