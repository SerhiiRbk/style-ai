import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Link-preview scrapers that must reach shared report pages (for OG tags) and
// the OG image endpoint. Report pages carry a `noindex` meta tag, so allowing
// these bots does not put personal reports into search engines.
const SOCIAL_CRAWLERS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "Slackbot-LinkExpanding",
  "WhatsApp",
  "Discordbot",
  "TelegramBot",
  "Pinterest",
  "redditbot",
  "Applebot",
  "SkypeUriPreview",
];

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/report/valetti-style-prospect-demo", "/report/demo"],
        // Private/owner data and internal endpoints stay out of the index.
        disallow: ["/api/", "/admin/", "/reports", "/login", "/report/"],
      },
      {
        // Allow social crawlers to fetch report pages + OG images for previews.
        userAgent: SOCIAL_CRAWLERS,
        allow: ["/", "/report/", "/api/og/"],
        disallow: ["/api/", "/admin/", "/reports", "/login"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
