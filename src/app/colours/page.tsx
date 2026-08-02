import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ColoursExperience } from "@/components/ColoursExperience";
import { absoluteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import { COLOURS_ENABLED } from "@/lib/colours-feature";

export const metadata: Metadata = {
  title: "Free colour analysis for men — find your colours | Valetti",
  description:
    "Discover your seasonal colour palette free in 20 seconds. Upload one selfie and Carlo reads your undertone, contrast and colours — no signup. Built for men.",
  alternates: { canonical: absoluteUrl("/colours") },
  openGraph: {
    title: "Find your colours — free | Valetti",
    description:
      "One selfie, 20 seconds. Your seasonal colour palette, read by Carlo. Built for men.",
    url: absoluteUrl("/colours"),
  },
};

export default function ColoursPage() {
  // PAUSED — the "colours" (free colour analysis) initiative is on hold, so this
  // route returns 404 while all page code below is kept intact. The same flag
  // guards `POST /api/colours`; flip it in one place to re-enable both.
  if (!COLOURS_ENABLED) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16 sm:py-20">
            <p className="eyebrow">Free colour analysis · for men</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              Discover your colours —{" "}
              <em className="not-italic text-brass">free</em>.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone">
              One selfie and <span className="text-ink">Carlo</span> reads your
              undertone, contrast and seasonal palette in about 20 seconds. No
              signup, no payment — just your colours and what to wear.
            </p>
          </div>
        </section>

        <section className="container-luxe py-12">
          <div className="mx-auto max-w-2xl">
            <ColoursExperience />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
