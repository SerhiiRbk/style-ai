import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { getReportViewForDownload } from "@/lib/data/reports";
import { isDemoReportId } from "@/lib/demo-report";
import { hasSupabaseAdmin } from "@/lib/env";
import { rebuildReportPdf } from "@/lib/pdf/pdf-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Admin action — discard the cached PDF for a report and build it fresh. Useful
 * after template changes or to force-refresh a stale export. Mirrors the
 * finish-reports admin route's auth pattern.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured (Supabase service role required)." },
      { status: 503 },
    );
  }

  const { id } = await params;
  if (isDemoReportId(id)) {
    return NextResponse.json(
      { error: "The demo report PDF is generated on the fly." },
      { status: 400 },
    );
  }

  const view = await getReportViewForDownload(id);
  if (!view) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { report } = view;
  if (report.tier === "free") {
    return NextResponse.json(
      { error: "Free-tier reports have no PDF export." },
      { status: 400 },
    );
  }

  try {
    const bytes = await rebuildReportPdf(report);
    return NextResponse.json({ ok: true, bytes: bytes.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not regenerate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
