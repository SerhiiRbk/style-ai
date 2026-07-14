import { readFile } from "node:fs/promises";
import path from "node:path";
import { getLookShareCard } from "@/lib/og/report-share-card-data";
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
    headers: { "Content-Type": contentType, "Cache-Control": CACHE },
  });
}

/**
 * Branded social share card for a single look. Personal data only appears for
 * publicly shared reports; other ids get the generic branded card. Falls back
 * to the static flatlay on error.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const i = Number.parseInt(index, 10);

  try {
    const data = Number.isNaN(i) ? null : await getLookShareCard(id, i);
    return await renderReportShareCard(data);
  } catch {
    return readStaticAsset(BRAND.ogImage);
  }
}
