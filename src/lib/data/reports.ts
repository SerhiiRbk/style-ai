import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  assembleReport,
  mockShopping,
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
import { matchShopping } from "@/lib/data/catalog";
import type { Intake } from "@/lib/style-profile";

type CreateInput = {
  intake: Intake;
  tier: Tier;
  userId?: string | null;
  photoPaths?: { role: string; path: string }[];
};

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

    const referenceImageUrl =
      photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;

    const lookRows = await Promise.all(
      content.looks.map(async (l, i) => {
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
        return {
          report_id: reportId,
          user_id: userId,
          context: l.context,
          title: l.title,
          description: l.description,
          palette: l.palette,
          image_path: imagePath,
        };
      }),
    );

    await admin.from("looks").insert(lookRows);

    // Capsule "week of outfits" photos — one per outfit-matrix combo, on the
    // same person. Gated to premium tiers since each combo costs an image gen.
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

  return assembleReport({
    id: row.id,
    createdAt: row.created_at,
    intake: row.intake,
    tier: row.tier,
    profile: row.profile,
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
  });
}
