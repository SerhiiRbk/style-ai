"use client";

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/Button";
import { BuyCreditsButton } from "@/components/BuyCreditsButton";
import { PromoRedeemForm } from "@/components/PromoRedeemForm";
import { CreditsProvider } from "@/components/CreditsContext";
import { useNavSession } from "@/components/NavSession";
import { SubCurrencyPrice } from "@/components/SubCurrencyPrice";
import { hasPayments, hasSupabase } from "@/lib/env";
import { paymentProviderLabel } from "@/lib/payments";
import { TIER_PRICES } from "@/lib/currency";
import {
  CREDIT_PACKAGES,
  REPORT_COST,
  SIGNUP_BONUS,
  CREDIT_COSTS,
} from "@/lib/credit-costs";

const MEMBERSHIP_PRICES: Record<"EUR" | "USD", string> = {
  EUR: TIER_PRICES.EUR.membership,
  USD: TIER_PRICES.USD.membership,
};

const BUSINESS_PRICES: Record<"EUR" | "USD", string> = {
  EUR: `from ${TIER_PRICES.EUR.business}`,
  USD: `from ${TIER_PRICES.USD.business}`,
};

export function PricingPromoPanel() {
  const { authed } = useNavSession();
  if (!hasSupabase) return null;

  return (
    <div
      id="promo"
      className="scroll-mt-24 rounded-2xl bg-paper p-6 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)]"
    >
      <p className="text-xs uppercase tracking-wider text-stone-soft">
        Have a promo code?
      </p>
      <p className="mt-1 text-sm text-stone">
        {authed
          ? "Enter a code from an invite or campaign — credits apply once per account."
          : "Sign in to redeem a code from an invite or campaign."}
      </p>
      <div className="mt-4">
        {authed ? (
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
  );
}

export function PricingCreditPackages() {
  const { authed, balance } = useNavSession();

  return (
    <CreditsProvider initialBalance={authed ? balance : null}>
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
          <PricingPromoPanel />
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
                    <SubCurrencyPrice prices={pkg.price} />
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
                <p className="mt-3 flex-1 text-sm text-paper/60">{pkg.blurb}</p>
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
  );
}

function RoadmapCard({
  name,
  price,
  body,
}: {
  name: string;
  price: ReactNode;
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

export function PricingRoadmap() {
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <RoadmapCard
        name="Membership"
        price={
          <>
            <SubCurrencyPrice prices={MEMBERSHIP_PRICES} />
            /mo
          </>
        }
        body="Monthly credit allowance, refreshed looks, and unlimited try-on for members. Not available yet — pay-as-you-go with credits for now."
      />
      <RoadmapCard
        name="Business · white-label"
        price={<SubCurrencyPrice prices={BUSINESS_PRICES} />}
        body="Generate reports under your own salon or studio brand, with your catalogue as the product source. In development — get in touch to pilot."
      />
    </div>
  );
}
