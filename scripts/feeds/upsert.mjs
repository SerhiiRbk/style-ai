import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { embedText, dedupeProducts, colorKey, productVariantKey } from "./normalize.mjs";

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

const VALID_SOURCE_TYPES = ["feed", "scraper", "seed", "manual"];

/**
 * Map a canonical product to a DB row.
 *  - `embedding` omitted (undefined) ⇒ the column is left out of the upsert so an
 *    existing vector is preserved (used when the descriptive text is unchanged).
 *  - `unhide` ⇒ set hidden=false so a product that reappears in a feed becomes
 *    visible again; otherwise the hidden flag is left untouched (manual hides
 *    survive a re-import).
 */
function toRow(p, embedding, sourceType, unhide) {
  const now = new Date().toISOString();
  const provenance =
    (p.sourceType && VALID_SOURCE_TYPES.includes(p.sourceType)
      ? p.sourceType
      : null) ?? sourceType ?? "feed";
  const row = {
    source: p.source,
    external_id: p.externalId,
    sku: p.sku ?? null,
    brand: p.brand ?? null,
    title: p.title,
    description: p.description ?? null,
    category: p.category,
    gender: p.gender ?? null,
    color: p.color ?? p.colorHex ?? null,
    color_key: colorKey(p.color, p.colorHex),
    original_price: p.price ?? null,
    currency: p.currency ?? null,
    price_eur: p.priceEur ?? null,
    market: p.market ?? null,
    image_url: p.imageUrl ?? null,
    deeplink: p.deeplink,
    in_stock: p.inStock ?? null,
    attrs: p.attrs ?? null,
    source_type: provenance,
    ingested_at: now,
    updated_at: now,
  };
  if (embedding !== undefined) row.embedding = embedding;
  if (unhide) row.hidden = false;
  return row;
}

/**
 * Embed (batched) and upsert canonical products keyed by
 * (source, external_id, color_key).
 *
 * Re-import behaviour: rows that already exist are UPDATED in place (price,
 * stock, images, description, etc.). To save embedding cost, a product whose
 * descriptive text (brand/title/category/color/gender/description) is unchanged
 * keeps its existing vector — only the changed/new ones are re-embedded.
 *
 * `sourceType` (feed | scraper | seed | manual) is stamped on every row,
 * overridable per-product via `p.sourceType`. `unhide` re-shows products that
 * reappear in the upload.
 */
export async function embedAndUpsert(
  products,
  { model, batchSize = 100, onProgress, sourceType = "feed", unhide = false } = {},
) {
  const sb = getSupabase();
  const { products: unique } = dedupeProducts(products);
  let upserted = 0;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);

    // Pull existing rows for this batch to detect unchanged descriptive text.
    const sources = [...new Set(batch.map((p) => p.source))];
    const extIds = [...new Set(batch.map((p) => p.externalId))];
    const existing = new Map();
    const { data: prevRows, error: selErr } = await sb
      .from("products")
      .select(
        "source, external_id, color_key, brand, title, category, color, gender, description",
      )
      .in("source", sources)
      .in("external_id", extIds);
    if (selErr) throw new Error(selErr.message);
    for (const r of prevRows ?? []) {
      existing.set(productVariantKey(r), r);
    }

    const reuse = []; // exists + identical embed text ⇒ keep vector
    const fresh = []; // new or changed text ⇒ (re)embed
    for (const p of batch) {
      const prev = existing.get(productVariantKey(p));
      if (prev && embedText(prev) === embedText(p)) reuse.push(p);
      else fresh.push(p);
    }

    if (fresh.length) {
      const { embeddings } = await embedMany({
        model,
        values: fresh.map(embedText),
      });
      const rows = fresh.map((p, j) =>
        toRow(p, embeddings[j], sourceType, unhide),
      );
      const { error } = await sb
        .from("products")
        .upsert(rows, { onConflict: "source,external_id,color_key" });
      if (error) throw new Error(error.message);
      upserted += rows.length;
    }

    if (reuse.length) {
      // Embedding omitted ⇒ existing vector preserved. These all exist, so the
      // upsert is always an UPDATE (no null-embedding insert).
      const rows = reuse.map((p) => toRow(p, undefined, sourceType, unhide));
      const { error } = await sb
        .from("products")
        .upsert(rows, { onConflict: "source,external_id,color_key" });
      if (error) throw new Error(error.message);
      upserted += rows.length;
    }

    onProgress?.(upserted, unique.length);
  }
  return upserted;
}
