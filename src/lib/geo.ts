import "server-only";
import { headers } from "next/headers";
import {
  subscriptionCurrency,
  defaultCurrencyForCountry,
  type Currency,
  type SubCurrency,
} from "@/lib/currency";

export type Geo = {
  country: string | null; // ISO2, e.g. "US"
  countryName: string | null; // e.g. "United States"
  city: string | null;
  region: string | null;
  currency: Currency; // default profile currency
  subCurrency: SubCurrency; // subscription pricing currency
};

function regionName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Read the visitor's location from Vercel's geolocation headers
 * (https://vercel.com/docs/edge-network/headers#geolocation-headers).
 * Returns nulls + EUR defaults in local dev where the headers are absent.
 */
export async function getGeo(): Promise<Geo> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  const rawCity = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");
  const city = rawCity ? decodeURIComponent(rawCity) : null;

  return {
    country,
    countryName: regionName(country),
    city,
    region,
    currency: defaultCurrencyForCountry(country),
    subCurrency: subscriptionCurrency(country),
  };
}
