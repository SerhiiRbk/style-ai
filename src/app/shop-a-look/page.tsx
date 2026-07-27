import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShopALookExperience } from "@/components/ShopALookExperience";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Shop a look — match any outfit to your catalogue | Valetti",
  description:
    "Upload a photo of any outfit and Valetti finds the closest pieces from the catalogue, re-ranked for your colours and fit. Screenshot-to-shop, in your palette.",
  alternates: { canonical: absoluteUrl("/shop-a-look") },
  openGraph: {
    title: "Shop a look — in your colours | Valetti",
    description:
      "See an outfit you like? Upload it and get the closest buyable pieces, tuned to you.",
    url: absoluteUrl("/shop-a-look"),
  },
};

export default function ShopALookPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16 sm:py-20">
            <p className="eyebrow">Shop a look</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              See a look you like?{" "}
              <em className="not-italic text-brass">Get it in your colours.</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone">
              Upload any outfit photo — from Instagram, Pinterest, a friend or
              the street. Valetti breaks it into pieces and finds the closest
              matches from the catalogue, re-ranked for your palette and fit.
            </p>
          </div>
        </section>

        <section className="container-luxe py-12">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 rounded-2xl border hairline bg-paper px-4 py-3 text-sm leading-relaxed text-stone">
              After a try-on, your render, Carlo&apos;s verdict and the pieces
              you used are saved to{" "}
              <Link
                href="/gallery"
                className="text-ink underline decoration-brass/50 underline-offset-2 transition-colors hover:decoration-brass"
              >
                Looks
              </Link>
              . Open any past try-on and tap the{" "}
              <span className="font-display text-ink">V</span> icon to read
              Carlo&apos;s notes again.
            </div>
            <ShopALookExperience />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
