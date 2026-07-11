import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        // Report pages are crawlable so link-preview scrapers can read their OG
        // tags/image. Unshared reports return 404 to bots, and every real report
        // carries a `noindex` meta tag, so none of them land in search engines.
        allow: ["/", "/report/", "/api/og/"],
        disallow: ["/api/", "/admin/", "/login"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
