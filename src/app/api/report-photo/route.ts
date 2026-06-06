import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  generateHairImage,
  generateFacialHairImage,
  generateEyewearImage,
  generateAccessoryImage,
} from "@/lib/ai/pipeline";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import type { HairRec } from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";

export const maxDuration = 120;
const SIGNED_TTL = 3600;

type Kind = "hair" | "facial_hair" | "eyewear" | "accessories";
type PreviewItem = HairRec & { kind?: string; shape?: string };

const GROOMING: Record<
  Exclude<Kind, "hair">,
  { column: "facial_hair" | "eyewear" | "accessories"; prefix: string }
> = {
  facial_hair: { column: "facial_hair", prefix: "facial-hair" },
  eyewear: { column: "eyewear", prefix: "eyewear" },
  accessories: { column: "accessories", prefix: "accessory" },
};

/**
 * Re-generate a single report photo (a hairstyle, facial-hair, eyewear or
 * accessory preview) on the owner's reference photo for 1 credit. The new image
 * overwrites the same storage path so the report simply shows the fresh render.
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
  const kind = body?.kind as Kind | undefined;
  const index = Number(body?.index);
  if (!reportId || reportId === "demo") {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }
  if (!kind || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("id, user_id, profile, hair, facial_hair, eyewear, accessories")
    .eq("id", reportId)
    .single();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const profile = row.profile as StyleProfile | null;
  if (!profile) {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }

  const cost = CREDIT_COSTS.regen;
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        { error: "Not enough credits.", code: "insufficient_credits", balance, needed: cost },
        { status: 402 },
      );
    }
  }

  // Owner's reference portrait.
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
  const { data: signedPhoto } = await admin.storage
    .from("photos")
    .createSignedUrl(chosen.storage_path, 600);
  if (!signedPhoto?.signedUrl) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 500 });
  }
  const referenceImageUrl = signedPhoto.signedUrl;

  let newPath: string | null = null;
  let oldPath: string | null = null;
  const version = Date.now();

  if (kind === "hair") {
    const group = body?.group === "avoid" ? "avoid" : "recommend";
    const isSide = body?.angle === "side";
    const hair = row.hair as { recommend: HairRec[]; avoid: HairRec[] } | null;
    const list = hair?.[group];
    const item = list?.[index];
    if (!hair || !list || !item) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    const img = await generateHairImage({
      profile,
      hair: { name: item.name, why: item.why },
      recommend: group === "recommend",
      referenceImageUrl,
      angle: isSide ? "three_quarter" : "front",
    });
    if (!img) {
      return NextResponse.json({ error: "Generation failed" }, { status: 502 });
    }
    const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
    oldPath = (isSide ? item.imagePathSide : item.imagePath) ?? null;
    newPath = isSide
      ? `${user.id}/${reportId}/hair-${group}-${index}-side-v${version}.${ext}`
      : `${user.id}/${reportId}/hair-${group}-${index}-v${version}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("assets")
      .upload(newPath, img.bytes, { contentType: img.mediaType, upsert: true });
    if (upErr) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    list[index] = isSide
      ? { ...item, imagePathSide: newPath }
      : { ...item, imagePath: newPath };
    await admin.from("reports").update({ hair }).eq("id", reportId);
  } else {
    const cfg = GROOMING[kind];
    if (!cfg) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const arr = (row as Record<string, unknown>)[cfg.column] as
      | PreviewItem[]
      | null;
    const item = arr?.[index];
    if (!arr || !item) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    let img: { bytes: Uint8Array; mediaType: string } | null = null;
    if (kind === "facial_hair") {
      img = await generateFacialHairImage({
        profile,
        style: { name: item.name, why: item.why },
        referenceImageUrl,
      });
    } else if (kind === "eyewear") {
      img = await generateEyewearImage({
        profile,
        frame: {
          name: item.name,
          why: item.why,
          shape: item.shape,
          kind: item.kind as "optical" | "sun" | undefined,
        },
        referenceImageUrl,
      });
    } else {
      img = await generateAccessoryImage({
        profile,
        accessory: {
          name: item.name,
          why: item.why,
          kind: item.kind as "scarf" | "neckwear" | "tie" | undefined,
        },
        referenceImageUrl,
      });
    }
    if (!img) {
      return NextResponse.json({ error: "Generation failed" }, { status: 502 });
    }
    const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
    oldPath = item.imagePath ?? null;
    newPath = `${user.id}/${reportId}/${cfg.prefix}-${index}-v${version}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("assets")
      .upload(newPath, img.bytes, { contentType: img.mediaType, upsert: true });
    if (upErr) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    arr[index] = { ...item, imagePath: newPath };
    await admin.from("reports").update({ [cfg.column]: arr }).eq("id", reportId);
  }

  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "regen",
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

  // Best-effort cleanup of the previous render so storage doesn't accumulate.
  if (oldPath && oldPath !== newPath) {
    await admin.storage
      .from("assets")
      .remove([oldPath])
      .catch(() => undefined);
  }

  const { data: signed } = await admin.storage
    .from("assets")
    .createSignedUrl(newPath, SIGNED_TTL);

  return NextResponse.json({ image: signed?.signedUrl ?? null, balance });
}
