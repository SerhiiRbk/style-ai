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
import { styleProfileSchema, type ReportContent } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import {
  getCatalogTryOnPhoto,
  signPhotoPath,
} from "@/lib/photo-tryon";
import {
  composeLookDescription,
  composeLookPalette,
  isAllowedConstructorSlot,
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
  if (!Array.isArray(rawSlots) || rawSlots.length < 1 || rawSlots.length > 6) {
    return NextResponse.json({ error: "Pick between 1 and 6 pieces" }, { status: 400 });
  }

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
    slots.push({
      category: slot.category,
      garment: slot.garment.trim().toLowerCase(),
      color: slot.color.trim().toLowerCase(),
    });
  }

  const admin = createAdminSupabase();
  const { data: setRow } = await admin
    .from("look_sets")
    .select("id")
    .eq("id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!setRow) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const { data: lookRow } = await admin
    .from("looks")
    .select("idx, title, description, palette, image_path, context")
    .eq("set_id", setId)
    .eq("idx", lookIndex)
    .maybeSingle();
  if (!lookRow?.image_path) {
    return NextResponse.json({ error: "Look not ready" }, { status: 409 });
  }

  const { data: profRow } = await admin
    .from("look_set_profiles")
    .select("profile, face_ref_path, full_ref_path")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  const parsed = styleProfileSchema.safeParse(profRow?.profile);
  if (!parsed.success) {
    return NextResponse.json({ error: "Look profile missing" }, { status: 409 });
  }
  const profile = parsed.data;

  const cost = CREDIT_COSTS.look_regen;
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

  const facePath = (profRow?.face_ref_path as string | null) ?? null;
  const fullPath = (profRow?.full_ref_path as string | null) ?? null;
  let faceRefUrl = facePath ? await signPhotoPath(admin, facePath) : null;
  let fullRefUrl = fullPath ? await signPhotoPath(admin, fullPath) : null;
  if (!fullRefUrl) {
    const cat = await getCatalogTryOnPhoto(admin, user.id);
    if (cat.ok) fullRefUrl = cat.signedUrl;
  }

  const description = composeLookDescription(slots);
  const palette = composeLookPalette(slots);
  const title = (lookRow.title as string | null) ?? "Look";
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

  const { error: updErr } = await admin
    .from("looks")
    .update({
      description,
      palette,
      image_path: imagePath,
    })
    .eq("set_id", setId)
    .eq("idx", lookIndex);
  if (updErr) {
    return NextResponse.json({ error: "Could not save look" }, { status: 500 });
  }

  let items: ShoppingItem[] = [];
  try {
    const content = {
      colors: { best: [], avoid: [] },
      looks: [
        {
          context: (lookRow.context as string | null) ?? "",
          title,
          description,
          palette,
        },
      ],
    } as unknown as ReportContent;
    const matched = await matchLookItems(profile, content);
    items = matched[0] ?? [];
    if (items.length) {
      const { data: li } = await admin
        .from("look_sets")
        .select("look_items")
        .eq("id", setId)
        .maybeSingle();
      const lookItems =
        (li?.look_items as Record<number, ShoppingItem[]> | null) ?? {};
      lookItems[lookIndex] = items;
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
        amount: cost,
        reason: "look_regen",
        refId: setId,
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

  const signed = signedAssetProxyUrl(imagePath);
  const image = `${signed}${signed.includes("?") ? "&" : "?"}v=${Date.now()}`;
  return NextResponse.json({
    ok: true,
    balance,
    image,
    title,
    description,
    palette,
    items,
  });
}
