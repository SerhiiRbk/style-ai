import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env, hasAI, hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { LEGAL } from "@/lib/legal";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";
import { lookContextById } from "@/lib/look-contexts";
import { lookStyleById, lookStyleHasBrief } from "@/lib/look-styles";
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
  lookSetProfileSource,
} from "@/lib/look-sets";
import {
  resolveExistingProfile,
  createLookSet,
  saveSetLook,
  findLookSetByRequestKey,
  loadLookSetResult,
  markLookSetReady,
} from "@/lib/data/look-sets";
import {
  analyzeProfile,
  generateExtraLook,
  generateLookImage,
  carloNoteForSet,
  type PhotoInput,
} from "@/lib/ai/pipeline";
import { matchLookItems, type LookItems } from "@/lib/data/catalog";
import {
  bestSwatchesForProfile,
  lookSetColorRecipes,
} from "@/lib/look-set-color-recipes";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import {
  getCatalogTryOnPhoto,
  getLatestFacePhotoPath,
  signPhotoPath,
} from "@/lib/photo-tryon";
import { Boldness, BodyType, type LookItem } from "@/lib/style-profile";
import type { ReportContent, StyleProfile } from "@/lib/style-profile";
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

/** Opaque client idempotency token; bounded so it stays index-friendly. */
function idempotencyKey(request: Request): string | null {
  const raw = request.headers.get("Idempotency-Key");
  if (!raw) return null;
  const k = raw.trim();
  return k.length >= 8 && k.length <= 200 ? k : null;
}

type RenderedLook = {
  /** Stable content-order index (the chunk index it was generated at). Keys
   *  look_items and the storage path so pairing survives concurrent inserts. */
  idx: number;
  title: string;
  description: string;
  context: string;
  palette: string[];
  /** Structured garment slots from generateExtraLook — feeds matchLookItems. */
  items?: LookItem[];
  imagePath: string;
  charged: number;
};

