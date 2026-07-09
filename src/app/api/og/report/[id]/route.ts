import { readFile } from "node:fs/promises";
import path from "node:path";
import { getReportShareCard } from "@/lib/og/report-share-card-data";
import { renderReportShareCard } from "@/lib/og/report-share-card";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = "public, max-age=3600, s-maxage=86400";

async function readStaticAsset(relativePath: string): Promise<Response> {
  const filePath = path.join(process.cwd(), "public", relativePath.replace(/^\//, ""));
  const bytes = await readFile(filePath);
  const contentType = relativePath.endsWith(".png")
    ? "image/png"
    : relativePath.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE,
    },
  });
}

/**
 * Branded social share card for a report — rendered on the fly with the
 * report's season, palette, archetype and hero look, plus a Valetti watermark.
 * Personal data only appears for publicly shared reports (and the demo); other
 * ids get a generic branded card. Falls back to the static flatlay on error.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await getReportShareCard(id);
    return await renderReportShareCard(data);
  } catch {
    return readStaticAsset(BRAND.ogImage);
  }
}
