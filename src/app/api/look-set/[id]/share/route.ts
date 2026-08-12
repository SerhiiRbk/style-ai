import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Toggle public sharing for a look set the caller owns. Mirrors
 * /api/reports/[id]/share, minus the tier gate (any owner may share a set).
 * The public RLS policy requires both is_public = true AND share_slug not null
 * (0039_look_sets.sql), so we backfill a slug on enable if one is somehow
 * missing — normally createLookSet already set one.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!hasSupabase) {
    return NextResponse.json(
      { error: "Not available in demo mode" },
      { status: 503 },
    );
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
    return NextResponse.json(
      { error: "isPublic boolean required" },
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

  const { data: row, error: fetchErr } = await sb
    .from("look_sets")
    .select("share_slug")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: { is_public: boolean; share_slug?: string } = {
    is_public: isPublic,
  };
  if (isPublic && !row.share_slug) {
    update.share_slug = randomBytes(9).toString("base64url");
  }

  const { data, error } = await sb
    .from("look_sets")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("is_public")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ isPublic: data.is_public as boolean });
}
