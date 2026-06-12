import { headers } from "next/headers";

/** Canonical production origin for metadata, OG tags, and absolute asset URLs. */
export const CANONICAL_SITE_URL = "https://www.valetti.fit";

const PRODUCTION_HOSTS = new Set(["valetti.fit", "www.valetti.fit"]);

function normalizeHost(host: string): string {
  return host.split(":")[0]!.toLowerCase();
}

/** Production site origin for metadata, OG tags, and absolute asset URLs. */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return new URL(explicit);

  // Production must not use VERCEL_URL — deployment subdomains are often SSO-gated
  // and return HTML 401 to OG crawlers instead of image/png.
  if (process.env.VERCEL_ENV === "production") {
    return new URL(CANONICAL_SITE_URL);
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return new URL(`https://${vercel}`);

  if (process.env.NODE_ENV === "production") {
    return new URL(CANONICAL_SITE_URL);
  }

  return new URL("http://localhost:3000");
}

/**
 * Origin for Supabase auth redirects (confirm email, reset password).
 * Uses the live request host on valetti.fit; never localhost on Vercel production.
 */
export async function authRedirectOrigin(): Promise<string> {
  const h = await headers();
  const rawHost =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    h.get("host")?.trim() ??
    "";
  const host = normalizeHost(rawHost);

  if (host && PRODUCTION_HOSTS.has(host)) {
    const proto =
      h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
    return `${proto}://${host}`;
  }

  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_SITE_URL;
  }

  return getSiteUrl().origin;
}

/** Resolve a site-relative path to an absolute URL string. */
export function absoluteUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, getSiteUrl()).href;
}

/** Auth email links — must match Supabase redirect URL allow list. */
export async function absoluteAuthUrl(path: string): Promise<string> {
  const origin = await authRedirectOrigin();
  return new URL(path.startsWith("/") ? path : `/${path}`, origin).href;
}
