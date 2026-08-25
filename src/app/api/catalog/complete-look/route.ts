import { NextResponse } from "next/server";
import { env, hasAI, hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { getLatestReportProfile } from "@/lib/data/match-profile";
import {
  loadShoppingItemsByIds,
  matchLookAroundAnchors,
} from "@/lib/data/catalog";
import { lookContextById } from "@/lib/look-contexts";
import {
  MAX_COMPLETE_LOOK_ANCHORS,
  completeLookHasFills,
  findCompleteLookConflict,
  parseCompleteLookProductIds,
} from "@/lib/complete-look";
import { checkLimit } from "@/lib/rate-limit";
import {
  completeLookCacheHash,
  completeLookCachePath,
  completeLookProfileKey,
  readCompleteLookCache,
  writeCompleteLookCache,
} from "@/lib/complete-look-cache";
import { renderCompleteLookTryOn } from "@/lib/complete-look-tryon";
import { getCatalogTryOnPhoto } from "@/lib/photo-tryon";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import type { ShoppingItem } from "@/lib/report";

export const maxDuration = 300;
export const runtime = "nodejs";

type CachedMatch = {
  items: ShoppingItem[];
  title: string;
  description: string;
  palette: string[];
  occasionId: string;
  personalised: boolean;
  lockedProductIds: string[];
};

/**
 * Fill empty slots around 1–3 locked picks and render the outfit. 1 credit
 * after a successful try-on. Match cache still skips embeddings on repeats.
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Look matching is not configured" },
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
  const productIds = parseCompleteLookProductIds(body?.productIds);
  if (!productIds.length) {
    return NextResponse.json({ error: "Pick at least one piece" }, { status: 400 });
  }
  if (productIds.length > MAX_COMPLETE_LOOK_ANCHORS) {
    return NextResponse.json(
      {
        error: `Complete the look uses up to ${MAX_COMPLETE_LOOK_ANCHORS} pieces.`,
      },
      { status: 400 },
    );
  }

  const occasionRaw =
    typeof body?.occasionId === "string" ? body.occasionId : "smart_casual";
  const occasionId = lookContextById(occasionRaw) ? occasionRaw : "smart_casual";
  const tryOnStyle: "photo" | "studio" =
    body?.style === "photo" ? "photo" : "studio";

  const admin = createAdminSupabase();
  const cost = CREDIT_COSTS.complete_look;
  const balanceBefore = await creditBalance(admin, user.id);
  if (balanceBefore < cost) {
    return NextResponse.json(
      {
        error: "Not enough credits to complete the look.",
        code: "insufficient_credits",
        balance: balanceBefore,
        needed: cost,
      },
      { status: 402 },
    );
  }

  const photo = await getCatalogTryOnPhoto(admin, user.id);
  if (!photo.ok) {
    return NextResponse.json(
      { error: photo.error, code: photo.code },
      { status: 422 },
    );
  }

  const anchors = await loadShoppingItemsByIds(productIds);
  if (anchors.length !== productIds.length) {
    return NextResponse.json(
      { error: "One of those pieces is no longer in the catalogue." },
      { status: 404 },
    );
  }

  const conflict = findCompleteLookConflict(anchors);
  if (conflict) {
    return NextResponse.json(
      {
        error: `Those two fill the same role (${conflict.slot}). Keep one and complete around it.`,
        conflict,
      },
      { status: 409 },
    );
  }

  const { profile, personalised } = await getLatestReportProfile(user.id);
  const hash = completeLookCacheHash(
    productIds,
    occasionId,
    completeLookProfileKey(profile),
  );
  const path = completeLookCachePath(user.id, hash, "match");
  const cached = await readCompleteLookCache<CachedMatch>(path);
  let matched: CachedMatch;
  if (
    cached?.items?.length &&
    completeLookHasFills(cached.items, cached.lockedProductIds ?? productIds)
  ) {
    matched = { ...cached, personalised };
  } else {
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

    const next = await matchLookAroundAnchors(profile, {
      anchors,
      occasionId,
    });
    if (!completeLookHasFills(next.items, productIds)) {
      return NextResponse.json(
        {
          error:
            "Could not complete the look just now — try again in a moment.",
        },
        { status: 503 },
      );
    }
    matched = {
      items: next.items,
      title: next.title,
      description: next.description,
      palette: next.palette,
      occasionId,
      personalised,
      lockedProductIds: productIds,
    };
    await writeCompleteLookCache(path, matched);
  }

  const rendered = await renderCompleteLookTryOn({
    admin,
    userId: user.id,
    items: matched.items,
    personImageUrl: photo.signedUrl,
    style: tryOnStyle,
    occasionId,
  });
  if (!rendered.ok) {
    return NextResponse.json(
      {
        error: rendered.error,
        code: rendered.code,
        ...matched,
        tryOnUrl: null,
      },
      { status: rendered.status },
    );
  }

  let balance: number | null = null;
  try {
    balance = await spendCredits(admin, {
      userId: user.id,
      amount: cost,
      reason: "complete_look",
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "Not enough credits to complete the look.",
          code: "insufficient_credits",
          balance: e.balance,
          needed: e.needed,
        },
        { status: 402 },
      );
    }
    throw e;
  }

  return NextResponse.json({
    ok: true,
    ...matched,
    tryOnUrl: rendered.url,
    tryonId: rendered.tryonId,
    balance,
    cached: Boolean(
      cached?.items &&
        completeLookHasFills(cached.items, cached.lockedProductIds ?? productIds),
    ),
  });
}
