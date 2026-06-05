import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MeetStylist } from "@/components/MeetStylist";
import { ButtonLink } from "@/components/Button";
import { getGeo } from "@/lib/geo";
import {
  REPORT_COST,
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  SIGNUP_BONUS,
} from "@/lib/credit-costs";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <Problem />
        <MeetStylist />
        <Understand />
        <HowItWorks />
        <SampleReport />
        <Audience />
        <Pricing />
        <Principles />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

/* ----------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative">
      <div className="container-luxe grid items-center gap-12 py-20 md:grid-cols-2 md:py-28 md:pb-32">
        <div className="animate-rise">
          <p className="eyebrow">{BRAND.eyebrow} · {BRAND.tagline}</p>
          <h1 className="mt-5 font-display text-[2.7rem] leading-[1.05] tracking-tight sm:text-6xl">
            Look more{" "}
            <em className="not-italic text-brass">considered</em> — without
            becoming a fashion victim.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone">
            {BRAND.name} is a personal style atelier led by{" "}
            <span className="text-ink">{BRAND.stylist.name}</span>. Share a few
            photos, answer a few honest questions, and receive a calm, practical
            plan: hair, colours, clothing, silhouettes, and a precise shopping
            list — each with the reason{" "}
            <span className="text-ink">why it works for you.</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="/start">Create my style report</ButtonLink>
            <ButtonLink href="/report/demo" variant="outline">
              See an example
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-stone-soft">
            Sign up for {SIGNUP_BONUS} free credits — Starter Report{" "}
            {REPORT_COST.free} credits, try-on {CREDIT_COSTS.tryon} credit · No
            subscription
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  const palette = ["#6B6B47", "#9E5C3C", "#EFE6D3", "#27324A", "#B08A5B"];
  return (
    <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms]">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline shadow-[0_40px_80px_-40px_rgba(21,18,13,0.45)]">
        <Image
          src="/images/hero-editorial.png"
          alt="Editorial portrait of a man in a navy blazer and cream knit"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 480px"
          className="object-cover object-top"
        />
        <span className="absolute right-4 top-4 rounded-full bg-paper/90 px-3 py-1.5 text-[11px] text-ink backdrop-blur-sm">
          autumn · warm · low contrast
        </span>
      </div>

      {/* Floating style-profile card */}
      <div className="absolute -bottom-8 left-2 w-56 rounded-xl border hairline bg-paper/95 p-4 shadow-[0_24px_48px_-24px_rgba(21,18,13,0.4)] backdrop-blur-sm sm:-left-8 sm:w-60">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Style profile</span>
        </div>
        <div className="mt-3 text-xs text-stone">Best colours</div>
        <div className="mt-2 flex gap-1.5">
          {palette.map((c) => (
            <span
              key={c}
              className="h-6 w-6 rounded-full border border-ink/10"
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          <Mini label="Silhouette" value="Tailored" />
          <Mini label="Hair" value="Textured crop" />
        </div>
      </div>

      <div className="absolute -right-3 top-6 hidden rounded-full border hairline bg-paper px-4 py-2 text-xs text-stone shadow-sm sm:block">
        12 looks · PDF · shopping list
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b hairline pb-1.5 text-xs">
      <span className="text-stone-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function Marquee() {
  const items = [
    "Explainable recommendations",
    "Photorealistic looks",
    "Real shopping links",
    "Virtual try-on",
    "GDPR-first",
    "Built for expats",
  ];
  return (
    <div className="border-y hairline bg-ink text-paper">
      <div className="container-luxe flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-sm">
        {items.map((i, idx) => (
          <span key={i} className="flex items-center gap-10">
            <span className="text-paper/80">{i}</span>
            {idx < items.length - 1 && (
              <span className="hidden h-1 w-1 rounded-full bg-brass-soft sm:block" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function Problem() {
  return (
    <section className="container-luxe py-24">
      <div className="grid items-center gap-14 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border hairline">
          <Image
            src="/images/flatlay-essentials.png"
            alt="Flat lay of warm-toned menswear essentials"
            fill
            sizes="(max-width: 768px) 100vw, 560px"
            className="object-cover"
          />
        </div>
        <div>
          <p className="eyebrow">The problem</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Most people want to look better. Few know exactly how.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-stone">
            <p>
              A classic stylist is expensive, time-consuming, and often feels
              like a service &ldquo;not for everyone.&rdquo; Ordinary fashion
              apps give you pretty pictures, but never explain{" "}
              <span className="text-ink">why</span> a look suits{" "}
              <span className="text-ink">you</span>.
            </p>
            <p>
              {BRAND.name} is different: a deep, honest analysis of your
              colouring, features, lifestyle and goals — turned into a calm,
              practical plan you can actually act on.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Understand() {
  const items = [
    ["Hair", "Which cuts suit your face — and which quietly date you."],
    ["Colours", "The tones that make you look healthy, and the ones that drain you."],
    ["Clothing", "What fits your age, profession, climate and goals."],
    ["Silhouette", "The fits, cuts and proportions that genuinely work."],
    ["Wardrobe", "The 5–10 pieces that unlock the most new outfits."],
    ["Mistakes", "The errors to fix first — before spending a cent."],
  ];
  return (
    <section className="border-y hairline bg-cream/40">
      <div className="container-luxe py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">What you&apos;ll understand</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Clear answers to the questions you&apos;ve been guessing at.
          </h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border hairline bg-line sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([title, body], i) => (
            <div
              key={title}
              className="group bg-paper p-8 transition-colors hover:bg-cream/60"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm text-brass">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-xl">{title}</h3>
              </div>
              <p className="mt-3 text-stone leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["Upload", "Add a few photos — front, full length, optional profile. We check quality automatically."],
    ["Answer", "A short questionnaire: age, city, lifestyle, goals, budget, and how bold you want to be."],
    ["Analyse", "Our engine builds your Style Profile and grounds every recommendation in a reason."],
    ["Receive", "A structured report, infographic, photorealistic looks and a precise shopping list."],
  ];
  return (
    <section id="how" className="container-luxe py-24">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            From photos to a finished plan in minutes.
          </h2>
        </div>
        <ButtonLink href="/start" variant="outline">
          Start now
        </ButtonLink>
      </div>

      <div className="mt-16 grid gap-10 md:grid-cols-4">
        {steps.map(([title, body], i) => (
          <div key={title} className="relative">
            <div className="font-display text-5xl text-sand">
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-3 font-display text-xl">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone">{body}</p>
            {i < steps.length - 1 && (
              <div className="absolute right-0 top-6 hidden h-px w-1/2 bg-line md:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SampleReport() {
  return (
    <section id="sample" className="border-y hairline bg-ink text-paper">
      <div className="container-luxe grid items-center gap-14 py-24 md:grid-cols-2">
        <div>
          <p className="eyebrow !text-brass-soft">The deliverable</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Not a pretty picture. A consultation.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-paper/70">
            Every report is structured, explainable and practical — designed to
            feel like a session with a thoughtful stylist who actually knows
            you.
          </p>
          <ul className="mt-8 space-y-3 text-paper/80">
            {[
              "Structured personal style profile",
              "Detailed report with the reason behind each call",
              "Clean infographic & colour palette",
              "Photorealistic look variations",
              "Shopping list with real product links",
              "Virtual try-on of recommended items",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass-soft" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <ButtonLink
              href="/report/demo"
              className="!bg-paper !text-ink hover:!bg-cream"
            >
              Open the example report
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-2xl border border-paper/15 bg-ink-soft/60 p-6">
          <div className="flex items-center justify-between text-xs text-paper/50">
            <span>STYLE REPORT · PREMIUM</span>
            <span>Berlin · autumn palette</span>
          </div>
          <h3 className="mt-3 font-display text-2xl">
            Warm, modern, and quietly confident
          </h3>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {["#6B6B47", "#9E5C3C", "#EFE6D3", "#27324A", "#B08A5B"].map((c) => (
              <div key={c} className="space-y-1.5">
                <div
                  className="aspect-square rounded-lg border border-paper/10"
                  style={{ background: c }}
                />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Work", "/images/look-work.png"],
              ["Dinner", "/images/look-dinner.png"],
              ["Weekend", "/images/look-weekend.png"],
            ].map(([c, src]) => (
              <div key={c}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-paper/10">
                  <Image
                    src={src}
                    alt={`${c} look`}
                    fill
                    sizes="(max-width: 768px) 30vw, 140px"
                    className="object-cover"
                  />
                </div>
                <div className="mt-2 text-xs text-paper/60">{c}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-paper/60">
            <span className="text-brass-soft">Why brown over black:</span>{" "}
            warm-toned leather ties your whole palette together far better than
            black ever will.
          </p>
        </div>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section id="audience" className="container-luxe py-24">
      <div className="max-w-2xl">
        <p className="eyebrow">Who it&apos;s for</p>
        <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
          Built first for those who want to look right, not loud.
        </h2>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        <Card
          tag="MVP focus"
          title="Men 35–55 in Europe"
          body="IT, consulting, business, freelance. Want to look modern, sharp and professional — without spending time on fashion. Often newly relocated and unsure where to even shop."
        />
        <Card
          tag="Also for"
          title="Expats & life changes"
          body="Relocating, changing jobs or social circles, dating, LinkedIn and conferences. People who need a look that fits a new country, climate and stage of life."
        />
        <Card
          tag="Business"
          title="Stylists, salons & shops"
          body="Generate white-label reports under your own brand and logo, add your own recommendations, and use your store's catalogue as the source of products."
          accent
        />
      </div>
    </section>
  );
}

function Card({
  tag,
  title,
  body,
  accent = false,
}: {
  tag: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-8 transition-colors ${
        accent
          ? "border-brass/40 bg-brass/5"
          : "border-line bg-cream/30 hover:bg-cream/60"
      }`}
    >
      <span className="eyebrow">{tag}</span>
      <h3 className="mt-4 font-display text-2xl">{title}</h3>
      <p className="mt-3 leading-relaxed text-stone">{body}</p>
    </div>
  );
}

async function Pricing() {
  const { subCurrency } = await getGeo();
  const tiers: {
    name: string;
    price: string;
    cadence: string;
    features: string[];
    cta: string;
    href: string;
    featured: boolean;
    note?: string;
  }[] = [
    {
      name: "Starter Report",
      price: String(REPORT_COST.free),
      cadence: "credits",
      note: `Covered by your ${SIGNUP_BONUS} signup credits — leaves ${SIGNUP_BONUS - REPORT_COST.free} for a try-on`,
      features: [
        "Colour & hair analysis with reasons",
        "1 photorealistic preview look",
        "2 hairstyle previews on your photo",
        `Virtual try-on (${CREDIT_COSTS.tryon} credit each)`,
        "No share link, capsule, or PDF",
      ],
      cta: "Try it free",
      href: "/start",
      featured: false,
    },
    {
      name: "Basic report",
      price: String(REPORT_COST.basic),
      cadence: "credits",
      features: [
        "Full style profile & colour story",
        "Hair, silhouette & fit, with reasons",
        "3 photorealistic looks",
        "Shopping list + PDF export",
      ],
      cta: "Get Basic",
      href: "/start",
      featured: false,
    },
    {
      name: "Lookbook",
      price: String(REPORT_COST.lookbook),
      cadence: "credits",
      features: [
        "Everything in Basic",
        "4 photorealistic looks",
        "Capsule wardrobe + week matrix",
        `Virtual try-on (${CREDIT_COSTS.tryon} credit each)`,
        "Good · Better · Best buying plan",
        "4 hairstyle previews on your photo (front + side)",
      ],
      cta: "Get Lookbook",
      href: "/start",
      featured: true,
    },
    {
      name: "Premium",
      price: String(REPORT_COST.premium),
      cadence: "credits",
      features: [
        "Everything in Lookbook",
        "6 photorealistic looks",
        "4 facial-hair previews on your photo",
        "2 optical + 2 sunglasses previews",
        "Deeper grooming guidance",
      ],
      cta: "Get Premium",
      href: "/start",
      featured: false,
    },
  ];
  const starter = CREDIT_PACKAGES[0];
  return (
    <section id="pricing" className="border-y hairline bg-cream/40">
      <div className="container-luxe py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Pay for the work, not a subscription.
          </h2>
          <p className="mt-4 text-stone">
            {BRAND.name} runs on credits — a report costs credits by tier, and
            each virtual try-on or re-render is {CREDIT_COSTS.tryon} credit. New
            accounts get {SIGNUP_BONUS} free credits, and packs start at{" "}
            {starter.price[subCurrency]} for {starter.credits} credits.{" "}
            <Link href="/pricing" className="text-brass hover:text-ink">
              See full pricing &amp; credit packs →
            </Link>
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                t.featured
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper"
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-brass px-3 py-1 text-[11px] uppercase tracking-wider text-paper">
                  Most popular
                </span>
              )}
              <div className="text-sm tracking-wide opacity-80">{t.name}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-4xl">{t.price}</span>
                {t.cadence && (
                  <span
                    className={`text-xs ${t.featured ? "text-paper/60" : "text-stone-soft"}`}
                  >
                    {t.cadence}
                  </span>
                )}
              </div>
              {t.note && <p className="mt-1 text-xs text-brass">{t.note}</p>}
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        t.featured ? "bg-brass-soft" : "bg-brass"
                      }`}
                    />
                    <span className={t.featured ? "text-paper/85" : "text-stone"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={t.href}
                className={`mt-7 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm transition-all ${
                  t.featured
                    ? "bg-paper text-ink hover:bg-cream"
                    : "border border-ink/25 text-ink hover:bg-ink hover:text-paper"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Principles() {
  const items = [
    ["Personal", "Recommendations are built around you — not generic fashion advice."],
    ["Explainable", "Every important call comes with the reason behind it."],
    ["Practical", "Actionable output: what to wear, buy, combine and fix first."],
    ["Private", "Your face and body are sensitive data. Designed GDPR-first from day one."],
  ];
  return (
    <section className="container-luxe py-24">
      <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow">Principles</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Quality over wow-effect.
          </h2>
          <p className="mt-4 leading-relaxed text-stone">
            AI imagery matters — but it should never replace a genuine analysis.
            This is a consultant, not a toy.
          </p>
          <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-2xl border hairline">
            <Image
              src={BRAND.stylist.atelier}
              alt={`${BRAND.stylist.name} reviewing fabrics in the atelier`}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-3 py-1.5 text-[11px] text-ink backdrop-blur-sm">
              {BRAND.stylist.name} · the atelier
            </span>
          </div>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border hairline bg-line sm:grid-cols-2">
          {items.map(([t, b]) => (
            <div key={t} className="bg-paper p-7">
              <h3 className="font-display text-xl">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="border-t hairline bg-ink text-paper">
      <div className="container-luxe py-24 text-center">
        <p className="eyebrow !text-brass-soft">Your style, decoded</p>
        <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
          See what genuinely suits you — and why.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-paper/70">
          Sign up for {SIGNUP_BONUS} free credits — Starter Report costs{" "}
          {REPORT_COST.free}, try-on {CREDIT_COSTS.tryon} credit. No subscription.
        </p>
        <div className="mt-9 flex justify-center">
          <ButtonLink
            href="/start"
            className="!bg-paper !text-ink hover:!bg-cream"
          >
            Create my style report
          </ButtonLink>
        </div>
        <p className="mt-6 text-sm text-paper/50">— {BRAND.stylist.signature}</p>
      </div>
    </section>
  );
}
