import "server-only";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Tier } from "@/lib/report";

export type UserReportSummary = {
  id: string;
  createdAt: string;
  headline: string | null;
  tier: Tier;
  status: "processing" | "ready" | "failed";
};

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  basic: "Basic",
  lookbook: "Lookbook",
  premium: "Premium",
};

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier] ?? tier;
}

export function reportStatusLabel(status: UserReportSummary["status"]): string {
  if (status === "processing") return "Generating";
  if (status === "failed") return "Failed";
  return "Ready";
}

/** Fetch the signed-in user's reports (RLS-scoped). Returns null if unauthenticated. */
export async function getUserReports(): Promise<UserReportSummary[] | null> {
  if (!hasSupabase) return null;

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from("reports")
    .select("id, created_at, headline, tier, status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    headline: (row.headline as string | null) ?? null,
    tier: (row.tier as Tier) ?? "basic",
    status:
      row.status === "processing" || row.status === "failed"
        ? row.status
        : "ready",
  }));
}
