import { NextResponse } from "next/server";
import { hasSupabaseAdmin } from "@/lib/env";
import { requireAdminApi } from "@/lib/admin-api";
import { listAdminUsers } from "@/lib/data/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List users with activity summaries (admin only). */
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
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  try {
    const result = await listAdminUsers({ page, q });
    if (!result) {
      return NextResponse.json(
        { error: "Server not configured (service role required)" },
        { status: 503 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
