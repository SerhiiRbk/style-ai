import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env, hasStripe, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { grantCreditsExternal } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Verifies the signature, then on a completed Checkout grants
 * the purchased credits to the buyer. Idempotent: the payment id is the ledger's
 * external reference, so Stripe's at-least-once delivery never double-grants.
 *
 * Always returns 2xx for handled (or safely-ignored) events so Stripe stops
 * retrying; only signature/parse failures return 4xx.
 */
export async function POST(request: Request) {
  if (!hasStripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body is required for signature verification.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      env.stripeWebhookSecret!,
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Signature verification failed: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 400 },
    );
  }

  if (event.type !== "checkout.session.completed") {
    // Not interested — acknowledge so Stripe doesn't retry.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Guard: only grant once the payment actually succeeded.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, unpaid: true });
  }

  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits);
  const refExt =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? session.id);

  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    // Malformed metadata — ack to avoid infinite retries, but flag for logs.
    return NextResponse.json(
      { received: true, error: "Missing/invalid metadata" },
      { status: 200 },
    );
  }

  if (!hasSupabaseAdmin) {
    // Can't grant without the service role; ask Stripe to retry later.
    return NextResponse.json(
      { error: "Supabase admin not configured" },
      { status: 503 },
    );
  }

  try {
    const admin = createAdminSupabase();
    const balance = await grantCreditsExternal(admin, {
      userId,
      amount: credits,
      reason: "purchase",
      refExt,
    });
    return NextResponse.json({ received: true, granted: credits, balance });
  } catch (e) {
    // Transient DB error — 5xx so Stripe retries (grant stays idempotent).
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "grant failed" },
      { status: 500 },
    );
  }
}
