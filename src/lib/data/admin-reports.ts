import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getReportFeedbackByReportIds } from "@/lib/data/report-feedback";
import type { Tier } from "@/lib/report";

export type { ReportFeedbackSummary } from "@/lib/data/report-feedback";

export type AdminReportSummary = {
  id: string;
  createdAt: string;
  headline: string | null;
  tier: Tier;
  status: "processing" | "ready" | "failed";
  userId: string;
  userEmail: string | null;
  isPublic: boolean;
  feedbackRating: number | null;
  feedbackComment: string | null;
};

const PAGE_SIZE = 50;

export async function listAdminReports(opts?: {
  page?: number;
  q?: string;
}): Promise<{
  reports: AdminReportSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} | null> {
  if (!hasSupabaseAdmin) return null;

  const page = Math.max(1, opts?.page ?? 1);
  const q = opts?.q?.trim() ?? "";
  const admin = createAdminSupabase();
  const from = (page - 1) * PAGE_SIZE;

  let query = admin
    .from("reports")
    .select("id, created_at, headline, tier, status, user_id, is_public", {
      count: "exact",
    });

  if (q) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", `%${q}%`);
    const userIds = (profiles ?? []).map((p) => p.id as string);
    if (userIds.length) {
      query = query.or(
        `headline.ilike.%${q}%,user_id.in.(${userIds.join(",")})`,
      );
    } else {
      query = query.ilike("headline", `%${q}%`);
    }
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const emailByUser = new Map<string, string | null>();

  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      emailByUser.set(p.id as string, (p.email as string | null) ?? null);
    }
  }

  const reportIds = rows.map((r) => r.id as string);
  const feedbackByReport = await getReportFeedbackByReportIds(reportIds);

  const reports: AdminReportSummary[] = rows.map((row) => {
    const feedback = feedbackByReport.get(row.id as string);
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      headline: (row.headline as string | null) ?? null,
      tier: (row.tier as Tier) ?? "basic",
      status:
        row.status === "processing" || row.status === "failed"
          ? row.status
          : "ready",
      userId: row.user_id as string,
      userEmail: emailByUser.get(row.user_id as string) ?? null,
      isPublic: Boolean(row.is_public),
      feedbackRating: feedback?.rating ?? null,
      feedbackComment: feedback?.comment ?? null,
    };
  });

  const total = count ?? 0;
  return {
    reports,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
