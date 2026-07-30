import { NextResponse } from "next/server";
import {
  env,
  hasCryptoPay,
  hasPayments,
  hasSupabase,
  hasSupabaseAdmin,
} from "@/lib/env";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { subscriptionCurrency } from "@/lib/currency";
import { packageById, packageCredits } from "@/lib/payments/packages";
import { createLemonCheckout, variantIdFor } from "@/lib/lemon-squeezy";
import { createStripeCheckout } from "@/lib/stripe";
import { createCryptoInvoice, packagePriceEur } from "@/lib/crypto-pay";
import { captureError } from "@/lib/observability";
import type { CreditPackage } from "@/lib/credit-costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified credit-pack checkout. The card provider is selected via
 * PAYMENT_PROVIDER (default: lemon_squeezy); passing { provider: "crypto" }
 * starts a NOWPayments crypto invoice instead (gated by ENABLED_CRYPTO_PAYMENT).
 * Returns a hosted checkout URL for redirect.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyObj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const wantsCrypto = bodyObj.provider === "crypto";

  // Availability depends on the chosen rail: crypto is gated by
  // ENABLED_CRYPTO_PAYMENT, cards by the configured PAYMENT_PROVIDER.
  if (wantsCrypto) {
    if (!hasCryptoPay) {
      return NextResponse.json(
        { error: "Crypto payments are not available." },
        { status: 503 },
      );
    }
    if (!hasSupabaseAdmin) {
      return NextResponse.json(
        { error: "Crypto payments are not available." },
        { status: 503 },
      );
    }
  } else if (!hasPayments) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 503 },
    );
  }

  const packageId = bodyObj.packageId;
  const pkg =
    typeof packageId === "string" ? packageById(packageId) : undefined;
  if (!pkg) {
    return NextResponse.json({ error: "Unknown package" }, { status: 400 });
  }

  if (
    bodyObj.termsAccepted !== true ||
    bodyObj.digitalDeliveryConsent !== true
  ) {
    return NextResponse.json(
      {
        error:
          "You must accept the Terms and acknowledge immediate digital delivery before checkout.",
        code: "consent_required",
      },
      { status: 422 },
    );
  }

  const origin =
    env.siteUrl ||
    request.headers.get("origin") ||
    new URL(request.url).origin;
  const credits = packageCredits(pkg);

  if (wantsCrypto) {
    return startCryptoCheckout({
      pkg,
      credits,
      userId: user.id,
      origin,
    });
  }

  const country = request.headers.get("x-vercel-ip-country");
  const currency = subscriptionCurrency(country);

  try {
    const url =
      env.paymentProvider === "stripe"
        ? await createStripeCheckout({
            pkg,
            currency,
            userId: user.id,
            email: user.email ?? undefined,
            origin,
          })
        : await createLemonCheckout({
            variantId: variantIdFor(pkg, currency),
            email: user.email ?? undefined,
            userId: user.id,
            packageId: pkg.id,
            credits,
            successUrl: `${origin}/pricing?checkout=success&pack=${pkg.id}`,
          });

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Could not start checkout.",
        detail: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Create a crypto_payments row, open a NOWPayments hosted invoice keyed to it,
 * and return the invoice URL. The row is the durable record the pending screen
 * polls and the IPN webhook settles.
 */
async function startCryptoCheckout(opts: {
  pkg: CreditPackage;
  credits: number;
  userId: string;
  origin: string;
}): Promise<Response> {
  const { pkg, credits, userId, origin } = opts;
  try {
    const amountEur = packagePriceEur(pkg);
    const admin = createAdminSupabase();

    const { data: row, error: insErr } = await admin
      .from("crypto_payments")
      .insert({
        user_id: userId,
        package_id: pkg.id,
        credits,
        amount_eur: amountEur,
        status: "waiting",
      })
      .select("id")
      .single();
    if (insErr || !row) {
      throw new Error(insErr?.message ?? "Could not create payment record");
    }

    const invoice = await createCryptoInvoice({
      orderId: row.id,
      amountEur,
      description: `${pkg.name} — ${credits} credits`,
      ipnCallbackUrl: `${origin}/api/crypto/webhook`,
      successUrl: `${origin}/pricing?checkout=crypto_pending&payment=${row.id}`,
      cancelUrl: `${origin}/pricing?checkout=cancel`,
    });

    await admin
      .from("crypto_payments")
      .update({ invoice_id: invoice.id, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    return NextResponse.json({ url: invoice.invoice_url });
  } catch (e) {
    captureError(e, { stage: "startCryptoCheckout", userId, packageId: pkg.id });
    return NextResponse.json(
      {
        error: "Could not start crypto checkout.",
        detail: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
