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

function decodeCity(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

/** Derive a plausible city label from IANA timezone (e.g. Europe/Prague → Prague). */
function cityFromTimezone(timezone: string | null): string | null {
  if (!timezone?.includes("/")) return null;
  const segment = timezone.split("/").pop();
  if (!segment) return null;
  const lower = segment.toLowerCase();
  if (["utc", "gmt", "universal", "zulu"].includes(lower)) return null;
  return segment
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function resolveCity(h: Headers): string | null {
  return (
    decodeCity(h.get("x-vercel-ip-city")) ??
    cityFromTimezone(h.get("x-vercel-ip-timezone"))
  );
}

async function reverseGeocodeCity(
  latitude: string,
  longitude: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", latitude);
    url.searchParams.set("lon", longitude);
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url, {
      headers: { "User-Agent": "Valetti Style App (https://www.valetti.fit)" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = data.address;
    if (!a) return null;
    return (
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readGeo(h: Headers): Geo {
  const country = h.get("x-vercel-ip-country");
  const region = h.get("x-vercel-ip-country-region");

  return {
    country,
    countryName: regionName(country),
    city: resolveCity(h),
    region,
    currency: defaultCurrencyForCountry(country),
    subCurrency: subscriptionCurrency(country),
  };
}

/**
 * Read the visitor's location from Vercel's geolocation headers
 * (https://vercel.com/docs/edge-network/headers#geolocation-headers).
 * Returns nulls + EUR defaults in local dev where the headers are absent.
 */
export async function getGeo(fromHeaders?: Headers): Promise<Geo> {
  const h = fromHeaders ?? (await headers());
  return readGeo(h);
}

/** Like getGeo, but also reverse-geocodes lat/lon when city is still unknown. */
export async function getGeoPrefill(fromHeaders?: Headers): Promise<Geo> {
  const h = fromHeaders ?? (await headers());
  const geo = readGeo(h);
  if (geo.city) return geo;

  const lat = h.get("x-vercel-ip-latitude");
  const lon = h.get("x-vercel-ip-longitude");
  if (!lat || !lon) return geo;

  const city = await reverseGeocodeCity(lat, lon);
  return city ? { ...geo, city } : geo;
}
