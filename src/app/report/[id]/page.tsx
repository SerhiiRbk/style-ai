import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportView } from "@/lib/data/reports";
import { reportOgMetadataImageUrl } from "@/lib/data/report-og";
import { TryOnButton } from "@/components/TryOnButton";
import { TryOnSelectionProvider } from "@/components/TryOnContext";
import { TryOnTray } from "@/components/TryOnTray";
import { SavedOutfitTryOns } from "@/components/SavedOutfitTryOns";
import { LookTryOn } from "@/components/LookTryOn";
import { CreditsProvider } from "@/components/CreditsContext";
import { getCreditBalance } from "@/lib/credits";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { StylistNote } from "@/components/StylistNote";
import { ReportGenerationBanner } from "@/components/ReportGenerationBanner";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { ShareReportButton } from "@/components/ShareReportButton";
import { DeleteReportButton } from "@/components/DeleteReportButton";
import { GenerateMoreButton } from "@/components/GenerateMoreButton";
import { GenerateLookButton } from "@/components/GenerateLookButton";
import { UnlockAddonButton } from "@/components/UnlockAddonButton";
import { RegenPhotoButton } from "@/components/RegenPhotoButton";
import { BRAND } from "@/lib/brand";
import {
  isMockShopping,
  reportUpsellForTier,
  PREMIUM_ACCESSORY_GEN_LIMIT,
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  type ColorRec,
  type HairRec,
  type ShoppingItem,
  type Tier,
} from "@/lib/report";
import { CREDIT_COSTS } from "@/lib/credit-costs";
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
  FacialHairGuide,
  PremiumEyewearGuide,
  AccessoriesGuide,
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

/** Owner-only content; must not be prefetched or cached without the session cookie. */
export const dynamic = "force-dynamic";

function ogDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const view = await getReportView(id);
  if (!view) return {};

  const { report } = view;
  const title = report.headline
    ? `${report.headline} · ${BRAND.name}`
    : `Your Style Report · ${BRAND.name}`;
  const description = ogDescription(report.summary || report.headline);
  const ogImage = await reportOgMetadataImageUrl(id);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: BRAND.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: report.headline || "Personal style report",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `getReportView` is request-deduped (React cache) so this reuses the work
  // already done in generateMetadata; the balance is fetched alongside it
  // instead of in a later serial round-trip.
  const [view, balanceRaw] = await Promise.all([
    getReportView(id),
    getCreditBalance(),
  ]);
  if (!view) notFound();

  const { report, isOwner, isPublic } = view;
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
  const isFree = report.tier === "free";
  // Live reports (not the demo) can render outfits on the user's own photo.
  const canTryOn = isOwner && report.id !== "demo";
  // Owners can re-generate any AI photo on a live report for 1 credit.
  const canRegen = isOwner && report.id !== "demo";
  // Owner's live credit balance — drives the cost UI on try-on controls.
  const balance = isOwner && report.id !== "demo" ? balanceRaw : null;
  const catalogShopping =
    report.id !== "demo" && !isMockShopping(report.shopping);

  const capsuleImages =
    report.id === "demo" ? CAPSULE_IMAGES : report.capsuleImages;
  const matrix = capsuleImages
    ? extras.matrix.map((c, i) => ({ ...c, image: capsuleImages[i] ?? undefined }))
    : extras.matrix;

  const generation = report.generation;
  const isDemo = report.id === "demo";
  const firstLookImage = report.looks.map((l) => l.image).find(Boolean);
  const heroPortrait = isDemo
    ? "/images/hero-editorial.png"
    : firstLookImage || null;
  const lookImages = report.looks
    .map((l) => l.image)
    .filter((src): src is string => Boolean(src));
  const moodboardPortrait = isDemo
    ? "/images/hero-editorial.png"
    : lookImages[0] || "";
  // Use a SECOND, distinct look so the collage never shows the same photo twice.
  const moodboardLook = isDemo
    ? report.looks[0]?.image || "/images/look-work.png"
    : lookImages.find((src) => src !== moodboardPortrait) || "";

  return (
    <CreditsProvider initialBalance={balance}>
      {generation?.pending || generation?.status === "failed" ? (
        <ReportGenerationBanner reportId={report.id} initial={generation} />
      ) : null}

      {isFree && isOwner ? (
        <div className="border-b hairline bg-brass/10">
          <div className="container-luxe flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              <span className="font-medium">Preview — upgrade for the full report.</span>{" "}
              <span className="text-stone">
                One look included. Try-on costs 1 credit. Unlock all looks, the
                capsule wardrobe and PDF export on paid tiers.
              </span>
            </p>
            <ButtonLink href="/pricing" className="shrink-0 !px-5 !py-2 text-sm">
              See plans &amp; credits
            </ButtonLink>
          </div>
        </div>
      ) : null}

      {/* Report header */}
      <header className="border-b hairline bg-ink text-paper">
        <div className="container-luxe flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-xl">
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-3">
            {!isOwner && isPublic ? (
              <span className="rounded-full border border-paper/20 px-3 py-1.5 text-xs text-paper/60">
                Shared report
              </span>
            ) : null}
            {isOwner && report.id !== "demo" && !isFree ? (
              <ShareReportButton reportId={report.id} initialIsPublic={isPublic} />
            ) : null}
            {isFree ? (
              <Link
                href="/pricing"
                className="rounded-full border border-brass-soft/50 px-5 py-2 text-sm text-brass-soft transition-colors hover:bg-paper hover:text-ink"
                title="PDF export is a paid feature"
              >
                Upgrade for PDF
              </Link>
            ) : (
              <a
                href={`/api/reports/${report.id}/pdf`}
                download
                className="rounded-full border border-paper/25 px-5 py-2 text-sm text-paper/90 transition-colors hover:bg-paper hover:text-ink"
              >
                Download PDF
              </a>
            )}
            {isOwner && report.id !== "demo" ? (
              <DeleteReportButton
                reportId={report.id}
                tone="dark"
                redirectTo="/reports"
              />
            ) : null}
            {isOwner ? (
              <ButtonLink
                href="/start"
                className="!bg-paper !text-ink hover:!bg-cream !px-5 !py-2"
              >
                New report
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/start"
                className="!bg-paper !text-ink hover:!bg-cream !px-5 !py-2"
              >
                Create yours
              </ButtonLink>
            )}
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
          {heroPortrait ? (
            <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl border border-paper/15 md:block">
              <ReportZoomImage
                src={heroPortrait}
                alt="Your style direction"
                fill
                sizes="(max-width: 768px) 0px, 33vw"
                className="object-cover object-top"
                priority
              />
            </div>
          ) : null}
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
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone">
              A quick visual summary of where we&apos;re taking your style: example
              looks on your photo, your colour palette, a hero piece, and the
              overall direction.
            </p>
            <div className="mt-6">
              <Moodboard
                portrait={moodboardPortrait}
                look={moodboardLook}
                product={report.shopping.find((i) => i.image)?.image}
                palette={report.colors.best.map((c) => c.hex)}
                archetypeName={extras.archetype.name}
                archetypeLine={extras.archetype.line}
                zoomable
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
            <div className="mt-10">
              <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                Recommended
              </h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {report.hair.recommend.map((h, i) => (
                  <HairCard
                    key={h.name}
                    h={h}
                    good
                    dualAngle={
                      report.tier === "lookbook" || report.tier === "premium"
                    }
                    reportId={report.id}
                    group="recommend"
                    index={i}
                    owner={canRegen}
                  />
                ))}
              </div>
            </div>

            <div className="mt-12 border-t hairline pt-12">
              <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                Best avoided
              </h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {report.hair.avoid.map((h, i) => (
                  <HairCard
                    key={h.name}
                    h={h}
                    reportId={report.id}
                    group="avoid"
                    index={i}
                    owner={canRegen}
                  />
                ))}
              </div>
            </div>

            <div className="mt-12 grid gap-12 border-t hairline pt-12 lg:grid-cols-2">
              <GroomingGuide items={extras.grooming} />
              {report.tier === "premium" ? (
                report.facialHair?.length ? (
                  <div>
                    <FacialHairGuide
                      items={report.facialHair}
                      reportId={report.id}
                      owner={canRegen}
                    />
                    {isOwner && report.id !== "demo" ? (
                      <GenerateMoreButton
                        reportId={report.id}
                        type="facial_hair"
                        cost={CREDIT_COSTS.facialhair_extra}
                        count={
                          report.facialHair.filter((i) => i.image).length
                        }
                        baseCount={PREMIUM_FACIAL_HAIR_GEN_LIMIT}
                        label="Generate 2 more"
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border hairline bg-cream/30 p-6 text-sm leading-relaxed text-stone">
                    <p className="font-display text-lg text-ink">
                      Recommended facial hair
                    </p>
                    <p className="mt-2">
                      Beard and mustache previews on your photo are being
                      generated.
                    </p>
                  </div>
                )
              ) : (
                <EyewearGuide eyewear={extras.eyewear} />
              )}
            </div>

            {report.tier === "premium" ? (
              <div className="mt-12 border-t hairline pt-12">
                {report.eyewear?.length ? (
                  <>
                    <PremiumEyewearGuide
                      items={report.eyewear}
                      reportId={report.id}
                      owner={canRegen}
                    />
                    {isOwner && report.id !== "demo" ? (
                      <GenerateMoreButton
                        reportId={report.id}
                        type="eyewear"
                        cost={CREDIT_COSTS.eyewear_extra}
                        count={report.eyewear.filter((i) => i.image).length}
                        baseCount={PREMIUM_EYEWEAR_GEN_LIMIT}
                        label="Generate 2 optical + 2 sunglasses"
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border hairline bg-cream/30 p-6 text-sm leading-relaxed text-stone">
                    <p className="font-display text-lg text-ink">
                      Recommended glasses
                    </p>
                    <p className="mt-2">
                      Frame previews on your photo are being generated.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {report.tier === "premium" &&
            (report.accessories?.length || generation?.pending) ? (
              <div className="mt-12 border-t hairline pt-12">
                {report.accessories?.length ? (
                  <>
                    <AccessoriesGuide
                      items={report.accessories}
                      reportId={report.id}
                      owner={canRegen}
                    />
                    {isOwner && report.id !== "demo" ? (
                      <GenerateMoreButton
                        reportId={report.id}
                        type="accessories"
                        cost={CREDIT_COSTS.accessory_extra}
                        count={
                          report.accessories.filter((i) => i.image).length
                        }
                        baseCount={PREMIUM_ACCESSORY_GEN_LIMIT}
                        label="Generate 2 more"
                      />
                    ) : null}
                  </>
                ) : generation?.pending ? (
                  <div className="rounded-2xl border hairline bg-cream/30 p-6 text-sm leading-relaxed text-stone">
                    <p className="font-display text-lg text-ink">
                      Accessory styling
                    </p>
                    <p className="mt-2">
                      Scarves, neckwear and ties on your photo are being
                      generated.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {report.tier !== "premium" &&
            ((isOwner && report.id !== "demo") ||
              Boolean(
                report.facialHair?.length ||
                  report.eyewear?.length ||
                  report.accessories?.length,
              )) ? (
              <div className="mt-12 border-t hairline pt-12">
                <h3 className="text-sm uppercase tracking-wider text-stone-soft">
                  See it on your photo
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone">
                  Generate photorealistic previews of facial hair, eyewear and
                  accessories on your own photo — available as add-ons for this
                  report.{" "}
                  <Link href="/pricing" className="text-brass hover:text-ink">
                    All included with Premium.
                  </Link>
                </p>

                <div className="mt-8 space-y-10">
                  {report.facialHair?.length ? (
                    <FacialHairGuide
                      items={report.facialHair}
                      reportId={report.id}
                      owner={canRegen}
                    />
                  ) : isOwner && report.id !== "demo" ? (
                    <AddonUnlockCard
                      title="Facial-hair previews"
                      desc="Four beard & mustache styles rendered on your own photo."
                      reportId={report.id}
                      type="facial_hair"
                      cost={CREDIT_COSTS.facialhair_addon}
                      label="Generate 4 facial-hair previews"
                    />
                  ) : null}

                  {report.eyewear?.length ? (
                    <PremiumEyewearGuide
                      items={report.eyewear}
                      reportId={report.id}
                      owner={canRegen}
                    />
                  ) : isOwner && report.id !== "demo" ? (
                    <AddonUnlockCard
                      title="Eyewear previews"
                      desc="Two optical frames and two pairs of sunglasses on your photo."
                      reportId={report.id}
                      type="eyewear"
                      cost={CREDIT_COSTS.eyewear_addon}
                      label="Generate 2 optical + 2 sunglasses"
                    />
                  ) : null}

                  {report.accessories?.length ? (
                    <AccessoriesGuide
                      items={report.accessories}
                      reportId={report.id}
                      owner={canRegen}
                    />
                  ) : isOwner && report.id !== "demo" ? (
                    <AddonUnlockCard
                      title="Accessory styling"
                      desc="Two accessory previews (scarves, neckwear, ties) on your photo."
                      reportId={report.id}
                      type="accessories"
                      cost={CREDIT_COSTS.accessory_addon}
                      label="Generate 2 accessory previews"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
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
            {report.looks.map((look, i) => (
              <article
                key={look.title}
                className="overflow-hidden rounded-2xl border hairline bg-cream/30"
              >
                <div className="relative aspect-[9/16] bg-sand">
                  {look.image ? (
                    <ReportZoomImage
                      src={look.image}
                      alt={`${look.title} — ${look.description}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-stone-soft">
                      Outfit photo generating…
                    </div>
                  )}
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
                    items={
                      report.lookItems?.[i]?.length
                        ? report.lookItems[i]
                        : itemsForLook(look, report.shopping)
                    }
                    currency={profile.currency}
                  />
                  {canTryOn && (
                    <div className="mt-4">
                      <LookTryOn
                        reportId={report.id}
                        title={look.title}
                        description={look.description}
                        palette={look.palette}
                        lookIndex={i}
                      />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {canTryOn && !generation?.pending ? (
            <GenerateLookButton
              reportId={report.id}
              cost={CREDIT_COSTS.look_extra}
            />
          ) : null}
        </section>

        {/* Capsule & buying plan */}
        <section className="border-t hairline container-luxe py-20">
          <SectionHead
            n="05"
            title="Capsule & buying plan"
            sub="A small, deliberate set of pieces that multiply into many outfits — bought in the order that pays off fastest."
          />
          {isFree ? (
            <UpgradeLock
              title="The capsule wardrobe is a paid feature"
              body="See your full mix-and-match capsule, the week-of-outfits matrix, and a Good · Better · Best buying plan — included from the Lookbook tier."
            />
          ) : (
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
          )}
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
                  {catalogShopping
                    ? "Pieces matched to your palette from our catalogue — real products and affiliate links."
                    : report.id === "demo"
                      ? "Sample curated list for the demo report."
                      : "The pieces that unlock the most new outfits. Real products, real links — affiliate links are disclosed."}
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

            {canTryOn ? (
              <p className="mt-4 text-xs text-paper/45">
                Tip: use “+ Add to outfit” on up to 4 pieces to render them
                together on your photo in a single try-on.
              </p>
            ) : null}

            <TryOnSelectionProvider>
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
                        {item.productId && canTryOn ? (
                          <div className="px-5 pb-5">
                            <TryOnButton
                              productId={item.productId}
                              reportId={report.id}
                              imageUrl={item.image}
                              title={item.title}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {canTryOn ? (
              <TryOnTray reportId={report.id} cost={CREDIT_COSTS.tryon} />
            ) : null}
            {canTryOn ? (
              <SavedOutfitTryOns
                reportId={report.id}
                initial={report.outfitTryons}
              />
            ) : null}
            </TryOnSelectionProvider>
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

          <ReportTierUpsell tier={report.tier} reportId={report.id} />
        </section>
      </main>
      <Footer />
    </CreditsProvider>
  );
}

/* ---------------------------------------------------------------- */

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function AddonUnlockCard({
  title,
  desc,
  reportId,
  type,
  cost,
  label,
}: {
  title: string;
  desc: string;
  reportId: string;
  type: "accessories" | "facial_hair" | "eyewear";
  cost: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border hairline bg-cream/30 p-6">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone">{desc}</p>
      <UnlockAddonButton
        reportId={reportId}
        type={type}
        cost={cost}
        label={label}
      />
    </div>
  );
}

function ReportTierUpsell({
  tier,
  reportId,
}: {
  tier: Tier;
  reportId: string;
}) {
  const upsell = reportUpsellForTier(tier);
  if (!upsell) return null;

  return (
    <div className="mt-16 rounded-2xl border hairline bg-cream/40 p-10 text-center">
      <h3 className="font-display text-2xl">{upsell.title}</h3>
      <p className="mx-auto mt-2 max-w-md text-stone">{upsell.body}</p>
      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink href={upsell.ctaHref}>{upsell.ctaLabel}</ButtonLink>
        {tier === "free" ? (
          <Link
            href="/pricing"
            className="rounded-full border border-ink/25 px-7 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Upgrade for PDF
          </Link>
        ) : (
          <a
            href={`/api/reports/${reportId}/pdf`}
            download
            className="rounded-full border border-ink/25 px-7 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}

function UpgradeLock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-ink/20 bg-cream/40 px-8 py-14 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M7 11V8a5 5 0 0110 0v3M5 11h14v9H5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h3 className="mt-5 font-display text-2xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-stone">{body}</p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/pricing">See plans &amp; credits</ButtonLink>
      </div>
    </div>
  );
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

function HairCard({
  h,
  good = false,
  dualAngle = false,
  reportId,
  group,
  index,
  owner = false,
}: {
  h: HairRec;
  good?: boolean;
  dualAngle?: boolean;
  reportId?: string;
  group?: "recommend" | "avoid";
  index?: number;
  owner?: boolean;
}) {
  const showDual = dualAngle && good;
  const hasFront = Boolean(h.image);
  const hasSide = Boolean(h.imageSide);
  const showSplit = showDual && (hasFront || hasSide);
  const canRegen =
    owner && Boolean(reportId) && group != null && index != null;
  const frontGenerated = canRegen && /^https?:/.test(h.image ?? "");
  const sideGenerated = canRegen && /^https?:/.test(h.imageSide ?? "");

  return (
    <article className="overflow-hidden rounded-2xl border hairline bg-paper">
      <div className="relative bg-sand">
        {showSplit ? (
          <div className="grid grid-cols-2 divide-x divide-line">
            <div className="relative aspect-[4/5]">
              {hasFront ? (
                <ReportZoomImage
                  src={h.image!}
                  alt={`${h.name} — front view`}
                  wrapperClassName="relative block h-full w-full"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-stone-soft">
                  <span>Front</span>
                  <span>Generating…</span>
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone">
                Front
              </span>
              {frontGenerated ? (
                <RegenPhotoButton
                  reportId={reportId!}
                  kind="hair"
                  group={group}
                  index={index!}
                  angle="front"
                />
              ) : null}
            </div>
            <div className="relative aspect-[4/5]">
              {hasSide ? (
                <ReportZoomImage
                  src={h.imageSide!}
                  alt={`${h.name} — side view`}
                  wrapperClassName="relative block h-full w-full"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-stone-soft">
                  <span>Side</span>
                  <span>Generating…</span>
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone">
                Side
              </span>
              {sideGenerated ? (
                <RegenPhotoButton
                  reportId={reportId!}
                  kind="hair"
                  group={group}
                  index={index!}
                  angle="side"
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="relative aspect-[4/5]">
            {h.image ? (
              <ReportZoomImage
                src={h.image}
                alt={h.name}
                wrapperClassName="relative block h-full w-full"
                className={`h-full w-full object-cover ${
                  good ? "" : "opacity-95 grayscale-[35%]"
                }`}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-stone-soft">
                <span className="font-display text-lg text-stone">{h.name}</span>
                <span>Generating preview…</span>
              </div>
            )}
            {frontGenerated ? (
              <RegenPhotoButton
                reportId={reportId!}
                kind="hair"
                group={group}
                index={index!}
                angle="front"
              />
            ) : null}
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
