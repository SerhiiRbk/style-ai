import { NextResponse } from "next/server";
import { hasAI, hasSupabaseAdmin } from "@/lib/env";
import {
  finishIncompleteReports,
  resumeReportImages,
} from "@/lib/data/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Backstop for interrupted report image generation. Scans recent `ready`
 * reports that are still missing look / hair / grooming / cover / capsule /
 * watch images and resumes a bounded number of them (idempotent — only gaps
 * are filled). Scheduled via vercel.json; CRON_SECRET-gated. Can also be
 * triggered manually with the same bearer token.
 *
 * Optional `?reportId=<uuid>` resumes a single report (used for one-off
 * backfills such as the watch flat-lay on older premium/lookbook reports).
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

  const url = new URL(request.url);
  const reportId = url.searchParams.get("reportId");
  // EXPERIMENTAL — `?promptVersion=N` A/B-overrides IMAGE_PROMPT_VERSION for a
  // one-off resume, so a battery can be rendered without a redeploy.
  const promptVersion = url.searchParams.get("promptVersion");
  if (reportId) {
    const res = await resumeReportImages(
      reportId,
      promptVersion != null ? { promptVersion } : undefined,
    );
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.reason ?? "resume-failed" },
        { status: res.reason === "not-found" ? 404 : 400 },
      );
    }
    return NextResponse.json({ ok: true, resumed: [reportId] });
  }

  const result = await finishIncompleteReports({
    // Leave headroom under maxDuration so an in-flight resume can finish.
    budgetMs: 540_000,
    maxReports: 4,
  });

  return NextResponse.json({ ok: true, ...result });
}
