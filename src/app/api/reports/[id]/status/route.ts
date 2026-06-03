import { NextResponse } from "next/server";
import { reportGenerationState } from "@/lib/data/reports";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (id === "demo" || !hasSupabase) {
    return NextResponse.json({
      status: "ready",
      pending: false,
      phase: null,
    });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error } = await sb
    .from("reports")
    .select("status, tier, capsule_images")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: looks } = await sb
    .from("looks")
    .select("image_path")
    .eq("report_id", id);

  const state = reportGenerationState(row, looks ?? []);
  return NextResponse.json(state);
}
