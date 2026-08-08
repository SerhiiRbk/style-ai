import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BRAND } from "@/lib/brand";
import { absoluteUrl } from "@/lib/site-url";
import { GOOGLE_SITEMAP_PATHS } from "@/lib/google-sitemap";
import { SUBSEASON_LABELS, type SubseasonId } from "@/lib/style-profile";

export const metadata: Metadata = {
  title: `Sitemap · ${BRAND.name}`,
  description: "Public pages on Valetti — for people and search engines.",
  alternates: { canonical: absoluteUrl("/sitemap") },
};

const LABELS: Record<string, string> = {
  "/": "Home",
  "/pricing": "Pricing",
  "/catalog": "Catalog",
  "/shop-a-look": "Shop a Look",
  "/how-it-works": "How it works",
  "/colours": "Colour analysis",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/impressum": "Impressum",
  "/sitemap": "Sitemap",
};

function labelFor(path: string): string {
  if (LABELS[path]) return LABELS[path];
  const sub = path.match(/^\/colours\/(.+)$/)?.[1];
  if (sub && sub in SUBSEASON_LABELS) {
    return `${SUBSEASON_LABELS[sub as SubseasonId]} palette`;
  }
  return path;
}

/** Crawlable HTML sitemap — bypasses GSC XML-sitemap queue stalls. */
export default function HtmlSitemapPage() {
  const paths = GOOGLE_SITEMAP_PATHS;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="container-luxe py-16 sm:py-24">
          <h1 className="font-display text-4xl tracking-tight text-ink sm:text-5xl">
            Sitemap
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-stone">
            Public pages on {BRAND.name}. Machine-readable copy:{" "}
            <a
              href="/sitemaps/pages.xml"
              className="text-brass underline-offset-2 hover:underline"
            >
              /sitemaps/pages.xml
            </a>
            .
          </p>
          <ul className="mt-12 columns-1 gap-x-12 sm:columns-2 md:columns-3">
            {paths.map((path) => (
              <li key={path} className="mb-3 break-inside-avoid">
                <Link
                  href={path}
                  className="text-sm text-ink transition-colors hover:text-brass"
                >
                  {labelFor(path)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
