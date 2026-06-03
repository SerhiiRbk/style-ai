/**
 * One-off, idempotent repair for seeded demo products.
 *
 * The sample fixtures in `data/feeds/samples/` originally shipped with
 * fabricated, unreachable image hosts (example.com, img.cos.com, …), so the
 * catalogue rendered <img> tags whose src never loaded. This script rewrites
 * those rows' `image_url` to a deterministic, reachable Lorem Picsum URL keyed
 * on the product's external_id — matching what the (now-fixed) fixtures produce
 * so re-imports stay consistent.
 *
 * Idempotent: rows already pointing at picsum.photos are skipped.
 * Scoped: only touches rows whose image_url host is NOT picsum.photos.
 *
 * Run: node --env-file=.env.local scripts/fix-demo-image-urls.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const GOOD_HOST = "picsum.photos";

/** Same seed derivation the fixtures use: lowercase, non-alphanumeric → '-'. */
function seedFor(row) {
  const base = (row.external_id ?? row.id ?? "").toString();
  const seed = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return seed || row.id;
}

function isGood(imageUrl) {
  if (!imageUrl) return false;
  try {
    return new URL(imageUrl).host.toLowerCase() === GOOD_HOST;
  } catch {
    return false;
  }
}

const { data: rows, error } = await sb
  .from("products")
  .select("id,source,external_id,title,image_url");
if (error) throw error;

let touched = 0;
let skipped = 0;
const samples = [];

for (const row of rows) {
  if (isGood(row.image_url)) {
    skipped += 1;
    continue;
  }
  const newUrl = `https://picsum.photos/seed/${seedFor(row)}/600/800`;
  const { error: upErr } = await sb
    .from("products")
    .update({ image_url: newUrl, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (upErr) throw new Error(`Failed updating ${row.id}: ${upErr.message}`);
  touched += 1;
  if (samples.length < 8) {
    samples.push(`  [${row.source}] ${row.external_id} → ${newUrl}`);
  }
}

console.log(`Rows scanned:  ${rows.length}`);
console.log(`Already good:  ${skipped}`);
console.log(`Rows updated:  ${touched}`);
if (samples.length) {
  console.log("\nSample updates:");
  console.log(samples.join("\n"));
}
