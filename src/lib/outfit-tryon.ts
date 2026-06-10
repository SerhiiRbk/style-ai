/** One catalogue piece recorded on a saved try-on render. */
export type SavedTryOnGarment = {
  productId: string;
  title: string;
  category: string;
  imageUrl?: string | null;
};

/** A try-on image saved on a report (single piece or combined outfit). */
export type SavedOutfitTryOn = {
  id: string;
  image: string;
  createdAt: string;
  kind: "outfit" | "product";
  garments: SavedTryOnGarment[];
};

export function parseGarmentsJson(raw: unknown): SavedTryOnGarment[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedTryOnGarment[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const g = row as Record<string, unknown>;
    const productId = typeof g.productId === "string" ? g.productId : "";
    const title = typeof g.title === "string" ? g.title : "Item";
    const category = typeof g.category === "string" ? g.category : "Clothing";
    if (!productId) continue;
    out.push({
      productId,
      title,
      category,
      imageUrl:
        typeof g.imageUrl === "string" && g.imageUrl ? g.imageUrl : undefined,
    });
  }
  return out;
}
