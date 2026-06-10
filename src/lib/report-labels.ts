import type { Tier } from "@/lib/report";

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  basic: "Basic",
  lookbook: "Lookbook",
  premium: "Premium",
};

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier] ?? tier;
}

export function reportStatusLabel(
  status: "processing" | "ready" | "failed",
): string {
  if (status === "processing") return "Generating";
  if (status === "failed") return "Failed";
  return "Ready";
}
