import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inspect a catalogue-refresh run: GET ?runId=...  (CRON_SECRET-gated).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = getRun(runId);
  const status = await run.status;

  return NextResponse.json({ runId, status });
}
