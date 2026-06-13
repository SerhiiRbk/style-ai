import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { isDemoReportId } from "@/lib/demo-report";
import { createServerSupabase } from "@/lib/supabase/server";

function parseRating(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/** Owner-only — shared / public viewers must never read or write feedback. */
async function assertReportOwner(
  sb: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  reportId: string,
): Promise<boolean> {
  const { data: report } = await sb
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(report);
}

/** Load the signed-in owner's feedback for this report, if any. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;

  if (!hasSupabase || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await assertReportOwner(sb, user.id, reportId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row } = await sb
    .from("report_feedback")
    .select("rating, comment, updated_at")
    .eq("report_id", reportId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ feedback: null });
  }

  return NextResponse.json({
    feedback: {
      rating: row.rating as number,
      comment: (row.comment as string | null) ?? "",
      updatedAt: row.updated_at as string,
    },
  });
}

/** Create or update owner feedback for this report. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;

  if (!hasSupabase || isDemoReportId(reportId)) {
    return NextResponse.json(
      { error: "Feedback is not available for this report" },
      { status: 400 },
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rating = parseRating(body?.rating);
  if (rating === null) {
    return NextResponse.json(
      { error: "Rating must be an integer from 1 to 5" },
      { status: 400 },
    );
  }

  const comment =
    typeof body?.comment === "string" ? body.comment.trim().slice(0, 2000) : "";

  if (!(await assertReportOwner(sb, user.id, reportId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data: row, error } = await sb
    .from("report_feedback")
    .upsert(
      {
        report_id: reportId,
        user_id: user.id,
        rating,
        comment: comment || null,
        updated_at: now,
      },
      { onConflict: "report_id,user_id" },
    )
    .select("rating, comment, updated_at")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "Could not save feedback" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    feedback: {
      rating: row.rating as number,
      comment: (row.comment as string | null) ?? "",
      updatedAt: row.updated_at as string,
    },
  });
}
