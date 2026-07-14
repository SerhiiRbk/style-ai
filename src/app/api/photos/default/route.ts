import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

/**
 * Pin a full-length photo as the user's default try-on model. Passing an empty
 * storagePath clears the default (falls back to the latest full-length upload).
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Requires live mode" }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const storagePath =
    typeof body?.storagePath === "string" ? body.storagePath.trim() : "";

  const admin = createAdminSupabase();

  // Clear any existing default first (at most one per user).
  await admin
    .from("photos")
    .update({ is_default_tryon: false })
    .eq("user_id", user.id);

  if (!storagePath) {
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  const { data: row } = await admin
    .from("photos")
    .select("storage_path, role")
    .eq("user_id", user.id)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if ((row.role as string) !== "full") {
    return NextResponse.json(
      { error: "Only full-length photos can be used for try-on" },
      { status: 422 },
    );
  }

  const { error } = await admin
    .from("photos")
    .update({ is_default_tryon: true })
    .eq("user_id", user.id)
    .eq("storage_path", storagePath);
  if (error) {
    console.error("[photos/default] update failed", error);
    return NextResponse.json({ error: "Could not set default" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
