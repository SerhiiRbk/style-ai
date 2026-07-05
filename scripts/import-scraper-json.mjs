// Import a scraper JSON file ({ products: [...] }) into the catalogue.
//
//   node --env-file=.env.local scripts/import-scraper-json.mjs --file /path/to/scrape.json
//   node --env-file=.env.local scripts/import-scraper-json.mjs --file scrape.json --source scraper:marks-spencer-es --dry-run
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_GATEWAY_API_KEY
import { readFile } from "node:fs/promises";
import { canonicalProductSchema, CATEGORIES } from "./feeds/schema.mjs";
import {
  mapCategory,
  inferMarket,
  inferGender,
  inferCountry,
  toEur,
  dedupeProducts,
  sanitizeScraperNulls,
} from "./feeds/normalize.mjs";
import { embedAndUpsert } from "./feeds/upsert.mjs";

const args = process.argv.slice(2);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const file = val("--file");
const dryRun = args.includes("--dry-run");
const skipEmbed = args.includes("--skip-embed");
const source = val("--source");
const sourceType = val("--source-type") ?? "scraper";

const SOURCE_DEFAULT_COUNTRY = [
  { match: /zara/i, country: "ES" },
  { match: /marks.?spencer-de|markspencer-de|m&s-de/i, country: "DE" },
  { match: /marks.?spencer-fr|markspencer-fr|m&s-fr/i, country: "FR" },
  { match: /marks.?spencer|markspencer|m&s/i, country: "ES" },
];

function defaultCountryForSource(s) {
  return SOURCE_DEFAULT_COUNTRY.find((r) => r.match.test(s ?? ""))?.country;
}

function normalizeRaw(raw, defaultSource) {
  const r = sanitizeScraperNulls(
    raw && typeof raw === "object" ? { ...raw } : raw,
  );
  if (!r || typeof r !== "object") return r;
  if (defaultSource) r.source = defaultSource;

  if (typeof r.category !== "string" || !CATEGORIES.includes(r.category)) {
    r.category = mapCategory(r.category, r.title ?? "");
  }
  const rawMarket =
    typeof r.market === "string" ? r.market.trim().toUpperCase() : "";
  const marketCountry =
    /^[A-Z]{2}$/.test(rawMarket) && rawMarket !== "EU" && rawMarket !== "US"
      ? rawMarket
      : undefined;
  if (r.market !== "EU" && r.market !== "US") {
    r.market = inferMarket(r.currency);
  }
  if (
    typeof r.gender === "string" &&
    !["men", "women", "unisex", "kids"].includes(r.gender)
  ) {
    r.gender = inferGender(r.gender, r.title, r.description);
  }
  if (typeof r.priceEur !== "number" && typeof r.price === "number") {
    r.priceEur = toEur(r.price, r.currency ?? "EUR");
  }
  r.country = inferCountry(
    r.country ?? marketCountry,
    r.currency,
    defaultCountryForSource(r.source),
  );
  return r;
}

if (!file) {
  console.error("Usage: node scripts/import-scraper-json.mjs --file <path> [--source scraper:...] [--dry-run]");
  process.exit(1);
}

const body = JSON.parse(await readFile(file, "utf8"));
const rawItems = Array.isArray(body) ? body : body.products ?? body.items;
if (!Array.isArray(rawItems) || rawItems.length === 0) {
  console.error("No products array found in JSON.");
  process.exit(1);
}

const metaSource = source ?? (typeof body.source === "string" ? body.source : undefined);

const valid = [];
const invalid = [];
const skipped = [];
for (let i = 0; i < rawItems.length; i++) {
  const candidate = normalizeRaw(rawItems[i], metaSource);
  if (typeof candidate?.price !== "number" || !Number.isFinite(candidate.price)) {
    skipped.push({ index: i, externalId: candidate?.externalId, reason: "missing price" });
    continue;
  }
  const result = canonicalProductSchema.safeParse(candidate);
  if (result.success) valid.push(result.data);
  else
    invalid.push({
      index: i,
      externalId: candidate?.externalId,
      issues: result.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`),
    });
}

console.log(
  `Parsed ${rawItems.length} rows → ${valid.length} valid, ${skipped.length} skipped, ${invalid.length} invalid`,
);
if (skipped.length) {
  console.log(`  (skipped ${skipped.length} without price — likely unavailable variants)`);
}
if (invalid.length) {
  console.error("First invalid rows:");
  for (const row of invalid.slice(0, 5)) console.error(" ", row);
  process.exit(1);
}
if (valid.length === 0) {
  console.error("Nothing to import.");
  process.exit(1);
}

const { products: toIngest, duplicatesRemoved } = dedupeProducts(valid);
console.log(`After dedupe: ${toIngest.length} products (${duplicatesRemoved} duplicates removed)`);

if (dryRun) {
  console.log("(dry-run — no DB writes)");
  for (const p of toIngest.slice(0, 5)) {
    console.log(` • [${p.category}] ${p.brand ?? ""} — ${p.title} · €${p.priceEur} · ${p.source}`);
  }
  process.exit(0);
}

if (!skipEmbed && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN (needed for embeddings). Use --skip-embed to load rows without vectors.");
  process.exit(1);
}

const model = process.env.AI_EMBED_MODEL ?? "openai/text-embedding-3-small";
let last = 0;
const upserted = await embedAndUpsert(toIngest, {
  model: skipEmbed ? null : model,
  sourceType,
  unhide: true,
  skipEmbed,
  onProgress: (done, total) => {
    if (done - last >= 100 || done === total) {
      console.log(`  … ${done}/${total}`);
      last = done;
    }
  },
});

console.log(`✓ Upserted ${upserted} product rows (source: ${metaSource ?? toIngest[0]?.source ?? "?"})${skipEmbed ? " — without embeddings" : ""}`);
