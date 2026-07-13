import "server-only";
import crypto from "node:crypto";
import { storagePathFromAssetSrc } from "@/lib/asset-url";
import { downloadAssetBytes } from "@/lib/data/asset-access";
import { hasSupabaseAdmin } from "@/lib/env";
import { buildReportPdf } from "@/lib/pdf/report-pdf";
import type { StyleReport } from "@/lib/report";
import { createAdminSupabase } from "@/lib/supabase/server";

const BUCKET = "assets";

/**
 * Bump when the PDF layout/template code changes so every previously cached PDF
 * is invalidated (its fingerprint no longer matches) and rebuilt on next access.
 */
const PDF_TEMPLATE_VERSION = "4";

/** Signed proxy/absolute URLs carry a rotating ?exp&sig — drop it so the fingerprint is stable. */
function stripSig(s: string): string {
  if (s.includes("/api/assets/") || /^https?:\/\//.test(s)) {
    return s.split("?")[0] ?? s;
  }
  return s;
}

// Fields that never affect the rendered PDF (or are view-scoped) — excluded so the
// same report yields one cache entry regardless of who downloads it.
const IGNORED_FIELDS = new Set(["generation", "intake", "outfitTryons"]);

/**
 * Stable content fingerprint of everything the PDF renders. Signed-URL query
 * strings and volatile/view-scoped fields are excluded so daily signature
 * rotation and owner-vs-public differences don't cause cache misses.
 */
export function reportPdfFingerprint(report: StyleReport): string {
  const json = JSON.stringify(report, (key, value) => {
    if (IGNORED_FIELDS.has(key)) return undefined;
    if (typeof value === "string") return stripSig(value);
    return value;
  });
  return crypto
    .createHash("sha256")
    .update(`${PDF_TEMPLATE_VERSION}:${json}`)
    .digest("hex")
    .slice(0, 16);
}

/** Owner user id, derived from any stored asset path (cache path stays co-located with assets). */
function ownerUserId(report: StyleReport): string | null {
  const candidates: (string | null | undefined)[] = [
    report.coverImage,
    ...(report.looks?.map((l) => l.image) ?? []),
    ...(report.capsuleImages ?? []),
    ...(report.hair?.recommend ?? []).map((h) => h.image),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const uid = storagePathFromAssetSrc(c)?.split("/").filter(Boolean)[0];
    if (uid) return uid;
  }
  return null;
}

function cacheDir(report: StyleReport): string {
  const uid = ownerUserId(report);
  return uid ? `${uid}/${report.id}` : `pdf-cache/${report.id}`;
}

/** Only cache fully-generated reports — a partial build would be served forever. */
function isReady(report: StyleReport): boolean {
  return !report.generation?.pending;
}

/** Cached PDF bytes when a build matching the current content exists, else null. */
export async function getCachedReportPdf(
  report: StyleReport,
): Promise<Uint8Array | null> {
  if (!hasSupabaseAdmin || !isReady(report)) return null;
  const fp = reportPdfFingerprint(report);
  return downloadAssetBytes(`${cacheDir(report)}/report-${fp}.pdf`);
}

/** Upload PDF bytes to the cache and remove superseded builds for this report. */
export async function putCachedReportPdf(
  report: StyleReport,
  bytes: Uint8Array,
): Promise<void> {
  if (!hasSupabaseAdmin || !isReady(report)) return;
  const dir = cacheDir(report);
  const filename = `report-${reportPdfFingerprint(report)}.pdf`;
  const admin = createAdminSupabase();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(`${dir}/${filename}`, Buffer.from(bytes), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) {
    console.error("[pdf-cache] upload failed", report.id, error.message);
    return;
  }
  await removeStalePdfs(dir, filename);
}

/** Remove every cached PDF build for a report (admin regenerate / manual invalidation). */
export async function invalidateReportPdfCache(
  report: StyleReport,
): Promise<void> {
  if (!hasSupabaseAdmin) return;
  await removeStalePdfs(cacheDir(report), null);
}

async function removeStalePdfs(dir: string, keep: string | null): Promise<void> {
  const admin = createAdminSupabase();
  const { data: list } = await admin.storage.from(BUCKET).list(dir);
  const stale = (list ?? [])
    .filter((f) => /^report-.*\.pdf$/.test(f.name) && f.name !== keep)
    .map((f) => `${dir}/${f.name}`);
  if (stale.length) await admin.storage.from(BUCKET).remove(stale);
}

/** Force a fresh build and overwrite the cache — used by the admin "Regenerate PDF" action. */
export async function rebuildReportPdf(
  report: StyleReport,
): Promise<Uint8Array> {
  await invalidateReportPdfCache(report);
  const bytes = await buildReportPdf(report);
  await putCachedReportPdf(report, bytes).catch(() => {});
  return bytes;
}
