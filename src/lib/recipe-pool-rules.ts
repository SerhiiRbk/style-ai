/**
 * Admission rules for one catalogue row into one capsule slot — the catalogue
 * layer's colour brain, pure and testable. `matchShoppingByRecipe` used to hold
 * these as an inline filter over Supabase rows; the invariant tests need to
 * push the same case through this layer, the avoid gates and the recipes.
 *
 * Every rejection names its rule, so a log or a test can say WHICH of the
 * thirty checks turned a row away.
 */
import type { CapsuleWardrobeSlot } from "@/lib/capsule-wardrobe";
import { hexToHsl } from "@/lib/colour-palette";
import {
  avoidPaletteVerdict,
  isDarkAnchorPiece,
  nearFaceVerdict,
  shoeColourOffLeather,
} from "@/lib/colour-rules";
import {
  CASUAL_DRESS_SHOE_RE,
  CASUAL_FOOTWEAR_RE,
  CASUAL_OUTERWEAR_RE,
  isBagTitle,
  isCasualDressShoeTitle,
  isCasualSummerShirtTitle,
  isDrawstringTitle,
  isJeanTitle,
  isLoaferTitle,
  isNearFaceShoppingCategory,
  isShortsTitle,
  isSportsBagTitle,
  isTailoredOvercoat,
  isUnreliableColorBlockKnit,
  silhouetteRejectsTop,
  silhouetteRejectsTrousers,
  SNEAKER_RE,
} from "@/lib/garment-title";

/**
 * Short-sleeve pieces mis-filed under "Knitwear" (e.g. a "Short Sleeve
 * Sweatshirt") read as a t-shirt when layered over a long-sleeve shirt — the
 * cuffs poke out awkwardly. A layering knit needs long sleeves, so the knit slot
 * drops these unless nothing else matches.
 */
export const SHORT_SLEEVE_KNIT_RE =
  /\b(short[- ]?sleeve|sleeveless|t-?shirts?|tees?|tank|vest\s*tops?)\b/i;

const DRESS_SHOE_SHAPE_RE = /\b(derb(?:y|ies)|oxfords?|brogues?|monk\s+straps?|cap-?toe|wholecuts?)\b/i;

/** One catalogue row, already titled and swatched by the caller. */
export type RecipePoolRow = {
  /** Brand + title as shown. */
  title: string;
  /** Title plus the feed's colour words — what the colour gates read. */
  hay: string;
  /** Trusted swatch hex (title colour word wins over a contradicting feed hex). */
  hex: string;
  materialFamily?: string | null;
  description?: string | null;
};

export type RecipePoolContext = {
  undertone: "warm" | "cool" | "neutral";
  /** The report's best palette: a row in one of its colours is never turned away by a near-face heuristic. */
  best: { hex: string }[];
  bodyType?: string | null;
  /** Outdoor / active brief: the casual trouser is a jean. */
  outdoorJeans: boolean;
  avoid: { name: string; hex?: string }[];
};

export type RecipePoolSlot = Pick<CapsuleWardrobeSlot, "role" | "category" | "color">;

const NEAR_BEST_MAX_HUE = 12;
const NEAR_BEST_MAX_DL = 0.12;
const NEAR_BEST_MAX_DS = 0.2;

