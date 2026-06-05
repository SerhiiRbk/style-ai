import { getReportViewForDownload } from "@/lib/data/reports";
import { buildReportPdf } from "@/lib/pdf/report-pdf";
import { demoReport } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (id === "demo") {
    return pdfResponse(await getDemoPdf(), "styleai-sample-report.pdf");
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
    const bytes = await buildReportPdf(report);
    return pdfResponse(bytes, `styleai-report-${id}.pdf`);
  } catch (err) {
    console.error("[pdf] failed to build report", id, err);
    return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
