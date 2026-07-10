import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { getUserReports } from "@/lib/data/user-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight status feed for the signed-in user's reports, used by the global
 * "report is ready" notifier to detect when a generating report finishes.
 */
export async function GET() {
  if (!hasSupabase) {
    return NextResponse.json({ reports: [] });
  }

  const reports = await getUserReports();
  if (!reports) {
    return NextResponse.json({ reports: [] }, { status: 200 });
  }

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      headline: r.headline,
      status: r.status,
      generating: r.generating,
    })),
  });
}
