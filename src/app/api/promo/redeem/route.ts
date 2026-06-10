import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { promoErrorMessage, redeemPromotion } from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Redeem a promo code for the signed-in user. */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).code
      : undefined;
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Enter a promo code" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const result = await redeemPromotion(admin, user.id, code);
    return NextResponse.json({
      ok: true,
      credits: result.credits,
      balance: result.balance,
      name: result.name,
    });
  } catch (e) {
    const key = e instanceof Error ? e.message : "";
    const userMsg = promoErrorMessage(key);
    const status =
      key === "PROMO_NOT_FOUND" || key === "PROMO_INVALID" ? 404 : 400;
    return NextResponse.json({ error: userMsg }, { status });
  }
}
