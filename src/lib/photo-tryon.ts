import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

export type FullPhotoResult =
  | { ok: true; signedUrl: string }
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
 * Reference photos tied to a specific report — photos uploaded at submission time,
 * not the user's latest upload (which may belong to a different session/person).
 */
export async function getReportReferencePhotos(
  admin: AdminClient,
  userId: string,
  reportCreatedAt: string,
): Promise<ReportReferencePhotos> {
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

  const byRole = new Map<string, string>();
  for (const row of photos ?? []) {
    const role = row.role as string;
    if (!byRole.has(role)) byRole.set(role, row.storage_path as string);
  }

  const fullPath = byRole.get("full");
  if (!fullPath) {
    const hasAny = Boolean(photos?.length);
    return {
      ok: false,
      code: "needs_full_photo",
      error: hasAny
        ? "Virtual try-on needs a full-length photo (head to toe). A front portrait alone is not enough."
        : "Upload a full-length photo (head to toe) to use virtual try-on.",
    };
  }

  const sign = async (path: string) => {
    const { data } = await admin.storage
      .from("photos")
      .createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  };

  const fullUrl = await sign(fullPath);
  if (!fullUrl) {
    return {
      ok: false,
      code: "no_photos",
      error: "Could not read your photo",
    };
  }

  const facePath = byRole.get("face");
  const faceUrl = facePath ? await sign(facePath) : null;

  const profilePath = byRole.get("profile");
  const profileUrl = profilePath ? await sign(profilePath) : null;

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
 * eyewear, accessories, headwear). Unlike virtual try-on these don't need a
 * full-length shot, so prefer a face portrait, then a full-length, then any
 * photo. Prefers photos uploaded around the report's creation, but falls back to
 * the user's latest upload when the report has no contemporaneous photos (e.g.
 * old reports whose original photos were later replaced) so generation still
 * works instead of failing silently.
 */
export async function getReportGroomingPhotoUrl(
  admin: AdminClient,
  userId: string,
  reportCreatedAt?: string,
): Promise<GroomingPhotoResult> {
  const pickPath = (
    rows: { role: string | null; storage_path: string }[] | null | undefined,
  ): string | null => {
    const byRole = new Map<string, string>();
    for (const row of rows ?? []) {
      const role = (row.role as string) ?? "";
      if (!byRole.has(role)) byRole.set(role, row.storage_path);
    }
    return byRole.get("face") ?? byRole.get("full") ?? rows?.[0]?.storage_path ?? null;
  };

  let path: string | null = null;

  if (reportCreatedAt) {
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
    path = pickPath(scoped as { role: string | null; storage_path: string }[]);
  }

  // Fallback: no photos around the report's creation — use the latest upload.
  if (!path) {
    const { data: latest } = await admin
      .from("photos")
      .select("storage_path, role, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    path = pickPath(latest as { role: string | null; storage_path: string }[]);
  }

  if (!path) {
    return {
      ok: false,
      code: "no_photos",
      error: "Upload a photo to generate previews on yourself.",
    };
  }

  const { data } = await admin.storage.from("photos").createSignedUrl(path, 600);
  if (!data?.signedUrl) {
    return { ok: false, code: "no_photos", error: "Could not read your photo." };
  }
  return { ok: true, url: data.signedUrl };
}

/** Pick the latest full-length photo — never fall back to a portrait. */
export async function getFullLengthPhotoUrl(
  admin: AdminClient,
  userId: string,
  opts?: { reportCreatedAt?: string },
): Promise<FullPhotoResult> {
  if (opts?.reportCreatedAt) {
    const refs = await getReportReferencePhotos(
      admin,
      userId,
      opts.reportCreatedAt,
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

  const { data: signed } = await admin.storage
    .from("photos")
    .createSignedUrl(full.storage_path, 600);
  if (!signed?.signedUrl) {
    return {
      ok: false,
      code: "no_photos",
      error: "Could not read your photo",
    };
  }

  return { ok: true, signedUrl: signed.signedUrl };
}

/**
 * The user's pinned default full-length photo for catalogue try-on, if any.
 * Returns null when no default is set, the default row is missing, or the
 * default is somehow not a full-length photo (guards against stale flags).
 */
export async function getDefaultTryOnPhoto(
  admin: AdminClient,
  userId: string,
): Promise<{ ok: true; signedUrl: string } | null> {
  const { data: row } = await admin
    .from("photos")
    .select("storage_path, role")
    .eq("user_id", userId)
    .eq("is_default_tryon", true)
    .maybeSingle();

  if (!row || (row.role as string) !== "full") return null;

  const { data } = await admin.storage
    .from("photos")
    .createSignedUrl(row.storage_path as string, 600);
  if (!data?.signedUrl) return null;
  return { ok: true, signedUrl: data.signedUrl };
}

/**
 * Reference photo for catalogue try-on (no report context): the user's pinned
 * default full-length photo when set, otherwise their latest full-length upload.
 * `usedDefault` lets the caller nudge users who haven't picked a default yet.
 */
export async function getCatalogTryOnPhoto(
  admin: AdminClient,
  userId: string,
): Promise<
  | { ok: true; signedUrl: string; usedDefault: boolean }
  | { ok: false; error: string; code: "no_photos" | "needs_full_photo" }
> {
  const preferred = await getDefaultTryOnPhoto(admin, userId);
  if (preferred) return { ok: true, signedUrl: preferred.signedUrl, usedDefault: true };

  const latest = await getFullLengthPhotoUrl(admin, userId);
  if (!latest.ok) return latest;
  return { ok: true, signedUrl: latest.signedUrl, usedDefault: false };
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
