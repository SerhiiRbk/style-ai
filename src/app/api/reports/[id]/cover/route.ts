import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateCoverImage } from "@/lib/ai/pipeline";
import { isDemoReportId } from "@/lib/demo-report";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import type { ColorRec } from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { getReportReferencePhotos } from "@/lib/photo-tryon";

export const maxDuration = 300;

/**
 * Re-generate the report's bespoke editorial PDF/header cover photo on the
 * owner's reference photo, overwrite the stored cover, and charge
 * `CREDIT_COSTS.cover_regen` once the render succeeds.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image generation is not configured" },
      { status: 501 },
    );
  }

  const { id: reportId } = await params;
  if (!reportId || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("id, user_id, tier, profile, colors, created_at")
    .eq("id", reportId)
    .single();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (row.tier === "free") {
    return NextResponse.json(
      { error: "The cover is a paid-report feature." },
      { status: 402 },
    );
  }
  const profile = row.profile as StyleProfile | null;
  if (!profile) {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }

  const cost = CREDIT_COSTS.cover_regen;
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  const refs = await getReportReferencePhotos(
    admin,
    user.id,
    row.created_at as string,
  );
  if (!refs.ok) {
    return NextResponse.json({ error: refs.error }, { status: 422 });
  }

  const palette = ((row.colors as { best?: ColorRec[] } | null)?.best ?? [])
    .map((c) => c.name)
    .filter(Boolean);

  const img = await generateCoverImage({
    profile,
    palette,
    referenceImageUrl: refs.fullUrl,
    faceReferenceImageUrl: refs.faceUrl,
  });
  if (!img) {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  // Unique filename per regen so the signed proxy URL changes and no stale
  // cached cover is shown after refresh.
  const path = `${user.id}/${reportId}/cover-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: "Could not store cover" }, { status: 500 });
  }

  const { error: updErr } = await admin
    .from("reports")
    .update({ cover_image: path })
    .eq("id", reportId);
  if (updErr) {
    return NextResponse.json({ error: "Could not save cover" }, { status: 500 });
  }

  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "cover_regen",
        refId: reportId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits.",
            code: "insufficient_credits",
            balance: e.balance,
            needed: e.needed,
          },
          { status: 402 },
        );
      }
      throw e;
    }
  }

  return NextResponse.json(
    { ok: true, balance, cover: signedAssetProxyUrl(path) },
    { status: 201 },
  );
}
