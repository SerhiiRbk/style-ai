import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";
import { hasSupabaseAdmin } from "@/lib/env";
import { styleProfileSchema, type StyleProfile } from "@/lib/style-profile";

/**
 * A neutral fallback profile for catalogue matching when a signed-in user has no
 * report yet (e.g. they came straight to "Shop a Look"). Deliberately generic:
 * moderate boldness, wide budget, so matching still returns on-category
 * products; suitability re-ranking simply has less to personalise.
 */
export function neutralMatchProfile(country = "Global"): StyleProfile {
  return {
    version: "1.0",
    demographics: {
      age: 30,
      genderPresentation: "male",
      city: "",
      country,
      climate: "temperate",
    },
    physical: {
      skinTone: "medium",
      undertone: "neutral",
      contrast: "medium",
      faceShape: "oval",
      bodyType: "average",
      heightCm: 178,
    },
    colorSeason: "autumn",
    currency: "EUR",
    goals: ["look put-together"],
    lifestyle: [],
    boldness: "moderate",
    budgetEur: { min: 0, max: 400 },
  };
}

/**
 * The style profile from the user's most recent usable report, used to re-rank
 * "Shop a Look" matches against their own palette/fit/budget. Falls back to a
 * neutral profile when the user has no report or the stored profile is malformed.
 */
export async function getLatestReportProfile(
  userId: string,
): Promise<{ profile: StyleProfile; personalised: boolean }> {
  if (!hasSupabaseAdmin) {
    return { profile: neutralMatchProfile(), personalised: false };
  }
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("reports")
      .select("profile, created_at")
      .eq("user_id", userId)
      .not("profile", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const parsed = styleProfileSchema.safeParse(data?.profile);
    if (parsed.success) return { profile: parsed.data, personalised: true };
  } catch (err) {
    console.error("[shop-a-look] profile load failed", err);
  }
  return { profile: neutralMatchProfile(), personalised: false };
}
