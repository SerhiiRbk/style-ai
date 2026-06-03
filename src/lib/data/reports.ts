import "server-only";
import { after } from "next/server";
import { hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  assembleReport,
  mockShopping,
  type ReportGenerationState,
  type ShoppingItem,
  type StyleReport,
  type Tier,
} from "@/lib/report";
import { getReport as getMockReport, saveReport } from "@/lib/store";
import {
  generateReportContent,
  generateLookImage,
  type PhotoInput,
} from "@/lib/ai/pipeline";
import { capsuleMatrix } from "@/lib/style-extras";
import { matchShopping, matchLookItems } from "@/lib/data/catalog";
import type { Intake, ReportContent, StyleProfile } from "@/lib/style-profile";

type CreateInput = {
  intake: Intake;
  tier: Tier;
  userId?: string | null;
  photoPaths?: { role: string; path: string }[];
};

/** Whether the report or its look/capsule images are still being generated. */
export function reportGenerationState(
  row: {
    status?: string | null;
    tier?: string | null;
    capsule_images?: (string | null)[] | null;
  },
  looks: { image_path?: string | null }[] | null,
): ReportGenerationState {
  const status =
    row.status === "processing" || row.status === "failed"
      ? row.status
      : "ready";

  if (status === "processing") {
    return { status, pending: true, phase: "report" };
  }
  if (status === "failed") {
    return { status, pending: false, phase: null };
  }

  const lookRows = looks ?? [];
  const imagesPending =
    lookRows.length > 0 && lookRows.some((l) => !l.image_path);

  const needsCapsule = row.tier === "lookbook" || row.tier === "premium";
  const capsulePaths = row.capsule_images ?? [];
  const capsulePending =
    needsCapsule && capsulePaths.filter(Boolean).length === 0;

  if (imagesPending) {
    return { status, pending: true, phase: "images" };
  }
  if (capsulePending) {
    return { status, pending: true, phase: "capsule" };
  }
  return { status, pending: false, phase: null };
}

type ImageJobInput = {
  reportId: string;
  userId: string;
  tier: Tier;
  profile: StyleProfile;
  content: ReportContent;
  photos: PhotoInput[];
  shopping: ShoppingItem[];
};

