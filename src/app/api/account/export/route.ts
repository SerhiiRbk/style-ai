import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { exportUserData } from "@/lib/data/account-export";

/** GDPR data portability — structured JSON export for the signed-in user. */
export async function GET() {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json(
      { error: "Data export is not available in demo mode." },
      { status: 501 },
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const payload = await exportUserData(user.id);
  const filename = `valetti-data-export-${user.id.slice(0, 8)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
