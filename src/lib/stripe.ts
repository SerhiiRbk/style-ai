import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import type { CreditPackage } from "@/lib/credit-costs";
import type { SubCurrency } from "@/lib/currency";
import { packageById, packageCredits } from "@/lib/payments/packages";

export { packageById, packageCredits };

/**
 * Stripe integration for one-time credit-pack purchases.
 *
 * Flow: pricing page → POST /api/stripe/checkout (creates a Checkout Session) →
 * Stripe Hosted Checkout → checkout.session.completed webhook → grantCredits().
 * Credits (not Stripe subscriptions) are the spendable currency, so packs are
 * `mode: "payment"` one-time charges.
 */

let _stripe: Stripe | null = null;

/** Lazily-constructed Stripe client. Throws when the secret key is unset. */
export function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(env.stripeSecretKey, {
      // Pin a version-agnostic client; the account's default API version applies.
      typescript: true,
      appInfo: { name: "valetti" },
    });
  }
  return _stripe;
}

/** Minor-unit (cents) amount parsed from a package's display price string. */
export function packageAmountMinor(
  pkg: CreditPackage,
  currency: SubCurrency,
): number {
  const raw = pkg.price[currency] ?? pkg.price.EUR;
  const digits = raw.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value)) throw new Error(`Bad price for ${pkg.id}`);
  return Math.round(value * 100);
}

const PRICE_ENV: Record<CreditPackage["id"], Record<SubCurrency, string | undefined>> = {
  starter: { EUR: process.env.STRIPE_PRICE_STARTER_EUR, USD: process.env.STRIPE_PRICE_STARTER_USD },
  plus: { EUR: process.env.STRIPE_PRICE_PLUS_EUR, USD: process.env.STRIPE_PRICE_PLUS_USD },
  pro: { EUR: process.env.STRIPE_PRICE_PRO_EUR, USD: process.env.STRIPE_PRICE_PRO_USD },
  max: { EUR: process.env.STRIPE_PRICE_MAX_EUR, USD: process.env.STRIPE_PRICE_MAX_USD },
};

/** Configured Stripe Price ID for a package+currency, if any. */
export function priceIdFor(
  pkg: CreditPackage,
  currency: SubCurrency,
): string | undefined {
  return PRICE_ENV[pkg.id]?.[currency];
}

/**
 * Build the Checkout line item: a preconfigured Stripe Price when available,
 * otherwise inline price_data derived from the package (simplest to start).
 */
export function lineItemFor(
  pkg: CreditPackage,
  currency: SubCurrency,
): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = priceIdFor(pkg, currency);
  if (priceId) return { price: priceId, quantity: 1 };

  const total = packageCredits(pkg);
  return {
    quantity: 1,
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: packageAmountMinor(pkg, currency),
      product_data: {
        name: `${pkg.name} — ${total} credits`,
        description: pkg.blurb,
      },
    },
  };
}

type StripeCheckoutOpts = {
  pkg: CreditPackage;
  currency: SubCurrency;
  userId: string;
  email?: string;
  origin: string;
};

/** Create a Stripe Checkout Session and return its hosted URL. */
export async function createStripeCheckout(
  opts: StripeCheckoutOpts,
): Promise<string> {
  const { pkg, currency, userId, email, origin } = opts;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItemFor(pkg, currency)],
    customer_email: email,
    client_reference_id: userId,
    metadata: {
      userId,
      packageId: pkg.id,
      credits: String(packageCredits(pkg)),
      termsAccepted: "true",
      digitalDeliveryConsent: "true",
    },
    payment_intent_data: {
      metadata: {
        userId,
        packageId: pkg.id,
        credits: String(packageCredits(pkg)),
      },
    },
    allow_promotion_codes: true,
    success_url: `${origin}/pricing?checkout=success&pack=${pkg.id}`,
    cancel_url: `${origin}/pricing?checkout=cancel`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}
