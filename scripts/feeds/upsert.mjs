import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import {
  embedText,
  dedupeProducts,
  colorKey,
  productVariantKey,
  productKey,
  normalizeCountry,
} from "./normalize.mjs";

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

/** Map a canonical product to one per-country offer row. */
function offerRow(productId, p, sourceType) {
  const provenance =
    (p.sourceType && VALID_SOURCE_TYPES.includes(p.sourceType)
      ? p.sourceType
      : null) ?? sourceType ?? "feed";
  return {
    product_id: productId,
    country: normalizeCountry(p.country),
    market: p.market ?? null,
    currency: p.currency ?? null,
    price_native: p.price ?? null,
    original_price: p.price ?? null,
    price_eur: p.priceEur ?? null,
    deeplink: p.deeplink,
    image_url: p.imageUrl ?? null,
    in_stock: p.inStock ?? null,
    source: p.source ?? null,
    source_type: provenance,
    updated_at: new Date().toISOString(),
  };
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
  for (const p of unique) p.__pk = productKey(p);

  let upserted = 0;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);

    // Group rows by cross-country identity. The same product sold in several
    // countries collapses into one `products` row with many `product_offers`.
    const groups = new Map();
    for (const p of batch) {
      if (!groups.has(p.__pk)) groups.set(p.__pk, []);
      groups.get(p.__pk).push(p);
    }

    // (a) Merge targets: existing products sharing the same product_key.
    const pks = [...groups.keys()];
    const byPk = new Map();
    {
      const { data, error } = await sb
        .from("products")
        .select(
          "id, product_key, brand, title, category, color, gender, description",
        )
        .in("product_key", pks);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) if (!byPk.has(r.product_key)) byPk.set(r.product_key, r);
    }

    // (b) Legacy variant rows (same source/external_id/colour) — lets us reuse
    //     an existing vector when the descriptive text is unchanged, and lets a
    //     pre-existing row adopt the new product_key on re-import.
    const sources = [...new Set(batch.map((p) => p.source))];
    const extIds = [...new Set(batch.map((p) => p.externalId))];
    const variantPrev = new Map();
    {
      const { data, error } = await sb
        .from("products")
        .select(
          "id, source, external_id, color_key, brand, title, category, color, gender, description",
        )
        .in("source", sources)
        .in("external_id", extIds);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) variantPrev.set(productVariantKey(r), r);
    }

    // Decide which identities need a (re)embed, then embed them in one batch.
    const needEmbed = [];
    for (const [pk, items] of groups) {
      const rep = items[0];
      const prev = byPk.get(pk) ?? variantPrev.get(productVariantKey(rep));
      if (!(prev && embedText(prev) === embedText(rep))) needEmbed.push(pk);
    }
    const embByPk = new Map();
    if (needEmbed.length) {
      const reps = needEmbed.map((pk) => groups.get(pk)[0]);
      const { embeddings } = await embedMany({ model, values: reps.map(embedText) });
      reps.forEach((rep, j) => embByPk.set(rep.__pk, embeddings[j]));
    }

    for (const [pk, items] of groups) {
      const rep = items[0];
      const emb = embByPk.get(pk); // undefined ⇒ preserve existing vector
      const target = byPk.get(pk);
      let productId;

      if (target) {
        // Merge into the canonical row — refresh descriptive/commercial fields
        // but keep its identity columns (and first-seen) intact.
        productId = target.id;
        const upd = toRow(rep, emb, sourceType, unhide);
        upd.product_key = pk;
        delete upd.ingested_at;
        delete upd.source;
        delete upd.external_id;
        delete upd.color_key;
        const { error } = await sb.from("products").update(upd).eq("id", productId);
        if (error) throw new Error(error.message);
      } else {
        // No merge target yet: upsert by the legacy variant identity (creates a
        // new row, or adopts an existing legacy row and stamps its product_key).
        const row = toRow(rep, emb, sourceType, unhide);
        row.product_key = pk;
        const { data, error } = await sb
          .from("products")
          .upsert(row, { onConflict: "source,external_id,color_key" })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        productId = data.id;
        byPk.set(pk, { id: productId, product_key: pk });
      }

      // One offer per country (collapse repeated countries within the upload).
      const offersByCountry = new Map();
      for (const p of items) {
        offersByCountry.set(normalizeCountry(p.country), p);
      }
      const offers = [...offersByCountry.values()].map((p) =>
        offerRow(productId, p, sourceType),
      );
      const { error: offErr } = await sb
        .from("product_offers")
        .upsert(offers, { onConflict: "product_id,country" });
      if (offErr) throw new Error(offErr.message);

      upserted += items.length;
    }

    onProgress?.(upserted, unique.length);
  }
  return upserted;
}
