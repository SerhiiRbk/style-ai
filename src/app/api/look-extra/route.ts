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
import { getReportReferencePhotos } from "@/lib/photo-tryon";
import { translateReportParts } from "@/lib/ai/translate-report";
import { normalizeLanguage } from "@/lib/languages";
import { ensureReportLookSet } from "@/lib/data/report-look-sets";

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

  const [{ data: row }, { data: intakeRow }] = await Promise.all([
    admin
      .from("reports")
      .select("id, user_id, profile, colors, look_items, created_at, language")
      .eq("id", reportId)
      .single(),
    admin
      .from("report_intake")
      .select("intake")
      .eq("report_id", reportId)
      .maybeSingle(),
  ]);
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const profile = row.profile as StyleProfile | null;
  const intake = (intakeRow?.intake as Intake | null) ?? null;
  if (!profile || !intake) {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }

  // Honour the report's current language (may differ from the original intake
  // if the owner changed it after generation).
  const language = normalizeLanguage(
    (row as { language?: string | null }).language ?? intake.language,
  );
  intake.language = language;

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

  // Reference photos from when this report was created — not the user's latest upload.
  const refs = await getReportReferencePhotos(
    admin,
    user.id,
    row.created_at as string,
    reportId,
  );
  if (!refs.ok) {
    return NextResponse.json({ error: refs.error }, { status: 422 });
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
    occasionId: ctx.id,
    boldness: profile.boldness,
  });

  const img = await generateLookImage({
    profile,
    look,
    referenceImageUrl: refs.fullUrl,
    faceReferenceImageUrl: refs.faceUrl,
    profileReferenceImageUrl: refs.profileUrl,
    occasionId: ctx.id,
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

  const lookRow: {
    report_id: string;
    user_id: string;
    idx: number;
    context: string;
    title: string;
    description: string;
    palette: string[];
    image_path: string;
    items?: { garment: string; color?: string | null }[];
  } = {
    report_id: reportId,
    user_id: user.id,
    idx: newIndex,
    context: look.context,
    title: look.title,
    description: look.description,
    palette: look.palette,
    image_path: imagePath,
  };
  if (look.items?.length) lookRow.items = look.items;
  let { error: insErr } = await admin.from("looks").insert(lookRow);
  // Pre-0048 DB has no `items` column — retry without it (matching falls back
  // to prose decomposition for this look, same as before the migration).
  if (insErr && lookRow.items && /items/.test(insErr.message)) {
    delete lookRow.items;
    ({ error: insErr } = await admin.from("looks").insert(lookRow));
  }
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
    let items = matched[0];
    if (items?.length && language !== "en") {
      const t = await translateReportParts({ shopping: items }, language);
      items = t.shopping ?? items;
    }
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

  await ensureReportLookSet(admin, { reportId, userId: user.id }).catch((err) => {
    console.error("[look-set] promote extra report look failed", reportId, err);
  });

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
