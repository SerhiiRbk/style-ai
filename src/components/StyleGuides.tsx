import Image from "next/image";
import { ASSET_PROXY_PREFIX, isGeneratedReportImage } from "@/lib/asset-url";
import { FabricStripe } from "@/components/FabricSwatch";
import { ReportImageGenerating } from "@/components/luxe/ReportImageGenerating";
import { RegenPhotoHint } from "@/components/RegenPhotoHint";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { RegenPhotoButton } from "@/components/RegenPhotoButton";
import { formatMoney, formatOfferPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { humanizeProductTitle } from "@/lib/product-title";
import { makeT } from "@/lib/i18n/report";
import type { ReportLanguage } from "@/lib/languages";
import {
  metalAvoidSwatchSrc,
  metalSwatchSrc,
} from "@/lib/metal-swatches";
import { LookTryOn } from "./LookTryOn";
import type {
  ShoppingItem,
  EyewearRec,
  FacialHairRec,
  AccessoryRec,
  HeadwearRec,
} from "@/lib/report";
import type {
  Archetype as ArchetypeT,
  CapsulePlan,
  ColorCombo,
  ColorDNA as ColorDNAT,
  FitSpec,
  FrameRec,
  FrameShapeId,
  GroomingItem,
  Metal,
  OutfitCombo,
  Pairings as PairingsT,
  PriceTier,
  PriorityMove,
  WatchGuide as WatchGuideT,
  ShoeGuide as ShoeGuideT,
  BeltGuide as BeltGuideT,
} from "@/lib/style-extras";

/**
 * Fill-style image that optimizes bundled static assets (`/images/…`) to WebP
 * via the Next optimizer, while loading generated report photos (asset proxy —
 * already WebP-transcoded) and remote catalog URLs directly.
 */
export function StaticFillImg({
  src,
  alt,
  className = "h-full w-full object-cover",
  sizes = "(max-width: 640px) 50vw, 25vw",
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const isLocalStatic =
    src.startsWith("/") && !src.startsWith(ASSET_PROXY_PREFIX);
  if (isLocalStatic) {
    return (
      <Image src={src} alt={alt} fill sizes={sizes} className={className} />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

/* -------------------------------- moodboard ------------------------------- */

function MoodboardPhoto({
  src,
  alt,
  zoomable,
  priority = false,
  generating = false,
}: {
  src: string;
  alt: string;
  zoomable?: boolean;
  priority?: boolean;
  generating?: boolean;
}) {
  if (!src) {
    return generating ? (
      <ReportImageGenerating
        label="Styling your look"
        detail="Photorealistic preview on your photo"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-sm text-stone-soft">
        Generating…
      </div>
    );
  }
  if (zoomable) {
    return (
      <ReportZoomImage
        src={src}
        alt={alt}
        priority={priority}
        fill
        sizes="(max-width: 640px) 50vw, 33vw"
        className="object-cover object-top"
      />
    );
  }
  return (
    <StaticFillImg
      src={src}
      alt={alt}
      className="h-full w-full object-cover object-top"
    />
  );
}

export function Moodboard({
  portrait,
  look,
  product,
  palette,
  archetypeName,
  archetypeLine,
  zoomable,
  generating = false,
  lang,
}: {
  portrait: string;
  look?: string;
  product?: string;
  palette: string[];
  archetypeName: string;
  archetypeLine?: string;
  zoomable?: boolean;
  generating?: boolean;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  // Only show the second photo when it's a genuinely different image.
  const showSecondLook = Boolean(look) && look !== portrait;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <figure className="relative col-span-2 aspect-[5/4] overflow-hidden rounded-2xl bg-sand sm:col-span-1 sm:row-span-2 sm:aspect-auto">
        <MoodboardPhoto
          src={portrait}
          alt="Your look on your photo"
          zoomable={zoomable}
          priority
          generating={generating}
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
          {tt("Your look")}
        </span>
      </figure>

      {showSecondLook ? (
        <figure className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
          <MoodboardPhoto
            src={look!}
            alt="A second look"
            zoomable={zoomable}
            generating={generating}
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
            {tt("Another look")}
          </span>
        </figure>
      ) : generating ? (
        <figure className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
          <ReportImageGenerating
            label={tt("Another look")}
            detail="Building your second outfit"
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
            {tt("Another look")}
          </span>
        </figure>
      ) : null}

      <div className="relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl">
        {palette.slice(0, 5).map((hex, i) => (
          <span key={`${hex}-${i}`} className="relative min-h-0 flex-1">
            <FabricStripe hex={hex} uid={`mb${i}`} />
          </span>
        ))}
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
          {tt("Your palette")}
        </span>
      </div>

      {product && (
        <figure className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-paper">
          <MoodboardPhoto
            src={product}
            alt="A hero piece for your wardrobe"
            zoomable={zoomable}
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
            {tt("Hero piece")}
          </span>
        </figure>
      )}

      <DirectionTile
        archetypeName={archetypeName}
        archetypeLine={archetypeLine}
        label={tt("Your direction")}
      />
    </div>
  );
}

/** Moodboard "Your direction" tile — ink atelier card, not an empty black slab. */
function DirectionTile({
  archetypeName,
  archetypeLine,
  label,
}: {
  archetypeName: string;
  archetypeLine?: string;
  label: string;
}) {
  const mark = (archetypeName.trim().charAt(0) || "V").toUpperCase();
  return (
    <div className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-ink p-5 text-paper">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 200 250"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <radialGradient id="dirGlow" cx="42%" cy="28%" r="72%">
            <stop offset="0" stopColor="#2a251d" />
            <stop offset="0.55" stopColor="#1a1610" />
            <stop offset="1" stopColor="#0c0a07" />
          </radialGradient>
          <linearGradient id="dirVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.15" />
            <stop offset="0.45" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.55" />
          </linearGradient>
          <pattern
            id="dirGrain"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 2H8 M0 6H8"
              stroke="#e2c58f"
              strokeOpacity="0.045"
              strokeWidth="0.5"
            />
            <path
              d="M2 0V8 M6 0V8"
              stroke="#000"
              strokeOpacity="0.14"
              strokeWidth="0.55"
            />
          </pattern>
        </defs>
        <rect width="200" height="250" fill="url(#dirGlow)" />
        <rect width="200" height="250" fill="url(#dirGrain)" />
        <rect width="200" height="250" fill="url(#dirVignette)" />
        {/* Faint construction marks */}
        <g
          fill="none"
          stroke="#c2a06a"
          strokeOpacity="0.16"
          strokeWidth="0.7"
        >
          <path d="M18 22H182" />
          <path d="M18 228H182" />
          <path d="M22 18V232" />
          <path d="M178 18V232" />
          <path d="M100 36 L106 42 L100 48 L94 42 Z" fill="#c2a06a" fillOpacity="0.28" stroke="none" />
        </g>
        <text
          x="100"
          y="128"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#c2a06a"
          fillOpacity="0.14"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="148"
          fontWeight="400"
        >
          {mark}
        </text>
      </svg>

      <div className="relative z-10">
        <span className="text-[10px] uppercase tracking-[0.2em] text-brass-soft">
          {label}
        </span>
        <span className="mt-1 block font-display text-xl leading-tight">
          {archetypeName}
        </span>
        {archetypeLine ? (
          <span className="mt-2 block text-xs leading-relaxed text-paper/65">
            {archetypeLine}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ wheel legend ------------------------------ */

export function WheelLegend({ lang }: { lang?: ReportLanguage }) {
  const tt = makeT(lang);
  return (
    <div className="mt-5 space-y-1.5 text-xs text-stone">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-brass ring-2 ring-paper" />
        {tt("Your palette on the hue wheel")}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border border-dashed border-ink" />
        {tt("Complementary accent (opposite hue)")}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-4 rounded-full bg-ink/70" />
        {tt("Analogous range (neighbouring tones)")}
      </div>
    </div>
  );
}

/* -------------------------------- archetype ------------------------------- */

export function ArchetypeBadge({
  archetype,
  lang,
}: {
  archetype: ArchetypeT;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div className="inline-flex flex-col">
      <span className="text-[11px] uppercase tracking-[0.2em] text-brass-soft">
        {tt("Your style archetype")}
      </span>
      <span className="mt-1 font-display text-2xl text-paper">
        {archetype.name}
      </span>
      <span className="mt-1 text-sm text-paper/60">{archetype.line}</span>
    </div>
  );
}

/* -------------------------------- colour DNA ------------------------------ */

export function ColorDNAGuide({
  dna,
  lang,
}: {
  dna: ColorDNAT;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  const rows: { label: string; value: string }[] = [
    { label: "Best white", value: dna.bestWhite },
    { label: "Best denim", value: dna.bestDenim },
    { label: "Metal", value: dna.metal },
    { label: "Instead of black", value: dna.blackAlt },
  ];
  return (
    <div className="rounded-2xl border hairline bg-paper p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          {tt("Your colour DNA")}
        </h3>
        <span className="rounded-full bg-ink px-3 py-1 text-xs text-paper">
          {dna.subseason}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {dna.neutrals.map((c) => (
          <span
            key={c.name}
            className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs"
          >
            <span
              className="h-3 w-3 rounded-full ring-1 ring-ink/10"
              style={{ background: c.hex }}
            />
            {c.name}
          </span>
        ))}
      </div>
      <dl className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="border-t hairline pt-2">
            <dt className="text-[11px] uppercase tracking-wider text-stone-soft">
              {tt(r.label)}
            </dt>
            <dd className="text-sm text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 rounded-xl bg-cream/50 px-4 py-3 text-sm leading-relaxed text-stone">
        <span className="font-medium text-ink">{tt("Contrast:")} </span>
        {dna.contrastRule}
      </p>
    </div>
  );
}

/* --------------------------- shopping item thumb -------------------------- */

function ShoppingItemThumb({
  item,
  alt,
}: {
  item: ShoppingItem;
  alt?: string;
}) {
  return (
    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-sand">
      {item.image ? (
        <StaticFillImg
          src={item.image}
          alt={alt ?? item.title}
          sizes="28px"
        />
      ) : (
        <span
          className="block h-full w-full"
          style={{ background: item.color }}
        />
      )}
    </span>
  );
}

/* ------------------------------ shop the look ----------------------------- */

export function ShopTheLook({
  items,
  currency,
  lang,
  selectable = false,
  selectedIds,
  onToggle,
}: {
  items: ShoppingItem[];
  currency: Currency;
  lang?: ReportLanguage;
  /** When true, each item gets an include/exclude toggle for the try-on. */
  selectable?: boolean;
  /** Keys (productId ?? title) of items currently included in the try-on. */
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const tt = makeT(lang);
  if (!items.length) return null;
  const showAlternativesNote =
    items.some((it) => it.similarPick) || items.length < 3;
  return (
    <div className="mt-4 border-t hairline pt-4">
      <div className="text-[11px] uppercase tracking-wider text-stone-soft">
        {tt("Shop a look like this")}
      </div>
      {showAlternativesNote ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-soft">
          {tt(
            "Stylistic alternatives from our catalogue — close in category and colour, not necessarily the exact pieces in the photo.",
          )}
        </p>
      ) : null}
      {selectable ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-soft">
          {tt("Toggle items to choose what’s included when you try this on.")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => {
          const id = it.productId ?? it.title;
          const on = !selectable || (selectedIds?.has(id) ?? true);
          return (
            <div
              key={id}
              className={`group flex items-center gap-2 rounded-full border bg-paper py-1 pr-3 transition-colors ${
                selectable ? "pl-2" : "pl-1"
              } ${
                on
                  ? "border-line hover:border-ink/30"
                  : "border-line/60 opacity-50"
              }`}
            >
              {selectable ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={
                    on
                      ? tt("Included in try-on")
                      : tt("Excluded from try-on")
                  }
                  onClick={() => onToggle?.(id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none transition-colors ${
                    on
                      ? "border-brass/40 bg-brass/10 text-brass"
                      : "border-line bg-paper text-transparent"
                  }`}
                >
                  ✓
                </button>
              ) : null}
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="flex items-center gap-2"
              >
                <ShoppingItemThumb item={it} />
                <span className="text-xs text-ink">
                  {humanizeProductTitle(it.title)}
                </span>
                {it.similarPick ? (
                  <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone">
                    {tt("Similar")}
                  </span>
                ) : null}
                <span className="text-xs text-stone-soft">
                  {formatOfferPrice({
                    priceEur: it.priceEur,
                    displayCurrency: currency,
                    offerCurrency: it.currency,
                    priceNative: it.priceNative,
                  })}
                </span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ capsule matrix ---------------------------- */

export function CapsuleMatrix({
  combos,
  reportId,
  generating = false,
  lang,
}: {
  combos: OutfitCombo[];
  reportId?: string;
  generating?: boolean;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  if (!combos.length) return null;
  const hasPhotos = combos.some((c) => c.image);
  const visual = hasPhotos || generating;
  return (
    <div className="mt-10">
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Your week, styled — mix & match")}
      </h3>
      <p className="mt-2 max-w-xl text-sm text-stone">
        {tt(
          "The same handful of pieces, recombined into a full week of outfits — so nothing in your wardrobe sits unused.",
        )}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combos.map((c, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border hairline bg-paper"
          >
            {(c.image || generating) && (
              <div className="relative aspect-[9/16] overflow-hidden bg-sand">
                {c.image ? (
                  <ReportZoomImage
                    src={c.image}
                    alt={`${c.context} outfit`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-top"
                  />
                ) : (
                  <ReportImageGenerating
                    label={c.context}
                    detail="Week-of-outfits preview"
                  />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper backdrop-blur-sm">
                  {c.context}
                </span>
              </div>
            )}
            <div className="p-4">
              {!visual && (
                <div className="text-[11px] uppercase tracking-wider text-brass">
                  {c.context}
                </div>
              )}
              <ul className={`${visual ? "" : "mt-2"} space-y-1`}>
                {c.pieces.map((p) => {
                  const owned = c.owned?.includes(p);
                  return (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <span className="h-1 w-1 rounded-full bg-stone-soft" />
                      <span>{humanizeProductTitle(p)}</span>
                      {owned && (
                        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-soft">
                          {tt("from your wardrobe")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {reportId && (
                <div className="mt-3 border-t hairline pt-3">
                  <LookTryOn
                    reportId={reportId}
                    title={c.context}
                    description={c.pieces.join(", ")}
                    pieces={c.pieces}
                    outfitReferenceUrl={c.image}
                    lookIndex={i}
                    kind="capsule"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- price tiers ------------------------------ */

export function PriceTiers({
  tiers,
  currency,
  lang,
}: {
  tiers: PriceTier[];
  currency: Currency;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  if (!tiers.length) return null;
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border hairline">
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-cream/60 px-5 py-3 text-[11px] uppercase tracking-wider text-stone-soft">
        <span>{tt("Category")}</span>
        <span>{tt("Good")}</span>
        <span>{tt("Better")}</span>
        <span>{tt("Best")}</span>
      </div>
      <div className="divide-y divide-line">
        {tiers.map((t) => (
          <div key={t.category} className="px-5 py-4">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-baseline">
              <span className="font-display text-base">{t.category}</span>
              <span className="text-sm text-stone">
                {formatMoney(t.good, currency)}
              </span>
              <span className="text-sm font-medium text-ink">
                {formatMoney(t.better, currency)}
              </span>
              <span className="text-sm text-stone">
                {formatMoney(t.best, currency)}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-soft">{t.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- priority moves ------------------------------- */

export function PriorityMoves({ moves }: { moves: PriorityMove[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border hairline bg-line md:grid-cols-3">
      {moves.map((m) => (
        <div key={m.n} className="bg-paper p-7">
          <div className="font-display text-3xl text-brass">{m.n}</div>
          <h3 className="mt-3 font-display text-xl leading-snug">{m.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone">{m.why}</p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- metals ---------------------------------- */

export function MetalChips({
  metals,
  lang,
}: {
  metals: { recommend: Metal[]; avoidNote: string };
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  const avoidSrc = metalAvoidSwatchSrc(metals.recommend.map((m) => m.name));
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Metals & hardware")}
      </h3>
      <div className="mt-4 space-y-3">
        {metals.recommend.map((m) => {
          const src = metalSwatchSrc(m.name);
          return (
            <div key={m.name} className="flex items-start gap-3">
              {src ? (
                // Static public SVG — plain <img> avoids next/image SVG quirks.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  width={40}
                  height={40}
                  className="mt-0.5 h-10 w-10 shrink-0"
                />
              ) : (
                <span
                  className="mt-0.5 h-10 w-10 shrink-0 rounded-full ring-1 ring-ink/10"
                  style={{ background: m.hex }}
                  aria-hidden
                />
              )}
              <div>
                <div className="font-display text-base leading-tight">
                  {m.name}
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-stone">
                  {m.why}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        {avoidSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avoidSrc}
            alt=""
            width={28}
            height={28}
            className="mt-0.5 h-7 w-7 shrink-0 opacity-90"
          />
        ) : null}
        <p className="text-xs leading-relaxed text-stone-soft">
          {metals.avoidNote}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------- watch ---------------------------------- */

function WatchSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-4 w-4 shrink-0 rounded-full ring-1 ring-ink/10"
        style={{ background: hex }}
        aria-hidden
      />
      <span className="text-[11px] text-stone">{label}</span>
    </div>
  );
}

export function WatchGuide({
  guide,
  image,
  lang,
}: {
  guide: WatchGuideT;
  image?: string | null;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <section className="report-keep-together">
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Watches")}
      </h3>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-stone">
        {guide.intro}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {image ? (
          <div className="overflow-hidden rounded-2xl border hairline bg-cream/40">
            <ReportZoomImage
              src={image}
              alt={tt("Recommended watch styles")}
              wrapperClassName="relative block aspect-[4/3] w-full"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        ) : null}

        <div className="space-y-4">
          {guide.variants.map((v) => (
            <div
              key={v.context}
              className="rounded-xl border hairline bg-paper px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-display text-base leading-tight">
                  {v.type}
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-stone-soft">
                  {v.context}
                </span>
              </div>
              {v.shape ? (
                <div className="mt-0.5 text-[11px] text-stone-soft">
                  {tt("Shape")}: {v.shape}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                <WatchSwatch hex={v.caseHex} label={`${tt("Case")}: ${v.caseMetal}`} />
                <WatchSwatch hex={v.dialHex} label={`${tt("Dial")}: ${v.dial}`} />
                <WatchSwatch hex={v.strapHex} label={`${tt("Strap")}: ${v.strap}`} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone">{v.why}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.shapeNote}
      </p>
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.cuffNote}
      </p>
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.avoidNote}
      </p>
    </section>
  );
}

/* --------------------------------- shoes ---------------------------------- */

export function ShoeGuide({
  guide,
  image,
  lang,
}: {
  guide: ShoeGuideT;
  image?: string | null;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <section className="report-keep-together">
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Footwear system")}
      </h3>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-stone">
        {guide.intro}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {image ? (
          <div className="overflow-hidden rounded-2xl border hairline bg-cream/40">
            <ReportZoomImage
              src={image}
              alt={tt("Recommended footwear")}
              // Tall 5×2 board — keep natural aspect (4:3 cover-crop hid lower pairs).
              wrapperClassName="relative block w-full"
              className="h-auto w-full object-contain"
              fill={false}
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        ) : null}

        <div className="space-y-4">
          {guide.variants.map((v) => (
            <div
              key={v.role}
              className="rounded-xl border hairline bg-paper px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-display text-base leading-tight">
                  {v.style}
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-stone-soft">
                  {v.role}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full ring-1 ring-ink/10"
                    style={{ background: v.colorHex }}
                    aria-hidden
                  />
                  <span className="text-[11px] text-stone">
                    {tt("Colour")}: {v.color}
                  </span>
                </div>
                <span className="text-[11px] text-stone-soft">{v.wearWith}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone">{v.why}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.leatherRule}
      </p>
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.avoidNote}
      </p>
    </section>
  );
}

/* --------------------------------- belts ---------------------------------- */

export function BeltGuide({
  guide,
  lang,
}: {
  guide: BeltGuideT;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <section className="report-keep-together">
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Belts")}
      </h3>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-stone">
        {guide.intro}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {guide.variants.map((v) => (
          <div
            key={v.context}
            className="rounded-xl border hairline bg-paper px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-display text-base leading-tight">
                {v.context}
              </div>
              <span className="shrink-0 text-[11px] uppercase tracking-wider text-stone-soft">
                {v.width}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-4 w-4 shrink-0 rounded-full ring-1 ring-ink/10"
                  style={{ background: v.strapHex }}
                  aria-hidden
                />
                <span className="text-[11px] text-stone">
                  {tt("Strap")}: {v.strap}
                </span>
              </div>
              <span className="text-[11px] text-stone-soft">
                {tt("Buckle")}: {v.buckle}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-stone-soft">{v.wearWith}</div>
            <p className="mt-2 text-sm leading-relaxed text-stone">{v.why}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border hairline bg-cream/40 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-stone-soft">
          {tt("Belt by trouser type")}
        </div>
        <dl className="mt-2 space-y-1.5">
          {guide.trouserRules.map((r) => (
            <div key={r.trouser} className="text-sm leading-relaxed">
              <dt className="inline font-medium text-ink">{r.trouser}: </dt>
              <dd className="inline text-stone">{r.belt}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-5 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.matchRule}
      </p>
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-stone-soft">
        {guide.avoidNote}
      </p>
    </section>
  );
}

/* ------------------------------- pairings --------------------------------- */

export function Pairings({
  pairings,
  lang,
}: {
  pairings: PairingsT;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("How to combine them")}
      </h3>
      {pairings.hero && (
        <p className="mt-3 text-sm leading-relaxed text-stone">
          {tt("Your hero colour near the face is")}{" "}
          <span className="font-display text-ink">{pairings.hero.name}</span>
          {tt(" — build neutral bases and let it lead.")}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {pairings.combos.map((c: ColorCombo) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-xl border hairline bg-paper p-3"
          >
            <div className="flex">
              {c.hexes.map((h, i) => (
                <span
                  key={i}
                  className="h-7 w-7 rounded-full ring-2 ring-paper"
                  style={{ background: h, marginLeft: i ? -8 : 0 }}
                />
              ))}
            </div>
            <div>
              <div className="text-sm font-medium">{c.name}</div>
              <p className="text-xs leading-relaxed text-stone-soft">{c.why}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- eyewear --------------------------------- */

export function FrameShape({
  id,
  className = "",
}: {
  id: FrameShapeId;
  className?: string;
}) {
  const LY = 16;
  const LW = 22;
  const LH = 15;
  const lens = (cx: number) => {
    const x = cx - LW / 2;
    const y = LY - LH / 2;
    if (id === "round")
      return <circle cx={cx} cy={LY} r={LH / 2 + 1} />;
    if (id === "geometric") {
      const w = LW / 2;
      const h = LH / 2;
      const pts = [
        [cx - w, LY],
        [cx - w / 2, LY - h],
        [cx + w / 2, LY - h],
        [cx + w, LY],
        [cx + w / 2, LY + h],
        [cx - w / 2, LY + h],
      ]
        .map((p) => p.join(","))
        .join(" ");
      return <polygon points={pts} />;
    }
    if (id === "aviator") {
      const d =
        `M ${x} ${y + 3} Q ${x} ${y} ${x + 4} ${y} ` +
        `L ${x + LW - 4} ${y} Q ${x + LW} ${y} ${x + LW} ${y + 3} ` +
        `L ${cx + 3} ${y + LH} Q ${cx} ${y + LH + 2} ${cx - 3} ${y + LH} Z`;
      return <path d={d} />;
    }
    const rx = id === "wayfarer" ? 4 : 3;
    return <rect x={x} y={y} width={LW} height={LH} rx={rx} />;
  };
  return (
    <svg
      viewBox="0 0 80 30"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden
    >
      {lens(22)}
      {lens(58)}
      <path d="M33 12 q7 -3 14 0" />
      <path d="M11 13 l-5 -2" />
      <path d="M69 13 l5 -2" />
    </svg>
  );
}

const EYEWEAR_IMAGE: Record<FrameShapeId, string> = {
  rectangle: "/images/eyewear/eyewear-rectangle.png",
  round: "/images/eyewear/eyewear-round.png",
  wayfarer: "/images/eyewear/eyewear-wayfarer.png",
  aviator: "/images/eyewear/eyewear-aviator.png",
  geometric: "/images/eyewear/eyewear-geometric.png",
};

export function EyewearGuide({
  eyewear,
  lang,
}: {
  eyewear: { recommend: FrameRec[]; avoid: string[] };
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Eyewear for your face")}
      </h3>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {eyewear.recommend.map((f) => (
          <div
            key={f.shape}
            className="overflow-hidden rounded-xl border hairline bg-paper"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-sand">
              <StaticFillImg
                src={EYEWEAR_IMAGE[f.shape]}
                alt={`${f.name} frames`}
                sizes="(max-width: 640px) 33vw, 15vw"
              />
            </div>
            <div className="p-3">
              <div className="text-center text-sm font-medium">{f.name}</div>
              <p className="mt-1 text-center text-xs leading-relaxed text-stone-soft">
                {f.why}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-soft">
        {tt("Avoid:")} {eyewear.avoid.join(" · ")}
      </p>
    </div>
  );
}

/* ----------------------------- fit blueprint ------------------------------ */

export function FitBlueprint({
  specs,
  lang,
  title = "Fit blueprint — what to tell your tailor",
}: {
  specs: FitSpec[];
  lang?: ReportLanguage;
  title?: string;
}) {
  const tt = makeT(lang);
  if (!specs.length) return null;
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border hairline">
      <div className="bg-cream/60 px-5 py-3 text-xs uppercase tracking-wider text-stone-soft">
        {tt(title)}
      </div>
      <div className="divide-y divide-line">
        {specs.map((s) => (
          <div key={s.part} className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
            <div className="font-display text-base text-ink">{s.part}</div>
            <div>
              <div className="text-sm text-ink">{s.spec}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-soft">
                {s.why}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- capsule --------------------------------- */

function PriorityColumn({
  label,
  tone,
  items,
  currency,
}: {
  label: string;
  tone: string;
  items: ShoppingItem[];
  currency: Currency;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone}`} />
        <h4 className="text-sm uppercase tracking-wider text-stone-soft">
          {label}
        </h4>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((i) => {
          const price = (
            <span className="shrink-0 font-display text-sm text-stone">
              {formatOfferPrice({
                priceEur: i.priceEur,
                displayCurrency: currency,
                offerCurrency: i.currency,
                priceNative: i.priceNative,
              })}
            </span>
          );
          return (
            <li
              key={i.title}
              className="flex items-start justify-between gap-3 rounded-xl border hairline bg-paper px-4 py-3"
            >
              {i.url ? (
                <a
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="group flex min-w-0 items-center gap-3 transition-colors hover:text-ink"
                >
                  <ShoppingItemThumb item={i} />
                  <span className="text-sm group-hover:underline">
                    {humanizeProductTitle(i.title)}
                  </span>
                </a>
              ) : (
                <span className="flex min-w-0 items-center gap-3">
                  <ShoppingItemThumb item={i} />
                  <span className="text-sm">{humanizeProductTitle(i.title)}</span>
                </span>
              )}
              {price}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Capsule({
  capsule,
  currency,
  lang,
}: {
  capsule: CapsulePlan;
  currency: Currency;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border hairline bg-cream/40 p-6">
          <div className="font-display text-4xl">{capsule.pieces}</div>
          <div className="mt-1 text-sm text-stone">{tt("core pieces")}</div>
        </div>
        <div className="rounded-2xl border hairline bg-cream/40 p-6">
          <div className="font-display text-4xl">~{capsule.outfits}</div>
          <div className="mt-1 text-sm text-stone">
            {tt("outfits they unlock with what you own")}
          </div>
        </div>
        <div className="rounded-2xl border hairline bg-cream/40 p-6">
          <div className="font-display text-4xl">3</div>
          <div className="mt-1 text-sm text-stone">{tt("phases — buy in order")}</div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <PriorityColumn
          label={tt("Buy now")}
          tone="bg-brass"
          items={capsule.now}
          currency={currency}
        />
        <PriorityColumn
          label={tt("Next")}
          tone="bg-stone"
          items={capsule.next}
          currency={currency}
        />
        <PriorityColumn
          label={tt("Later")}
          tone="bg-line"
          items={capsule.later}
          currency={currency}
        />
      </div>
    </div>
  );
}

/* -------------------------------- grooming -------------------------------- */

function GroomingPreviewCard({
  item,
  alt,
  fallbackSrc,
  label,
  regen,
  generating = false,
}: {
  item: FacialHairRec | EyewearRec | AccessoryRec | HeadwearRec;
  alt: string;
  fallbackSrc?: string;
  label?: string;
  regen?: {
    reportId: string;
    kind: "facial_hair" | "eyewear" | "accessories" | "headwear";
    index: number;
  };
  generating?: boolean;
}) {
  const src = item.image ?? fallbackSrc;
  const canRegen = Boolean(regen) && isGeneratedReportImage(item.image);
  const showGenerating = generating && !src;
  return (
    <article className="overflow-hidden rounded-2xl border hairline bg-paper">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        {label ? (
          <span className="absolute right-3 top-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-paper/90 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-stone">
            {label}
          </span>
        ) : null}
        {src ? (
          <ReportZoomImage
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-top"
          />
        ) : showGenerating ? (
          <ReportImageGenerating
            label={item.name}
            detail="Rendering on your photo"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-stone-soft">
            <span className="font-display text-lg text-stone">{item.name}</span>
            <span>Generating preview…</span>
          </div>
        )}
        {canRegen && regen ? (
          <RegenPhotoButton
            reportId={regen.reportId}
            kind={regen.kind}
            index={regen.index}
          />
        ) : null}
      </div>
      <div className="p-4">
        <div className="font-display text-lg">{item.name}</div>
        <p className="mt-1 text-sm leading-relaxed text-stone">{item.why}</p>
      </div>
    </article>
  );
}

export function FacialHairGuide({
  items,
  reportId,
  owner = false,
  generating = false,
  lang,
}: {
  items: FacialHairRec[];
  reportId?: string;
  owner?: boolean;
  generating?: boolean;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  if (!items.length) return null;
  const canRegen = owner && Boolean(reportId);
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Recommended facial hair")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        {tt(
          "Four personalized beard and mustache directions on your photo — take these to your barber.",
        )}
      </p>
      {canRegen ? <RegenPhotoHint className="mt-3" lang={lang} /> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {items.map((item, i) => (
          <GroomingPreviewCard
            key={item.name}
            item={item}
            alt={`${item.name} — facial hair recommendation`}
            regen={
              canRegen
                ? { reportId: reportId!, kind: "facial_hair", index: i }
                : undefined
            }
            generating={generating}
          />
        ))}
      </div>
    </div>
  );
}

export function PremiumEyewearGuide({
  items,
  reportId,
  owner = false,
  generating = false,
  lang,
}: {
  items: EyewearRec[];
  reportId?: string;
  owner?: boolean;
  generating?: boolean;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  if (!items.length) return null;
  const canRegen = owner && Boolean(reportId);
  const withIdx = items.map((item, idx) => ({ item, idx }));
  const optical = withIdx.filter((x) => x.item.kind !== "sun");
  const sun = withIdx.filter((x) => x.item.kind === "sun");
  const unlabeled = withIdx.filter((x) => !x.item.kind);

  const renderGroup = (
    group: { item: EyewearRec; idx: number }[],
    heading: string,
    defaultLabel?: string,
  ) =>
    group.length ? (
      <div>
        <h4 className="text-xs uppercase tracking-wider text-stone-soft">
          {heading}
        </h4>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {group.map(({ item, idx }) => (
            <GroomingPreviewCard
              key={`${item.kind ?? "frame"}-${item.name}`}
              item={item}
              alt={`${item.name} — eyewear recommendation`}
              label={
                item.kind === "sun"
                  ? tt("Sunglasses")
                  : item.kind === "optical"
                    ? tt("Optical")
                    : defaultLabel
              }
              fallbackSrc={
                item.shape && item.shape in EYEWEAR_IMAGE
                  ? EYEWEAR_IMAGE[item.shape as FrameShapeId]
                  : undefined
              }
              regen={
                canRegen
                  ? { reportId: reportId!, kind: "eyewear", index: idx }
                  : undefined
              }
              generating={generating}
            />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Recommended glasses")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        {tt(
          "Two optical frames and two sunglasses suited to your face — previewed on your photo.",
        )}
      </p>
      {canRegen ? <RegenPhotoHint className="mt-3" lang={lang} /> : null}
      <div className="mt-5 space-y-8">
        {renderGroup(optical, tt("Optical frames"))}
        {renderGroup(sun, tt("Sunglasses"))}
        {unlabeled.length
          ? renderGroup(unlabeled, tt("Frames"), tt("Optical"))
          : null}
      </div>
    </div>
  );
}

export function AccessoriesGuide({
  items,
  reportId,
  owner = false,
  generating = false,
  lang,
}: {
  items: AccessoryRec[];
  reportId?: string;
  owner?: boolean;
  generating?: boolean;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  if (!items.length) return null;
  const canRegen = owner && Boolean(reportId);
  const label = (k?: string) =>
    k === "tie"
      ? tt("Tie")
      : k === "neckwear"
        ? tt("Neckwear")
        : k === "scarf"
          ? tt("Scarf")
          : undefined;
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Accessory styling")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        {tt(
          "Scarves, neckwear and ties chosen for your colouring and climate — previewed on your own photo.",
        )}
      </p>
      {canRegen ? <RegenPhotoHint className="mt-3" lang={lang} /> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <GroomingPreviewCard
            key={item.name}
            item={item}
            alt={`${item.name} — accessory recommendation`}
            label={label(item.kind)}
            regen={
              canRegen
                ? { reportId: reportId!, kind: "accessories", index: i }
                : undefined
            }
            generating={generating}
          />
        ))}
      </div>
    </div>
  );
}

export function HeadwearGuide({
  items,
  reportId,
  owner = false,
  generating = false,
  lang,
}: {
  items: HeadwearRec[];
  reportId?: string;
  owner?: boolean;
  generating?: boolean;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  if (!items.length) return null;
  const canRegen = owner && Boolean(reportId);
  const label = (k?: string) =>
    k === "hat"
      ? tt("Hat")
      : k === "cap"
        ? tt("Cap")
        : k === "beanie"
          ? tt("Beanie")
          : k === "bandana"
            ? tt("Bandana")
            : undefined;
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Headwear")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        {tt(
          "Hats, caps and bandanas chosen for your face shape and colouring — previewed on your own photo.",
        )}
      </p>
      {canRegen ? <RegenPhotoHint className="mt-3" lang={lang} /> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <GroomingPreviewCard
            key={item.name}
            item={item}
            alt={`${item.name} — headwear recommendation`}
            label={label(item.kind)}
            regen={
              canRegen
                ? { reportId: reportId!, kind: "headwear", index: i }
                : undefined
            }
            generating={generating}
          />
        ))}
      </div>
    </div>
  );
}

export function GroomingGuide({
  items,
  lang,
}: {
  items: GroomingItem[];
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Beard, skin & grooming")}
      </h3>
      <div className="mt-4 space-y-4">
        {items.map((g) => (
          <div key={g.title} className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
            <div>
              <div className="font-display text-base leading-tight">
                {g.title}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-stone">
                {g.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- fabrics --------------------------------- */

export function FabricsGuide({
  fabrics,
  lang,
}: {
  fabrics: { name: string; why: string }[];
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        {tt("Fabrics & texture")}
      </h3>
      <div className="mt-4 space-y-3">
        {fabrics.map((f) => (
          <div key={f.name}>
            <div className="text-sm font-medium">{f.name}</div>
            <p className="text-xs leading-relaxed text-stone-soft">{f.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- finishing touches --------------------------- */

export function FinishingTouches({
  styling,
  care,
  fragrance,
  lang,
}: {
  styling: string[];
  care: string[];
  fragrance: string;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          {tt("How to wear it")}
        </h3>
        <ul className="mt-4 space-y-3">
          {styling.map((s) => (
            <li key={s} className="flex items-start gap-3 text-stone">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          {tt("Care & longevity")}
        </h3>
        <ul className="mt-4 space-y-3">
          {care.map((s) => (
            <li key={s} className="flex items-start gap-3 text-stone">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl border hairline bg-cream/40 p-4">
          <div className="text-xs uppercase tracking-wider text-stone-soft">
            {tt("Signature scent")}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-stone">{fragrance}</p>
        </div>
      </div>
    </div>
  );
}
