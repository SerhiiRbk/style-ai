import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

type PhotoRow = {
  storage_path: string;
  role: string | null;
  created_at: string;
  is_default_tryon: boolean | null;
};

/** Which reference photos the signed-in user has on file (+ full-length list). */
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
    .select("storage_path, role, created_at, is_default_tryon")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as PhotoRow[];
  const roles = [...new Set(rows.map((p) => p.role as string))];

  // Full-length photos usable as a try-on model, with short-lived signed URLs.
  const fullRows = rows.filter((p) => p.role === "full");
  const photos = await Promise.all(
    fullRows.map(async (p) => {
      const { data: signed } = await admin.storage
        .from("photos")
        .createSignedUrl(p.storage_path, 600);
      return {
        storagePath: p.storage_path,
        url: signed?.signedUrl ?? null,
        isDefault: Boolean(p.is_default_tryon),
        createdAt: p.created_at,
      };
    }),
  );

  return NextResponse.json({
    roles,
    hasFull: roles.includes("full"),
    photos: photos.filter((p) => p.url),
  });
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
  const makeDefault = body?.makeDefault === true;

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
    is_default_tryon: false,
  });
  if (error) {
    console.error("[photos] insert failed", error);
    return NextResponse.json({ error: "Could not save photo" }, { status: 500 });
  }

  if (makeDefault) {
    await admin
      .from("photos")
      .update({ is_default_tryon: false })
      .eq("user_id", user.id);
    await admin
      .from("photos")
      .update({ is_default_tryon: true })
      .eq("user_id", user.id)
      .eq("storage_path", storagePath);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Delete a reference photo (storage object + row). */
export async function DELETE(request: Request) {
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
    typeof body?.storagePath === "string" ? body.storagePath : "";
  if (!storagePath || !storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  await admin.storage.from("photos").remove([storagePath]);
  const { error } = await admin
    .from("photos")
    .delete()
    .eq("user_id", user.id)
    .eq("storage_path", storagePath);
  if (error) {
    console.error("[photos] delete failed", error);
    return NextResponse.json({ error: "Could not delete photo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
