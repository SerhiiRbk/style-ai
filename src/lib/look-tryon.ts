import type { ShoppingItem } from "@/lib/report";

export type LookTryOnKind = "look" | "capsule";

/** Stable storage / cache key for a report look or capsule combo. */
export function formatLookKey(opts: {
  kind?: LookTryOnKind;
  lookIndex?: number;
  title?: string;
}): string {
  const kind = opts.kind ?? "look";
  if (typeof opts.lookIndex === "number") {
    return `${kind}-${opts.lookIndex}`;
  }
  const slug = (opts.title ?? "look")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${kind}-${slug || "0"}`;
}

export function tryonStoragePath(
  userId: string,
  reportId: string,
  lookKey: string,
  ext: "png" | "jpg",
): string {
  return `${userId}/tryon/look-${reportId}-${lookKey}.${ext}`;
}

/** Max catalogue product images fed to the image model as garment references. */
export const MAX_CATALOG_REFERENCE_IMAGES = 4;

/**
 * Prompt fragment from “Shop a look like this” catalogue picks. Written to
 * DOMINATE the image prompt: each garment is listed as an explicit "wearing"
 * instruction so the model dresses the person in these exact pieces rather than
 * re-rendering the look's free-text description.
 */
export function catalogPromptFromItems(items: ShoppingItem[]): string | undefined {
  if (!items.length) return undefined;
  const lines = items.map((i) => {
    const colour = i.color && i.color !== "#CCCCCC" ? `${i.color} ` : "";
    const note = i.similarPick
      ? " (match the garment type and tone closely)"
      : "";
    return `- wearing a ${colour}${i.category.toLowerCase()}: ${i.title}${note}`;
  });
  return (
    `Construct the entire outfit from these exact catalogue garments and nothing else:\n` +
    lines.join("\n") +
    `\nEvery piece worn by the person must come from this list — reproduce each ` +
    `garment's type, colour and material faithfully. `
  );
}

/** Public product image URLs to feed the image model as garment references. */
export function catalogImageUrlsFromItems(items: ShoppingItem[]): string[] {
  const urls: string[] = [];
  for (const i of items) {
    if (i.image && /^https?:\/\//i.test(i.image)) urls.push(i.image);
    if (urls.length >= MAX_CATALOG_REFERENCE_IMAGES) break;
  }
  return urls;
}

export function resolveLookCatalogItems(
  lookItems: Record<number, ShoppingItem[]> | null | undefined,
  lookIndex: number | undefined,
): ShoppingItem[] {
  if (typeof lookIndex !== "number" || !lookItems) return [];
  return lookItems[lookIndex] ?? [];
}

/** Match capsule combo piece labels back to shopping-list catalogue rows. */
export function resolveCapsuleCatalogItems(
  pieces: string[],
  shopping: ShoppingItem[],
): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();
  for (const piece of pieces) {
    const key = piece.trim();
    if (!key) continue;
    const match =
      shopping.find((s) => s.title === key) ??
      shopping.find(
        (s) =>
          key.toLowerCase().includes(s.title.toLowerCase()) ||
          s.title.toLowerCase().includes(key.toLowerCase()),
      );
    if (!match) continue;
    const id = match.productId ?? match.title;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(match);
  }
  return items;
}

/** Hex palette from shopping-list colours for capsule piece titles. */
export function paletteFromCapsulePieces(
  pieces: string[],
  shopping: ShoppingItem[],
): string[] {
  const colorByTitle = new Map(shopping.map((s) => [s.title, s.color]));
  return pieces
    .map((p) => colorByTitle.get(p))
    .filter((c): c is string => Boolean(c && c !== "#CCCCCC"));
}
