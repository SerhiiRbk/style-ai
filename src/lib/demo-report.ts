import type { StyleReport } from "@/lib/report";

/** Canonical slug for the public sample / prospect report. */
export const DEMO_REPORT_SLUG = "valetti-style-prospect-demo" as const;

/** Pre-rendered outfit photos for the deterministic demo capsule matrix. */
export const DEMO_CAPSULE_IMAGES = [
  "/images/look-work.png",
  "/images/capsule/capsule-2.png",
  "/images/capsule/capsule-3.png",
  "/images/capsule/capsule-4.png",
  "/images/capsule/capsule-5.png",
  "/images/capsule/capsule-6.png",
] as const;

/** Legacy alias kept for old bookmarks and API calls. */
export const LEGACY_DEMO_SLUG = "demo" as const;

export function isDemoReportId(id: string): boolean {
  return id === DEMO_REPORT_SLUG || id === LEGACY_DEMO_SLUG;
}

export function demoReportPath(): string {
  return `/report/${DEMO_REPORT_SLUG}`;
}

/** Capsule matrix image for combo `index` (demo fallbacks or stored report assets). */
export function capsuleMatrixImageAt(
  report: StyleReport,
  index: number,
): string | undefined {
  const stored = report.capsuleImages?.[index];
  if (stored) return stored;
  if (isDemoReportId(report.id)) return DEMO_CAPSULE_IMAGES[index];
  return undefined;
}
