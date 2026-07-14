import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getReport as getMockReport } from "@/lib/store";
import { canShareReport, type Tier } from "@/lib/report";
import { absoluteUrl } from "@/lib/site-url";
import { BRAND } from "@/lib/brand";
import { isDemoReportId } from "@/lib/demo-report";

export const REPORT_OG_FALLBACK = BRAND.ogImage;

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Hero image path for the share card — the report's bespoke editorial cover
 * (same image shown in the report header), falling back to the first generated
 * look photo when a report predates cover generation.
 */
export async function getReportHeroStoragePath(
  id: string,
): Promise<string | null> {
  if (isDemoReportId(id)) return null;

  if (!hasSupabaseAdmin) {
    const report = getMockReport(id);
    if (!report) return null;
    const lookImage = report.looks.map((l) => l.image).find(Boolean);
    return report.coverImage ?? lookImage ?? null;
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("is_public, tier, cover_image")
    .eq("id", id)
    .maybeSingle();

  if (
    !row?.is_public ||
    !canShareReport((row.tier as Tier | null) ?? "free")
  ) {
    return null;
  }

  // Prefer the editorial cover (matches the report header); fall back to a look.
  if (row.cover_image) return row.cover_image as string;

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

/** Turn a resolved image path (static, remote, or storage) into an OG result. */
async function resolveOgImageFromPath(
  imagePath: string | null,
): Promise<ReportOgImageResult> {
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

/** Resolve hero image bytes/path for social crawlers; always falls back to flatlay PNG. */
export async function resolveReportOgImage(
  id: string,
): Promise<ReportOgImageResult> {
  if (isDemoReportId(id)) return staticFallback();
  return resolveOgImageFromPath(await getReportHeroStoragePath(id));
}

/**
 * Storage path of a specific look photo, gated to publicly shareable reports so
 * the per-look share card never leaks a private report's imagery.
 */
export async function getReportLookStoragePath(
  id: string,
  index: number,
): Promise<string | null> {
  if (isDemoReportId(id) || !Number.isInteger(index) || index < 0) return null;

  if (!hasSupabaseAdmin) {
    const report = getMockReport(id);
    return report?.looks[index]?.image ?? null;
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select("is_public, tier")
    .eq("id", id)
    .maybeSingle();

  if (
    !row?.is_public ||
    !canShareReport((row.tier as Tier | null) ?? "free")
  ) {
    return null;
  }

  const { data: looks } = await admin
    .from("looks")
    .select("image_path")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  return (looks?.[index]?.image_path as string | null) ?? null;
}

/** Resolve a specific look's OG image; falls back to flatlay when unavailable. */
export async function resolveLookOgImage(
  id: string,
  index: number,
): Promise<ReportOgImageResult> {
  if (isDemoReportId(id)) return staticFallback();
  return resolveOgImageFromPath(await getReportLookStoragePath(id, index));
}

/** Direct static OG image URL (flatlay fallback). */
export function reportOgFallbackImageUrl(): string {
  return absoluteUrl(REPORT_OG_FALLBACK);
}

/** Stable OG image URL for a report (served by `/api/og/report/[id]`). */
export function reportOgImageUrl(id: string): string {
  return absoluteUrl(`/api/og/report/${id}`);
}

/** Stable OG image URL for a single look (served by `/api/og/report/[id]/look/[index]`). */
export function reportOgLookImageUrl(id: string, index: number): string {
  return absoluteUrl(`/api/og/report/${id}/look/${index}`);
}

/**
 * Whether a report may be shown on a public share card — the demo, or a
 * link-shared report on a shareable tier. Gates personal data in the OG image.
 */
export async function isShareableReport(id: string): Promise<boolean> {
  if (isDemoReportId(id)) return true;

  if (!hasSupabaseAdmin) {
    return Boolean(getMockReport(id));
  }

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("reports")
    .select("is_public, tier")
    .eq("id", id)
    .maybeSingle();

  return Boolean(
    data?.is_public && canShareReport((data.tier as Tier | null) ?? "free"),
  );
}

/** Pick metadata OG image: branded share card for shareable reports, else static flatlay. */
export async function reportOgMetadataImageUrl(id: string): Promise<string> {
  return (await isShareableReport(id))
    ? reportOgImageUrl(id)
    : reportOgFallbackImageUrl();
}
