// Import a scraper JSON into the catalog THROUGH the canonical import route
// (/api/catalog/import) so it gets the full server-side normalization:
// sanitizeScraperNulls → normalizeTitle → mapCategory (Spanish familyName →
// canonical 14) → inferMarket → toEur (priceEur) → inferCountry → inferGender →
// schema validation → embedAndUpsert (dedup-UPDATE on source/external_id/color_key
// + A-lite typing in toRow). Do NOT call embedAndUpsert directly — that skips
// mapCategory/priceEur and would store raw Spanish categories.
//
//   node --env-file=.env.local scripts/import-scraper-json.mjs <file.json> \
//     --url https://valetti.fit [--dry-run] [--limit N] [--batch 1000]
//
// --dry-run  LOCAL preview (no network): shows the canonical categories +
//            material_family/subtype coverage the route would produce.
// Real run needs CATALOG_IMPORT_KEY in the env (sent as x-api-key).
import { readFile } from "node:fs/promises";
import { mapCategory } from "./feeds/normalize.mjs";
import { normalizeTitle } from "./feeds/humanize.mjs";
import { parseProductAttributes } from "./feeds/attributes.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const flag = (name, d = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const dryRun = argv.includes("--dry-run");
const baseUrl = (flag("--url") || process.env.IMPORT_BASE_URL || "").replace(/\/$/, "");
const limit = flag("--limit") ? Number.parseInt(flag("--limit"), 10) : null;
const batchSize = flag("--batch") ? Number.parseInt(flag("--batch"), 10) : 1000;

if (!file) {
  console.error("usage: node --env-file=.env.local scripts/import-scraper-json.mjs <file.json> --url <base> [--dry-run] [--limit N] [--batch N]");
  process.exit(1);
}

const raw = JSON.parse(await readFile(file, "utf8"));
let products = Array.isArray(raw) ? raw : (raw.products ?? raw.items ?? []);
if (!Array.isArray(products) || products.length === 0) {
  console.error("No products found (expected an array or { products: [...] }).");
  process.exit(1);
}
if (limit) products = products.slice(0, limit);
console.log(`Loaded ${products.length} products from ${file}`);

if (dryRun) {
  const cats = {};
  let mat = 0;
  let sub = 0;
  const sample = [];
  for (const p of products) {
    const { title } = normalizeTitle(String(p.title ?? ""));
    const canonical = mapCategory(p.category, title); // Spanish familyName → canonical
    cats[canonical] = (cats[canonical] ?? 0) + 1;
    const a = parseProductAttributes(p);
    if (a.material_family) mat++;
    if (a.garment_subtype) sub++;
    if (sample.length < 12) {
      sample.push({ raw: p.category, canonical, title: title.slice(0, 34), fam: a.material_family, sub: a.garment_subtype });
    }
  }
  console.log(`\nDry-run (LOCAL preview — no network, no writes):`);
  console.log(`  material_family: ${mat}/${products.length} (${Math.round((100 * mat) / products.length)}%)`);
  console.log(`  garment_subtype: ${sub}/${products.length} (${Math.round((100 * sub) / products.length)}%)`);
  console.log(`  canonical categories: ${JSON.stringify(Object.fromEntries(Object.entries(cats).sort((a, b) => b[1] - a[1])))}`);
  console.log(`  samples (raw category → canonical):`);
  for (const s of sample) {
    console.log(`    ${String(s.raw ?? "·").padEnd(16)} → ${String(s.canonical).padEnd(11)} | ${s.title.padEnd(34)} fam=${s.fam ?? "·"} sub=${s.sub ?? "·"}`);
  }
  process.exit(0);
}

// ---- real import: POST batches to the route ----
if (!baseUrl) {
  console.error("Missing --url <base> (e.g. https://valetti.fit or http://localhost:3000).");
  process.exit(1);
}
const key = process.env.CATALOG_IMPORT_KEY;
if (!key) {
  console.error("Missing CATALOG_IMPORT_KEY in env (run with --env-file=.env.local, and ensure the deployment has the same key).");
  process.exit(1);
}

const endpoint = `${baseUrl}/api/catalog/import`;
let totalUpserted = 0;
for (let i = 0; i < products.length; i += batchSize) {
  const batch = products.slice(i, i + batchSize);
  const label = `batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ products: batch, sourceType: "scraper" }),
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error(`\n${label} FAILED — HTTP ${resp.status}: ${payload.error ?? ""}`);
    if (Array.isArray(payload.items)) {
      for (const it of payload.items.slice(0, 10)) {
        console.error(`  #${it.index} ${it.externalId ?? ""}: ${(it.issues ?? []).map((x) => `${x.path} ${x.message}`).join("; ")}`);
      }
    }
    console.error("Stopping — no further batches sent.");
    process.exit(1);
  }
  totalUpserted += payload.upserted ?? payload.count ?? 0;
  console.log(`${label} → HTTP ${resp.status}  upserted=${payload.upserted ?? payload.count ?? "?"}`);
}
console.log(`\nDone. Upserted ~${totalUpserted} (existing rows updated in place, new es products inserted).`);
