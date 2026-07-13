// Backfill normalised colour (hex + family + neutral flag) for existing
// catalogue products whose colours were imported before colour normalisation.
//
//   node --env-file=.env.local scripts/backfill-color-hex.mjs [--dry-run] [--all]
//
// Single forward pass using keyset pagination on id (terminates cleanly even
// when some colours can't be resolved). By default only rows missing color_hex
// are updated; pass --all to recompute every row after tuning the dictionary.
import { createClient } from "@supabase/supabase-js";
import { normalizeColor } from "./feeds/color.mjs";

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
let unresolved = 0;

for (;;) {
  let q = sb
    .from("products")
    .select("id, color, color_hex")
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
    if (!all && row.color_hex) continue; // already tagged
    const norm = normalizeColor(row.color, row.color_hex);
    if (!norm) {
      if (row.color) unresolved++;
      continue;
    }
    if (row.color_hex === norm.hex && !all) continue;
    if (dryRun) {
      updated++;
      if (updated <= 20) {
        console.log(`  ${String(row.color).padEnd(24)} → ${norm.hex} ${norm.family} ${norm.neutral ? "neutral" : "accent"}`);
      }
      continue;
    }
    const { error: upErr } = await sb
      .from("products")
      .update({
        color_hex: norm.hex,
        color_family: norm.family ?? null,
        color_is_neutral: norm.neutral ?? null,
      })
      .eq("id", row.id);
    if (upErr) console.error(`update ${row.id} failed:`, upErr.message);
    else updated++;
  }

  if (scanned % 5000 < PAGE) console.log(`  … scanned ${scanned}`);
}

console.log(
  `Scanned ${scanned}, ${dryRun ? "would update" : "updated"} ${updated}, unresolved (kept name only) ${unresolved}.`,
);
