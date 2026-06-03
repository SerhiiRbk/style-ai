/** Canonical production origin for metadata, OG tags, and absolute asset URLs. */
export const CANONICAL_SITE_URL = "https://project-7o8lp.vercel.app";

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

/** Resolve a site-relative path to an absolute URL string. */
export function absoluteUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, getSiteUrl()).href;
}
