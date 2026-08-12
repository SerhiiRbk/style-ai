import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getLatestReportProfile } from "@/lib/data/match-profile";
import {
  styleProfileSchema,
  type StyleProfile,
  type Boldness,
  type ReportContent,
} from "@/lib/style-profile";
import type { LookBriefSeason } from "@/lib/ai/look-brief";
import type { ShoppingItem } from "@/lib/report";
import { matchLookItems } from "@/lib/data/catalog";

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
    /** Idempotency key — a duplicate insert is blocked by the partial unique
     * index (user_id, request_key) in 0039; the route pre-checks and returns
     * the existing set on replay. */
    requestKey?: string | null;
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
    requestKey,
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
      request_key: requestKey ?? null,
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

/**
 * Idempotency lookup: find an owner's existing set for a given request key.
 * Used by the route to short-circuit a lost-response retry (same
 * Idempotency-Key) before creating/charging a second set. The partial unique
 * index (user_id, request_key) in 0039 makes this the winner on any race.
 */
export async function findLookSetByRequestKey(
  admin: AdminClient,
  userId: string,
  requestKey: string,
): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .from("look_sets")
    .select("id")
    .eq("user_id", userId)
    .eq("request_key", requestKey)
    .maybeSingle();
  // A transient failure here is indistinguishable from "no prior set" and
  // degrades safely (the partial unique index still blocks a duplicate insert),
  // but log it so a persistent problem on this money-path lookup isn't invisible.
  if (error) console.error("[look-set] findLookSetByRequestKey failed", error.message);
  return data ? { id: data.id as string } : null;
}

export type LoadedSetLook = {
  context: string;
  title: string;
  description: string;
  palette: string[];
  imagePath: string;
};

/**
 * Load an owner's set + its stored looks (raw `image_path`s — the caller signs
 * them). Owner-scoped; returns null if the set doesn't exist or isn't the
 * user's. Used for idempotent replay (return the existing set's looks instead
 * of regenerating). Does not touch `look_set_profiles` — the reused profile is
 * not needed to render a result the client already paid for.
 */
export async function loadLookSetResult(
  admin: AdminClient,
  userId: string,
  setId: string,
): Promise<{
  setId: string;
  shareSlug: string | null;
  carloNote: string | null;
  occasionId: string;
  createdAt: string;
  lookItems: Record<number, ShoppingItem[]> | null;
  looks: LoadedSetLook[];
} | null> {
  const { data: set, error: setErr } = await admin
    .from("look_sets")
    .select("id, user_id, share_slug, carlo_note, occasion_id, created_at")
    .eq("id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  if (setErr) console.error("[look-set] loadLookSetResult set query failed", setErr.message);
  if (!set) return null;

  // Best-effort separate read: on a DB where 0040 (look_sets.look_items) is not
  // yet applied, selecting the column would error the whole set load — isolate
  // it so the set still renders (just without "Shop the look").
  let lookItems: Record<number, ShoppingItem[]> | null = null;
  {
    const { data: li, error: liErr } = await admin
      .from("look_sets")
      .select("look_items")
      .eq("id", setId)
      .maybeSingle();
    if (!liErr) {
      lookItems =
        (li?.look_items as Record<number, ShoppingItem[]> | null) ?? null;
    }
  }

  const { data: rows, error: rowsErr } = await admin
    .from("looks")
    .select("context, title, description, palette, image_path")
    .eq("set_id", setId)
    .order("created_at", { ascending: true });
  if (rowsErr) console.error("[look-set] loadLookSetResult looks query failed", rowsErr.message);

  const looks: LoadedSetLook[] = (rows ?? [])
    .filter((r) => r.image_path)
    .map((r) => ({
      context: (r.context as string | null) ?? "",
      title: (r.title as string | null) ?? "",
      description: (r.description as string | null) ?? "",
      palette: (r.palette as string[] | null) ?? [],
      imagePath: r.image_path as string,
    }));

  // Self-heal: sets created before look_items were persisted (or where the
  // match failed at generation) have no items — recompute once on first view
  // and store them, so "Shop the look" + the whole-look try-on work for old
  // sets too. Guarded by `!lookItems` so it runs at most once per set.
  if (!lookItems && looks.length) {
    lookItems = await backfillSetLookItems(admin, userId, setId, looks);
  }

  return {
    setId: set.id as string,
    shareSlug: (set.share_slug as string | null) ?? null,
    carloNote: (set.carlo_note as string | null) ?? null,
    occasionId: (set.occasion_id as string | null) ?? "",
    createdAt: set.created_at as string,
    lookItems,
    looks,
  };
}

/**
 * Recompute the catalogue match for a set's looks and persist it to
 * `look_sets.look_items`. Used to backfill sets that predate item persistence.
 * Best-effort: returns null (and leaves the column untouched) on any failure,
 * so the set still renders — just without "Shop the look".
 */
async function backfillSetLookItems(
  admin: AdminClient,
  userId: string,
  setId: string,
  looks: LoadedSetLook[],
): Promise<Record<number, ShoppingItem[]> | null> {
  try {
    const { data: prof } = await admin
      .from("look_set_profiles")
      .select("profile")
      .eq("set_id", setId)
      .eq("user_id", userId)
      .maybeSingle();
    const parsed = styleProfileSchema.safeParse(prof?.profile);
    if (!parsed.success) return null;

    const content = {
      colors: { best: [], avoid: [] },
      looks: looks.map((l) => ({
        context: l.context,
        title: l.title,
        description: l.description,
        palette: l.palette,
      })),
    } as unknown as ReportContent;

    const items = await matchLookItems(parsed.data, content);
    const { error } = await admin
      .from("look_sets")
      .update({ look_items: items })
      .eq("id", setId);
    if (error) {
      console.error("[look-set] backfill persist failed", setId, error.message);
      return items; // still return them for this render even if the write failed
    }
    return items;
  } catch (err) {
    console.error("[look-set] backfill look_items failed", setId, err);
    return null;
  }
}

export type LookSetSummary = {
  id: string;
  occasionId: string;
  name: string;
  createdAt: string;
  thumbPath: string | null;
};

/**
 * List a user's look sets (newest first) with a thumbnail (their first look's
 * image path — signed by the caller). Owner-scoped. Powers the "Your sets"
 * history page.
 */
export async function listUserLookSets(
  admin: AdminClient,
  userId: string,
  limit = 60,
): Promise<LookSetSummary[]> {
  const { data: sets } = await admin
    .from("look_sets")
    .select("id, occasion_id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!sets?.length) return [];

  const ids = sets.map((s) => s.id as string);
  const { data: looks } = await admin
    .from("looks")
    .select("set_id, image_path, created_at")
    .in("set_id", ids)
    .order("created_at", { ascending: true });

  const thumbBySet = new Map<string, string>();
  for (const l of looks ?? []) {
    const sid = l.set_id as string;
    if (l.image_path && !thumbBySet.has(sid)) {
      thumbBySet.set(sid, l.image_path as string);
    }
  }

  return sets.map((s) => ({
    id: s.id as string,
    occasionId: (s.occasion_id as string | null) ?? "",
    name: (s.name as string | null) ?? "",
    createdAt: s.created_at as string,
    thumbPath: thumbBySet.get(s.id as string) ?? null,
  }));
}
