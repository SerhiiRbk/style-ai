import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { absoluteUrl } from "@/lib/site-url";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { LOOK_SET_BUNDLES } from "@/lib/look-sets";

export const metadata: Metadata = {
  title: "How it works — Valetti",
  description:
    "Style reports, Create a Look with a constructor, catalogue try-on and Shop a Look — how every part of Valetti fits together.",
  alternates: { canonical: absoluteUrl("/how-it-works") },
  openGraph: {
    title: "How Valetti works",
    description:
      "Build a style report, generate occasion looks, then reconstruct any look piece by piece — all in one place.",
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
  image: {
    src: string;
    alt: string;
    caption: string;
  };
  /** Image on the right for even sections — keeps the page from feeling stacked. */
  reverse?: boolean;
};

const FEATURES: FeatureSection[] = [
  {
    id: "reports",
    eyebrow: "Style reports",
    title: "A detailed plan built around you",
    intro:
      "Answer a short questionnaire and upload a few photos. Valetti analyses your colouring, proportions and goals, then delivers a structured report: palette, hair and grooming guidance, photorealistic looks, a capsule wardrobe and a shoppable buying plan. Lookbook and Premium also include a finishing kit — shoes, belts, ties and a watch — so the details hold every look together.",
    steps: [
      "Start from Create my report — choose a tier (Starter, Basic, Lookbook or Premium).",
      "Upload a front portrait and a full-length photo for the most accurate looks and try-ons.",
      "When your report is ready, open it for looks, shopping picks, PDF export and per-look try-on.",
      "Lookbook and Premium add the finishing kit: a shoe board, belt guide and watch — plus tie and neckwear picks. Every report lives under Reports.",
    ],
    links: [
      { href: "/start", label: "Create a report" },
      { href: "/reports", label: "My reports" },
      { href: "/report/valetti-style-prospect-demo", label: "View sample report" },
    ],
    image: {
      src: "/images/look-work.png",
      alt: "Photorealistic tailored work look from a Valetti style report",
      caption: "Photorealistic looks · colour story · finishing kit",
    },
  },
  {
    id: "create-look",
    eyebrow: "Create a look",
    title: "Occasion looks you can rebuild",
    intro:
      "Need outfits for work, dinner or a weekend — without a full report? Create a Look generates a set of photorealistic looks on your photo. Then open any look and use the constructor: change a jacket, colour, sunglasses shape, or whether a shirt is tucked in, and redraw just that look.",
    steps: [
      "Open Create a look, pick an occasion, season and a set of 3, 6 or 9 looks.",
      "Reuse a style profile from a report, or upload a photo so the looks are rendered on you.",
      "When the set is ready, tap a look and use the constructor — type, colour, eyewear shape, mirrored lenses, tucked in or untucked.",
      `Apply redraws that look (${CREDIT_COSTS.look_regen} credit). Try-on is a separate button. Sets live under Looks.`,
    ],
    links: [
      { href: "/create-look", label: "Create a look" },
      { href: "/looks", label: "Looks" },
    ],
    reverse: true,
    image: {
      src: "/images/look-travel.png",
      alt: "Travel look generated as part of a Valetti look set",
      caption: "3, 6 or 9 looks · constructor on every piece",
    },
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
    image: {
      src: "/images/flatlay-essentials.png",
      alt: "Warm-toned menswear essentials laid flat — navy, cream and brown",
      caption: "Real retailer pieces · up to four at once",
    },
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
    reverse: true,
    image: {
      src: "/images/look-weekend.png",
      alt: "Relaxed weekend outfit rendered as a shoppable look",
      caption: "Inspiration in · catalogue matches out",
    },
  },
  {
    id: "images",
    eyebrow: "Images",
    title: "Every generated image in one gallery",
    intro:
      "Looks you created, report looks, catalogue try-ons and Shop a Look renders collect under Images. Download, share or delete a render, and reopen Carlo's notes whenever you like.",
    steps: [
      "Open Images from My Style (sign in required).",
      "Create-a-Look sets also live under Looks — open any set to reconstruct a piece.",
      "Tap the V icon on a try-on tile to read Carlo's verdict and see which catalogue pieces were used.",
      "Hair, grooming and capsule stills from your reports appear here too.",
    ],
    links: [
      { href: "/gallery", label: "Images" },
      { href: "/looks", label: "Looks" },
    ],
    image: {
      src: "/images/look-dinner.png",
      alt: "Evening dinner look saved in a personal image gallery",
      caption: "Looks · reports · try-ons — one gallery",
    },
  },
];

const JOURNEY = [
  { n: "01", label: "Profile", detail: "Photos & goals" },
  { n: "02", label: "Report", detail: "Colours & finishing kit" },
  { n: "03", label: "Looks", detail: "Create & reconstruct" },
  { n: "04", label: "Try on", detail: "Catalogue or photo" },
];

const CONSTRUCTOR_PIECES = [
  { src: "/images/products/olive-overshirt.png", label: "Overshirt" },
  { src: "/images/products/charcoal-trousers.png", label: "Trousers" },
  { src: "/images/products/chelsea-boots.png", label: "Boots" },
  { src: "/images/demo/accessory-tie.png", label: "Tie" },
  { src: "/images/products/field-watch.png", label: "Watch" },
] as const;

const FINISHING_PIECES = [
  { src: "/images/products/brown-loafers.png", label: "Shoes" },
  { src: "/images/catalog/tradedoubler-anderson-s_td-blt-brn.png", label: "Belt" },
  { src: "/images/demo/accessory-tie.png", label: "Tie" },
  { src: "/images/products/field-watch.png", label: "Watch" },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero — one composition: brand signal, headline, support, CTAs, visual */}
        <section className="relative overflow-hidden border-b hairline">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(169,124,60,0.12),transparent_55%),radial-gradient(ellipse_at_90%_40%,rgba(231,220,199,0.7),transparent_50%)]"
          />
          <div className="container-luxe relative grid items-center gap-12 py-16 md:grid-cols-2 md:gap-14 md:py-20 lg:py-24">
            <div className="animate-rise">
              <p className="eyebrow">How it works</p>
              <h1 className="mt-5 font-display text-[2.5rem] leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                Everything Valetti can do for your{" "}
                <em className="not-italic text-brass">wardrobe</em>
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-stone">
                From a full style report to a look you rebuild piece by piece —
                each feature connects, and your history lives in one place.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/start">Create a report</ButtonLink>
                <ButtonLink href="/create-look" variant="outline">
                  Create a look
                </ButtonLink>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms] md:max-w-none">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline shadow-[0_40px_80px_-40px_rgba(21,18,13,0.45)]">
                <Image
                  src="/images/hero-editorial.png"
                  alt="Editorial portrait in a navy blazer and cream knit"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-cover object-top"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/55 via-ink/15 to-transparent px-5 pb-5 pt-16">
                  <p className="font-display text-lg leading-snug text-paper">
                    Report · looks · constructor
                  </p>
                  <p className="mt-1 text-xs tracking-wide text-paper/75">
                    One atelier, from plan to piece
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-2 hidden w-44 rounded-xl border hairline bg-paper/95 p-3.5 shadow-[0_20px_40px_-24px_rgba(21,18,13,0.4)] backdrop-blur-sm sm:block md:-left-6">
                <p className="text-[10px] uppercase tracking-[0.16em] text-brass">
                  Soft Autumn
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  {["#6B6B47", "#9E5C3C", "#EFE6D3", "#27324A", "#B08A5B"].map(
                    (c) => (
                      <span
                        key={c}
                        className="h-5 w-5 rounded-full border border-ink/10"
                        style={{ background: c }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Journey strip */}
        <section className="border-b hairline bg-ink text-paper">
          <div className="container-luxe grid grid-cols-2 gap-6 py-8 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-paper/15">
            {JOURNEY.map((item, i) => (
              <div
                key={item.n}
                className={`animate-rise px-1 sm:px-6 ${i === 0 ? "sm:pl-0" : ""} ${i === JOURNEY.length - 1 ? "sm:pr-0" : ""}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <p className="font-display text-2xl text-brass-soft">{item.n}</p>
                <p className="mt-2 text-sm text-paper">{item.label}</p>
                <p className="mt-0.5 text-xs text-paper/55">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature sections — alternating editorial image + copy */}
        <div className="container-luxe py-16 sm:py-24">
          <div className="space-y-20 sm:space-y-28">
            {FEATURES.map((feature) => (
              <article
                key={feature.id}
                id={feature.id}
                className="scroll-mt-28"
              >
                <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14 lg:gap-20">
                  <div
                    className={`relative ${
                      feature.reverse ? "md:order-2" : ""
                    }`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline sm:aspect-[5/6]">
                      <Image
                        src={feature.image.src}
                        alt={feature.image.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 520px"
                        className="object-cover object-top transition-transform duration-700 ease-out hover:scale-[1.03]"
                      />
                    </div>
                    {feature.id === "create-look" || feature.id === "reports" ? (
                      <div className="mt-3 flex gap-2">
                        {(feature.id === "create-look"
                          ? CONSTRUCTOR_PIECES
                          : FINISHING_PIECES
                        ).map((piece) => (
                          <div
                            key={piece.label}
                            className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-xl border hairline bg-cream/40"
                          >
                            <Image
                              src={piece.src}
                              alt={piece.label}
                              fill
                              sizes="80px"
                              className="object-contain p-1.5"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs tracking-wide text-stone-soft">
                      {feature.image.caption}
                    </p>
                  </div>

                  <div className={feature.reverse ? "md:order-1" : ""}>
                    <p className="eyebrow">{feature.eyebrow}</p>
                    <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
                      {feature.title}
                    </h2>
                    <p className="mt-5 text-base leading-relaxed text-stone sm:text-lg">
                      {feature.intro}
                    </p>
                    <ol className="mt-8 space-y-4">
                      {feature.steps.map((step, i) => (
                        <li
                          key={i}
                          className="flex gap-3.5 text-sm leading-relaxed text-ink"
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border hairline bg-cream/60 font-display text-xs text-brass">
                            {i + 1}
                          </span>
                          <span className="pt-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
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
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Carlo strip — voice of the product */}
        <section className="border-y hairline bg-cream/40">
          <div className="container-luxe grid items-center gap-10 py-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-14 md:py-20">
            <div className="relative mx-auto w-full max-w-sm">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline">
                <Image
                  src="/images/carlo-valetti.png"
                  alt="Carlo Valetti, Valetti lead stylist persona"
                  fill
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover object-top"
                />
              </div>
            </div>
            <div>
              <p className="eyebrow">The voice behind every call</p>
              <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
                Carlo&apos;s verdict comes with every try-on
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone">
                After each catalogue or Shop a Look render, you get a calm expert
                read — what works, what to pair it with, and why — saved with the
                image in your Looks gallery. No extra charge.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/gallery" variant="outline">
                  Open Looks
                </ButtonLink>
                <ButtonLink href="/shop-a-look">Try Shop a Look</ButtonLink>
              </div>
            </div>
          </div>
        </section>

        {/* Credits — quiet closing note */}
        <section className="container-luxe py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Credits</p>
            <h2 className="mt-3 font-display text-2xl text-ink sm:text-3xl">
              Looks from {LOOK_SET_BUNDLES[0].credits} credits · constructor{" "}
              {CREDIT_COSTS.look_regen} credit
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-stone sm:text-base">
              A look set is {LOOK_SET_BUNDLES.map((b) => `${b.looks} looks / ${b.credits} cr`).join(", ")}.
              Redrawing a look in the constructor costs {CREDIT_COSTS.look_regen}{" "}
              credit; catalogue and Shop a Look try-ons are{" "}
              {CREDIT_COSTS.tryon} credit each. Same balance as reports.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/pricing" variant="outline">
                See pricing
              </ButtonLink>
              <ButtonLink href="/create-look">Create a look</ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
