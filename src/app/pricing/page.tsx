import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { getGeo } from "@/lib/geo";
import { TIER_PRICES } from "@/lib/currency";
import {
  REPORT_COST,
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  SIGNUP_BONUS,
} from "@/lib/credit-costs";
import {
  HAIR_AVOID_GEN_LIMIT,
  hairRecommendGenLimit,
  lookCountForTier,
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  type Tier,
} from "@/lib/report";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Pricing · ${BRAND.name}`,
  description:
    "Honest, credit-based pricing for your personal style report — pay only for the AI work you use. New accounts start with free credits.",
};

type TierCard = {
  name: string;
  tier: keyof typeof REPORT_COST;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const TIERS: TierCard[] = [
  {
    name: "Free preview",
    tier: "free",
    tagline: "See the quality, no commitment.",
    features: [
      "Colour & hair analysis with reasons",
      "1 photorealistic preview look",
      "2 hairstyle previews on your photo",
      `Virtual try-on on your photo (${CREDIT_COSTS.tryon} credit each)`,
      "No share link, capsule, or PDF",
    ],
    cta: "Try it free",
  },
  {
    name: "Basic report",
    tier: "basic",
    tagline: "The full written consultation.",
    features: [
      "Complete style profile & colour story",
      "Hair, silhouette & fit guidance",
      "3 photorealistic looks",
      "Shopping list with real product links",
      "PDF export",
    ],
    cta: "Get Basic",
  },
  {
    name: "Lookbook",
    tier: "lookbook",
    tagline: "Add the wardrobe system & try-on.",
    features: [
      "Everything in Basic",
      "4 photorealistic looks",
      "Capsule wardrobe + week-of-outfits matrix",
      `Virtual try-on on your photo (${CREDIT_COSTS.tryon} credit each)`,
      "Good · Better · Best buying plan",
      "4 hairstyle previews on your photo (front + side)",
    ],
    cta: "Get Lookbook",
    featured: true,
  },
  {
    name: "Premium",
    tier: "premium",
    tagline: "The deepest, most personal report.",
    features: [
      "Everything in Lookbook",
      "6 photorealistic looks",
      "4 facial-hair previews on your photo",
      "2 optical + 2 sunglasses previews",
      "Deeper grooming guidance",
    ],
    cta: "Get Premium",
  },
];

const COMPARISON_TIERS: { key: Tier; label: string }[] = [
  { key: "free", label: "Free" },
  { key: "basic", label: "Basic" },
  { key: "lookbook", label: "Lookbook" },
  { key: "premium", label: "Premium" },
];

type CompareCell = boolean | string;

const COMPARISON_ROWS: { feature: string; detail?: string; cells: Record<Tier, CompareCell> }[] = [
  {
    feature: "Credits to generate",
    cells: {
      free: `${REPORT_COST.free}`,
      basic: `${REPORT_COST.basic}`,
      lookbook: `${REPORT_COST.lookbook}`,
      premium: `${REPORT_COST.premium}`,
    },
  },
  {
    feature: "Photorealistic looks",
    cells: {
      free: String(lookCountForTier("free")),
      basic: String(lookCountForTier("basic")),
      lookbook: String(lookCountForTier("lookbook")),
      premium: String(lookCountForTier("premium")),
    },
  },
  {
    feature: "Look photos on your reference",
    detail: "Requires a portrait upload",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "Colour & hair written analysis",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "Full style profile & silhouette",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "Hair recommend — AI photos",
    cells: {
      free: String(hairRecommendGenLimit("free")),
      basic: String(hairRecommendGenLimit("basic")),
      lookbook: String(hairRecommendGenLimit("lookbook")),
      premium: String(hairRecommendGenLimit("premium")),
    },
  },
  {
    feature: "Hair recommend — front + side angle",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    feature: "Hair avoid — AI photos",
    cells: {
      free: String(HAIR_AVOID_GEN_LIMIT),
      basic: String(HAIR_AVOID_GEN_LIMIT),
      lookbook: String(HAIR_AVOID_GEN_LIMIT),
      premium: String(HAIR_AVOID_GEN_LIMIT),
    },
  },
  {
    feature: "Capsule wardrobe plan",
    detail: "Mix-and-match core pieces",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    feature: "Week-of-outfits matrix photos",
    detail: "Up to 6 AI outfit combinations",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    feature: "Good · Better · Best buying plan",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    feature: "Shopping list with product links",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "Shop the Look (per outfit)",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "PDF export",
    cells: { free: false, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "Virtual try-on",
    detail: `${CREDIT_COSTS.tryon} credit per render · any tier`,
    cells: {
      free: `${CREDIT_COSTS.tryon} cr`,
      basic: `${CREDIT_COSTS.tryon} cr`,
      lookbook: `${CREDIT_COSTS.tryon} cr`,
      premium: `${CREDIT_COSTS.tryon} cr`,
    },
  },
  {
    feature: "Render again (try-on re-roll)",
    detail: `${CREDIT_COSTS.regen} credit`,
    cells: {
      free: `${CREDIT_COSTS.regen} cr`,
      basic: `${CREDIT_COSTS.regen} cr`,
      lookbook: `${CREDIT_COSTS.regen} cr`,
      premium: `${CREDIT_COSTS.regen} cr`,
    },
  },
  {
    feature: "Share report link",
    detail: "Owner only · viewers cannot try-on",
    cells: { free: false, basic: true, lookbook: true, premium: true },
  },
  {
    feature: "Facial hair previews on your photo",
    cells: {
      free: false,
      basic: false,
      lookbook: false,
      premium: String(PREMIUM_FACIAL_HAIR_GEN_LIMIT),
    },
  },
  {
    feature: "Eyewear previews on your photo",
    detail: "2 optical + 2 sunglasses",
    cells: {
      free: false,
      basic: false,
      lookbook: false,
      premium: String(PREMIUM_EYEWEAR_GEN_LIMIT),
    },
  },
  {
    feature: "Static eyewear shape guide",
    detail: "Written picks · non-premium tiers",
    cells: { free: true, basic: true, lookbook: true, premium: false },
  },
  {
    feature: "Written grooming guide",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
];

export default async function PricingPage() {
  const { subCurrency } = await getGeo();
  const tierPrices = TIER_PRICES[subCurrency];

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-20 text-center">
            <p className="eyebrow">Pricing</p>
            <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
              Pay for the work, not a subscription.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-stone">
              {BRAND.name} runs on credits. Generating a report and each AI
              render costs credits — buy a pack, spend only what you use. New
              accounts start with{" "}
              <span className="text-ink">{SIGNUP_BONUS} free credits</span>.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/start">Start free</ButtonLink>
              <ButtonLink href="#packages" variant="outline">
                Buy credits
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* What a report costs */}
        <section className="container-luxe py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">Report tiers</p>
            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
              Choose how deep your report goes.
            </h2>
            <p className="mt-4 text-stone">
              The tier sets which features your report unlocks. Each report is a
              one-time credit spend — no recurring charge.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-4">
            {TIERS.map((t) => {
              const isFree = t.tier === "free";
              const cost = isFree ? SIGNUP_BONUS : REPORT_COST[t.tier];
              return (
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
                  <div className="text-sm tracking-wide opacity-80">
                    {t.name}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-4xl">{cost}</span>
                    <span
                      className={`text-xs ${
                        t.featured ? "text-paper/60" : "text-stone-soft"
                      }`}
                    >
                      {isFree ? "free credits" : "credits"}
                    </span>
                  </div>
                  <p
                    className={`mt-2 text-sm ${
                      t.featured ? "text-paper/70" : "text-stone"
                    }`}
                  >
                    {t.tagline}
                  </p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            t.featured ? "bg-brass-soft" : "bg-brass"
                          }`}
                        />
                        <span
                          className={t.featured ? "text-paper/85" : "text-stone"}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/start"
                    className={`mt-7 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm transition-all ${
                      t.featured
                        ? "bg-paper text-ink hover:bg-cream"
                        : "border border-ink/25 text-ink hover:bg-ink hover:text-paper"
                    }`}
                  >
                    {t.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          <TierComparisonTable />

          {/* Per-action costs */}
          <div className="mt-12 grid gap-4 rounded-2xl border hairline bg-cream/40 p-8 sm:grid-cols-3">
            <CostRow
              label="Generate a report"
              value={`${REPORT_COST.free}–${REPORT_COST.premium} credits`}
              note={`By tier (free preview is ${REPORT_COST.free})`}
            />
            <CostRow
              label="Virtual try-on"
              value={`${CREDIT_COSTS.tryon} credit`}
              note="Any look or product on your photo"
            />
            <CostRow
              label="Render again"
              value={`${CREDIT_COSTS.regen} credit`}
              note="Re-roll a try-on you didn't love"
            />
          </div>
        </section>

        {/* Credit packages */}
        <section id="packages" className="border-y hairline bg-ink text-paper">
          <div className="container-luxe py-20">
            <div className="max-w-2xl">
              <p className="eyebrow !text-brass-soft">Credit packages</p>
              <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
                Top up once. Spend whenever.
              </h2>
              <p className="mt-4 text-paper/70">
                Credits never expire. Bigger packs include bonus credits.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {CREDIT_PACKAGES.map((pkg, i) => {
                const total = pkg.credits + pkg.bonus;
                const featured = i === 2;
                return (
                  <div
                    key={pkg.id}
                    className={`relative flex flex-col rounded-2xl border p-7 ${
                      featured
                        ? "border-brass bg-ink-soft/60"
                        : "border-paper/15 bg-ink-soft/40"
                    }`}
                  >
                    {featured && (
                      <span className="absolute -top-3 left-7 rounded-full bg-brass px-3 py-1 text-[11px] uppercase tracking-wider text-paper">
                        Best value
                      </span>
                    )}
                    <div className="text-sm tracking-wide text-paper/70">
                      {pkg.name}
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-4xl">
                        {pkg.price[subCurrency]}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-brass-soft">
                      {total} credits
                      {pkg.bonus > 0 && (
                        <span className="text-paper/50">
                          {" "}
                          ({pkg.credits} + {pkg.bonus} bonus)
                        </span>
                      )}
                    </div>
                    <p className="mt-3 flex-1 text-sm text-paper/60">
                      {pkg.blurb}
                    </p>
                    <button
                      type="button"
                      disabled
                      title="Checkout is coming soon"
                      className="mt-7 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-paper/25 px-5 py-3 text-sm text-paper/60"
                    >
                      Checkout coming soon
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-sm text-paper/50">
              Card checkout is rolling out shortly. In the meantime, every new
              account starts with {SIGNUP_BONUS} free credits — enough for a free
              preview ({REPORT_COST.free} credits) and one try-on (
              {CREDIT_COSTS.tryon} credit).
            </p>
          </div>
        </section>

        {/* Coming soon */}
        <section className="container-luxe py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">On the roadmap</p>
            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
              Coming soon.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <ComingSoon
              name="Membership"
              price={`${tierPrices.membership}/mo`}
              body="Monthly credit allowance, refreshed looks, and unlimited try-on for members. Not available yet — pay-as-you-go with credits for now."
            />
            <ComingSoon
              name="Business · white-label"
              price={`from ${tierPrices.business}/mo`}
              body="Generate reports under your own salon or studio brand, with your catalogue as the product source. In development — get in touch to pilot."
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function TierComparisonTable() {
  return (
    <div className="mt-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Compare tiers</p>
        <h3 className="mt-4 font-display text-2xl leading-tight sm:text-3xl">
          What each report includes
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Matched to what the app generates and unlocks today — not marketing
          fluff.
        </p>
      </div>

      <div className="mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b hairline">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[11rem] bg-paper py-4 pr-4 text-left text-xs font-normal uppercase tracking-wider text-stone-soft"
              >
                Feature
              </th>
              {COMPARISON_TIERS.map((t) => (
                <th
                  key={t.key}
                  scope="col"
                  className="min-w-[5.5rem] px-3 py-4 text-center font-display text-base text-ink"
                >
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.feature} className="border-b hairline last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-paper py-3.5 pr-4 text-left align-top font-normal"
                >
                  <span className="text-ink">{row.feature}</span>
                  {row.detail ? (
                    <span className="mt-0.5 block text-xs leading-snug text-stone-soft">
                      {row.detail}
                    </span>
                  ) : null}
                </th>
                {COMPARISON_TIERS.map((t) => (
                  <td
                    key={t.key}
                    className="px-3 py-3.5 text-center align-top text-ink"
                  >
                    <CompareValue value={row.cells[t.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareValue({ value }: { value: CompareCell }) {
  if (value === true) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brass/15 font-medium text-brass">
        ✓
      </span>
    );
  }
  if (value === false) {
    return <span className="text-stone-soft">—</span>;
  }
  return <span className="font-medium tabular-nums">{value}</span>;
}

function CostRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-stone-soft">
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-stone">{note}</div>
    </div>
  );
}

function ComingSoon({
  name,
  price,
  body,
}: {
  name: string;
  price: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-cream/30 p-8">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">{name}</h3>
        <span className="rounded-full border border-ink/15 bg-paper px-3 py-1 text-[11px] uppercase tracking-wider text-stone">
          Coming soon
        </span>
      </div>
      <div className="mt-3 font-display text-2xl text-ink/60">{price}</div>
      <p className="mt-3 text-sm leading-relaxed text-stone">{body}</p>
    </div>
  );
}
