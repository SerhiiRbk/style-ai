import type { ShoppingItem } from "@/lib/report";
import { HOUSEHOLD_TEXTILE_RE } from "@/lib/style-extras";
import { hasJacketHost } from "@/lib/ai/look-brief";

export type LookTryOnKind = "look" | "capsule";

/** A neck accessory that cannot be worn without a shirt (tie / necktie / bow tie). */
export function isTieTitle(title: string): boolean {
  return /\b(?:bow\s+)?(?:neck)?ties?\b|\bbolo\b/i.test(title);
}

/** Sunglasses or optical glasses — must sit on the face, not in a hand/pocket. */
export function isEyewearTitle(title: string): boolean {
  return /\b(?:sun)?glasses\b|\beyeglasses\b|\bspectacles\b|\beyewear\b|\bgoggles?\b/i.test(
    title,
  );
}

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

/**
 * Max catalogue product images fed to the image model as garment references.
 * Sized for a full shop-the-look row (shirt + bottoms + shoes + 2–3 extras)
 * so a 5-item list is not silently truncated to 4.
 */
export const MAX_CATALOG_REFERENCE_IMAGES = 6;
/**
 * Editorial try-on also attaches the person's portrait. More than a few
 * on-model product shots and the image model blends those faces over the
 * customer. Keep shirt / bottoms / shoes as photos; accessories stay text.
 */
export const MAX_CATALOG_REFERENCE_IMAGES_WITH_PORTRAIT = 3;

export type CatalogImageRef = {
  url: string;
  title: string;
  category: string;
};

const HEX_COLOR_RE = /^#?[0-9a-f]{6}$/i;

/** Named colour for the image prompt — never a raw swatch hex. */
function promptColourLabel(item: ShoppingItem): string {
  const named = item.colorName?.trim();
  if (named && !HEX_COLOR_RE.test(named)) return `${named} `;
  const c = item.color?.trim() ?? "";
  if (!c || c === "#CCCCCC" || HEX_COLOR_RE.test(c)) return "";
  return `${c} `;
}

/** Lower is kept first when the image-ref budget is exceeded. */
function catalogRefPriority(item: ShoppingItem): number {
  if (item.category === "Shirts") return 0;
  if (item.category === "Knitwear") return 1;
  if (item.category === "Outerwear") return 2;
  if (item.category === "Trousers") return 3;
  if (item.category === "Footwear") return 4;
  if (item.category === "Accessories") {
    if (isTieTitle(item.title) || isEyewearTitle(item.title)) return 5;
    return 6;
  }
  return 5;
}

type ShoppingItemWithImage = ShoppingItem & { image: string };

