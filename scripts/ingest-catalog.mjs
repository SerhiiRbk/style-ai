// Ingest the product catalogue with embeddings. Run with:
//   node --env-file=.env.local scripts/ingest-catalog.mjs
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { embed } from "ai";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const model = process.env.AI_EMBED_MODEL || "openai/text-embedding-3-small";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("Missing AI_GATEWAY_API_KEY (needed for embeddings)");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const products = JSON.parse(
  await readFile(new URL("../data/sample-products.json", import.meta.url), "utf8"),
);

for (const p of products) {
  const value = `${p.title}. Category: ${p.category}. Colour: ${p.color}. ${JSON.stringify(p.attrs ?? {})}`;
  const { embedding } = await embed({ model, value });
  // Replace any existing row with the same sku for idempotent re-runs.
  if (p.sku) await sb.from("products").delete().eq("sku", p.sku);
  const { error } = await sb.from("products").insert({ ...p, embedding });
  console.log(error ? `✗ ${p.sku}: ${error.message}` : `✓ ${p.title}`);
}
console.log(`Ingested ${products.length} products.`);
