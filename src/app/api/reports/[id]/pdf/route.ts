import { getReportById } from "@/lib/data/reports";
import { buildReportPdf } from "@/lib/pdf/report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The example report is identical for everyone, so build it once and reuse.
let sampleCache: Uint8Array | null = null;

async function getSamplePdf(): Promise<Uint8Array> {
  if (!sampleCache) {
    const sample = await getReportById("demo");
    if (!sample) throw new Error("Sample report unavailable");
    sampleCache = await buildReportPdf(sample);
  }
  return sampleCache;
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
 * Download a report as a generated PDF. Authenticated users get their own
 * report; everyone else (or any unavailable id) gets the cached sample report.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const report = id === "demo" ? null : await getReportById(id);
    if (!report) {
      return pdfResponse(await getSamplePdf(), "styleai-sample-report.pdf");
    }
    const bytes = await buildReportPdf(report);
    return pdfResponse(bytes, `styleai-report-${id}.pdf`);
  } catch {
    return pdfResponse(await getSamplePdf(), "styleai-sample-report.pdf");
  }
}
