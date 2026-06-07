import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env, hasSupabaseAdmin, hasAI } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { generateLookImage } from "@/lib/ai/pipeline";
import { matchLookItems } from "@/lib/data/catalog";
import type { ReportContent, StyleProfile } from "@/lib/style-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Constant-time comparison against CATALOG_IMPORT_KEY. */
function keyMatches(provided: string | null): boolean {
  const secret = env.catalogImportKey;
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

/**
 * Maintenance: regenerate ONLY the looks of a report — re-render each look photo
 * on the owner's reference image and re-run the per-look catalogue match
 * ("Shop the Look") so improved colour scoring takes effect. Does not touch
 * hair, grooming, capsule, or the main shopping list.
 *
 * Auth: shared secret in `x-api-key` (or `Authorization: Bearer <key>`),
 * read from CATALOG_IMPORT_KEY. Body: { reportId, images?, match? } (both default true).
 */
export async function POST(request: Request) {
  if (!keyMatches(readApiKey(request))) {
    return NextResponse.json(
      { error: "Invalid or missing API key." },
      { status: 401 },
    );
  }
  if (!hasSupabaseAdmin || !hasAI) {
    return NextResponse.json(
      { error: "Server not configured (Supabase service role + AI key required)." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const reportId: string | undefined = body?.reportId;
  const doImages: boolean = body?.images !== false;
  const doMatch: boolean = body?.match !== false;
  if (!reportId) {
    return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data: row } = await admin
    .from("reports")
    .select("id, user_id, profile, colors, look_items")
    .eq("id", reportId)
    .single();
  if (!row) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const profile = row.profile as StyleProfile | null;
  if (!profile) {
    return NextResponse.json({ error: "Report has no profile" }, { status: 409 });
  }

  const { data: lookRows } = await admin
    .from("looks")
    .select("id, context, title, description, palette")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  const looks = lookRows ?? [];
  if (!looks.length) {
    return NextResponse.json({ error: "Report has no looks" }, { status: 409 });
  }

  const content = {
    colors: row.colors ?? { best: [], avoid: [] },
    looks: looks.map((l) => ({
      context: l.context ?? "",
      title: l.title ?? "",
      description: l.description ?? "",
      palette: (l.palette as string[] | null) ?? [],
    })),
  } as unknown as ReportContent;

  // Reference photo — keeps identity consistent across the re-rendered looks.
  let referenceImageUrl: string | undefined;
  if (doImages) {
    const { data: photos } = await admin
      .from("photos")
      .select("storage_path, role, created_at")
      .eq("user_id", row.user_id)
      .order("created_at", { ascending: false })
      .limit(20);
    const chosen = photos?.find((p) => p.role === "full") ?? photos?.[0] ?? null;
    if (chosen) {
      const { data: signed } = await admin.storage
        .from("photos")
        .createSignedUrl(chosen.storage_path, 600);
      referenceImageUrl = signed?.signedUrl ?? undefined;
    }
  }

  let regeneratedImages = 0;
  if (doImages) {
    for (let i = 0; i < content.looks.length; i++) {
      const look = content.looks[i]!;
      const rowId = looks[i]!.id as string;
      const img = await generateLookImage({ profile, look, referenceImageUrl });
      if (!img) continue;
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${row.user_id}/${reportId}/look-${i}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
      if (upErr) continue;
      await admin.from("looks").update({ image_path: path }).eq("id", rowId);
      regeneratedImages++;
    }
  }

  let matchedLookIndexes: number[] = [];
  if (doMatch) {
    const matched = await matchLookItems(profile, content);
    if (Object.keys(matched).length) {
      await admin
        .from("reports")
        .update({ look_items: matched })
        .eq("id", reportId);
      matchedLookIndexes = Object.keys(matched).map(Number);
    }
  }

  return NextResponse.json({
    ok: true,
    reportId,
    looks: content.looks.length,
    regeneratedImages,
    matchedLookIndexes,
  });
}
