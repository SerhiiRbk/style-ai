import { NextResponse } from "next/server";
import { start } from "workflow/api";
// Source registry (plain JS, also used by the CLI).
import { listSources, sourceConfig } from "../../../../../scripts/feeds/run.mjs";
import {
  refreshCatalogWorkflow,
  type FeedJob,
} from "@/workflows/refresh-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily catalogue refresh. Collects every registered source whose *_FEED_URL
 * env is set and hands them to a durable workflow that prepares each feed and
 * upserts products in retryable chunks (survives crashes / transient errors).
 * Returns immediately with a runId. Scheduled via vercel.json; CRON_SECRET-gated.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY not configured" },
      { status: 503 },
    );
  }

  const limit = process.env.CATALOG_REFRESH_LIMIT
    ? parseInt(process.env.CATALOG_REFRESH_LIMIT, 10)
    : undefined;

  const jobs: FeedJob[] = [];
  for (const key of listSources() as string[]) {
    const cfg = sourceConfig(key) as { urlEnv: string };
    const url = process.env[cfg.urlEnv];
    if (!url) continue; // source not configured — skip
    jobs.push({ sourceKey: key, url });
  }

  if (jobs.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "No *_FEED_URL sources configured" },
      { status: 200 },
    );
  }

  const run = await start(refreshCatalogWorkflow, [jobs, limit]);

  return NextResponse.json({
    ok: true,
    runId: run.runId,
    startedAt: new Date().toISOString(),
    sources: jobs.map((j) => j.sourceKey),
  });
}
