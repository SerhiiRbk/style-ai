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
import { lookItemsNeedRefresh, matchLookItems } from "@/lib/data/catalog";
import {
  parseArchivedLookImages,
  type ArchivedLookImage,
} from "@/lib/look-archive";

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
    /** How many looks this set was billed to generate. */
    looksCount: number;
    /** Storage paths of the photo the set was rendered on — so the whole-look
     * try-on renders on the SAME photo. Stored owner-only. */
    faceRefPath?: string | null;
    fullRefPath?: string | null;
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
    looksCount,
    faceRefPath,
    fullRefPath,
  } = opts;

  const baseRow = {
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
  };
  let { data, error } = await admin
    .from("look_sets")
    .insert({ ...baseRow, looks_count: looksCount, status: "generating" })
    .select("id")
    .single();
  if (error && /looks_count|status/.test(error.message)) {
    ({ data, error } = await admin
      .from("look_sets")
      .insert(baseRow)
      .select("id")
      .single());
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error("look_sets insert returned no row");

  const id = data.id as string;

  // Include ref paths on the insert when present. If the columns aren't
  // migrated yet (pre-0041), retry without them so set creation still works;
  // try-on then falls back to the user's default photo.
  const profileRow: Record<string, unknown> = {
    set_id: id,
    user_id: userId,
    profile,
  };
  if (faceRefPath) profileRow.face_ref_path = faceRefPath;
  if (fullRefPath) profileRow.full_ref_path = fullRefPath;

  let { error: profileErr } = await admin
    .from("look_set_profiles")
    .insert(profileRow);
  if (
    profileErr &&
    (faceRefPath || fullRefPath) &&
    /face_ref_path|full_ref_path|column/i.test(profileErr.message)
  ) {
    console.error(
      "[look-set] ref path columns missing (pre-0041?) — inserting profile without them",
      id,
      profileErr.message,
    );
    ({ error: profileErr } = await admin
      .from("look_set_profiles")
      .insert({ set_id: id, user_id: userId, profile }));
  }
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
    idx: number;
    look: { context: string; title: string; description: string; palette: string[] };
    imagePath: string;
  },
): Promise<void> {
  const { setId, userId, idx, look, imagePath } = opts;
  // `idx` is the look's stable content-order position (0-based). It keeps looks
  // aligned with `look_sets.look_items` (also keyed by idx) and with the
  // `{idx}.ext` storage path — set looks are inserted concurrently in chunks, so
  // created_at order is non-deterministic and must not be relied on for pairing.
  const { error } = await admin.from("looks").insert({
    report_id: null,
    set_id: setId,
    user_id: userId,
    idx,
    context: look.context,
    title: look.title,
    description: look.description,
    palette: look.palette,
    image_path: imagePath,
  });
  if (error) throw new Error(error.message);
}

const GENERATING_STALE_MS = 20 * 60 * 1000;

/** True while the look-set route is still writing looks. `status` is the
 *  source of truth once migration 0043 is applied; without it we treat a
 *  recent incomplete set as still in flight so placeholders still show. */
export function setIsGenerating(
  status: string | null | undefined,
  createdAt: string,
  readyCount: number,
  looksCount: number | null,
): boolean {
  if (status === "ready") return false;
  if (status === "generating") return true;
  const age = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(age) || age > GENERATING_STALE_MS) return false;
  if (looksCount != null) return readyCount < looksCount;
  return readyCount === 0;
}

export async function markLookSetReady(
  admin: AdminClient,
  setId: string,
): Promise<void> {
  const { error } = await admin
    .from("look_sets")
    .update({ status: "ready" })
    .eq("id", setId);
  if (error && !/status/.test(error.message)) {
    console.error("[look-set] markLookSetReady failed", setId, error.message);
  }
}

type SetLookRow = {
  idx: unknown;
  context: unknown;
  title: unknown;
  description: unknown;
  palette: unknown;
  image_path: unknown;
  image_path_tq?: unknown;
};

const LOOK_ROW_SELECT =
  "idx, context, title, description, palette, image_path, image_path_tq";
const LOOK_ROW_SELECT_BASE =
  "idx, context, title, description, palette, image_path";

