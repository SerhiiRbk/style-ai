import { NextResponse } from "next/server";
import { embed } from "ai";
import { embedText } from "../../../../../../scripts/feeds/normalize.mjs";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-api";
import { isCatalogCategory } from "@/lib/catalog-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** Update a catalogue product (category). Re-embeds when AI is configured. */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const category = body?.category;
  if (typeof category !== "string" || !isCatalogCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: row, error: fetchErr } = await admin
    .from("products")
    .select("id, brand, title, category, color, gender, description")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    category,
    updated_at: new Date().toISOString(),
  };

  if (hasAI) {
    const { embedding } = await embed({
      model: env.embedModel,
      value: embedText({ ...row, category }),
    });
    update.embedding = embedding;
  }

  const { error } = await admin.from("products").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, category });
}

/** Permanently remove a product from the catalogue. */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = createAdminSupabase();
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
