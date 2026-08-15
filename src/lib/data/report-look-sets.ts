import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  styleProfileSchema,
  type StyleProfile,
  type Boldness,
} from "@/lib/style-profile";
import type { LookBriefSeason } from "@/lib/ai/look-brief";
import type { ShoppingItem } from "@/lib/report";
import { reportLookSetPhotoPaths } from "@/lib/photo-tryon";
import { REPORT_LOOK_SET_OCCASION_ID } from "@/lib/look-contexts";
import {
  createLookSet,
  findLookSetByRequestKey,
  markLookSetReady,
} from "@/lib/data/look-sets";

type AdminClient = ReturnType<typeof createAdminSupabase>;

function reportSetRequestKey(reportId: string): string {
  return `report:${reportId}`;
}

function reportSetName(headline: string | null | undefined): string {
  const name = headline?.trim();
  return name || "Style report";
}

function seasonFromProfile(profile: StyleProfile): LookBriefSeason {
  const season = profile.colorSeason;
  if (
    season === "spring" ||
    season === "summer" ||
    season === "autumn" ||
    season === "winter"
  ) {
    return season;
  }
  return "autumn";
}

function parseProfile(raw: unknown): StyleProfile | null {
  const parsed = styleProfileSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (raw && typeof raw === "object") return raw as StyleProfile;
  return null;
}

/**
 * Mirror a Style Report's looks into a look set so they appear on /looks and
 * can be edited in the constructor. Same look rows keep `report_id` (report
 * page unchanged) and gain `set_id`. Idempotent via request_key + report_id.
 */
