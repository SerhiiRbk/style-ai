import "server-only";
import { after } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  assembleReport,
  HAIR_GEN_LIMIT,
  PREMIUM_GROOMING_GEN_LIMIT,
  hairGenerationPending,
  premiumGroomingPending,
  isMockShopping,
  mockShopping,
  type EyewearRec,
  type FacialHairRec,
  type HairRec,
  type ReportGenerationState,
  type ShoppingItem,
  type StyleReport,
  type Tier,
} from "@/lib/report";
import { getReport as getMockReport, saveReport } from "@/lib/store";
import {
  generateReportContent,
  generateLookImage,
  generateHairImage,
  generateFacialHairImage,
  generateEyewearImage,
  type PhotoInput,
} from "@/lib/ai/pipeline";
import { capsuleMatrix, facialHairFor, premiumEyewearPicks } from "@/lib/style-extras";
import {
  enrichLookItems,
  enrichShoppingImages,
  lookItemsNeedRefresh,
  matchShopping,
  matchLookItems,
} from "@/lib/data/catalog";
import type { Intake, ReportContent, StyleProfile } from "@/lib/style-profile";

type CreateInput = {
  intake: Intake;
  tier: Tier;
  userId?: string | null;
  photoPaths?: { role: string; path: string }[];
};

/** Whether the report or its hair/look/capsule images are still being generated. */
export function reportGenerationState(
  row: {
    status?: string | null;
    tier?: string | null;
    capsule_images?: (string | null)[] | null;
    hair?: { recommend: HairRec[]; avoid: HairRec[] } | null;
    facial_hair?: FacialHairRec[] | null;
    eyewear?: EyewearRec[] | null;
  },
  looks: { image_path?: string | null }[] | null,
  opts?: { hasReferencePhoto?: boolean },
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

  const hair = row.hair ?? { recommend: [], avoid: [] };
  const lookRows = looks ?? [];
  const looksStarted = lookRows.some((l) => l.image_path);
  const hairPending =
    opts?.hasReferencePhoto === true &&
    !looksStarted &&
    hairGenerationPending(hair);

  const groomingPending =
    row.tier === "premium" &&
    opts?.hasReferencePhoto === true &&
    !looksStarted &&
    !hairPending &&
    premiumGroomingPending(row.facial_hair, row.eyewear);

  const imagesPending =
    lookRows.length > 0 && lookRows.some((l) => !l.image_path);

  const needsCapsule = row.tier === "lookbook" || row.tier === "premium";
  const capsulePaths = row.capsule_images ?? [];
  const capsulePending =
    needsCapsule && capsulePaths.filter(Boolean).length === 0;

  if (hairPending) {
    return { status, pending: true, phase: "hair" };
  }
  if (groomingPending) {
    return { status, pending: true, phase: "grooming" };
  }
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

const HAIR_GEN_DELAY_MS = 400;

/** Personalized hairstyle headshots — runs before look images in `after()`. */
async function generateHairImages(input: ImageJobInput) {
  const admin = createAdminSupabase();
  const { reportId, userId, profile, content, photos } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;
  if (!referenceImageUrl) return;

  const hair: { recommend: HairRec[]; avoid: HairRec[] } = {
    recommend: content.hair.recommend.map((h) => ({ ...h })),
    avoid: content.hair.avoid.map((h) => ({ ...h })),
  };

  type Slot = { list: "recommend" | "avoid"; index: number };
  const slots: Slot[] = [];
  for (let i = 0; i < Math.min(HAIR_GEN_LIMIT, hair.recommend.length); i++) {
    slots.push({ list: "recommend", index: i });
  }
  for (let i = 0; i < Math.min(HAIR_GEN_LIMIT, hair.avoid.length); i++) {
    slots.push({ list: "avoid", index: i });
  }

  for (const { list, index } of slots) {
    const item = hair[list][index]!;
    const img = await generateHairImage({
      profile,
      hair: item,
      recommend: list === "recommend",
      referenceImageUrl,
    });
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${userId}/${reportId}/hair-${list}-${index}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, {
          contentType: img.mediaType,
          upsert: true,
        });
      if (!upErr) {
        hair[list][index] = { ...item, imagePath: path };
        await admin.from("reports").update({ hair }).eq("id", reportId);
      }
    }
    await new Promise((r) => setTimeout(r, HAIR_GEN_DELAY_MS));
  }
}

