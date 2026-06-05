import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/report/demo"],
        // Private/owner data and internal endpoints stay out of the index.
        disallow: ["/api/", "/admin/", "/reports", "/login", "/report/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
