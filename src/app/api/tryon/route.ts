import { NextResponse } from "next/server";
import { env, hasAI, hasSupabase, hasVTON, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { runTryOn } from "@/lib/ai/tryon";
import {
  generateCatalogTryOnImage,
  type CatalogTryOnGarment,
} from "@/lib/ai/pipeline";
import { getFullLengthPhotoUrl, tryOnErrorCode } from "@/lib/photo-tryon";
import { absoluteUrl } from "@/lib/site-url";
import { isDemoReportId } from "@/lib/demo-report";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";

/** Image-model render / fal queue polling can exceed the default timeout. */
export const maxDuration = 300;

const MAX_TRYON_PRODUCTS = 4;

function normalizeGarmentUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return absoluteUrl(trimmed);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Try-on requires live mode" }, { status: 501 });
  }
  if (!hasAI && !hasVTON) {
    return NextResponse.json(
      { error: "Virtual try-on is not configured" },
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

  // Accept either a single productId or productIds (combined outfit, up to 4).
  const rawIds: unknown = body?.productIds;
  let productIds = Array.isArray(rawIds)
    ? rawIds.filter(
        (x): x is string => typeof x === "string" && x.trim() !== "",
      )
    : [];
  if (!productIds.length && typeof body?.productId === "string") {
    productIds = [body.productId];
  }
  productIds = [...new Set(productIds)].slice(0, MAX_TRYON_PRODUCTS);
  if (!productIds.length) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const fallbackImageUrl: string | undefined =
    typeof body?.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : undefined;
  const reportId: string | undefined =
    typeof body?.reportId === "string" && !isDemoReportId(body.reportId)
      ? body.reportId
      : undefined;

  const admin = createAdminSupabase();

  // Verify credit balance before running the (paid) render.
  const cost = CREDIT_COSTS.tryon;
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits for this try-on.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  const { data: productRows } = await admin
    .from("products")
    .select("id, title, category, color, image_url")
    .in("id", productIds);
  const byId = new Map((productRows ?? []).map((p) => [p.id as string, p]));

  const garments: CatalogTryOnGarment[] = [];
  for (const id of productIds) {
    const p = byId.get(id);
    if (!p) continue;
    let imageUrl = normalizeGarmentUrl(p.image_url as string | null);
    // Single-item legacy fallback: the report card passes its signed image.
    if (!imageUrl && productIds.length === 1 && fallbackImageUrl) {
      imageUrl = normalizeGarmentUrl(fallbackImageUrl);
    }
    garments.push({
      title: (p.title as string) ?? "Catalogue item",
      category: (p.category as string) ?? "Clothing",
      color: (p.color as string | null) ?? undefined,
      imageUrl,
    });
  }
  if (!garments.length) {
    return NextResponse.json({ error: "Products not found" }, { status: 404 });
  }

  // Engine selection: TRYON_ENGINE=image (default, look-render pipeline with
  // layering + multi-garment) | fal (FASHN single-garment VTON). Fall back to
  // whichever engine is actually configured / capable.
  let mode: "image" | "fal";
  if (env.tryonEngine === "fal" && garments.length === 1 && hasVTON) {
    mode = "fal";
  } else if (hasAI) {
    mode = "image";
  } else if (garments.length === 1 && hasVTON) {
    mode = "fal";
  } else {
    return NextResponse.json(
      { error: "Combined try-on is not configured on this server" },
      { status: 501 },
    );
  }

  if (mode === "fal" && !garments[0].imageUrl) {
    return NextResponse.json(
      { error: "Garment image unavailable for this product" },
      { status: 422 },
    );
  }

  const photo = await getFullLengthPhotoUrl(admin, user.id);
  if (!photo.ok) {
    return NextResponse.json(
      { error: photo.error, code: photo.code },
      { status: 422 },
    );
  }

  let render: { bytes: Uint8Array; mediaType: string } | null = null;
  let renderError = "Try-on failed";
  if (mode === "fal") {
    const r = await runTryOn({
      personImageUrl: photo.signedUrl,
      garmentImageUrl: garments[0].imageUrl!,
    });
    if (r.ok) render = { bytes: r.bytes, mediaType: r.mediaType };
    else renderError = r.error;
  } else {
    render = await generateCatalogTryOnImage({
      personImageUrl: photo.signedUrl,
      garments,
    });
    if (!render) renderError = "Try-on failed — please try again";
  }
  if (!render) {
    return NextResponse.json(
      { error: renderError, code: tryOnErrorCode(renderError) },
      { status: 502 },
    );
  }

  const ext = render.mediaType.includes("jpeg") ? "jpg" : "png";
  const fileKey =
    garments.length > 1 ? `outfit-${productIds.length}` : productIds[0];
  const path = `${user.id}/tryon/${fileKey}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, render.bytes, { contentType: render.mediaType, upsert: true });
  if (upErr) {
    console.error("[tryon] storage upload failed", upErr);
    return NextResponse.json({ error: "Could not store result" }, { status: 500 });
  }

  const garmentsMeta = productIds.map((id, i) => ({
    productId: id,
    title: garments[i]?.title ?? "Item",
    category: garments[i]?.category ?? "Clothing",
    imageUrl: garments[i]?.imageUrl ?? null,
  }));

  const { data: savedTryon, error: insertErr } = await admin
    .from("tryons")
    .insert({
      user_id: user.id,
      product_id: productIds[0],
      report_id: reportId ?? null,
      image_path: path,
      status: "ready",
      kind: productIds.length > 1 ? "outfit" : "product",
      garments: garmentsMeta,
    })
    .select("id")
    .single();
  if (insertErr) {
    console.error("[tryon] tryons insert failed", insertErr);
  }

  // Charge after success so failed renders are never billed.
  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "tryon",
        refId: reportId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits for this try-on.",
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

  const { data: out, error: signErr } = await admin.storage
    .from("assets")
    .createSignedUrl(path, 600);
  if (signErr || !out?.signedUrl) {
    console.error("[tryon] signed URL failed", signErr);
    return NextResponse.json(
      { error: "Try-on saved but preview URL failed" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      url: out.signedUrl,
      balance,
      tryonId: savedTryon?.id ?? null,
      savedToReport: Boolean(reportId && savedTryon),
      garments: garmentsMeta,
    },
    { status: 201 },
  );
}
