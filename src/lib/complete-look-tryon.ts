import "server-only";
import {
  generateCatalogTryOnImage,
  generateReportTryOnImage,
  type CatalogTryOnGarment,
} from "@/lib/ai/pipeline";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { tryOnErrorCode } from "@/lib/photo-tryon";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminSupabase } from "@/lib/supabase/server";
import type { ShoppingItem } from "@/lib/report";
import {
  catalogTryOnGarmentsText,
  pickTryOnGarments,
  upgradeCatalogImageUrl,
} from "@/lib/look-tryon";
import { MAX_TRYON_GARMENTS } from "@/lib/tryon-limits";

type AdminClient = ReturnType<typeof createAdminSupabase>;

function normalizeGarmentUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return absoluteUrl(trimmed);
  if (/^https?:\/\//i.test(trimmed)) return upgradeCatalogImageUrl(trimmed);
  return null;
}

export type CompleteLookTryOnResult =
  | { ok: true; url: string; tryonId: string | null }
  | { ok: false; error: string; status: number; code?: string };

/** Render the completed shop on the user's photo. Charge happens in the route. */
export async function renderCompleteLookTryOn(opts: {
  admin: AdminClient;
  userId: string;
  items: ShoppingItem[];
  personImageUrl: string;
  style: "photo" | "studio";
  occasionId?: string | null;
}): Promise<CompleteLookTryOnResult> {
  const garments: CatalogTryOnGarment[] = pickTryOnGarments(
    opts.items.map((item) => ({
      title: item.title,
      category: item.category,
      color: item.colorName ?? item.color,
      imageUrl: normalizeGarmentUrl(item.image),
    })),
    MAX_TRYON_GARMENTS,
  );
  if (!garments.length) {
    return { ok: false, error: "No pieces to try on", status: 400 };
  }

  let render: { bytes: Uint8Array; mediaType: string } | null = null;
  let renderError = "Try-on failed";
  if (opts.style === "studio") {
    const garmentImages = garments
      .filter(
        (g): g is CatalogTryOnGarment & { imageUrl: string } =>
          Boolean(g.imageUrl && /^https?:\/\//i.test(g.imageUrl)),
      )
      .map((g) => ({
        url: g.imageUrl,
        title: g.title,
        category: g.category,
      }));
    render = await generateReportTryOnImage({
      personImageUrl: opts.personImageUrl,
      garmentsText: catalogTryOnGarmentsText(garments),
      garmentImageUrls: garmentImages.map((g) => g.url),
      garmentImages,
      occasionId: opts.occasionId,
    });
    if (!render) renderError = "Try-on failed — please try again";
  } else {
    render = await generateCatalogTryOnImage({
      personImageUrl: opts.personImageUrl,
      garments,
    });
    if (!render) renderError = "Try-on failed — please try again";
  }
  if (!render) {
    return {
      ok: false,
      error: renderError,
      status: 502,
      code: tryOnErrorCode(renderError),
    };
  }

  const ext = render.mediaType.includes("jpeg") ? "jpg" : "png";
  const productIds = opts.items
    .map((item) => item.productId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const fileKey =
    productIds.length > 1 ? `outfit-${productIds.length}` : productIds[0] ?? "look";
  const path = `${opts.userId}/tryon/${fileKey}-${Date.now()}.${ext}`;
  const { error: upErr } = await opts.admin.storage
    .from("assets")
    .upload(path, render.bytes, { contentType: render.mediaType, upsert: true });
  if (upErr) {
    console.error("[complete-look] try-on upload failed", upErr);
    return { ok: false, error: "Could not store result", status: 500 };
  }

  const garmentsMeta = productIds.map((id, i) => ({
    productId: id,
    title: garments[i]?.title ?? "Item",
    category: garments[i]?.category ?? "Clothing",
    imageUrl: garments[i]?.imageUrl ?? null,
  }));
  const tryonRow: Record<string, unknown> = {
    user_id: opts.userId,
    product_id: productIds[0] ?? null,
    report_id: null,
    image_path: path,
    status: "ready",
    kind: productIds.length > 1 ? "outfit" : "product",
    origin: "catalog",
    garments: garmentsMeta,
  };
  let { data: savedTryon, error: insertErr } = await opts.admin
    .from("tryons")
    .insert(tryonRow)
    .select("id")
    .single();
  if (insertErr && /origin/i.test(insertErr.message)) {
    delete tryonRow.origin;
    ({ data: savedTryon, error: insertErr } = await opts.admin
      .from("tryons")
      .insert(tryonRow)
      .select("id")
      .single());
  }
  if (insertErr) {
    console.error("[complete-look] tryons insert failed", insertErr);
  }

  return {
    ok: true,
    url: signedAssetProxyUrl(path),
    tryonId: savedTryon?.id ?? null,
  };
}
