/** Public indexable URLs for the static Google sitemap (no reports/auth/redirects). */
export const GOOGLE_SITEMAP_PATHS = [
  "/",
  "/pricing",
  "/catalog",
  "/shop-a-look",
  "/how-it-works",
  "/colours",
  "/colours/deep-winter",
  "/colours/cool-winter",
  "/colours/bright-winter",
  "/colours/bright-spring",
  "/colours/warm-spring",
  "/colours/light-spring",
  "/colours/light-summer",
  "/colours/cool-summer",
  "/colours/soft-summer",
  "/colours/soft-autumn",
  "/colours/warm-autumn",
  "/colours/deep-autumn",
  "/privacy",
  "/terms",
  "/impressum",
  "/sitemap",
] as const;

const ORIGIN = "https://www.valetti.fit";

/** Minimal urlset — no lastmod / changefreq / priority. */
export function buildGoogleSitemapXml(): string {
  const urls = GOOGLE_SITEMAP_PATHS.map(
    (path) => `  <url>\n    <loc>${ORIGIN}${path === "/" ? "/" : path}</loc>\n  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
