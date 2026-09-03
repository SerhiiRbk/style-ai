import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";

/** Short recovery map for agents that hit a missing path. */
export function buildNotFoundMarkdown(origin = getSiteUrl().origin): string {
  const url = (path: string) =>
    `${origin}${path.startsWith("/") ? path : `/${path}`}`;

  return `# Not found

This path is not on ${BRAND.name}.

Continue here:

- [Home](${url("/")})
- [How it works](${url("/how-it-works")})
- [Catalog](${url("/catalog")})
- [Agent map (llms.txt)](${url("/llms.txt")})
- [Sitemap](${url("/sitemap")})
- [Machine-readable sitemap](${url("/sitemaps/pages.xml")})
- [Privacy](${url("/privacy")})
`;
}