/** Premium facial-hair & eyewear headshots — after hair, before look images. */
async function generatePremiumGroomingImages(input: ImageJobInput) {
  if (input.tier !== "premium") return;

  const admin = createAdminSupabase();
  const { reportId, userId, profile, photos } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;
  if (!referenceImageUrl) return;

  const { data: row } = await admin
    .from("reports")
    .select("facial_hair, eyewear")
    .eq("id", reportId)
    .single();

  const facialHair: FacialHairRec[] =
    (row?.facial_hair as FacialHairRec[] | null) ??
    facialHairFor(profile).slice(0, PREMIUM_GROOMING_GEN_LIMIT);
  const eyewear: EyewearRec[] =
    (row?.eyewear as EyewearRec[] | null) ??
    premiumEyewearPicks(profile).map((f) => ({
      name: f.name,
      why: f.why,
      shape: f.shape,
    }));

  if (!row?.facial_hair || !row?.eyewear) {
    await admin
      .from("reports")
      .update({ facial_hair: facialHair, eyewear })
      .eq("id", reportId);
  }

  for (let i = 0; i < facialHair.length; i++) {
    const item = facialHair[i]!;
    if (item.imagePath) continue;
    const img = await generateFacialHairImage({
      profile,
      style: item,
      referenceImageUrl,
    });
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${userId}/${reportId}/facial-hair-${i}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
      if (!upErr) {
        facialHair[i] = { ...item, imagePath: path };
        await admin.from("reports").update({ facial_hair: facialHair }).eq("id", reportId);
      }
    }
    await new Promise((r) => setTimeout(r, HAIR_GEN_DELAY_MS));
  }

  for (let i = 0; i < eyewear.length; i++) {
    const item = eyewear[i]!;
    if (item.imagePath) continue;
    const img = await generateEyewearImage({
      profile,
      frame: item,
      referenceImageUrl,
    });
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${userId}/${reportId}/eyewear-${i}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
      if (!upErr) {
        eyewear[i] = { ...item, imagePath: path };
        await admin.from("reports").update({ eyewear }).eq("id", reportId);
      }
    }
    await new Promise((r) => setTimeout(r, HAIR_GEN_DELAY_MS));
  }
}

