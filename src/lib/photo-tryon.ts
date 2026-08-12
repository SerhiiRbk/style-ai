import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

export type ReportPhotoPath = { role: string; path: string };

export type FullPhotoResult =
  | { ok: true; signedUrl: string; path?: string }
  | {
      ok: false;
      error: string;
      code: "no_photos" | "needs_full_photo";
    };

export type ReportReferencePhotos =
  | { ok: true; fullUrl: string; faceUrl?: string; profileUrl?: string }
  | {
      ok: false;
      error: string;
      code: "no_photos" | "needs_full_photo";
    };

/** Small slack so photos inserted just before the report row are still included. */
const REPORT_PHOTO_CUTOFF_MS = 120_000;

/**
 * Photo paths the user selected when creating the report. Stored on
 * `report_intake.intake.photoPaths` so later unlocks / try-ons / regens use the
 * same person — not "latest upload before report created_at" (which can be a
 * different session entirely when the library has many faces).
 */
export async function getStoredReportPhotoPaths(
  admin: AdminClient,
  reportId: string,
): Promise<ReportPhotoPath[] | null> {
  const { data } = await admin
    .from("report_intake")
    .select("intake")
    .eq("report_id", reportId)
    .maybeSingle();
  const raw = (data?.intake as { photoPaths?: unknown } | null)?.photoPaths;
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: ReportPhotoPath[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const path = (item as { path?: unknown }).path;
    if (typeof role === "string" && role && typeof path === "string" && path) {
      out.push({ role, path });
    }
  }
  return out.length ? out : null;
}

function byRoleMap(
  rows: { role: string | null; storage_path: string }[] | null | undefined,
): Map<string, string> {
  const byRole = new Map<string, string>();
  for (const row of rows ?? []) {
    const role = (row.role as string) ?? "";
    if (role && !byRole.has(role)) byRole.set(role, row.storage_path);
  }
  return byRole;
}

function byRoleFromStored(paths: ReportPhotoPath[]): Map<string, string> {
  const byRole = new Map<string, string>();
  for (const p of paths) {
    if (!byRole.has(p.role)) byRole.set(p.role, p.path);
  }
  return byRole;
}

