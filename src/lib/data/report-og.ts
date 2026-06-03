import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getReport as getMockReport } from "@/lib/store";
import { absoluteUrl } from "@/lib/site-url";
import { BRAND } from "@/lib/brand";

export const REPORT_OG_FALLBACK = BRAND.ogImage;

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** First generated look image path used in the report header hero. */
export async function getReportHeroStoragePath(
  id: string,
): Promise<string | null> {
  if (id === "demo") return null;

  if (!hasSupabaseAdmin) {
    const report = getMockReport(id);
    if (!report) return null;
    const lookImage = report.looks.map((l) => l.image).find(Boolean);
    return lookImage ?? null;
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("is_public")
    .eq("id", id)
    .maybeSingle();

  if (!row?.is_public) return null;

  const { data: looks } = await admin
    .from("looks")
    .select("image_path")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  return looks?.find((l) => l.image_path)?.image_path ?? null;
}

export type ReportOgImageResult =
  | { kind: "static"; path: string; contentType: string }
  | { kind: "bytes"; bytes: Uint8Array; contentType: string };

function staticFallback(): ReportOgImageResult {
  return {
    kind: "static",
    path: REPORT_OG_FALLBACK,
    contentType: "image/png",
  };
}

/** Resolve hero image bytes/path for social crawlers; always falls back to flatlay PNG. */
export async function resolveReportOgImage(
  id: string,
): Promise<ReportOgImageResult> {
  if (id === "demo") return staticFallback();

  const imagePath = await getReportHeroStoragePath(id);
  if (!imagePath) return staticFallback();

  if (imagePath.startsWith("/")) {
    return {
      kind: "static",
      path: imagePath,
      contentType: contentTypeForPath(imagePath),
    };
  }

  // Remote URLs are not proxied — crawlers need stable same-origin image bytes.
  if (imagePath.startsWith("http")) return staticFallback();

  if (!hasSupabaseAdmin) return staticFallback();

  const admin = createAdminSupabase();
  const { data, error } = await admin.storage.from("assets").download(imagePath);
  if (error || !data) return staticFallback();

  const bytes = new Uint8Array(await data.arrayBuffer());
  return { kind: "bytes", bytes, contentType: contentTypeForPath(imagePath) };
}

/** Direct static OG image URL (flatlay fallback). */
export function reportOgFallbackImageUrl(): string {
  return absoluteUrl(REPORT_OG_FALLBACK);
}

/** Stable OG image URL for a report (served by `/api/og/report/[id]`). */
export function reportOgImageUrl(id: string): string {
  return absoluteUrl(`/api/og/report/${id}`);
}

/** Pick metadata OG image: API route when a public hero exists, else static flatlay. */
export async function reportOgMetadataImageUrl(id: string): Promise<string> {
  const heroPath = await getReportHeroStoragePath(id);
  return heroPath ? reportOgImageUrl(id) : reportOgFallbackImageUrl();
}
