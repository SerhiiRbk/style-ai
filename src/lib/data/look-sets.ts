import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getLatestReportProfile } from "@/lib/data/match-profile";
import { styleProfileSchema, type StyleProfile, type Boldness } from "@/lib/style-profile";
import type { LookBriefSeason } from "@/lib/ai/look-brief";

type AdminClient = ReturnType<typeof createAdminSupabase>;

/**
 * Look for a StyleProfile the caller can reuse WITHOUT a new photo, cheapest
 * and most-personalised source first:
 *   1. The latest Style Report profile, when the caller actually has a
 *      personalised one (getLatestReportProfile's `personalised` flag —
 *      not its neutral fallback).
 *   2. The most recent snapshot from a prior look set.
 * Returns `null` when neither exists, so the caller knows a fresh photo +
 * vision analysis is required. Never touches photos/intake — this is the
 * "does the user need to upload anything" check, used by the route to decide
 * whether to require a photo/consent/photo-gate at all (standalone-first
 * reuse rule: returning users pick an existing profile, only new users
 * upload).
 */
export async function resolveExistingProfile(
  admin: AdminClient,
  userId: string,
): Promise<{ profile: StyleProfile; source: "report" | "prior_set" } | null> {
  const rep = await getLatestReportProfile(userId);
  if (rep.personalised) {
    return { profile: rep.profile, source: "report" };
  }

  const { data } = await admin
    .from("look_set_profiles")
    .select("profile")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const parsed = styleProfileSchema.safeParse(data?.profile);
  if (parsed.success) {
    return { profile: parsed.data, source: "prior_set" };
  }

  return null;
}

/**
 * Create a new look set. `look_sets` itself never stores the StyleProfile —
 * it's publicly readable once shared, and the profile is PII (see
 * 0039_look_sets.sql header comment) — so the snapshot goes into the
 * owner-only `look_set_profiles` side table in a second insert keyed by the
 * new set's id. The `profile` input stays on this function's signature so
 * callers don't need to know about the split.
 */
export async function createLookSet(
  admin: AdminClient,
  opts: {
    userId: string;
    reportId: string | null;
    occasionId: string;
    season: LookBriefSeason;
    boldness: Boldness;
    name: string;
    carloNote?: string | null;
    profile: StyleProfile;
    isPublic: boolean;
    shareSlug?: string | null;
  },
): Promise<{ id: string }> {
  const {
    userId,
    reportId,
    occasionId,
    season,
    boldness,
    name,
    carloNote,
    profile,
    isPublic,
    shareSlug,
  } = opts;

  const { data, error } = await admin
    .from("look_sets")
    .insert({
      user_id: userId,
      report_id: reportId,
      occasion_id: occasionId,
      season,
      boldness,
      carlo_note: carloNote ?? null,
      name,
      is_public: isPublic,
      share_slug: shareSlug ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const id = data.id as string;

  const { error: profileErr } = await admin
    .from("look_set_profiles")
    .insert({ set_id: id, user_id: userId, profile });
  if (profileErr) {
    // Compensate: don't leave an orphaned look_sets row with no profile and
    // no looks. Mirrors reports/report_intake's compensating delete on the
    // child insert's failure (src/lib/data/reports.ts:1661-1664).
    await admin.from("look_sets").delete().eq("id", id);
    throw new Error(profileErr.message);
  }

  return { id };
}

/**
 * Save one generated look for a standalone set. Mirrors the `looks` insert in
 * /api/look-extra, but `report_id` is null (set-looks have no parent report —
 * see the `looks.report_id` nullability fix folded into 0039_look_sets.sql)
 * and `set_id` links back to the owning set instead.
 */
export async function saveSetLook(
  admin: AdminClient,
  opts: {
    setId: string;
    userId: string;
    look: { context: string; title: string; description: string; palette: string[] };
    imagePath: string;
  },
): Promise<void> {
  const { setId, userId, look, imagePath } = opts;
  const { error } = await admin.from("looks").insert({
    report_id: null,
    set_id: setId,
    user_id: userId,
    context: look.context,
    title: look.title,
    description: look.description,
    palette: look.palette,
    image_path: imagePath,
  });
  if (error) throw new Error(error.message);
}
