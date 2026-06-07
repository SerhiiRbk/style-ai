import { NextResponse } from "next/server";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** List catalogue products for the admin editor (search + filters + paging). */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured (service role required)" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category") ?? "";
  const source = url.searchParams.get("source") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const admin = createAdminSupabase();
  let query = admin
    .from("products")
    .select(
      "id,source,brand,title,category,color,price_eur,image_url,source_type,hidden,created_at",
      { count: "exact" },
    );

  if (category) query = query.eq("category", category);
  if (source) query = query.eq("source", source);
  if (q) query = query.or(`title.ilike.%${q}%,brand.ilike.%${q}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    products: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  });
}
