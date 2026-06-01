import { NextResponse } from "next/server";
import { hasSupabase, hasAI } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateLookImage } from "@/lib/ai/pipeline";
import type { StyleProfile } from "@/lib/style-profile";

/**
 * Full-look virtual try-on: render an entire outfit on the signed-in user's own
 * photo, preserving their identity via the image model (image-to-image). Unlike
 * /api/tryon (single garment via FASHN), this handles multi-piece looks and the
 * capsule "week of outfits" combinations described in text.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json(
      { error: "Try-on requires live mode" },
      { status: 501 },
    );
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image generation is not configured" },
      { status: 501 },
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
  const reportId: string | undefined = body?.reportId;
  const description: string | undefined = body?.description;
  const title: string = typeof body?.title === "string" ? body.title : "Look";
  const palette: string[] = Array.isArray(body?.palette)
    ? body.palette.filter((c: unknown): c is string => typeof c === "string")
    : [];
  if (!reportId || !description) {
    return NextResponse.json(
      { error: "Missing reportId or description" },
      { status: 400 },
    );
  }

  // Load the profile from the user's own report (RLS scopes to the owner).
  const { data: report } = await sb
    .from("reports")
    .select("profile")
    .eq("id", reportId)
    .single();
  const profile = report?.profile as StyleProfile | undefined;
  if (!profile) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const admin = createAdminSupabase();

  // Most recent full-length (fallback: any) photo for the user.
  const { data: photos } = await admin
    .from("photos")
    .select("storage_path, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const chosen = photos?.find((p) => p.role === "full") ?? photos?.[0] ?? null;
  if (!chosen) {
    return NextResponse.json(
      { error: "Upload a full-length photo to try looks on yourself" },
      { status: 422 },
    );
  }

  const { data: signed } = await admin.storage
    .from("photos")
    .createSignedUrl(chosen.storage_path, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 500 });
  }

  const result = await generateLookImage({
    profile,
    look: { title, description, palette },
    referenceImageUrl: signed.signedUrl,
  });
  if (!result) {
    return NextResponse.json({ error: "Try-on failed" }, { status: 502 });
  }

  const ext = result.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = `${user.id}/tryon/look-${reportId}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, result.bytes, { contentType: result.mediaType, upsert: true });
  if (upErr) {
    return NextResponse.json(
      { error: "Could not store result" },
      { status: 500 },
    );
  }

  await admin.from("tryons").insert({
    user_id: user.id,
    image_path: path,
    status: "ready",
  });

  const { data: out } = await admin.storage
    .from("assets")
    .createSignedUrl(path, 600);

  return NextResponse.json({ url: out?.signedUrl ?? null }, { status: 201 });
}
