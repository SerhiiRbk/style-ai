import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateExtraLook, generateLookImage, retrieveRules } from "@/lib/ai/pipeline";
import { matchLookItems } from "@/lib/data/catalog";
import { isDemoReportId } from "@/lib/demo-report";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { lookContextById } from "@/lib/look-contexts";
import type { Intake, ReportContent, StyleProfile } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";
import { signedAssetProxyUrl } from "@/lib/asset-token";

export const maxDuration = 300;

const SIGNED_TTL = 3600;
const NOTE_MAX = 160;

/**
 * One standalone extra look on an existing report. Generates a single occasion
 * look from the Style Profile, renders it on the owner's photo, matches catalog
 * products for "Shop the Look", appends it to the report's looks, and charges
 * `CREDIT_COSTS.look_extra` once the render succeeds.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image generation is not configured" },
      { status: 501 },
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reportId: string | undefined = body?.reportId;
  const contextId: string | undefined = body?.contextId;
  const note: string | undefined =
    typeof body?.note === "string" ? body.note.slice(0, NOTE_MAX) : undefined;

  if (!reportId || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }
  const ctx = lookContextById(contextId);
  if (!ctx) {
    return NextResponse.json({ error: "Choose an occasion" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data: row } = await admin
    .from("reports")
    .select("id, user_id, intake, profile, colors, look_items")
    .eq("id", reportId)
    .single();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const profile = row.profile as StyleProfile | null;
  const intake = row.intake as Intake | null;
  if (!profile || !intake) {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }

  const cost = CREDIT_COSTS.look_extra;
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

  // The owner's reference photo — keeps identity consistent across looks.
  const { data: photos } = await admin
    .from("photos")
    .select("storage_path, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const chosen = photos?.find((p) => p.role === "full") ?? photos?.[0] ?? null;
  if (!chosen) {
    return NextResponse.json(
      { error: "Upload a photo to generate looks on yourself" },
      { status: 422 },
    );
  }
  const { data: signed } = await admin.storage
    .from("photos")
    .createSignedUrl(chosen.storage_path, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 500 });
  }

  // Existing looks define the append index and what to avoid repeating.
  const { data: existingLooks } = await admin
    .from("looks")
    .select("id, title")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  const newIndex = existingLooks?.length ?? 0;
  const existingTitles = (existingLooks ?? [])
    .map((l) => l.title as string | null)
    .filter((t): t is string => Boolean(t));

  const rules = await retrieveRules(profile);
  const look = await generateExtraLook({
    intake,
    profile,
    context: ctx.context,
    brief: ctx.brief,
    note,
    rules,
    existingTitles,
  });

  const img = await generateLookImage({
    profile,
    look,
    referenceImageUrl: signed.signedUrl,
  });
  if (!img) {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  const imagePath = `${user.id}/${reportId}/look-extra-${newIndex}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(imagePath, img.bytes, {
      contentType: img.mediaType,
      upsert: true,
    });
  if (upErr) {
    return NextResponse.json({ error: "Could not store look" }, { status: 500 });
  }

  const { error: insErr } = await admin.from("looks").insert({
    report_id: reportId,
    user_id: user.id,
    context: look.context,
    title: look.title,
    description: look.description,
    palette: look.palette,
    image_path: imagePath,
  });
  if (insErr) {
    return NextResponse.json({ error: "Could not save look" }, { status: 500 });
  }

  // Best-effort "Shop the Look" for the new look. Falls back to keyword matching
  // in the UI when catalogue matching is unavailable, so failures are non-fatal.
  try {
    const singleContent = {
      colors: row.colors ?? { best: [], avoid: [] },
      looks: [look],
    } as unknown as ReportContent;
    const matched = await matchLookItems(profile, singleContent);
    const items = matched[0];
    if (items?.length) {
      const lookItems =
        (row.look_items as Record<number, ShoppingItem[]> | null) ?? {};
      lookItems[newIndex] = items;
      await admin
        .from("reports")
        .update({ look_items: lookItems })
        .eq("id", reportId);
    }
  } catch {
    // Non-fatal — keyword fallback covers Shop the Look.
  }

  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "look_extra",
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

  const { data: signedLook } = await admin.storage
    .from("assets")
    .createSignedUrl(imagePath, SIGNED_TTL);

  return NextResponse.json(
    {
      ok: true,
      balance,
      look: {
        ...look,
        image: signedLook?.signedUrl ? signedAssetProxyUrl(imagePath) : null,
      },
    },
    { status: 201 },
  );
}
