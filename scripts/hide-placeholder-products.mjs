/**
 * One-off, idempotent cleanup: hide catalogue products whose deeplink is a
 * placeholder / sample-feed URL (example.com etc.) so they can never surface in
 * a generated report. Reversible — sets `hidden = true` rather than deleting.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PATTERNS = ["%example.com%", "%example.org%", "%example.net%", "%localhost%"];

let hidden = 0;
for (const pat of PATTERNS) {
  const { data, error } = await admin
    .from("products")
    .update({ hidden: true })
    .ilike("deeplink", pat)
    .neq("hidden", true)
    .select("id,brand,title,deeplink");
  if (error) {
    console.error(`Update failed for ${pat}:`, error.message);
    continue;
  }
  for (const p of data ?? []) {
    hidden++;
    console.log(`  hidden: ${p.brand} | ${p.title} | ${p.deeplink}`);
  }
}
console.log(`\nDone. Newly hidden: ${hidden}`);

// Verify nothing shoppable remains with a placeholder deeplink.
const { count } = await admin
  .from("products")
  .select("*", { count: "exact", head: true })
  .ilike("deeplink", "%example.com%")
  .neq("hidden", true);
console.log(`Live products still on example.com: ${count ?? 0}`);
