import {
  hexToHsl,
  hueDist,
  lightingForTrust,
  palettePersonWithTrust,
  reportPalette,
  type ColorRec,
} from "@/lib/colour-palette";
import {
  classifySubseason,
  type Boldness,
  type StyleProfile,
} from "./style-profile";
import { workDefaultShirtColor } from "./look-occasion-fit";
import { isAccentForPalette, paletteRoleForHex, swatchRole, type SwatchRole } from "@/lib/palette-roles";
import {
  isOvercoatSafeName,
  isPinkFamilyName,
  isTailoredJacketSafeName,
  shoeColourOffLeather,
} from "@/lib/colour-rules";
export { isAccentForPalette, paletteRoleForHex, type SwatchRole };

export type LookColorRecipeMood = {
  boldness?: Boldness;
  /** Set-level occasion (Create-a-Look: one occasion for the whole set). */
  occasionId?: string;
  /** Per-look occasions, index-aligned with the recipes (Style Report plan). */
  occasionIds?: (string | null | undefined)[];
};

/** Contexts where a clean light leather sneaker under dark chinos is the classic, not a fault. */
const SNEAKER_OCCASION_RE = /^(weekend|travel|outdoor|resort)$/i;

export function isSneakerOccasion(occasionId?: string | null): boolean {
  return SNEAKER_OCCASION_RE.test(occasionId ?? "");
}

export type LookValueScheme = "light-over-deep" | "deep-over-light";

export type LookColorRecipe = {
  hero: ColorRec;
  bottom: ColorRec;
  neutrals: [ColorRec, ColorRec];
  accent: ColorRec | null;
  scheme: LookValueScheme;
  /** Per-look shoe colour — rotated so a 3-look set is not three warm-grey loafers. */
  shoe: ColorRec;
  /** Belt leather — follows the shoe (one leather story), never a chromatic swatch. */
  belt: ColorRec;
};





/** Spread chromatics around the hue wheel (max min-distance greedy). */
function spreadHeroes(heroes: ColorRec[]): ColorRec[] {
  if (heroes.length <= 1) return [...heroes];
  const scored = heroes.map((c) => ({ c, hsl: hexToHsl(c.hex) }));
  scored.sort((a, b) => b.hsl.s - a.hsl.s || a.hsl.l - b.hsl.l);
  const ordered: typeof scored = [scored[0]!];
  const rest = scored.slice(1);
  while (rest.length) {
    let bestI = 0;
    let bestMin = -1;
    for (let i = 0; i < rest.length; i++) {
      const minD = Math.min(
        ...ordered.map((o) => hueDist(o.hsl.h, rest[i]!.hsl.h)),
      );
      if (minD > bestMin) {
        bestMin = minD;
        bestI = i;
      }
    }
    ordered.push(rest.splice(bestI, 1)[0]!);
  }
  return ordered.map((x) => x.c);
}

function classify(best: ColorRec[]) {
  const heroes: ColorRec[] = [];
  const anchors: ColorRec[] = [];
  const lights: ColorRec[] = [];
  const mids: ColorRec[] = [];
  for (const sw of best) {
    if (!sw.hex) continue;
    const role = swatchRole(sw);
    if (role === "hero") heroes.push(sw);
    else if (role === "anchor") anchors.push(sw);
    else if (role === "light") lights.push(sw);
    else mids.push(sw);
  }
  return { heroes, anchors, lights, mids };
}

function pickShared(
  lights: ColorRec[],
  mids: ColorRec[],
  anchors: ColorRec[],
  heroes: ColorRec[],
): [ColorRec, ColorRec] {
  const light = lights[0] ?? mids[0] ?? heroes[0] ?? anchors[0];
  const mid =
    mids[0] ??
    lights[1] ??
    lights[0] ??
    anchors[0] ??
    heroes[1] ??
    heroes[0] ??
    light;
  if (!light || !mid) {
    const fallback = heroes[0] ?? anchors[0];
    if (!fallback) {
      throw new Error("lookSetColorRecipes: BEST palette is empty");
    }
    return [fallback, fallback];
  }
  return [light, mid];
}

function shoeClonesHero(shoe: ColorRec, hero: ColorRec): boolean {
  const s = hexToHsl(shoe.hex);
  const h = hexToHsl(hero.hex);
  if (h.l <= 0.36 && s.l <= 0.36) return false;
  if (h.s < 0.12 && s.s < 0.12) return false;
  return hueDist(h.h, s.h) < 30 && Math.abs(h.l - s.l) < 0.28;
}

