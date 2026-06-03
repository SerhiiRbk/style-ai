import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!hasSupabase) {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isPublic =
    typeof body === "object" &&
    body !== null &&
    "isPublic" in body &&
    typeof (body as { isPublic: unknown }).isPublic === "boolean"
      ? (body as { isPublic: boolean }).isPublic
      : null;

  if (isPublic === null) {
    return NextResponse.json({ error: "isPublic boolean required" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await sb
    .from("reports")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("is_public")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ isPublic: data.is_public as boolean });
}
