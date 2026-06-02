import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportById } from "@/lib/data/reports";
import { TryOnButton } from "@/components/TryOnButton";
import { LookTryOn } from "@/components/LookTryOn";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { StylistNote } from "@/components/StylistNote";
import { BRAND } from "@/lib/brand";
import type { ColorRec, HairRec, ShoppingItem } from "@/lib/report";
import { formatMoney } from "@/lib/currency";
import { BodyTypeFigure } from "@/components/BodyTypePicker";
import { ColorWheel } from "@/components/ColorWheel";
import { StyleDetails } from "@/components/StyleDetails";
import {
  ArchetypeBadge,
  Moodboard,
  WheelLegend,
  PriorityMoves,
  ColorDNAGuide,
  MetalChips,
  Pairings,
  EyewearGuide,
  GroomingGuide,
  FitBlueprint,
  Capsule,
  CapsuleMatrix,
  PriceTiers,
  ShopTheLook,
  FabricsGuide,
  FinishingTouches,
} from "@/components/StyleGuides";
import { buildExtras, investmentLevel, itemsForLook } from "@/lib/style-extras";
import {
  isBodyType,
  BODY_TYPE_LABELS,
  type Measurements as MeasurementsT,
} from "@/lib/style-profile";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();

  const { profile, intake } = report;
  const tierLabel = report.tier.charAt(0).toUpperCase() + report.tier.slice(1);

  const grouped = report.shopping.reduce<Record<string, ShoppingItem[]>>(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {},
  );

  const extras = buildExtras(report);

  // The demo report uses the deterministic mock catalogue, so the outfit-matrix
  // combinations are stable and we can attach pre-rendered lookbook photos.
  const CAPSULE_IMAGES = [
    "/images/look-work.png",
    "/images/capsule/capsule-2.png",
    "/images/capsule/capsule-3.png",
    "/images/capsule/capsule-4.png",
    "/images/capsule/capsule-5.png",
    "/images/capsule/capsule-6.png",
  ];
  // Live reports (not the demo) can render outfits on the user's own photo.
  const canTryOn = report.id !== "demo";

  const capsuleImages =
    report.id === "demo" ? CAPSULE_IMAGES : report.capsuleImages;
  const matrix = capsuleImages
    ? extras.matrix.map((c, i) => ({ ...c, image: capsuleImages[i] ?? undefined }))
    : extras.matrix;

  return (
    <>
      {/* Report header */}
      <header className="border-b hairline bg-ink text-paper">
        <div className="container-luxe flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-xl">
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={`/api/reports/${report.id}/pdf`}
              download
              className="rounded-full border border-paper/25 px-5 py-2 text-sm text-paper/90 transition-colors hover:bg-paper hover:text-ink"
            >
              Download PDF
            </a>
            <ButtonLink
              href="/start"
              className="!bg-paper !text-ink hover:!bg-cream !px-5 !py-2"
            >
              New report
            </ButtonLink>
          </div>
        </div>

        <div className="container-luxe grid items-center gap-12 pb-16 pt-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-xs text-paper/50">
              <span className="rounded-full border border-paper/20 px-2.5 py-1 uppercase tracking-wider">
                {tierLabel} report
              </span>
              <span>
                {intake.city}, {intake.country} · {profile.demographics.climate} climate
              </span>
            </div>
            <h1 className="mt-5 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
              {report.headline}
            </h1>
            <p className="mt-5 max-w-xl leading-relaxed text-paper/70">
              {report.summary}
            </p>
            <div className="mt-7 max-w-xl">
              <StylistNote tone="dark">
                I&apos;ve read your colouring, proportions and goals — here&apos;s
                how I&apos;d dress you. Calm, considered, and with the reason
                behind every choice. Take what fits your life; leave the rest.
              </StylistNote>
            </div>
            <div className="mt-7 border-t border-paper/15 pt-6">
              <ArchetypeBadge archetype={extras.archetype} />
            </div>
          </div>
          <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl border border-paper/15 md:block">
            <Image
              src="/images/hero-editorial.png"
              alt="Editorial portrait reflecting the recommended direction"
              fill
              sizes="(max-width: 768px) 0px, 33vw"
              className="object-cover object-top"
              priority
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Profile snapshot */}
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe grid grid-cols-2 gap-px overflow-hidden py-0 sm:grid-cols-3 lg:grid-cols-6">
            <Snapshot label="Season" value={cap(profile.colorSeason)} />
            <Snapshot label="Undertone" value={cap(profile.physical.undertone)} />
            <Snapshot label="Contrast" value={cap(profile.physical.contrast)} />
            <Snapshot label="Face shape" value={cap(profile.physical.faceShape)} />
            <Snapshot
              label="Build"
              value={
                isBodyType(profile.physical.bodyType)
                  ? BODY_TYPE_LABELS[profile.physical.bodyType]
                  : cap(profile.physical.bodyType)
              }
            />
            <Snapshot label="Boldness" value={cap(profile.boldness)} />
          </div>
        </section>

        {/* Start here — 3 highest-impact moves */}
        <section className="container-luxe py-20">
          <SectionHead
            title="Start here"
            sub="If you change only three things, change these. The rest of the report builds on them."
          />
          <div className="mt-10">
            <PriorityMoves moves={extras.priorityMoves} />
          </div>
          <div className="mt-14 border-t hairline pt-12">
            <h3 className="text-sm uppercase tracking-wider text-stone-soft">
              The direction — your moodboard
            </h3>
            <div className="mt-6">
              <Moodboard
                portrait="/images/hero-editorial.png"
                look={report.looks[0]?.image ?? "/images/look-work.png"}
                product={report.shopping.find((i) => i.image)?.image}
                palette={report.colors.best.map((c) => c.hex)}
                archetypeName={extras.archetype.name}
              />
            </div>
          </div>
        </section>

        {/* Colours */}
        <section className="border-t hairline container-luxe py-20">
          <SectionHead
            n="01"
            title="Your colour story"
            sub="Soft, warm neutrals flatter your low-contrast colouring. Here's where your palette sits on the wheel — and exactly why each tone works."
          />
          <div className="mt-12 grid items-start gap-12 lg:grid-cols-[300px_1fr]">
            <div className="flex flex-col items-center rounded-3xl border hairline bg-cream/40 p-8">
              <ColorWheel best={report.colors.best} />
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {report.colors.best.map((c) => (
                  <span
                    key={c.name}
                    className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs"
                  >
                    <span
                      className="h-3 w-3 rounded-full ring-1 ring-ink/10"
                      style={{ background: c.hex }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>
              <WheelLegend />
            </div>
            <div>
              <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                Colours that work for you
              </h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {report.colors.best.map((c) => (
                  <ColorCard key={c.name} c={c} />
                ))}
              </div>
              <h3 className="mt-10 text-sm uppercase tracking-wider text-stone-soft">
                Colours to avoid
              </h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {report.colors.avoid.map((c) => (
                  <ColorCard key={c.name} c={c} muted />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 border-t hairline pt-12">
            <ColorDNAGuide dna={extras.colorDNA} />
          </div>
          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <Pairings pairings={extras.pairings} />
            <MetalChips metals={extras.metals} />
          </div>
        </section>

        {/* Hair */}
        <section className="border-y hairline bg-cream/40">
          <div className="container-luxe py-20">
            <SectionHead
              n="02"
              title="Hair, beard & eyewear"
              sub="Cuts that flatter your face shape — with real examples to take to your barber — plus the beard and frame shapes that finish the picture."
            />
            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <div>
                <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                  Recommended
                </h3>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {report.hair.recommend.map((h) => (
                    <HairCard key={h.name} h={h} good />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                  Best avoided
                </h3>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {report.hair.avoid.map((h) => (
                    <HairCard key={h.name} h={h} />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-12 border-t hairline pt-12 lg:grid-cols-2">
              <GroomingGuide items={extras.grooming} />
              <EyewearGuide eyewear={extras.eyewear} />
            </div>
          </div>
        </section>

        {/* Silhouette */}
        <section className="container-luxe py-20">
          <div className="max-w-3xl">
            <div>
              <SectionHead n="03" title="Silhouette & fit" />
              <div className="mt-6 flex items-start gap-6">
                {isBodyType(profile.physical.bodyType) && (
                  <div className="shrink-0 rounded-xl border border-line bg-paper p-3">
                    <BodyTypeFigure id={profile.physical.bodyType} />
                  </div>
                )}
                <p className="font-display text-2xl">{report.silhouette.fit}</p>
              </div>
              <ul className="mt-5 space-y-3">
                {report.silhouette.rules.map((r) => (
                  <li key={r} className="flex items-start gap-3 text-stone">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
              {profile.physical.measurements &&
                Object.values(profile.physical.measurements).some(
                  (v) => v != null,
                ) && <Measurements m={profile.physical.measurements} />}
            </div>
          </div>
          <FitBlueprint specs={extras.fitBlueprint} />
        </section>

        {/* Looks */}
        <section className="container-luxe py-20">
          <SectionHead
            n="04"
            title="Your looks"
            sub="Photorealistic outfit directions for the moments that matter."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {report.looks.map((look) => (
              <article
                key={look.title}
                className="overflow-hidden rounded-2xl border hairline bg-cream/30"
              >
                <div className="relative aspect-[3/4] bg-sand">
                  <Image
                    src={look.image}
                    alt={`${look.title} — ${look.description}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-ink/60 to-transparent p-3 pt-8">
                    {look.palette.map((c) => (
                      <span
                        key={c}
                        className="h-6 w-6 rounded-full border border-paper/40"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper backdrop-blur-sm">
                    {look.context}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-xl">{look.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone">
                    {look.description}
                  </p>
                  <ShopTheLook
                    items={itemsForLook(look, report.shopping)}
                    currency={profile.currency}
                  />
                  {canTryOn && (
                    <div className="mt-4">
                      <LookTryOn
                        reportId={report.id}
                        title={look.title}
                        description={look.description}
                        palette={look.palette}
                      />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Capsule & buying plan */}
        <section className="border-t hairline container-luxe py-20">
          <SectionHead
            n="05"
            title="Capsule & buying plan"
            sub="A small, deliberate set of pieces that multiply into many outfits — bought in the order that pays off fastest."
          />
          <div className="mt-10">
            <Capsule capsule={extras.capsule} currency={profile.currency} />
            <CapsuleMatrix
              combos={matrix}
              reportId={canTryOn ? report.id : undefined}
            />
            <div className="mt-12 border-t hairline pt-10">
              <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                Good · Better · Best — where to spend
              </h3>
              <PriceTiers tiers={extras.priceTiers} currency={profile.currency} />
            </div>
          </div>
        </section>

        {/* Shopping list */}
        <section className="border-y hairline bg-ink text-paper">
          <div className="container-luxe py-20">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow !text-brass-soft">06</p>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                  Your shopping list
                </h2>
                <p className="mt-3 max-w-md text-paper/60">
                  The pieces that unlock the most new outfits. Real products,
                  real links — affiliate links are disclosed.
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <div className="font-display text-3xl">
                  {formatMoney(
                    report.shopping.reduce((s, i) => s + i.priceEur, 0),
                    profile.currency,
                  )}
                </div>
                <div className="text-xs text-paper/50">
                  {report.shopping.length} essential pieces
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-10">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="eyebrow !text-paper/40">{cat}</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <div
                        key={item.title}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-paper/12 bg-ink-soft/40 transition-colors hover:border-paper/30"
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          className="block"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-paper">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={item.title}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div
                                className="h-full w-full"
                                style={{
                                  background: `linear-gradient(140deg, ${item.color}, #1c1a17)`,
                                }}
                              />
                            )}
                            <span className="absolute right-3 top-3 rounded-full bg-ink/75 px-3 py-1 font-display text-sm text-paper backdrop-blur-sm">
                              {formatMoney(item.priceEur, profile.currency)}
                            </span>
                            <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink">
                              {investmentLevel(item)}
                            </span>
                          </div>
                          <div className="p-5">
                            <h4 className="text-paper">{item.title}</h4>
                            <p className="mt-1.5 text-sm leading-relaxed text-paper/55">
                              {item.why}
                            </p>
                            <div className="mt-4 flex items-center justify-between text-xs text-paper/50">
                              <span>{item.retailer}</span>
                              <span className="text-brass-soft transition-colors group-hover:text-paper">
                                Shop →
                              </span>
                            </div>
                          </div>
                        </a>
                        {item.productId && (
                          <div className="px-5 pb-5">
                            <TryOnButton productId={item.productId} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Patterns, accessories & shoes */}
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-20">
            <SectionHead
              n="07"
              title="Patterns & finishing details"
              sub="The textures, fabrics, accessories and shoes that complete the wardrobe."
            />
            <div className="mt-10 border-b hairline pb-12">
              <FabricsGuide fabrics={extras.fabrics} />
            </div>
            <div className="mt-12">
              <StyleDetails />
            </div>
          </div>
        </section>

        {/* How to wear, care & scent */}
        <section className="container-luxe py-20">
          <SectionHead
            n="08"
            title="How to wear it, and make it last"
            sub="The small mechanics and habits that separate well-dressed from expensively-dressed."
          />
          <div className="mt-10">
            <FinishingTouches
              styling={extras.styling}
              care={extras.care}
              fragrance={extras.fragrance}
            />
          </div>
        </section>

        {/* Do / Don't */}
        <section className="border-t hairline container-luxe py-20">
          <SectionHead n="09" title="Do & don't" />
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <ListCard title="Do" items={report.doList} good />
            <ListCard title="Avoid" items={report.dontList} />
          </div>

          <TipsStrip />

          <div className="mt-16 rounded-2xl border hairline bg-cream/40 p-10 text-center">
            <h3 className="font-display text-2xl">Want the full lookbook?</h3>
            <p className="mx-auto mt-2 max-w-md text-stone">
              Unlock 12 photorealistic looks, virtual try-on of every item, and a
              capsule wardrobe built around these pieces.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <ButtonLink href="/#pricing">Upgrade to Lookbook</ButtonLink>
              <a
                href={`/api/reports/${report.id}/pdf`}
                download
                className="rounded-full border border-ink/25 px-7 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                Download PDF
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/* ---------------------------------------------------------------- */

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const STYLE_TIPS: { title: string; desc: string; icon: React.ReactNode }[] = [
  {
    title: "Clean & simple",
    desc: "Fewer, better pieces beat a crowded wardrobe.",
    icon: (
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Fit comes first",
    desc: "Tailoring the shoulders and hem changes everything.",
    icon: (
      <path d="M7 4l5 4 5-4 3 6-4 2v8H8v-8L4 10z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    ),
  },
  {
    title: "Earthy, warm tones",
    desc: "Let your palette lead; keep contrast soft.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </>
    ),
  },
  {
    title: "Grooming is key",
    desc: "A sharp cut and tidy beard finish the whole look.",
    icon: (
      <path d="M6 4v7a6 6 0 0012 0V4M9 20h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    ),
  },
];

function TipsStrip() {
  return (
    <div className="mt-14 rounded-3xl border hairline bg-cream/40 px-8 py-12">
      <p className="eyebrow text-center">Style principles</p>
      <div className="mx-auto mt-8 grid max-w-4xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STYLE_TIPS.map((t) => (
          <div key={t.title} className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper">
              <svg viewBox="0 0 24 24" className="h-6 w-6">
                {t.icon}
              </svg>
            </div>
            <div className="mt-4 font-display text-lg">{t.title}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-stone">{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Measurements({ m }: { m: MeasurementsT }) {
  const rows: [string, number | undefined][] = [
    ["Shoulders", m.shoulderCm],
    ["Chest", m.chestCm],
    ["Waist", m.waistCm],
    ["Hips", m.hipCm],
    ["Sleeve", m.sleeveCm],
  ];
  return (
    <div className="mt-7 border-t hairline pt-5">
      <div className="text-xs uppercase tracking-wider text-stone-soft">
        Your measurements
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
        {rows
          .filter(([, v]) => v != null)
          .map(([label, v]) => (
            <div key={label} className="flex items-baseline justify-between">
              <dt className="text-sm text-stone">{label}</dt>
              <dd className="font-display text-lg text-ink">{v} cm</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-6 py-7 outline outline-1 outline-line">
      <div className="text-xs uppercase tracking-wider text-stone-soft">
        {label}
      </div>
      <div className="mt-1.5 font-display text-xl">{value}</div>
    </div>
  );
}

function SectionHead({
  n,
  title,
  sub,
}: {
  n?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-2xl">
      {n && <p className="eyebrow">{n}</p>}
      <h2 className="mt-3 font-display text-3xl sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 leading-relaxed text-stone">{sub}</p>}
    </div>
  );
}

function ColorCard({ c, muted = false }: { c: ColorRec; muted?: boolean }) {
  return (
    <div
      className={`rounded-2xl border hairline p-4 ${
        muted ? "bg-cream/30" : "bg-paper"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-ink/10"
          style={{ background: c.hex }}
        />
        <div>
          <div className="font-display text-lg leading-tight">{c.name}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wider text-stone-soft">
            {c.hex}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-stone">{c.why}</p>
    </div>
  );
}

function HairCard({ h, good = false }: { h: HairRec; good?: boolean }) {
  return (
    <article className="overflow-hidden rounded-2xl border hairline bg-paper">
      <div className="relative aspect-[4/5] bg-sand">
        {h.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.image}
            alt={h.name}
            className={`h-full w-full object-cover ${
              good ? "" : "opacity-95 grayscale-[35%]"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center font-display text-lg text-stone-soft">
            {h.name}
          </div>
        )}
        <span
          className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
            good ? "bg-ink text-paper" : "bg-paper/90 text-stone"
          }`}
        >
          {good ? "✓" : "✕"}
        </span>
      </div>
      <div className="p-4">
        <div className="font-display text-lg">{h.name}</div>
        <p className="mt-1 text-sm leading-relaxed text-stone">{h.why}</p>
      </div>
    </article>
  );
}

function ListCard({
  title,
  items,
  good = false,
}: {
  title: string;
  items: string[];
  good?: boolean;
}) {
  return (
    <div className="rounded-2xl border hairline p-8">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
            good ? "bg-ink text-paper" : "bg-sand text-stone"
          }`}
        >
          {good ? "✓" : "✕"}
        </span>
        <h3 className="font-display text-2xl">{title}</h3>
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-3 text-stone">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
            <span className="leading-relaxed">{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