function chromaticClone(a: ColorRec, b: ColorRec): boolean {
  const ha = hexToHsl(a.hex);
  const hb = hexToHsl(b.hex);
  if (ha.s < 0.14 || hb.s < 0.14) return false;
  if (ha.l <= 0.32 && hb.l <= 0.32) return false;
  // A dark anchor (chocolate, espresso) is a neutral, not a paler mustard:
  // it pairs with any hero of its own hue family.
  if (isDarkAnchorSwatch(a) || isDarkAnchorSwatch(b)) return false;
  return hueDist(ha.h, hb.h) < 30 && Math.abs(ha.l - hb.l) < 0.32;
}

/** A trouser colour appears on at most this many looks of one set. */
export const MAX_SAME_BOTTOM_PER_SET = 2;

/** Minimum lightness step between hero and bottom for "one clear light/dark step". */
export const BOTTOM_CONTRAST_MIN_DL = 0.2;
/** Or two clearly different colour families, both with real chroma and some value step. */
const BOTTOM_CONTRAST_MIN_HUE = 70;
const BOTTOM_CONTRAST_FAMILY_MIN_S = 0.2;
const BOTTOM_CONTRAST_FAMILY_MIN_DL = 0.1;
/** Or a chromatic piece against a true neutral (teal knit, charcoal trousers). */
const BOTTOM_CONTRAST_NEUTRAL_MAX_S = 0.12;
const BOTTOM_CONTRAST_CHROMA_MIN_S = 0.16;
const BOTTOM_CONTRAST_NEUTRAL_MIN_DL = 0.12;

/**
 * Does the bottom read as a different piece from the hero? A slate-blue knit
 * over sage chinos (ΔL 0.12, neighbouring muted hues) blurs into one tonal
 * column — the "sage-on-sage" look. Pass when there is a real value step, a
 * deliberate dark-on-dark column (navy over charcoal is a classic, not a
 * blur), a chromatic piece against a true neutral, or two distinct chromatic
 * families. Muted greige-family "colours" like sage or mushroom are neither
 * neutral enough nor chromatic enough to carry a pairing on their own.
 */
export function bottomContrastsHero(hero: ColorRec, bottom: ColorRec): boolean {
  const h = hexToHsl(hero.hex);
  const b = hexToHsl(bottom.hex);
  const dl = Math.abs(h.l - b.l);
  if (dl >= BOTTOM_CONTRAST_MIN_DL) return true;
  if (h.l <= 0.36 && b.l <= 0.36) return true;
  const minS = Math.min(h.s, b.s);
  const maxS = Math.max(h.s, b.s);
  if (
    minS < BOTTOM_CONTRAST_NEUTRAL_MAX_S &&
    maxS >= BOTTOM_CONTRAST_CHROMA_MIN_S &&
    dl >= BOTTOM_CONTRAST_NEUTRAL_MIN_DL
  ) {
    return true;
  }
  return (
    hueDist(h.h, b.h) >= BOTTOM_CONTRAST_MIN_HUE &&
    minS >= BOTTOM_CONTRAST_FAMILY_MIN_S &&
    dl >= BOTTOM_CONTRAST_FAMILY_MIN_DL
  );
}

function isMidNeutralSwatch(c: ColorRec): boolean {
  const hsl = hexToHsl(c.hex);
  return hsl.s < 0.18 && hsl.l >= 0.42 && hsl.l <= 0.88;
}

function isDarkAnchorSwatch(c: ColorRec): boolean {
  const hsl = hexToHsl(c.hex);
  if (hsl.l > 0.36) return false;
  if (hsl.s < 0.28) return true;
  if (hsl.h < 45 || hsl.h > 330) return true;
  return hsl.h >= 200 && hsl.h < 260;
}

function bottomsPool(
  anchors: ColorRec[],
  lights: ColorRec[],
  mids: ColorRec[],
  shared: [ColorRec, ColorRec],
  preferChroma = false,
): ColorRec[] {
  const out: ColorRec[] = [];
  const seen = new Set<string>();
  const chromatic = [...mids, ...lights].filter((sw) => hexToHsl(sw.hex).s >= 0.14);
  const order = preferChroma
    ? [...chromatic, ...anchors, shared[0], shared[1]]
    : [...anchors, shared[0], ...lights.slice(0, 2), shared[1], ...mids.slice(0, 1)];
  for (const sw of order) {
    const key = sw.hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sw);
  }
  return out.length ? out : [shared[0]];
}

/**
 * Belt = shoe leather when the shoe is a leather colour (dark / low-chroma);
 * with a coloured suede shoe (plum, teal) the belt is the darkest anchor
 * instead — the report's own rule is "belt leather follows your shoes", and a
 * belt in a *different* neutral (the previous behaviour) read as two leathers.
 */
/** A belt is a dark or mid leather; anything lighter reads as a light belt under dark trousers. */
const BELT_MAX_LIGHTNESS = 0.55;

