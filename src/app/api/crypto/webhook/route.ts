import { NextResponse } from "next/server";
import { hasNowPaymentsKeys, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { grantCreditsExternal } from "@/lib/credits";
import { captureError, captureWarning } from "@/lib/observability";
import { verifyIpnSignature, type NowPaymentsIpn } from "@/lib/crypto-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NOWPayments IPN webhook. Verifies the x-nowpayments-sig signature, mirrors the
 * payment status onto our crypto_payments row, and grants credits idempotently
 * (ref_ext = np_<orderId>) once the payment reaches `finished`.
 *
 * NOWPayments dashboard → Settings → IPN → callback URL:
 *   <site>/api/crypto/webhook
 *
 * Note: this runs whenever keys are present, independent of ENABLED_CRYPTO_PAYMENT,
 * so payments started before crypto was switched off still settle correctly.
 * Always returns 2xx for handled/safely-ignored events; only signature/parse
 * failures return 4xx.
 */
export async function POST(request: Request) {
  if (!hasNowPaymentsKeys) {
    return NextResponse.json(
      { error: "Crypto payments not configured" },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  if (!verifyIpnSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: NowPaymentsIpn;
  try {
    event = JSON.parse(payload) as NowPaymentsIpn;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = event.order_id;
  const status = event.payment_status;

  if (!orderId || !status) {
    captureWarning("[crypto webhook] IPN missing order_id/status", {
      provider: "nowpayments",
      orderId: orderId ?? null,
      status: status ?? null,
    });
    return NextResponse.json(
      { received: true, error: "Missing order_id/status" },
      { status: 200 },
    );
  }

  if (!hasSupabaseAdmin) {
    // Can't record/grant without the service role; ask NOWPayments to retry.
    captureWarning("[crypto webhook] IPN but Supabase admin not configured", {
      provider: "nowpayments",
      orderId,
      status,
    });
    return NextResponse.json(
      { error: "Supabase admin not configured" },
      { status: 503 },
    );
  }

  const admin = createAdminSupabase();

  const { data: payment, error: selErr } = await admin
    .from("crypto_payments")
    .select("id, user_id, credits, credited")
    .eq("id", orderId)
    .maybeSingle();

  if (selErr) {
    captureError(selErr, { stage: "crypto webhook lookup", orderId, status });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!payment) {
    // Unknown order — nothing we can book. Ack so NOWPayments stops retrying.
    captureWarning("[crypto webhook] IPN for unknown order", {
      provider: "nowpayments",
      orderId,
      status,
    });
    return NextResponse.json({ received: true, unknown: true });
  }

  // Mirror the latest status + pay details (best-effort; never blocks the grant).
  await admin
    .from("crypto_payments")
    .update({
      status,
      payment_id: event.payment_id != null ? String(event.payment_id) : undefined,
      invoice_id: event.invoice_id != null ? String(event.invoice_id) : undefined,
      pay_currency: event.pay_currency,
      pay_amount: event.pay_amount,
      actually_paid: event.actually_paid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (status === "partially_paid") {
    captureWarning("[crypto webhook] partially paid — not granting", {
      provider: "nowpayments",
      orderId,
      actuallyPaid: event.actually_paid ?? null,
      payAmount: event.pay_amount ?? null,
    });
    return NextResponse.json({ received: true, partiallyPaid: true });
  }

  if (status !== "finished") {
    // In-progress or terminal-without-funds — acknowledge, no grant.
    return NextResponse.json({ received: true, status });
  }

  try {
    const balance = await grantCreditsExternal(admin, {
      userId: payment.user_id,
      amount: payment.credits,
      reason: "purchase",
      refExt: `np_${orderId}`,
    });
    await admin
      .from("crypto_payments")
      .update({ credited: true, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return NextResponse.json({
      received: true,
      granted: payment.credits,
      balance,
    });
  } catch (e) {
    // Transient DB error — 5xx so NOWPayments retries (grant stays idempotent).
    captureError(e, {
      provider: "nowpayments",
      stage: "grantCreditsExternal",
      orderId,
      userId: payment.user_id,
      credits: payment.credits,
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "grant failed" },
      { status: 500 },
    );
  }
}
