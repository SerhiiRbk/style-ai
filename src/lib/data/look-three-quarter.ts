import "server-only";
import { generateLookImage } from "@/lib/ai/pipeline";
import type { StyleProfile } from "@/lib/style-profile";
import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

export async function signAssetPath(
  admin: AdminClient,
  path: string,
): Promise<string | null> {
  const { data } = await admin.storage.from("assets").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Render a 3/4 companion locked to the current front look image. */
export async function renderAndStoreThreeQuarterLook(opts: {
  admin: AdminClient;
  userId: string;
  setId: string;
  lookIndex: number;
  profile: StyleProfile;
  look: { title: string; description: string; palette: string[] };
  faceRefUrl?: string | null;
  fullRefUrl?: string | null;
  frontImagePath: string;
}): Promise<string | null> {
  const {
    admin,
    userId,
    setId,
    lookIndex,
    profile,
    look,
    faceRefUrl,
    fullRefUrl,
    frontImagePath,
  } = opts;

  const outfitUrl = await signAssetPath(admin, frontImagePath);
  if (!outfitUrl) {
    console.error("[look-set] could not sign front look for 3/4", setId, lookIndex);
    return null;
  }

  const img = await generateLookImage({
    profile,
    look,
    referenceImageUrl: fullRefUrl ?? undefined,
    faceReferenceImageUrl: faceRefUrl ?? undefined,
    outfitReferenceImageUrl: outfitUrl,
    view: "three_quarter",
  });
  if (!img) return null;

  const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
  const stamp = Date.now().toString(36);
  const imagePath = `${userId}/looksets/${setId}/${lookIndex}-tq${stamp}.${ext}`;
  const { error } = await admin.storage.from("assets").upload(imagePath, img.bytes, {
    contentType: img.mediaType,
    upsert: true,
  });
  if (error) {
    console.error("[look-set] store 3/4 failed", setId, lookIndex, error.message);
    return null;
  }
  return imagePath;
}

export function cacheBustAssetUrl(signed: string): string {
  return `${signed}${signed.includes("?") ? "&" : "?"}v=${Date.now()}`;
}