export function beltForShoe(
  shoe: ColorRec,
  anchors: ColorRec[],
  neutrals: ColorRec[],
): ColorRec {
  // Belts exist in leather colours: the shoe's colour is followed only when
  // colour-rules calls it leather (not a chromatic spruce / teal / plum) AND it
  // is dark enough to be a belt — stone or greige sneakers do not make a stone
  // belt. One leather vocabulary for every layer, no second word list here.
  const leatherLike =
    !shoeColourOffLeather(`${shoe.name} leather`, shoe.hex, "#000000") &&
    hexToHsl(shoe.hex).l <= BELT_MAX_LIGHTNESS;
  if (leatherLike) return shoe;
  const byDepth = (a: ColorRec, b: ColorRec) => hexToHsl(a.hex).l - hexToHsl(b.hex).l;
  const darkNeutral = [...anchors, ...neutrals]
    .filter((c) => c.hex && hexToHsl(c.hex).s < 0.28)
    .sort(byDepth)[0];
  return darkNeutral ?? shoe;
}

/** Colour words of a swatch name worth matching ("Soft teal" → ["teal"]). */
function heroTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s/-]+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !/^(soft|muted|dusty|dark|deep|light|pale|cool|warm|mid|bright|clean|true|icy|rich)$/.test(t),
    );
}

/**
 * Did the model actually wear the recipe's hero? Checked on the description and
 * the structured items so a set cannot quietly repeat one hero across looks.
 */
