import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateLookImage } from "@/lib/ai/pipeline";
import { matchLookItems } from "@/lib/data/catalog";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { styleProfileSchema, type ReportContent, type StyleProfile } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import {
  archiveReplacedLookImages,
} from "@/lib/data/look-sets";
import {
  cacheBustAssetUrl,
  renderAndStoreThreeQuarterLook,
} from "@/lib/data/look-three-quarter";
import { resolveLookSetReferencePhotos } from "@/lib/photo-tryon";
import {
  coerceBlazerType,
  coerceConstructorColor,
  coerceEyewearShape,
  coerceHatType,
  coerceLensColor,
  coerceOuterwearFabric,
  coerceShoeMaterial,
  coerceTieType,
  composeLookDescription,
  composeLookPalette,
  isAllowedConstructorSlot,
  isBlazer,
  isEyewear,
  isFabricOuterwear,
  isFootwear,
  isHat,
  isSunglasses,
  isTie,
  isTuckable,
  type ConstructorSlot,
} from "@/lib/look-constructor";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * Re-render one look in a set from constructor slots (type + colour). The new
 * description is the brief for generateLookImage — catalogue SKUs are rematched
 * afterwards, they do not drive the image.
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
  const setId: unknown = body?.setId;
  const lookIndex: unknown = body?.lookIndex;
  const rawSlots: unknown = body?.slots;
  if (typeof setId !== "string" || !setId) {
    return NextResponse.json({ error: "Missing setId" }, { status: 400 });
  }
  if (typeof lookIndex !== "number" || !Number.isInteger(lookIndex) || lookIndex < 0) {
    return NextResponse.json({ error: "Invalid lookIndex" }, { status: 400 });
  }
  if (!Array.isArray(rawSlots) || rawSlots.length < 1 || rawSlots.length > 8) {
    return NextResponse.json({ error: "Pick between 1 and 8 pieces" }, { status: 400 });
  }
  const includeThreeQuarter = body?.includeThreeQuarter === true;

  const slots: ConstructorSlot[] = [];
  for (const raw of rawSlots) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
    }
    const slot = raw as ConstructorSlot;
    if (
      typeof slot.category !== "string" ||
      typeof slot.garment !== "string" ||
      typeof slot.color !== "string" ||
      !isAllowedConstructorSlot(slot)
    ) {
      return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
    }
    const garment = slot.garment.trim().toLowerCase();
    const rawShape =
      typeof slot.shape === "string" ? slot.shape.trim().toLowerCase() : "";
    const tuck = slot.tuck === "in" || slot.tuck === "out" ? slot.tuck : undefined;
    const rawTie =
      typeof slot.tieType === "string" ? slot.tieType.trim().toLowerCase() : "";
    const rawLens =
      typeof slot.lensColor === "string" ? slot.lensColor.trim().toLowerCase() : "";
    const rawHat =
      typeof slot.hatType === "string" ? slot.hatType.trim().toLowerCase() : "";
    const rawMaterial =
      typeof slot.material === "string" ? slot.material.trim().toLowerCase() : "";
    const rawBlazer =
      typeof slot.blazerType === "string"
        ? slot.blazerType.trim().toLowerCase()
        : "";
    slots.push({
      category: slot.category,
      garment,
      color: coerceConstructorColor(slot.color),
      on: slot.on === false ? false : true,
      ...(isEyewear(garment)
        ? { shape: coerceEyewearShape(garment, rawShape || undefined) }
        : {}),
      ...(isTuckable(garment) && tuck ? { tuck } : {}),
      ...(isTie(garment) ? { tieType: coerceTieType(rawTie || undefined) } : {}),
      ...(isSunglasses(garment)
        ? { lensColor: coerceLensColor(rawLens || undefined) }
        : {}),
      ...(isHat(garment) ? { hatType: coerceHatType(rawHat || undefined) } : {}),
      ...(isFabricOuterwear(garment) && rawMaterial
        ? { material: coerceOuterwearFabric(garment, rawMaterial) }
        : {}),
      ...(isFootwear(slot.category) && rawMaterial
        ? { material: coerceShoeMaterial(rawMaterial) }
        : {}),
      ...(isBlazer(garment) && rawBlazer
        ? { blazerType: coerceBlazerType(rawBlazer) }
        : {}),
    });
  }

  const admin = createAdminSupabase();
  const { data: setRow } = await admin
    .from("look_sets")
    .select("id, report_id, created_at")
    .eq("id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!setRow) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  const reportId = (setRow.report_id as string | null) ?? null;
  const setCreatedAt = (setRow.created_at as string | null) ?? null;

  // Prefer idx, but don't use maybeSingle — duplicate (set_id, idx) rows make
  // PostgREST return no data. Fall back to position in the set if idx misses
  // (legacy rows with a null idx).
  type ConstructLookRow = {
    id: string;
    idx: number | null;
    title: string | null;
    description: string | null;
    palette: string[] | null;
    image_path: string | null;
    image_path_tq?: string | null;
    context: string | null;
    report_id?: string | null;
  };
  const lookSelectTq =
    "id, idx, title, description, palette, image_path, image_path_tq, context, report_id";
  const lookSelect =
    "id, idx, title, description, palette, image_path, context, report_id";
  async function selectLooks(columns: string) {
    return admin
      .from("looks")
      .select(columns)
      .eq("set_id", setId)
      .order("idx", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  }
  const { data: byIdx, error: byIdxErr } = await admin
    .from("looks")
    .select(lookSelectTq)
    .eq("set_id", setId)
    .eq("idx", lookIndex)
    .order("created_at", { ascending: false })
    .limit(1);
  if (byIdxErr && !/image_path_tq/.test(byIdxErr.message)) {
    console.error("[look-set] construct look by idx failed", setId, lookIndex, byIdxErr);
  }
  let lookRow: ConstructLookRow | null = !byIdxErr
    ? ((byIdx?.[0] as ConstructLookRow | undefined) ?? null)
    : null;
  if (!lookRow) {
    let { data: allLooks, error: allErr } = await selectLooks(lookSelectTq);
    if (allErr && /image_path_tq/.test(allErr.message)) {
      ({ data: allLooks, error: allErr } = await selectLooks(lookSelect));
    }
    if (allErr) {
      console.error("[look-set] construct looks list failed", setId, allErr);
    }
    const rows = (allLooks ?? []) as unknown as ConstructLookRow[];
    lookRow = rows.find((r) => r.idx === lookIndex) ?? rows[lookIndex] ?? null;
  }
  if (!lookRow) {
    return NextResponse.json(
      { error: "Look not found", code: "look_not_found" },
      { status: 409 },
    );
  }

  // Profile first without ref-photo columns (pre-0041 DBs error if selected).
  const { data: profRow, error: profErr } = await admin
    .from("look_set_profiles")
    .select("profile")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) {
    console.error("[look-set] construct profile failed", setId, profErr);
  }
  const parsed = styleProfileSchema.safeParse(profRow?.profile);
  let profile = parsed.success ? parsed.data : null;
  if (!profile && profRow?.profile && typeof profRow.profile === "object") {
    console.error(
      "[look-set] construct profile schema mismatch",
      setId,
      parsed.success ? null : parsed.error.issues,
    );
    profile = profRow.profile as StyleProfile;
  }
  if (!profile) {
    return NextResponse.json(
      { error: "Look profile missing", code: "profile_missing" },
      { status: 409 },
    );
  }

  let facePath: string | null = null;
  let fullPath: string | null = null;
  const { data: rp, error: rpErr } = await admin
    .from("look_set_profiles")
    .select("face_ref_path, full_ref_path")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!rpErr) {
    facePath = (rp?.face_ref_path as string | null) ?? null;
    fullPath = (rp?.full_ref_path as string | null) ?? null;
  }

  const regenCost = CREDIT_COSTS.look_regen;
  const tqCost = includeThreeQuarter ? CREDIT_COSTS.look_three_quarter : 0;
  const cost = regenCost + tqCost;
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

  const refs = await resolveLookSetReferencePhotos(admin, {
    userId: user.id,
    setId,
    facePath,
    fullPath,
    reportId: reportId ?? lookRow.report_id ?? null,
    reportCreatedAt: setCreatedAt,
  });
  const faceRefUrl = refs.faceUrl;
  const fullRefUrl = refs.fullUrl;

  const description = composeLookDescription(slots);
  const palette = composeLookPalette(slots);
  const title = lookRow.title ?? "Look";
  const look = {
    title,
    description,
    palette,
  };

  const img = await generateLookImage({
    profile,
    look,
    referenceImageUrl: fullRefUrl ?? undefined,
    faceReferenceImageUrl: faceRefUrl ?? undefined,
    profileReferenceImageUrl: refs.profileUrl ?? undefined,
  });
  if (!img) {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  const stamp = Date.now().toString(36);
  const imagePath = `${user.id}/looksets/${setId}/${lookIndex}-c${stamp}.${ext}`;
  const { error: upErr } = await admin.storage.from("assets").upload(imagePath, img.bytes, {
    contentType: img.mediaType,
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json({ error: "Could not store look" }, { status: 500 });
  }

  const previousTitle = lookRow.title ?? title;
  await archiveReplacedLookImages(admin, setId, [
    { path: lookRow.image_path, title: previousTitle },
    {
      path: lookRow.image_path_tq ?? null,
      title: `${previousTitle} · 3/4`,
    },
  ]);

  let tqPath: string | null = null;
  if (includeThreeQuarter) {
    tqPath = await renderAndStoreThreeQuarterLook({
      admin,
      userId: user.id,
      setId,
      lookIndex,
      profile,
      look,
      faceRefUrl,
      fullRefUrl,
      frontImagePath: imagePath,
    });
  }

  const update: Record<string, unknown> = {
    description,
    palette,
    image_path: imagePath,
    image_path_tq: tqPath,
  };
  let { error: updErr } = await admin
    .from("looks")
    .update(update)
    .eq("id", lookRow.id);
  if (updErr && /image_path_tq/.test(updErr.message)) {
    delete update.image_path_tq;
    ({ error: updErr } = await admin
      .from("looks")
      .update(update)
      .eq("id", lookRow.id));
  }
  if (updErr) {
    return NextResponse.json({ error: "Could not save look" }, { status: 500 });
  }

  let items: ShoppingItem[] = [];
  try {
    const content = {
      colors: { best: [], avoid: [] },
      looks: [
        {
          context: lookRow.context ?? "",
          title,
          description,
          palette,
        },
      ],
    } as unknown as ReportContent;
    const { data: setMeta } = await admin
      .from("look_sets")
      .select("style_id")
      .eq("id", setId)
      .maybeSingle();
    const styleId =
      typeof setMeta?.style_id === "string" ? setMeta.style_id : null;
    const matched = await matchLookItems(profile, content, { styleId });
    items = matched[0] ?? [];
    if (items.length) {
      const { data: li } = await admin
        .from("look_sets")
        .select("look_items")
        .eq("id", setId)
        .maybeSingle();
      const lookItems =
        (li?.look_items as Record<number, ShoppingItem[]> | null) ?? {};
      lookItems[lookRow.idx ?? lookIndex] = items;
      await admin.from("look_sets").update({ look_items: lookItems }).eq("id", setId);
    }
  } catch (err) {
    console.error("[look-set] construct rematch failed", setId, lookIndex, err);
  }

  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: regenCost,
        reason: "look_regen",
        refId: setId,
      });
      if (includeThreeQuarter && tqPath) {
        balance = await spendCredits(admin, {
          userId: user.id,
          amount: CREDIT_COSTS.look_three_quarter,
          reason: "look_three_quarter",
          refId: setId,
        });
      }
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

  const image = cacheBustAssetUrl(signedAssetProxyUrl(imagePath));
  const imageTq = tqPath
    ? cacheBustAssetUrl(signedAssetProxyUrl(tqPath))
    : null;
  return NextResponse.json({
    ok: true,
    balance,
    image,
    imageTq,
    threeQuarterFailed: includeThreeQuarter && !tqPath,
    title,
    description,
    palette,
    items,
  });
}
