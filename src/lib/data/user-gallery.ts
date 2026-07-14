import "server-only";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import type {
  GalleryItem,
  GalleryItemKind,
  GalleryReportGroup,
} from "@/lib/gallery-types";
import type {
  AccessoryRec,
  HeadwearRec,
  EyewearRec,
  FacialHairRec,
  HairRec,
  Tier,
} from "@/lib/report";

export type {
  GalleryItem,
  GalleryItemKind,
  GalleryReportGroup,
} from "@/lib/gallery-types";
export { GALLERY_KIND_LABEL } from "@/lib/gallery-types";

type GalleryRow = {
  id: string;
  created_at: string;
  headline: string | null;
  tier: Tier | null;
  cover_image: string | null;
  capsule_images: (string | null)[] | null;
  hair: { recommend?: HairRec[]; avoid?: HairRec[] } | null;
  facial_hair: FacialHairRec[] | null;
  eyewear: EyewearRec[] | null;
  accessories: AccessoryRec[] | null;
  headwear: HeadwearRec[] | null;
};

/**
 * Aggregate every *generated* image across the signed-in user's reports into a
 * flat, grouped gallery. Uploaded reference photos are intentionally excluded
 * (they're biometric/private and managed separately by the try-on picker).
 *
 * Reuses the existing signed asset proxy — no new storage or access surface.
 */
export async function getUserGallery(): Promise<GalleryReportGroup[] | null> {
  if (!hasSupabase) return null;

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const db = hasSupabaseAdmin ? createAdminSupabase() : sb;

  const { data, error } = await db
    .from("reports")
    .select(
      "id, created_at, headline, tier, cover_image, capsule_images, hair, facial_hair, eyewear, accessories, headwear",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as GalleryRow[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);

  const [{ data: looks }, { data: tryons }] = await Promise.all([
    db
      .from("looks")
      .select("report_id, image_path, title, created_at")
      .in("report_id", ids)
      .order("created_at", { ascending: true }),
    db
      .from("tryons")
      .select("report_id, image_path, created_at")
      .eq("user_id", user.id)
      .in("report_id", ids)
      .order("created_at", { ascending: true }),
  ]);

  const looksByReport = new Map<
    string,
    { image_path: string | null; title: string | null }[]
  >();
  for (const l of looks ?? []) {
    const rid = l.report_id as string;
    const arr = looksByReport.get(rid) ?? [];
    arr.push({
      image_path: (l.image_path as string | null) ?? null,
      title: (l.title as string | null) ?? null,
    });
    looksByReport.set(rid, arr);
  }

  const tryonsByReport = new Map<string, (string | null)[]>();
  for (const t of tryons ?? []) {
    const rid = t.report_id as string;
    const arr = tryonsByReport.get(rid) ?? [];
    arr.push((t.image_path as string | null) ?? null);
    tryonsByReport.set(rid, arr);
  }

  const groups: GalleryReportGroup[] = [];

  for (const row of rows) {
    const items: GalleryItem[] = [];
    const push = (
      kind: GalleryItemKind,
      index: number,
      path: string | null | undefined,
      label: string,
    ) => {
      if (!path) return;
      items.push({
        id: `${row.id}:${kind}:${index}`,
        kind,
        src: signedAssetProxyUrl(path),
        label,
      });
    };

    push("cover", 0, row.cover_image, "Cover");

    (looksByReport.get(row.id) ?? []).forEach((l, i) =>
      push("look", i, l.image_path, l.title || `Look ${i + 1}`),
    );

    (row.capsule_images ?? []).forEach((p, i) =>
      push("capsule", i, p, `Capsule ${i + 1}`),
    );

    (row.hair?.recommend ?? []).forEach((h, i) => {
      push("hair", i, h.imagePath, h.name || "Hair");
      push("hair", i + 1000, h.imagePathSide, `${h.name || "Hair"} (side)`);
    });

    (row.facial_hair ?? []).forEach((g, i) =>
      push("grooming", i, g.imagePath, g.name || "Grooming"),
    );
    (row.eyewear ?? []).forEach((g, i) =>
      push("eyewear", i, g.imagePath, g.name || "Eyewear"),
    );
    (row.accessories ?? []).forEach((g, i) =>
      push("accessories", i, g.imagePath, g.name || "Accessory"),
    );
    (row.headwear ?? []).forEach((g, i) =>
      push("headwear", i, g.imagePath, g.name || "Headwear"),
    );

    (tryonsByReport.get(row.id) ?? []).forEach((p, i) =>
      push("tryon", i, p, `Try-on ${i + 1}`),
    );

    if (items.length) {
      groups.push({
        id: row.id,
        headline: row.headline ?? null,
        tier: row.tier ?? "basic",
        createdAt: row.created_at,
        items,
      });
    }
  }

  return groups;
}
