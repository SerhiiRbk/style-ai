// Backfill rule-based style tags (formality / trend_level / versatility) for
// existing catalogue products imported before style tagging existed.
//
//   node --env-file=.env.local scripts/backfill-product-tags.mjs [--dry-run] [--all]
//
// Single forward pass using keyset pagination on id (terminates cleanly). By
// default only rows missing tags are processed. Pass --all to recompute every
// row (e.g. after tuning the rules in scripts/feeds/tags.mjs).
import { createClient } from "@supabase/supabase-js";
import { tagsFor } from "./feeds/tags.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");

const sb = createClient(url, key, { auth: { persistSession: false } });

const PAGE = 1000;
let cursor = null;
let scanned = 0;
let updated = 0;

for (;;) {
  let q = sb
    .from("products")
    .select("id, title, category, color, color_hex, formality, trend_level, versatility")
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
  scanned += data.length;

  for (const row of data) {
    if (!all && row.trend_level != null) continue; // already tagged
    const t = tagsFor({
      title: row.title,
      category: row.category,
      color: row.color,
      colorHex: row.color_hex,
    });
    if (
      !all &&
      row.formality === (t.formality ?? null) &&
      row.trend_level === t.trend_level &&
      row.versatility === t.versatility
    )
      continue;
    if (dryRun) {
      updated++;
      if (updated <= 20) {
        console.log(
          `  [${String(row.category).padEnd(11)}] ${String(row.title).slice(0, 40).padEnd(40)} → form=${t.formality} trend=${t.trend_level} vers=${t.versatility}`,
        );
      }
      continue;
    }
    const { error: upErr } = await sb
      .from("products")
      .update({
        formality: t.formality ?? null,
        trend_level: t.trend_level,
        versatility: t.versatility,
      })
      .eq("id", row.id);
    if (upErr) console.error(`update ${row.id} failed:`, upErr.message);
    else updated++;
  }

  if (scanned % 5000 < PAGE) console.log(`  … scanned ${scanned}`);
}

console.log(`Scanned ${scanned}, ${dryRun ? "would update" : "updated"} ${updated}.`);
