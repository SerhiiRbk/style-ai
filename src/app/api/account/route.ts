import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { deleteAccountData } from "@/lib/data/account";

/** Permanently delete the signed-in user's account and all data (GDPR erasure). */
export async function DELETE() {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json(
      { error: "Account deletion is not available." },
      { status: 501 },
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  await deleteAccountData(user.id);

  // Clear the (now-orphaned) session cookies. Safe to ignore failures.
  try {
    await sb.auth.signOut();
  } catch {
    // user already gone — nothing to revoke
  }

  return NextResponse.json({ ok: true });
}