function itemsWithCatalogImages(items: ShoppingItem[]): ShoppingItemWithImage[] {
  return items.filter(
    (i): i is ShoppingItemWithImage =>
      Boolean(i.image && /^https?:\/\//i.test(i.image)) &&
      !HOUSEHOLD_TEXTILE_RE.test(i.title),
  );
}

/** Keep list order, drop lowest-priority extras once the image budget is full. */
function pickCatalogImageItems(
  items: ShoppingItemWithImage[],
  max: number,
): ShoppingItemWithImage[] {
  if (items.length <= max) return items;
  const keep = new Set(
    items
      .map((item, index) => ({ item, index, rank: catalogRefPriority(item) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, max)
      .map((r) => r.item),
  );
  return items.filter((i) => keep.has(i));
}

/**
 * Prompt fragment from “Shop a look like this” catalogue picks. Written to
 * DOMINATE the image prompt: each garment is listed as an explicit "wearing"
 * instruction so the model dresses the person in these exact pieces rather than
 * re-rendering the look's free-text description.
 */
export function catalogPromptFromItems(
  items: ShoppingItem[],
  lookDescription?: string,
): string | undefined {
  items = items.filter((i) => !HOUSEHOLD_TEXTILE_RE.test(i.title));
  const jacketHost =
    hasJacketHost(lookDescription ?? "") ||
    items.some((i) => i.category === "Outerwear");
  items = items.filter((i) => {
    if (
      i.category === "Accessories" &&
      /\b(pocket[\s-]?squares?|pochettes?|handkerchiefs?)\b/i.test(i.title)
    ) {
      return jacketHost;
    }
    return true;
  });
  if (!items.length) return undefined;
  const lines = items.map((i) => {
    const colour = promptColourLabel(i);
    const note = i.similarPick
      ? " (match the garment type and tone closely)"
      : "";
    if (i.category === "Accessories" && isEyewearTitle(i.title)) {
      return `- wearing on the face over the eyes (never held, never in a pocket): ${colour}${i.title}${note}`;
    }
    if (
      i.category === "Accessories" &&
      /\b(pocket[\s-]?squares?|pochettes?)\b/i.test(i.title)
    ) {
      return `- folded in the jacket breast pocket (never a trouser pocket): ${colour}${i.title}${note}`;
    }
    return `- wearing a ${colour}${i.category.toLowerCase()}: ${i.title}${note}`;
  });

  // A tie with no shirt in the list forces the model to invent a base layer; it
  // otherwise defaults to a white/pale shirt, which under a light tie reads as
  // washed out (no near-face contrast). Direct the fabricated shirt to a
  // mid-tone that contrasts with the tie. (When the caller already re-adds the
  // look's shirt — see tryon/look route — this branch simply never fires.)
  const hasTie = items.some(
    (i) => i.category === "Accessories" && isTieTitle(i.title),
  );
  const hasEyewear = items.some(
    (i) => i.category === "Accessories" && isEyewearTitle(i.title),
  );
  const hasShirt = items.some((i) => i.category === "Shirts");
  const hasTrousers = items.some((i) => i.category === "Trousers");
  const describedShirt = lookDescription
    ? lookDescription.match(
        /([^,]*\b(?:camp-?collar\s+)?(?:linen\s+)?(?:oxford|shirt|polo|tee|henley)\b[^,]*)/i,
      )?.[1]?.trim()
    : "";
  const describedTrousers = lookDescription
    ? lookDescription.match(
        /([^,]*\b(?:trousers?|chinos?|pants?|slacks?|shorts?)\b[^,]*)/i,
      )?.[1]?.trim()
    : "";
  const lookNamedFullTrousers = Boolean(
    describedTrousers &&
      /\b(?:trousers?|chinos?|pants?|slacks?)\b/i.test(describedTrousers) &&
      !/\bshorts?\b/i.test(describedTrousers),
  );
  const baseLayerRule =
    hasTie && !hasShirt
      ? describedShirt
        ? `\nThis list has a tie but no shirt — wear this shirt from the look: ` +
          `${describedShirt}. Do not invent a different shirt colour. `
        : `\nThis list has a tie but no shirt — add the one shirt the tie needs as ` +
          `the base layer, in a mid-tone colour that clearly contrasts with the ` +
          `tie. NEVER a white or pale shirt under a light, beige or greige tie ` +
          `(a light tie on a light shirt looks washed out). A mid or deep blue ` +
          `shirt is a safe default. `
      : !hasShirt && describedShirt
        ? `\nThis catalogue list is missing the shirt. Wear the look's own shirt: ` +
          `${describedShirt}. Do not invent a different shirt colour. `
        : "";
  const eyewearRule = hasEyewear
    ? `\nSunglasses or glasses from this list are already on the person's face, ` +
      `resting on the nose over the eyes. Do not hold them, fold them, put them ` +
      `in a pocket, or hang them from a shirt. `
    : "";
  const bottomsRule = !hasTrousers && describedTrousers
    ? `\nThis catalogue list is missing the trousers. Wear the look's own bottoms: ` +
      `${describedTrousers}. ` +
      (lookNamedFullTrousers
        ? `Full-length trousers only — never shorts, never cropped, never invent a different silhouette. `
        : "")
    : lookNamedFullTrousers
      ? `\nBottoms stay full-length as named in the look — never substitute shorts. `
      : "";

  return (
    `Construct the outfit from these catalogue garments:\n` +
    lines.join("\n") +
    `\nWear EVERY listed garment — do not drop the shirt, top, trousers or shoes ` +
    `to make room for an accessory. ` +
    `Reproduce each listed garment's type, colour and material faithfully. ` +
    `Colours and materials come only from these catalogue titles and photos. ` +
    `Do not add extra accessories that are not in this list. ` +
    `Wear the catalogue pieces above — do not substitute a different shirt, ` +
    `trouser, shoe or bag named only in a styling note, and do not swap the ` +
    `shirt colour or shoe finish for one named only in a look caption. ` +
    `Trouser pockets stay empty and lie flat — no cloth peeking out. ` +
    baseLayerRule +
    bottomsRule +
    eyewearRule
  );
}

/** Catalogue product photos to feed the image model, labelled for the prompt. */
export function catalogImageRefsFromItems(
  items: ShoppingItem[],
  opts?: { max?: number },
): CatalogImageRef[] {
  const selected = pickCatalogImageItems(
    itemsWithCatalogImages(items),
    opts?.max ?? MAX_CATALOG_REFERENCE_IMAGES,
  );
  return selected.map((i) => ({
    url: i.image,
    title: i.title,
    category: i.category,
  }));
}

/** Public product image URLs to feed the image model as garment references. */
export function catalogImageUrlsFromItems(items: ShoppingItem[]): string[] {
  return catalogImageRefsFromItems(items).map((r) => r.url);
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
