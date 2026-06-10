import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LegalDocument } from "@/components/LegalDocument";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { TERMS_INTRO, TERMS_SECTIONS } from "@/lib/terms-content";

export const metadata: Metadata = {
  title: `Terms of Service · ${BRAND.name}`,
  description:
    "Terms governing your use of Valetti — credits, AI-assisted reports, acceptable use, refunds, and liability.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="container-luxe py-16 sm:py-24">
          <LegalDocument
            title="Terms of Service"
            intro={TERMS_INTRO}
            lastUpdated={LEGAL.lastUpdated}
            sections={TERMS_SECTIONS}
            relatedHref="/privacy"
            relatedLabel="Privacy Policy"
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
