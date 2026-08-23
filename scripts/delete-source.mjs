// Delete every catalog row from one import source (undo a bad import).
//   node scripts/delete-source.mjs --source scrapper:ralph_lauren           # dry-run (default)
//   node scripts/delete-source.mjs --source scrapper:ralph_lauren --apply   # write to prod
// Scoped strictly by products.source. Removes dependent product_offers first
// (in case the FK isn't ON DELETE CASCADE), then the products. Dry-run prints
// the counts and a small sample so you can eyeball the target before deleting.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function loadEnv(p){const o={};for(const raw of readFileSync(p,"utf8").split("\n")){const l=raw.trim();if(!l||l.startsWith("#"))continue;const i=l.indexOf("=");if(i===-1)continue;let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);o[l.slice(0,i).trim()]=v;}return o;}

const argv = process.argv.slice(2);
const arg = (name, d = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const SOURCE = arg("--source");
const APPLY = argv.includes("--apply");
if (!SOURCE) {
  console.error("required: --source <value>   (e.g. scrapper:ralph_lauren)");
  process.exit(1);
}

const e = loadEnv(".env.local");
const key = e.SUPABASE_SERVICE_ROLE_KEY;
let url = e.NEXT_PUBLIC_SUPABASE_URL;
if (!url && key && key.split(".").length === 3)
  url = `https://${JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).ref}.supabase.co`;
if (!url || !key) {
  console.error("missing SUPABASE url/key in .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// 1) gather ids for this source
const ids = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("products").select("id").eq("source", SOURCE).range(from, from + 999);
  if (error) throw new Error(error.message);
  if (!data?.length) break;
  ids.push(...data.map((r) => r.id));
  if (data.length < 1000) break;
}
console.log(`source="${SOURCE}": ${ids.length} product(s)`);
if (!ids.length) {
  console.log("nothing to delete.");
  process.exit(0);
}

// count dependent offers (for reporting)
let offerCount = 0;
for (let i = 0; i < ids.length; i += 200) {
  const { count, error } = await sb
    .from("product_offers")
    .select("id", { count: "exact", head: true })
    .in("product_id", ids.slice(i, i + 200));
  if (error) { console.error("  (could not count product_offers:", error.message + ")"); offerCount = -1; break; }
  offerCount += count ?? 0;
}
if (offerCount >= 0) console.log(`dependent product_offers: ${offerCount}`);

if (!APPLY) {
  const { data: sample } = await sb
    .from("products")
    .select("brand,title,color,price_eur,deeplink")
    .eq("source", SOURCE)
    .limit(5);
  console.log("\nsample:");
  for (const r of sample ?? [])
    console.log(`  ${r.brand} | ${r.title}${r.color ? " / " + r.color : ""} | €${r.price_eur ?? "?"} | ${(r.deeplink || "").slice(0, 60)}`);
  console.log("\n(dry-run — pass --apply to delete)");
  process.exit(0);
}

// 2) delete dependent offers first (chunked, best-effort)
console.log("\nApplying…");
let offersDeleted = 0;
for (let i = 0; i < ids.length; i += 200) {
  const { error, count } = await sb.from("product_offers").delete({ count: "exact" }).in("product_id", ids.slice(i, i + 200));
  if (error) { console.error("  product_offers delete error (continuing):", error.message); break; }
  offersDeleted += count ?? 0;
}
console.log(`product_offers deleted: ${offersDeleted}`);

// 3) delete the products (scoped by source)
const { error: delErr, count } = await sb.from("products").delete({ count: "exact" }).eq("source", SOURCE);
if (delErr) throw new Error("products delete failed: " + delErr.message);
console.log(`products deleted: ${count}`);

// 4) verify none remain
const { count: remain } = await sb.from("products").select("id", { count: "exact", head: true }).eq("source", SOURCE);
console.log(`remaining source="${SOURCE}": ${remain}`);
