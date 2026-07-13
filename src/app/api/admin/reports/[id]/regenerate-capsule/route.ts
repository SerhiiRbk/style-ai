import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { regenerateReportStyling } from "@/lib/data/reports";
import { isDemoReportId } from "@/lib/demo-report";
import { hasAI, hasSupabaseAdmin } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Admin action — re-match a report's shopping list and rebuild its capsule
 * photos from the corrected, context-aware styling matrix. Used to remediate
 * reports generated before the fix (e.g. sandals in a boardroom look).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin || !hasAI) {
    return NextResponse.json(
      { error: "Server not configured (Supabase service role + AI key required)." },
      { status: 503 },
    );
  }

  const { id } = await params;
  if (isDemoReportId(id)) {
    return NextResponse.json(
      { error: "The demo report is generated on the fly." },
      { status: 400 },
    );
  }

  const result = await regenerateReportStyling(id);
  if (!result.ok) {
    const status = result.reason === "not-found" ? 404 : 400;
    return NextResponse.json(
      { error: `Could not regenerate capsule (${result.reason ?? "unknown"})` },
      { status },
    );
  }
  return NextResponse.json({ ok: true });
}
