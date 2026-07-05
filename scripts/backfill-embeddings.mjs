// Backfill missing product embeddings (e.g. after --skip-embed import).
//
//   node --env-file=.env.local scripts/backfill-embeddings.mjs --source scraper:marks-spencer-es
//   npx vercel env run -e production -- node --env-file=.env.local scripts/backfill-embeddings.mjs --source scraper:marks-spencer-es
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_GATEWAY_API_KEY
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { embedText } from "./feeds/normalize.mjs";

const args = process.argv.slice(2);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const source = val("--source");
const batchSize = Math.max(1, parseInt(val("--batch") ?? "100", 10) || 100);
const dryRun = args.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const model = process.env.AI_EMBED_MODEL ?? "openai/text-embedding-3-small";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!dryRun && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function fetchBatch(from = 0) {
  let q = sb
    .from("products")
    .select("id,brand,title,category,color,gender,description")
    .is("embedding", null)
    .order("id", { ascending: true })
    .range(from, from + batchSize - 1);
  if (source) q = q.eq("source", source);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

let countQ = sb
  .from("products")
  .select("id", { count: "exact", head: true })
  .is("embedding", null);
if (source) countQ = countQ.eq("source", source);
const { count: pending, error: countErr } = await countQ;
if (countErr) throw new Error(countErr.message);

console.log(
  `Pending embeddings: ${pending ?? 0}${source ? ` (source: ${source})` : ""}`,
);
if (!pending) {
  console.log("Nothing to do.");
  process.exit(0);
}
if (dryRun) {
  const sample = await fetchBatch(0);
  for (const row of sample.slice(0, 5)) {
    console.log(` • ${row.title} — ${embedText(row).slice(0, 80)}…`);
  }
  process.exit(0);
}

let done = 0;
while (true) {
  const batch = await fetchBatch(0);
  if (!batch.length) break;

  const texts = batch.map(embedText);
  const { embeddings } = await embedMany({ model, values: texts });

  for (let i = 0; i < batch.length; i++) {
    const { error } = await sb
      .from("products")
      .update({ embedding: embeddings[i], updated_at: new Date().toISOString() })
      .eq("id", batch[i].id);
    if (error) throw new Error(`${batch[i].id}: ${error.message}`);
  }

  done += batch.length;
  console.log(`  … ${done}/${pending}`);
}

console.log(`✓ Backfilled ${done} embeddings`);
