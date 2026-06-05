import { NextResponse } from "next/server";
import { getReport } from "@/lib/store";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { deleteReportData } from "@/lib/data/account";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = getReport(id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}

/** Permanently delete a report and all of its content (owner only, GDPR). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json(
      { error: "Report deletion is not available." },
      { status: 501 },
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // RLS scopes this to the owner; a non-owner simply gets no row.
  const { data: row, error } = await sb
    .from("reports")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteReportData(user.id, id);
  return NextResponse.json({ ok: true });
}
