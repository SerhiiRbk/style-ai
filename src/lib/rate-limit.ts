import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";

export type LimitResult = {
  /** Whether this hit is within the limit. */
  allowed: boolean;
  /** Number of hits recorded in the current window (0 when the check was skipped). */
  count: number;
};

/**
 * Atomic fixed-window rate-limit check backed by `public.rate_limit_hit`.
 *
 * The Postgres RPC increments the bucket and returns the running count in a
 * single round-trip, so counters are correct across serverless instances (which
 * an in-memory Map cannot be — see A0 in the growth spec).
 *
 * @param bucket         Unique counter key, e.g. `colours:global:2026-08-03`.
 * @param limit          Max hits allowed in the window.
 * @param windowSeconds  Window length; an expired window resets the counter.
 * @param opts.failOpen  What to return if Postgres is unavailable. Cost caps
 *                       must fail *closed* (deny); comfort limits fail *open*.
 */
export async function checkLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
  opts: { failOpen: boolean },
): Promise<LimitResult> {
  if (!hasSupabaseAdmin) {
    return { allowed: opts.failOpen, count: 0 };
  }
  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window: `${Math.max(1, Math.round(windowSeconds))} seconds`,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("rate_limit_hit returned no row");
    return {
      allowed: Boolean((row as { allowed: boolean }).allowed),
      count: Number((row as { hit_count: number }).hit_count),
    };
  } catch (err) {
    console.error("[rate-limit] check failed", bucket, err);
    return { allowed: opts.failOpen, count: 0 };
  }
}