/** Is this hex, near enough, one of the palette's own swatches? */
export function nearBestSwatch(hex: string | null | undefined, best: { hex: string }[]): boolean {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return false;
  const p = hexToHsl(hex);
  return best.some((b) => {
    if (!/^#?[0-9a-f]{6}$/i.test(b.hex)) return false;
    const q = hexToHsl(b.hex);
    const dh = Math.min(Math.abs(p.h - q.h), 360 - Math.abs(p.h - q.h));
    const chromaticPair = p.s >= 0.14 && q.s >= 0.14;
    return (
      (!chromaticPair || dh <= NEAR_BEST_MAX_HUE) &&
      Math.abs(p.l - q.l) <= NEAR_BEST_MAX_DL &&
      Math.abs(p.s - q.s) <= NEAR_BEST_MAX_DS
    );
  });
}

/**
 * Dress-shoe row whose construction reads casual: suede / nubuck uppers, crepe
 * or chunky soles, chukkas. `material_family` first, then the title and the
 * product copy ("thick sole") — the feed's `formality` flag called a
 * crepe-soled suede derby a 4.
 */
export function isCasualDressShoeRow(row: Pick<RecipePoolRow, "title" | "materialFamily" | "description">): boolean {
  if (row.materialFamily === "suede" || row.materialFamily === "nubuck") return true;
  if (isCasualDressShoeTitle(row.title)) return true;
  return CASUAL_DRESS_SHOE_RE.test(row.description ?? "");
}

/**
 * Why this row may not fill this slot — a rule id — or null when it may.
 * Order matters only for which reason is reported; every rule is a hard stop.
 */
export function recipePoolRejection(
  slot: RecipePoolSlot,
  row: RecipePoolRow,
  ctx: RecipePoolContext,
): string | null {
  const { role, category } = slot;
  const { title, hay, hex } = row;

  const avoid = avoidPaletteVerdict(hay, hex, ctx.avoid, { category, role });
  if (!avoid.ok) return `avoid-palette:${avoid.rule}`;
  // The near-face heuristics guard against catalogue colours the palette never
  // asked for (a "beige" that is saturated yellow). A colour the palette DOES
  // ask for — olive or mustard on a deep autumn — is not theirs to refuse.
  if (isNearFaceShoppingCategory(category) && !nearBestSwatch(hex, ctx.best)) {
    const face = nearFaceVerdict(hay, hex, { undertone: ctx.undertone, role });
    if (!face.ok) return `near-face:${face.rule}`;
  }
  if (category === "Knitwear") {
    if (isUnreliableColorBlockKnit(title)) return "knit-colour-block";
    if (SHORT_SLEEVE_KNIT_RE.test(title)) return "knit-short-sleeve";
  }
  if (category === "Shirts" && isCasualSummerShirtTitle(title)) return "shirt-casual-summer";
  if (role === "shirt" && /\b(polo|pale\s+green|light\s+green)\b/i.test(hay)) return "shirt-polo-or-pale-green";
  if (role === "darkTrouser") {
    if (isShortsTitle(title) || isDrawstringTitle(title)) return "dark-trouser-shorts-or-drawstring";
    if (!isDarkAnchorPiece(title, new Map([[title, hex]]))) return "dark-trouser-not-dark";
  }
  if (role === "casualTrouser") {
    if (isShortsTitle(title)) return "casual-trouser-shorts";
    if (ctx.outdoorJeans && !isJeanTitle(title)) return "casual-trouser-not-jeans";
    // White corduroys on a drawstring read as pyjamas in a capsule photo; a
    // drawstring waist belongs to an outdoor / active brief, not to a
    // public-speaking one.
    if (isDrawstringTitle(title) && !ctx.outdoorJeans) return "casual-trouser-drawstring";
  }
  // Capsule shoes and belts are leather colours: green oxfords for a brown slot
  // are as wrong as for a navy one; a spruce belt is no belt.
  if ((role === "dressShoe" || role === "loafer") && shoeColourOffLeather(hay, hex, slot.color.hex)) {
    return "shoe-colour-off-leather";
  }
  if (role === "belt" && shoeColourOffLeather(hay, hex, slot.color.hex)) return "belt-colour-off-leather";
  // The report's own body-type advice must not be contradicted by the list.
  if ((role === "darkTrouser" || role === "casualTrouser") && silhouetteRejectsTrousers(ctx.bodyType, title)) {
    return "silhouette-trousers";
  }
  if (
    (category === "Knitwear" || category === "Shirts" || category === "Outerwear") &&
    silhouetteRejectsTop(ctx.bodyType, title)
  ) {
    return "silhouette-top";
  }
  if (role === "bag" && isSportsBagTitle(title)) return "bag-sports";
  if (role === "jacket" && CASUAL_OUTERWEAR_RE.test(title)) return "jacket-casual-outerwear";
  if (role === "coat") {
    if (CASUAL_OUTERWEAR_RE.test(title)) return "coat-casual-outerwear";
    if (!isTailoredOvercoat(title)) return "coat-not-overcoat";
  }
  if (role === "casualOuter" && !CASUAL_OUTERWEAR_RE.test(title)) return "casual-outer-not-casual";
  if (role === "dressShoe") {
    if (CASUAL_FOOTWEAR_RE.test(title) || SNEAKER_RE.test(title) || isLoaferTitle(title)) {
      return "dress-shoe-casual-footwear";
    }
    if (isCasualDressShoeRow(row)) return "dress-shoe-casual-construction";
    if (!DRESS_SHOE_SHAPE_RE.test(title) || /\bshirt\b/i.test(title)) return "dress-shoe-not-dress-shape";
  }
  if (role === "loafer" && !/\bloafers?\b/i.test(title)) return "loafer-not-loafer";
  if (role === "sneaker" && !/\b(sneakers?|trainers?)\b/i.test(title)) return "sneaker-not-sneaker";
  if (role === "belt" && !/\bbelts?\b/i.test(title)) return "belt-not-belt";
  if (role === "bag" && !isBagTitle(title)) return "bag-not-bag";
  return null;
}
