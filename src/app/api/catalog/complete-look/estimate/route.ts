import { NextResponse } from "next/server";
import { env, hasAI, hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLatestReportProfile } from "@/lib/data/match-profile";
import { generateConstructedLookOpinion } from "@/lib/ai/tryon-opinion";
import { lookContextById, lookSetOccasionLabel } from "@/lib/look-contexts";
import { parseLookEstimateOpinion } from "@/lib/look-estimate";
import { checkLimit } from "@/lib/rate-limit";
import {
  completeLookCacheHash,
  completeLookCachePath,
  completeLookProfileKey,
  readCompleteLookCache,
  writeCompleteLookCache,
} from "@/lib/complete-look-cache";

export const maxDuration = 60;
export const runtime = "nodejs";

type CachedEstimate = {
  estimate: ReturnType<typeof parseLookEstimateOpinion>;
};

/**
 * Optional Carlo read for a completed catalogue look. Deferred so the match
 * itself does not pay for a second Sonnet call. Same hourly bucket as match.
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ estimate: null }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json({ estimate: null }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : "";
  const description = typeof body?.description === "string" ? body.description : "";
  const occasionRaw =
    typeof body?.occasionId === "string" ? body.occasionId : "smart_casual";
  const occasionId = lookContextById(occasionRaw) ? occasionRaw : "smart_casual";
  const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [];
  const garments = rawItems.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.title !== "string" || !row.title.trim()) return [];
    return [
      {
        title: row.title,
        category: typeof row.category === "string" ? row.category : "Look",
        color:
          (typeof row.colorName === "string" && row.colorName) ||
          (typeof row.color === "string" ? row.color : null),
        productId: typeof row.productId === "string" ? row.productId : "",
      },
    ];
  });

  if (!garments.length) {
    return NextResponse.json({ error: "Missing look pieces" }, { status: 400 });
  }

  const { profile } = await getLatestReportProfile(user.id);
  const cacheIds = garments
    .map((g) => g.productId)
    .filter((id) => id.length > 0);
  const hash = completeLookCacheHash(
    cacheIds.length ? cacheIds : garments.map((g) => g.title),
    occasionId,
    completeLookProfileKey(profile),
  );
  const path = completeLookCachePath(user.id, hash, "estimate");
  const cached = await readCompleteLookCache<CachedEstimate>(path);
  const cachedOpinion = parseLookEstimateOpinion(cached?.estimate);
  if (cachedOpinion) {
    return NextResponse.json({ estimate: cachedOpinion, cached: true });
  }

  const hourCheck = await checkLimit(
    `complete-look:user:${user.id}`,
    env.completeLookUserHourlyCap,
    60 * 60,
    { failOpen: false },
  );
  if (!hourCheck.allowed) {
    return NextResponse.json(
      {
        error: "Too many complete-the-look runs this hour — try again shortly.",
      },
      { status: 429 },
    );
  }

  const estimate = await generateConstructedLookOpinion({
    title,
    description,
    garments,
    profile,
    occasionLabel: lookSetOccasionLabel(occasionId),
  });
  const opinion = parseLookEstimateOpinion(estimate);
  if (opinion) await writeCompleteLookCache(path, { estimate: opinion });

  return NextResponse.json({ estimate: opinion, cached: false });
}
