#!/usr/bin/env node
// TEMP admin/dev tool to grant credits to a user by email (until Stripe lands).
// Uses the Supabase service (secret) key via the REST/admin API — no DATABASE_URL.
//
//   node --env-file=.env.local scripts/grant-credits.mjs <email> <amount>
//
// Example:
//   node --env-file=.env.local scripts/grant-credits.mjs ryabokonenko@gmail.com 200
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const email = process.argv[2];
const amount = Number(process.argv[3]);
if (!email || !Number.isFinite(amount) || amount === 0) {
  console.error("Usage: grant-credits.mjs <email> <amount>");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Resolve a user id from an email (auth admin, paginated). */
async function findUserId(targetEmail) {
  const wanted = targetEmail.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

const userId = await findUserId(email);
if (!userId) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}

// Prefer the atomic RPC (migration 0009); fall back to a guarded insert.
let balance = null;
const grant = await supabase.rpc("grant_credits", {
  p_user_id: userId,
  p_amount: amount,
  p_reason: "admin_grant",
  p_ref_id: null,
});

if (grant.error) {
  const missing = /could not find|does not exist|schema cache/i.test(
    grant.error.message,
  );
  if (!missing) {
    console.error("Grant failed:", grant.error.message);
    process.exit(1);
  }
  // Fallback: sum ledger then insert (run migration 0009 for the atomic path).
  const { data: rows, error: sumErr } = await supabase
    .from("credits_ledger")
    .select("delta")
    .eq("user_id", userId);
  if (sumErr) {
    console.error("Grant failed:", sumErr.message);
    process.exit(1);
  }
  const current = (rows ?? []).reduce((s, r) => s + (Number(r.delta) || 0), 0);
  balance = current + amount;
  const { error: insErr } = await supabase.from("credits_ledger").insert({
    user_id: userId,
    delta: amount,
    reason: "admin_grant",
    balance_after: balance,
  });
  if (insErr) {
    console.error("Grant failed:", insErr.message);
    process.exit(1);
  }
} else {
  balance = grant.data;
}

console.log(`Granted ${amount} credits to ${email}. New balance: ${balance}`);
