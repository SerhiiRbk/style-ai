// Re-classify existing catalogue products with the improved title-based
// category rules, recompute the category-dependent style tags, and re-embed the
// rows whose category actually changed (their embedding text includes category).
//
//   node --env-file=.env.local scripts/backfill-categories.mjs --dry-run
//   node --env-file=.env.local scripts/backfill-categories.mjs            # writes
//   node --env-file=.env.local scripts/backfill-categories.mjs --no-embed # skip re-embedding
//   node --env-file=.env.local scripts/backfill-categories.mjs --force    # bypass safety guard
//
// Safety: aborts if it would move more than MAX_MOVE_FRACTION of the catalogue
// (guards against a classifier regression mass-relabelling everything).
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { mapCategory, embedText } from "./feeds/normalize.mjs";
import { tagsFor } from "./feeds/tags.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const doEmbed = !args.includes("--no-embed");

const MAX_MOVE_FRACTION = 0.25;
const EMBED_MODEL = process.env.AI_EMBED_MODEL ?? "openai/text-embedding-3-small";

const sb = createClient(url, key, { auth: { persistSession: false } });

// ---- Pass 1: scan everything, compute proposed category (read-only) ----
const PAGE = 1000;
let cursor = null;
let total = 0;
const changes = []; // { id, brand, title, category, color, gender, description, next }
const matrix = new Map(); // "old → new" → count

for (;;) {
  let q = sb
    .from("products")
    .select("id, brand, title, category, description, gender, color")
    .order("id", { ascending: true })
    .limit(PAGE);
  if (cursor) q = q.gt("id", cursor);
  const { data, error } = await q;
  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  cursor = data[data.length - 1].id;
  total += data.length;

  for (const row of data) {
    const next = mapCategory(row.category, row.title);
    if (next === row.category) continue;
    changes.push({ ...row, next });
    const k = `${row.category} → ${next}`;
    matrix.set(k, (matrix.get(k) ?? 0) + 1);
  }
}

const frac = total ? changes.length / total : 0;
console.log(`\n=== Re-classification preview ===`);
console.log(`Total products:   ${total}`);
console.log(`Would re-category: ${changes.length} (${(frac * 100).toFixed(1)}%)\n`);
for (const [k, n] of [...matrix.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${n}`);
  const samples = changes.filter((c) => `${c.category} → ${c.next}` === k).slice(0, 5);
  for (const s of samples) console.log(`      • ${s.brand ? `[${s.brand}] ` : ""}${s.title}`);
}
console.log("");

if (dryRun) {
  console.log("(dry-run — no writes)");
  process.exit(0);
}
if (frac > MAX_MOVE_FRACTION && !force) {
  console.error(
    `ABORT: would move ${(frac * 100).toFixed(1)}% (> ${(MAX_MOVE_FRACTION * 100).toFixed(0)}%). Re-run with --force if this is intended.`,
  );
  process.exit(1);
}
if (changes.length === 0) {
  console.log("Nothing to change.");
  process.exit(0);
}

// ---- Pass 2: re-embed (changed rows only) + write category + tags ----
if (doEmbed && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("Missing AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN. Re-run with --no-embed to skip re-embedding.");
  process.exit(1);
}

const CHUNK = 100;
let updated = 0;
for (let i = 0; i < changes.length; i += CHUNK) {
  const batch = changes.slice(i, i + CHUNK);

  let embeddings = null;
  if (doEmbed) {
    // Embedding text uses the NEW category so the vector matches the new bucket.
    const values = batch.map((c) =>
      embedText({
        brand: c.brand,
        title: c.title,
        category: c.next,
        color: c.color,
        gender: c.gender,
        description: c.description,
      }),
    );
    ({ embeddings } = await embedMany({ model: EMBED_MODEL, values }));
  }

  for (let j = 0; j < batch.length; j++) {
    const c = batch[j];
    const tags = tagsFor({ title: c.title, category: c.next, color: c.color });
    const patch = {
      category: c.next,
      formality: tags.formality ?? null,
      trend_level: tags.trend_level,
      versatility: tags.versatility,
      updated_at: new Date().toISOString(),
    };
    if (embeddings) patch.embedding = embeddings[j];
    const { error } = await sb.from("products").update(patch).eq("id", c.id);
    if (error) console.error(`update ${c.id} failed:`, error.message);
    else updated++;
  }
  console.log(`  … updated ${updated}/${changes.length}`);
}

console.log(`\n✓ Re-categorised ${updated} products${doEmbed ? " (re-embedded)" : " (tags only, no re-embed)"}.`);
