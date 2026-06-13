import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";

export type ReportOwnerFeedback = {
  rating: number;
  comment: string | null;
  updatedAt: string;
};

/** Owner feedback for a report — admin/service role only. */
export async function getReportOwnerFeedback(
  reportId: string,
): Promise<ReportOwnerFeedback | null> {
  if (!hasSupabaseAdmin) return null;

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("report_feedback")
    .select("rating, comment, updated_at")
    .eq("report_id", reportId)
    .maybeSingle();

  if (!row) return null;

  return {
    rating: row.rating as number,
    comment: (row.comment as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export type ReportFeedbackSummary = {
  rating: number;
  comment: string | null;
};

/** Feedback keyed by report id — for admin list views. */
export async function getReportFeedbackByReportIds(
  reportIds: string[],
): Promise<Map<string, ReportFeedbackSummary>> {
  const out = new Map<string, ReportFeedbackSummary>();
  if (!hasSupabaseAdmin || !reportIds.length) return out;

  const admin = createAdminSupabase();
  const { data: rows } = await admin
    .from("report_feedback")
    .select("report_id, rating, comment")
    .in("report_id", reportIds);

  for (const row of rows ?? []) {
    out.set(row.report_id as string, {
      rating: row.rating as number,
      comment: (row.comment as string | null) ?? null,
    });
  }
  return out;
}
