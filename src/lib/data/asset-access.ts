import "server-only";
import { isAdminEmail } from "@/lib/admin";
import { reportIdFromStoragePath } from "@/lib/asset-url";
import { hasSupabaseAdmin } from "@/lib/env";
import { canShareReport, type Tier } from "@/lib/report";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/** Whether the current viewer may read this private `assets` bucket object. */
export async function canAccessAssetPath(storagePath: string): Promise<boolean> {
  if (!hasSupabaseAdmin) return false;

  const parts = storagePath.split("/").filter(Boolean);
  const ownerUserId = parts[0];
  if (!ownerUserId) return false;

  const admin = createAdminSupabase();
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (user?.id === ownerUserId) return true;
  if (user && isAdminEmail(user.email)) return true;

  let reportId = reportIdFromStoragePath(storagePath);
  if (!reportId && parts[1] === "tryon") {
    const { data: tryon } = await admin
      .from("tryons")
      .select("report_id")
      .eq("image_path", storagePath)
      .maybeSingle();
    reportId = (tryon?.report_id as string | null) ?? null;
  }

  if (!reportId) return false;

  const { data: row } = await admin
    .from("reports")
    .select("user_id, is_public, tier")
    .eq("id", reportId)
    .maybeSingle();

  if (!row || row.user_id !== ownerUserId) return false;

  const tier = (row.tier as Tier | null) ?? "free";
  return Boolean(row.is_public) && canShareReport(tier);
}

/** Download bytes from the private assets bucket (server-side). */
export async function downloadAssetBytes(
  storagePath: string,
): Promise<Uint8Array | null> {
  if (!hasSupabaseAdmin) return null;
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from("assets")
    .download(storagePath);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

