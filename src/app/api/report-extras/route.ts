import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  generateAccessoryImage,
  generateEyewearImage,
  generateFacialHairImage,
  generateHeadwearImage,
} from "@/lib/ai/pipeline";
import { isDemoReportId } from "@/lib/demo-report";
import {
  accessoryExtraPicksFor,
  accessoryPicksFor,
  headwearExtraPicksFor,
  headwearPicksFor,
  facialHairExtraFor,
  facialHairFor,
  premiumEyewearExtraPicks,
  premiumEyewearPicks,
} from "@/lib/style-extras";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  PREMIUM_ACCESSORY_GEN_LIMIT,
  PREMIUM_HEADWEAR_GEN_LIMIT,
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  type HairRec,
} from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { getReportGroomingPhotoUrl } from "@/lib/photo-tryon";
import { withTranslator } from "@/lib/ai/translate";
import { normalizeLanguage } from "@/lib/languages";

export const maxDuration = 300;

const SIGNED_TTL = 3600;

type ExtraType = "accessories" | "headwear" | "facial_hair" | "eyewear";
type PreviewItem = HairRec & { kind?: string; shape?: string };

const CONFIG: Record<
  ExtraType,
  {
    column: "accessories" | "headwear" | "facial_hair" | "eyewear";
    base: number;
    /** Premium one-time top-up cost ("generate more"). */
    extraCost: number;
    /** Non-premium one-time unlock cost (generate the base set). */
    unlockCost: number;
    prefix: string;
  }
> = {
  accessories: {
    column: "accessories",
    base: PREMIUM_ACCESSORY_GEN_LIMIT,
    extraCost: CREDIT_COSTS.accessory_extra,
    unlockCost: CREDIT_COSTS.accessory_addon,
    prefix: "accessory",
  },
  headwear: {
    column: "headwear",
    base: PREMIUM_HEADWEAR_GEN_LIMIT,
    extraCost: CREDIT_COSTS.headwear_extra,
    unlockCost: CREDIT_COSTS.headwear_addon,
    prefix: "headwear",
  },
  facial_hair: {
    column: "facial_hair",
    base: PREMIUM_FACIAL_HAIR_GEN_LIMIT,
    extraCost: CREDIT_COSTS.facialhair_extra,
    unlockCost: CREDIT_COSTS.facialhair_addon,
    prefix: "facial-hair",
  },
  eyewear: {
    column: "eyewear",
    base: PREMIUM_EYEWEAR_GEN_LIMIT,
    extraCost: CREDIT_COSTS.eyewear_extra,
    unlockCost: CREDIT_COSTS.eyewear_addon,
    prefix: "eyewear",
  },
};

/** The base preview set (same picks Premium generates at creation). */
function basePicks(type: ExtraType, profile: StyleProfile): PreviewItem[] {
  if (type === "accessories") {
    return accessoryPicksFor(profile)
      .slice(0, PREMIUM_ACCESSORY_GEN_LIMIT)
      .map((a) => ({ name: a.name, why: a.why, kind: a.kind }));
  }
  if (type === "headwear") {
    return headwearPicksFor(profile)
      .slice(0, PREMIUM_HEADWEAR_GEN_LIMIT)
      .map((h) => ({ name: h.name, why: h.why, kind: h.kind }));
  }
  if (type === "facial_hair") {
    return facialHairFor(profile)
      .slice(0, PREMIUM_FACIAL_HAIR_GEN_LIMIT)
      .map((f) => ({ name: f.name, why: f.why }));
  }
  return premiumEyewearPicks(profile)
    .slice(0, PREMIUM_EYEWEAR_GEN_LIMIT)
    .map((f) => ({ name: f.name, why: f.why, shape: f.shape, kind: f.kind }));
}

function extraPicks(type: ExtraType, profile: StyleProfile): PreviewItem[] {
  if (type === "accessories") {
    return accessoryExtraPicksFor(profile).map((a) => ({
      name: a.name,
      why: a.why,
      kind: a.kind,
    }));
  }
  if (type === "headwear") {
    return headwearExtraPicksFor(profile).map((h) => ({
      name: h.name,
      why: h.why,
      kind: h.kind,
    }));
  }
  if (type === "facial_hair") {
    return facialHairExtraFor(profile).map((f) => ({ name: f.name, why: f.why }));
  }
  return premiumEyewearExtraPicks().map((f) => ({
    name: f.name,
    why: f.why,
    shape: f.shape,
    kind: f.kind,
  }));
}

async function generateImage(
  type: ExtraType,
  profile: StyleProfile,
  item: PreviewItem,
  referenceImageUrl: string,
): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (type === "accessories") {
    return generateAccessoryImage({
      profile,
      accessory: {
        name: item.name,
        why: item.why,
        kind: item.kind as "scarf" | "neckwear" | "tie" | undefined,
      },
      referenceImageUrl,
    });
  }
  if (type === "headwear") {
    return generateHeadwearImage({
      profile,
      headwear: {
        name: item.name,
        why: item.why,
        kind: item.kind as "hat" | "cap" | "beanie" | "bandana" | undefined,
      },
      referenceImageUrl,
    });
  }
  if (type === "facial_hair") {
    return generateFacialHairImage({
      profile,
      style: { name: item.name, why: item.why },
      referenceImageUrl,
    });
  }
  return generateEyewearImage({
    profile,
    frame: {
      name: item.name,
      why: item.why,
      shape: item.shape,
      kind: item.kind as "optical" | "sun" | undefined,
    },
    referenceImageUrl,
  });
}

