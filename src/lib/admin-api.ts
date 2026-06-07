import "server-only";
import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/** Gate admin API routes — signed-in user whose email is in ADMIN_EMAILS. */
export async function requireAdminApi(): Promise<
  | { ok: true; user: { id: string; email?: string | null } }
  | { ok: false; response: NextResponse }
> {
  if (!hasSupabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin tools require live mode" },
        { status: 501 },
      ),
    };
  }
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (!isAdminEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
