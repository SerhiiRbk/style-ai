// Seed the RAG knowledge base. Run with:
//   node --env-file=.env.local scripts/seed-rules.mjs
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
const rules = JSON.parse(
  await readFile(new URL("../data/style-rules.json", import.meta.url), "utf8"),
);

for (const r of rules) {
  const { embedding } = await embed({ model, value: r.content });
  const { error } = await sb
    .from("style_rules")
    .upsert(
      { rule_id: r.rule_id, category: r.category, content: r.content, embedding },
      { onConflict: "rule_id" },
    );
  console.log(error ? `✗ ${r.rule_id}: ${error.message}` : `✓ ${r.rule_id}`);
}
console.log(`Seeded ${rules.length} style rules.`);