/** Look + capsule photos — slow; runs after the HTTP response via `after()`. */
async function generateReportImages(input: ImageJobInput) {
  await generateHairImages(input);
  await generatePremiumGroomingImages(input);

  const admin = createAdminSupabase();
  const { reportId, userId, tier, profile, content, photos, shopping } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;

  const { data: lookRows } = await admin
    .from("looks")
    .select("id")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  for (let i = 0; i < content.looks.length; i++) {
    const l = content.looks[i];
    const rowId = lookRows?.[i]?.id;
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
    if (rowId) {
      await admin.from("looks").update({ image_path: imagePath }).eq("id", rowId);
    }
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

    // Free tier is a gated preview — a single look (vs. 3 for paid tiers).
    const FREE_LOOK_COUNT = 1;
    const lookCount = tier === "free" ? FREE_LOOK_COUNT : 3;
    const { profile, content } = await generateReportContent(
      intake,
      photos,
      lookCount,
    );
    // Belt-and-suspenders: enforce the look cap even if the model (or the mock
    // fallback) returns more than requested.
    if (tier === "free" && content.looks.length > FREE_LOOK_COUNT) {
      content.looks = content.looks.slice(0, FREE_LOOK_COUNT);
    }
    const shopping = await matchShopping(profile, content);
    if (isMockShopping(shopping)) {
      console.error(
        "[report] shopping used demo fallback — verify catalog seed, AI keys, and match_products RPC (migration 0005)",
      );
    }
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
        ...(tier === "premium"
          ? {
              facial_hair: facialHairFor(profile).slice(
                0,
                PREMIUM_GROOMING_GEN_LIMIT,
              ),
              eyewear: premiumEyewearPicks(profile).map((f) => ({
                name: f.name,
                why: f.why,
                shape: f.shape,
              })),
            }
          : {}),
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

export type ReportView = {
  report: StyleReport;
  isOwner: boolean;
  isPublic: boolean;
};

/** Sign private `assets` bucket paths for report display (10 min). */
async function signAssetPaths(
  paths: (string | null | undefined)[],
  opts?: { useAdmin?: boolean },
): Promise<(string | undefined)[]> {
  const signer =
    opts?.useAdmin && hasSupabaseAdmin
      ? createAdminSupabase()
      : hasSupabaseAdmin
        ? createAdminSupabase()
        : await createServerSupabase();
  return Promise.all(
    paths.map(async (path) => {
      if (!path) return undefined;
      const { data, error } = await signer.storage
        .from("assets")
        .createSignedUrl(path, 600);
      if (error || !data?.signedUrl) return undefined;
      return data.signedUrl;
    }),
  );
}

/** Sign hair item storage paths and attach as `image` URLs. */
async function signHairItems(
  hair: {
    recommend: HairRec[];
    avoid: HairRec[];
  },
  signOpts?: { useAdmin?: boolean },
): Promise<{ recommend: HairRec[]; avoid: HairRec[] }> {
  const signOne = async (h: HairRec): Promise<HairRec> => {
    if (!h.imagePath) return h;
    const [signed] = await signAssetPaths([h.imagePath], signOpts);
    return signed ? { ...h, image: signed } : h;
  };
  return {
    recommend: await Promise.all(hair.recommend.map(signOne)),
    avoid: await Promise.all(hair.avoid.map(signOne)),
  };
}

/** Sign grooming preview storage paths and attach as `image` URLs. */
async function signGroomingItems<T extends { imagePath?: string; image?: string }>(
  items: T[],
  signOpts?: { useAdmin?: boolean },
): Promise<T[]> {
  const signOne = async (item: T): Promise<T> => {
    if (!item.imagePath) return item;
    const [signed] = await signAssetPaths([item.imagePath], signOpts);
    return signed ? { ...item, image: signed } : item;
  };
  return Promise.all(items.map(signOne));
}

function hairHasGeneratedImages(hair: {
  recommend: HairRec[];
  avoid: HairRec[];
}): boolean {
  return [...hair.recommend, ...hair.avoid].some((h) => Boolean(h.imagePath));
}

/** Fetch a report for the owner or, when enabled, anyone with the link. */
export async function getReportView(id: string): Promise<ReportView | null> {
  if (id === "demo") {
    const report = getMockReport("demo");
    if (!report) return null;
    return { report, isOwner: false, isPublic: true };
  }
  if (!hasSupabase) {
    const report = getMockReport(id);
    if (!report) return null;
    return { report, isOwner: false, isPublic: false };
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: row } = await sb.from("reports").select("*").eq("id", id).single();
  if (!row) return null;

  const isOwner = Boolean(user && row.user_id === user.id);
  const isPublic = Boolean(row.is_public);
  if (!isOwner && !isPublic) return null;

  const signOpts = !isOwner && isPublic ? { useAdmin: true as const } : undefined;

  const { data: looks } = await sb
    .from("looks")
    .select("*")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  const lookImages = await signAssetPaths(
    (looks ?? []).map((l) => l.image_path as string | null | undefined),
    signOpts,
  );

  const capsulePaths = (row.capsule_images as (string | null)[] | null) ?? [];
  const capsuleImages = await signAssetPaths(capsulePaths, signOpts);

  const rawHair = (row.hair as { recommend: HairRec[]; avoid: HairRec[] } | null) ?? {
    recommend: [],
    avoid: [],
  };

  let hasReferencePhoto = false;
  if (isOwner) {
    const { data: userPhotos } = await sb
      .from("photos")
      .select("id")
      .eq("user_id", row.user_id)
      .limit(1);
    hasReferencePhoto = (userPhotos?.length ?? 0) > 0;
  } else {
    hasReferencePhoto =
      (looks ?? []).some((l) => l.image_path) || hairHasGeneratedImages(rawHair);
  }

  const signedHair = await signHairItems(rawHair, signOpts);

  const rawFacialHair =
    (row.facial_hair as FacialHairRec[] | null) ?? undefined;
  const rawEyewear = (row.eyewear as EyewearRec[] | null) ?? undefined;
  const signedFacialHair = rawFacialHair
    ? await signGroomingItems(rawFacialHair, signOpts)
    : undefined;
  const signedEyewear = rawEyewear
    ? await signGroomingItems(rawEyewear, signOpts)
    : undefined;

  const content: ReportContent = {
    headline: row.headline ?? "",
    summary: row.summary ?? "",
    colors: row.colors ?? { best: [], avoid: [] },
    hair: signedHair,
    silhouette: row.silhouette ?? { fit: "", rules: [] },
    looks: (looks ?? []).map((l) => ({
      context: l.context ?? "",
      title: l.title ?? "",
      description: l.description ?? "",
      palette: l.palette ?? [],
    })),
    doList: row.do_list ?? [],
    dontList: row.dont_list ?? [],
  };

  let shopping = (row.shopping as ShoppingItem[] | null) ?? [];
  let lookItems =
    (row.look_items as Record<number, ShoppingItem[]> | null) ?? undefined;

  if (isOwner && hasSupabaseAdmin && row.profile) {
    if (isMockShopping(shopping)) {
      const matched = await matchShopping(row.profile, content);
      if (!isMockShopping(matched)) {
        shopping = matched;
        const admin = createAdminSupabase();
        void admin.from("reports").update({ shopping }).eq("id", id);
      }
    }
    if (lookItemsNeedRefresh(lookItems)) {
      const matchedLooks = await matchLookItems(row.profile, content);
      if (Object.keys(matchedLooks).length) {
        lookItems = matchedLooks;
        const admin = createAdminSupabase();
        void admin.from("reports").update({ look_items: matchedLooks }).eq("id", id);
      }
    }
  }

  shopping = await enrichShoppingImages(shopping);
  if (lookItems && Object.keys(lookItems).length) {
    lookItems = await enrichLookItems(lookItems);
  }

  const generation = reportGenerationState(
    {
      status: row.status,
      tier: row.tier,
      capsule_images: row.capsule_images as (string | null)[] | null,
      hair: rawHair,
      facial_hair: rawFacialHair ?? null,
      eyewear: rawEyewear ?? null,
    },
    looks ?? [],
    { hasReferencePhoto },
  );

  const report = assembleReport({
    id: row.id,
    createdAt: row.created_at,
    intake: row.intake,
    tier: row.tier,
    profile: row.profile,
    generation,
    personalizedHairPending:
      hasReferencePhoto &&
      !(looks ?? []).some((l) => l.image_path) &&
      hairGenerationPending(rawHair),
    facialHair: signedFacialHair,
    eyewear: signedEyewear,
    content,
    shopping: shopping.length ? shopping : mockShopping(),
    lookImages,
    capsuleImages,
    lookItems,
  });

  return { report, isOwner, isPublic };
}

/** Fetch report content only — owner or public link. Falls back to mock store. */
export async function getReportById(id: string): Promise<StyleReport | null> {
  const view = await getReportView(id);
  return view?.report ?? null;
}
