import { BRAND } from "@/lib/brand";
import { absoluteUrl } from "@/lib/site-url";

/** Organization JSON-LD for the homepage. Address only when LEGAL_* env is set. */
export function organizationJsonLd(site: string) {
  const org: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${site}#organization`,
    name: BRAND.name,
    alternateName: ["Valetti AI men's stylist", "Valetti AI style atelier"],
    url: site,
    logo: absoluteUrl(BRAND.logo),
    description:
      "AI-assisted men's personal styling atelier — colour analysis, photorealistic looks, and a precise shopping plan.",
    contactPoint: {
      "@type": "ContactPoint",
      email: BRAND.contactEmail,
      contactType: "customer support",
      availableLanguage: ["en"],
    },
  };
  const address = organizationPostalAddress();
  if (address) org.address = address;
  return org;
}

export function websiteJsonLd(site: string) {
  return {
    "@type": "WebSite",
    "@id": `${site}#website`,
    url: site,
    name: BRAND.seoTitle,
    alternateName: BRAND.name,
    publisher: { "@id": `${site}#organization` },
  };
}

export function serviceJsonLd(site: string) {
  return {
    "@type": "Service",
    name: "AI-assisted personal styling",
    alternateName: "AI men's stylist",
    serviceType: "AI men's personal styling",
    provider: { "@id": `${site}#organization` },
    areaServed: ["European Union", "United States", "Worldwide"],
    description:
      "AI-assisted men's personal styling: colour analysis, photorealistic looks, a capsule wardrobe, and a shoppable plan.",
  };
}

export function organizationPostalAddress(): Record<string, string> | null {
  const streetAddress = process.env.LEGAL_ADDRESS_LINE1?.trim();
  const postalCode = process.env.LEGAL_POSTAL_CODE?.trim();
  const addressLocality = process.env.LEGAL_CITY?.trim();
  const addressCountry = process.env.LEGAL_COUNTRY?.trim();
  if (!streetAddress && !addressLocality && !addressCountry) return null;
  return {
    "@type": "PostalAddress",
    ...(streetAddress ? { streetAddress } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(addressLocality ? { addressLocality } : {}),
    ...(addressCountry ? { addressCountry } : {}),
  };
}
