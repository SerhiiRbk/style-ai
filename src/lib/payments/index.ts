import {
  hasLemonSqueezy,
  hasPayments,
  hasStripe,
  type PaymentProvider,
  env,
} from "@/lib/env";

export type { PaymentProvider };
export { hasPayments, hasStripe, hasLemonSqueezy };

/** Active checkout provider from PAYMENT_PROVIDER (default: lemon_squeezy). */
export function paymentProvider(): PaymentProvider {
  return env.paymentProvider;
}

export function paymentProviderLabel(): string {
  return env.paymentProvider === "stripe" ? "Stripe" : "Lemon Squeezy";
}
