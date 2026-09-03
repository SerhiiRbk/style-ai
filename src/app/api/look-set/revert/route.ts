import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import type { ShoppingItem } from "@/lib/report";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import {
  archiveReplacedLookImages,
  clearConstructEstimate,
} from "@/lib/data/look-sets";
import { cacheBustAssetUrl } from "@/lib/data/look-three-quarter";
import { originalsFromArchived } from "@/lib/look-archive";
import { mergeOriginalLooks, parseOriginalLooks } from "@/lib/look-original";

export const runtime = "nodejs";

/**
 * Restore one look to Carlo's snapshot from the first constructor Apply.
 * Free — no credits, no regenerate.
 */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const setId: unknown = body?.setId;
  const lookIndex: unknown = body?.lookIndex;
  if (typeof setId !== "string" || !setId) {
    return NextResponse.json({ error: "Missing setId" }, { status: 400 });
  }
  if (typeof lookIndex !== "number" || !Number.isInteger(lookIndex) || lookIndex < 0) {
    return NextResponse.json({ error: "Invalid lookIndex" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  let setQuery = await admin
    .from("look_sets")
    .select("id, original_looks, look_items, archived_images")
    .eq("id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (setQuery.error && /original_looks/.test(setQuery.error.message)) {
    setQuery = await admin
      .from("look_sets")
      .select("id, look_items, archived_images")
      .eq("id", setId)
      .eq("user_id", user.id)
      .maybeSingle();
  }
  const setRow = setQuery.data;
  if (!setRow) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const originals = mergeOriginalLooks(
    parseOriginalLooks((setRow as { original_looks?: unknown }).original_looks),
    originalsFromArchived((setRow as { archived_images?: unknown }).archived_images),
  );
  const original = originals[lookIndex];
  if (!original) {
    return NextResponse.json(
      { error: "No original look to restore" },
      { status: 409 },
    );
  }

  const { data: lookRows, error: lookErr } = await admin
    .from("looks")
    .select("id, idx, title, image_path, image_path_tq")
    .eq("set_id", setId)
    .eq("idx", lookIndex)
    .order("created_at", { ascending: false })
    .limit(1);
  if (lookErr && !/image_path_tq/.test(lookErr.message)) {
    return NextResponse.json({ error: "Look not found" }, { status: 409 });
  }
  let lookRow = lookRows?.[0] as
    | {
        id: string;
        title: string | null;
        image_path: string | null;
        image_path_tq?: string | null;
      }
    | undefined;
  if (!lookRow) {
    const fallback = await admin
      .from("looks")
      .select("id, idx, title, image_path")
      .eq("set_id", setId)
      .eq("idx", lookIndex)
      .limit(1);
    lookRow = fallback.data?.[0] as typeof lookRow;
  }
  if (!lookRow) {
    return NextResponse.json({ error: "Look not found" }, { status: 409 });
  }

  await archiveReplacedLookImages(admin, setId, [
    { path: lookRow.image_path, title: lookRow.title ?? original.title },
    {
      path: lookRow.image_path_tq ?? null,
      title: `${lookRow.title ?? original.title} · 3/4`,
    },
  ]);

  const update: Record<string, unknown> = {
    title: original.title,
    description: original.description,
    palette: original.palette,
    image_path: original.imagePath,
    image_path_tq: original.imagePathTq,
  };
  let { error: updErr } = await admin.from("looks").update(update).eq("id", lookRow.id);
  if (updErr && /image_path_tq/.test(updErr.message)) {
    delete update.image_path_tq;
    ({ error: updErr } = await admin.from("looks").update(update).eq("id", lookRow.id));
  }
  if (updErr) {
    return NextResponse.json({ error: "Could not restore look" }, { status: 500 });
  }

  const lookItems =
    (setRow.look_items as Record<number, ShoppingItem[]> | null) ?? {};
  lookItems[lookIndex] = original.items;
  await admin.from("look_sets").update({ look_items: lookItems }).eq("id", setId);
  await clearConstructEstimate(admin, setId, lookIndex);

  return NextResponse.json({
    ok: true,
    image: cacheBustAssetUrl(signedAssetProxyUrl(original.imagePath)),
    imageTq: original.imagePathTq
      ? cacheBustAssetUrl(signedAssetProxyUrl(original.imagePathTq))
      : null,
    title: original.title,
    description: original.description,
    palette: original.palette,
    items: original.items,
  });
}