export async function signPhotoPath(
  admin: AdminClient,
  path: string,
): Promise<string | null> {
  const { data } = await admin.storage.from("photos").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/**
 * Reference photos tied to a specific report — prefer the paths persisted at
 * submit time; fall back to photos uploaded around creation (legacy heuristic).
 */
export async function getReportReferencePhotos(
  admin: AdminClient,
  userId: string,
  reportCreatedAt: string,
  reportId?: string,
): Promise<ReportReferencePhotos> {
  let byRole = new Map<string, string>();

  if (reportId) {
    const stored = await getStoredReportPhotoPaths(admin, reportId);
    if (stored?.length) byRole = byRoleFromStored(stored);
  }

  if (!byRole.size) {
    const cutoff = new Date(
      new Date(reportCreatedAt).getTime() + REPORT_PHOTO_CUTOFF_MS,
    ).toISOString();

    const { data: photos } = await admin
      .from("photos")
      .select("storage_path, role, created_at")
      .eq("user_id", userId)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(40);

    byRole = byRoleMap(
      photos as { role: string | null; storage_path: string }[] | null,
    );
  }

  const fullPath = byRole.get("full");
  if (!fullPath) {
    const hasAny = byRole.size > 0;
    return {
      ok: false,
      code: "needs_full_photo",
      error: hasAny
        ? "Virtual try-on needs a full-length photo (head to toe). A front portrait alone is not enough."
        : "Upload a full-length photo (head to toe) to use virtual try-on.",
    };
  }

  const fullUrl = await signPhotoPath(admin, fullPath);
  if (!fullUrl) {
    return {
      ok: false,
      code: "no_photos",
      error: "Could not read your photo",
    };
  }

  const facePath = byRole.get("face");
  const faceUrl = facePath ? await signPhotoPath(admin, facePath) : null;

  const profilePath = byRole.get("profile");
  const profileUrl = profilePath ? await signPhotoPath(admin, profilePath) : null;

  return {
    ok: true,
    fullUrl,
    ...(faceUrl ? { faceUrl } : {}),
    ...(profileUrl ? { profileUrl } : {}),
  };
}

export type GroomingPhotoResult =
  | { ok: true; url: string }
  | { ok: false; error: string; code: "no_photos" };

/**
 * A single reference photo for HEAD / UPPER-BODY previews (hair, facial hair,
 * eyewear, accessories, headwear). Prefers the report's stored selection, then
 * contemporaneous uploads, then the user's latest photo.
 */
export async function getReportGroomingPhotoUrl(
  admin: AdminClient,
  userId: string,
  reportCreatedAt?: string,
  reportId?: string,
): Promise<GroomingPhotoResult> {
  const pickFromMap = (byRole: Map<string, string>, fallback?: string | null) =>
    byRole.get("face") ?? byRole.get("full") ?? fallback ?? null;

  let path: string | null = null;

  if (reportId) {
    const stored = await getStoredReportPhotoPaths(admin, reportId);
    if (stored?.length) {
      path = pickFromMap(byRoleFromStored(stored));
    }
  }

  if (!path && reportCreatedAt) {
    const cutoff = new Date(
      new Date(reportCreatedAt).getTime() + REPORT_PHOTO_CUTOFF_MS,
    ).toISOString();
    const { data: scoped } = await admin
      .from("photos")
      .select("storage_path, role, created_at")
      .eq("user_id", userId)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(40);
    const rows = scoped as
      | { role: string | null; storage_path: string }[]
      | null;
    path = pickFromMap(byRoleMap(rows), rows?.[0]?.storage_path);
  }

  // Fallback: no photos around the report's creation — use the latest upload.
  if (!path) {
    const { data: latest } = await admin
      .from("photos")
      .select("storage_path, role, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    const rows = latest as
      | { role: string | null; storage_path: string }[]
      | null;
    path = pickFromMap(byRoleMap(rows), rows?.[0]?.storage_path);
  }

  if (!path) {
    return {
      ok: false,
      code: "no_photos",
      error: "Upload a photo to generate previews on yourself.",
    };
  }

  const signedUrl = await signPhotoPath(admin, path);
  if (!signedUrl) {
    return { ok: false, code: "no_photos", error: "Could not read your photo." };
  }
  return { ok: true, url: signedUrl };
}

/** Pick the latest full-length photo — never fall back to a portrait. */
export async function getFullLengthPhotoUrl(
  admin: AdminClient,
  userId: string,
  opts?: { reportCreatedAt?: string; reportId?: string },
): Promise<FullPhotoResult> {
  if (opts?.reportCreatedAt) {
    const refs = await getReportReferencePhotos(
      admin,
      userId,
      opts.reportCreatedAt,
      opts.reportId,
    );
    if (!refs.ok) return refs;
    return { ok: true, signedUrl: refs.fullUrl };
  }

  const { data: photos } = await admin
    .from("photos")
    .select("storage_path, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const full = photos?.find((p) => p.role === "full");
  if (!full) {
    const hasAny = Boolean(photos?.length);
    return {
      ok: false,
      code: "needs_full_photo",
      error: hasAny
        ? "Virtual try-on needs a full-length photo (head to toe). A front portrait alone is not enough."
        : "Upload a full-length photo (head to toe) to use virtual try-on.",
    };
  }

  const path = full.storage_path as string;
  const { data: signed } = await admin.storage
    .from("photos")
    .createSignedUrl(path, 600);
  if (!signed?.signedUrl) {
    return {
      ok: false,
      code: "no_photos",
      error: "Could not read your photo",
    };
  }

  return { ok: true, signedUrl: signed.signedUrl, path };
}

/**
 * The user's pinned default full-length photo for catalogue try-on, if any.
 * Returns null when no default is set, the default row is missing, or the
 * default is somehow not a full-length photo (guards against stale flags).
 */
export async function getDefaultTryOnPhoto(
  admin: AdminClient,
  userId: string,
): Promise<{ ok: true; signedUrl: string; path: string } | null> {
  const { data: row } = await admin
    .from("photos")
    .select("storage_path, role")
    .eq("user_id", userId)
    .eq("is_default_tryon", true)
    .maybeSingle();

  if (!row || (row.role as string) !== "full") return null;

  const path = row.storage_path as string;
  const signedUrl = await signPhotoPath(admin, path);
  if (!signedUrl) return null;
  return { ok: true, signedUrl, path };
}

/**
 * Reference photo for catalogue try-on (no report context): the user's pinned
 * default full-length photo when set, otherwise their latest full-length upload.
 * `usedDefault` lets the caller nudge users who haven't picked a default yet.
 * `path` is the storage path so callers (Create-a-Look) can persist which photo
 * a set was rendered on for a later same-photo try-on.
 */
export async function getCatalogTryOnPhoto(
  admin: AdminClient,
  userId: string,
): Promise<
  | { ok: true; signedUrl: string; path: string; usedDefault: boolean }
  | { ok: false; error: string; code: "no_photos" | "needs_full_photo" }
> {
  const preferred = await getDefaultTryOnPhoto(admin, userId);
  if (preferred) {
    return {
      ok: true,
      signedUrl: preferred.signedUrl,
      path: preferred.path,
      usedDefault: true,
    };
  }

  const latest = await getFullLengthPhotoUrl(admin, userId);
  if (!latest.ok) return latest;
  if (!latest.path) {
    return {
      ok: false,
      code: "no_photos",
      error: "Could not read your photo",
    };
  }
  return {
    ok: true,
    signedUrl: latest.signedUrl,
    path: latest.path,
    usedDefault: false,
  };
}

/** Latest face portrait path for a user, if any — used to persist set identity anchors. */
export async function getLatestFacePhotoPath(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("photos")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("role", "face")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.storage_path as string | null) ?? null;
}

export function tryOnErrorCode(
  message: string,
): "body_pose_failed" | "needs_full_photo" | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("full-length") || lower.includes("head to toe")) {
    return "needs_full_photo";
  }
  if (lower.includes("body") || lower.includes("pose")) {
    return "body_pose_failed";
  }
  return undefined;
}
