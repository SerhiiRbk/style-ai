import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { absoluteUrl } from "@/lib/site-url";
import { CREDIT_COSTS } from "@/lib/credit-costs";

export const metadata: Metadata = {
  title: "How it works — Valetti",
  description:
    "Catalogue try-on, Shop a Look, your Looks gallery, and personalised style reports — how every part of Valetti fits together.",
  alternates: { canonical: absoluteUrl("/how-it-works") },
  openGraph: {
    title: "How Valetti works",
    description:
      "Try pieces from the catalogue, match any outfit photo, and build a full style report — all in one place.",
    url: absoluteUrl("/how-it-works"),
  },
};

type FeatureSection = {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  steps: string[];
  links: { href: string; label: string }[];
};

const FEATURES: FeatureSection[] = [
  {
    id: "reports",
    eyebrow: "Style reports",
    title: "A detailed plan built around you",
    intro:
      "Answer a short questionnaire and upload a few photos. Valetti analyses your colouring, proportions and goals, then delivers a structured report: palette, hair and grooming guidance, photorealistic looks, a capsule wardrobe and a shoppable buying plan.",
    steps: [
      "Start from Create report — choose a tier (Starter, Lookbook or Capsule).",
      "Upload a front portrait and a full-length photo for the most accurate looks and try-ons.",
      "When your report is ready, open it for looks, shopping picks, PDF export and per-look try-on.",
      "Every report you generate is listed under Reports — reopen any time to review or share.",
    ],
    links: [
      { href: "/start", label: "Create a report" },
      { href: "/reports", label: "My reports" },
      { href: "/report/valetti-style-prospect-demo", label: "View sample report" },
    ],
  },
  {
    id: "catalog",
    eyebrow: "Catalogue try-on",
    title: "Try up to four pieces on your photo",
    intro:
      "Browse the menswear catalogue and build an outfit from real retailer links. When you are signed in, pick up to four items and render them together on your default full-length photo.",
    steps: [
      "Open Catalog and sign in if you have not already.",
      "Tap + Add to outfit on the pieces you want (up to four).",
      "Use the outfit tray to render the look on your photo — one credit per render.",
      "Carlo's expert read appears after the image: a verdict, what works, and what to pair it with.",
    ],
    links: [
      { href: "/catalog", label: "Open catalog" },
      { href: "/photos", label: "Manage try-on photos" },
    ],
  },
  {
    id: "shop-a-look",
    eyebrow: "Shop a Look",
    title: "Match any outfit photo to the catalogue",
    intro:
      "See a look on Instagram, Pinterest or the street? Upload the photo and Valetti breaks it into garment slots, finds the closest buyable pieces and re-ranks them for your palette when you have a style profile.",
    steps: [
      "Upload a clear outfit photo — full look visible works best.",
      "Review each slot and tap the circle on the alternatives you prefer.",
      "Try it on me renders your selection on your default photo (one credit).",
      "Carlo's verdict and the exact pieces tried are saved with the render.",
    ],
    links: [{ href: "/shop-a-look", label: "Shop a Look" }],
  },
  {
    id: "looks",
    eyebrow: "Looks",
    title: "Your try-on history in one gallery",
    intro:
      "Every catalogue and Shop a Look render is collected on the Looks page, grouped by source. You can download, share or delete a render, and reopen Carlo's notes whenever you like.",
    steps: [
      "Open Looks from the menu (sign in required).",
      "Catalogue try-ons and Shop a Look renders appear in separate groups.",
      "Tap the V icon on a try-on tile to read Carlo's verdict and see which catalogue pieces were used.",
      "Report-linked looks, capsules, hair previews and grooming images from your reports appear here too.",
    ],
    links: [{ href: "/gallery", label: "My looks" }],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16 sm:py-20">
            <p className="eyebrow">How it works</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              Everything Valetti can do for your wardrobe
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone">
              From a full style report to a single try-on from the catalogue —
              here is how each feature connects and where to find your history.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/start">Create a report</ButtonLink>
              <ButtonLink href="/catalog" variant="outline">
                Browse catalog
              </ButtonLink>
            </div>
          </div>
        </section>

        <section className="container-luxe py-12 sm:py-16">
          <div className="mx-auto max-w-3xl space-y-16">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.id}
                id={feature.id}
                className="scroll-mt-24 border-b hairline pb-16 last:border-b-0 last:pb-0"
              >
                <p className="eyebrow">{feature.eyebrow}</p>
                <h2 className="mt-3 font-display text-2xl leading-tight text-ink sm:text-3xl">
                  {feature.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-stone">
                  {feature.intro}
                </p>
                <ol className="mt-6 space-y-3">
                  {feature.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm leading-relaxed text-ink"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream font-display text-xs text-stone">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
                  {feature.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-brass transition-colors hover:text-ink"
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
                {index < FEATURES.length - 1 ? (
                  <div className="mt-10 h-px bg-line/60" aria-hidden />
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="border-t hairline bg-cream/30">
          <div className="container-luxe py-12">
            <div className="mx-auto max-w-3xl rounded-2xl border hairline bg-paper px-6 py-8">
              <p className="eyebrow">Credits</p>
              <h2 className="mt-2 font-display text-xl text-ink">
                Try-on costs one credit per render
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone">
                Catalogue and Shop a Look try-ons use the same credit balance as
                report extras. Carlo&apos;s verdict is included with every
                try-on — no extra charge. New accounts receive free credits to
                get started.
              </p>
              <p className="mt-4 text-sm text-stone">
                Try-on: {CREDIT_COSTS.tryon} credit
                {CREDIT_COSTS.tryon === 1 ? "" : "s"} ·{" "}
                <Link
                  href="/pricing"
                  className="text-brass transition-colors hover:text-ink"
                >
                  See pricing
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
