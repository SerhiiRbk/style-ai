import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  normalizeHairColorId,
  type Measurements,
  type UserProfile,
} from "@/lib/style-profile";

type AdminClient = ReturnType<typeof createAdminSupabase>;

type ProfileRow = {
  country: string | null;
  city: string | null;
  currency: string | null;
  language: string | null;
  occupation: string | null;
  gender_presentation: string | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  hair_color: string | null;
  eye_color: string | null;
  measurements: Measurements | null;
  goals: string[] | null;
  boldness: string | null;
  budget_eur: { min: number; max: number } | null;
  lifestyle: string[] | null;
};

function rowToProfile(r: ProfileRow): UserProfile {
  const p: UserProfile = {};
  if (r.country) p.country = r.country;
  if (r.city) p.city = r.city;
  if (r.currency) p.currency = r.currency as UserProfile["currency"];
  if (r.language) p.language = r.language as UserProfile["language"];
  if (r.occupation) p.occupation = r.occupation;
  if (r.gender_presentation)
    p.genderPresentation = r.gender_presentation as UserProfile["genderPresentation"];
  if (r.birth_year != null) p.birthYear = r.birth_year;
  if (r.height_cm != null) p.heightCm = r.height_cm;
  if (r.weight_kg != null) p.weightKg = r.weight_kg;
  if (r.body_type) p.bodyType = r.body_type as UserProfile["bodyType"];
  if (r.hair_color) {
    const hair = normalizeHairColorId(r.hair_color);
    if (hair) p.hairColor = hair;
  }
  if (r.eye_color) p.eyeColor = r.eye_color as UserProfile["eyeColor"];
  if (r.measurements) p.measurements = r.measurements;
  if (r.goals) p.goals = r.goals;
  if (r.boldness) p.boldness = r.boldness as UserProfile["boldness"];
  if (r.budget_eur) p.budgetEur = r.budget_eur;
  if (r.lifestyle) p.lifestyle = r.lifestyle;
  return p;
}

function profileToRow(p: UserProfile): Record<string, unknown> {
  return {
    country: p.country ?? null,
    city: p.city ?? null,
    currency: p.currency ?? null,
    language: p.language ?? null,
    occupation: p.occupation ?? null,
    gender_presentation: p.genderPresentation ?? null,
    birth_year: p.birthYear ?? null,
    height_cm: p.heightCm ?? null,
    weight_kg: p.weightKg ?? null,
    body_type: p.bodyType ?? null,
    hair_color: p.hairColor ?? null,
    eye_color: p.eyeColor ?? null,
    measurements: p.measurements ?? null,
    goals: p.goals ?? null,
    boldness: p.boldness ?? null,
    budget_eur: p.budgetEur ?? null,
    lifestyle: p.lifestyle ?? null,
  };
}

/**
 * The user's saved profile, or null when none exists / the table isn't there
 * yet (migration not applied). Never throws — a missing profile just means the
 * wizard falls back to geo + defaults.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!hasSupabaseAdmin) return null;
  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToProfile(data as ProfileRow);
  } catch {
    return null;
  }
}

/** Upsert the user's profile (explicit save from the account page / wizard). */
export async function upsertUserProfile(
  userId: string,
  profile: UserProfile,
): Promise<boolean> {
  if (!hasSupabaseAdmin) return false;
  try {
    const admin = createAdminSupabase();
    const { error } = await admin.from("user_profiles").upsert(
      {
        user_id: userId,
        ...profileToRow(profile),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Lazily create the profile from a report's derived defaults IF the user has
 * none yet. Never overwrites an existing (possibly edited) profile, and never
 * throws — a failure here must not break report generation.
 */
export async function seedProfileIfMissing(
  admin: AdminClient,
  userId: string,
  profile: UserProfile,
  reportId: string,
): Promise<void> {
  try {
    const { data } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return; // already exists — never clobber
    await admin
      .from("user_profiles")
      .insert({
        user_id: userId,
        ...profileToRow(profile),
        seeded_from_report_id: reportId,
      });
  } catch {
    /* non-fatal */
  }
}
