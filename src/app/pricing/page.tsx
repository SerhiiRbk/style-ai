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
      "No virtual try-on",
      "No capsule wardrobe",
      "No PDF export",
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
      "Capsule wardrobe + week-of-outfits matrix",
      `Virtual try-on on your photo (${CREDIT_COSTS.tryon} credit each)`,
      "Good · Better · Best buying plan",
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
      "Facial-hair previews on your photo",
      "Eyewear previews on your photo",
      "Deeper grooming guidance",
    ],
    cta: "Get Premium",
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
                    <span className="font-display text-4xl">
                      {cost === 0 ? "Free" : cost}
                    </span>
                    {cost > 0 && (
                      <span
                        className={`text-xs ${
                          t.featured ? "text-paper/60" : "text-stone-soft"
                        }`}
                      >
                        credits
                      </span>
                    )}
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

          {/* Per-action costs */}
          <div className="mt-12 grid gap-4 rounded-2xl border hairline bg-cream/40 p-8 sm:grid-cols-3">
            <CostRow
              label="Generate a report"
              value={`${REPORT_COST.basic}–${REPORT_COST.premium} credits`}
              note="By tier (free is 0)"
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
              account starts with {SIGNUP_BONUS} free credits — enough for your
              first report.
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
