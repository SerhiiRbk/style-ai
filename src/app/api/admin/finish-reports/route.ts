import { NextResponse } from "next/server";
import { hasAI, hasSupabaseAdmin } from "@/lib/env";
import { requireAdminApi } from "@/lib/admin-api";
import { finishIncompleteReports } from "@/lib/data/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Admin-triggered version of the finish-reports cron: scans recent `ready`
 * reports still missing images and resumes a bounded number of them. Same
 * underlying logic as the scheduled cron, but gated by an admin session so it
 * can be invoked from the admin dashboard without the CRON_SECRET.
 */
export async function POST() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin || !hasAI) {
    return NextResponse.json(
      { error: "Server not configured (Supabase service role + AI key required)." },
      { status: 503 },
    );
  }

  try {
    const result = await finishIncompleteReports({
      budgetMs: 540_000,
      maxReports: 4,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not finish reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
