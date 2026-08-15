import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { lookSetAssetPaths } from "@/lib/data/look-sets";

/**
 * Delete a Create-a-Look set the user owns. Removing the `look_sets` row cascades
 * to its `looks` and `look_set_profiles` (FK on delete cascade); the rendered
 * images in the `assets` bucket are removed best-effort first so they aren't
 * orphaned.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminSupabase();

  // Ownership check — also the guard that a non-owner can't delete a public set.
  const { data: set } = await admin
    .from("look_sets")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!set) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Report-mirrored looks keep `report_id`. Unlink them first so deleting the
  // set does not cascade-delete the report's looks.
  const { error: unlinkErr } = await admin
    .from("looks")
    .update({ set_id: null })
    .eq("set_id", id)
    .not("report_id", "is", null);
  if (unlinkErr) {
    console.error("[look-set] unlink report looks failed", id, unlinkErr.message);
  }

  // Best-effort: remove the rendered images before the rows go away.
  const paths = await lookSetAssetPaths(admin, id);
  if (paths.length) {
    const { error: rmErr } = await admin.storage.from("assets").remove(paths);
    if (rmErr) {
      console.error("[look-set] image cleanup failed", id, rmErr.message);
    }
  }

  const { error } = await admin
    .from("look_sets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
