// Scrape Porto Richezze (Shopify) men's collection → canonical product JSON.
// One row per COLOUR (Shopify Color option); sizes fold into attrs. Output feeds
// scripts/import-scraper-json.mjs (which POSTs to /api/catalog/import).
//
//   node scripts/scrape-portorichezze.mjs [out.json]
import { writeFile } from "node:fs/promises";

const BASE = "https://portorichezze.com";
const COLLECTION = "all-mens";
const SOURCE = "scrapper:portorichezze";
const BRAND = "Porto Richezze";
const CURRENCY = "EUR"; // from /meta.json (country PL, currency EUR)
const MARKET = "PL";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const out = process.argv[2] || "/private/tmp/portorichezze.json";

const stripHtml = (s) =>
  (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const colorOptionIndex = (product) => {
  const i = (product.options || []).findIndex((o) =>
    /colou?r/i.test(o.name || ""),
  );
  return i >= 0 ? i + 1 : null; // Shopify variant.option1/2/3 are 1-based
};

const imgForVariant = (product, variant) => {
  // Colour-specific photo lives on the variant. This store leaves
  // images[].variants empty, so variant.featured_image is the only reliable
  // per-colour source; fall back to the image→variant map, then the first image.
  if (variant?.featured_image?.src) return variant.featured_image.src;
  const img = (product.images || []).find((im) =>
    (im.variants || []).includes(variant?.id),
  );
  return img?.src || product.images?.[0]?.src || null;
};

async function fetchAll() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    // &currency=EUR pins the presentment currency — without it Shopify's edge
    // non-deterministically serves CZK/PLN (see the median guard below).
    const r = await fetch(
      `${BASE}/collections/${COLLECTION}/products.json?limit=250&page=${page}&currency=${CURRENCY}`,
      { headers: { "User-Agent": UA, Accept: "application/json" } },
    );
    if (!r.ok) throw new Error(`products.json page ${page} → HTTP ${r.status}`);
    const ps = (await r.json()).products || [];
    if (!ps.length) break;
    all.push(...ps);
    if (ps.length < 250) break;
  }
  return all;
}

function toRows(product) {
  const ci = colorOptionIndex(product);
  const variants = product.variants || [];
  const desc = stripHtml(product.body_html);
  const sizeOptIdx = (product.options || []).findIndex((o) => /size/i.test(o.name || ""));
  const sizeKey = sizeOptIdx >= 0 ? `option${sizeOptIdx + 1}` : null;

  // group variants by colour value (or a single null-colour group)
  const groups = new Map();
  for (const v of variants) {
    const color = ci ? v[`option${ci}`] : null;
    const key = color ?? "__nocolor__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }

  const rows = [];
  for (const [key, vs] of groups) {
    const color = key === "__nocolor__" ? null : key;
    const rep = vs.find((v) => v.available) || vs[0];
    const price = Math.min(...vs.map((v) => Number(v.price)).filter((n) => n > 0));
    const sizes = sizeKey
      ? [...new Set(vs.map((v) => v[sizeKey]).filter(Boolean))]
      : [];
    rows.push({
      source: SOURCE,
      externalId: `portorichezze-${product.id}`,
      sku: rep.sku || String(rep.id),
      brand: BRAND,
      title: product.title,
      description: desc,
      category: product.product_type || "",
      gender: "men",
      color,
      colorHex: null,
      price: Number.isFinite(price) ? price : Number(rep.price) || null,
      currency: CURRENCY,
      priceEur: null,
      market: MARKET,
      imageUrl: imgForVariant(product, rep),
      deeplink: `${BASE}/products/${product.handle}?variant=${rep.id}`,
      inStock: vs.some((v) => v.available),
      attrs: {
        sizes: sizes.length ? sizes : null,
        sourceUrl: `${BASE}/products/${product.handle}`,
        scrapedAt: null,
      },
    });
  }
  return rows;
}

// Shopify serves geo/edge-dependent presentment currency; the shop's base is
// EUR (items ~40–260), but some edges return CZK (~1000–6400). Guard on the
// median price so a wrong-currency run never gets written/imported; retry.
const EUR_MEDIAN_MAX = 500;
let products;
let rows;
for (let attempt = 1; attempt <= 5; attempt++) {
  products = await fetchAll();
  rows = products.flatMap(toRows);
  const prices = rows.map((r) => r.price).filter(Number.isFinite).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;
  if (median <= EUR_MEDIAN_MAX) break;
  console.error(`attempt ${attempt}: median price ${median} looks non-EUR (CZK?) — retrying`);
  if (attempt === 5) {
    console.error("Could not obtain EUR prices after 5 tries; aborting (nothing written).");
    process.exit(1);
  }
}
await writeFile(out, JSON.stringify({ products: rows }, null, 2));
console.log(
  `products=${products.length} → colour-rows=${rows.length} written to ${out}`,
);