/** Look + capsule photos — slow; runs after the HTTP response via `after()`. */
async function generateReportImages(input: ImageJobInput) {
  const admin = createAdminSupabase();
  const { reportId, userId, tier, profile, content, photos, shopping } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;

  for (let i = 0; i < content.looks.length; i++) {
    const l = content.looks[i];
    let imagePath: string | null = null;
    const img = await generateLookImage({
      profile,
      look: l,
      referenceImageUrl,
    });
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${userId}/${reportId}/look-${i}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, {
          contentType: img.mediaType,
          upsert: true,
        });
      if (!upErr) imagePath = path;
    }
    await admin
      .from("looks")
      .update({ image_path: imagePath })
      .eq("report_id", reportId)
      .eq("title", l.title);
  }

  if (tier === "lookbook" || tier === "premium") {
    const colorByTitle = new Map(shopping.map((s) => [s.title, s.color]));
    const matrix = capsuleMatrix(shopping);
    const capsulePaths = await Promise.all(
      matrix.map(async (combo, i) => {
        const img = await generateLookImage({
          profile,
          look: {
            title: combo.context,
            description: combo.pieces.join(", "),
            palette: combo.pieces
              .map((p) => colorByTitle.get(p))
              .filter((c): c is string => Boolean(c)),
          },
          referenceImageUrl,
        });
        if (!img) return null;
        const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
        const path = `${userId}/${reportId}/capsule-${i}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("assets")
          .upload(path, img.bytes, {
            contentType: img.mediaType,
            upsert: true,
          });
        return upErr ? null : path;
      }),
    );
    await admin
      .from("reports")
      .update({ capsule_images: capsulePaths })
      .eq("id", reportId);
  }
}

/** Create a report, run the pipeline, persist. Live mode if Supabase configured. */
export async function createAndRunReport(input: CreateInput): Promise<string> {
  const { intake, tier, userId } = input;

  // Demo mode — deterministic mock, in-memory store.
  if (!hasSupabaseAdmin || !userId) {
    const report = (await import("@/lib/report")).generateReport(intake, tier);
    saveReport(report);
    return report.id;
  }

  const admin = createAdminSupabase();

  // Record biometric-processing consent (GDPR Art. 9).
  await admin
    .from("consents")
    .insert({ user_id: userId, type: "biometric", version: "1.0" });

  // Persist uploaded photo references (reused later for virtual try-on).
  if (input.photoPaths?.length) {
    await admin.from("photos").insert(
      input.photoPaths.map((p) => ({
        user_id: userId,
        role: p.role,
        storage_path: p.path,
      })),
    );
  }

  const { data: created, error } = await admin
    .from("reports")
    .insert({ user_id: userId, tier, status: "processing", intake })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "insert failed");
  const reportId = created.id as string;

  try {
    // Sign photo URLs so the vision model can read them.
    const photos: PhotoInput[] = [];
    for (const p of input.photoPaths ?? []) {
      const { data } = await admin.storage
        .from("photos")
        .createSignedUrl(p.path, 600);
      if (data?.signedUrl) photos.push({ role: p.role, url: data.signedUrl });
    }

    const { profile, content } = await generateReportContent(intake, photos);
    const shopping = await matchShopping(profile, content);
    const lookItems = await matchLookItems(profile, content);

    await admin
      .from("reports")
      .update({
        status: "ready",
        profile,
        headline: content.headline,
        summary: content.summary,
        colors: content.colors,
        hair: content.hair,
        silhouette: content.silhouette,
        shopping,
        do_list: content.doList,
        dont_list: content.dontList,
      })
      .eq("id", reportId);

    // Persisted separately so an older schema missing the column never fails the
    // whole report — per-look "Shop the Look" just falls back to keyword matching.
    if (Object.keys(lookItems).length) {
      await admin
        .from("reports")
        .update({ look_items: lookItems })
        .eq("id", reportId);
    }

    await admin.from("looks").insert(
      content.looks.map((l) => ({
        report_id: reportId,
        user_id: userId,
        context: l.context,
        title: l.title,
        description: l.description,
        palette: l.palette,
        image_path: null,
      })),
    );

    // Image generation is the slowest step (3+ model calls). Run after the
    // response so the client is not left waiting on a single long HTTP request.
    const imageJob: ImageJobInput = {
      reportId,
      userId,
      tier,
      profile,
      content,
      photos,
      shopping,
    };
    after(() =>
      generateReportImages(imageJob).catch((err) => {
        console.error("[report images]", err);
      }),
    );
  } catch (e) {
    await admin.from("reports").update({ status: "failed" }).eq("id", reportId);
    throw e;
  }

  return reportId;
}

/** Fetch a report (RLS-scoped to the signed-in user). Falls back to mock store. */
export async function getReportById(id: string): Promise<StyleReport | null> {
  if (!hasSupabaseAdmin) return getMockReport(id) ?? null;
  if (id === "demo") return getMockReport("demo") ?? null;

  const sb = await createServerSupabase();
  const { data: row } = await sb.from("reports").select("*").eq("id", id).single();
  if (!row) return null;

  const { data: looks } = await sb
    .from("looks")
    .select("*")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  // Sign private generated-look images (10 min) for display.
  const lookImages = await Promise.all(
    (looks ?? []).map(async (l) => {
      if (!l.image_path) return undefined;
      const { data } = await sb.storage
        .from("assets")
        .createSignedUrl(l.image_path, 600);
      return data?.signedUrl ?? undefined;
    }),
  );

  // Sign capsule "week of outfits" photos (ordered to match capsuleMatrix()).
  const capsulePaths = (row.capsule_images as (string | null)[] | null) ?? [];
  const capsuleImages = await Promise.all(
    capsulePaths.map(async (p) => {
      if (!p) return undefined;
      const { data } = await sb.storage.from("assets").createSignedUrl(p, 600);
      return data?.signedUrl ?? undefined;
    }),
  );

  const generation = reportGenerationState(
    {
      status: row.status,
      tier: row.tier,
      capsule_images: row.capsule_images as (string | null)[] | null,
    },
    looks ?? [],
  );

  return assembleReport({
    id: row.id,
    createdAt: row.created_at,
    intake: row.intake,
    tier: row.tier,
    profile: row.profile,
    generation,
    content: {
      headline: row.headline ?? "",
      summary: row.summary ?? "",
      colors: row.colors ?? { best: [], avoid: [] },
      hair: row.hair ?? { recommend: [], avoid: [] },
      silhouette: row.silhouette ?? { fit: "", rules: [] },
      looks: (looks ?? []).map((l) => ({
        context: l.context ?? "",
        title: l.title ?? "",
        description: l.description ?? "",
        palette: l.palette ?? [],
      })),
      doList: row.do_list ?? [],
      dontList: row.dont_list ?? [],
    },
    shopping: row.shopping ?? mockShopping(),
    lookImages,
    capsuleImages,
    lookItems:
      (row.look_items as Record<number, ShoppingItem[]> | null) ?? undefined,
  });
}
