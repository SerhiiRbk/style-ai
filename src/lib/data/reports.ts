import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { isDemoReportId } from "@/lib/demo-report";
import { LEGAL } from "@/lib/legal";
import {
  recordBiometricConsent,
  revokeBiometricConsentIfIdle,
} from "@/lib/data/consent";
import { signedAssetProxyUrl, signedAssetProxyUrls } from "@/lib/asset-token";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  parseGarmentsJson,
  type SavedOutfitTryOn,
} from "@/lib/outfit-tryon";
import {
  assembleReport,
  clampHairForTier,
  HAIR_AVOID_GEN_LIMIT,
  canShareReport,
  hairRecommendGenLimit,
  lookCountForTier,
  PREMIUM_ACCESSORY_GEN_LIMIT,
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  hairGenerationPending,
  premiumGroomingPending,
  isMockShopping,
  isStaleShoppingCopy,
  mockShopping,
  type AccessoryRec,
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
  generateAccessoryImage,
  type PhotoInput,
} from "@/lib/ai/pipeline";
import {
  accessoryPicksFor,
  capsuleMatrix,
  facialHairFor,
  premiumEyewearPicks,
} from "@/lib/style-extras";
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
  /** Pre-assigned report id — used when credits are spent before insert. */
  reportId?: string;
  photoPaths?: { role: string; path: string }[];
  /** Explicit Art. 9 consent — required when photoPaths are present. */
  biometricConsent?: boolean;
  consentVersion?: string;
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
    accessories?: AccessoryRec[] | null;
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
    hairGenerationPending(hair, row.tier as Tier | undefined);

  const groomingPending =
    row.tier === "premium" &&
    opts?.hasReferencePhoto === true &&
    !looksStarted &&
    !hairPending &&
    premiumGroomingPending(row.facial_hair, row.eyewear, row.accessories);

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
  const { reportId, userId, tier, profile, content, photos } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;
  if (!referenceImageUrl) return;

  const dualAngle = tier === "lookbook" || tier === "premium";
  const recommendLimit = hairRecommendGenLimit(tier);
  const avoidLimit = HAIR_AVOID_GEN_LIMIT;

  const hair: { recommend: HairRec[]; avoid: HairRec[] } = {
    recommend: content.hair.recommend.map((h) => ({ ...h })),
    avoid: content.hair.avoid.map((h) => ({ ...h })),
  };

  type Slot = { list: "recommend" | "avoid"; index: number; angle?: "front" | "three_quarter" };
  const slots: Slot[] = [];
  for (let i = 0; i < Math.min(recommendLimit, hair.recommend.length); i++) {
    slots.push({ list: "recommend", index: i, angle: "front" });
    if (dualAngle) {
      slots.push({ list: "recommend", index: i, angle: "three_quarter" });
    }
  }
  for (let i = 0; i < Math.min(avoidLimit, hair.avoid.length); i++) {
    slots.push({ list: "avoid", index: i, angle: "front" });
  }

  for (const { list, index, angle = "front" } of slots) {
    const item = hair[list][index]!;
    const isSide = angle !== "front";
    if (isSide && item.imagePathSide) continue;
    if (!isSide && item.imagePath) continue;

    const img = await generateHairImage({
      profile,
      hair: item,
      recommend: list === "recommend",
      referenceImageUrl,
      angle,
    });
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = isSide
        ? `${userId}/${reportId}/hair-${list}-${index}-side.${ext}`
        : `${userId}/${reportId}/hair-${list}-${index}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, {
          contentType: img.mediaType,
          upsert: true,
        });
      if (!upErr) {
        hair[list][index] = isSide
          ? { ...item, imagePathSide: path }
          : { ...item, imagePath: path };
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
    .select("facial_hair, eyewear, accessories")
    .eq("id", reportId)
    .single();

  const pickFacialHair = () =>
    facialHairFor(profile).slice(0, PREMIUM_FACIAL_HAIR_GEN_LIMIT);
  const pickEyewear = () =>
    premiumEyewearPicks(profile)
      .slice(0, PREMIUM_EYEWEAR_GEN_LIMIT)
      .map((f) => ({
        name: f.name,
        why: f.why,
        shape: f.shape,
        kind: f.kind,
      }));
  const pickAccessories = () =>
    accessoryPicksFor(profile)
      .slice(0, PREMIUM_ACCESSORY_GEN_LIMIT)
      .map((a) => ({ name: a.name, why: a.why, kind: a.kind }));

  const mergeByName = <T extends { name: string }>(
    existing: T[] | null | undefined,
    picks: T[],
  ): T[] => {
    if (!existing?.length) return picks;
    const byName = new Map(existing.map((item) => [item.name, item]));
    return picks.map((pick) => byName.get(pick.name) ?? pick);
  };

  const facialHair: FacialHairRec[] = mergeByName(
    row?.facial_hair as FacialHairRec[] | null,
    pickFacialHair(),
  );
  const eyewear: EyewearRec[] = mergeByName(
    row?.eyewear as EyewearRec[] | null,
    pickEyewear(),
  );
  // Accessories are now included by default — but never shrink a report that
  // already bought the extra add-on (length beyond the base limit).
  const existingAccessories = row?.accessories as AccessoryRec[] | null;
  const accessories: AccessoryRec[] =
    existingAccessories && existingAccessories.length > PREMIUM_ACCESSORY_GEN_LIMIT
      ? existingAccessories
      : mergeByName(existingAccessories, pickAccessories());

  const needsSeed =
    !row?.facial_hair ||
    !row?.eyewear ||
    !row?.accessories ||
    (row.facial_hair as FacialHairRec[]).length < PREMIUM_FACIAL_HAIR_GEN_LIMIT ||
    (row.eyewear as EyewearRec[]).length < PREMIUM_EYEWEAR_GEN_LIMIT ||
    (row.accessories as AccessoryRec[]).length < PREMIUM_ACCESSORY_GEN_LIMIT;

  if (needsSeed) {
    await admin
      .from("reports")
      .update({ facial_hair: facialHair, eyewear, accessories })
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

  for (let i = 0; i < accessories.length; i++) {
    const item = accessories[i]!;
    if (item.imagePath) continue;
    const img = await generateAccessoryImage({
      profile,
      accessory: item,
      referenceImageUrl,
    });
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${userId}/${reportId}/accessory-${i}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
      if (!upErr) {
        accessories[i] = { ...item, imagePath: path };
        await admin.from("reports").update({ accessories }).eq("id", reportId);
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

  const hasPhotos = Boolean(input.photoPaths?.length);
  if (hasPhotos) {
    if (!input.biometricConsent || input.consentVersion !== LEGAL.consentVersion) {
      throw new Error(
        "Explicit consent for photo processing is required before generating a report.",
      );
    }
    await recordBiometricConsent(userId);
  }

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
    .insert({
      ...(input.reportId ? { id: input.reportId } : {}),
      user_id: userId,
      tier,
      status: "processing",
      intake,
    })
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

    const lookCount = lookCountForTier(tier);
    const { profile, content } = await generateReportContent(
      intake,
      photos,
      lookCount,
      tier,
    );
    // Belt-and-suspenders: enforce caps even if the model (or mock) returns extra.
    if (content.looks.length > lookCount) {
      content.looks = content.looks.slice(0, lookCount);
    }
    content.hair = clampHairForTier(content.hair, tier);
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
                PREMIUM_FACIAL_HAIR_GEN_LIMIT,
              ),
              eyewear: premiumEyewearPicks(profile)
                .slice(0, PREMIUM_EYEWEAR_GEN_LIMIT)
                .map((f) => ({
                  name: f.name,
                  why: f.why,
                  shape: f.shape,
                  kind: f.kind,
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

/** Map hair storage paths to stable same-origin proxy URLs (no signing I/O). */
function attachHairImages(hair: {
  recommend: HairRec[];
  avoid: HairRec[];
}): { recommend: HairRec[]; avoid: HairRec[] } {
  const mapOne = (h: HairRec): HairRec => ({
    ...h,
    ...(h.imagePath ? { image: signedAssetProxyUrl(h.imagePath) } : {}),
    ...(h.imagePathSide ? { imageSide: signedAssetProxyUrl(h.imagePathSide) } : {}),
  });
  return {
    recommend: hair.recommend.map(mapOne),
    avoid: hair.avoid.map(mapOne),
  };
}

function attachGroomingImages<T extends { imagePath?: string; image?: string }>(
  items: T[],
): T[] {
  return items.map((item) =>
    item.imagePath ? { ...item, image: signedAssetProxyUrl(item.imagePath) } : item,
  );
}

function hairHasGeneratedImages(hair: {
  recommend: HairRec[];
  avoid: HairRec[];
}): boolean {
  return [...hair.recommend, ...hair.avoid].some((h) => Boolean(h.imagePath));
}

/** Owner-only saved catalogue / outfit try-ons linked to this report. */
async function loadSavedOutfitTryons(
  reportId: string,
  userId: string,
): Promise<SavedOutfitTryOn[]> {
  const admin = hasSupabaseAdmin ? createAdminSupabase() : null;
  if (!admin) return [];

  const { data: rows } = await admin
    .from("tryons")
    .select("id, image_path, garments, kind, created_at")
    .eq("report_id", reportId)
    .eq("user_id", userId)
    .eq("status", "ready")
    .not("image_path", "is", null)
    .order("created_at", { ascending: false });

  const outfits: SavedOutfitTryOn[] = [];
  for (const row of rows ?? []) {
    const path = row.image_path as string | null;
    if (!path) continue;
    outfits.push({
      id: row.id as string,
      image: signedAssetProxyUrl(path),
      createdAt: row.created_at as string,
      kind: row.kind === "outfit" ? "outfit" : "product",
      garments: parseGarmentsJson(row.garments),
    });
  }
  return outfits;
}

/**
 * Schedule a catalogue re-match in the background (after the response is sent)
 * when persisted shopping / look-items look stale or mock. Keeps the request
 * path fast: the page renders immediately with what's stored, and the refreshed
 * data lands on the next view. Only runs for the owner with an admin client.
 */
function scheduleMatchRefresh(
  id: string,
  profile: StyleProfile,
  content: ReportContent,
  opts: { needShopping: boolean; needLookItems: boolean },
): void {
  if (!opts.needShopping && !opts.needLookItems) return;
  after(async () => {
    try {
      const admin = createAdminSupabase();
      if (opts.needShopping) {
        const matched = await matchShopping(profile, content);
        if (!isMockShopping(matched)) {
          await admin.from("reports").update({ shopping: matched }).eq("id", id);
        }
      }
      if (opts.needLookItems) {
        const matchedLooks = await matchLookItems(profile, content);
        if (Object.keys(matchedLooks).length) {
          await admin
            .from("reports")
            .update({ look_items: matchedLooks })
            .eq("id", id);
        }
      }
    } catch (err) {
      console.error("[report match refresh]", err);
    }
  });
}

/**
 * Fetch a report for the owner or, when enabled, anyone with the link.
 * Pass `scheduleRefresh: false` from Route Handlers (e.g. PDF export) to skip
 * catalogue backfill scheduling via `after()`.
 */
async function fetchReportView(
  id: string,
  opts?: { scheduleRefresh?: boolean },
): Promise<ReportView | null> {
  if (isDemoReportId(id)) {
    const report = getMockReport(id);
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
  const isAdmin = Boolean(user && isAdminEmail(user.email));
  const adminDb = isAdmin && hasSupabaseAdmin ? createAdminSupabase() : null;

  const { data: row } = adminDb
    ? await adminDb.from("reports").select("*").eq("id", id).single()
    : await sb.from("reports").select("*").eq("id", id).single();
  if (!row) return null;

  const isOwner = Boolean(user && row.user_id === user.id);
  const tier = row.tier as Tier;
  const isPublic =
    canShareReport(tier) && Boolean(row.is_public);
  if (!isOwner && !isPublic && !isAdmin) return null;

  const db = isOwner || isAdmin ? (adminDb ?? sb) : sb;

  // Looks + the owner's reference-photo check are independent — run together.
  const [{ data: looks }, ownerPhotoCheck] = await Promise.all([
    db
      .from("looks")
      .select("*")
      .eq("report_id", id)
      .order("created_at", { ascending: true }),
    isOwner || isAdmin
      ? db.from("photos").select("id").eq("user_id", row.user_id).limit(1)
      : Promise.resolve(null),
  ]);

  const capsulePaths = (row.capsule_images as (string | null)[] | null) ?? [];
  const rawHair = (row.hair as { recommend: HairRec[]; avoid: HairRec[] } | null) ?? {
    recommend: [],
    avoid: [],
  };
  const rawFacialHair =
    (row.facial_hair as FacialHairRec[] | null) ?? undefined;
  const rawEyewear = (row.eyewear as EyewearRec[] | null) ?? undefined;
  const rawAccessories =
    (row.accessories as AccessoryRec[] | null) ?? undefined;

  const lookImages = signedAssetProxyUrls(
    (looks ?? []).map((l) => l.image_path as string | null | undefined),
  );
  const capsuleImages = signedAssetProxyUrls(capsulePaths);
  const signedHair = attachHairImages(rawHair);
  const signedFacialHair = rawFacialHair
    ? attachGroomingImages(rawFacialHair)
    : undefined;
  const signedEyewear = rawEyewear
    ? attachGroomingImages(rawEyewear)
    : undefined;
  const signedAccessories = rawAccessories
    ? attachGroomingImages(rawAccessories)
    : undefined;

  const hasReferencePhoto =
    isOwner || isAdmin
      ? (ownerPhotoCheck?.data?.length ?? 0) > 0
      : (looks ?? []).some((l) => l.image_path) || hairHasGeneratedImages(rawHair);

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

  // Catalogue (re-)matching is the dominant cost when it runs (embeddings +
  // pgvector RPCs). It's normally done once at generation; only re-run when the
  // stored data is stale/mock — and do it OFF the request path so the page
  // renders instantly with whatever is stored.
  if (
    opts?.scheduleRefresh !== false &&
    isOwner &&
    hasSupabaseAdmin &&
    row.profile
  ) {
    scheduleMatchRefresh(id, row.profile, content, {
      needShopping: isMockShopping(shopping) || isStaleShoppingCopy(shopping),
      needLookItems: lookItemsNeedRefresh(lookItems),
    });
  }

  // Backfill missing product images (cheap DB lookups) in parallel.
  const [enrichedShopping, enrichedLookItems] = await Promise.all([
    enrichShoppingImages(shopping),
    lookItems && Object.keys(lookItems).length
      ? enrichLookItems(lookItems)
      : Promise.resolve(lookItems),
  ]);
  shopping = enrichedShopping;
  lookItems = enrichedLookItems;

  const outfitTryons =
    isOwner || isAdmin
      ? await loadSavedOutfitTryons(id, row.user_id as string)
      : undefined;

  const generation = reportGenerationState(
    {
      status: row.status,
      tier: row.tier,
      capsule_images: row.capsule_images as (string | null)[] | null,
      hair: rawHair,
      facial_hair: rawFacialHair ?? null,
      eyewear: rawEyewear ?? null,
      accessories: rawAccessories ?? null,
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
      hairGenerationPending(rawHair, row.tier as Tier),
    facialHair: signedFacialHair,
    eyewear: signedEyewear,
    accessories: signedAccessories,
    content,
    shopping: shopping.length ? shopping : mockShopping(),
    lookImages,
    capsuleImages,
    lookItems,
    outfitTryons,
  });

  return { report, isOwner, isPublic };
}

/**
 * Fetch a report for the owner or, when enabled, anyone with the link.
 *
 * Wrapped in React `cache()` so the page component and `generateMetadata`
 * (which both call this in the same request) share a single execution instead
 * of doing all the queries twice.
 */
export const getReportView = cache(fetchReportView);

/** Uncached fetch for Route Handlers (PDF export) — avoids React cache + `after()` side effects. */
export async function getReportViewForDownload(
  id: string,
): Promise<ReportView | null> {
  return fetchReportView(id, { scheduleRefresh: false });
}

/** Fetch report content only — owner or public link. Falls back to mock store. */
export async function getReportById(id: string): Promise<StyleReport | null> {
  const view = await getReportView(id);
  return view?.report ?? null;
}
