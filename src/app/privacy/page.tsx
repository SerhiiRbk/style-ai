import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LegalDocument } from "@/components/LegalDocument";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/lib/privacy-content";

export const metadata: Metadata = {
  title: `Privacy Policy · ${BRAND.name}`,
  description:
    "How Valetti collects, uses, and protects your data — including photos, AI processing, credits, and your GDPR rights.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="container-luxe py-16 sm:py-24">
          <LegalDocument
            title="Privacy Policy"
            intro={PRIVACY_INTRO}
            lastUpdated={LEGAL.lastUpdated}
            sections={PRIVACY_SECTIONS}
            relatedHref="/terms"
            relatedLabel="Terms of Service"
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
