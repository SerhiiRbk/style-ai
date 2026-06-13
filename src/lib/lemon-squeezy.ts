import "server-only";
import crypto from "node:crypto";
import type { SubCurrency } from "@/lib/currency";
import { env } from "@/lib/env";
import type { CreditPackage } from "@/lib/credit-costs";

const VARIANT_ENV: Record<
  CreditPackage["id"],
  Record<SubCurrency, string | undefined>
> = {
  starter: {
    EUR: process.env.LEMON_SQUEEZY_VARIANT_STARTER_EUR,
    USD: process.env.LEMON_SQUEEZY_VARIANT_STARTER_USD,
  },
  plus: {
    EUR: process.env.LEMON_SQUEEZY_VARIANT_PLUS_EUR,
    USD: process.env.LEMON_SQUEEZY_VARIANT_PLUS_USD,
  },
  pro: {
    EUR: process.env.LEMON_SQUEEZY_VARIANT_PRO_EUR,
    USD: process.env.LEMON_SQUEEZY_VARIANT_PRO_USD,
  },
  max: {
    EUR: process.env.LEMON_SQUEEZY_VARIANT_MAX_EUR,
    USD: process.env.LEMON_SQUEEZY_VARIANT_MAX_USD,
  },
};

/** Fallback variant IDs when currency-specific ones are unset. */
const VARIANT_FALLBACK: Record<CreditPackage["id"], string | undefined> = {
  starter: process.env.LEMON_SQUEEZY_VARIANT_STARTER,
  plus: process.env.LEMON_SQUEEZY_VARIANT_PLUS,
  pro: process.env.LEMON_SQUEEZY_VARIANT_PRO,
  max: process.env.LEMON_SQUEEZY_VARIANT_MAX,
};

export function variantIdFor(
  pkg: CreditPackage,
  currency: SubCurrency,
): string {
  const id =
    VARIANT_ENV[pkg.id]?.[currency] ??
    VARIANT_FALLBACK[pkg.id] ??
    VARIANT_ENV[pkg.id]?.EUR;
  if (!id) {
    throw new Error(
      `Lemon Squeezy variant not configured for package "${pkg.id}" (${currency})`,
    );
  }
  return id;
}

type CheckoutOpts = {
  variantId: string;
  email?: string;
  userId: string;
  packageId: string;
  credits: number;
  successUrl: string;
};

type LemonCheckoutResponse = {
  data?: {
    attributes?: { url?: string };
  };
};

/** Create a hosted Lemon Squeezy checkout and return its URL. */
export async function createLemonCheckout(opts: CheckoutOpts): Promise<string> {
  const apiKey = env.lemonSqueezyApiKey;
  const storeId = env.lemonSqueezyStoreId;
  if (!apiKey || !storeId) {
    throw new Error("Lemon Squeezy is not configured");
  }

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: opts.email,
            custom: {
              user_id: opts.userId,
              package_id: opts.packageId,
              credits: String(opts.credits),
            },
          },
          product_options: {
            redirect_url: opts.successUrl,
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: String(storeId) },
          },
          variant: {
            data: { type: "variants", id: String(opts.variantId) },
          },
        },
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as LemonCheckoutResponse & {
    errors?: { detail?: string; title?: string }[];
  };

  if (!res.ok) {
    const detail =
      body.errors?.map((e) => e.detail ?? e.title).filter(Boolean).join("; ") ??
      res.statusText;
    throw new Error(detail || "Lemon Squeezy checkout failed");
  }

  const url = body.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy did not return a checkout URL");
  return url;
}

/** Verify X-Signature from a Lemon Squeezy webhook request. */
export function verifyLemonWebhookSignature(
  payload: string,
  signature: string | null,
): boolean {
  const secret = env.lemonSqueezyWebhookSecret;
  if (!secret || !signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(payload).digest("hex"), "utf8");
  const sig = Buffer.from(signature, "utf8");
  if (digest.length !== sig.length) return false;
  return crypto.timingSafeEqual(digest, sig);
}

export type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
      package_id?: string;
      credits?: string;
    };
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      status?: string;
    };
  };
};
