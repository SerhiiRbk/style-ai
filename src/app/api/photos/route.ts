import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

/** Which reference photos the signed-in user has on file. */
export async function GET() {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Requires live mode" }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("photos")
    .select("role")
    .eq("user_id", user.id);

  const roles = [...new Set((data ?? []).map((p) => p.role as string))];
  return NextResponse.json({ roles, hasFull: roles.includes("full") });
}

/** Register a newly uploaded full-length reference photo for try-on. */
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
  const role = typeof body?.role === "string" ? body.role : "";
  const storagePath =
    typeof body?.storagePath === "string" ? body.storagePath : "";

  if (role !== "full" || !storagePath) {
    return NextResponse.json({ error: "Invalid photo payload" }, { status: 400 });
  }

  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("photos").insert({
    user_id: user.id,
    role: "full",
    storage_path: storagePath,
  });
  if (error) {
    console.error("[photos] insert failed", error);
    return NextResponse.json({ error: "Could not save photo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