/**
 * Batch "Create a Look" endpoint. Charges real credits and enforces the A0
 * cost fuse + biometric-photo consent/gate before generating anything.
 *
 * Photo rule: a face photo is required only when the user has no stored
 * StyleProfile (`resolveExistingProfile`). A returning user may skip the
 * photo and reuse that palette. If they *do* send a face (path or data URL),
 * colouring is re-read from that photo — not copied from the last report.
 *
 * Ordered flow: auth → validate body → resolve existing profile / decide if
 * a photo is required → cost fuse → pricing/balance → profile (fresh
 * analysis when a face is sent, else reuse) → createLookSet → generate
 * + bill per look → Carlo note → shop-the-look → events → response.
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

  const styleIdRaw = typeof body.styleId === "string" ? body.styleId : "atelier";
  const style = lookStyleById(styleIdRaw);
  if (!style) {
    return NextResponse.json(
      { error: "Invalid style", code: "invalid" },
      { status: 400 },
    );
  }
  const styleId = style.id;

  const intakeParsed = intakeBodySchema.safeParse(body.intake);
  if (!intakeParsed.success) {
    return NextResponse.json(
      { error: "Invalid intake", code: "invalid", issues: intakeParsed.error.flatten() },
      { status: 400 },
    );
  }
  const intake = { ...buildLookIntake(intakeParsed.data), boldness };

  // Format-validated only — requiredness is decided in step 3. A submitted
  // face is used for a fresh colour read even when a stored profile exists.
  const rawFaceImage: string | undefined = isDataUrl(body.faceImage)
    ? body.faceImage
    : undefined;
  const rawFullImage: string | undefined = isDataUrl(body.fullImage)
    ? body.fullImage
    : undefined;

  const anonId: string | null =
    typeof body.anonId === "string" && body.anonId ? body.anonId : null;

  // Path-based references (current UI): the client selects/uploads photos into
  // the private `photos` bucket and sends their storage PATHS. Ownership is
  // enforced by the `${user.id}/` prefix — a user can only reference their own
  // photos. These are signed to short-lived URLs below (same proven-safe scheme
  // as /api/look-extra). The legacy `faceImage`/`fullImage` data-URL path above
  // still works for older clients.
  const faceRefPath: string | undefined =
    typeof body.faceRefPath === "string" &&
    body.faceRefPath.startsWith(`${user.id}/`)
      ? body.faceRefPath
      : undefined;
  const fullRefPath: string | undefined =
    typeof body.fullRefPath === "string" &&
    body.fullRefPath.startsWith(`${user.id}/`)
      ? body.fullRefPath
      : undefined;

  const admin = createAdminSupabase();

  const signedFace: string | undefined = faceRefPath
    ? ((await signPhotoPath(admin, faceRefPath)) ?? undefined)
    : undefined;
  const signedFull: string | undefined = fullRefPath
    ? ((await signPhotoPath(admin, fullRefPath)) ?? undefined)
    : undefined;

  // 2b) Idempotency: a client sends a stable Idempotency-Key per "generate"
  // intent. A lost-response retry with the same key returns the set already
  // created for it — no second set, no second charge. (The partial unique
  // index on (user_id, request_key) in 0039 also blocks a concurrent
  // duplicate at the DB level; a race loser errors out having charged
  // nothing.) look_items are persisted now, so the replay can restore
  // Shop-the-Look too — keyed by each look's stable `idx`.
  const requestKey = idempotencyKey(request);
  if (requestKey) {
    const prior = await findLookSetByRequestKey(admin, user.id, requestKey);
    if (prior) {
      const result = await loadLookSetResult(admin, user.id, prior.id);
      if (result) {
        const balance = await creditBalance(admin, user.id);
        return NextResponse.json({
          setId: result.setId,
          shareSlug: result.shareSlug,
          carloNote: result.carloNote,
          looks: result.looks
            .filter((l) => l.imagePath)
            .map((l) => ({
            idx: l.idx,
            context: l.context,
            title: l.title,
            description: l.description,
            palette: l.palette,
            image: signedAssetProxyUrl(l.imagePath!),
            items: result.lookItems?.[l.idx] ?? [],
          })),
          balance,
          replayed: true,
        });
      }
    }
  }

  // 3) photo requiredness vs colour re-read. A stored profile lets the user
  // skip the upload; a selected face still triggers a fresh vision pass.
  const existing = await resolveExistingProfile(admin, user.id);
  const hasFacePhoto = Boolean(signedFace || rawFaceImage);
  const profileMode = lookSetProfileSource({
    hasExistingProfile: Boolean(existing),
    hasFacePhoto,
  });
  if (profileMode === "photo_required") {
    return NextResponse.json(
      { error: "A face photo is required", code: "photo_required" },
      { status: 400 },
    );
  }

  // 4) cost fuse (A0) — `purchased` computed once, reused by pricing (step 5)
  // below. Global cap fails CLOSED (protects business spend); per-user cap
  // fails OPEN (never blocks a real user on limiter flake). Same bucket/day
  // key convention as /api/colours (dayStamp + ">24h" window so a day's
  // bucket never expires mid-day). Runs BEFORE any fresh vision analysis.
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

  // 5) pricing (reuses `purchased`) — cap tier above used `purchased > 0`;
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

  // 6) profile: fresh vision analysis whenever this request includes a face
  // photo; otherwise reuse the stored report / prior-set snapshot. Render
  // anchors still come from the selected paths (or the later default fallback).
  let profile: StyleProfile;
  let source: "report" | "prior_set" | "fresh";
  let faceRefUrl: string | undefined = signedFace;
  let fullRefUrl: string | undefined = signedFull;

  if (profileMode === "fresh") {
    // First-time users, or a returning user sending a raw data-URL upload,
    // must consent. A returning user pointing at a photo already in their
    // bucket consented at upload; don't block the re-read on a second tick.
    const needsConsent = !existing || !signedFace;
    if (needsConsent) {
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
    }

    if (!signedFace) {
      // LEGACY data-URL path: gate the raw uploads before analysis. Path-based
      // photos (signedFace present) were already gated client-side and when
      // first added, so the server gate is skipped for them.
      faceRefUrl = rawFaceImage; // guaranteed present — checked in step 3
      fullRefUrl = rawFullImage;

      // photo gate — VERIFIED union contract (never throws): explicit rejects
      // fail closed (422); provider/timeout/no-AI failures fail open but must
      // be logged so a silently-dead gate stays visible.
      const faceGate = await assertPhotoUsable({
        imageDataUrl: faceRefUrl!,
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
      if (fullRefUrl) {
        const fullGate = await assertPhotoUsable({
          imageDataUrl: fullRefUrl,
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
    }

    const photos: PhotoInput[] = [{ role: "face", url: faceRefUrl! }];
    if (fullRefUrl) photos.push({ role: "full", url: fullRefUrl });
    profile = await analyzeProfile(intake, photos);
    source = "fresh";
    await logEvent({
      name: "create_look_analysis",
      userId: user.id,
      anonId,
      props: { occasion: ctx.id },
    });
  } else {
    // REUSE: no face on this request — keep the stored palette. Render
    // anchors fall back below to the default stored photos.
    profile = existing!.profile;
    source = existing!.source;
  }
  // Create-a-Look strictness is per-request — don't let a reused report
  // profile stay "moderate" while the set is Statement.
  profile = { ...profile, boldness };

  // 7) name — collision time (HH:MM) only if a same-occasion set already
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

  // Resolve the EXACT photo paths this set will render on — and persist them
  // on the set — so a later whole-look try-on uses the SAME photos, not the
  // user's latest/default (which is often a newer report's photo).
  let effectiveFullPath: string | undefined = fullRefPath;
  let effectiveFacePath: string | undefined = faceRefPath;
  // Guard `!fullRefUrl` too: in the legacy data-URL upload branch fullRefUrl is
  // the just-uploaded photo — don't clobber it (and render on a stored photo)
  // when there's no path. Mirrors the `&& !faceRefUrl` guard on the face branch.
  if (!effectiveFullPath && !fullRefUrl) {
    const stored = await getCatalogTryOnPhoto(admin, user.id);
    if (stored.ok) {
      effectiveFullPath = stored.path;
      fullRefUrl = stored.signedUrl;
    }
  }
  if (!effectiveFacePath) {
    effectiveFacePath =
      (await getLatestFacePhotoPath(admin, user.id)) ?? undefined;
    if (effectiveFacePath && !faceRefUrl) {
      faceRefUrl =
        (await signPhotoPath(admin, effectiveFacePath)) ?? undefined;
    }
  }

  // 8) createLookSet — writes `profile` into the owner-only
  // `look_set_profiles` side table itself; `profile` is NEVER written onto
  // the publicly-readable `look_sets` row directly here.
  const shareSlug = randomBytes(9).toString("base64url");
  const { id: setId } = await createLookSet(admin, {
    userId: user.id,
    reportId: null,
    occasionId: ctx.id,
    season,
    boldness,
    styleId: lookStyleHasBrief(styleId) ? styleId : null,
    name,
    carloNote: null,
    profile,
    isPublic: false,
    shareSlug,
    requestKey,
    faceRefPath: effectiveFacePath,
    fullRefPath: effectiveFullPath,
    looksCount,
  });

  // 9) per-look charge vector — deterministic, sums to `price` exactly.
  // Example: price=20, looks=9 -> base=2, rem=2 -> [3,3,2,2,2,2,2,2,2] (Σ=20).
  const base = Math.floor(price / looksCount);
  const rem = price - base * looksCount; // 0..looksCount-1 extra 1-credit looks
  const charge = Array.from({ length: looksCount }, (_, i) =>
    base + (i < rem ? 1 : 0),
  );

  const rendered: RenderedLook[] = [];
  const titlesSoFar: string[] = [];
  const colorRecipes = lookSetColorRecipes(
    bestSwatchesForProfile(profile),
    looksCount,
    { boldness, occasionId: ctx.id },
  );

  // Face-anchor the renders on the resolved photo paths above (selected or
  // catalog-default). Prefer the signed full-length URL; no photo → no-identity
  // reference path inside generateLookImage.
  const refFullUrl: string | undefined =
    fullRefUrl ??
    (effectiveFullPath
      ? ((await signPhotoPath(admin, effectiveFullPath)) ?? undefined)
      : undefined);

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
            occasionId: ctx.id,
            lookIndex: i,
            looksCount,
            styleId,
            existingTitles: titlesSoFar,
            colorRecipe: colorRecipes[i],
          });

          const img = await generateLookImage({
            profile,
            look,
            referenceImageUrl: refFullUrl,
            faceReferenceImageUrl: faceRefUrl,
            occasionId: ctx.id,
          });
          if (!img) {
            console.error("[look-set] generateLookImage returned null", setId, i);
            return null;
          }

          const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
          const imagePath = `${user.id}/looksets/${setId}/${i}.${ext}`;
          const { error: upErr } = await admin.storage
            .from("assets")
            .upload(imagePath, img.bytes, {
              contentType: img.mediaType,
              upsert: true,
            });
          if (upErr) {
            console.error("[look-set] asset upload failed", setId, i, upErr);
            return null;
          }

          await saveSetLook(admin, { setId, userId: user.id, idx: i, look, imagePath });

          // Billing is deferred to a single set-level spend after the loop —
          // spend_credits_once requires a UUID ref_id (the set id). Charging
          // per index with a string like `lookset:${setId}:${i}` fails the RPC
          // (22P02) and used to wipe every successful render as "generation_failed".
          return { ...look, idx: i, imagePath, charged: charge[i]! };
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

  // Bill once for the looks that actually rendered. `setId` is a UUID — the
  // type spend_credits_once.p_ref_id requires — so retries of the same set
  // (Idempotency-Key → existing set) never double-charge.
  const billed = rendered.reduce((sum, r) => sum + r.charged, 0);
  try {
    await spendCreditsOnce(admin, {
      userId: user.id,
      amount: billed,
      reason: "look_set",
      refId: setId,
    });
  } catch (billErr) {
    console.error("[look-set] set billing failed", setId, billErr);
    await admin.from("look_sets").delete().eq("id", setId);
    return NextResponse.json(
      { error: "Could not complete billing for this set. Please try again.", code: "billing_failed" },
      { status: 502 },
    );
  }

  await markLookSetReady(admin, setId);

  // 10) Carlo note.
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

  // 11) Shop-the-Look — same matchLookItems call as /api/look-extra, batched
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
        items: r.items,
      })),
    } as unknown as ReportContent;
    // matchLookItems keys by position in content.looks (= position in
    // `rendered`); re-key by each look's stable `idx` so look_items lines up
    // with the looks as read back (ordered by idx), not by the concurrent
    // insert order. A render that failed leaves a gap in idx — which is exactly
    // why position-keying was unsafe.
    const byPos = await matchLookItems(profile, content, { styleId });
    matched = {};
    rendered.forEach((r, p) => {
      const items = byPos[p];
      if (items?.length) matched[r.idx] = items;
    });
    // Persist the matched items on the set (mirrors reports.look_items) so the
    // set view can show "Shop the look" and the whole-look try-on can resolve
    // items later without recomputing. Best-effort — never fatal to the set.
    await admin
      .from("look_sets")
      .update({ look_items: matched })
      .eq("id", setId);
  } catch (err) {
    console.error("[look-set] shop-the-look match failed", setId, err);
  }

  // 12) event.
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

  // 13) response.
  const balance = await creditBalance(admin, user.id);
  return NextResponse.json({
    setId,
    shareSlug,
    carloNote,
    looks: rendered.map((r) => ({
      idx: r.idx,
      context: r.context,
      title: r.title,
      description: r.description,
      palette: r.palette,
      image: signedAssetProxyUrl(r.imagePath),
      items: matched[r.idx] ?? [],
    })),
    balance,
    currency: profile.currency,
  });
}
