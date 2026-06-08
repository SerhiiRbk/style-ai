import { ReportZoomImage } from "@/components/ReportZoomImage";
import { RegenPhotoButton } from "@/components/RegenPhotoButton";
import { formatMoney, formatOfferPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { LookTryOn } from "./LookTryOn";
import type {
  ShoppingItem,
  EyewearRec,
  FacialHairRec,
  AccessoryRec,
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
} from "@/lib/style-extras";

/* -------------------------------- moodboard ------------------------------- */

function MoodboardPhoto({
  src,
  alt,
  zoomable,
}: {
  src: string;
  alt: string;
  zoomable?: boolean;
}) {
  if (!src) {
    return (
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
        wrapperClassName="relative block h-full w-full"
        className="h-full w-full object-cover object-top"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-full w-full object-cover object-top" />
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
}: {
  portrait: string;
  look?: string;
  product?: string;
  palette: string[];
  archetypeName: string;
  archetypeLine?: string;
  zoomable?: boolean;
}) {
  // Only show the second photo when it's a genuinely different image.
  const showSecondLook = Boolean(look) && look !== portrait;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <figure className="relative col-span-2 aspect-[5/4] overflow-hidden rounded-2xl bg-sand sm:col-span-1 sm:row-span-2 sm:aspect-auto">
        <MoodboardPhoto
          src={portrait}
          alt="Your look on your photo"
          zoomable={zoomable}
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
          Your look
        </span>
      </figure>

      {showSecondLook && (
        <figure className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
          <MoodboardPhoto src={look!} alt="A second look" zoomable={zoomable} />
          <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
            Another look
          </span>
        </figure>
      )}

      <div className="relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl">
        {palette.slice(0, 5).map((hex) => (
          <span key={hex} className="flex-1" style={{ background: hex }} />
        ))}
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink">
          Your palette
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
            Hero piece
          </span>
        </figure>
      )}

      <div className="flex aspect-[4/5] flex-col justify-end rounded-2xl bg-ink p-5 text-paper">
        <span className="text-[10px] uppercase tracking-[0.2em] text-brass-soft">
          Your direction
        </span>
        <span className="mt-1 font-display text-xl leading-tight">
          {archetypeName}
        </span>
        {archetypeLine && (
          <span className="mt-2 text-xs leading-relaxed text-paper/60">
            {archetypeLine}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ wheel legend ------------------------------ */

export function WheelLegend() {
  return (
    <div className="mt-5 space-y-1.5 text-xs text-stone">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-brass ring-2 ring-paper" />
        Your palette on the hue wheel
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border border-dashed border-ink" />
        Complementary accent (opposite hue)
      </div>
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-4 rounded-full bg-ink/70" />
        Analogous range (neighbouring tones)
      </div>
    </div>
  );
}

/* -------------------------------- archetype ------------------------------- */

export function ArchetypeBadge({ archetype }: { archetype: ArchetypeT }) {
  return (
    <div className="inline-flex flex-col">
      <span className="text-[11px] uppercase tracking-[0.2em] text-brass-soft">
        Your style archetype
      </span>
      <span className="mt-1 font-display text-2xl text-paper">
        {archetype.name}
      </span>
      <span className="mt-1 text-sm text-paper/60">{archetype.line}</span>
    </div>
  );
}

/* -------------------------------- colour DNA ------------------------------ */

export function ColorDNAGuide({ dna }: { dna: ColorDNAT }) {
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
          Your colour DNA
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
              {r.label}
            </dt>
            <dd className="text-sm text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 rounded-xl bg-cream/50 px-4 py-3 text-sm leading-relaxed text-stone">
        <span className="font-medium text-ink">Contrast: </span>
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
    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-sand">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={alt ?? item.title}
          className="h-full w-full object-cover"
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
}: {
  items: ShoppingItem[];
  currency: Currency;
}) {
  if (!items.length) return null;
  const showAlternativesNote =
    items.some((it) => it.similarPick) || items.length < 3;
  return (
    <div className="mt-4 border-t hairline pt-4">
      <div className="text-[11px] uppercase tracking-wider text-stone-soft">
        Shop a look like this
      </div>
      {showAlternativesNote ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-soft">
          Stylistic alternatives from our catalogue — close in category and colour,
          not necessarily the exact pieces in the photo.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => (
          <a
            key={it.productId ?? it.title}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="group flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 transition-colors hover:border-ink/30"
          >
            <ShoppingItemThumb item={it} />
            <span className="text-xs text-ink">{it.title}</span>
            {it.similarPick ? (
              <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone">
                Similar
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
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ capsule matrix ---------------------------- */

export function CapsuleMatrix({
  combos,
  reportId,
}: {
  combos: OutfitCombo[];
  reportId?: string;
}) {
  if (!combos.length) return null;
  const visual = combos.some((c) => c.image);
  return (
    <div className="mt-10">
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Your week, styled — mix &amp; match
      </h3>
      <p className="mt-2 max-w-xl text-sm text-stone">
        The same handful of pieces, recombined into a full week of outfits — so
        nothing in your wardrobe sits unused.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combos.map((c, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border hairline bg-paper"
          >
            {visual && (
              <div className="relative aspect-[9/16] bg-sand">
                {c.image ? (
                  <ReportZoomImage
                    src={c.image}
                    alt={`${c.context} outfit`}
                    wrapperClassName="relative block h-full w-full"
                    className="h-full w-full object-cover object-top"
                  />
                ) : null}
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
                {c.pieces.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <span className="h-1 w-1 rounded-full bg-stone-soft" />
                    {p}
                  </li>
                ))}
              </ul>
              {reportId && (
                <div className="mt-3 border-t hairline pt-3">
                  <LookTryOn
                    reportId={reportId}
                    title={c.context}
                    description={c.pieces.join(", ")}
                    lookIndex={i}
                    kind="capsule"
                    label="Try on me"
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
}: {
  tiers: PriceTier[];
  currency: Currency;
}) {
  if (!tiers.length) return null;
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border hairline">
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-cream/60 px-5 py-3 text-[11px] uppercase tracking-wider text-stone-soft">
        <span>Category</span>
        <span>Good</span>
        <span>Better</span>
        <span>Best</span>
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
}: {
  metals: { recommend: Metal[]; avoidNote: string };
}) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Metals & hardware
      </h3>
      <div className="mt-4 space-y-3">
        {metals.recommend.map((m) => (
          <div key={m.name} className="flex items-start gap-3">
            <span
              className="mt-0.5 h-9 w-9 shrink-0 rounded-full ring-1 ring-ink/10"
              style={{ background: m.hex }}
            />
            <div>
              <div className="font-display text-base leading-tight">
                {m.name}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-stone">
                {m.why}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-stone-soft">
        {metals.avoidNote}
      </p>
    </div>
  );
}

/* ------------------------------- pairings --------------------------------- */

export function Pairings({ pairings }: { pairings: PairingsT }) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        How to combine them
      </h3>
      {pairings.hero && (
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Your hero colour near the face is{" "}
          <span className="font-display text-ink">{pairings.hero.name}</span> —
          build neutral bases and let it lead.
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
}: {
  eyewear: { recommend: FrameRec[]; avoid: string[] };
}) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Eyewear for your face
      </h3>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {eyewear.recommend.map((f) => (
          <div
            key={f.shape}
            className="overflow-hidden rounded-xl border hairline bg-paper"
          >
            <div className="aspect-[4/3] overflow-hidden bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={EYEWEAR_IMAGE[f.shape]}
                alt={`${f.name} frames`}
                className="h-full w-full object-cover"
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
        Avoid: {eyewear.avoid.join(" · ")}
      </p>
    </div>
  );
}

/* ----------------------------- fit blueprint ------------------------------ */

export function FitBlueprint({ specs }: { specs: FitSpec[] }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border hairline">
      <div className="bg-cream/60 px-5 py-3 text-xs uppercase tracking-wider text-stone-soft">
        Fit blueprint — what to tell your tailor
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
        {items.map((i) => (
          <li
            key={i.title}
            className="flex items-center justify-between gap-3 rounded-xl border hairline bg-paper px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-3">
              <ShoppingItemThumb item={i} />
              <span className="truncate text-sm">{i.title}</span>
            </span>
            <span className="shrink-0 font-display text-sm text-stone">
              {formatOfferPrice({
                priceEur: i.priceEur,
                displayCurrency: currency,
                offerCurrency: i.currency,
                priceNative: i.priceNative,
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Capsule({
  capsule,
  currency,
}: {
  capsule: CapsulePlan;
  currency: Currency;
}) {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border hairline bg-cream/40 p-6">
          <div className="font-display text-4xl">{capsule.pieces}</div>
          <div className="mt-1 text-sm text-stone">core pieces</div>
        </div>
        <div className="rounded-2xl border hairline bg-cream/40 p-6">
          <div className="font-display text-4xl">~{capsule.outfits}</div>
          <div className="mt-1 text-sm text-stone">
            outfits they unlock with what you own
          </div>
        </div>
        <div className="rounded-2xl border hairline bg-cream/40 p-6">
          <div className="font-display text-4xl">3</div>
          <div className="mt-1 text-sm text-stone">phases — buy in order</div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <PriorityColumn
          label="Buy now"
          tone="bg-brass"
          items={capsule.now}
          currency={currency}
        />
        <PriorityColumn
          label="Next"
          tone="bg-stone"
          items={capsule.next}
          currency={currency}
        />
        <PriorityColumn
          label="Later"
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
}: {
  item: FacialHairRec | EyewearRec | AccessoryRec;
  alt: string;
  fallbackSrc?: string;
  label?: string;
  regen?: {
    reportId: string;
    kind: "facial_hair" | "eyewear" | "accessories";
    index: number;
  };
}) {
  const src = item.image ?? fallbackSrc;
  const canRegen = Boolean(regen) && /^https?:/.test(item.image ?? "");
  return (
    <article className="overflow-hidden rounded-2xl border hairline bg-paper">
      <div className="relative aspect-[4/5] bg-sand">
        {label ? (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-paper/90 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-stone">
            {label}
          </span>
        ) : null}
        {src ? (
          <ReportZoomImage
            src={src}
            alt={alt}
            wrapperClassName="relative block h-full w-full"
            className="h-full w-full object-cover"
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
}: {
  items: FacialHairRec[];
  reportId?: string;
  owner?: boolean;
}) {
  if (!items.length) return null;
  const canRegen = owner && Boolean(reportId);
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Recommended facial hair
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        Four personalized beard and mustache directions on your photo — take
        these to your barber.
      </p>
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
}: {
  items: EyewearRec[];
  reportId?: string;
  owner?: boolean;
}) {
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
                  ? "Sunglasses"
                  : item.kind === "optical"
                    ? "Optical"
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
            />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Recommended glasses
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        Two optical frames and two sunglasses suited to your face — previewed on
        your photo.
      </p>
      <div className="mt-5 space-y-8">
        {renderGroup(optical, "Optical frames")}
        {renderGroup(sun, "Sunglasses")}
        {unlabeled.length
          ? renderGroup(unlabeled, "Frames", "Optical")
          : null}
      </div>
    </div>
  );
}

export function AccessoriesGuide({
  items,
  reportId,
  owner = false,
}: {
  items: AccessoryRec[];
  reportId?: string;
  owner?: boolean;
}) {
  if (!items.length) return null;
  const canRegen = owner && Boolean(reportId);
  const label = (k?: string) =>
    k === "tie"
      ? "Tie"
      : k === "neckwear"
        ? "Neckwear"
        : k === "scarf"
          ? "Scarf"
          : undefined;
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Accessory styling
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        Scarves, neckwear and ties chosen for your colouring and climate —
        previewed on your own photo.
      </p>
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
          />
        ))}
      </div>
    </div>
  );
}

export function GroomingGuide({ items }: { items: GroomingItem[] }) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Beard, skin & grooming
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
}: {
  fabrics: { name: string; why: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-stone-soft">
        Fabrics & texture
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
}: {
  styling: string[];
  care: string[];
  fragrance: string;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          How to wear it
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
          Care & longevity
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
            Signature scent
          </div>
          <p className="mt-1 text-sm leading-relaxed text-stone">{fragrance}</p>
        </div>
      </div>
    </div>
  );
}
