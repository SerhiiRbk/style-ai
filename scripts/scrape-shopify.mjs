// Generic Shopify collection scraper → canonical product JSON (one row per
// COLOUR). Bakes in the lessons from the Porto Richezze import:
//   • ?currency=<base> pins the presentment currency (Shopify's edge otherwise
//     serves a geo currency non-deterministically);
//   • a median-price guard aborts a wrong-currency run before it's written;
//   • per-colour photo comes from variant.featured_image (images[].variants is
//     often empty).
// Output feeds scripts/import-scraper-json.mjs.
//
//   node scripts/scrape-shopify.mjs --domain valmontimode.com --collection men-1 \
//     [--brand Valmonti] [--currency GBP] [--market NL] [--source scrapper:x] \
//     [--out /private/tmp/x.json] [--max-median 500]
import { writeFile } from "node:fs/promises";

const argv = process.argv.slice(2);
const arg = (name, d = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const H = { "User-Agent": UA, Accept: "application/json" };

const domain = (arg("--domain") || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const collection = arg("--collection");
if (!domain || !collection) {
  console.error("required: --domain <host> --collection <handle>");
  process.exit(1);
}
const BASE = `https://${domain}`;
const maxMedian = Number(arg("--max-median", "500"));

const meta = await fetch(`${BASE}/meta.json`, { headers: H }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const CURRENCY = (arg("--currency") || meta.currency || "EUR").toUpperCase();
const MARKET = (arg("--market") || meta.country || "").toUpperCase() || null;
let BRAND = arg("--brand") || meta.name || domain;
if (/^my store$/i.test(BRAND)) BRAND = domain; // Shopify placeholder guard
// Slug = the registrable label (before the TLD), so subdomains like www./eu./us.
// don't leak into it (eu.barkershoes.com → "barkershoes"). Single-label TLDs
// only; pass --source explicitly for a .co.uk-style host.
const labels = domain.split(".");
const slug = (labels.length >= 2 ? labels[labels.length - 2] : labels[0]).replace(/[^a-z0-9]/gi, "");
const SOURCE = arg("--source") || `scrapper:${slug}`;
const out = arg("--out") || `/private/tmp/${slug}.json`;
// Optional canonical-category override for single-category stores (e.g. a
// footwear brand). The import route keeps a category that's already canonical,
// so this bypasses mapCategory's title guesses (e.g. "runners" → Other).
const CATEGORY_OVERRIDE = arg("--category") || null;
// Optional Shopify locale prefix (e.g. --locale en) so a non-English default
// store returns English titles/types (meta.json stays at the root).
const LOCALE = (arg("--locale") || "").replace(/^\/|\/$/g, "");
const LOC = LOCALE ? `/${LOCALE}` : "";
// Optional exclusion by keyword (comma-separated), matched against
// title/product_type/tags — e.g. --exclude "perfume,cologne,fragrance".
const EXCLUDE = (arg("--exclude") || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const isExcluded = (p) => {
  if (!EXCLUDE.length) return false;
  const hay = `${p.title || ""} ${p.product_type || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
  return EXCLUDE.some((k) => hay.includes(k));
};

const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const colorOptIdx = (p) => {
  const i = (p.options || []).findIndex((o) => /colou?r/i.test(o.name || ""));
  return i >= 0 ? i + 1 : null;
};
const sizeKeyOf = (p) => {
  const i = (p.options || []).findIndex((o) => /size/i.test(o.name || ""));
  return i >= 0 ? `option${i + 1}` : null;
};
const imgForVariant = (product, variant) => {
  if (variant?.featured_image?.src) return variant.featured_image.src;
  const img = (product.images || []).find((im) => (im.variants || []).includes(variant?.id));
  return img?.src || product.images?.[0]?.src || null;
};

async function fetchAll() {
  const all = [];
  for (let page = 1; page <= 40; page++) {
    const r = await fetch(
      `${BASE}${LOC}/collections/${collection}/products.json?limit=250&page=${page}&currency=${CURRENCY}`,
      { headers: H },
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
  const ci = colorOptIdx(product);
  const sizeKey = sizeKeyOf(product);
  const desc = stripHtml(product.body_html);
  const groups = new Map();
  for (const v of product.variants || []) {
    const key = ci ? (v[`option${ci}`] ?? "__nocolor__") : "__nocolor__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  const rows = [];
  for (const [key, vs] of groups) {
    const color = key === "__nocolor__" ? null : key;
    const rep = vs.find((v) => v.available) || vs[0];
    const prices = vs.map((v) => Number(v.price)).filter((n) => n > 0);
    const price = prices.length ? Math.min(...prices) : Number(rep.price) || null;
    const sizes = sizeKey ? [...new Set(vs.map((v) => v[sizeKey]).filter(Boolean))] : [];
    rows.push({
      source: SOURCE,
      externalId: `${slug}-${product.id}`,
      sku: rep.sku || String(rep.id),
      brand: BRAND,
      title: product.title,
      description: desc,
      category: CATEGORY_OVERRIDE || product.product_type || "",
      gender: "men",
      color,
      colorHex: null,
      price,
      currency: CURRENCY,
      priceEur: null,
      market: MARKET,
      imageUrl: imgForVariant(product, rep),
      deeplink: `${BASE}${LOC}/products/${product.handle}?variant=${rep.id}`,
      inStock: vs.some((v) => v.available),
      attrs: { sizes: sizes.length ? sizes : null, sourceUrl: `${BASE}${LOC}/products/${product.handle}` },
    });
  }
  return rows;
}

let products;
let rows;
let excludedCount = 0;
for (let attempt = 1; attempt <= 5; attempt++) {
  products = await fetchAll();
  const kept = products.filter((p) => !isExcluded(p));
  excludedCount = products.length - kept.length;
  rows = kept.flatMap(toRows);
  const prices = rows.map((r) => r.price).filter(Number.isFinite).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;
  if (median <= maxMedian) break;
  console.error(`attempt ${attempt}: median ${median} > ${maxMedian} (wrong currency?) — retrying`);
  if (attempt === 5) {
    console.error("Could not obtain expected-currency prices; aborting (nothing written).");
    process.exit(1);
  }
}
await writeFile(out, JSON.stringify({ products: rows }, null, 2));
console.log(
  `${BASE}${LOC}/collections/${collection} | brand=${BRAND} currency=${CURRENCY} market=${MARKET} source=${SOURCE}\n` +
    `products=${products.length}${EXCLUDE.length ? ` (excluded ${excludedCount} by: ${EXCLUDE.join(", ")})` : ""} → colour-rows=${rows.length} → ${out}`,
);
