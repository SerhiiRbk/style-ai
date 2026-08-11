import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env, hasAI, hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { LEGAL } from "@/lib/legal";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";
import { lookContextById } from "@/lib/look-contexts";
import { assertPhotoUsable } from "@/lib/ai/photo-gate";
import {
  creditsPurchased,
  creditBalance,
  spendCreditsOnce,
} from "@/lib/credits";
import {
  buildLookIntake,
  priceForBundle,
  isLoyalty,
  bundleFor,
  setName,
} from "@/lib/look-sets";
import {
  resolveProfileForLookSet,
  createLookSet,
  saveSetLook,
} from "@/lib/data/look-sets";
import {
  generateExtraLook,
  generateLookImage,
  carloNoteForSet,
  type PhotoInput,
} from "@/lib/ai/pipeline";
import { matchLookItems, type LookItems } from "@/lib/data/catalog";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { Boldness, BodyType } from "@/lib/style-profile";
import type { ReportContent } from "@/lib/style-profile";
import type { LookBriefSeason } from "@/lib/ai/look-brief";

/** Up to 9 sequential text+image generations per set; generous budget mirrors
 * /api/reports (which also fans out multiple look renders in one request). */
export const maxDuration = 600;

/** ~6 MB of base64 ≈ 4.5 MB image — same ceiling as /api/colours (MAX_DATA_URL_CHARS). */
const MAX_DATA_URL_CHARS = 6_000_000;

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/**
 * Max look renders in flight at once, chunked (not a free-running pool) so
 * `existingTitles` accumulates across chunks and later looks avoid repeating
 * earlier titles in the same set. Smaller than reports.ts's IMAGE_CONCURRENCY
 * (4) because each unit here does a text generation AND an image generation,
 * not just the image.
 */
const LOOK_CONCURRENCY = 3;

/** Light intake accepted by this endpoint — validated separately from the
 * full questionnaire `intakeSchema` (Style Report), since Create-a-Look only
 * collects age + body type (see buildLookIntake, lib/look-sets.ts). */
const intakeBodySchema = z.object({
  age: z.number().int().min(16).max(99),
  bodyType: BodyType.optional(),
});

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function isDataUrl(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.startsWith("data:image/") &&
    v.length <= MAX_DATA_URL_CHARS
  );
}

type RenderedLook = {
  title: string;
  description: string;
  context: string;
  palette: string[];
  imagePath: string;
  charged: number;
};

