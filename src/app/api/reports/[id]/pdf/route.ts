import { after } from "next/server";
import { getReportViewForDownload } from "@/lib/data/reports";
import { isDemoReportId } from "@/lib/demo-report";
import { getCachedReportPdf, putCachedReportPdf } from "@/lib/pdf/pdf-cache";
import { buildReportPdf } from "@/lib/pdf/report-pdf";
import { demoReport } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

// The example report is identical for everyone, so build it once and reuse.
let demoPdfCache: Uint8Array | null = null;

async function getDemoPdf(): Promise<Uint8Array> {
  if (!demoPdfCache) {
    demoPdfCache = await buildReportPdf(demoReport());
  }
  return demoPdfCache;
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** e.g. valetti-style-premium-report-2026-07-12.pdf */
function pdfFilename(tier: string, createdAt: string): string {
  const d = new Date(createdAt);
  const date = Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10);
  const tierSlug = tier.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `valetti-style-${tierSlug}-report-${date}.pdf`;
}

/**
 * Download a report as a generated PDF.
 * - `demo` → cached sample report PDF
 * - Owner or public viewer → generated PDF for that report
 * - Free tier → 402 with upgrade hint
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (isDemoReportId(id)) {
    const demo = demoReport();
    return pdfResponse(await getDemoPdf(), pdfFilename(demo.tier, demo.createdAt));
  }

  const view = await getReportViewForDownload(id);
  if (!view) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  const { report } = view;

  if (report.tier === "free") {
    return Response.json(
      {
        error: "The PDF export is a paid feature. Upgrade to download your report.",
        code: "tier_locked",
        upgrade: "/pricing",
      },
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const filename = pdfFilename(report.tier, report.createdAt);
    const cached = await getCachedReportPdf(report);
    if (cached) return pdfResponse(cached, filename);

    const bytes = await buildReportPdf(report);
    // Populate the cache after the response is sent so the download isn't delayed.
    after(() => putCachedReportPdf(report, bytes).catch(() => {}));
    return pdfResponse(bytes, filename);
  } catch (err) {
    console.error("[pdf] failed to build report", id, err);
    return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
