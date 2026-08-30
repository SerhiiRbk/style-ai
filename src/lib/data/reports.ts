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
  sendReportReadyEmail,
  // sendReportFailedEmail, // PAUSED: "generation failed" email is disabled.
} from "@/lib/email/send";
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
  generateWatchBoardImage,
  generateShoeBoardImage,
  generateLookImage,
  generateHairImage,
  generateFacialHairImage,
  generateEyewearImage,
  generateAccessoryImage,
  generateHeadwearImage,
  type PhotoInput,
} from "@/lib/ai/pipeline";
// EXPERIMENTAL prompt versioning — logging only here (see look-prompt.ts).
import { resolveImagePromptVersion } from "@/lib/ai/look-prompt";
import {
  accessoryPicksFor,
  headwearPicksFor,
  capsuleMatrix,
  capsuleOutfitDescription,
  facialHairFor,
  premiumEyewearPicks,
  buildExtras,
  watchGuideFor,
  shoeGuideFor,
  FORMAL_CONTEXTS,
  lookItemsFromCell,
  type StyleExtras,
} from "@/lib/style-extras";
import {
  nearFaceDeepSwatch,
  boldAccentSwatch,
  wantsBoldAccent,
  deepenNearFaceHex,
} from "@/lib/colour-palette";
import { translateReportParts } from "@/lib/ai/translate-report";
import { getStoredReportPhotoPaths } from "@/lib/photo-tryon";
import { lookOccasionIdFromContext } from "@/lib/look-contexts";
import { ensureReportLookSet } from "@/lib/data/report-look-sets";
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
import {
  profileFromIntake,
  type Intake,
  type ReportContent,
  type StyleProfile,
} from "@/lib/style-profile";
import { seedProfileIfMissing } from "@/lib/data/user-profile";

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
    watch_image?: string | null;
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
  // Note: missing `watch_image` is intentionally NOT a user-facing pending
  // phase — legacy premium/lookbook reports never had one, and the watch
  // board is generated best-effort alongside other images. The finish-reports
  // cron still backfills recent gaps via a separate check.
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
  /** When set, prefer the exact photoPaths persisted on report_intake at submit. */
  reportId?: string,
): Promise<PhotoInput[]> {
  const byRole = new Map<string, string>();

  if (reportId) {
    const stored = await getStoredReportPhotoPaths(admin, reportId);
    for (const p of stored ?? []) {
      if (p.role && p.path && !byRole.has(p.role)) byRole.set(p.role, p.path);
    }
  }

  if (!byRole.size) {
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

    for (const row of photoRows ?? []) {
      const role = row.role as string;
      if (!byRole.has(role)) byRole.set(role, row.storage_path as string);
    }
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
  /** EXPERIMENTAL — per-run image-prompt version override (else env default). */
  promptVersion?: string | number | null;
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

  // Head/upper-body previews: prefer the face portrait selected for this report.
  const referenceImageUrl =
    photos.find((p) => p.role === "face")?.url ??
    photos.find((p) => p.role === "full")?.url ??
    photos[0]?.url;
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
  const faceReferenceImageUrl = photos.find((p) => p.role === "face")?.url;
  const profileReferenceImageUrl = photos.find((p) => p.role === "profile")?.url;

  // Idempotent: skip if the cover already exists (resume passes only fill gaps).
  const { data: existing } = await admin
    .from("reports")
    .select("cover_image")
    .eq("id", reportId)
    .single();
  if (existing?.cover_image) return;

  // Cover keeps the SAFE deep near-face tone (never the bold accent) — it's the
  // hero shot, so the deepest palette neutral gives clean face-to-garment contrast.
  const coverNearFace = nearFaceDeepSwatch(content.colors?.best ?? [])?.hex;
  const img = await generateCoverImage({
    profile,
    palette: (content.colors?.best ?? []).map((c) => c.name).filter(Boolean),
    referenceImageUrl,
    faceReferenceImageUrl,
    profileReferenceImageUrl,
    ...(coverNearFace ? { nearFaceHex: coverNearFace } : {}),
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

/**
 * One editorial flat-lay of the recommended watch variants (case × dial ×
 * strap, no brands) for the premium/lookbook watch section. Generated once,
 * idempotent — a single image so it barely adds to report cost.
 */
async function generateWatchImageJob(input: ImageJobInput) {
  if (input.tier !== "lookbook" && input.tier !== "premium") return;

  const admin = createAdminSupabase();
  const { reportId, userId, profile, content } = input;

  // Idempotent: skip if already generated (resume only fills gaps).
  const { data: existing } = await admin
    .from("reports")
    .select("watch_image")
    .eq("id", reportId)
    .single();
  if (existing?.watch_image) return;

  const guide = watchGuideFor(profile, content.colors?.best ?? []);
  const img = await generateWatchBoardImage({
    palette: (content.colors?.best ?? []).map((c) => c.name).filter(Boolean),
    variants: guide.variants.map((v) => ({
      context: v.context,
      type: v.type,
      shape: v.shape,
      caseMetal: v.caseMetal,
      dial: v.dial,
      strap: v.strap,
    })),
  });
  if (!img) return;

  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = `${userId}/${reportId}/watch.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
  if (!upErr) {
    await admin.from("reports").update({ watch_image: path }).eq("id", reportId);
  }
}

/**
 * One editorial flat-lay of the footwear system (3–4 shoe roles, no brands) for
 * the premium/lookbook footwear section. Generated once, idempotent — a single
 * image so it barely adds to report cost.
 */
async function generateShoeImageJob(input: ImageJobInput) {
  if (input.tier !== "lookbook" && input.tier !== "premium") return;

  const admin = createAdminSupabase();
  const { reportId, userId, profile, content } = input;

  // Idempotent: skip if already generated (resume only fills gaps).
  const { data: existing } = await admin
    .from("reports")
    .select("shoe_image")
    .eq("id", reportId)
    .single();
  if (existing?.shoe_image) return;

  const guide = shoeGuideFor(
    profile,
    content.colors?.best ?? [],
    content.colors?.avoid ?? [],
  );
  const img = await generateShoeBoardImage({
    palette: (content.colors?.best ?? []).map((c) => c.name).filter(Boolean),
    variants: guide.variants.map((v) => ({
      role: v.role,
      style: v.style,
      color: v.color,
      colorHex: v.colorHex,
      finish: v.finish,
    })),
  });
  if (!img) return;

  // Versioned filename so CDN/browser caches never keep a previous (e.g. black)
  // flat-lay after a colour-corrected regen.
  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = `${userId}/${reportId}/shoes-v${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
  if (!upErr) {
    await admin.from("reports").update({ shoe_image: path }).eq("id", reportId);
  }
}

/** Look + capsule photos — slow; runs after the HTTP response via `after()`. */
/** Owner email from the profiles mirror, or null when unknown. */
async function emailForUser(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const email = data?.email;
  return typeof email === "string" && email ? email : null;
}

/**
 * Send the "report ready" email exactly once. The claim on `ready_email_at` is
 * atomic, so the inline `after()` run and the finish-reports backstop cron can't
 * both fire it. On send failure the claim is released so a later run retries.
 */
async function notifyReportReady(
  admin: ReturnType<typeof createAdminSupabase>,
  reportId: string,
  userId: string,
): Promise<void> {
  try {
    const email = await emailForUser(admin, userId);
    if (!email) return;
    const { data: claimed } = await admin
      .from("reports")
      .update({ ready_email_at: new Date().toISOString() })
      .eq("id", reportId)
      .is("ready_email_at", null)
      .select("id, headline")
      .maybeSingle();
    if (!claimed) return; // already sent by another run
    const ok = await sendReportReadyEmail(email, {
      reportId,
      headline: (claimed.headline as string | null) ?? null,
    });
    if (!ok) {
      await admin
        .from("reports")
        .update({ ready_email_at: null })
        .eq("id", reportId);
    }
  } catch (err) {
    console.error("[report ready email]", err);
  }
}

// PAUSED: the "generation failed" email is disabled. Kept intact so it can be
// re-enabled by uncommenting this function, its import, and the two call sites.
// /** Send the "generation failed" email at most once (claims `failed_email_at`). */
// async function notifyReportFailed(
//   admin: ReturnType<typeof createAdminSupabase>,
//   reportId: string,
//   userId: string,
// ): Promise<void> {
//   try {
//     const email = await emailForUser(admin, userId);
//     if (!email) return;
//     const { data: claimed } = await admin
//       .from("reports")
//       .update({ failed_email_at: new Date().toISOString() })
//       .eq("id", reportId)
//       .is("failed_email_at", null)
//       .select("id")
//       .maybeSingle();
//     if (!claimed) return;
//     const ok = await sendReportFailedEmail(email);
//     if (!ok) {
//       await admin
//         .from("reports")
//         .update({ failed_email_at: null })
//         .eq("id", reportId);
//     }
//   } catch (err) {
//     console.error("[report failed email]", err);
//   }
// }

async function generateReportImages(input: ImageJobInput) {
  await generateHairImages(input);
  await generatePremiumGroomingImages(input);
  await generateCoverImageJob(input);
  await generateWatchImageJob(input);
  await generateShoeImageJob(input);

  const admin = createAdminSupabase();
  const { reportId, userId, tier, profile, photos, shopping, content } = input;
  const promptVersion = input.promptVersion;
  // EXPERIMENTAL — record which prompt layout produced this report's looks.
  console.log(
    `[image-prompt] report=${reportId} version=${resolveImagePromptVersion(promptVersion)}`,
  );

  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;
  // Anchor identity with the dedicated face portrait too (same as virtual
  // try-on), so the report look and a later "try this on me" match the person.
  const faceReferenceImageUrl = photos.find((p) => p.role === "face")?.url;
  // Optional extra face-geometry anchor from the (optional) profile shot.
  const profileReferenceImageUrl = photos.find((p) => p.role === "profile")?.url;

  // Keep the shoe colours on look/capsule renders in the same family as the
  // deterministic footwear section — but offer the WHOLE set (dress, smart,
  // everyday, accent) so shoes vary sensibly by look instead of every outfit
  // getting the single dark anchor. The model otherwise defaults leather to
  // warm brown/tan even for cool clients whose palette rejects it.
  const shoeGuide = shoeGuideFor(
    profile,
    content.colors?.best ?? [],
    content.colors?.avoid ?? [],
  );
  const dressShoe = shoeGuide.variants[0];
  const smartShoe =
    shoeGuide.variants.find((v) => /smart|loafer|chelsea/i.test(v.role + v.style)) ??
    shoeGuide.variants[1];
  const everydayShoe =
    shoeGuide.variants.find((v) => /everyday|trainer|sneaker/i.test(v.role)) ??
    shoeGuide.variants[2];
  // Only steer away from warm brown when the client's palette actually rejects it.
  const avoidBrown = (content.colors?.avoid ?? []).some((c) =>
    /brown|cognac|tan|camel|chestnut|espresso|chocolate|mocha/i.test(
      c.name || "",
    ),
  );
  // Light / soft colour subseasons carry lower contrast best — for CASUAL looks
  // with light trousers a soft mid-brown / suede / light trainer reads more
  // gracefully than dark, high-contrast leather. Deep/bright seasons can wear the
  // dark leather comfortably, so this is a gentle preference, not a rule.
  const softPalette = /light-|soft-|cool-summer/.test(
    profile.colorSubseason ?? "",
  );
  // Non-formal shoes may use ANY colour from the client's BEST palette — that's
  // where colour and variety live. Only the dress oxford/derby is locked to a
  // strict formal leather.
  const bestPaletteText = (content.colors?.best ?? [])
    .map((c) => `${c.name}${c.hex ? ` (${c.hex})` : ""}`)
    .filter(Boolean)
    .join(", ");
  const footwearColorText = dressShoe
    ? `Footwear — choose the shoe to suit the outfit and VARY the colour across looks:\n` +
      `• Business / suit / tailored looks: oxfords or derbies in a STRICT formal leather ONLY ` +
      `(black, dark brown or burgundy) — never coloured oxfords.\n` +
      `• Smart-casual looks: loafers, Chelsea or derby boots in ANY colour from the client's ` +
      `palette (${bestPaletteText}) — lean into richer tones such as ${smartShoe?.color?.toLowerCase() ?? "navy"}.\n` +
      `• Relaxed / weekend looks: minimal leather trainers in a light palette neutral ` +
      `(${everydayShoe?.color?.toLowerCase() ?? "off-white"}), or a casual shoe in a palette colour.\n` +
      `• Trainer soles: give every coloured trainer/sneaker a clean CONTRASTING midsole ` +
      `and outsole — white, cream, gum or pale grey — with the coloured upper above it; ` +
      `do NOT render a fully monochrome trainer where the sole matches the upper, UNLESS ` +
      `the whole trainer is white / off-white or black (where a tonal sole is natural).\n` +
      `Use ONLY colours from that palette or the formal set above; do not invent off-palette colours` +
      (avoidBrown ? ` and avoid warm tan / cognac leather` : "") +
      `. No two looks should repeat the same shoe colour. ` +
      (softPalette
        ? `The client's colouring is light / soft, so for CASUAL looks with light or pale trousers ` +
          `prefer softer, lower-contrast footwear — ` +
          (avoidBrown
            ? `a light neutral leather trainer or grey suede`
            : `a mid-brown or brown-suede shoe, or a light leather trainer`) +
          ` — rather than dark, high-contrast leather. (Business looks stay in the strict formal ` +
          `leather regardless.) `
        : "")
    : "";

  // Near-face colour: put the palette's DEEPEST tone on the top layer so the face
  // reads with contrast (a mid-light tone under the chin flattens it). Everyone
  // gets this safe deep neutral; bold-leaning clients also get ONE statement look
  // built on the richest palette accent (still on-palette — never a loud off-tone).
  const nearFaceDeep = nearFaceDeepSwatch(content.colors?.best ?? []);
  const boldAccent = wantsBoldAccent({
    boldness: profile.boldness,
    goals: profile.goals,
    lifestyle: profile.lifestyle,
  })
    ? boldAccentSwatch(content.colors?.best ?? [])
    : null;

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

  // Near-face depth for EVERY look, kept varied: each look's own primary palette
  // tone is deepened ON-HUE (plum→deep plum, teal→deep teal) so the garment at the
  // face always carries real depth without turning every look into the same dark
  // neutral. ONE evening/social look still becomes the bold statement for
  // qualifying clients; a look with no palette falls back to the safe deep neutral.
  const rowsByIdx = (lookRows ?? []).map((row, index) => ({
    idx: (row.idx as number | null) ?? index,
    text: `${(row.context as string | null) ?? ""} ${(row.title as string | null) ?? ""}`.toLowerCase(),
  }));
  const anchorLookIdx = rowsByIdx.length
    ? Math.min(...rowsByIdx.map((r) => r.idx))
    : -1;
  const boldLookIdx = (() => {
    if (!boldAccent || !rowsByIdx.length) return -1;
    const candidates = rowsByIdx.filter((r) => r.idx !== anchorLookIdx);
    const pool = candidates.length ? candidates : rowsByIdx;
    const match = pool.find((r) =>
      /evening|dinner|date|night|party|event|social|cocktail|weekend/.test(
        r.text,
      ),
    );
    return (match ?? pool[pool.length - 1]!).idx;
  })();

  const lookTasks = (lookRows ?? [])
    .map((row, index) => ({ row, index: (row.idx as number | null) ?? index }))
    .filter(({ row }) => !row.image_path);

  // Pick the palette hex of the garment that actually sits at the FACE — the
  // outermost upper-body layer, not simply palette[0]. The palette array is
  // aligned to the garment order in the description, so in a knit-over-shirt look
  // (shirt listed first, jumper worn over it) the jumper — the layer that frames
  // the face — is chosen instead of the hidden shirt. Falls back to palette[0].
  const nearFacePaletteHex = (
    description: string,
    palette: string[],
  ): string | undefined => {
    if (!palette.length) return undefined;
    const phrases = description.split(",").map((s) => s.trim().toLowerCase());
    const OUTER =
      /\b(blazer|jackets?|coats?|overcoats?|topcoats?|peacoats?|pea coats?|trench|parkas?|gilets?|bombers?|overshirts?|shackets?|cardigans?)\b/;
    const KNIT =
      /\b(jumpers?|sweaters?|knitwear|knit|crewnecks?|crew necks?|roll ?necks?|turtlenecks?|hoodies?|sweatshirts?|pullovers?)\b/;
    const TOP = /\b(shirts?|t-?shirts?|tees?|polos?|henleys?|tops?)\b/;
    const findIdx = (re: RegExp) => phrases.findIndex((p) => re.test(p));
    let i = findIdx(OUTER);
    if (i < 0) i = findIdx(KNIT);
    if (i < 0) i = findIdx(TOP);
    if (i < 0) i = 0;
    const hex = palette[i] ?? palette[0];
    return hex ? deepenNearFaceHex(hex) : undefined;
  };

  await mapPool(lookTasks, IMAGE_CONCURRENCY, async ({ row, index }) => {
    const rowPalette = (row.palette as string[] | null) ?? [];
    const ownDeep =
      nearFacePaletteHex(
        (row.description as string | null) ?? "",
        rowPalette,
      ) ?? nearFaceDeep?.hex;
    const nearFaceHex =
      index === boldLookIdx && boldAccent ? boldAccent.hex : ownDeep;
    const img = await generateLookImage({
      profile,
      occasionId: lookOccasionIdFromContext(
        (row.context as string | null) ?? null,
      ),
      look: {
        title: (row.title as string | null) ?? "",
        description: (row.description as string | null) ?? "",
        palette: (row.palette as string[] | null) ?? [],
        ...(footwearColorText
          ? {
              footwearRule:
                footwearColorText +
                "NO sandals, slides, flip-flops or open-toe shoes.",
            }
          : {}),
      },
      referenceImageUrl,
      faceReferenceImageUrl,
      profileReferenceImageUrl,
      ...(nearFaceHex ? { nearFaceHex } : {}),
      ...(promptVersion != null ? { promptVersion } : {}),
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
    const colorNameByTitle = new Map(
      shopping
        .filter((s) => s.colorName)
        .map((s) => [s.title, s.colorName as string]),
    );
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
        const footwearStyleRule = shoe
          ? isFormal
            ? `Footwear MUST be ${shoe} — polished closed-toe leather dress shoes. ` +
              `Absolutely NO sandals, slides, clogs, mules, espadrilles or open-toe shoes.`
            : `Footwear MUST be ${shoe}. NO sandals, slides, flip-flops or open-toe shoes.`
          : undefined;
        // Prepend the palette-correct shoe colour so capsule renders match the
        // footwear section instead of the model's default brown leather.
        const contrastRule =
          "The shirt or knit and the trousers must contrast in lightness — never the same grey. " +
          "Keep each named garment colour; do not paint the trousers to match the top. " +
          "One chromatic hero — do not repeat that colour on the shoes or a second main garment. " +
          "Shoes must not match the jacket unless both are a dark navy or black formal set. " +
          "If shirt and trousers are both mid-neutrals (greige, mushroom, taupe, stone, camel, beige, mid-grey), add a dark anchor (navy, charcoal, black or dark brown). " +
          "If the look includes shorts: no jacket, jumper, hoodie or classic dress shoe " +
          "(oxford, brogue, derby, boot) — loafers or sneakers only.";
        const footwearRule =
          [footwearColorText.trim(), footwearStyleRule, contrastRule]
            .filter(Boolean)
            .join(" ") || undefined;
        const img = await generateLookImage({
          profile,
          look: {
            title: combo.context,
            description: capsuleOutfitDescription(
              combo.pieces,
              colorByTitle,
              colorNameByTitle,
            ),
            palette: combo.pieces
              .map((p) => colorByTitle.get(p))
              .filter((c): c is string => Boolean(c)),
            ...(footwearRule ? { footwearRule } : {}),
          },
          referenceImageUrl,
          faceReferenceImageUrl,
          profileReferenceImageUrl,
          ...(promptVersion != null ? { promptVersion } : {}),
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

  await ensureReportLookSet(admin, { reportId, userId }).catch((err) => {
    console.error("[look-set] promote report looks after images failed", reportId, err);
  });

  // Images are the last stage — this matches the "your report is ready" toast.
  await notifyReportReady(admin, reportId, userId);
}

/**
 * Rebuild an image job from the persisted report and fill any missing images.
 * Idempotent (every generator skips work already done), so this safely
 * completes reports whose background `after()` task was interrupted by a
 * timeout or crash. Returns why it was skipped, if it was.
 */
export async function resumeReportImages(
  reportId: string,
  opts?: { promptVersion?: string | number | null },
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
    reportId,
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
    ...(opts?.promptVersion != null ? { promptVersion: opts.promptVersion } : {}),
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
      "id, user_id, status, tier, capsule_images, watch_image, shoe_image, hair, facial_hair, eyewear, accessories, headwear",
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
    if (state.pending && state.status !== "failed") return true;
    // Best-effort watch / shoe flat-lays for recent premium/lookbook reports
    // that finished before those sections shipped (or whose job missed).
    const needsExtras = r.tier === "lookbook" || r.tier === "premium";
    if (!needsExtras) return false;
    const missingWatch = !(typeof r.watch_image === "string" && r.watch_image);
    const missingShoe = !(typeof r.shoe_image === "string" && r.shoe_image);
    return missingWatch || missingShoe;
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

  // The narrative (headline/summary/hair/silhouette/do-dont/looks) is already
  // generated natively in `language`. The colour palette is now deterministic
  // (English), so it joins the other deterministic parts for translation.
  // Skipped entirely for English.
  const translated =
    language === "en"
      ? null
      : await translateReportParts(
          {
            colors: content.colors,
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
      colors: translated?.colors ?? content.colors,
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

  const lookRows = content.looks.map((l, i) => ({
    report_id: reportId,
    idx: i,
    user_id: userId,
    context: l.context,
    title: l.title,
    description: l.description,
    palette: l.palette,
    image_path: null as string | null,
    ...(l.items?.length ? { items: l.items } : {}),
  }));
  let { error: lookInsErr } = await admin.from("looks").insert(lookRows);
  // Pre-0048 DB has no `items` column — retry without it (matching falls back
  // to prose for later rematches, same as before the migration).
  if (lookInsErr && /items/.test(lookInsErr.message)) {
    for (const row of lookRows) delete (row as { items?: unknown }).items;
    ({ error: lookInsErr } = await admin.from("looks").insert(lookRows));
  }
  if (lookInsErr) throw new Error(lookInsErr.message);

  await ensureReportLookSet(admin, { reportId, userId }).catch((err) => {
    console.error("[look-set] promote report looks failed", reportId, err);
  });

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
    // await notifyReportFailed(admin, reportId, userId); // PAUSED (email #3)
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

  // Persist uploaded photo references (reused later for virtual try-on). Skip
  // paths already on file — a report can REUSE a previous photo set, and we must
  // not create duplicate rows for the same storage object.
  if (input.photoPaths?.length) {
    const { data: existing } = await admin
      .from("photos")
      .select("storage_path")
      .eq("user_id", userId)
      .in("storage_path", input.photoPaths.map((p) => p.path));
    const known = new Set(
      (existing ?? []).map((r) => r.storage_path as string),
    );
    const fresh = input.photoPaths.filter((p) => !known.has(p.path));
    if (fresh.length) {
      await admin.from("photos").insert(
        fresh.map((p) => ({
          user_id: userId,
          role: p.role,
          storage_path: p.path,
        })),
      );
    }
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

  // Persist the exact photo selection with the intake so later eyewear /
  // try-on / regen jobs don't guess from "latest upload before created_at"
  // (which can be a different person when the library has many faces).
  const { error: intakeErr } = await admin.from("report_intake").insert({
    report_id: reportId,
    user_id: userId,
    intake: {
      ...intake,
      ...(input.photoPaths?.length ? { photoPaths: input.photoPaths } : {}),
    },
  });
  if (intakeErr) {
    await admin.from("reports").delete().eq("id", reportId);
    throw new Error(intakeErr.message ?? "intake insert failed");
  }

  // Lazily seed the user's persistent profile from this report's intake when
  // they have none yet — declared fields only (no derived appearance), so future
  // reports pre-fill. Never overwrites an existing profile; never fatal.
  await seedProfileIfMissing(
    admin,
    userId,
    profileFromIntake(intake, new Date().getFullYear()),
    reportId,
  );

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
    // await notifyReportFailed(admin, reportId, userId); // PAUSED (email #3)
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
  watch_image: string | null;
  shoe_image: string | null;
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
  const watchImage = row.watch_image
    ? signedAssetProxyUrl(row.watch_image)
    : undefined;
  const shoeImage = row.shoe_image
    ? signedAssetProxyUrl(row.shoe_image)
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
      items: lookItemsFromCell(l.items) ?? undefined,
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
    watchImage,
    shoeImage,
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

/**
 * Per-look "on you" try-on images (proxy URLs) keyed by the look's `idx`, for
 * the PDF. These are rendered from the user's own photo by /api/tryon/look and
 * live in the `tryons` table (report-scoped) — not on the StyleReport itself.
 * Latest render per look wins. Empty when unconfigured/demo or none generated.
 */
export async function loadLookTryOnImages(
  reportId: string,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (isDemoReportId(reportId) || !hasSupabaseAdmin) return out;
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("tryons")
    .select("image_path, created_at")
    .eq("report_id", reportId)
    .eq("kind", "look")
    .order("created_at", { ascending: false });
  for (const r of data ?? []) {
    const path = (r.image_path as string | null) ?? null;
    if (!path) continue;
    const m = path.match(/-look-(\d+)\.(?:png|jpe?g)$/i);
    if (!m) continue;
    const idx = Number(m[1]);
    if (out.has(idx)) continue; // desc order → first seen is the latest render
    out.set(idx, signedAssetProxyUrl(path));
  }
  return out;
}

/** Fetch report content only — owner or public link. Falls back to mock store. */
export async function getReportById(id: string): Promise<StyleReport | null> {
  const view = await getReportView(id);
  return view?.report ?? null;
}
