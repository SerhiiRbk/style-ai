import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { parseGarmentsJson, type SavedOutfitTryOn } from "@/lib/outfit-tryon";

/** List saved catalogue / outfit try-ons for a report (owner only). */
export async function GET(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Requires live mode" }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const reportId = new URL(request.url).searchParams.get("reportId");
  if (!reportId || reportId === "demo") {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data: report } = await admin
    .from("reports")
    .select("user_id")
    .eq("id", reportId)
    .single();
  if (!report || report.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { data: rows } = await admin
    .from("tryons")
    .select("id, image_path, garments, kind, created_at")
    .eq("report_id", reportId)
    .eq("user_id", user.id)
    .eq("status", "ready")
    .not("image_path", "is", null)
    .order("created_at", { ascending: false });

  const outfits: SavedOutfitTryOn[] = [];
  for (const row of rows ?? []) {
    const path = row.image_path as string | null;
    if (!path) continue;
    const { data: signed } = await admin.storage
      .from("assets")
      .createSignedUrl(path, 3600);
    if (!signed?.signedUrl) continue;
    const kind = row.kind === "outfit" ? "outfit" : "product";
    outfits.push({
      id: row.id as string,
      image: signed.signedUrl,
      createdAt: row.created_at as string,
      kind,
      garments: parseGarmentsJson(row.garments),
    });
  }

  return NextResponse.json({ outfits });
}
