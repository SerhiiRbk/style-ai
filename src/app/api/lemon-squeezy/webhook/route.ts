import { NextResponse } from "next/server";
import { hasLemonSqueezy, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { grantCreditsExternal } from "@/lib/credits";
import { captureError, captureWarning } from "@/lib/observability";
import {
  verifyLemonWebhookSignature,
  type LemonWebhookPayload,
} from "@/lib/lemon-squeezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhook. On order_created with status paid, grants credits
 * idempotently using the order id as ref_ext (prefixed ls_).
 *
 * Dashboard → Settings → Webhooks → order_created
 * URL: <site>/api/lemon-squeezy/webhook
 */
export async function POST(request: Request) {
  if (!hasLemonSqueezy) {
    return NextResponse.json(
      { error: "Lemon Squeezy not configured" },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyLemonWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: LemonWebhookPayload;
  try {
    event = JSON.parse(payload) as LemonWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = event.meta?.event_name;
  if (eventName !== "order_created") {
    return NextResponse.json({ received: true, ignored: eventName });
  }

  const status = event.data?.attributes?.status;
  if (status !== "paid") {
    return NextResponse.json({ received: true, unpaid: status ?? "unknown" });
  }

  const userId = event.meta?.custom_data?.user_id;
  const credits = Number(event.meta?.custom_data?.credits);
  const orderId = event.data?.id;

  if (!userId || !Number.isFinite(credits) || credits <= 0 || !orderId) {
    // Paid but unbookable: ack with 200 so Lemon stops retrying, but alert —
    // a real order came in that we can't turn into credits.
    captureWarning("[lemon webhook] paid order with missing/invalid custom_data", {
      provider: "lemon_squeezy",
      orderId: orderId ?? null,
      userId: userId ?? null,
      credits: event.meta?.custom_data?.credits ?? null,
    });
    return NextResponse.json(
      { received: true, error: "Missing/invalid custom_data" },
      { status: 200 },
    );
  }

  if (!hasSupabaseAdmin) {
    captureWarning("[lemon webhook] paid order but Supabase admin not configured", {
      provider: "lemon_squeezy",
      orderId,
      userId,
      credits,
    });
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
      refExt: `ls_${orderId}`,
    });
    return NextResponse.json({ received: true, granted: credits, balance });
  } catch (e) {
    captureError(e, {
      provider: "lemon_squeezy",
      stage: "grantCreditsExternal",
      orderId,
      userId,
      credits,
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "grant failed" },
      { status: 500 },
    );
  }
}
