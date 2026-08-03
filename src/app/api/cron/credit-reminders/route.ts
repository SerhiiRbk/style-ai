import { NextResponse } from "next/server";
import { env, hasSupabaseAdmin, hasResend } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { sendCreditsReminderEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Don't nag active users or brand-new signups (their bonus is a fresh ledger row). */
const INACTIVE_DAYS = 21;
/** At most one reminder per user within this window. */
const COOLDOWN_DAYS = 45;
/** Cap per run so a large list can't blow the function budget in one shot. */
const BATCH = 50;

/**
 * Weekly "unused credits" reminder (A3). CRON_SECRET-gated. Candidate selection
 * (positive balance, inactive, off cooldown, not unsubscribed) is a single RPC;
 * the cooldown stamp is written only after a successful send.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Paused: kept wired but sends nothing unless CREDIT_REMINDERS_ENABLED=true.
  if (!env.creditRemindersEnabled) {
    return NextResponse.json({ ok: true, paused: true, sent: 0 });
  }
  if (!hasSupabaseAdmin || !hasResend) {
    return NextResponse.json(
      { ok: false, reason: "email or database not configured" },
      { status: 200 },
    );
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("credit_reminder_candidates", {
    p_inactive_days: INACTIVE_DAYS,
    p_cooldown_days: COOLDOWN_DAYS,
  });
  if (error) {
    console.error("[cron credit-reminders]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = ((data ?? []) as {
    user_id: string;
    email: string;
    balance: number;
  }[]).slice(0, BATCH);

  let sent = 0;
  for (const row of rows) {
    const ok = await sendCreditsReminderEmail(row.email, row.balance);
    if (!ok) continue;
    sent++;
    await admin
      .from("profiles")
      .update({ credits_reminded_at: new Date().toISOString() })
      .eq("id", row.user_id);
  }

  return NextResponse.json({ ok: true, candidates: rows.length, sent });
}
