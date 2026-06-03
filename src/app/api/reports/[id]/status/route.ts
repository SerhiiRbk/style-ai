import { NextResponse } from "next/server";
import { reportGenerationState } from "@/lib/data/reports";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
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

  const { data: row, error } = await sb
    .from("reports")
    .select("status, tier, capsule_images, hair, facial_hair, eyewear, user_id, is_public")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = Boolean(user && row.user_id === user.id);
  const isPublic =
    canShareReport(row.tier as Tier) && Boolean(row.is_public);
  if (!isOwner && !isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: looks } = await sb
    .from("looks")
    .select("image_path")
    .eq("report_id", id);

  let hasReferencePhoto = false;
  if (isOwner) {
    const { data: userPhotos } = await sb
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
