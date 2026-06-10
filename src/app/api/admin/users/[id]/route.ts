import { NextResponse } from "next/server";
import { hasSupabaseAdmin } from "@/lib/env";
import { requireAdminApi } from "@/lib/admin-api";
import { getAdminUserDetail } from "@/lib/data/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full per-user activity (admin only). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!hasSupabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured (service role required)" },
      { status: 503 },
    );
  }

  const { id } = await params;

  try {
    const user = await getAdminUserDetail(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
