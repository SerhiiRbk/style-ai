import { NextResponse } from "next/server";
import { env, hasPayments, hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { subscriptionCurrency } from "@/lib/currency";
import { packageById, packageCredits } from "@/lib/payments/packages";
import { createLemonCheckout, variantIdFor } from "@/lib/lemon-squeezy";
import { createStripeCheckout } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified credit-pack checkout. Provider is selected via PAYMENT_PROVIDER
 * (default: lemon_squeezy). Returns a hosted checkout URL for redirect.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasPayments) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 503 },
    );
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

  const packageId =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).packageId
      : undefined;
  const pkg =
    typeof packageId === "string" ? packageById(packageId) : undefined;
  if (!pkg) {
    return NextResponse.json({ error: "Unknown package" }, { status: 400 });
  }

  const bodyObj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
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

  const country = request.headers.get("x-vercel-ip-country");
  const currency = subscriptionCurrency(country);
  const origin =
    env.siteUrl ||
    request.headers.get("origin") ||
    new URL(request.url).origin;
  const credits = packageCredits(pkg);

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
