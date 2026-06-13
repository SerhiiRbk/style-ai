import { NextResponse } from "next/server";
import { getUserPendingReport } from "@/lib/data/user-pending-report";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Whether the signed-in user has a report still generating. */
export async function GET() {
  if (!hasSupabase) {
    return NextResponse.json({ pending: false });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ pending: false });
  }

  const pending = await getUserPendingReport();
  if (!pending) {
    return NextResponse.json({ pending: false });
  }

  return NextResponse.json({
    pending: true,
    reportId: pending.reportId,
    state: pending.state,
  });
}
