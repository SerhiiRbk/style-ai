import "server-only";
import { randomUUID } from "node:crypto";
import { embed } from "ai";
import { embedText } from "../../../scripts/feeds/normalize.mjs";
import { offerRow, toRow } from "../../../scripts/feeds/upsert.mjs";
import { env, hasAI } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { parseAdminProduct } from "./admin-catalog-product";

export const ADMIN_PRODUCT_SELECT =
  "id,source,external_id,brand,title,description,category,gender,color,original_price,currency,price_eur,image_url,deeplink,hidden,source_type,garment_subtype,material_family";

type Existing = {
  id: string;
  source: string | null;
  external_id: string | null;
  source_type?: string | null;
};

function mergeWithExisting(
  body: unknown,
  row: {
    title: string;
    brand: string | null;
    category: string | null;
    color: string | null;
    original_price: number | null;
    price_eur: number | null;
    currency: string | null;
    image_url: string | null;
    deeplink: string | null;
    gender: string | null;
    description: string | null;
  },
): Record<string, unknown> {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return {
    title: b.title ?? row.title,
    brand: b.brand ?? row.brand,
    category: b.category ?? row.category,
    color: b.color ?? row.color,
    price: b.price ?? row.original_price ?? row.price_eur,
    currency: b.currency ?? row.currency ?? "EUR",
    imageUrl: b.imageUrl ?? b.image_url ?? row.image_url,
    deeplink: b.deeplink ?? row.deeplink,
    gender: b.gender ?? row.gender,
    description: b.description ?? row.description,
  };
}

export async function persistAdminProduct(
  body: unknown,
  existing?: Existing,
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const admin = createAdminSupabase();
  let payload = body;
  if (existing) {
    const { data: full, error: loadErr } = await admin
      .from("products")
      .select(
        "title,brand,category,color,original_price,price_eur,currency,image_url,deeplink,gender,description",
      )
      .eq("id", existing.id)
      .single();
    if (loadErr || !full) {
      return { ok: false, status: 404, error: "Product not found" };
    }
    payload = mergeWithExisting(body, full);
  }

  const parsed = parseAdminProduct(payload, {
    source: existing?.source ?? undefined,
    externalId: existing?.external_id ?? `admin-${randomUUID()}`,
  });
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (!parsed.product.externalId) {
    parsed.product.externalId = `admin-${randomUUID()}`;
  }

  let embedding: number[] | undefined;
  if (hasAI) {
    const { embedding: vec } = await embed({
      model: env.embedModel,
      value: embedText(parsed.product),
    });
    embedding = vec;
  }

  const provenance =
    existing?.source_type === "feed" ||
    existing?.source_type === "scraper" ||
    existing?.source_type === "seed" ||
    existing?.source_type === "manual"
      ? existing.source_type
      : "manual";
  const row = toRow(parsed.product, embedding, provenance, !existing);

  let productId = existing?.id;
  if (existing) {
    delete row.ingested_at;
    const { error } = await admin.from("products").update(row).eq("id", existing.id);
    if (error) return { ok: false, status: 500, error: error.message };
  } else {
    const { data, error } = await admin
      .from("products")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, status: 500, error: error?.message ?? "Insert failed" };
    }
    productId = data.id;
  }

  const offer = offerRow(productId!, parsed.product, "manual");
  const { error: offErr } = await admin
    .from("product_offers")
    .upsert(offer, { onConflict: "product_id,country" });
  if (offErr) return { ok: false, status: 500, error: offErr.message };

  return { ok: true, id: productId! };
}
