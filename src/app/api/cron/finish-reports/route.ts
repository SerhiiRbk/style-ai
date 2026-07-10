import { NextResponse } from "next/server";
import { hasAI, hasSupabaseAdmin } from "@/lib/env";
import { finishIncompleteReports } from "@/lib/data/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Backstop for interrupted report image generation. Scans recent `ready`
 * reports that are still missing look / hair / grooming / cover / capsule
 * images and resumes a bounded number of them (idempotent — only gaps are
 * filled). Scheduled via vercel.json; CRON_SECRET-gated. Can also be triggered
 * manually with the same bearer token.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdmin || !hasAI) {
    return NextResponse.json(
      { error: "Server not configured (Supabase service role + AI key required)." },
      { status: 503 },
    );
  }

  const result = await finishIncompleteReports({
    // Leave headroom under maxDuration so an in-flight resume can finish.
    budgetMs: 540_000,
    maxReports: 4,
  });

  return NextResponse.json({ ok: true, ...result });
}
