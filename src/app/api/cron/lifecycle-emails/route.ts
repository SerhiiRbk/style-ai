import { NextResponse } from "next/server";
import { hasResend, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  sendAbandonedIntakeBatch,
  sendDay3AfterReportBatch,
} from "@/lib/email/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily lifecycle: abandoned intake + day-3 after report. CRON_SECRET-gated. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdmin || !hasResend) {
    return NextResponse.json(
      { ok: false, reason: "email or database not configured" },
      { status: 200 },
    );
  }

  const admin = createAdminSupabase();
  const abandoned = await sendAbandonedIntakeBatch(admin);
  const day3 = await sendDay3AfterReportBatch(admin);
  return NextResponse.json({ ok: true, abandoned, day3 });
}
