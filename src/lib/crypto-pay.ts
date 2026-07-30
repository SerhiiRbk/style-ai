import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { CreditPackage } from "@/lib/credit-costs";

/**
 * NOWPayments integration for one-time credit-pack purchases in crypto.
 *
 * Flow: pricing page → POST /api/checkout { provider: "crypto" } → we create a
 * `crypto_payments` row and a NOWPayments hosted invoice (order_id = our row id)
 * → buyer pays on the hosted page → IPN callbacks to /api/crypto/webhook as the
 * status changes → on `finished` we grant credits idempotently (ref_ext =
 * np_<orderId>). Non-custodial: NOWPayments forwards funds to our wallet.
 *
 * Crypto settlement is not instant (minutes), so the UI shows a pending screen
 * that polls /api/crypto/status until the credits land.
 */

/** EUR price of a package parsed from its display string (e.g. "€79" → 79). */
export function packagePriceEur(pkg: CreditPackage): number {
  const raw = pkg.price.EUR ?? "";
  const digits = raw.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Bad EUR price for package "${pkg.id}"`);
  }
  return value;
}

type CreateInvoiceOpts = {
  /** Our crypto_payments row id — round-trips as NOWPayments order_id. */
  orderId: string;
  amountEur: number;
  description: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
};

type NowPaymentsInvoice = {
  id: string;
  invoice_url: string;
};

/** Create a hosted NOWPayments invoice and return its id + payment URL. */
export async function createCryptoInvoice(
  opts: CreateInvoiceOpts,
): Promise<NowPaymentsInvoice> {
  const apiKey = env.nowPaymentsApiKey;
  if (!apiKey) throw new Error("NOWPayments is not configured");

  const res = await fetch(`${env.nowPaymentsApiUrl}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: opts.amountEur,
      price_currency: "eur",
      // Pre-selected pay currency is optional; omit to let the buyer choose a
      // coin/network on the hosted page.
      ...(env.nowPaymentsPayCurrency
        ? { pay_currency: env.nowPaymentsPayCurrency }
        : {}),
      order_id: opts.orderId,
      order_description: opts.description,
      ipn_callback_url: opts.ipnCallbackUrl,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Partial<NowPaymentsInvoice> & {
    message?: string;
  };

  if (!res.ok || !body.id || !body.invoice_url) {
    throw new Error(
      body.message || `NOWPayments invoice failed (${res.status})`,
    );
  }

  return { id: String(body.id), invoice_url: body.invoice_url };
}

/**
 * Recursively sort object keys so the JSON we HMAC matches NOWPayments' own
 * canonical ordering (their servers ksort the payload before signing). Arrays
 * keep their order.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Verify the `x-nowpayments-sig` header: HMAC-SHA512 over the key-sorted JSON
 * body using the IPN secret. Constant-time compared.
 */
export function verifyIpnSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = env.nowPaymentsIpnSecret;
  if (!secret || !signature) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const canonical = JSON.stringify(sortKeysDeep(parsed));
  const hmac = crypto.createHmac("sha512", secret);
  const digest = Buffer.from(hmac.update(canonical).digest("hex"), "utf8");
  const sig = Buffer.from(signature.trim(), "utf8");
  if (digest.length !== sig.length) return false;
  return crypto.timingSafeEqual(digest, sig);
}

/** Shape of the fields we read from a NOWPayments IPN. */
export type NowPaymentsIpn = {
  payment_id?: number | string;
  invoice_id?: number | string;
  order_id?: string;
  payment_status?: string;
  pay_currency?: string;
  pay_amount?: number;
  actually_paid?: number;
  price_amount?: number;
  price_currency?: string;
};

/** NOWPayments payment statuses. Credits are granted only on `finished`. */
export type CryptoPaymentStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired";
