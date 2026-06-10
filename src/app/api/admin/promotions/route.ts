import { NextResponse } from "next/server";
import { env, hasSupabaseAdmin } from "@/lib/env";
import { requireAdminApi } from "@/lib/admin-api";
import { createAdminSupabase } from "@/lib/supabase/server";
import { createPromotion, listPromotions } from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List all promotions (admin). */
export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }

  try {
    const admin = createAdminSupabase();
    const promotions = await listPromotions(admin);
    const siteUrl = env.siteUrl ?? "";
    return NextResponse.json({
      promotions: promotions.map((p) => ({
        ...p,
        inviteUrl: siteUrl ? `${siteUrl}/login?promo=${encodeURIComponent(p.code)}` : null,
        remaining: Math.max(0, p.max_activations - p.activations_count),
        expired: new Date(p.expires_at).getTime() < Date.now(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list promotions" },
      { status: 500 },
    );
  }
}

/** Create a new promotion (admin). */
export async function POST(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const credits = Number(b.credits);
  const maxActivations = Number(b.maxActivations);
  const validDays = Number(b.validDays);

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Number.isFinite(credits) || credits <= 0) {
    return NextResponse.json({ error: "Credits must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(maxActivations) || maxActivations <= 0) {
    return NextResponse.json(
      { error: "Max activations must be a positive number" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(validDays) || validDays <= 0) {
    return NextResponse.json(
      { error: "Valid days must be a positive number" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminSupabase();
    const promo = await createPromotion(admin, {
      name,
      description:
        typeof b.description === "string" ? b.description : undefined,
      credits: Math.round(credits),
      maxActivations: Math.round(maxActivations),
      validDays: Math.round(validDays),
      code: typeof b.code === "string" ? b.code : undefined,
      createdBy: gate.user.id,
    });
    const siteUrl = env.siteUrl ?? "";
    return NextResponse.json({
      promotion: {
        ...promo,
        inviteUrl: siteUrl
          ? `${siteUrl}/login?promo=${encodeURIComponent(promo.code)}`
          : null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create promotion" },
      { status: 400 },
    );
  }
}
