import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  generateAccessoryImage,
  generateEyewearImage,
  generateFacialHairImage,
} from "@/lib/ai/pipeline";
import { isDemoReportId } from "@/lib/demo-report";
import {
  accessoryExtraPicksFor,
  accessoryPicksFor,
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
  PREMIUM_EYEWEAR_GEN_LIMIT,
  PREMIUM_FACIAL_HAIR_GEN_LIMIT,
  type HairRec,
} from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";
import { signedAssetProxyUrl } from "@/lib/asset-token";

export const maxDuration = 300;

const SIGNED_TTL = 3600;

type ExtraType = "accessories" | "facial_hair" | "eyewear";
type PreviewItem = HairRec & { kind?: string; shape?: string };

const CONFIG: Record<
  ExtraType,
  {
    column: "accessories" | "facial_hair" | "eyewear";
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
    .select("id, user_id, tier, profile, accessories, eyewear, facial_hair")
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
    // Already topped up — never double-charge.
    if (existing.length > config.base) {
      const items = await signItems(admin, existing);
      return NextResponse.json({ items, balance: null, alreadyOwned: true });
    }
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
  } else {
    // Already unlocked on this non-premium report.
    if (existing.length > 0) {
      const items = await signItems(admin, existing);
      return NextResponse.json({ items, balance: null, alreadyOwned: true });
    }
    cost = config.unlockCost;
    picks = basePicks(type, profile);
  }

  if (hasSupabaseAdmin) {
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

  const { data: photos } = await admin
    .from("photos")
    .select("storage_path, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const chosen = photos?.find((p) => p.role === "full") ?? photos?.[0] ?? null;
  if (!chosen) {
    return NextResponse.json(
      { error: "Upload a photo to generate previews on yourself" },
      { status: 422 },
    );
  }
  const { data: signed } = await admin.storage
    .from("photos")
    .createSignedUrl(chosen.storage_path, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 500 });
  }

  const merged: PreviewItem[] = [...existing];
  let anyGenerated = false;
  for (let i = 0; i < picks.length; i++) {
    const item = picks[i]!;
    const img = await generateImage(type, profile, item, signed.signedUrl);
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
  if (hasSupabaseAdmin) {
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
