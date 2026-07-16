import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getReportOwnerFeedback,
  type ReportOwnerFeedback,
} from "@/lib/data/report-feedback";
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
  PREMIUM_HEADWEAR_GEN_LIMIT,
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  hairGenerationPending,
  premiumGroomingPending,
  isMockShopping,
  isStaleShoppingCopy,
  mockShopping,
  type AccessoryRec,
  type HeadwearRec,
  type EyewearRec,
  type FacialHairRec,
  type HairRec,
  type ReportGenerationState,
  type ReportRecoveryInfo,
  mockStyleProfile,
  type ShoppingItem,
  type StyleReport,
  type Tier,
} from "@/lib/report";
import { getReport as getMockReport, saveReport } from "@/lib/store";
import {
  generateReportContent,
  generateCoverImage,
  generateLookImage,
  generateHairImage,
  generateFacialHairImage,
  generateEyewearImage,
  generateAccessoryImage,
  generateHeadwearImage,
  type PhotoInput,
} from "@/lib/ai/pipeline";
import {
  accessoryPicksFor,
  headwearPicksFor,
  capsuleMatrix,
  facialHairFor,
  premiumEyewearPicks,
  buildExtras,
  FORMAL_CONTEXTS,
  type StyleExtras,
} from "@/lib/style-extras";
import { translateReportParts } from "@/lib/ai/translate-report";
import { normalizeLanguage } from "@/lib/languages";
import {
  enrichLookItems,
  enrichShoppingImages,
  lookItemsNeedRefresh,
  matchShopping,
  matchLookItems,
} from "@/lib/data/catalog";
import {
  getReportCreditRecovery,
  type ReportCreditRecovery,
} from "@/lib/credits";
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
    headwear?: HeadwearRec[] | null;
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
  const hairPending =
    opts?.hasReferencePhoto === true &&
    hairGenerationPending(hair, row.tier as Tier | undefined);

  const groomingPending =
    row.tier === "premium" &&
    opts?.hasReferencePhoto === true &&
    !hairPending &&
    premiumGroomingPending(
      row.facial_hair,
      row.eyewear,
      row.accessories,
      row.headwear,
    );

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

function recoveryFromCredit(
  credit: ReportCreditRecovery,
  opts: {
    intake?: Intake | null;
    hasPhotos: boolean;
    headline?: string | null;
    summary?: string | null;
    colors?: { best: unknown[]; avoid: unknown[] } | null;
    lookCount: number;
  },
): ReportRecoveryInfo {
  return {
    creditCost: credit.creditCost,
    creditsRefunded: credit.wasCharged ? credit.wasRefunded : null,
    saved: {
      questionnaire: Boolean(opts.intake),
      photos: opts.hasPhotos,
      writtenGuidance: Boolean(opts.headline || opts.summary),
      colors: Boolean(opts.colors?.best?.length),
      looks: opts.lookCount,
    },
    canRetry: Boolean(opts.intake),
  };
}

/** Owner-only recovery metadata for a failed report. */
export async function buildReportRecoveryInfo(
  admin: ReturnType<typeof createAdminSupabase>,
  opts: {
    userId: string;
    reportId: string;
    tier: Tier;
    intake?: Intake | null;
    headline?: string | null;
    summary?: string | null;
    colors?: { best: unknown[]; avoid: unknown[] } | null;
    lookCount: number;
    hasPhotos: boolean;
  },
): Promise<ReportRecoveryInfo> {
  const credit = await getReportCreditRecovery(
    admin,
    opts.userId,
    opts.reportId,
    opts.tier,
  );
  return recoveryFromCredit(credit, opts);
}

