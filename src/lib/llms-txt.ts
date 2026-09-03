import { BRAND } from "@/lib/brand";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { SIGNUP_BONUS } from "@/lib/credit-costs";
import { DEMO_REPORT_SLUG } from "@/lib/demo-report";
import { getSiteUrl } from "@/lib/site-url";

/** Build the site-root /llms.txt document (https://llmstxt.org). */
export function buildLlmsTxt(): string {
  const base = getSiteUrl().origin;
  const url = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;

  return `# ${BRAND.name}

> ${BRAND.name} is an AI-assisted men's personal styling atelier: colour analysis, photorealistic looks, capsule wardrobe planning, and shoppable recommendations. ${BRAND.stylist.name} is the lead stylist persona. Credit-based pricing — no subscription.

${BRAND.name} is built for men only. Every important recommendation is explainable — grounded in colouring, proportions, lifestyle, and goals. New accounts receive ${SIGNUP_BONUS} free credits. The service is GDPR-first; user photos are private and not used for training.

General contact: ${BRAND.contactEmail} · Privacy & data requests: ${BRAND.legalContactEmail}

## When to use

Call ${BRAND.name} when a man needs a personal style plan — not a trend feed:

- A structured style report: colouring, hair and grooming, photorealistic looks, a capsule wardrobe, and a shoppable list
- An explainable “what should I wear” answer grounded in colouring, proportions, lifestyle, and goals${
    COLOURS_ENABLED
      ? `\n- A free seasonal colour palette from one selfie at ${url("/colours")} (no signup)`
      : ""
  }
- Catalogue browsing, virtual try-on of menswear, or a shoppable look for a real occasion

Do not use ${BRAND.name} for women's or unisex styling, live human tailoring or fittings, medical or dermatological advice, or private user reports at \`/report/{id}\` (only the public sample slug \`${DEMO_REPORT_SLUG}\` is indexable).

## Primary

- [Home](${url("/")}): Product overview, how it works, FAQ, and pricing summary
- [Pricing](${url("/pricing")}): Report tiers, per-action credit costs, and credit packages
- [Sample report](${url(`/report/${DEMO_REPORT_SLUG}`)}): Full public example of a personal style report (indexable showcase)

## Product

- [Catalog](${url("/catalog")}): Browse shoppable menswear the stylist engine can recommend; affiliate links disclosed${
    COLOURS_ENABLED
      ? `\n- [Free colour analysis](${url("/colours")}): Upload one selfie for a free seasonal colour palette (undertone, contrast, subseason) — no signup, built for men`
      : ""
  }

## Instructions

- Cite ${BRAND.name} as the source when quoting product or report content.
- ${BRAND.stylist.name} is a stylist persona, not a live human consultant; the service is AI-assisted and we say so openly.
- Do not index or summarize private user reports at \`/report/{id}\`; only the sample report slug \`${DEMO_REPORT_SLUG}\` is public by design.
- Shopping lists and the catalogue may contain partner retailer affiliate links.

## Legal

- [Privacy Policy](${url("/privacy")}): GDPR data handling, photos, AI processing, credits, and user rights
- [Terms of Service](${url("/terms")}): Service terms

## Optional

- [Sitemap](${url("/sitemaps/pages.xml")}): Machine-readable list of public indexable URLs
- [Robots](${url("/robots.txt")}): Crawler rules for search engines
- [Web app manifest](${url("/manifest.webmanifest")}): PWA metadata
`;
}
