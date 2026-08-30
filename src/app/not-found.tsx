import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { buildNotFoundMarkdown } from "@/lib/agent-404";
import { BRAND } from "@/lib/brand";

const RECOVERY: [string, string][] = [
  ["Home", "/"],
  ["How it works", "/how-it-works"],
  ["Catalog", "/catalog"],
  ["Sitemap", "/sitemap"],
  ["llms.txt", "/llms.txt"],
];

export default function NotFound() {
  const markdown = buildNotFoundMarkdown();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="container-luxe py-16 sm:py-24">
          <p className="eyebrow">404</p>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            This page is not in the atelier.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-stone">
            The path you asked for is not on {BRAND.name}. Start from the home
            page, the public sitemap, or the agent map.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/">Home</ButtonLink>
            <ButtonLink href="/sitemap" variant="outline">
              Sitemap
            </ButtonLink>
          </div>
          <ul className="mt-12 space-y-2.5">
            {RECOVERY.map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-ink transition-colors hover:text-brass"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <pre hidden>{markdown}</pre>
        </section>
      </main>
      <Footer />
    </>
  );
}