async function selectSetLookRows(
  admin: AdminClient,
  setId: string,
): Promise<{ data: SetLookRow[] | null; error: { message: string } | null }> {
  const first = await admin
    .from("looks")
    .select(LOOK_ROW_SELECT)
    .eq("set_id", setId)
    .order("idx", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (first.error && /image_path_tq/.test(first.error.message)) {
    return admin
      .from("looks")
      .select(LOOK_ROW_SELECT_BASE)
      .eq("set_id", setId)
      .order("idx", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  }
  return first;
}

function looksFromRows(
  rows: SetLookRow[],
  looksCount: number | null,
  generating: boolean,
): LoadedSetLook[] {
  const ready: LoadedSetLook[] = rows
    .filter((r) => r.image_path)
    .map((r, i) => ({
      idx: (r.idx as number | null) ?? i,
      context: (r.context as string | null) ?? "",
      title: (r.title as string | null) ?? "",
      description: (r.description as string | null) ?? "",
      palette: (r.palette as string[] | null) ?? [],
      imagePath: r.image_path as string,
      imagePathTq:
        typeof r.image_path_tq === "string" && r.image_path_tq
          ? r.image_path_tq
          : null,
    }));
  if (!generating) return ready;
  const count = looksCount ?? Math.max(ready.length, 3);
  const byIdx = new Map(ready.map((l) => [l.idx, l]));
  return Array.from({ length: count }, (_, i) => {
    return (
      byIdx.get(i) ?? {
        idx: i,
        context: "",
        title: "",
        description: "",
        palette: [],
        imagePath: null,
        imagePathTq: null,
      }
    );
  });
}

async function readSetProgress(
  admin: AdminClient,
  setId: string,
): Promise<{ looksCount: number | null; status: string | null }> {
  const { data, error } = await admin
    .from("look_sets")
    .select("looks_count, status")
    .eq("id", setId)
    .maybeSingle();
  if (error) return { looksCount: null, status: null };
  return {
    looksCount: (data?.looks_count as number | null) ?? null,
    status: (data?.status as string | null) ?? null,
  };
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
  /** Stable content-order index; the key into `look_items` (see saveSetLook). */
  idx: number;
  context: string;
  title: string;
  description: string;
  palette: string[];
  /** Null while this slot is still rendering (set status = generating). */
  imagePath: string | null;
  /** Optional 3/4 companion; null until the owner generates it. */
  imagePathTq: string | null;
};

export type { ArchivedLookImage };

/** Persist replaced look images so the gallery can list them as plain pictures. */
export async function archiveReplacedLookImages(
  admin: AdminClient,
  setId: string,
  images: { path: string | null | undefined; title: string }[],
): Promise<void> {
  const incoming = images.filter(
    (i): i is { path: string; title: string } => Boolean(i.path),
  );
  if (!incoming.length) return;

  const { data, error } = await admin
    .from("look_sets")
    .select("archived_images")
    .eq("id", setId)
    .maybeSingle();
  if (error) {
    if (/archived_images/.test(error.message)) {
      console.error(
        "[look-set] archived_images column missing",
        setId,
        error.message,
      );
      return;
    }
    console.error("[look-set] read archived_images failed", setId, error.message);
    return;
  }

  const existing = parseArchivedLookImages(data?.archived_images);
  const seen = new Set(existing.map((e) => e.path));
  const now = new Date().toISOString();
  for (const img of incoming) {
    if (seen.has(img.path)) continue;
    existing.push({ path: img.path, title: img.title, createdAt: now });
    seen.add(img.path);
  }

  const { error: updErr } = await admin
    .from("look_sets")
    .update({ archived_images: existing })
    .eq("id", setId);
  if (updErr) {
    console.error("[look-set] write archived_images failed", setId, updErr.message);
  }
}

/** Storage paths to delete with a set (current looks, 3/4, archived). */
export async function lookSetAssetPaths(
  admin: AdminClient,
  setId: string,
): Promise<string[]> {
  const paths = new Set<string>();
  const firstLooks = await admin
    .from("looks")
    .select("image_path, image_path_tq")
    .eq("set_id", setId);
  const looksQuery =
    firstLooks.error && /image_path_tq/.test(firstLooks.error.message)
      ? await admin.from("looks").select("image_path").eq("set_id", setId)
      : firstLooks;
  if (looksQuery.error) {
    console.error(
      "[look-set] lookSetAssetPaths looks failed",
      setId,
      looksQuery.error.message,
    );
  }
  for (const row of looksQuery.data ?? []) {
    const front = row.image_path as string | null;
    const tq = (row as { image_path_tq?: string | null }).image_path_tq ?? null;
    if (front) paths.add(front);
    if (tq) paths.add(tq);
  }

  const { data: set, error: setErr } = await admin
    .from("look_sets")
    .select("archived_images")
    .eq("id", setId)
    .maybeSingle();
  if (setErr && !/archived_images/.test(setErr.message)) {
    console.error("[look-set] lookSetAssetPaths archive failed", setId, setErr.message);
  }
  for (const img of parseArchivedLookImages(set?.archived_images)) {
    paths.add(img.path);
  }
  return [...paths];
}

export type LoadedLookSet = {
  setId: string;
  shareSlug: string | null;
  isPublic: boolean;
  carloNote: string | null;
  occasionId: string;
  createdAt: string;
  lookItems: Record<number, ShoppingItem[]> | null;
  looks: LoadedSetLook[];
  generating: boolean;
};

type LookSetHeaderRow = {
  id: string;
  user_id: string;
  share_slug: string | null;
  is_public: boolean | null;
  carlo_note: string | null;
  occasion_id: string | null;
  created_at: string;
};

const LOOK_SET_HEADER_SELECT =
  "id, user_id, share_slug, is_public, carlo_note, occasion_id, created_at";

async function assembleLookSetResult(
  admin: AdminClient,
  set: LookSetHeaderRow,
  logLabel: string,
): Promise<LoadedLookSet> {
  const setId = set.id;
  const { looksCount, status } = await readSetProgress(admin, setId);

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

  // Order by the stable `idx` (set looks are inserted concurrently, so
  // created_at is non-deterministic); created_at is only a tie-break for legacy
  // rows predating idx (null idx sorts last). For those legacy rows the fallback
  // idx below is their created_at position — which matches how their look_items
  // were keyed, so alignment is preserved.
  const { data: rows, error: rowsErr } = await selectSetLookRows(admin, setId);
  if (rowsErr) console.error(`[look-set] ${logLabel} looks query failed`, rowsErr.message);

  const readyCount = (rows ?? []).filter((r) => r.image_path).length;
  const generating = setIsGenerating(
    status,
    set.created_at,
    readyCount,
    looksCount,
  );
  const looks = looksFromRows(rows ?? [], looksCount, generating);

  // Self-heal: missing look_items (pre-persistence sets) or a stale match
  // version (e.g. shirt+trouser colour clash guard). Await so this view and
  // a same-session try-on see the new picks, not the stored sage+olive pair.
  if (looks.some((l) => l.imagePath)) {
    lookItems = await ensureSetLookItems(
      admin,
      set.user_id,
      setId,
      lookItems,
      looks,
    );
  }

  return {
    setId: set.id,
    shareSlug: set.share_slug ?? null,
    isPublic: set.is_public ?? false,
    carloNote: set.carlo_note ?? null,
    occasionId: set.occasion_id ?? "",
    createdAt: set.created_at,
    lookItems,
    looks,
    generating,
  };
}

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
): Promise<LoadedLookSet | null> {
  const { data: set, error: setErr } = await admin
    .from("look_sets")
    .select(LOOK_SET_HEADER_SELECT)
    .eq("id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  if (setErr) console.error("[look-set] loadLookSetResult set query failed", setErr.message);
  if (!set) return null;
  return assembleLookSetResult(admin, set as LookSetHeaderRow, "loadLookSetResult");
}

/** Any look set by id (admin / internal). Returns null if missing. */
export async function loadLookSetById(
  admin: AdminClient,
  setId: string,
): Promise<LoadedLookSet | null> {
  const { data: set, error: setErr } = await admin
    .from("look_sets")
    .select(LOOK_SET_HEADER_SELECT)
    .eq("id", setId)
    .maybeSingle();
  if (setErr) console.error("[look-set] loadLookSetById set query failed", setErr.message);
  if (!set) return null;
  return assembleLookSetResult(admin, set as LookSetHeaderRow, "loadLookSetById");
}

/**
 * Load a PUBLIC (shared) set for a non-owner viewer — gated on is_public, not
 * user-scoped. Returns the same render fields as loadLookSetResult minus any
 * owner-only data: no share_slug, and no self-heal backfill (that reads the
 * owner-only profile side table). A viewer of an old set just sees the looks
 * without "shop the look". Returns null when the set doesn't exist or isn't
 * shared. Never touches look_set_profiles (PII).
 */
export async function loadPublicLookSet(
  admin: AdminClient,
  setId: string,
): Promise<{
  setId: string;
  carloNote: string | null;
  occasionId: string;
  createdAt: string;
  lookItems: Record<number, ShoppingItem[]> | null;
  looks: LoadedSetLook[];
  generating: boolean;
} | null> {
  const { data: set, error: setErr } = await admin
    .from("look_sets")
    .select("id, carlo_note, occasion_id, created_at")
    .eq("id", setId)
    .eq("is_public", true)
    .maybeSingle();
  if (setErr) console.error("[look-set] loadPublicLookSet set query failed", setErr.message);
  if (!set) return null;

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

  const { data: rows, error: rowsErr } = await selectSetLookRows(admin, setId);
  if (rowsErr) console.error("[look-set] loadPublicLookSet looks query failed", rowsErr.message);

  const looks = looksFromRows(rows ?? [], null, false);

  return {
    setId: set.id as string,
    carloNote: (set.carlo_note as string | null) ?? null,
    occasionId: (set.occasion_id as string | null) ?? "",
    createdAt: set.created_at as string,
    lookItems,
    looks,
    generating: false,
  };
}

/**
 * Recompute and persist look_items when they are missing or a stale match
 * version. Used on set load and on try-on so a version bump (e.g. the
 * shirt+trouser clash guard) takes effect in the same session.
 */
export async function ensureSetLookItems(
  admin: AdminClient,
  userId: string,
  setId: string,
  lookItems: Record<number, ShoppingItem[]> | null | undefined,
  looks?: LoadedSetLook[],
): Promise<Record<number, ShoppingItem[]> | null> {
  if (lookItems && !lookItemsNeedRefresh(lookItems)) return lookItems;

  let resolved = looks;
  if (!resolved) {
    const { data: rows, error } = await selectSetLookRows(admin, setId);
    if (error) {
      console.error(
        "[look-set] ensureSetLookItems looks query failed",
        error.message,
      );
      return lookItems ?? null;
    }
    resolved = looksFromRows(rows ?? [], null, false);
  }

  const withImages = resolved.filter(
    (l): l is LoadedSetLook & { imagePath: string } => Boolean(l.imagePath),
  );
  if (!withImages.length) return lookItems ?? null;
  return backfillSetLookItems(admin, userId, setId, withImages);
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

    // matchLookItems keys results by position in content.looks; re-key by each
    // look's stable `idx` so the persisted map lines up with how the set view
    // and try-on look items up (by idx, not array position).
    const byPos = await matchLookItems(parsed.data, content);
    const items: Record<number, ShoppingItem[]> = {};
    looks.forEach((l, p) => {
      const matched = byPos[p];
      if (matched?.length) items[l.idx] = matched;
    });
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
  generating: boolean;
};

/**
 * List a user's look sets (newest first) with a thumbnail (their first look's
 * image path — signed by the caller). Owner-scoped. Powers the Looks list
 * history page.
 */
export async function listUserLookSets(
  admin: AdminClient,
  userId: string,
  limit = 60,
): Promise<LookSetSummary[]> {
  type SetRow = {
    id: unknown;
    occasion_id: unknown;
    name: unknown;
    created_at: unknown;
    looks_count?: unknown;
    status?: unknown;
  };
  let sets: SetRow[] | null = null;
  {
    const first = await admin
      .from("look_sets")
      .select("id, occasion_id, name, created_at, looks_count, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (first.error && /looks_count|status/.test(first.error.message)) {
      const fallback = await admin
        .from("look_sets")
        .select("id, occasion_id, name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (fallback.error) {
        console.error("[look-set] listUserLookSets failed", fallback.error.message);
        return [];
      }
      sets = fallback.data as SetRow[] | null;
    } else if (first.error) {
      console.error("[look-set] listUserLookSets failed", first.error.message);
      return [];
    } else {
      sets = first.data as SetRow[] | null;
    }
  }
  if (!sets?.length) return [];

  const ids = sets.map((s) => s.id as string);
  const { data: looks } = await admin
    .from("looks")
    .select("set_id, image_path, created_at")
    .in("set_id", ids)
    .order("created_at", { ascending: true });

  const thumbBySet = new Map<string, string>();
  const readyBySet = new Map<string, number>();
  for (const l of looks ?? []) {
    const sid = l.set_id as string;
    if (l.image_path) {
      readyBySet.set(sid, (readyBySet.get(sid) ?? 0) + 1);
      if (!thumbBySet.has(sid)) thumbBySet.set(sid, l.image_path as string);
    }
  }

  return sets.map((s) => {
    const id = s.id as string;
    const looksCount = (s.looks_count as number | null | undefined) ?? null;
    const status = (s.status as string | null | undefined) ?? null;
    return {
      id,
      occasionId: (s.occasion_id as string | null) ?? "",
      name: (s.name as string | null) ?? "",
      createdAt: s.created_at as string,
      thumbPath: thumbBySet.get(id) ?? null,
      generating: setIsGenerating(
        status,
        s.created_at as string,
        readyBySet.get(id) ?? 0,
        looksCount,
      ),
    };
  });
}