async function latestPhotoUrlsForUser(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
  /** When set, only consider photos uploaded around this report's creation
   * (with a small slack), not the user's latest upload for another report. */
  reportCreatedAt?: string,
): Promise<PhotoInput[]> {
  const fetchRows = async (useCutoff: boolean) => {
    let query = admin
      .from("photos")
      .select("role, storage_path")
      .eq("user_id", userId);
    if (useCutoff && reportCreatedAt) {
      const cutoff = new Date(
        new Date(reportCreatedAt).getTime() + 120_000,
      ).toISOString();
      query = query.lte("created_at", cutoff);
    }
    const { data } = await query
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  };

  // Prefer the report's contemporaneous photos, but fall back to the user's
  // latest upload when the report has none (older reports, replaced photos) so
  // resumed image generation still runs instead of silently doing nothing.
  let photoRows = await fetchRows(true);
  if (reportCreatedAt && photoRows.length === 0) {
    photoRows = await fetchRows(false);
  }

  const byRole = new Map<string, string>();
  for (const row of photoRows ?? []) {
    const role = row.role as string;
    if (!byRole.has(role)) byRole.set(role, row.storage_path as string);
  }

  const photos: PhotoInput[] = [];
  for (const [role, path] of byRole.entries()) {
    const { data } = await admin.storage
      .from("photos")
      .createSignedUrl(path, 600);
    if (data?.signedUrl) photos.push({ role, url: data.signedUrl });
  }
  return photos;
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

/**
 * Max images generated in parallel. Image generation is the wall-clock
 * bottleneck: doing it sequentially blew past the route's `maxDuration` for
 * richer tiers (premium generates ~35 images), so the background `after()` task
 * was killed mid-way, leaving reports permanently half-generated. Bounded
 * concurrency keeps us well inside the budget without hammering the image API.
 */
const IMAGE_CONCURRENCY = 4;

/**
 * Run `worker` over `items` in sequential chunks of `size`, awaiting each chunk
 * in parallel. `onChunk` runs after every chunk with that chunk's results —
 * used to persist progress incrementally (so a timeout only loses the last
 * in-flight chunk) while keeping writes to shared JSON columns race-free
 * (chunks never overlap).
 */
async function processInChunks<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
  onChunk: (results: R[]) => Promise<void>,
): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    const slice = items.slice(start, start + size);
    const results = await Promise.all(
      slice.map((item, i) => worker(item, start + i)),
    );
    await onChunk(results);
  }
}

/**
 * Run `worker` over `items` with at most `limit` in flight at once. Use when
 * each task persists its own independent row (no shared-column write races).
 */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]!, i);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

/**
 * Short, stable fingerprint of a capsule outfit (its ordered pieces). Embedded
 * in the slot's image filename so a reused image is invalidated whenever the
 * recomputed matrix changes that slot's outfit.
 */
function comboFingerprint(combo: { pieces: string[] }): string {
  const str = combo.pieces.join("|").toLowerCase();
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

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

  // Only generate slots whose image is still missing (idempotent — safe to
  // re-run to fill gaps left by an interrupted earlier pass).
  const pending = slots.filter(({ list, index, angle = "front" }) => {
    const item = hair[list][index]!;
    return angle !== "front" ? !item.imagePathSide : !item.imagePath;
  });

  type HairOutcome = {
    list: "recommend" | "avoid";
    index: number;
    isSide: boolean;
    path: string;
  } | null;

  await processInChunks<Slot, HairOutcome>(
    pending,
    IMAGE_CONCURRENCY,
    async ({ list, index, angle = "front" }) => {
      const item = hair[list][index]!;
      const isSide = angle !== "front";
      const img = await generateHairImage({
        profile,
        hair: item,
        recommend: list === "recommend",
        referenceImageUrl,
        angle,
      });
      if (!img) return null;
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = isSide
        ? `${userId}/${reportId}/hair-${list}-${index}-side.${ext}`
        : `${userId}/${reportId}/hair-${list}-${index}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
      return upErr ? null : { list, index, isSide, path };
    },
    async (outcomes) => {
      let changed = false;
      for (const o of outcomes) {
        if (!o) continue;
        const item = hair[o.list][o.index]!;
        hair[o.list][o.index] = o.isSide
          ? { ...item, imagePathSide: o.path }
          : { ...item, imagePath: o.path };
        changed = true;
      }
      if (changed) {
        await admin.from("reports").update({ hair }).eq("id", reportId);
      }
    },
  );
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
    .select("facial_hair, eyewear, accessories, headwear")
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
  const pickHeadwear = () =>
    headwearPicksFor(profile)
      .slice(0, PREMIUM_HEADWEAR_GEN_LIMIT)
      .map((h) => ({ name: h.name, why: h.why, kind: h.kind }));

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
  // Headwear is included by default too — same "never shrink an add-on" rule.
  const existingHeadwear = row?.headwear as HeadwearRec[] | null;
  const headwear: HeadwearRec[] =
    existingHeadwear && existingHeadwear.length > PREMIUM_HEADWEAR_GEN_LIMIT
      ? existingHeadwear
      : mergeByName(existingHeadwear, pickHeadwear());

  const needsSeed =
    !row?.facial_hair ||
    !row?.eyewear ||
    !row?.accessories ||
    !row?.headwear ||
    (row.facial_hair as FacialHairRec[]).length < PREMIUM_FACIAL_HAIR_GEN_LIMIT ||
    (row.eyewear as EyewearRec[]).length < PREMIUM_EYEWEAR_GEN_LIMIT ||
    (row.accessories as AccessoryRec[]).length < PREMIUM_ACCESSORY_GEN_LIMIT ||
    (row.headwear as HeadwearRec[]).length < PREMIUM_HEADWEAR_GEN_LIMIT;

  if (needsSeed) {
    await admin
      .from("reports")
      .update({ facial_hair: facialHair, eyewear, accessories, headwear })
      .eq("id", reportId);
  }

  // Generate each grooming column in parallel (bounded), skipping items that
  // already have an image and persisting progress per chunk (race-free — one
  // column write per chunk, chunks never overlap).
  async function generateColumn<T extends { imagePath?: string | null }>(
    items: T[],
    column: "facial_hair" | "eyewear" | "accessories" | "headwear",
    pathPrefix: string,
    gen: (item: T) => Promise<{ bytes: Uint8Array; mediaType: string } | null>,
  ) {
    const pendingIdx = items
      .map((_, i) => i)
      .filter((i) => !items[i]!.imagePath);

    await processInChunks<number, { i: number; path: string } | null>(
      pendingIdx,
      IMAGE_CONCURRENCY,
      async (i) => {
        const item = items[i]!;
        const img = await gen(item);
        if (!img) return null;
        const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
        const path = `${userId}/${reportId}/${pathPrefix}-${i}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("assets")
          .upload(path, img.bytes, {
            contentType: img.mediaType,
            upsert: true,
          });
        return upErr ? null : { i, path };
      },
      async (outcomes) => {
        let changed = false;
        for (const o of outcomes) {
          if (!o) continue;
          items[o.i] = { ...items[o.i]!, imagePath: o.path };
          changed = true;
        }
        if (changed) {
          await admin
            .from("reports")
            .update({ [column]: items })
            .eq("id", reportId);
        }
      },
    );
  }

  await generateColumn(facialHair, "facial_hair", "facial-hair", (item) =>
    generateFacialHairImage({ profile, style: item, referenceImageUrl }),
  );
  await generateColumn(eyewear, "eyewear", "eyewear", (item) =>
    generateEyewearImage({ profile, frame: item, referenceImageUrl }),
  );
  await generateColumn(accessories, "accessories", "accessory", (item) =>
    generateAccessoryImage({ profile, accessory: item, referenceImageUrl }),
  );
  await generateColumn(headwear, "headwear", "headwear", (item) =>
    generateHeadwearImage({ profile, headwear: item, referenceImageUrl }),
  );
}

