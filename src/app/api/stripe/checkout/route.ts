import { NextResponse } from "next/server";
import { env, hasStripe, hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe, lineItemFor, packageById, packageCredits } from "@/lib/stripe";
import { subscriptionCurrency } from "@/lib/currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a Stripe Checkout Session for a credit pack and return its hosted URL.
 *
 * Auth: the signed-in Supabase user. The pack + total credits + userId are
 * stamped into session metadata so the webhook can grant credits idempotently
 * after payment. Currency is derived from the visitor's region (EUR/USD).
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasStripe) {
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

  // Region currency (EUR for Europe, USD elsewhere) from the Vercel geo header.
  const country = request.headers.get("x-vercel-ip-country");
  const currency = subscriptionCurrency(country);

  const origin =
    env.siteUrl ||
    request.headers.get("origin") ||
    new URL(request.url).origin;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [lineItemFor(pkg, currency)],
      // Email gets the receipt; metadata drives credit granting in the webhook.
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        packageId: pkg.id,
        credits: String(packageCredits(pkg)),
      },
      payment_intent_data: {
        metadata: {
          userId: user.id,
          packageId: pkg.id,
          credits: String(packageCredits(pkg)),
        },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success&pack=${pkg.id}`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: session.url });
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