async function signItems(
  _admin: ReturnType<typeof createAdminSupabase>,
  items: PreviewItem[],
): Promise<PreviewItem[]> {
  return items.map((item) =>
    item.imagePath ? { ...item, image: signedAssetProxyUrl(item.imagePath) } : item,
  );
}

/**
 * One-time paid "generate more" for a premium report's facial-hair / eyewear /
 * accessory previews. Appends a fresh batch to the existing array and charges
 * the per-type cost once. Refuses if the extra was already purchased.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image generation is not configured" },
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
  const reportId: string | undefined = body?.reportId;
  const type = body?.type as ExtraType | undefined;
  if (!reportId || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }
  if (!type || !(type in CONFIG)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const config = CONFIG[type];

  const admin = createAdminSupabase();

  const { data: row } = await admin
    .from("reports")
    .select(
      "id, user_id, tier, profile, accessories, headwear, eyewear, facial_hair, created_at, language",
    )
    .eq("id", reportId)
    .single();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const profile = row.profile as StyleProfile | null;
  if (!profile) {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }

  const isPremium = row.tier === "premium";
  const existing =
    ((row as Record<string, unknown>)[config.column] as PreviewItem[] | null) ??
    [];

  // Pick the flow: Premium reports include the base set and can buy a cheap
  // one-time top-up; other tiers can buy a one-time "unlock" of the base set
  // (priced above the Premium value, to steer toward Premium).
  let cost: number;
  let picks: PreviewItem[];

  if (isPremium) {
    if (existing.length === 0) {
      // Premium report created before this preview was included by default —
      // backfill the base set on the user's photo for free (Premium covers it).
      cost = 0;
      picks = basePicks(type, profile);
    } else if (existing.length > config.base) {
      // Already topped up — never double-charge.
      const items = await signItems(admin, existing);
      return NextResponse.json({ items, balance: null, alreadyOwned: true });
    } else {
      // Base previews must be fully generated first.
      const baseReady =
        existing.length >= config.base &&
        existing.slice(0, config.base).every((i) => i.imagePath);
      if (!baseReady) {
        return NextResponse.json(
          { error: "Base previews are still generating — try again shortly." },
          { status: 409 },
        );
      }
      cost = config.extraCost;
      const existingNames = new Set(existing.map((i) => i.name));
      picks = extraPicks(type, profile).filter((p) => !existingNames.has(p.name));
    }
  } else {
    // Non-premium: unlock the base set, optionally the full set (base + extra)
    // up front for a combined price, or top up the extra set after the base was
    // already unlocked. Each pair of previews costs one unlock price.
    const wantsFull = body?.count === config.base * 2;

    if (existing.length > config.base) {
      // Full set already generated — nothing left to buy.
      const items = await signItems(admin, existing);
      return NextResponse.json({ items, balance: null, alreadyOwned: true });
    }

    if (existing.length === 0) {
      if (wantsFull) {
        cost = config.unlockCost * 2;
        const base = basePicks(type, profile);
        const baseNames = new Set(base.map((p) => p.name));
        const extra = extraPicks(type, profile).filter(
          (p) => !baseNames.has(p.name),
        );
        picks = [...base, ...extra];
      } else {
        cost = config.unlockCost;
        picks = basePicks(type, profile);
      }
    } else {
      // Top up the extra set on top of the already-unlocked base previews.
      const baseReady =
        existing.length >= config.base &&
        existing.slice(0, config.base).every((i) => i.imagePath);
      if (!baseReady) {
        return NextResponse.json(
          { error: "Base previews are still generating — try again shortly." },
          { status: 409 },
        );
      }
      cost = config.unlockCost;
      const existingNames = new Set(existing.map((i) => i.name));
      picks = extraPicks(type, profile).filter(
        (p) => !existingNames.has(p.name),
      );
    }
  }

  if (hasSupabaseAdmin && cost > 0) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  // Localise the deterministic pick copy to the report's language.
  const language = normalizeLanguage((row as { language?: string | null }).language);
  if (language !== "en" && picks.length) {
    picks = await withTranslator(language, (tr) =>
      picks.map((p) => ({ ...p, name: tr(p.name), why: tr(p.why) })),
    );
  }

  // Prefer the photos tied to THIS report (uploaded around its creation) so the
  // preview matches the report's subject; fall back to the user's latest photo
  // when the report has none (e.g. older reports whose photos were replaced).
  const ref = await getReportGroomingPhotoUrl(
    admin,
    user.id,
    row.created_at as string,
    reportId,
  );
  if (!ref.ok) {
    return NextResponse.json({ error: ref.error }, { status: 422 });
  }
  const referenceImageUrl = ref.url;

  const merged: PreviewItem[] = [...existing];
  let anyGenerated = false;
  for (let i = 0; i < picks.length; i++) {
    const item = picks[i]!;
    const img = await generateImage(type, profile, item, referenceImageUrl);
    if (img) {
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const idx = merged.length;
      const path = `${user.id}/${reportId}/${config.prefix}-${idx}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, {
          contentType: img.mediaType,
          upsert: true,
        });
      if (!upErr) {
        merged.push({ ...item, imagePath: path });
        anyGenerated = true;
      }
    }
  }

  if (!anyGenerated) {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  await admin
    .from("reports")
    .update({ [config.column]: merged })
    .eq("id", reportId);

  let balance: number | null = null;
  if (hasSupabaseAdmin && cost > 0) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "premium_addon",
        refId: reportId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits.",
            code: "insufficient_credits",
            balance: e.balance,
            needed: e.needed,
          },
          { status: 402 },
        );
      }
      throw e;
    }
  }

  const items = await signItems(admin, merged);
  return NextResponse.json({ items, balance }, { status: 201 });
}