/**
 * Bespoke editorial PDF cover — a single full-length hero shot of the person.
 * Generated for every paid (PDF-eligible) tier; skipped when there's no
 * reference photo (the PDF falls back to the default editorial cover).
 */
async function generateCoverImageJob(input: ImageJobInput) {
  if (input.tier === "free") return;

  const admin = createAdminSupabase();
  const { reportId, userId, profile, content, photos } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;
  if (!referenceImageUrl) return;

  // Idempotent: skip if the cover already exists (resume passes only fill gaps).
  const { data: existing } = await admin
    .from("reports")
    .select("cover_image")
    .eq("id", reportId)
    .single();
  if (existing?.cover_image) return;

  const img = await generateCoverImage({
    profile,
    palette: (content.colors?.best ?? []).map((c) => c.name).filter(Boolean),
    referenceImageUrl,
  });
  if (!img) return;

  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = `${userId}/${reportId}/cover.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
  if (!upErr) {
    await admin.from("reports").update({ cover_image: path }).eq("id", reportId);
  }
}

/** Look + capsule photos — slow; runs after the HTTP response via `after()`. */
async function generateReportImages(input: ImageJobInput) {
  await generateHairImages(input);
  await generatePremiumGroomingImages(input);
  await generateCoverImageJob(input);

  const admin = createAdminSupabase();
  const { reportId, userId, tier, profile, photos, shopping } = input;

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;
  // Anchor identity with the dedicated face portrait too (same as virtual
  // try-on), so the report look and a later "try this on me" match the person.
  const faceReferenceImageUrl = photos.find((p) => p.role === "face")?.url;

  // Look photos — DB-driven and idempotent: read the look rows ordered by their
  // stable content index (`idx`), skip rows that already have an image, and
  // generate the rest in parallel. Each row is an independent update, so writes
  // are persisted immediately without racing. The storage index is the look's
  // own `idx`, which keeps images aligned with look_items (also keyed by idx).
  const { data: lookRows } = await admin
    .from("looks")
    .select("id, idx, image_path, context, title, description, palette")
    .eq("report_id", reportId)
    .order("idx", { ascending: true })
    .order("created_at", { ascending: true });

  const lookTasks = (lookRows ?? [])
    .map((row, index) => ({ row, index: (row.idx as number | null) ?? index }))
    .filter(({ row }) => !row.image_path);

  await mapPool(lookTasks, IMAGE_CONCURRENCY, async ({ row, index }) => {
    const img = await generateLookImage({
      profile,
      look: {
        title: (row.title as string | null) ?? "",
        description: (row.description as string | null) ?? "",
        palette: (row.palette as string[] | null) ?? [],
      },
      referenceImageUrl,
      faceReferenceImageUrl,
    });
    if (!img) return;
    const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
    const path = `${userId}/${reportId}/look-${index}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("assets")
      .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
    if (!upErr) {
      await admin
        .from("looks")
        .update({ image_path: path })
        .eq("id", row.id as string);
    }
  });

  if (tier === "lookbook" || tier === "premium") {
    const colorByTitle = new Map(shopping.map((s) => [s.title, s.color]));
    const matrix = capsuleMatrix(shopping, profile);
    // Cache-buster: asset URLs are served `immutable`, so a regenerated slot must
    // land on a NEW path or browsers/edge keep serving the previous image.
    const stamp = Date.now().toString(36);

    // Preserve any capsule slots already rendered; only fill the gaps.
    const { data: capsuleRow } = await admin
      .from("reports")
      .select("capsule_images")
      .eq("id", reportId)
      .single();
    const existingCapsule =
      (capsuleRow?.capsule_images as (string | null)[] | null) ?? [];
    // Fingerprint each slot's outfit so a reused image can't drift out of sync
    // with a recomputed matrix (e.g. after a shopping refresh): only keep an
    // existing image if its path carries the current combo's fingerprint.
    const capsulePaths: (string | null)[] = matrix.map((combo, i) => {
      const fp = comboFingerprint(combo);
      const prev = existingCapsule[i] ?? null;
      return prev && prev.includes(`-${fp}-`) ? prev : null;
    });

    const capsuleTasks = matrix
      .map((combo, i) => ({ combo, i }))
      .filter(({ i }) => !capsulePaths[i]);

    await processInChunks<(typeof capsuleTasks)[number], { i: number; path: string } | null>(
      capsuleTasks,
      IMAGE_CONCURRENCY,
      async ({ combo, i }) => {
        const shoe = combo.pieces[combo.pieces.length - 1];
        const isFormal = FORMAL_CONTEXTS.has(combo.context);
        const footwearRule = shoe
          ? isFormal
            ? `Footwear MUST be ${shoe} — polished closed-toe leather dress shoes. ` +
              `Absolutely NO sandals, slides, clogs, mules, espadrilles or open-toe shoes.`
            : `Footwear MUST be ${shoe}. NO sandals, slides, flip-flops or open-toe shoes.`
          : undefined;
        const img = await generateLookImage({
          profile,
          look: {
            title: combo.context,
            description: combo.pieces.join(", "),
            palette: combo.pieces
              .map((p) => colorByTitle.get(p))
              .filter((c): c is string => Boolean(c)),
            ...(footwearRule ? { footwearRule } : {}),
          },
          referenceImageUrl,
        });
        if (!img) return null;
        const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
        const fp = comboFingerprint(combo);
        const path = `${userId}/${reportId}/capsule-${i}-${fp}-${stamp}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("assets")
          .upload(path, img.bytes, {
            contentType: img.mediaType,
            upsert: true,
          });
        return upErr ? null : { i, path };
      },
      async (outcomes) => {
        let changed = false;
        for (const o of outcomes) {
          if (!o) continue;
          capsulePaths[o.i] = o.path;
          changed = true;
        }
        if (changed) {
          await admin
            .from("reports")
            .update({ capsule_images: capsulePaths })
            .eq("id", reportId);
        }
      },
    );
  }
}

/**
 * Rebuild an image job from the persisted report and fill any missing images.
 * Idempotent (every generator skips work already done), so this safely
 * completes reports whose background `after()` task was interrupted by a
 * timeout or crash. Returns why it was skipped, if it was.
 */
export async function resumeReportImages(
  reportId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!hasSupabaseAdmin) return { ok: false, reason: "admin-unconfigured" };
  if (isDemoReportId(reportId)) return { ok: false, reason: "demo" };

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("id, user_id, tier, status, profile, colors, hair, shopping, created_at")
    .eq("id", reportId)
    .single();

  if (!row) return { ok: false, reason: "not-found" };
  if (row.status !== "ready") return { ok: false, reason: `status-${row.status}` };

  const profile = row.profile as StyleProfile | null;
  if (!profile) return { ok: false, reason: "no-profile" };

  const userId = row.user_id as string;
  const tier = (row.tier as Tier) ?? "basic";
  const photos = await latestPhotoUrlsForUser(
    admin,
    userId,
    row.created_at as string,
  );

  const content = {
    hair: (row.hair as { recommend: HairRec[]; avoid: HairRec[] } | null) ?? {
      recommend: [],
      avoid: [],
    },
    colors: (row.colors as { best: { name: string }[]; avoid: unknown[] } | null) ?? {
      best: [],
      avoid: [],
    },
    looks: [],
  } as unknown as ReportContent;

  const shopping = (row.shopping as ShoppingItem[] | null) ?? [];

  await generateReportImages({
    reportId,
    userId,
    tier,
    profile,
    content,
    photos,
    shopping,
  });

  return { ok: true };
}

/**
 * Admin remediation for reports generated before the context-aware styling fix.
 * Re-matches the shopping list (drops casual footwear for polished profiles) and
 * regenerates the capsule photos from the corrected matrix. Idempotent: safe to
 * run repeatedly. Only lookbook/premium have a capsule to rebuild.
 */
export async function regenerateReportStyling(
  reportId: string,
  opts?: { rematchShopping?: boolean },
): Promise<{ ok: boolean; reason?: string }> {
  if (!hasSupabaseAdmin) return { ok: false, reason: "admin-unconfigured" };
  if (isDemoReportId(reportId)) return { ok: false, reason: "demo" };

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("id, user_id, tier, status, profile, colors")
    .eq("id", reportId)
    .single();
  if (!row) return { ok: false, reason: "not-found" };
  if (row.status !== "ready") return { ok: false, reason: `status-${row.status}` };

  const tier = (row.tier as Tier) ?? "basic";
  if (tier !== "lookbook" && tier !== "premium") {
    return { ok: false, reason: "no-capsule-tier" };
  }
  const profile = row.profile as StyleProfile | null;
  if (!profile) return { ok: false, reason: "no-profile" };
  const userId = row.user_id as string;

  if (opts?.rematchShopping !== false) {
    const colors =
      (row.colors as { best: { name: string }[] } | null) ?? { best: [] };
    const content = {
      colors: { best: colors.best ?? [], avoid: [] },
      hair: { recommend: [], avoid: [] },
      looks: [],
    } as unknown as ReportContent;
    const matched = await matchShopping(profile, content);
    if (!isMockShopping(matched)) {
      await admin.from("reports").update({ shopping: matched }).eq("id", reportId);
    }
  }

  // Remove the stale capsule files (served `immutable`) and clear the column so
  // resume rebuilds every slot from the corrected matrix onto fresh paths.
  const dir = `${userId}/${reportId}`;
  const { data: files } = await admin.storage.from("assets").list(dir);
  const oldCapsules = (files ?? [])
    .filter((f) => /^capsule-/.test(f.name))
    .map((f) => `${dir}/${f.name}`);
  if (oldCapsules.length) {
    await admin.storage.from("assets").remove(oldCapsules);
  }
  await admin
    .from("reports")
    .update({ capsule_images: null })
    .eq("id", reportId);

  return resumeReportImages(reportId);
}

/**
 * Backstop for reports whose image generation was cut short: scan recent
 * `ready` reports, find those still missing images, and resume a bounded number
 * of them (each internally parallel). Called by the finish-reports cron.
 */
export async function finishIncompleteReports(opts?: {
  sinceHours?: number;
  maxReports?: number;
  budgetMs?: number;
}): Promise<{ scanned: number; incomplete: number; resumed: string[] }> {
  if (!hasSupabaseAdmin) return { scanned: 0, incomplete: 0, resumed: [] };

  const sinceHours = opts?.sinceHours ?? 24;
  const maxReports = opts?.maxReports ?? 2;
  const budgetMs = opts?.budgetMs ?? 240_000;
  const startedAt = Date.now();

  const admin = createAdminSupabase();
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();

  const { data: rows } = await admin
    .from("reports")
    .select(
      "id, user_id, status, tier, capsule_images, hair, facial_hair, eyewear, accessories, headwear",
    )
    .eq("status", "ready")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  const reports = rows ?? [];
  if (!reports.length) return { scanned: 0, incomplete: 0, resumed: [] };

  const ids = reports.map((r) => r.id as string);
  const userIds = Array.from(new Set(reports.map((r) => r.user_id as string)));

  const [{ data: looks }, { data: photoRows }] = await Promise.all([
    admin.from("looks").select("report_id, image_path").in("report_id", ids),
    admin.from("photos").select("user_id").in("user_id", userIds),
  ]);

  const looksByReport = new Map<string, { image_path?: string | null }[]>();
  for (const l of looks ?? []) {
    const rid = l.report_id as string;
    const arr = looksByReport.get(rid) ?? [];
    arr.push({ image_path: l.image_path as string | null });
    looksByReport.set(rid, arr);
  }
  const usersWithPhoto = new Set((photoRows ?? []).map((p) => p.user_id as string));

  const incomplete = reports.filter((r) => {
    const state = reportGenerationState(
      r,
      looksByReport.get(r.id as string) ?? [],
      { hasReferencePhoto: usersWithPhoto.has(r.user_id as string) },
    );
    return state.pending && state.status !== "failed";
  });

  const resumed: string[] = [];
  for (const r of incomplete) {
    if (resumed.length >= maxReports) break;
    if (Date.now() - startedAt > budgetMs) break;
    const res = await resumeReportImages(r.id as string);
    if (res.ok) resumed.push(r.id as string);
  }

  return { scanned: reports.length, incomplete: incomplete.length, resumed };
}

async function executeReportGeneration(
  admin: ReturnType<typeof createAdminSupabase>,
  opts: {
    reportId: string;
    userId: string;
    tier: Tier;
    intake: Intake;
    photos: PhotoInput[];
  },
): Promise<void> {
  const { reportId, userId, tier, intake, photos } = opts;
  const language = normalizeLanguage(intake.language);

  const lookCount = lookCountForTier(tier);
  const { profile, content } = await generateReportContent(
    intake,
    photos,
    lookCount,
    tier,
  );
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

  // Premium grooming picks — deterministic English templates.
  const premiumGrooming =
    tier === "premium"
      ? {
          facialHair: facialHairFor(profile)
            .slice(0, PREMIUM_FACIAL_HAIR_GEN_LIMIT)
            .map((f) => ({ name: f.name, why: f.why })),
          eyewear: premiumEyewearPicks(profile)
            .slice(0, PREMIUM_EYEWEAR_GEN_LIMIT)
            .map((f) => ({
              name: f.name,
              why: f.why,
              shape: f.shape,
              kind: f.kind,
            })),
          headwear: headwearPicksFor(profile)
            .slice(0, PREMIUM_HEADWEAR_GEN_LIMIT)
            .map((h) => ({ name: h.name, why: h.why, kind: h.kind })),
        }
      : null;

  // The render-time "extras" (archetype, capsule, care, fragrance, …) are
  // deterministic English. For non-English reports we translate a snapshot and
  // persist it so the page/PDF render in the chosen language. English reports
  // keep computing extras live (`extras` column stays null).
  const baseExtras: StyleExtras =
    language === "en"
      ? ({} as StyleExtras)
      : buildExtras(
          assembleReport({
            id: reportId,
            createdAt: new Date().toISOString(),
            tier,
            profile,
            content,
            // Enrich product images first so the translated capsule snapshot
            // keeps its thumbnails (read-time enrichment won't touch it).
            shopping: await enrichShoppingImages(shopping),
            lookItems,
          }),
        );

  // The narrative (headline/summary/colours/hair/silhouette/do-dont/looks) is
  // already generated natively in `language`. Only the deterministic parts need
  // translating — skipped entirely for English.
  const translated =
    language === "en"
      ? null
      : await translateReportParts(
          {
            shopping,
            lookItems,
            ...(premiumGrooming
              ? {
                  facialHair: premiumGrooming.facialHair,
                  eyewear: premiumGrooming.eyewear,
                  headwear: premiumGrooming.headwear,
                }
              : {}),
            extras: baseExtras,
          },
          language,
        );

  await admin
    .from("reports")
    .update({
      status: "ready",
      language,
      profile,
      headline: content.headline,
      summary: content.summary,
      colors: content.colors,
      hair: content.hair,
      silhouette: content.silhouette,
      shopping: translated?.shopping ?? shopping,
      do_list: content.doList,
      dont_list: content.dontList,
      extras: translated?.extras ?? null,
      ...(premiumGrooming
        ? {
            facial_hair: translated?.facialHair ?? premiumGrooming.facialHair,
            eyewear: translated?.eyewear ?? premiumGrooming.eyewear,
            headwear: translated?.headwear ?? premiumGrooming.headwear,
          }
        : {}),
    })
    .eq("id", reportId);

  const finalLookItems = translated?.lookItems ?? lookItems;
  if (Object.keys(finalLookItems).length) {
    await admin
      .from("reports")
      .update({ look_items: finalLookItems })
      .eq("id", reportId);
  }

  await admin.from("looks").insert(
    content.looks.map((l, i) => ({
      report_id: reportId,
      idx: i,
      user_id: userId,
      context: l.context,
      title: l.title,
      description: l.description,
      palette: l.palette,
      image_path: null,
    })),
  );

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
}

async function clearPartialReport(
  admin: ReturnType<typeof createAdminSupabase>,
  reportId: string,
): Promise<void> {
  await admin.from("looks").delete().eq("report_id", reportId);
  await admin
    .from("reports")
    .update({
      status: "processing",
      profile: null,
      headline: null,
      summary: null,
      colors: null,
      hair: null,
      silhouette: null,
      shopping: null,
      do_list: null,
      dont_list: null,
      look_items: null,
      facial_hair: null,
      eyewear: null,
      accessories: null,
      headwear: null,
      capsule_images: null,
    })
    .eq("id", reportId);
}

/** Re-run generation for a failed report using stored intake and latest photos. */
export async function retryFailedReport(
  reportId: string,
  userId: string,
): Promise<string> {
  const admin = createAdminSupabase();
  const [{ data: row, error }, { data: intakeRow }] = await Promise.all([
    admin
      .from("reports")
      .select("id, user_id, tier, status")
      .eq("id", reportId)
      .eq("user_id", userId)
      .single(),
    admin
      .from("report_intake")
      .select("intake")
      .eq("report_id", reportId)
      .maybeSingle(),
  ]);
  if (error || !row) throw new Error("Report not found");
  if (row.status !== "failed") throw new Error("Report is not in a failed state");
  if (!intakeRow?.intake) throw new Error("Missing questionnaire for this report");

  const tier = row.tier as Tier;
  const intake = intakeRow.intake as Intake;

  await clearPartialReport(admin, reportId);
  // Retry may follow a fresh re-upload, so use the user's latest photos here.
  const photos = await latestPhotoUrlsForUser(admin, userId);

  try {
    await executeReportGeneration(admin, { reportId, userId, tier, intake, photos });
  } catch (e) {
    await admin.from("reports").update({ status: "failed" }).eq("id", reportId);
    throw e;
  }

  return reportId;
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
    })
    .select("id")
    .single();
  if (error || !created) {
    // Idempotency: a retry / double-submit reuses the same reportId. The first
    // request already created the row (and is generating), so return it instead
    // of inserting a duplicate or failing.
    if (input.reportId && /duplicate key|unique/i.test(error?.message ?? "")) {
      const { data: existing } = await admin
        .from("reports")
        .select("id, status")
        .eq("id", input.reportId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing?.id) {
        if (existing.status === "failed") {
          await retryFailedReport(existing.id as string, userId);
        }
        return existing.id as string;
      }
    }
    throw new Error(error?.message ?? "insert failed");
  }
  const reportId = created.id as string;

  const { error: intakeErr } = await admin.from("report_intake").insert({
    report_id: reportId,
    user_id: userId,
    intake,
  });
  if (intakeErr) {
    await admin.from("reports").delete().eq("id", reportId);
    throw new Error(intakeErr.message ?? "intake insert failed");
  }

  try {
    const photos: PhotoInput[] = [];
    for (const p of input.photoPaths ?? []) {
      const { data } = await admin.storage
        .from("photos")
        .createSignedUrl(p.path, 600);
      if (data?.signedUrl) photos.push({ role: p.role, url: data.signedUrl });
    }

    await executeReportGeneration(admin, {
      reportId,
      userId,
      tier,
      intake,
      photos,
    });
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
  isAdmin: boolean;
  ownerFeedback: ReportOwnerFeedback | null;
};

/**
 * A `reports` row as read for a view. The public path reads the column-whitelist
 * view `reports_public_v` (security invoker), so `intake` (and `user_id`) are
 * absent for non-owners. Intake lives in `report_intake` (owner-only RLS).
 */
type ReportRow = {
  id: string;
  user_id: string;
  created_at: string;
  tier: Tier;
  status: string;
  is_public: boolean;
  intake?: StyleReport["intake"];
  profile: StyleReport["profile"];
  headline: string | null;
  summary: string | null;
  colors: StyleReport["colors"] | null;
  hair: { recommend: HairRec[]; avoid: HairRec[] } | null;
  silhouette: StyleReport["silhouette"] | null;
  shopping: ShoppingItem[] | null;
  do_list: string[] | null;
  dont_list: string[] | null;
  look_items: Record<number, ShoppingItem[]> | null;
  facial_hair: FacialHairRec[] | null;
  eyewear: EyewearRec[] | null;
  accessories: AccessoryRec[] | null;
  headwear: HeadwearRec[] | null;
  capsule_images: (string | null)[] | null;
  cover_image: string | null;
  language?: string | null;
  extras?: StyleExtras | null;
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
    // Per-look "try this on me" renders (`.../tryon/look-…`) render inline under
    // each look — keep them out of the saved catalogue/outfit try-ons section.
    .not("image_path", "like", "%/tryon/look-%")
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
    return {
      report,
      isOwner: false,
      isPublic: true,
      isAdmin: false,
      ownerFeedback: null,
    };
  }
  if (!hasSupabase) {
    const report = getMockReport(id);
    if (!report) return null;
    return {
      report,
      isOwner: false,
      isPublic: false,
      isAdmin: false,
      ownerFeedback: null,
    };
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const isAdmin = Boolean(user && isAdminEmail(user.email));
  const adminDb = isAdmin && hasSupabaseAdmin ? createAdminSupabase() : null;

  // Admin sees everything; otherwise the owner reads the full base row (RLS),
  // and anyone else can only read the public whitelist VIEW (no intake/user_id).
  let row: ReportRow | null = null;
  let isOwner = false;
  let isPublic = false;

  if (adminDb) {
    const { data } = await adminDb.from("reports").select("*").eq("id", id).single();
    row = (data as unknown as ReportRow) ?? null;
  } else {
    const { data: ownRow } = await sb
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (ownRow) {
      row = ownRow as unknown as ReportRow;
      isOwner = Boolean(user && row.user_id === user.id);
    } else {
      // Not the owner — fall back to the public, column-whitelisted view
      // (no intake / user_id; free tier filtered out by the view).
      const { data: pubRow } = await sb
        .from("reports_public_v")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (pubRow) {
        row = pubRow as unknown as ReportRow;
        isPublic = true;
      }
    }
  }

  if (!row) return null;

  const tier = row.tier as Tier;
  if (adminDb) {
    isOwner = Boolean(user && row.user_id === user.id);
  }
  // Owner/admin read the base row → derive share state from is_public. The
  // public-view branch already set isPublic = true.
  if (isOwner || adminDb) {
    isPublic = canShareReport(tier) && Boolean(row.is_public);
  }
  if (!isOwner && !isPublic && !isAdmin) return null;

  const intakeClient = adminDb ?? sb;
  let reportIntake: Intake | undefined;
  if (isOwner || isAdmin) {
    const { data: intakeRow } = await intakeClient
      .from("report_intake")
      .select("intake")
      .eq("report_id", id)
      .maybeSingle();
    reportIntake = (intakeRow?.intake as Intake | undefined) ?? undefined;
  }

  const db = isOwner || isAdmin ? (adminDb ?? sb) : sb;

  // Looks + the owner's reference-photo check are independent — run together.
  const [{ data: looks }, ownerPhotoCheck] = await Promise.all([
    db
      .from("looks")
      .select("*")
      .eq("report_id", id)
      .order("idx", { ascending: true })
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
  const rawHeadwear = (row.headwear as HeadwearRec[] | null) ?? undefined;

  const lookImages = signedAssetProxyUrls(
    (looks ?? []).map((l) => l.image_path as string | null | undefined),
  );
  const capsuleImages = signedAssetProxyUrls(capsulePaths);
  const coverImage = row.cover_image
    ? signedAssetProxyUrl(row.cover_image)
    : undefined;
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
  const signedHeadwear = rawHeadwear
    ? attachGroomingImages(rawHeadwear)
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

  let generation = reportGenerationState(
    {
      status: row.status,
      tier: row.tier,
      capsule_images: row.capsule_images as (string | null)[] | null,
      hair: rawHair,
      facial_hair: rawFacialHair ?? null,
      eyewear: rawEyewear ?? null,
      accessories: rawAccessories ?? null,
      headwear: rawHeadwear ?? null,
    },
    looks ?? [],
    { hasReferencePhoto },
  );

  if (generation.status === "failed" && isOwner && hasSupabaseAdmin) {
    const recovery = await buildReportRecoveryInfo(createAdminSupabase(), {
      userId: row.user_id as string,
      reportId: id,
      tier: row.tier as Tier,
      intake: reportIntake,
      headline: row.headline,
      summary: row.summary,
      colors: row.colors,
      lookCount: looks?.length ?? 0,
      hasPhotos: hasReferencePhoto,
    });
    generation = { ...generation, recovery };
  }

  const report = assembleReport({
    id: row.id,
    createdAt: row.created_at,
    intake: reportIntake,
    tier: row.tier,
    profile:
      row.profile ??
      (reportIntake ? mockStyleProfile(reportIntake) : mockStyleProfile({} as Intake)),
    generation,
    personalizedHairPending:
      hasReferencePhoto &&
      !(looks ?? []).some((l) => l.image_path) &&
      hairGenerationPending(rawHair, row.tier as Tier),
    facialHair: signedFacialHair,
    eyewear: signedEyewear,
    accessories: signedAccessories,
    headwear: signedHeadwear,
    content,
    shopping: shopping.length ? shopping : mockShopping(),
    lookImages,
    capsuleImages,
    coverImage,
    lookItems,
    outfitTryons,
    language: normalizeLanguage(row.language),
    extras: (row.extras as StyleExtras | null) ?? undefined,
  });

  const ownerFeedback =
    isAdmin && !isDemoReportId(id) ? await getReportOwnerFeedback(id) : null;

  return { report, isOwner, isPublic, isAdmin, ownerFeedback };
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
