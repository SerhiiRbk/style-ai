import { NextResponse } from "next/server";
import { isDemoReportId } from "@/lib/demo-report";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  generateHairImage,
  generateFacialHairImage,
  generateEyewearImage,
  generateAccessoryImage,
  generateHeadwearImage,
} from "@/lib/ai/pipeline";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import type { HairRec } from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { getReportGroomingPhotoUrl } from "@/lib/photo-tryon";

export const maxDuration = 120;
const SIGNED_TTL = 3600;

type Kind = "hair" | "facial_hair" | "eyewear" | "accessories" | "headwear";
type PreviewItem = HairRec & { kind?: string; shape?: string };

const GROOMING: Record<
  Exclude<Kind, "hair">,
  { column: "facial_hair" | "eyewear" | "accessories" | "headwear"; prefix: string }
> = {
  facial_hair: { column: "facial_hair", prefix: "facial-hair" },
  eyewear: { column: "eyewear", prefix: "eyewear" },
  accessories: { column: "accessories", prefix: "accessory" },
  headwear: { column: "headwear", prefix: "headwear" },
};

type Admin = ReturnType<typeof createAdminSupabase>;

/**
 * Persist a freshly-rendered imagePath into a single element of a report's JSON
 * column WITHOUT rewriting the whole array. Generation takes 30–90s, so a plain
 * read-modify-write of the array races with a concurrent regen of a different
 * index and loses updates. We update only the targeted JSON path atomically at
 * the DB layer (set_report_json). If that RPC isn't deployed yet we fall back to
 * re-reading the freshest column just before writing, which shrinks the race
 * window from the whole generation to a few milliseconds.
 */
async function setReportJsonElement(
  admin: Admin,
  reportId: string,
  column: Kind,
  path: string[],
  item: unknown,
  fallback: () => Promise<void>,
): Promise<void> {
  const { error } = await admin.rpc("set_report_json", {
    p_report_id: reportId,
    p_column: column,
    p_path: path,
    p_item: item,
  });
  if (error) {
    console.warn(
      "[report-photo] set_report_json RPC unavailable, using re-read fallback",
      error.message,
    );
    await fallback();
  }
}

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
  if (!reportId || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }
  if (!kind || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select(
      "id, user_id, profile, hair, facial_hair, eyewear, accessories, headwear, created_at",
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
      console.error("[report-photo] hair generation returned no image", {
        reportId,
        index,
      });
      return NextResponse.json(
        { error: "Image generation is busy — please try again." },
        { status: 502 },
      );
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
    const updatedItem = isSide
      ? { ...item, imagePathSide: newPath }
      : { ...item, imagePath: newPath };
    await setReportJsonElement(
      admin,
      reportId,
      "hair",
      [group, String(index)],
      updatedItem,
      async () => {
        const { data: fresh } = await admin
          .from("reports")
          .select("hair")
          .eq("id", reportId)
          .single();
        const h =
          (fresh?.hair as { recommend: HairRec[]; avoid: HairRec[] } | null) ??
          hair;
        const l = (h[group] ?? list) as HairRec[];
        l[index] = { ...(l[index] ?? item), ...updatedItem };
        await admin.from("reports").update({ hair: h }).eq("id", reportId);
      },
    );
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
    } else if (kind === "accessories") {
      img = await generateAccessoryImage({
        profile,
        accessory: {
          name: item.name,
          why: item.why,
          kind: item.kind as "scarf" | "neckwear" | "tie" | undefined,
        },
        referenceImageUrl,
      });
    } else {
      img = await generateHeadwearImage({
        profile,
        headwear: {
          name: item.name,
          why: item.why,
          kind: item.kind as "hat" | "cap" | "beanie" | "bandana" | undefined,
        },
        referenceImageUrl,
      });
    }
    if (!img) {
      console.error(
        `[report-photo] ${kind} generation returned no image`,
        { reportId, index },
      );
      return NextResponse.json(
        { error: "Image generation is busy — please try again." },
        { status: 502 },
      );
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
    const updatedItem = { ...item, imagePath: newPath };
    await setReportJsonElement(
      admin,
      reportId,
      cfg.column,
      [String(index)],
      updatedItem,
      async () => {
        const { data: fresh } = await admin
          .from("reports")
          .select(cfg.column)
          .eq("id", reportId)
          .single();
        const a =
          ((fresh as Record<string, unknown> | null)?.[cfg.column] as
            | PreviewItem[]
            | null) ?? arr;
        a[index] = { ...(a[index] ?? item), ...updatedItem };
        await admin
          .from("reports")
          .update({ [cfg.column]: a })
          .eq("id", reportId);
      },
    );
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

  return NextResponse.json({
    image: signed?.signedUrl ? signedAssetProxyUrl(newPath) : null,
    balance,
  });
}
