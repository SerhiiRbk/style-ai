import { NextResponse } from "next/server";
import { retryFailedReport } from "@/lib/data/reports";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  REPORT_COST,
  spendCreditsOnce,
  refundReportCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import type { Tier } from "@/lib/report";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Not available" }, { status: 503 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: row, error } = await admin
    .from("reports")
    .select("id, user_id, tier, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (row.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed reports can be retried" },
      { status: 409 },
    );
  }

  const tier = row.tier as Tier;
  const cost = REPORT_COST[tier];
  let creditsCharged = false;

  if (cost > 0) {
    try {
      await spendCreditsOnce(admin, {
        userId: user.id,
        amount: cost,
        reason: "report",
        refId: id,
      });
      creditsCharged = true;
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits to retry this report.",
            code: "insufficient_credits",
            balance: e.balance,
            needed: e.needed,
          },
          { status: 402 },
        );
      }
      throw e;
    }
  }

  try {
    await retryFailedReport(id, user.id);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (creditsCharged && cost > 0) {
      try {
        await refundReportCredits(admin, {
          userId: user.id,
          amount: cost,
          reportId: id,
        });
      } catch (refundErr) {
        console.error("[report retry] credit refund failed", refundErr);
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Retry failed" },
      { status: 500 },
    );
  }
}
