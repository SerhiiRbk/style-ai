import "server-only";
import { reportGenerationState } from "@/lib/data/reports";
import { hasSupabase } from "@/lib/env";
import type { ReportGenerationState } from "@/lib/report";
import { createServerSupabase } from "@/lib/supabase/server";

export type UserPendingReport = {
  reportId: string;
  state: ReportGenerationState;
};

/** Most recent in-progress report for the signed-in user, if any. */
export async function getUserPendingReport(): Promise<UserPendingReport | null> {
  if (!hasSupabase) return null;

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: rows, error } = await sb
    .from("reports")
    .select(
      "id, status, tier, capsule_images, hair, facial_hair, eyewear, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !rows?.length) return null;

  const { data: userPhotos } = await sb
    .from("photos")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);
  const hasReferencePhoto = (userPhotos?.length ?? 0) > 0;

  for (const row of rows) {
    const { data: looks } = await sb
      .from("looks")
      .select("image_path")
      .eq("report_id", row.id);

    const state = reportGenerationState(row, looks ?? [], {
      hasReferencePhoto,
    });

    if (state.pending) {
      return { reportId: row.id as string, state };
    }
  }

  return null;
}