export function recipeHeroHonoured(
  look: { description?: string | null; items?: { color?: string | null }[] | null },
  recipe: Pick<LookColorRecipe, "hero">,
): boolean {
  const tokens = heroTokens(recipe.hero.name);
  if (!tokens.length) return true;
  const hay = [
    look.description ?? "",
    ...(look.items ?? []).map((it) => it.color ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return tokens.some((t) => hay.includes(t));
}


/** Occasions where the shoes are dress leather by etiquette, not by palette. */
const FORMAL_SHOE_OCCASION_RE = /^(work|formal|wedding_guest|black[_-]?tie|gala)$/i;
const SHOE_GARMENT_RE =
  /\b(oxfords?|derb(?:y|ies)|brogues?|loafers?|monk[\s-]?straps?|boots?|shoes?)\b/i;
const BELT_GARMENT_RE = /\bbelts?\b/i;
const SHOE_MATERIAL_RE = /\b(leather|suede|nubuck|patent|canvas|polished|smooth)\b/gi;
/** Classic dress-leather colour words — anything else on a work look is a light shoe. */
const DRESS_LEATHER_WORD_RE =
  /\b(black|navy|charcoal|brown|chocolate|espresso|burgundy|oxblood|cordovan|bordeaux|wine|ink|midnight|dark)\b/i;

type LookSlotLike = { garment: string; color?: string | null };
type LookLike = { description?: string | null; items?: LookSlotLike[] | null };

/** The shoe slot of a look: structured item first, else the description clause. */
function shoeSlot(look: LookLike): { garment: string; color: string } | null {
  const item = (look.items ?? []).find((it) => SHOE_GARMENT_RE.test(it.garment));
  if (item) return { garment: item.garment, color: (item.color ?? "").trim() };
  const clause = (look.description ?? "")
    .split(/,\s*/)
    .find((c) => SHOE_GARMENT_RE.test(c));
  if (!clause) return null;
  const color = clause
    .replace(SHOE_GARMENT_RE, " ")
    .replace(SHOE_MATERIAL_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { garment: clause.trim(), color };
}

/**
 * Work / formal only: did the model name the shoes in the recipe's dress
 * colour, or at least a classic dark leather? Greige oxfords under charcoal
 * trousers is the failure this guards — light shoes darker trousers is the
 * one thing a business look cannot do.
 */
export function recipeShoeHonoured(
  look: LookLike,
  recipe: Pick<LookColorRecipe, "shoe">,
  occasionId?: string | null,
): boolean {
  if (!FORMAL_SHOE_OCCASION_RE.test(occasionId ?? "")) return true;
  const shoe = shoeSlot(look);
  if (!shoe || !shoe.color) return true;
  const colour = shoe.color.toLowerCase();
  if (heroTokens(recipe.shoe.name).some((t) => colour.includes(t))) return true;
  return DRESS_LEATHER_WORD_RE.test(colour);
}

/** "Soft charcoal" → "soft-charcoal" when the look hyphenates its colours. */
function colourWords(name: string, hyphenate: boolean): string {
  const words = name.trim().toLowerCase().split(/\s+/);
  return hyphenate ? words.join("-") : words.join(" ");
}

/**
 * Deterministic fallback when a work / formal look still names light shoes:
 * snap the shoe (and a belt that shared its colour) to the recipe's dress
 * leather in both the items and the description. Returns the look unchanged
 * when the shoes already pass {@link recipeShoeHonoured}.
 */
export function enforceRecipeShoe<T extends LookLike>(
  look: T,
  recipe: Pick<LookColorRecipe, "shoe" | "belt">,
  occasionId?: string | null,
): T {
  if (recipeShoeHonoured(look, recipe, occasionId)) return look;
  const shoe = shoeSlot(look);
  if (!shoe?.color) return look;
  const oldColour = shoe.color;
  const hyphenate = /\w-\w/.test(oldColour) || /\w-\w/.test(look.description ?? "");
  const shoeColour = colourWords(recipe.shoe.name, hyphenate);
  const beltColour = colourWords(recipe.belt.name, hyphenate);
  const oldRe = new RegExp(
    `\\b${oldColour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+")}\\b`,
    "gi",
  );
  const items = look.items
    ? look.items.map((it) => {
        const sameColour = (it.color ?? "").trim().toLowerCase() === oldColour.toLowerCase();
        if (SHOE_GARMENT_RE.test(it.garment)) return { ...it, color: shoeColour };
        if (BELT_GARMENT_RE.test(it.garment) && sameColour) return { ...it, color: beltColour };
        return it;
      })
    : look.items;
  const description = (look.description ?? "")
    .split(/,\s*/)
    .map((clause) => {
      if (SHOE_GARMENT_RE.test(clause)) return clause.replace(oldRe, shoeColour);
      if (BELT_GARMENT_RE.test(clause)) return clause.replace(oldRe, beltColour);
      return clause;
    })
    .join(", ");
  return { ...look, description, items };
}

const LEATHER_BELT_WORD_RE =
  /\b(black|brown|dark|chocolate|espresso|coffee|cognac|tan|burgundy|oxblood|cordovan|wine|navy|charcoal|grey|gray|taupe|greige|stone|camel|saddle|whisk(?:e)?y|walnut|chestnut|mocha)\b/i;

/**
 * Is the look's belt a leather colour? Recipes say "belt: X — a dark neutral
 * leather; never a coloured belt", yet a spruce belt under spruce loafers came
 * back. Any colour word that is not a leather tone is chromatic here.
 */
function beltColourIsChromatic(color: string): boolean {
  const c = color.trim().toLowerCase();
  if (!c) return false;
  if (LEATHER_BELT_WORD_RE.test(c)) return false;
  const words = c.split(/[\s-]+/).filter((w) => !/^(soft|muted|dusty|dark|deep|light|pale|cool|warm|mid|leather|suede|woven|braided)$/.test(w));
  return words.length > 0;
}

/**
 * Deterministic fix for a chromatic belt: the item and the description clause
 * take the recipe's belt leather. Unchanged when the belt is already leather.
 */
export function enforceRecipeBelt<T extends LookLike>(
  look: T,
  recipe: Pick<LookColorRecipe, "belt">,
): T {
  const belt = (look.items ?? []).find((it) => BELT_GARMENT_RE.test(it.garment));
  const oldColour = (belt?.color ?? "").trim();
  if (!belt || !oldColour || !beltColourIsChromatic(oldColour)) return look;
  const hyphenate = /\w-\w/.test(oldColour) || /\w-\w/.test(look.description ?? "");
  const beltColour = colourWords(recipe.belt.name, hyphenate);
  const oldRe = new RegExp(
    `\\b${oldColour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+")}\\b`,
    "gi",
  );
  const items = look.items
    ? look.items.map((it) => (BELT_GARMENT_RE.test(it.garment) ? { ...it, color: beltColour } : it))
    : look.items;
  const description = (look.description ?? "")
    .split(/,\s*/)
    .map((clause) => (BELT_GARMENT_RE.test(clause) ? clause.replace(oldRe, beltColour) : clause))
    .join(", ");
  return { ...look, description, items };
}

const TAILORED_JACKET_RE = /\b(blazers?|sport\s*coats?|sportcoats?|suit\s+jackets?)\b/i;
const OVERCOAT_RE = /\b(overcoats?|topcoats?)\b/i;

function firstSafeSwatch(
  cands: (ColorRec | null | undefined)[],
  ok: (name: string) => boolean,
  fallback: ColorRec,
): ColorRec {
  return cands.find((c) => c && ok(c.name)) ?? fallback;
}

function snapGarmentColour<T extends LookLike>(
  look: T,
  garmentRe: RegExp,
  needsSnap: (color: string) => boolean,
  next: ColorRec,
): T {
  const item = (look.items ?? []).find((it) => garmentRe.test(it.garment));
  const fromItem = (item?.color ?? "").trim();
  const clause = (look.description ?? "").split(/,\s*/).find((c) => garmentRe.test(c));
  const fromClause = clause
    ? (clause.match(
        /\b(soft[\s-]?teal|teal|mauve|rose|pink|blush|lilac|lavender|dusty[\s-]?blue|navy[\s-]?grey|charcoal|camel|stone|greige|spruce|slate)\b/i,
      )?.[0] ?? "")
    : "";
  const oldColour = fromItem || fromClause;
  if (!oldColour || !needsSnap(oldColour)) return look;
  const hyphenate = /\w-\w/.test(oldColour) || /\w-\w/.test(look.description ?? "");
  const nextColour = colourWords(next.name, hyphenate);
  const oldRe = new RegExp(
    `\\b${oldColour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+")}\\b`,
    "gi",
  );
  const items = look.items
    ? look.items.map((it) =>
        garmentRe.test(it.garment) && needsSnap(it.color ?? "")
          ? { ...it, color: nextColour }
          : it,
      )
    : look.items;
  const description = (look.description ?? "")
    .split(/,\s*/)
    .map((c) => (garmentRe.test(c) ? c.replace(oldRe, nextColour) : c))
    .join(", ");
  return { ...look, description, items };
}

/**
 * Fashion hues belong on a knit or square, not a blazer. An overcoat is
 * navy / charcoal / camel / stone / greige only. Snaps the slot; leaves a
 * mauve or teal cardigan alone. Burgundy jackets stay off work looks.
 * Plum jackets stay on party statement / experimental only.
 */
export function enforceRecipeJacketColour<T extends LookLike>(
  look: T,
  recipe: Pick<LookColorRecipe, "hero" | "neutrals"> & { bottom?: ColorRec },
  occasionId?: string | null,
  boldness?: string | null,
): T {
  const jacketOk = (name: string) =>
    isTailoredJacketSafeName(name, occasionId, boldness);
  const jacket =
    firstSafeSwatch(
      [recipe.hero, recipe.neutrals[1], recipe.neutrals[0], recipe.bottom],
      jacketOk,
      { name: "Navy grey", hex: "#2B3A4E", why: "" },
    );
  const coat =
    firstSafeSwatch(
      [recipe.neutrals[1], recipe.neutrals[0], recipe.hero, recipe.bottom],
      isOvercoatSafeName,
      { name: "Charcoal grey", hex: "#3A4048", why: "" },
    );
  const afterJacket = snapGarmentColour(
    look,
    TAILORED_JACKET_RE,
    (color) => !jacketOk(color),
    jacket,
  );
  return snapGarmentColour(
    afterJacket,
    OVERCOAT_RE,
    (color) => !isOvercoatSafeName(color),
    coat,
  );
}

export function lookSetColorRecipes(
  best: ColorRec[],
  count: number,
  mood?: LookColorRecipeMood,
): LookColorRecipe[] {
  if (count <= 0 || !best.length) return [];
  const preferChroma =
    mood?.boldness === "statement" || mood?.boldness === "experimental";
  const { heroes, anchors, lights, mids } = classify(best);
  const heroPool = spreadHeroes(heroes.length ? heroes : [...anchors, ...mids, ...lights].filter(Boolean));
  if (!heroPool.length) return [];
  const shared = pickShared(lights, mids, anchors, heroPool);
  const preferredBottoms = bottomsPool(anchors, lights, mids, shared, preferChroma);
  const extraBottoms = best.filter(
    (sw) =>
      !preferredBottoms.some((b) => b.hex.toLowerCase() === sw.hex.toLowerCase()),
  );
  const bottoms = [...preferredBottoms, ...extraBottoms];
  const seen = new Set<string>();
  const usedShoes = new Set<string>();
  const bottomUses = new Map<string, number>();
  const recipes: LookColorRecipe[] = [];
  const usedPink = { n: 0 };
  const usedHeroes = new Set<string>();

  for (let i = 0; i < count; i++) {
    const hero = pickHeroForLook(heroPool, i, mood, usedPink, usedHeroes);
    const occ = occasionOf(mood, i);
    const tailoredBottom = TAILORED_BOTTOM_OCCASION_RE.test(occ);
    let bottom =
      (tailoredBottom
        ? preferredBottoms.find((b) => !isLightRecipeBottom(b))
        : null) ??
      preferredBottoms[0] ??
      bottoms[0]!;
    let found = false;
    const tryOrder = [
      ...preferredBottoms.slice(i % Math.max(preferredBottoms.length, 1)),
      ...preferredBottoms.slice(0, i % Math.max(preferredBottoms.length, 1)),
      ...extraBottoms,
    ];
    // Three passes: bottoms that contrast with the hero AND are not yet worn
    // twice; then any contrasting bottom; a tonal pair is the last resort. One
    // trouser colour on four of six looks (cool-white chinos) was the failure.
    for (const pass of ["contrast+cap", "contrast", "any"] as const) {
      let pick: ColorRec | null = null;
      let pickUses = Infinity;
      for (const cand of tryOrder) {
        if (cand.hex.toLowerCase() === hero.hex.toLowerCase()) continue;
        if (tailoredBottom && isLightRecipeBottom(cand)) continue;
        if (chromaticClone(hero, cand)) continue;
        if (pass !== "any" && !bottomContrastsHero(hero, cand)) continue;
        const key = `${hero.hex}|${cand.hex}`.toLowerCase();
        if (seen.has(key)) continue;
        if (pass === "contrast+cap") {
          // Least-worn contrasting bottom first: a greedy first-fit spent the
          // two anchors on the first heroes and left the last hero only a third
          // pair of oatmeal chinos.
          const uses = bottomUses.get(cand.hex.toLowerCase()) ?? 0;
          if (uses >= MAX_SAME_BOTTOM_PER_SET || uses >= pickUses) continue;
          pick = cand;
          pickUses = uses;
          continue;
        }
        pick = cand;
        break;
      }
      if (pick) {
        bottom = pick;
        found = true;
        break;
      }
    }
    if (!found || !bottomContrastsHero(hero, bottom)) {
      // Exhausted cartesian pairs — pair with the next unused BEST swatch,
      // contrasting first. The "any" pass can leave a tonal pair (Soft teal
      // over Muted navy); rescue it when a real step still exists.
      const unused = (sw: ColorRec) =>
        sw.hex.toLowerCase() !== hero.hex.toLowerCase() &&
        !(tailoredBottom && isLightRecipeBottom(sw)) &&
        !chromaticClone(hero, sw) &&
        !seen.has(`${hero.hex}|${sw.hex}`.toLowerCase());
      const fallback =
        best.find((sw) => unused(sw) && bottomContrastsHero(hero, sw)) ??
        (!found ? best.find(unused) : null);
      if (fallback) {
        bottom = fallback;
        seen.add(`${hero.hex}|${fallback.hex}`.toLowerCase());
        found = true;
      }
    }
    seen.add(`${hero.hex}|${bottom.hex}`.toLowerCase());
    bottomUses.set(bottom.hex.toLowerCase(), (bottomUses.get(bottom.hex.toLowerCase()) ?? 0) + 1);
    const heroL = hexToHsl(hero.hex).l;
    const bottomL = hexToHsl(bottom.hex).l;
    const scheme: LookValueScheme =
      heroL <= bottomL ? "deep-over-light" : "light-over-deep";
    const accent =
      heroPool[(i + Math.ceil(heroPool.length / 2)) % heroPool.length] ?? null;
    const accentSw =
      accent && accent.hex.toLowerCase() !== hero.hex.toLowerCase()
        ? accent
        : null;
    const shoePool = [...anchors, ...shared, accentSw]
      .filter((c): c is ColorRec => Boolean(c))
      .filter((c) => !shoeClonesHero(c, hero));
    const needDarkShoe =
      isMidNeutralSwatch(hero) && isMidNeutralSwatch(bottom);
    const darkPool = [...anchors, ...shoePool].filter(isDarkAnchorSwatch);
    const eligible = needDarkShoe
      ? darkPool.length
        ? darkPool
        : shoePool
      : shoePool.length
        ? shoePool
        : darkPool;
    const unused = eligible.filter(
      (c) => !usedShoes.has(c.hex.toLowerCase()),
    );
    // Variety (an unused pair) never outranks the leg line: drop candidates
    // clearly lighter than the trousers first, then fall back to a reused pair,
    // and only then to whatever is left.
    // Sneaker contexts (weekend, travel, outdoors, resort) are the exception:
    // white or greige leather sneakers under navy chinos are the classic.
    const sneakerLook = isSneakerOccasion(
      mood?.occasionIds?.[i] ?? mood?.occasionId,
    );
    const bottomLightness = hexToHsl(bottom.hex).l;
    const notLighterThanLegs = (c: ColorRec) =>
      sneakerLook ||
      hexToHsl(c.hex).l - bottomLightness <= SHOE_LIGHTER_THAN_TROUSERS_MAX;
    const unusedOk = unused.filter(notLighterThanLegs);
    const eligibleOk = eligible.filter(notLighterThanLegs);
    const shoePoolForLook = unusedOk.length
      ? unusedOk
      : eligibleOk.length
        ? eligibleOk
        : unused.length
          ? unused
          : eligible;
    const shoe =
      contrastSwatch(bottom, shoePoolForLook, hero, {
        allowLighterShoe: sneakerLook,
      }) ??
      darkPool[0] ??
      shared[0] ??
      hero;
    usedShoes.add(shoe.hex.toLowerCase());
    recipes.push({
      hero,
      bottom,
      neutrals: shared,
      accent: accentSw,
      scheme,
      shoe,
      belt: beltForShoe(shoe, anchors, shared),
    });
  }
  return recipes;
}

const PINK_HERO_OCCASION_RE = /^(weekend|smart_casual)$/i;
const TAILORED_BOTTOM_OCCASION_RE =
  /^(work|business_social|dinner|formal|wedding_guest)$/i;

function occasionOf(mood: LookColorRecipeMood | undefined, i: number): string {
  return mood?.occasionIds?.[i] ?? mood?.occasionId ?? "";
}

function isPinkHeroSwatch(c: ColorRec): boolean {
  return isPinkFamilyName(c.name);
}

function isLightRecipeBottom(c: ColorRec): boolean {
  // Named whites only — greige / dove trousers are valid on a Soft Summer
  // dinner. Cool-white chinos on work were the defect (64510d11).
  return /\b(white|pearl|ivory|cream|snow)\b/i.test(c.name);
}

function pickHeroForLook(
  heroPool: ColorRec[],
  i: number,
  mood: LookColorRecipeMood | undefined,
  usedPink: { n: number },
  usedHeroes: Set<string>,
): ColorRec {
  const occ = occasionOf(mood, i);
  const occasionKnown = Boolean(occ);
  const allowPink =
    !occasionKnown || (PINK_HERO_OCCASION_RE.test(occ) && usedPink.n < 1);
  const start = i % heroPool.length;
  const ordered = [...heroPool.slice(start), ...heroPool.slice(0, start)];
  const eligible = allowPink
    ? ordered
    : ordered.filter((h) => !isPinkHeroSwatch(h));
  const pool = eligible.length ? eligible : ordered;
  const pick =
    pool.find((h) => !usedHeroes.has(h.hex.toLowerCase())) ?? pool[0]!;
  usedHeroes.add(pick.hex.toLowerCase());
  if (isPinkHeroSwatch(pick)) usedPink.n += 1;
  return pick;
}

const WARM_NEUTRAL_RE =
  /\b(mushroom|greige|taupe|beige|sand|stone|khaki|camel|tan|oat|putty)\b/i;

function isWarmNeutral(c: ColorRec): boolean {
  return WARM_NEUTRAL_RE.test(c.name);
}

/**
 * Shoes may be a touch lighter than the trousers, never a light pair under a
 * dark leg — greige loafers below charcoal trousers cut the leg line and read
 * as the wrong register. The penalty outweighs any contrast bonus, so such a
 * shoe wins only when every candidate breaks the rule.
 */
export const SHOE_LIGHTER_THAN_TROUSERS_MAX = 0.25;

/** Pick a shoe/contrast colour that won't melt into the trousers. */
export function contrastSwatch(
  from: ColorRec,
  candidates: (ColorRec | null | undefined)[],
  avoidHero?: ColorRec | null,
  opts?: { allowLighterShoe?: boolean },
): ColorRec | null {
  const fromHsl = hexToHsl(from.hex);
  let best: ColorRec | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (!c?.hex) continue;
    if (c.hex.toLowerCase() === from.hex.toLowerCase()) continue;
    const hsl = hexToHsl(c.hex);
    let score = Math.abs(hsl.l - fromHsl.l) + hueDist(fromHsl.h, hsl.h) / 360;
    if (isWarmNeutral(from) && isWarmNeutral(c)) score -= 0.45;
    if (avoidHero && shoeClonesHero(c, avoidHero)) score -= 0.8;
    if (!opts?.allowLighterShoe && hsl.l - fromHsl.l > SHOE_LIGHTER_THAN_TROUSERS_MAX) {
      score -= 1.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function formatLookColorRecipePrompt(
  recipe: LookColorRecipe,
  mood?: LookColorRecipeMood,
): string {
  const swatch = (c: ColorRec) => `${c.name} ${c.hex}`;
  const isParty = mood?.occasionId === "party";
  const isStatement =
    mood?.boldness === "statement" || mood?.boldness === "experimental";
  const accent = recipe.accent
    ? isParty
      ? `- Accent (pocket square only with a blazer, scarf, or jewellery — never a tote): ${swatch(recipe.accent)}\n`
      : `- Accent only (belt, scarf, bag or a small layer — not a second main garment). ` +
        `Name a pocket square only if this look also has a blazer — never on a ` +
        `shirt-only look or a jumper: ${swatch(recipe.accent)}\n`
    : "";
  const heroLine = isParty && isStatement
    ? `- Hero (nearest the face): ${swatch(recipe.hero)} — an evening statement piece ` +
      `(velvet jacket, silk shirt or rich colour), not a standalone office crewneck.\n`
    : `- Hero (nearest the face / main top): ${swatch(recipe.hero)}\n`;
  const shoe =
    recipe.shoe ??
    contrastSwatch(
      recipe.bottom,
      [...recipe.neutrals, recipe.accent, recipe.hero],
      null,
      { allowLighterShoe: isSneakerOccasion(mood?.occasionId) },
    ) ??
    recipe.neutrals[0];
  const belt = recipe.belt ?? beltForShoe(shoe, [], recipe.neutrals);
  const beltLine =
    belt.hex.toLowerCase() === shoe.hex.toLowerCase()
      ? `- Belt: ${swatch(belt)} — the same leather tone as the shoes.\n`
      : `- Belt: ${swatch(belt)} — a dark neutral leather to sit with the coloured shoes; never a coloured belt.\n`;
  const isWork =
    mood?.occasionId === "work" || mood?.occasionId === "formal";
  const shirtColor = isWork
    ? workDefaultShirtColor(recipe.bottom.name, recipe.bottom.hex)
    : null;
  const shirtLine = shirtColor
    ? shirtColor === "white"
      ? `- Shirt: white oxford or poplin — trousers are dark / brown. Do not put the hero colour on the shirt.\n`
      : `- Shirt: light blue oxford or poplin — trousers are light. Do not put the hero colour on the shirt.\n`
    : "";
  const neutralsLine = isParty
    ? `- Shoes: ${swatch(shoe)} — MUST contrast the trousers (different lightness or family; ` +
      `never greige/mushroom/taupe shoes with greige/mushroom/taupe trousers). No tote.\n` +
      beltLine
    : `- Shoes: ${swatch(shoe)} — this look's pair, not the same grey as every other look; ` +
      (isSneakerOccasion(mood?.occasionId)
        ? `a clean light leather sneaker under darker trousers is welcome here. `
        : `never a shoe clearly lighter than the trousers. `) +
      `Must contrast the trousers (not the same greige/mushroom/taupe family). ` +
      `Shoes must not match the jacket unless both are a dark navy or black formal set.\n` +
      beltLine +
      `- Shared neutrals (bag, other trims): ${recipe.neutrals.map(swatch).join(", ")}\n`;
  const jacketLine = !isTailoredJacketSafeName(
    recipe.hero.name,
    mood?.occasionId,
    mood?.boldness,
  )
    ? `- Put ${recipe.hero.name} on a knit, cardigan, square or tie — never on a blazer, sport coat or overcoat.\n`
    : `- A blazer is navy, charcoal, grey, black, dusty-blue, camel, beige, cream, brown, olive or burgundy only — never teal, sage, mint, mauve or powder-blue. Burgundy jackets are dinner, party, formal or wedding only, not work. A plum velvet jacket is party statement or experimental only. An overcoat is navy, charcoal, camel, stone or greige only.\n`;
  const harmony =
    `One chromatic hero — do not repeat ${recipe.hero.name} on the shoes or a second main garment. ` +
    `If the shirt and trousers are both mid-neutrals (greige, mushroom, taupe, stone, camel, beige, mid-grey), add a dark anchor.\n`;
  return (
    `Colour recipe for THIS look (mandatory — do not substitute):\n` +
    heroLine +
    `- Bottom: ${swatch(recipe.bottom)}\n` +
    shirtLine +
    neutralsLine +
    jacketLine +
    accent +
    harmony +
    `Use ONLY these colours in "palette" and in every garment colour word in the description.` +
    (shirtColor
      ? ` The shirt colour above is the one exception — white or light blue is required for work.\n`
      : `\n`)
  );
}

export function recipePaletteHexes(recipe: LookColorRecipe): string[] {
  const out: string[] = [recipe.hero.hex, recipe.bottom.hex, recipe.shoe.hex];
  if (recipe.belt?.hex) out.push(recipe.belt.hex);
  for (const n of recipe.neutrals) out.push(n.hex);
  if (recipe.accent) out.push(recipe.accent.hex);
  const seen = new Set<string>();
  return out.filter((h) => {
    const k = h.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function bestSwatchesForProfile(profile: StyleProfile): ColorRec[] {
  const undertone = profile.physical.undertone;
  const contrast = profile.physical.contrast;
  const subseason =
    profile.colorSubseason ??
    classifySubseason({
      season: profile.colorSeason,
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
    });
  return reportPalette({
    subseason,
    ...palettePersonWithTrust({
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
      skinTone: profile.physical.skinTone,
      skinHex: profile.physical.skinHex,
      hairHex: profile.physical.hairHex,
      eyeHex: profile.physical.eyeHex,
      lighting: lightingForTrust(profile.physical),
    }),
  }).best;
}
