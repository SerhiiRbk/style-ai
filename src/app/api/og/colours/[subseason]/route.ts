import { readFile } from "node:fs/promises";
import path from "node:path";
import { Subseason } from "@/lib/style-profile";
import {
  paletteForSubseason,
  subseasonLabel,
} from "@/lib/colour-palette";
import {
  renderColoursShareCard,
  renderColoursShareCardVertical,
} from "@/lib/og/colours-share-card";
import { parseVerticalFormat } from "@/lib/og/formats";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = "public, max-age=3600, s-maxage=86400";

async function readStaticAsset(relativePath: string): Promise<Response> {
  const filePath = path.join(process.cwd(), "public", relativePath.replace(/^\//, ""));
  const bytes = await readFile(filePath);
  const contentType = relativePath.endsWith(".png") ? "image/png" : "image/jpeg";
  return new Response(bytes as BodyInit, {
    headers: { "Content-Type": contentType, "Cache-Control": CACHE },
  });
}

/**
 * Branded palette share card for the free colour analysis. The subseason is
 * encoded in the URL (the result is anonymous and never stored), so the card is
 * derived purely from the path + optional ?u=/?c= undertone/contrast. Falls back
 * to the static brand image on an unknown subseason or render error.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ subseason: string }> },
) {
  const { subseason } = await params;
  const parsed = Subseason.safeParse(subseason);
  if (!parsed.success) return readStaticAsset(BRAND.ogImage);

  const { searchParams } = new URL(request.url);
  const undertone = searchParams.get("u") ?? undefined;
  const contrast = searchParams.get("c") ?? undefined;
  const format = parseVerticalFormat(searchParams.get("format"));

  const data = {
    subseasonLabel: subseasonLabel(parsed.data),
    palette: paletteForSubseason(parsed.data),
    undertone,
    contrast,
  };

  try {
    return format
      ? await renderColoursShareCardVertical(data, format)
      : await renderColoursShareCard(data);
  } catch {
    return readStaticAsset(BRAND.ogImage);
  }
}
