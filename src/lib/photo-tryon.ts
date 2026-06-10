import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

export type FullPhotoResult =
  | { ok: true; signedUrl: string }
  | {
      ok: false;
      error: string;
      code: "no_photos" | "needs_full_photo";
    };

/** Pick the latest full-length photo — never fall back to a portrait. */
export async function getFullLengthPhotoUrl(
  admin: AdminClient,
  userId: string,
): Promise<FullPhotoResult> {
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
