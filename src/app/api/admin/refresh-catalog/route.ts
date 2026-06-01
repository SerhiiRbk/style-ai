import { NextResponse } from "next/server";
import { start, getRun } from "workflow/api";
import { listSources, sourceConfig } from "../../../../../scripts/feeds/run.mjs";
import {
  refreshCatalogWorkflow,
  type FeedJob,
} from "@/workflows/refresh-catalog";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify the caller is a signed-in admin. Returns an error response or null. */
async function requireAdmin(): Promise<NextResponse | null> {
  if (!hasSupabase) {
    return NextResponse.json(
      { error: "Catalogue tools require live mode" },
      { status: 501 },
    );
  }
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Manually trigger a catalogue refresh from the admin panel. Optionally limit to
 * one source (`sourceKey`) and/or cap rows per source (`limit`). Starts the same
 * durable workflow the daily cron uses and returns its runId for status polling.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY not configured (needed for embeddings)" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const onlySource: string | undefined = body?.sourceKey || undefined;
  const limit =
    typeof body?.limit === "number" && body.limit > 0
      ? Math.floor(body.limit)
      : process.env.CATALOG_REFRESH_LIMIT
        ? parseInt(process.env.CATALOG_REFRESH_LIMIT, 10)
        : undefined;

  const jobs: FeedJob[] = [];
  for (const key of listSources() as string[]) {
    if (onlySource && key !== onlySource) continue;
    const cfg = sourceConfig(key) as { urlEnv: string };
    const url = process.env[cfg.urlEnv];
    if (!url) continue; // source not configured — skip
    jobs.push({ sourceKey: key, url });
  }

  if (jobs.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: onlySource
          ? `Source '${onlySource}' has no *_FEED_URL configured`
          : "No *_FEED_URL sources configured",
      },
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

/** Poll a refresh run started above: GET ?runId=... (admin-gated). */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = getRun(runId);
  const status = await run.status;
  return NextResponse.json({ runId, status });
}
