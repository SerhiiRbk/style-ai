import { NextResponse } from "next/server";
import { hasAI, hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { isDemoReportId } from "@/lib/demo-report";
import {
  generateTryOnOpinion,
  type OpinionGarment,
} from "@/lib/ai/tryon-opinion";
import type { StyleProfile } from "@/lib/style-profile";

export const maxDuration = 60;

const MAX_TRYON_PRODUCTS = 4;

/**
 * Carlo's expert read on a catalogue (or report) try-on. Called by the try-on
 * tray AFTER the image renders, so the preview is never blocked on this. Free —
 * bundled with the paid try-on; no credit charge. Returns { opinion, hasProfile }
 * with opinion:null when AI is unconfigured or the read fails.
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ opinion: null, hasProfile: false });
  }
  if (!hasAI) {
    return NextResponse.json({ opinion: null, hasProfile: false });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawIds: unknown = body?.productIds;
  let productIds = Array.isArray(rawIds)
    ? rawIds.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  if (!productIds.length && typeof body?.productId === "string") {
    productIds = [body.productId];
  }
  productIds = [...new Set(productIds)].slice(0, MAX_TRYON_PRODUCTS);
  if (!productIds.length) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }
  const reportId: string | undefined =
    typeof body?.reportId === "string" && !isDemoReportId(body.reportId)
      ? body.reportId
      : undefined;

  const admin = createAdminSupabase();

  const { data: productRows } = await admin
    .from("products")
    .select("id, title, category, color")
    .in("id", productIds);
  const byId = new Map((productRows ?? []).map((p) => [p.id as string, p]));
  // Preserve the caller's item order (matches how the outfit was assembled).
  const garments: OpinionGarment[] = productIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      title: (p.title as string) ?? "Catalogue item",
      category: (p.category as string) ?? "Clothing",
      color: (p.color as string | null) ?? undefined,
    }));
  if (!garments.length) {
    return NextResponse.json({ error: "Products not found" }, { status: 404 });
  }

  // Personalise from the user's profile: the named report when owned, else their
  // most recent finished report. Null → Carlo gives general guidance.
  const profile = await loadUserProfile(admin, user.id, reportId);

  const opinion = await generateTryOnOpinion({ garments, profile });
  return NextResponse.json({ opinion, hasProfile: Boolean(profile) });
}

/** The report's profile when the caller owns it; otherwise the user's latest. */
async function loadUserProfile(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
  reportId?: string,
): Promise<StyleProfile | null> {
  if (reportId) {
    const { data } = await admin
      .from("reports")
      .select("profile, user_id")
      .eq("id", reportId)
      .maybeSingle();
    if (data?.user_id === userId && data.profile) {
      return data.profile as StyleProfile;
    }
  }
  const { data } = await admin
    .from("reports")
    .select("profile")
    .eq("user_id", userId)
    .eq("status", "ready")
    .not("profile", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.profile as StyleProfile | null) ?? null;
}
