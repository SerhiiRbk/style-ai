import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveReportOgImage } from "@/lib/data/report-og";
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
  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE,
    },
  });
}

/** Stable OG image endpoint for social crawlers — no expiring signed URLs. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const resolved = await resolveReportOgImage(id);
    if (resolved.kind === "bytes") {
      return new Response(resolved.bytes as BodyInit, {
        headers: {
          "Content-Type": resolved.contentType,
          "Cache-Control": CACHE,
        },
      });
    }
    return readStaticAsset(resolved.path);
  } catch {
    return readStaticAsset(BRAND.ogImage);
  }
}
