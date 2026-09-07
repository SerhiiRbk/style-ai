import { NextResponse } from "next/server";
import { reportGenerationState, buildReportRecoveryInfo } from "@/lib/data/reports";
import { isAdminEmail } from "@/lib/admin";
import { isDemoReportId } from "@/lib/demo-report";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  canShareReport,
  pdfReadiness,
  type EyewearRec,
  type FacialHairRec,
  type AccessoryRec,
  type HeadwearRec,
  type HairRec,
  type Tier,
} from "@/lib/report";
import type { Intake } from "@/lib/style-profile";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (isDemoReportId(id) || !hasSupabase) {
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

  const ownerCols =
    "status, tier, capsule_images, hair, facial_hair, eyewear, accessories, headwear, user_id, is_public, headline, summary, colors, created_at, cover_image, watch_image, shoe_image";
  // Public view omits user_id (and intake) — read it for non-owners.
  const publicCols =
    "status, tier, capsule_images, hair, facial_hair, eyewear, accessories, headwear, is_public";

  type StatusRow = {
    status?: string | null;
    tier?: string | null;
    capsule_images?: (string | null)[] | null;
    hair?: { recommend: HairRec[]; avoid: HairRec[] } | null;
    facial_hair?: FacialHairRec[] | null;
    eyewear?: EyewearRec[] | null;
    accessories?: AccessoryRec[] | null;
    headwear?: HeadwearRec[] | null;
    user_id?: string;
    is_public?: boolean;
    headline?: string | null;
    summary?: string | null;
    colors?: { best: unknown[]; avoid: unknown[] } | null;
    created_at?: string | null;
    cover_image?: string | null;
    watch_image?: string | null;
    shoe_image?: string | null;
  };

  let row: StatusRow | null = null;
  let isOwner = false;
  let isPublic = false;

  if (adminDb) {
    const { data } = await adminDb
      .from("reports")
      .select(ownerCols)
      .eq("id", id)
      .single();
    row = (data as unknown as StatusRow) ?? null;
    if (row) {
      isOwner = Boolean(user && row.user_id === user.id);
      isPublic = canShareReport(row.tier as Tier) && Boolean(row.is_public);
    }
  } else {
    const { data: own } = await sb
      .from("reports")
      .select(ownerCols)
      .eq("id", id)
      .maybeSingle();
    if (own) {
      row = own as unknown as StatusRow;
      isOwner = Boolean(user && row.user_id === user.id);
    } else {
      const { data: pub } = await sb
        .from("reports_public_v")
        .select(publicCols)
        .eq("id", id)
        .maybeSingle();
      if (pub) {
        row = pub as unknown as StatusRow;
        isPublic = true;
      }
    }
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isOwner && !isPublic && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = isOwner || isAdmin ? (adminDb ?? sb) : sb;
  const { data: looks } = await db
    .from("looks")
    .select("image_path")
    .eq("report_id", id);
  const lookImages = (looks ?? []).map((l) => ({ imagePath: l.image_path as string | null }));

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

  let state = reportGenerationState(row, looks ?? [], { hasReferencePhoto });

  if (state.status === "failed" && isOwner && hasSupabaseAdmin && row.user_id) {
    const recoveryAdmin = createAdminSupabase();
    // Intake moved to its own owner-only table (migration 0020); the base
    // `reports` row no longer carries it.
    const { data: intakeRow } = await recoveryAdmin
      .from("report_intake")
      .select("intake")
      .eq("report_id", id)
      .maybeSingle();
    const recovery = await buildReportRecoveryInfo(recoveryAdmin, {
      userId: row.user_id,
      reportId: id,
      tier: row.tier as Tier,
      intake: (intakeRow?.intake as Intake | null) ?? null,
      headline: row.headline,
      summary: row.summary,
      colors: row.colors,
      lookCount: looks?.length ?? 0,
      hasPhotos: hasReferencePhoto,
    });
    state = { ...state, recovery };
  }

  // PDF gate for the download button's own poll (owner / admin only — the
  // public view lacks the cover / board columns).
  const pdf =
    (isOwner || isAdmin) && row.created_at
      ? pdfReadiness({
          tier: (row.tier as Tier) ?? "basic",
          createdAt: row.created_at,
          status: row.status,
          generationPending: state.pending,
          hasReferencePhoto,
          looks: lookImages,
          coverImage: row.cover_image,
          capsuleImages: row.capsule_images,
          hair: row.hair ?? { recommend: [], avoid: [] },
          facialHair: row.facial_hair,
          eyewear: row.eyewear,
          accessories: row.accessories,
          headwear: row.headwear,
          watchImage: row.watch_image,
          shoeImage: row.shoe_image,
        })
      : null;

  return NextResponse.json(
    pdf ? { ...state, pdfReady: pdf.ready, pdfReason: pdf.reason } : state,
  );
}
