import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { BuyCreditsButton } from "@/components/BuyCreditsButton";
import { CheckoutBanner } from "@/components/CheckoutBanner";
import { PromoRedeemForm } from "@/components/PromoRedeemForm";
import { CreditsProvider } from "@/components/CreditsContext";
import { hasPayments, hasSupabase } from "@/lib/env";
import { paymentProviderLabel } from "@/lib/payments";
import { getGeo } from "@/lib/geo";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";
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
  PREMIUM_ACCESSORY_GEN_LIMIT,
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  type Tier,
} from "@/lib/report";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Pricing — credits, no subscription · ${BRAND.name}`,
  description:
    "Honest, credit-based pricing for your personal style report — pay only for the AI work you use. New accounts start with 6 free credits, and credits never expire.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `${BRAND.name} pricing — pay for the work, not a subscription`,
    description:
      "Credit-based pricing for personal style reports. New accounts start with 6 free credits.",
  },
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
    name: "Starter Report",
    tier: "free",
    tagline: "See the quality, no commitment.",
    features: [
      "Colour & hair analysis with reasons",
      "1 photorealistic preview look",
      "2 hairstyle previews on your photo",
      `Virtual try-on on your photo (${CREDIT_COSTS.tryon} credit each)`,
      "Optional facial-hair / eyewear / accessory add-ons (credits)",
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
      `Add extra looks on your photo (${CREDIT_COSTS.look_extra} credits each)`,
      "Optional facial-hair / eyewear / accessory add-ons (credits)",
    ],
    cta: "Get Basic",
  },
  {
    name: "Lookbook",
    tier: "lookbook",
    tagline: "Add the wardrobe system & try-on.",
    features: [
      "Everything in Basic",
      `${lookCountForTier("lookbook")} photorealistic looks`,
      "Capsule wardrobe + week-of-outfits matrix",
      `Virtual try-on on your photo (${CREDIT_COSTS.tryon} credit each)`,
      "Good · Better · Best buying plan",
      "4 hairstyle previews on your photo (front + side)",
      `Add extra looks on your photo (${CREDIT_COSTS.look_extra} credits each)`,
      "Optional facial-hair / eyewear / accessory add-ons (credits)",
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
      `${lookCountForTier("premium")} photorealistic looks`,
      "4 facial-hair previews on your photo",
      "2 optical + 2 sunglasses previews",
      "2 accessory previews (scarves, neckwear, ties)",
      "One-time extra previews on demand (credits)",
      `Add extra looks on your photo (${CREDIT_COSTS.look_extra} credits each)`,
      "Deeper grooming guidance",
    ],
    cta: "Get Premium",
  },
];

const COMPARISON_TIERS: { key: Tier; label: string }[] = [
  { key: "free", label: "Starter" },
  { key: "basic", label: "Basic" },
  { key: "lookbook", label: "Lookbook" },
  { key: "premium", label: "Premium" },
];

type CompareCell = boolean | string;

type CompareRow =
  | { kind: "section"; title: string; note?: string }
  | {
      kind: "feature";
      feature: string;
      detail?: string;
      cells: Record<Tier, CompareCell>;
    }
  | { kind: "addon"; feature: string; detail?: string; value: string };

const PAYG = {
  tryon: `${CREDIT_COSTS.tryon} cr`,
  regen: `${CREDIT_COSTS.regen} cr`,
  lookExtra: `${CREDIT_COSTS.look_extra} cr`,
  facialAddon: `${CREDIT_COSTS.facialhair_addon} cr`,
  eyewearAddon: `${CREDIT_COSTS.eyewear_addon} cr`,
  accessoryAddon: `${CREDIT_COSTS.accessory_addon} cr`,
} as const;

const COMPARISON_ROWS: CompareRow[] = [
  {
    kind: "section",
    title: "Report size",
    note: "One-time credit spend per report",
  },
  {
    kind: "feature",
    feature: "Credits to generate",
    cells: {
      free: `${REPORT_COST.free}`,
      basic: `${REPORT_COST.basic}`,
      lookbook: `${REPORT_COST.lookbook}`,
      premium: `${REPORT_COST.premium}`,
    },
  },
  {
    kind: "feature",
    feature: "Photorealistic looks",
    cells: {
      free: String(lookCountForTier("free")),
      basic: String(lookCountForTier("basic")),
      lookbook: String(lookCountForTier("lookbook")),
      premium: String(lookCountForTier("premium")),
    },
  },
  {
    kind: "section",
    title: "Written analysis",
  },
  {
    kind: "feature",
    feature: "Colour & hair analysis",
    detail: "Palette, reasons, do's & don'ts",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Full style profile & silhouette",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Written grooming guide",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "section",
    title: "AI photos on your reference",
    note: "Requires a portrait upload",
  },
  {
    kind: "feature",
    feature: "Look photos on you",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Hairstyle previews (recommend)",
    cells: {
      free: String(hairRecommendGenLimit("free")),
      basic: String(hairRecommendGenLimit("basic")),
      lookbook: String(hairRecommendGenLimit("lookbook")),
      premium: String(hairRecommendGenLimit("premium")),
    },
  },
  {
    kind: "feature",
    feature: "Hairstyle previews — front + side",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Hairstyles to avoid",
    cells: {
      free: String(HAIR_AVOID_GEN_LIMIT),
      basic: String(HAIR_AVOID_GEN_LIMIT),
      lookbook: String(HAIR_AVOID_GEN_LIMIT),
      premium: String(HAIR_AVOID_GEN_LIMIT),
    },
  },
  {
    kind: "section",
    title: "Wardrobe & shopping",
  },
  {
    kind: "feature",
    feature: "Shopping list with product links",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Shop the Look (per outfit)",
    cells: { free: true, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Capsule wardrobe plan",
    detail: "Mix-and-match core pieces",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Week-of-outfits matrix",
    detail: "Up to 6 AI outfit combinations",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Good · Better · Best buying plan",
    cells: { free: false, basic: false, lookbook: true, premium: true },
  },
  {
    kind: "section",
    title: "Deliverables",
  },
  {
    kind: "feature",
    feature: "PDF export",
    cells: { free: false, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "feature",
    feature: "Share report link",
    detail: "Viewers can browse — not try-on",
    cells: { free: false, basic: true, lookbook: true, premium: true },
  },
  {
    kind: "section",
    title: "Grooming previews on your photo",
    note: "Premium includes sets below; other tiers can unlock with credits",
  },
  {
    kind: "feature",
    feature: "Facial hair previews",
    cells: {
      free: PAYG.facialAddon,
      basic: PAYG.facialAddon,
      lookbook: PAYG.facialAddon,
      premium: `${PREMIUM_FACIAL_HAIR_GEN_LIMIT} incl.`,
    },
  },
  {
    kind: "feature",
    feature: "Eyewear previews",
    detail: "2 optical + 2 sunglasses",
    cells: {
      free: PAYG.eyewearAddon,
      basic: PAYG.eyewearAddon,
      lookbook: PAYG.eyewearAddon,
      premium: `${PREMIUM_EYEWEAR_GEN_LIMIT} incl.`,
    },
  },
  {
    kind: "feature",
    feature: "Accessory previews",
    detail: "Scarves, neckwear & ties",
    cells: {
      free: PAYG.accessoryAddon,
      basic: PAYG.accessoryAddon,
      lookbook: PAYG.accessoryAddon,
      premium: `${PREMIUM_ACCESSORY_GEN_LIMIT} incl.`,
    },
  },
  {
    kind: "feature",
    feature: "Extra grooming batch (Premium)",
    detail: `+2 facial hair (${CREDIT_COSTS.facialhair_extra} cr) · +4 eyewear (${CREDIT_COSTS.eyewear_extra} cr)`,
    cells: { free: false, basic: false, lookbook: false, premium: true },
  },
  {
    kind: "feature",
    feature: "Static eyewear shape guide",
    detail: "Written frame picks when AI previews are not included",
    cells: { free: true, basic: true, lookbook: true, premium: false },
  },
  {
    kind: "section",
    title: "Pay-as-you-go add-ons",
    note: "Same credit price on every tier · not included in report generation",
  },
  {
    kind: "addon",
    feature: "Virtual try-on",
    detail: "Up to 4 catalogue pieces at once",
    value: `${PAYG.tryon} per render`,
  },
  {
    kind: "addon",
    feature: "Render again",
    detail: "Re-roll a try-on or grooming photo",
    value: `${PAYG.regen} per render`,
  },
  {
    kind: "addon",
    feature: "Extra look on your photo",
    detail: "One more occasion outfit",
    value: `${PAYG.lookExtra} each`,
  },
];

export default async function PricingPage() {
  const { subCurrency } = await getGeo();
  const tierPrices = TIER_PRICES[subCurrency];

  let signedIn = false;
  let creditBalance: number | null = null;
  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    signedIn = Boolean(user);
    if (signedIn) creditBalance = await getCreditBalance();
  }

  return (
    <>
      <Navbar />
      <CheckoutBanner />
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
              {hasSupabase ? (
                <ButtonLink href="#promo" variant="outline">
                  Promo code
                </ButtonLink>
              ) : null}
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
              const cost = REPORT_COST[t.tier];
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
                      credits
                    </span>
                  </div>
                  {isFree && (
                    <p className="mt-1 text-xs text-brass">
                      Covered by your {SIGNUP_BONUS} signup credits — leaves{" "}
                      {SIGNUP_BONUS - REPORT_COST.free} for a try-on
                    </p>
                  )}
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
          <div className="mt-12 grid gap-4 rounded-2xl border hairline bg-cream/40 p-8 sm:grid-cols-2 lg:grid-cols-4">
            <CostRow
              label="Generate a report"
              value={`${REPORT_COST.free}–${REPORT_COST.premium} credits`}
              note={`By tier (Starter Report is ${REPORT_COST.free})`}
            />
            <CostRow
              label="Extra look"
              value={`${CREDIT_COSTS.look_extra} credits`}
              note="One more occasion outfit on your photo"
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
          <CreditsProvider initialBalance={creditBalance}>
            <div className="container-luxe py-20">
              <div className="grid gap-10 lg:grid-cols-[1fr_min(100%,22rem)] lg:items-start lg:gap-12">
                <div className="max-w-2xl">
                  <p className="eyebrow !text-brass-soft">Credit packages</p>
                  <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
                    Top up once. Spend whenever.
                  </h2>
                  <p className="mt-4 text-paper/70">
                    Credits never expire. Bigger packs include bonus credits.
                  </p>
                </div>

                {hasSupabase ? (
                  <div
                    id="promo"
                    className="scroll-mt-24 rounded-2xl bg-paper p-6 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)]"
                  >
                    <p className="text-xs uppercase tracking-wider text-stone-soft">
                      Have a promo code?
                    </p>
                    <p className="mt-1 text-sm text-stone">
                      {signedIn
                        ? "Enter a code from an invite or campaign — credits apply once per account."
                        : "Sign in to redeem a code from an invite or campaign."}
                    </p>
                    <div className="mt-4">
                      {signedIn ? (
                        <PromoRedeemForm />
                      ) : (
                        <ButtonLink
                          href={`/login?next=${encodeURIComponent("/pricing#promo")}`}
                          className="w-full"
                        >
                          Sign in to apply code
                        </ButtonLink>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {CREDIT_PACKAGES.map((pkg, i) => {
                const total = pkg.credits + pkg.bonus;
                const featured = i === CREDIT_PACKAGES.length - 1;
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
                    <BuyCreditsButton
                      packageId={pkg.id}
                      featured={featured}
                      enabled={hasPayments}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-sm text-paper/50">
              {hasPayments
                ? `Secure card payment via ${paymentProviderLabel()}. Credits never expire. Every new account also starts with ${SIGNUP_BONUS} free credits — enough for your Starter Report (${REPORT_COST.free} credits) and one try-on (${CREDIT_COSTS.tryon} credit).`
                : `Card checkout is rolling out shortly. In the meantime, every new account starts with ${SIGNUP_BONUS} free credits — enough for your Starter Report (${REPORT_COST.free} credits) and one try-on (${CREDIT_COSTS.tryon} credit).`}
            </p>
            </div>
          </CreditsProvider>
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
  const featuredTier: Tier = "lookbook";

  return (
    <div className="mt-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Compare tiers</p>
        <h3 className="mt-4 font-display text-2xl leading-tight sm:text-3xl">
          What each report includes
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Grouped by what you get in the report vs optional credit add-ons.
          Matched to what the app generates today.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border hairline bg-paper shadow-[0_24px_48px_-40px_rgba(21,18,13,0.35)]">
        <div className="-mx-px overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b hairline bg-cream/30">
                <th
                  scope="col"
                  className="sticky left-0 z-20 min-w-[12rem] bg-cream/30 py-4 pl-5 pr-4 text-left text-xs font-normal uppercase tracking-wider text-stone-soft"
                >
                  Feature
                </th>
                {COMPARISON_TIERS.map((t) => {
                  const featured = t.key === featuredTier;
                  return (
                    <th
                      key={t.key}
                      scope="col"
                      className={`min-w-[5.75rem] px-3 py-4 text-center ${
                        featured ? "bg-brass/10" : ""
                      }`}
                    >
                      <span className="font-display text-base text-ink">
                        {t.label}
                      </span>
                      {featured ? (
                        <span className="mt-1 block text-[10px] font-normal uppercase tracking-wider text-brass">
                          Popular
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, index) => {
                if (row.kind === "section") {
                  return (
                    <tr
                      key={`section-${row.title}`}
                      className="border-b hairline bg-cream/45"
                    >
                      <th
                        scope="colgroup"
                        colSpan={COMPARISON_TIERS.length + 1}
                        className="sticky left-0 py-3 pl-5 pr-4 text-left"
                      >
                        <span className="text-xs font-medium uppercase tracking-wider text-ink">
                          {row.title}
                        </span>
                        {row.note ? (
                          <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-stone-soft">
                            {row.note}
                          </span>
                        ) : null}
                      </th>
                    </tr>
                  );
                }

                if (row.kind === "addon") {
                  return (
                    <tr
                      key={`addon-${row.feature}`}
                      className="border-b hairline last:border-0"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-paper py-3.5 pl-5 pr-4 text-left align-top font-normal"
                      >
                        <span className="text-ink">{row.feature}</span>
                        {row.detail ? (
                          <span className="mt-0.5 block text-xs leading-snug text-stone-soft">
                            {row.detail}
                          </span>
                        ) : null}
                      </th>
                      <td
                        colSpan={COMPARISON_TIERS.length}
                        className="px-4 py-3.5 text-center align-top"
                      >
                        <span className="inline-flex items-center rounded-full bg-cream/60 px-3 py-1 text-xs font-medium tabular-nums text-ink">
                          All tiers · {row.value}
                        </span>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.feature}
                    className={`border-b hairline last:border-0 ${
                      index % 2 === 0 ? "bg-paper" : "bg-cream/20"
                    }`}
                  >
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 py-3.5 pl-5 pr-4 text-left align-top font-normal ${
                        index % 2 === 0 ? "bg-paper" : "bg-cream/20"
                      }`}
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
                        className={`px-3 py-3.5 text-center align-top ${
                          t.key === featuredTier ? "bg-brass/[0.06]" : ""
                        }`}
                      >
                        <CompareValue value={row.cells[t.key]} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompareValue({ value }: { value: CompareCell }) {
  if (value === true) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brass/15 text-sm font-medium text-brass"
        aria-label="Included"
      >
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-stone-soft/80" aria-label="Not included">
        —
      </span>
    );
  }
  return (
    <span className="inline-block font-medium leading-snug tabular-nums text-ink">
      {value}
    </span>
  );
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
