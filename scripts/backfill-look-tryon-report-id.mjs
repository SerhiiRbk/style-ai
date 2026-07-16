// Backfill report_id (and kind) for orphaned look/capsule try-ons.
//
// Per-look "try this on me" renders were historically inserted into `tryons`
// without report_id/kind/garments, so they were disconnected from their report
// (missing from the gallery's report group). Their storage path still encodes
// the report id: `{userId}/tryon/look-{reportId}-{lookKey}.{ext}` — recover it.
//
// Usage: node --env-file=.env.local scripts/backfill-look-tryon-report-id.mjs [--apply]

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env (URL / service role key).");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const admin = createClient(url, key, { auth: { persistSession: false } });

const UUID_RE =
  /\/tryon\/look-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)\.(png|jpg|jpeg|webp)$/i;

const PAGE = 500;
let cursor = null;
let scanned = 0;
let updated = 0;
let skipped = 0;

for (;;) {
  let q = admin
    .from("tryons")
    .select("id, image_path")
    .is("report_id", null)
    .like("image_path", "%/tryon/look-%")
    .order("id", { ascending: true })
    .limit(PAGE);
  if (cursor) q = q.gt("id", cursor);

  const { data, error } = await q;
  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!data?.length) break;

  for (const row of data) {
    scanned++;
    cursor = row.id;
    const path = row.image_path ?? "";
    const m = UUID_RE.exec(path);
    if (!m) {
      skipped++;
      continue;
    }
    const reportId = m[1];
    const lookKey = m[2];
    const kind = lookKey.startsWith("capsule-") ? "capsule" : "look";

    if (apply) {
      const { error: upErr } = await admin
        .from("tryons")
        .update({ report_id: reportId, kind })
        .eq("id", row.id);
      if (upErr) {
        console.error(`update ${row.id} failed:`, upErr.message);
        continue;
      }
    }
    updated++;
  }

  if (data.length < PAGE) break;
}

console.log(
  `${apply ? "APPLIED" : "DRY RUN"} — scanned ${scanned}, ` +
    `${apply ? "updated" : "would update"} ${updated}, skipped ${skipped}`,
);
if (!apply) console.log("Re-run with --apply to persist changes.");
