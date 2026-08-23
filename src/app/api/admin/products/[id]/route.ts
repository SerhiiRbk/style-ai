import { NextResponse } from "next/server";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-api";
import {
  ADMIN_PRODUCT_SELECT,
  persistAdminProduct,
} from "@/lib/data/admin-catalog-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ product: data });
}

/** Update a catalogue product. Re-types attributes and re-embeds when AI is on. */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  const { data: row, error: fetchErr } = await admin
    .from("products")
    .select("id, source, external_id, source_type")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const saved = await persistAdminProduct(body, {
    id: row.id,
    source: row.source,
    external_id: row.external_id,
    source_type: row.source_type,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status });
  }
  return NextResponse.json({ ok: true, id: saved.id });
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
