import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { embedText } from "./normalize.mjs";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function toRow(p, embedding) {
  return {
    source: p.source,
    external_id: p.externalId,
    sku: p.sku ?? null,
    brand: p.brand ?? null,
    title: p.title,
    description: p.description ?? null,
    category: p.category,
    gender: p.gender ?? null,
    color: p.color ?? p.colorHex ?? null,
    original_price: p.price ?? null,
    currency: p.currency ?? null,
    price_eur: p.priceEur ?? null,
    market: p.market ?? null,
    image_url: p.imageUrl ?? null,
    deeplink: p.deeplink,
    in_stock: p.inStock ?? null,
    attrs: p.attrs ?? null,
    embedding,
    updated_at: new Date().toISOString(),
  };
}

/** Embed (batched) and upsert canonical products keyed by (source, external_id). */
export async function embedAndUpsert(
  products,
  { model, batchSize = 100, onProgress } = {},
) {
  const sb = getSupabase();
  let upserted = 0;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model,
      values: batch.map(embedText),
    });
    const rows = batch.map((p, j) => toRow(p, embeddings[j]));
    const { error } = await sb
      .from("products")
      .upsert(rows, { onConflict: "source,external_id" });
    if (error) throw new Error(error.message);
    upserted += rows.length;
    onProgress?.(upserted, products.length);
  }
  return upserted;
}
