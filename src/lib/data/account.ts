import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";
import { revokeBiometricConsentIfIdle } from "@/lib/data/consent";

type Admin = ReturnType<typeof createAdminSupabase>;

/** Recursively collect every object path under a storage prefix. */
async function listAllFiles(
  admin: Admin,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error || !data) return out;
  for (const entry of data) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Supabase marks folders with a null id; recurse into them.
    if (entry.id === null) {
      out.push(...(await listAllFiles(admin, bucket, full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Remove a list of object paths from a bucket, batched. */
async function removePaths(
  admin: Admin,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
}

/** Delete every object under a storage prefix (recursive). */
async function removePrefix(
  admin: Admin,
  bucket: string,
  prefix: string,
): Promise<void> {
  const files = await listAllFiles(admin, bucket, prefix);
  if (files.length) await removePaths(admin, bucket, files);
}

/**
 * Permanently delete a single report and all of its generated content.
 *
 * - DB: removes the `reports` row (cascades `looks`, `recommendations`).
 * - Storage: removes `assets/{userId}/{reportId}/…` and the report's look
 *   try-on images (`assets/{userId}/tryon/look-{reportId}-…`).
 *
 * Caller MUST have verified the report belongs to `userId`.
 */
export async function deleteReportData(
  userId: string,
  reportId: string,
): Promise<void> {
  const admin = createAdminSupabase();

  await removePrefix(admin, "assets", `${userId}/${reportId}`);

  // Look try-ons live in a shared per-user folder, keyed by report id.
  const tryonDir = `${userId}/tryon`;
  const tryonFiles = await listAllFiles(admin, "assets", tryonDir);
  const reportTryons = tryonFiles.filter((p) =>
    p.split("/").pop()?.startsWith(`look-${reportId}-`),
  );
  if (reportTryons.length) await removePaths(admin, "assets", reportTryons);

  const { error } = await admin.from("reports").delete().eq("id", reportId);
  if (error) throw new Error(error.message);

  await revokeBiometricConsentIfIdle(userId);
}

/**
 * Permanently delete a user's account and ALL associated data (GDPR erasure).
 *
 * - Storage: removes everything under `photos/{userId}/` and `assets/{userId}/`.
 * - DB + auth: deleting the auth user cascades every user-scoped table
 *   (profiles, reports, looks, recommendations, tryons, photos, consents,
 *   credits_ledger).
 */
export async function deleteAccountData(userId: string): Promise<void> {
  const admin = createAdminSupabase();

  await removePrefix(admin, "assets", userId);
  await removePrefix(admin, "photos", userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
