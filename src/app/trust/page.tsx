import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { absoluteUrl } from "@/lib/site-url";
import {
  TRUST_CONTACT,
  TRUST_DELETE_HREF,
  TRUST_INTRO,
  TRUST_PRIVACY_HREF,
  TRUST_SECTIONS,
  TRUST_TITLE,
} from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "How we treat your photos — Valetti",
  description: TRUST_INTRO,
  alternates: { canonical: absoluteUrl("/trust") },
  openGraph: {
    title: TRUST_TITLE,
    description: TRUST_INTRO,
    url: absoluteUrl("/trust"),
  },
};

export default function TrustPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16 sm:py-20">
            <p className="eyebrow">Trust</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              {TRUST_TITLE}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone">
              {TRUST_INTRO}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={TRUST_DELETE_HREF}>Delete my photos</ButtonLink>
              <ButtonLink href={TRUST_PRIVACY_HREF} variant="outline">
                Privacy Policy
              </ButtonLink>
            </div>
          </div>
        </section>

        <section className="container-luxe max-w-3xl py-16">
          <div className="space-y-12">
            {TRUST_SECTIONS.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-2xl text-ink">{s.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-stone">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-14 border-t hairline pt-8 text-sm text-stone">
            Questions:{" "}
            <a
              href={`mailto:${TRUST_CONTACT}`}
              className="text-brass hover:text-ink"
            >
              {TRUST_CONTACT}
            </a>
            {" · "}
            <Link href="/colours" className="text-brass hover:text-ink">
              Free colour reading
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
