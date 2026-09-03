import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { analyzeInspirationPhoto } from "@/lib/ai/inspiration";
import { logEvent } from "@/lib/events";
import {
  matchInspirationItems,
  LOOK_MATCH_VERSION,
  LOOK_RERANK_VERSION,
  INSPIRATION_MATCH_VERSION,
  type InspirationMatchSlot,
} from "@/lib/data/catalog";
import { getLatestReportProfile } from "@/lib/data/match-profile";
import {
  budgetCacheKey,
  itemBudgetPreferenceFromBandId,
} from "@/lib/budgets";

/** Cache key that changes with either the shared match logic or the shop-a-look logic. */
const CACHE_VERSION = `${LOOK_MATCH_VERSION}.${LOOK_RERANK_VERSION}.${INSPIRATION_MATCH_VERSION}`;

/** Vision detection + per-garment vector search can exceed the default timeout. */
export const maxDuration = 120;

/** ~6 MB of base64 ≈ 4.5 MB image — above a 1024px JPEG, below platform limits. */
const MAX_DATA_URL_CHARS = 6_000_000;

type CachedResult = {
  version: string;
  ok: boolean;
  lookTitle: string;
  description: string;
  palette: string[];
  slots: InspirationMatchSlot[];
  personalised: boolean;
  budgetKey: string;
};

function cachePath(userId: string, hash: string, budgetKey: string): string {
  return `${userId}/inspiration/${hash}-${budgetKey}.json`;
}

export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json(
      { error: "Shop a Look requires live mode" },
      { status: 501 },
    );
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image analysis is not configured" },
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
  const image: unknown = body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const budget = itemBudgetPreferenceFromBandId(
    typeof body?.budgetId === "string" ? body.budgetId : "any",
  );
  const budgetKey = budgetCacheKey(budget);

  const hash = createHash("sha256").update(image).digest("hex").slice(0, 32);
  const admin = hasSupabaseAdmin ? createAdminSupabase() : null;
  const path = cachePath(user.id, hash, budgetKey);

  // Photo+budget cache: re-uploading the same photo with the same budget skips
  // the vision + embedding + search cost. Invalidated when match logic bumps.
  if (admin) {
    const { data: blob } = await admin.storage.from("assets").download(path);
    if (blob) {
      try {
        const cached = JSON.parse(await blob.text()) as CachedResult;
        if (cached.version === CACHE_VERSION && cached.budgetKey === budgetKey) {
          return NextResponse.json({ ...cached, cached: true });
        }
      } catch {
        // Corrupt cache entry — fall through and recompute.
      }
    }
  }

  // No separate pre-flight gate here: `analyzeInspirationPhoto` is itself the
  // usability check — its schema carries an `ok` flag and returns "no clothing"
  // (below), so a Flash-Lite pre-gate would only duplicate that, add a call +
  // latency to every request, and — on this auth-gated, low-junk endpoint —
  // likely cost more than the Sonnet calls it saves. See the growth-plan
  // discussion; reinstate a pre-gate only if this opens to anonymous traffic.
  const analysis = await analyzeInspirationPhoto(image);
  if (!analysis.ok) {
    // Distinguish a vision/provider error (retryable) from a photo that
    // genuinely has no clothing, so the UX and diagnosis stay honest.
    if (analysis.failed) {
      return NextResponse.json(
        {
          ok: false,
          slots: [],
          message:
            "Reading the look failed — please try again in a moment.",
          code: "vision_failed",
        },
        { status: 502 },
      );
    }
    // The main call is the gate: no clothing detected. Log it for the same
    // junk-rate signal the pre-gate would have given.
    await logEvent({
      name: "photo_gate_reject",
      userId: user.id,
      props: { purpose: "shop_a_look" },
    });
    return NextResponse.json({
      ok: false,
      lookTitle: "",
      description: "",
      palette: [],
      slots: [],
      personalised: false,
      message:
        "We couldn't read an outfit in that photo. Try a clearer, full-outfit shot.",
    });
  }

  const { profile, personalised } = await getLatestReportProfile(user.id);
  const slots = await matchInspirationItems(
    profile,
    {
      title: analysis.lookTitle,
      description: analysis.description,
      palette: analysis.palette,
    },
    analysis.garments,
    budget,
  );

  const result: CachedResult = {
    version: CACHE_VERSION,
    ok: true,
    lookTitle: analysis.lookTitle,
    description: analysis.description,
    palette: analysis.palette,
    slots,
    personalised,
    budgetKey,
  };

  // Persist the computed result (not the source photo) for cache hits.
  if (admin) {
    try {
      await admin.storage
        .from("assets")
        .upload(path, JSON.stringify(result), {
          contentType: "application/json",
          upsert: true,
        });
    } catch {
      // Caching is best-effort — never fail the request over it.
    }
  }

  return NextResponse.json({ ...result, cached: false });
}
