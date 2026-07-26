import "server-only";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { canShareReport } from "@/lib/report";
import type {
  GalleryItem,
  GalleryItemKind,
  GalleryReportGroup,
  GalleryTryonGarment,
} from "@/lib/gallery-types";
import type {
  AccessoryRec,
  HeadwearRec,
  EyewearRec,
  FacialHairRec,
  HairRec,
  Tier,
} from "@/lib/report";
import type { TryOnOpinion } from "@/lib/ai/tryon-opinion";

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
  is_public: boolean | null;
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
      "id, created_at, headline, tier, is_public, cover_image, capsule_images, hair, facial_hair, eyewear, accessories, headwear",
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
      const tier = row.tier ?? "basic";
      groups.push({
        id: row.id,
        headline: row.headline ?? null,
        tier,
        createdAt: row.created_at,
        canShare: Boolean(row.is_public) && canShareReport(tier),
        href: `/report/${row.id}`,
        linkLabel: "Open report",
        items,
      });
    }
  }

  // Try-ons not tied to any report (report_id is null) — surface them as their
  // own groups so they aren't lost. Split by `origin`: renders started from
  // Shop a Look get a dedicated group; everything else is a catalogue try-on.
  let standaloneTryons: {
    id: string;
    image_path: string | null;
    created_at: string;
    garments: unknown;
    origin?: string | null;
    opinion?: TryOnOpinion | null;
  }[] = [];
  {
    const withOrigin = await db
      .from("tryons")
      .select("id, image_path, created_at, garments, origin, opinion")
      .eq("user_id", user.id)
      .is("report_id", null)
      .order("created_at", { ascending: false });
    if (withOrigin.error) {
      // Pre-migration DB without tryons.origin / opinion — fall back and treat
      // all as catalogue try-ons so the gallery still renders.
      const noOrigin = await db
        .from("tryons")
        .select("id, image_path, created_at, garments")
        .eq("user_id", user.id)
        .is("report_id", null)
        .order("created_at", { ascending: false });
      standaloneTryons = (noOrigin.data ?? []) as typeof standaloneTryons;
    } else {
      standaloneTryons = (withOrigin.data ?? []) as typeof standaloneTryons;
    }
  }

  // Resolve current retailer links for the pieces used across standalone
  // try-ons, so the "shop these" links in the verdict modal stay live. Pieces
  // whose catalogue row was since removed simply have no link.
  const garmentProductIds = new Set<string>();
  for (const t of standaloneTryons) {
    const gs = Array.isArray(t.garments) ? t.garments : [];
    for (const g of gs) {
      const pid = (g as { productId?: unknown }).productId;
      if (typeof pid === "string" && pid) garmentProductIds.add(pid);
    }
  }
  const deeplinkByProduct = new Map<string, string>();
  if (garmentProductIds.size) {
    const { data: prods } = await db
      .from("products")
      .select("id, deeplink")
      .in("id", [...garmentProductIds]);
    for (const p of prods ?? []) {
      if (p.deeplink) deeplinkByProduct.set(p.id as string, p.deeplink as string);
    }
  }

  const parseGarments = (raw: unknown): GalleryTryonGarment[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((g) => {
      const rec = (g ?? {}) as Record<string, unknown>;
      const pid = typeof rec.productId === "string" ? rec.productId : null;
      return {
        title: typeof rec.title === "string" ? rec.title : "Item",
        category: typeof rec.category === "string" ? rec.category : "",
        imageUrl: typeof rec.imageUrl === "string" ? rec.imageUrl : null,
        deeplink: pid ? (deeplinkByProduct.get(pid) ?? null) : null,
      };
    });
  };

  const shopALookItems: GalleryItem[] = [];
  const catalogItems: GalleryItem[] = [];
  (standaloneTryons ?? []).forEach((t) => {
    const path = (t.image_path as string | null) ?? null;
    if (!path) return;
    // Report look/capsule try-ons (`/tryon/look-{reportId}-...`) are also stored
    // with a null report_id; they belong to a report, not a standalone group,
    // and some are orphaned (object deleted). Keep only genuine standalone ones.
    if (path.includes("/tryon/look-")) return;
    const isShopALook = (t.origin as string | null) === "shop_a_look";
    const bucket = isShopALook ? shopALookItems : catalogItems;
    const garments = parseGarments(t.garments);
    const label = garments[0]?.title || `Try-on ${bucket.length + 1}`;
    bucket.push({
      id: `${isShopALook ? "shop-a-look" : "catalog"}:tryon:${bucket.length}`,
      kind: "tryon",
      src: signedAssetProxyUrl(path),
      label,
      tryonId: t.id as string,
      opinion: (t.opinion as TryOnOpinion | null) ?? null,
      garments,
    });
  });

  if (shopALookItems.length) {
    const firstShopALook = (standaloneTryons ?? []).find(
      (t) => (t.origin as string | null) === "shop_a_look" && t.image_path,
    );
    groups.push({
      id: "shop-a-look",
      headline: "Shop a Look",
      tier: null,
      createdAt:
        (firstShopALook?.created_at as string | undefined) ??
        new Date(0).toISOString(),
      canShare: false,
      href: "/shop-a-look",
      linkLabel: "Open Shop a Look",
      items: shopALookItems,
    });
  }

  if (catalogItems.length) {
    const firstCatalog = (standaloneTryons ?? []).find(
      (t) => (t.origin as string | null) !== "shop_a_look" && t.image_path,
    );
    groups.push({
      id: "catalog",
      headline: "Catalogue try-ons",
      tier: null,
      createdAt:
        (firstCatalog?.created_at as string | undefined) ??
        new Date(0).toISOString(),
      canShare: false,
      href: "/catalog",
      linkLabel: "Open catalog",
      items: catalogItems,
    });
  }

  // Newest first across reports and the catalogue group.
  groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return groups;
}
