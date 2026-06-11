import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LegalDocument } from "@/components/LegalDocument";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { IMPRESSUM_INTRO, IMPRESSUM_SECTIONS } from "@/lib/impressum-content";

export const metadata: Metadata = {
  title: `Impressum · ${BRAND.name}`,
  description: "Legal operator information for Valetti.",
  alternates: { canonical: "/impressum" },
};

export default function ImpressumPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="container-luxe py-16 sm:py-24">
          <LegalDocument
            title="Impressum"
            intro={IMPRESSUM_INTRO}
            lastUpdated={LEGAL.lastUpdated}
            sections={IMPRESSUM_SECTIONS}
            relatedHref="/privacy"
            relatedLabel="Privacy Policy"
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
