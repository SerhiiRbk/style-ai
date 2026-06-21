import { BRAND } from "@/lib/brand";
import { demoReportPath } from "@/lib/demo-report";
import { absoluteUrl } from "@/lib/site-url";

/** Structured data for the public sample report (indexable showcase page). */
export function DemoReportJsonLd({
  headline,
  summary,
  imageUrl,
}: {
  headline: string;
  summary: string;
  imageUrl: string;
}) {
  const pageUrl = absoluteUrl(demoReportPath());
  const site = absoluteUrl("/");
  const description =
    summary.trim() ||
    "A full Valetti men's personal style report — colour analysis, photorealistic looks, capsule wardrobe, and a shopping list.";

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: headline,
        description,
        isPartOf: { "@id": `${site}#website` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: imageUrl,
        },
      },
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline,
        description,
        url: pageUrl,
        image: [imageUrl],
        author: {
          "@type": "Person",
          name: BRAND.stylist.name,
          jobTitle: BRAND.stylist.role,
        },
        publisher: { "@id": `${site}#organization` },
        mainEntityOfPage: { "@id": `${pageUrl}#webpage` },
        inLanguage: "en",
        about: {
          "@type": "Thing",
          name: "Men's personal style analysis",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
