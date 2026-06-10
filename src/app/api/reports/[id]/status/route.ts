import { NextResponse } from "next/server";
import { reportGenerationState } from "@/lib/data/reports";
import { isAdminEmail } from "@/lib/admin";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { canShareReport, type HairRec, type Tier } from "@/lib/report";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (id === "demo" || !hasSupabase) {
    return NextResponse.json({
      status: "ready",
      pending: false,
      phase: null,
    });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const isAdmin = Boolean(user && isAdminEmail(user.email));
  const adminDb = isAdmin && hasSupabaseAdmin ? createAdminSupabase() : null;

  const { data: row, error } = adminDb
    ? await adminDb
        .from("reports")
        .select(
          "status, tier, capsule_images, hair, facial_hair, eyewear, user_id, is_public",
        )
        .eq("id", id)
        .single()
    : await sb
        .from("reports")
        .select(
          "status, tier, capsule_images, hair, facial_hair, eyewear, user_id, is_public",
        )
        .eq("id", id)
        .single();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = Boolean(user && row.user_id === user.id);
  const isPublic =
    canShareReport(row.tier as Tier) && Boolean(row.is_public);
  if (!isOwner && !isPublic && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = isOwner || isAdmin ? (adminDb ?? sb) : sb;
  const { data: looks } = await db
    .from("looks")
    .select("image_path")
    .eq("report_id", id);

  let hasReferencePhoto = false;
  if (isOwner || isAdmin) {
    const { data: userPhotos } = await db
      .from("photos")
      .select("id")
      .eq("user_id", row.user_id)
      .limit(1);
    hasReferencePhoto = (userPhotos?.length ?? 0) > 0;
  } else {
    const hair = (row.hair as { recommend: HairRec[]; avoid: HairRec[] } | null) ?? {
      recommend: [],
      avoid: [],
    };
    hasReferencePhoto =
      (looks ?? []).some((l) => l.image_path) ||
      [...hair.recommend, ...hair.avoid].some((h) => Boolean(h.imagePath));
  }

  const state = reportGenerationState(row, looks ?? [], { hasReferencePhoto });
  return NextResponse.json(state);
}
