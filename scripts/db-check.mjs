#!/usr/bin/env node
// Verifies the Supabase schema by querying each expected table / bucket / RPC
// through the REST API using the service (secret) key. No DATABASE_URL needed.
//   node --env-file=.env.local scripts/db-check.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const TABLES = [
  "profiles",
  "consents",
  "photos",
  "reports",
  "looks",
  "products",
  "recommendations",
  "tryons",
  "style_rules",
  "credits_ledger",
  "schema_migrations",
];

async function checkTables() {
  console.log("Tables:");
  let ok = 0;
  for (const t of TABLES) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ✗ ${t.padEnd(20)} ${error.message}`);
    } else {
      ok++;
      console.log(`  ✓ ${t.padEnd(20)} ${count ?? 0} rows`);
    }
  }
  console.log(`  → ${ok}/${TABLES.length} tables present\n`);
}

async function checkBuckets() {
  console.log("Storage buckets:");
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.log(`  ✗ ${error.message}\n`);
    return;
  }
  const names = data.map((b) => b.id);
  for (const want of ["photos", "assets"]) {
    console.log(`  ${names.includes(want) ? "✓" : "✗"} ${want}`);
  }
  console.log("");
}

async function checkRpc() {
  console.log("RPC functions:");
  const zero = new Array(1536).fill(0);
  for (const fn of ["match_style_rules", "match_products"]) {
    const args =
      fn === "match_style_rules"
        ? { query_embedding: zero, match_count: 1 }
        : { query_embedding: zero, match_count: 1, filter_category: null, max_price: null };
    const { error } = await supabase.rpc(fn, args);
    // A signature/arg error means the function isn't there as expected;
    // an empty result (no error) means it exists and ran.
    if (error && /could not find|does not exist/i.test(error.message)) {
      console.log(`  ✗ ${fn}: ${error.message}`);
    } else if (error) {
      console.log(`  ⚠ ${fn}: exists, returned: ${error.message}`);
    } else {
      console.log(`  ✓ ${fn}`);
    }
  }
  console.log("");
}

await checkTables();
await checkBuckets();
await checkRpc();
console.log("Done.");