/**
 * Batch "Create a Look" endpoint. Charges real credits and enforces the A0
 * cost fuse + biometric-photo consent/gate before generating anything.
 * Ordered flow (see task-7-brief.md): auth → validate → consent → photo
 * gate → cost fuse → pricing/balance → intake → resolve profile → name →
 * createLookSet → generate+bill per look → Carlo note → shop-the-look →
 * events → response.
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image generation is not configured" },
      { status: 501 },
    );
  }

  // 1) auth
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) validate body
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid JSON", code: "invalid" },
      { status: 400 },
    );
  }

  const looksCount = Number(body.looks);
  if (!bundleFor(looksCount)) {
    return NextResponse.json(
      { error: "Invalid bundle size", code: "invalid" },
      { status: 400 },
    );
  }

  const ctx = lookContextById(body.occasionId);
  if (!ctx) {
    return NextResponse.json(
      { error: "Choose an occasion", code: "invalid" },
      { status: 400 },
    );
  }

  const boldnessParsed = Boldness.safeParse(body.boldness);
  if (!boldnessParsed.success) {
    return NextResponse.json(
      { error: "Invalid boldness", code: "invalid" },
      { status: 400 },
    );
  }
  const boldness = boldnessParsed.data;

  const season: LookBriefSeason | null = SEASONS.includes(body.season)
    ? body.season
    : null;
  if (!season) {
    return NextResponse.json(
      { error: "Invalid season", code: "invalid" },
      { status: 400 },
    );
  }

  const intakeParsed = intakeBodySchema.safeParse(body.intake);
  if (!intakeParsed.success) {
    return NextResponse.json(
      { error: "Invalid intake", code: "invalid", issues: intakeParsed.error.flatten() },
      { status: 400 },
    );
  }

  // Create-a-Look always renders from a submitted face photo (both for a
  // fresh vision analysis AND as the image-generation identity reference —
  // resolveProfileForLookSet may reuse an OLDER StyleProfile, but the render
  // itself always needs THIS request's photo). A full-length photo sharpens
  // pose/proportions but is optional (generateLookImage degrades to a
  // face-only reference when absent).
  if (!isDataUrl(body.faceImage)) {
    return NextResponse.json(
      { error: "A face photo is required", code: "invalid" },
      { status: 400 },
    );
  }
  const faceImage: string = body.faceImage;
  const fullImage: string | undefined = isDataUrl(body.fullImage)
    ? body.fullImage
    : undefined;

  const anonId: string | null =
    typeof body.anonId === "string" && body.anonId ? body.anonId : null;

  // 3) consent — mirrors /api/reports' biometric consent gate exactly. Since
  // a face photo is mandatory above, consent is unconditionally required here
  // (unlike /api/reports, where it's conditional on photoPaths.length).
  const biometricConsent = body.biometricConsent === true;
  const consentVersion =
    typeof body.consentVersion === "string" ? body.consentVersion : "";
  if (!biometricConsent || consentVersion !== LEGAL.consentVersion) {
    return NextResponse.json(
      {
        error:
          "Explicit consent for photo processing is required. Please accept on the photo step.",
        code: "consent_required",
      },
      { status: 422 },
    );
  }

  // 4) photo gate — VERIFIED union contract (never throws): explicit rejects
  // fail closed (422); provider/timeout/no-AI failures fail open but must be
  // logged so a silently-dead gate stays visible.
  const faceGate = await assertPhotoUsable({
    imageDataUrl: faceImage,
    purpose: "report_face",
  });
  if (!faceGate.ok) {
    await logEvent({
      name: "photo_gate_reject",
      userId: user.id,
      anonId,
      props: { purpose: "report_face" },
    });
    return NextResponse.json(
      { code: "photo_gate", message: faceGate.rejectReason },
      { status: 422 },
    );
  }
  if (
    "skipped" in faceGate &&
    (faceGate.reason === "provider_error" || faceGate.reason === "no_ai")
  ) {
    await logEvent({
      name: "photo_gate_failopen",
      userId: user.id,
      anonId,
      props: { purpose: "report_face", reason: faceGate.reason },
    });
  }
  if (fullImage) {
    const fullGate = await assertPhotoUsable({
      imageDataUrl: fullImage,
      purpose: "report_full",
    });
    if (!fullGate.ok) {
      await logEvent({
        name: "photo_gate_reject",
        userId: user.id,
        anonId,
        props: { purpose: "report_full" },
      });
      return NextResponse.json(
        { code: "photo_gate", message: fullGate.rejectReason },
        { status: 422 },
      );
    }
    if (
      "skipped" in fullGate &&
      (fullGate.reason === "provider_error" || fullGate.reason === "no_ai")
    ) {
      await logEvent({
        name: "photo_gate_failopen",
        userId: user.id,
        anonId,
        props: { purpose: "report_full", reason: fullGate.reason },
      });
    }
  }

  const admin = createAdminSupabase();

  // 5) cost fuse (A0) — `purchased` computed once, reused by pricing (step 6)
  // below. Global cap fails CLOSED (protects business spend); per-user cap
  // fails OPEN (never blocks a real user on limiter flake). Same bucket/day
  // key convention as /api/colours (dayStamp + ">24h" window so a day's
  // bucket never expires mid-day).
  const day = dayStamp();
  const purchased = await creditsPurchased(admin, user.id);

  const globalBucket = `lookset:global:${day}`;
  const globalCheck = await checkLimit(
    globalBucket,
    env.lookSetDailyCap,
    26 * 3600,
    { failOpen: false },
  );
  if (!globalCheck.allowed) {
    await logEvent({
      name: "rate_limited",
      userId: user.id,
      anonId,
      props: { level: "global", bucket: globalBucket, count: globalCheck.count },
    });
    return NextResponse.json(
      {
        code: "capacity",
        error: "We're at capacity for look sets right now — please try again shortly.",
      },
      { status: 503 },
    );
  }

  const userCap = purchased > 0 ? env.lookSetUserCapPaid : env.lookSetUserCapFree;
  const userBucket = `lookset:user:${user.id}:${day}`;
  const userCheck = await checkLimit(userBucket, userCap, 26 * 3600, {
    failOpen: true,
  });
  if (!userCheck.allowed) {
    await logEvent({
      name: "rate_limited",
      userId: user.id,
      anonId,
      props: { level: "user", bucket: userBucket, count: userCheck.count },
    });
    return NextResponse.json(
      { code: "rate_limited", error: "You've reached today's look-set limit." },
      { status: 429 },
    );
  }

  // 6) pricing (reuses `purchased`) — cap tier above used `purchased > 0`;
  // the loyalty discount below uses `purchased >= LOYALTY_PURCHASE_THRESHOLD`
  // (20) via isLoyalty — two different thresholds, kept intentionally separate.
  const loyalty = isLoyalty(purchased);
  // Non-null: bundleFor(looksCount) already validated in step 2, and
  // priceForBundle does the same lookup internally.
  const price = priceForBundle(looksCount, loyalty)!;
  const balanceBefore = await creditBalance(admin, user.id);
  if (balanceBefore < price) {
    return NextResponse.json(
      {
        error: "Not enough credits.",
        code: "insufficient_credits",
        balance: balanceBefore,
        needed: price,
      },
      { status: 402 },
    );
  }

  // 7) intake — pure, cheap.
  const intake = buildLookIntake(intakeParsed.data);

  // 8) profile — cheapest/most personalised source first (report > prior set
  // > fresh vision analysis). The photo(s) from THIS request are also reused
  // below as the image-generation identity reference regardless of which
  // profile source wins.
  const photos: PhotoInput[] = [{ role: "face", url: faceImage }];
  if (fullImage) photos.push({ role: "full", url: fullImage });
  const { profile, source } = await resolveProfileForLookSet(
    admin,
    user.id,
    photos,
    intake,
  );
  if (source === "fresh") {
    await logEvent({
      name: "create_look_analysis",
      userId: user.id,
      anonId,
      props: { occasion: ctx.id },
    });
  }

  // 9) name — collision time (HH:MM) only if a same-occasion set already
  // exists today for this user.
  const now = new Date();
  const dayStart = `${day}T00:00:00.000Z`;
  const dayEnd = `${day}T23:59:59.999Z`;
  const { data: sameDayRows } = await admin
    .from("look_sets")
    .select("id")
    .eq("user_id", user.id)
    .eq("occasion_id", ctx.id)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .limit(1);
  const collisionTime = sameDayRows?.length
    ? now.toISOString().slice(11, 16)
    : undefined;
  const name = setName(ctx.label, now.toISOString(), collisionTime);

  // 10) createLookSet — writes `profile` into the owner-only
  // `look_set_profiles` side table itself; `profile` is NEVER written onto
  // the publicly-readable `look_sets` row directly here.
  const shareSlug = randomBytes(9).toString("base64url");
  const { id: setId } = await createLookSet(admin, {
    userId: user.id,
    reportId: null,
    occasionId: ctx.id,
    season,
    boldness,
    name,
    carloNote: null,
    profile,
    isPublic: false,
    shareSlug,
  });

  // 11) per-look charge vector — deterministic, sums to `price` exactly.
  // Example: price=20, looks=9 -> base=2, rem=2 -> [3,3,2,2,2,2,2,2,2] (Σ=20).
  const base = Math.floor(price / looksCount);
  const rem = price - base * looksCount; // 0..looksCount-1 extra 1-credit looks
  const charge = Array.from({ length: looksCount }, (_, i) =>
    base + (i < rem ? 1 : 0),
  );

  const rendered: RenderedLook[] = [];
  const titlesSoFar: string[] = [];

  for (let start = 0; start < looksCount; start += LOOK_CONCURRENCY) {
    const chunk = Array.from(
      { length: Math.min(LOOK_CONCURRENCY, looksCount - start) },
      (_, k) => start + k,
    );
    const results = await Promise.all(
      chunk.map(async (i): Promise<RenderedLook | null> => {
        try {
          const look = await generateExtraLook({
            intake,
            profile,
            context: ctx.context,
            brief: ctx.brief,
            boldness,
            season,
            existingTitles: titlesSoFar,
          });

          const img = await generateLookImage({
            profile,
            look,
            referenceImageUrl: fullImage,
            faceReferenceImageUrl: faceImage,
          });
          if (!img) return null;

          const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
          const imagePath = `${user.id}/looksets/${setId}/${i}.${ext}`;
          const { error: upErr } = await admin.storage
            .from("assets")
            .upload(imagePath, img.bytes, {
              contentType: img.mediaType,
              upsert: true,
            });
          if (upErr) return null;

          await saveSetLook(admin, { setId, userId: user.id, look, imagePath });

          // Bill ONLY after the image is stored. Idempotent per (setId, i) —
          // a retry of the same set never double-charges this index.
          try {
            await spendCreditsOnce(admin, {
              userId: user.id,
              amount: charge[i]!,
              reason: "look_set",
              refId: `lookset:${setId}:${i}`,
            });
          } catch (billErr) {
            // Should not happen under normal (non-concurrent) use — balance
            // was pre-checked >= price in step 6. Treat as a failed look
            // rather than an unbilled free one: it's excluded from the
            // response, though its already-stored `looks` row/image remain
            // (accepted residual — mirrors the "best-effort" tone of the
            // shop-the-look step below; not worth a compensating delete for
            // an already-documented non-issue).
            console.error(
              "[look-set] billing failed for rendered look",
              setId,
              i,
              billErr,
            );
            return null;
          }

          return { ...look, imagePath, charged: charge[i]! };
        } catch (err) {
          console.error("[look-set] look render failed", setId, i, err);
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) {
        rendered.push(r);
        titlesSoFar.push(r.title);
      }
    }
  }

  if (!rendered.length) {
    // Total render failure — nothing was charged. Compensating delete so an
    // empty set doesn't litter the DB; mirrors createLookSet's own cleanup
    // when its second insert fails (lib/data/look-sets.ts) and cascades to
    // look_set_profiles + any (here: zero) `looks` rows via FK on delete cascade.
    await admin.from("look_sets").delete().eq("id", setId);
    return NextResponse.json(
      { error: "Could not generate any looks. Please try again.", code: "generation_failed" },
      { status: 502 },
    );
  }

  // 12) Carlo note.
  let carloNote: string | null = null;
  try {
    carloNote = await carloNoteForSet({
      profile,
      occasionLabel: ctx.label,
      looks: rendered,
    });
    await admin.from("look_sets").update({ carlo_note: carloNote }).eq("id", setId);
  } catch (err) {
    console.error("[look-set] carlo note failed", setId, err);
  }

  // 13) Shop-the-Look — same matchLookItems call as /api/look-extra, batched
  // once across all rendered looks (one embedMany fan-out) rather than once
  // per look. Best-effort: a match failure is logged, never fatal to the set.
  // NOTE: unlike a report, a look_set has no `look_items`-equivalent column
  // to persist matches into (0039_look_sets.sql adds none) — matches are
  // computed here and returned inline in the response only.
  let matched: LookItems = {};
  try {
    const content = {
      colors: { best: [], avoid: [] },
      looks: rendered.map((r) => ({
        context: r.context,
        title: r.title,
        description: r.description,
        palette: r.palette,
      })),
    } as unknown as ReportContent;
    matched = await matchLookItems(profile, content);
  } catch (err) {
    console.error("[look-set] shop-the-look match failed", setId, err);
  }

  // 14) event.
  await logEvent({
    name: "look_set_created",
    userId: user.id,
    anonId,
    props: {
      occasion: ctx.id,
      looks: looksCount,
      loyalty,
      source,
      rendered: rendered.length,
    },
  });

  // 15) response.
  const balance = await creditBalance(admin, user.id);
  return NextResponse.json({
    setId,
    shareSlug,
    carloNote,
    looks: rendered.map((r, idx) => ({
      context: r.context,
      title: r.title,
      description: r.description,
      palette: r.palette,
      image: signedAssetProxyUrl(r.imagePath),
      items: matched[idx] ?? [],
    })),
    balance,
  });
}