export async function ensureReportLookSet(
  admin: AdminClient,
  opts: { reportId: string; userId: string },
): Promise<{ id: string } | null> {
  const { reportId, userId } = opts;

  const { data: report, error: reportErr } = await admin
    .from("reports")
    .select("id, user_id, headline, profile, look_items, status, created_at")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (reportErr) {
    console.error("[look-set] ensureReportLookSet report failed", reportId, reportErr.message);
    return null;
  }
  if (!report) return null;

  const { data: lookRows, error: looksErr } = await admin
    .from("looks")
    .select("id, set_id, idx")
    .eq("report_id", reportId);
  if (looksErr) {
    console.error("[look-set] ensureReportLookSet looks failed", reportId, looksErr.message);
    return null;
  }
  if (!lookRows?.length) return null;

  const name = reportSetName(report.headline as string | null);
  const looksCount = lookRows.length;
  const setStatus = report.status === "ready" ? "ready" : "generating";
  const createdAt = (report.created_at as string | null) ?? undefined;

  let setId: string | null = null;
  const { data: byReport } = await admin
    .from("look_sets")
    .select("id")
    .eq("report_id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (byReport?.id) setId = byReport.id as string;
  if (!setId) {
    const byKey = await findLookSetByRequestKey(
      admin,
      userId,
      reportSetRequestKey(reportId),
    );
    if (byKey) setId = byKey.id;
  }

  if (!setId) {
    const profile = parseProfile(report.profile);
    if (!profile) {
      console.error("[look-set] ensureReportLookSet missing profile", reportId);
      return null;
    }
    const { faceRefPath, fullRefPath } = await reportLookSetPhotoPaths(admin, {
      userId,
      reportId,
      reportCreatedAt: createdAt,
    });
    try {
      const created = await createLookSet(admin, {
        userId,
        reportId,
        occasionId: REPORT_LOOK_SET_OCCASION_ID,
        season: seasonFromProfile(profile),
        boldness: (profile.boldness as Boldness | undefined) ?? "moderate",
        name,
        profile,
        isPublic: false,
        requestKey: reportSetRequestKey(reportId),
        looksCount,
        faceRefPath,
        fullRefPath,
        status: setStatus,
        createdAt,
      });
      setId = created.id;
    } catch (err) {
      const raced = await findLookSetByRequestKey(
        admin,
        userId,
        reportSetRequestKey(reportId),
      );
      if (!raced) {
        console.error("[look-set] ensureReportLookSet create failed", reportId, err);
        return null;
      }
      setId = raced.id;
    }
  }

  const unlinked = lookRows.filter((l) => l.set_id !== setId);
  if (unlinked.length) {
    const { error: linkErr } = await admin
      .from("looks")
      .update({ set_id: setId })
      .eq("report_id", reportId);
    if (linkErr) {
      console.error("[look-set] ensureReportLookSet link looks failed", reportId, linkErr.message);
    }
  }

  const lookItems = (report.look_items as Record<number, ShoppingItem[]> | null) ?? null;
  const patch: Record<string, unknown> = {
    name,
    looks_count: looksCount,
    ...(createdAt ? { created_at: createdAt } : {}),
  };
  if (lookItems && Object.keys(lookItems).length) {
    patch.look_items = lookItems;
  }
  let { error: updErr } = await admin.from("look_sets").update(patch).eq("id", setId);
  if (updErr && /looks_count|look_items/.test(updErr.message)) {
    delete patch.looks_count;
    if (updErr.message.includes("look_items")) delete patch.look_items;
    ({ error: updErr } = await admin.from("look_sets").update(patch).eq("id", setId));
  }
  if (updErr) {
    console.error("[look-set] ensureReportLookSet update failed", setId, updErr.message);
  }

  if (setStatus === "ready") {
    await markLookSetReady(admin, setId);
  }

  // Existing mirrored sets (first backfill) often have empty ref paths, so
  // constructor/try-on fell through to the catalog default — a different photo
  // than the report. Fill them from the report whenever they are missing.
  const { data: refRow } = await admin
    .from("look_set_profiles")
    .select("face_ref_path, full_ref_path")
    .eq("set_id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!refRow?.face_ref_path || !refRow?.full_ref_path) {
    const fromReport = await reportLookSetPhotoPaths(admin, {
      userId,
      reportId,
      reportCreatedAt: createdAt,
    });
    const patch: Record<string, unknown> = {};
    if (!refRow?.face_ref_path && fromReport.faceRefPath) {
      patch.face_ref_path = fromReport.faceRefPath;
    }
    if (!refRow?.full_ref_path && fromReport.fullRefPath) {
      patch.full_ref_path = fromReport.fullRefPath;
    }
    if (Object.keys(patch).length) {
      const { error: refErr } = await admin
        .from("look_set_profiles")
        .update(patch)
        .eq("set_id", setId)
        .eq("user_id", userId);
      if (refErr && !/face_ref_path|full_ref_path|column/i.test(refErr.message)) {
        console.error(
          "[look-set] ensureReportLookSet ref paths failed",
          setId,
          refErr.message,
        );
      }
    }
  }

  return { id: setId };
}

/**
 * Mirror any ready reports that don't already have a look set. Skips sets that
 * already exist — the old per-visit loop re-wrote every report on /looks and
 * made the page wait on dozens of sequential updates.
 */
export async function ensureUserReportLookSets(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const { data: reports, error } = await admin
    .from("reports")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[look-set] ensureUserReportLookSets reports failed", error.message);
    return;
  }
  const reportIds = (reports ?? []).map((row) => row.id as string);
  if (!reportIds.length) return;

  const { data: existing, error: existingErr } = await admin
    .from("look_sets")
    .select("report_id")
    .eq("user_id", userId)
    .in("report_id", reportIds);
  if (existingErr) {
    console.error(
      "[look-set] ensureUserReportLookSets existing failed",
      existingErr.message,
    );
    return;
  }
  const have = new Set(
    (existing ?? [])
      .map((row) => row.report_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );
  const missing = reportIds.filter((id) => !have.has(id));
  if (!missing.length) return;

  await Promise.all(
    missing.map(async (reportId) => {
      try {
        await ensureReportLookSet(admin, { reportId, userId });
      } catch (err) {
        console.error(
          "[look-set] ensureUserReportLookSets one failed",
          reportId,
          err,
        );
      }
    }),
  );
}
