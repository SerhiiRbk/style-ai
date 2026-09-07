/**
 * The capsule: contexts × outfits from the shopping list, formal-context caps,
 * column blends, phases and price tiers.
 */
import type { ColorRec, Look, ShoppingItem } from "@/lib/report";
import { type StyleProfile } from "@/lib/style-profile";
import { capsuleLookLine } from "@/lib/capsule-wardrobe";
import { isAccentForPalette, paletteRoleForHex } from "@/lib/palette-roles";

import {
  GREY_COLUMN,
  colorMatchScore,
  hexToHsl,
  hueDist,
  isDarkAnchorPiece,
  isLightBottomPiece,
  isWarmCreamNearFace,
  parseHexColor,
  pieceHsl,
  pieceLightness,
  productColorFamilies,
} from "@/lib/colour-rules";
import {
  CASUAL_FOOTWEAR_RE,
  CASUAL_OUTERWEAR_RE,
  SNEAKER_RE,
  isAccentOnlyTitle,
  isBeltTitle,
  isBottomTitle,
  isCasualDressShoeTitle,
  isCasualSummerShirtTitle,
  isDrawstringTitle,
  isJacketTitle,
  isJeanTitle,
  isLoaferTitle,
  isLongSleeveShirtTitle,
  isShoeTitle,
  isShortsTitle,
  isWinterLayerTitle,
} from "@/lib/garment-title";
import {
  assumedBasics,
  decomposeLook,
  isClassicShoeWithShorts,
  isWarmLayerWithShorts,
  jacketClonesShoes,
  sanitizeLookHarmony,
  sanitizeShortsOutfit,
  styleFitScore,
  SCORING,
} from "@/lib/look-garments";

export type CapsulePlan = {
  pieces: number;
  outfits: number;
  now: ShoppingItem[];
  next: ShoppingItem[];
  later: ShoppingItem[];
};

export type OutfitCombo = {
  context: string;
  pieces: string[];
  /** Subset of `pieces` that are assumed wardrobe basics, not curated catalogue. */
  owned?: string[];
  image?: string;
};

export type PriceTier = {
  category: string;
  good: number;
  better: number;
  best: number;
  note: string;
};

export const CATEGORY_PRIORITY: Record<string, number> = {
  Outerwear: 0,
  Trousers: 1,
  Footwear: 2,
  Knitwear: 3,
  Shirts: 4,
  Accessories: 5,
};

export function capsuleFrom(shopping: ShoppingItem[], profile: StyleProfile): CapsulePlan {
  const count = (cats: string[]) =>
    shopping.filter((i) => cats.includes(i.category)).length;

  // Combinatorial estimate from purchased pieces only — assumed basics do
  // not inflate "12 outfits from 10 pieces" when they are not in the plan.
  const realTops = count(["Knitwear", "Shirts"]);
  const topsN = realTops + (count(["Outerwear"]) > 0 ? 1 : 0);
  const bottomsN = count(["Trousers"]);
  const shoesN = count(["Footwear"]);
  const outfits = topsN > 0 && bottomsN > 0 && shoesN > 0
    ? Math.min(40, topsN * bottomsN * shoesN)
    : 0;

  const hero = pickHero(shopping, profile.boldness);
  const colorByTitle = new Map(shopping.map((i) => [i.title, i.color ?? ""]));
  const tailoredMin = Math.min(
    ...shopping
      .filter(
        (i) =>
          i.category === "Outerwear" && !CASUAL_OUTERWEAR_RE.test(i.title),
      )
      .map((i) => i.priceEur ?? Number.POSITIVE_INFINITY),
  );
  const score = (i: ShoppingItem): number => {
    if (hero && i.title === hero.title) return 0;
    const expensiveCasual =
      i.category === "Outerwear" &&
      CASUAL_OUTERWEAR_RE.test(i.title) &&
      Number.isFinite(tailoredMin) &&
      (i.priceEur ?? 0) > tailoredMin * 2.2;
    if (expensiveCasual) return 80;
    if (i.category === "Accessories") return 70;
    if (i.category === "Shirts" && isLongSleeveShirtTitle(i.title)) return 1.5;
    if (
      i.category === "Trousers" &&
      isDarkAnchorPiece(i.title, colorByTitle)
    ) {
      return 2;
    }
    if (
      i.category === "Footwear" &&
      !SNEAKER_RE.test(i.title) &&
      !CASUAL_FOOTWEAR_RE.test(i.title)
    ) {
      return 2.5;
    }
    if (i.category === "Knitwear") return 3.5;
    return (CATEGORY_PRIORITY[i.category] ?? 9) + 1;
  };
  const sorted = [...shopping].sort((a, b) => score(a) - score(b));
  const now: ShoppingItem[] = [];
  const taken = new Set<string>();
  const take = (i: ShoppingItem) => {
    now.push(i);
    taken.add(i.title);
  };
  if (hero) take(hero);
  // Phase one must dress the client once: a top (shirt or knit), trousers and
  // shoes on top of the hero — a blazer, a shirt and trousers with nothing on
  // the feet is not an outfit. Cheapest-first within each role.
  const roleOf = (i: ShoppingItem): "top" | "bottom" | "shoe" | null =>
    i.category === "Shirts" || i.category === "Knitwear"
      ? "top"
      : i.category === "Trousers"
        ? "bottom"
        : i.category === "Footwear"
          ? "shoe"
          : null;
  const covered = new Set(now.map(roleOf).filter(Boolean));
  for (const role of ["top", "bottom", "shoe"] as const) {
    if (covered.has(role)) continue;
    const pick = sorted.find((i) => !taken.has(i.title) && roleOf(i) === role);
    if (pick) {
      take(pick);
      covered.add(role);
    }
  }
  const rest = sorted.filter((i) => !taken.has(i.title));
  // The belt that closes the outfit comes right after it, ahead of a second shirt.
  const beltIdx = rest.findIndex((i) => isBeltTitle(i.title));
  if (beltIdx > 0) rest.unshift(...rest.splice(beltIdx, 1));
  return {
    pieces: shopping.length,
    outfits,
    now,
    next: rest.slice(0, 2),
    later: rest.slice(2),
  };
}

/** Investment tag for a single shopping item (used as a pill in the UI). */
export function investmentLevel(item: ShoppingItem): "Invest" | "Core" | "Accent" {
  const price = item.priceEur ?? 0;
  if (price >= INVEST_PRICE_EUR) return "Invest";
  // Outerwear / footwear are investment categories — but an €18 shacket or a
  // €40 pair of shoes is not an investment, whatever the category.
  if (["Outerwear", "Footwear"].includes(item.category)) {
    return price >= INVEST_CATEGORY_MIN_EUR ? "Invest" : "Core";
  }
  if (["Trousers", "Knitwear", "Shirts"].includes(item.category)) return "Core";
  return "Accent";
}

/** Any piece at or above this price is an investment. */
export const INVEST_PRICE_EUR = 150;

/** Outerwear / footwear below this price is a core basic, not an investment. */
export const INVEST_CATEGORY_MIN_EUR = 60;

export function capsuleOutfitDescription(
  pieces: string[],
  colorByTitle: Map<string, string>,
  colorNameByTitle?: Map<string, string>,
): string {
  return capsuleLookLine(pieces, colorByTitle, colorNameByTitle);
}

/**
 * True when a shirt/knit and trousers would read as one column. The legacy
 * check catches two greys by colour family; with the report palette it also
 * catches two same-value neutrals of different families (dove-grey shirt over
 * greige chinos) and two accents on one hue without a value step (sage on
 * sage). Dark-on-dark (charcoal knit, navy trousers) is a deliberate column
 * and passes.
 */
export function capsuleColumnBlends(
  top: string,
  bottom: string,
  colorByTitle: Map<string, string>,
  best?: ColorRec[],
): boolean {
  if (greyColumnBlends(top, bottom, colorByTitle)) return true;
  const palette = (best ?? []).filter((c) => c.hex);
  if (!palette.length) return false;
  const th = pieceHsl(top, colorByTitle);
  const bh = pieceHsl(bottom, colorByTitle);
  if (!th || !bh) return false;
  const topHex = parseHexColor(colorByTitle.get(top) ?? "")!;
  const bottomHex = parseHexColor(colorByTitle.get(bottom) ?? "")!;
  const dl = Math.abs(th.l - bh.l);
  const topAccent = isAccentForPalette(topHex, palette);
  const bottomAccent = isAccentForPalette(bottomHex, palette);
  if (!topAccent && !bottomAccent) {
    const anchors =
      paletteRoleForHex(topHex, palette) === "anchor" &&
      paletteRoleForHex(bottomHex, palette) === "anchor";
    // A true white shirt is menswear's base, not a mush partner: white over
    // stone chinos is a summer classic, not a column.
    const trueWhite = (c: { s: number; l: number }) => c.l >= 0.92 && c.s < 0.1;
    if (trueWhite(th) || trueWhite(bh)) return false;
    return !anchors && dl < NEUTRAL_COLUMN_MAX_DL;
  }
  if (topAccent && bottomAccent) {
    return hueDist(th.h, bh.h) < 30 && dl < 0.28;
  }
  return false;
}

/** Two palette neutrals closer than this in lightness read as one column. */
export const NEUTRAL_COLUMN_MAX_DL = 0.15;

function greyColumnBlends(
  top: string,
  bottom: string,
  colorByTitle: Map<string, string>,
): boolean {
  const topFams = productColorFamilies(
    colorByTitle.get(top) ?? null,
    top,
    colorByTitle.get(top),
  );
  const botFams = productColorFamilies(
    colorByTitle.get(bottom) ?? null,
    bottom,
    colorByTitle.get(bottom),
  );
  const bothGrey =
    [...topFams].some((f) => GREY_COLUMN.has(f)) &&
    [...botFams].some((f) => GREY_COLUMN.has(f));
  if (!bothGrey) return false;
  const lt = pieceLightness(top, colorByTitle);
  const lb = pieceLightness(bottom, colorByTitle);
  if (lt == null || lb == null) return true;
  return Math.abs(lt - lb) < 0.28;
}

const STOP = new Set([
  "the","and","with","over","under","a","an","of","for","in","on","to","blend","leather","merino","minimal","cream","dial","unstructured","wool",
]);

/** Significant lowercase keywords from a product title. */
function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Shopping items that appear in a look's description ("shop the look"). */
export function itemsForLook(look: Look, shopping: ShoppingItem[]): ShoppingItem[] {
  const garments = decomposeLook(`${look.title}, ${look.description}`);
  if (garments.length) {
    const seen = new Set<string>();
    const items: ShoppingItem[] = [];
    for (const g of garments) {
      if (items.length >= 6) break;
      const candidates = shopping.filter((it) => it.category === g.category);
      if (!candidates.length) continue;
      const ranked = [...candidates].sort(
        (a, b) =>
          colorMatchScore(g.color, b.color, b.title) -
          colorMatchScore(g.color, a.color, a.title),
      );
      const best = ranked[0];
      const id = best.productId ?? best.title;
      if (seen.has(id)) continue;
      seen.add(id);
      const score = colorMatchScore(g.color, best.color, best.title);
      items.push({
        ...best,
        similarPick: score < 0.7,
        why:
          score >= 0.7
            ? best.why
            : `A similar ${g.garment} from your capsule — close in category and tone.`,
      });
    }
    if (items.length) return items;
  }
  const desc = look.description.toLowerCase();
  return shopping
    .filter((it) => keywords(it.title).some((k) => desc.includes(k)))
    .slice(0, 4)
    .map((it) => ({ ...it, similarPick: true }));
}

export function capsuleImageDirectives(pieces: string[]): string {
  const hasKnit = pieces.some((p) =>
    /\b(jumper|sweater|crewneck|knit|roll-?neck)\b/i.test(p),
  );
  const hasJacket = pieces.some(isJacketTitle);
  const parts = [
    "If a garment name includes navy, charcoal or cream, paint that named colour even when a swatch looks washed-out or light grey. ",
  ];
  if (hasKnit && hasJacket) {
    parts.push(
      "Do not copy elbow patches, cables or rib from the knit onto the jacket or windbreaker. ",
    );
  }
  if (pieces.some((p) => isJeanTitle(p))) {
    parts.push(
      "Jeans must read as denim — indigo or blue-grey with a visible weave, not grey dress trousers. ",
    );
  }
  return parts.join("");
}

/** Contexts that call for dress shoes rather than casual/warm-weather footwear. */
export const FORMAL_CONTEXTS = new Set([
  "Boardroom",
  "Client meeting",
  "Dinner",
  "Date night",
  "On stage",
  "Evening event",
]);

/**
 * Optional lifestyle tags (from intake) → the outfit contexts they call for.
 * Keyed by lower-cased label. Empty lifestyle contributes nothing, so a report
 * with no lifestyle selected behaves exactly as before.
 */
const LIFESTYLE_CONTEXTS: Record<string, string[]> = {
  "office & remote": ["Boardroom", "Client meeting", "Smart casual"],
  "travels often": ["Travel day", "Smart casual"],
  "active / outdoors": ["Outdoors", "Weekend"],
  "public speaking": ["On stage", "Client meeting"],
  "creator / blog": ["On camera", "Smart casual"],
  parenting: ["Everyday", "Weekend"],
  "old money": ["Country weekend", "Smart casual", "Dinner"],
  socialite: ["Evening event", "Date night", "Dinner"],
};

/**
 * Outfit contexts for the client. Lifestyle tags (optional) take priority, then
 * goals + boldness, then a sensible default mix to guarantee enough contexts.
 */
function contextsForGoals(profile: StyleProfile): string[] {
  const hay = `${profile.goals.join(" ")} ${profile.boldness}`.toLowerCase();
  const out: string[] = [];
  const add = (...cs: string[]) => {
    for (const c of cs) if (!out.includes(c)) out.push(c);
  };
  // Lifestyle first — most personal signal. Empty ⇒ no effect (unchanged).
  for (const l of profile.lifestyle ?? []) {
    const cs = LIFESTYLE_CONTEXTS[l.trim().toLowerCase()];
    if (cs) add(...cs);
  }
  // Occupation bias — some professions have a strong dress-code signal that
  // should lean the capsule toward formal contexts. Law/Legal in particular
  // lives in suits (court, clients, negotiations), so front-load formal
  // contexts before goals so they survive the six-context slice.
  if (/law|legal|attorney|lawyer|solicitor|barrister/.test((profile.occupation ?? "").toLowerCase()))
    add("Boardroom", "Client meeting", "Dinner");
  if (/work|profession|office|career|business|promot|lead|manage|interview/.test(hay))
    add("Boardroom", "Client meeting");
  if (/confiden|date|dating|social|attract|impress|romance/.test(hay))
    add("Dinner", "Date night");
  if (/casual|weekend|comfort|relax|everyday|natural|simple/.test(hay))
    add("Weekend", "Travel day");
  if (/versatile|capsule|minimal|polished|elevate/.test(hay))
    add("Smart casual", "Everyday");
  // Always have at least six contexts available.
  add("Smart casual", "Weekend", "Client meeting", "Dinner", "Travel day", "Everyday");
  return out;
}

/** A context-specific outfit recipe: which layer / top / bottom / shoe to use. */
type OutfitSlot = {
  layer: "formal" | "casual" | "none";
  top: "shirt" | "knit" | "polo" | "tee" | "any";
  bottom: "dress" | "chino" | "jean";
  shoe: "dress" | "loafer" | "sneaker";
};

/**
 * Per-context recipes give every capsule look a distinct silhouette. Formal
 * contexts always land on dress shoes; casual ones differentiate between a
 * smart-casual (chinos + loafers) and a relaxed (jeans + sneakers) register.
 */
const CAPSULE_RECIPES: Record<string, OutfitSlot> = {
  Boardroom: { layer: "formal", top: "shirt", bottom: "dress", shoe: "dress" },
  // A client meeting is a business context — a tailored jacket over a shirt (or a
  // fine knit), never a lone casual shirt. `wearingJacket` then drives shirt/knit.
  "Client meeting": { layer: "formal", top: "shirt", bottom: "dress", shoe: "dress" },
  Dinner: { layer: "formal", top: "knit", bottom: "dress", shoe: "dress" },
  // A date is not the office after six: a casual layer (overshirt / unstructured
  // blazer worn open) over the shirt, and loafers rather than cap-toe oxfords.
  "Date night": { layer: "casual", top: "shirt", bottom: "dress", shoe: "loafer" },
  "Smart casual": { layer: "none", top: "shirt", bottom: "chino", shoe: "loafer" },
  Everyday: { layer: "none", top: "shirt", bottom: "chino", shoe: "sneaker" },
  Weekend: { layer: "casual", top: "polo", bottom: "jean", shoe: "sneaker" },
  "Travel day": { layer: "casual", top: "tee", bottom: "chino", shoe: "sneaker" },
  // Lifestyle-driven contexts (distinct silhouettes so images differ).
  Outdoors: { layer: "casual", top: "tee", bottom: "jean", shoe: "sneaker" },
  "On stage": { layer: "none", top: "knit", bottom: "dress", shoe: "loafer" },
  "On camera": { layer: "none", top: "knit", bottom: "chino", shoe: "loafer" },
  "Country weekend": { layer: "casual", top: "knit", bottom: "chino", shoe: "sneaker" },
  "Evening event": { layer: "formal", top: "shirt", bottom: "dress", shoe: "dress" },
};

const DEFAULT_CAPSULE_SLOT: OutfitSlot = {
  layer: "none",
  top: "any",
  bottom: "chino",
  shoe: "sneaker",
};

/** With one tailored jacket, at most this many formal-layer contexts. */
export const MAX_FORMAL_CONTEXTS_ONE_JACKET = 2;

/** Shirt-formal contexts to give up first — the ones that clone Client meeting. */
const FORMAL_CONTEXT_DROP_FIRST = ["Evening event", "Boardroom"];

/** Casual / smart contexts that can stand in for a dropped formal one. */
const CASUAL_CONTEXT_FALLBACK = ["Smart casual", "Weekend", "Everyday", "Travel day", "On camera"];

function formalLayerContext(context: string): boolean {
  return (CAPSULE_RECIPES[context] ?? DEFAULT_CAPSULE_SLOT).layer === "formal";
}

/**
 * Six contexts sized to the wardrobe: one tailored jacket cannot carry three
 * formal outfits — they end up the same blazer, trousers and shoes with only
 * the shirt changing. Keep two (the knit-under-jacket dinner plus the first
 * business context), swap the rest for the next casual / smart contexts in the
 * client's list, in place so the capsule photo order stays stable.
 */
export function capFormalContexts(allContexts: string[], formalJackets: number): string[] {
  const contexts = allContexts.slice(0, 6);
  if (formalJackets > 1) return contexts;
  const formal = contexts.filter(formalLayerContext);
  if (formal.length <= MAX_FORMAL_CONTEXTS_ONE_JACKET) return contexts;
  const knitFormal = formal.find(
    (c) => (CAPSULE_RECIPES[c] ?? DEFAULT_CAPSULE_SLOT).top === "knit",
  );
  const drop = new Set<string>();
  const dropOne = () => {
    const victim =
      FORMAL_CONTEXT_DROP_FIRST.find(
        (c) => formal.includes(c) && !drop.has(c) && c !== knitFormal,
      ) ??
      [...formal].reverse().find((c) => !drop.has(c) && c !== knitFormal) ??
      [...formal].reverse().find((c) => !drop.has(c));
    if (victim) drop.add(victim);
  };
  while (formal.length - drop.size > MAX_FORMAL_CONTEXTS_ONE_JACKET) {
    const before = drop.size;
    dropOne();
    if (drop.size === before) break;
  }
  const replacements = [...allContexts.slice(6), ...CASUAL_CONTEXT_FALLBACK].filter(
    (c, i, arr) =>
      !formalLayerContext(c) && !contexts.includes(c) && arr.indexOf(c) === i,
  );
  return contexts.map((c) => (drop.has(c) ? replacements.shift() ?? c : c));
}

/**
 * Mix-and-match outfit matrix built ONLY from the curated catalogue (`shopping`).
 * When a slot has no catalogue item (e.g. no trousers / shoes), it is filled with
 * clearly-labelled assumed wardrobe basics rather than fabricated catalogue picks.
 * Contexts are tied to the client's goals. Deterministic so the generated capsule
 * images (ordered to match this output) stay aligned.
 */
export function capsuleMatrix(
  shopping: ShoppingItem[],
  profile: StyleProfile,
  /** The report's BEST palette — accent / neutral is judged against it. */
  best?: ColorRec[],
): OutfitCombo[] {
  const pick = (cats: string[]) =>
    shopping.filter((i) => cats.includes(i.category)).map((i) => i.title);
  const basics = assumedBasics(profile);
  const owned = new Set<string>();
  const shoppingTitles = new Set(shopping.map((i) => i.title));
  const markOwned = (p: string) => {
    if (p && !shoppingTitles.has(p)) owned.add(p);
  };

  const layers = pick(["Outerwear"]);
  const knits = pick(["Knitwear"]);
  const cool = profile.physical.undertone === "cool";
  const shirtsAll = pick(["Shirts"]).filter((t) => {
    if (!cool) return true;
    const hex = shopping.find((i) => i.title === t)?.color;
    return !isWarmCreamNearFace(t, hex);
  });
  const anyTop = [...knits, ...shirtsAll];
  if (!anyTop.length && !layers.length) return [];

  const tees = shirtsAll.filter((t) => /\b(t-?shirt|tee)\b/i.test(t));
  const dressShirts = (() => {
    const long = shirtsAll.filter(
      (t) =>
        !/\b(t-?shirt|tee|polo)\b/i.test(t) && !isCasualSummerShirtTitle(t),
    );
    return long.length
      ? long
      : shirtsAll.filter((t) => !/\b(t-?shirt|tee|polo)\b/i.test(t));
  })();
  const polos = anyTop.filter((t) => /polo/i.test(t));
  // Novelty/patterned knits (argyle, fair isle, cable, prints) read casual and
  // dated under tailoring — keep a plain-knit pool for formal / jacket looks.
  const plainKnits = knits.filter(
    (t) =>
      !/\b(argyle|fair[- ]?isle|jacquard|intarsia|cable|patterned|printed|striped?|checked?|floral|colou?r[- ]?block)\b/i.test(
        t,
      ),
  );

  const formalLayers = layers.filter((l) => !CASUAL_OUTERWEAR_RE.test(l));
  const casualLayers = layers.filter((l) => CASUAL_OUTERWEAR_RE.test(l));

  const catTrousersAll = pick(["Trousers"]);
  const catShorts = catTrousersAll.filter(isShortsTitle);
  // Shorts live in Trousers in the catalogue but are not dress trousers,
  // chinos or jeans — pairing them with a blazer reads as a chopped suit.
  const catTrousers = catTrousersAll.filter((t) => !isShortsTitle(t));
  // Prefer real catalogue chinos/jeans for those slots before falling back to
  // assumed basics, so purchasable trousers aren't crowded out by virtual ones.
  const catJeans = catTrousers.filter(isJeanTitle);
  const catChinos = catTrousers.filter((t) => /\bchinos?\b/i.test(t));
  const catOtherTrousers = catTrousers.filter(
    (t) => !/\b(jeans?|denim|chinos?)\b/i.test(t),
  );
  // Drawstring / jogger trousers are not a dinner or client-meeting trouser.
  const catDressTrousers = catOtherTrousers.filter((t) => !isDrawstringTitle(t));
  const jeanBasic = basics.bottoms[0];
  const chinoBasic = basics.bottoms[1] ?? basics.bottoms[0];

  // Split footwear by formality. Formal contexts get dress shoes only (never
  // sandals/clogs); casual contexts prefer sneakers. Each falls back to a
  // clearly-labelled assumed basic when the catalogue lacks a fitting pair.
  const shoes = (() => {
    const s = pick(["Footwear"]);
    return s.length ? s : basics.shoes;
  })();
  const dressShoes = shoes.filter(
    (s) => !CASUAL_FOOTWEAR_RE.test(s) && !SNEAKER_RE.test(s),
  );
  // A suede or crepe-soled derby is smart casual: when a smooth-leather lace-up
  // exists it takes the dress slot and the suede lace-up drops out of the formal
  // pool. Loafers are judged by context, not construction (suede loafers are
  // exactly right with chinos), so they stay.
  const laceAll = dressShoes.filter((s) => !isLoaferTitle(s));
  const smoothLace = laceAll.filter((s) => !isCasualDressShoeTitle(s));
  const laceInCatalogue = smoothLace.length ? smoothLace : laceAll;
  const dressPool = smoothLace.length
    ? dressShoes.filter((s) => isLoaferTitle(s) || !isCasualDressShoeTitle(s))
    : dressShoes;
  // A loafer is not a derby. If the catalogue only returned loafers, keep them
  // for loafer contexts and fill lace-up slots with an assumed dress shoe.
  if (!laceInCatalogue.length) basics.shoes.forEach((s) => markOwned(s));
  const formalPool = laceInCatalogue.length
    ? dressPool
    : dressShoes.length
      ? [...basics.shoes, ...dressShoes]
      : basics.shoes;
  const sneakers = shoes.filter((s) => SNEAKER_RE.test(s));
  const casualPool = sneakers.length ? sneakers : basics.casualShoes;
  if (!sneakers.length) basics.casualShoes.forEach((s) => markOwned(s));

  // Round-robin picker so consecutive looks don't repeat the same piece.
  const counts = new Map<string, number>();
  const rot = (key: string, arr: string[]): string | undefined => {
    const clean = arr.filter(Boolean);
    if (!clean.length) return undefined;
    const n = counts.get(key) ?? 0;
    counts.set(key, n + 1);
    return clean[n % clean.length];
  };
  const poolForTop = (kind: OutfitSlot["top"]): [string, string[]] => {
    switch (kind) {
      case "shirt": {
        const base = dressShirts.length ? dressShirts : anyTop;
        const fresh = base.filter((t) => !shirtAtCap(t));
        if (fresh.length) return ["shirt", fresh];
        // Every shirt already on two outfits: a knit under its cap beats a
        // third appearance of the same shirt.
        const otherTops = anyTop.filter((t) => !shirtAtCap(t) && !knitAtCap(t));
        return ["shirt", otherTops.length ? otherTops : base];
      }
      case "knit":
        return ["knit", knits.length ? knits : anyTop];
      case "polo":
        return ["polo", polos.length ? polos : knits.length ? knits : anyTop];
      case "tee":
        return ["tee", tees.length ? tees : anyTop];
      default:
        return ["any", anyTop];
    }
  };
  const topFor = (kind: OutfitSlot["top"]): string | undefined => {
    const [key, pool] = poolForTop(kind);
    return rot(key, pool);
  };

  // Colour harmony: build a title → swatch map so a look keeps at most one
  // accent piece (neutrals form the base). Unknown/non-hex colours are treated
  // as neutral so nothing is dropped when colour data is missing. With the
  // report palette, accent vs neutral follows the role of the nearest BEST
  // swatch (a muted teal on a Soft Summer IS the accent); without it, the
  // legacy saturation constant.
  const colorByTitle = new Map<string, string>();
  for (const i of shopping) if (i.title && i.color) colorByTitle.set(i.title, i.color);
  const palette = (best ?? []).filter((c) => c.hex);
  const isNeutralPiece = (title?: string): boolean => {
    if (!title) return true;
    const hex = colorByTitle.get(title);
    if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.trim())) return true;
    if (palette.length) return !isAccentForPalette(hex, palette);
    return hexToHsl(hex).s < 0.3;
  };

  // Each context maps to a distinct silhouette so, e.g., Smart casual (knit +
  // chinos + loafers) never collapses into Weekend (jacket + polo + jeans +
  // sneakers). Deterministic — capsule images are ordered to match.
  const allContexts = contextsForGoals(profile);
  const contexts = capFormalContexts(allContexts, formalLayers.length);
  const combos: OutfitCombo[] = [];
  const seen = new Set<string>();
  const knitUses = new Map<string, number>();
  const shirtUses = new Map<string, number>();
  const bottomUses = new Map<string, number>();
  const shoeUses = new Map<string, number>();
  const MAX_SAME_KNIT_LOOKS = 2;
  // Same rule as knits: the one accent shirt on three of six looks is a uniform.
  const MAX_SAME_SHIRT_LOOKS = 2;
  const topUsesOf = (t: string) => (knitUses.get(t) ?? 0) + (shirtUses.get(t) ?? 0);
  const shirtAtCap = (t: string) =>
    shirtsAll.includes(t) && (shirtUses.get(t) ?? 0) >= MAX_SAME_SHIRT_LOOKS;
  const knitAtCap = (t: string) =>
    knits.includes(t) && (knitUses.get(t) ?? 0) >= MAX_SAME_KNIT_LOOKS;
  const MAX_SAME_BOTTOM_LOOKS = 2;
  const MAX_SAME_SHOE_LOOKS = 2;
  const isLightBottom = (title: string): boolean =>
    isLightBottomPiece(title, colorByTitle, palette);
  const jacketUses = new Map<string, number>();
  const MAX_SAME_JACKET_LOOKS = 2;
  const casualComboKeys = new Set<string>();
  const casualBottoms = new Set<string>();
  const freshJackets = (pool: string[]) =>
    pool.filter((l) => (jacketUses.get(l) ?? 0) < MAX_SAME_JACKET_LOOKS);
  const pickBottom = (
    key: string,
    pool: string[],
    preferDark: boolean,
  ): string | undefined => {
    const clean = pool.filter(Boolean);
    if (!clean.length) return undefined;
    const fresh = clean.filter(
      (t) => (bottomUses.get(t) ?? 0) < MAX_SAME_BOTTOM_LOOKS,
    );
    if (preferDark) {
      const freshDark = fresh.filter((t) => !isLightBottom(t));
      if (freshDark.length) return rot(key, freshDark);
      const allDark = clean.filter((t) => !isLightBottom(t));
      if (allDark.length) return rot(key, allDark);
    }
    if (fresh.length) return rot(key, fresh);
    const dark = clean.filter((t) => !isLightBottom(t));
    if (dark.length) return rot(key, dark);
    return rot(key, clean);
  };
  const loafers = formalPool.filter(isLoaferTitle);
  const laceDress = formalPool.filter((s) => !isLoaferTitle(s));
  const pickShoe = (
    context: string,
    kind: OutfitSlot["shoe"],
  ): string | undefined => {
    const fresh = (pool: string[]) =>
      pool.filter((s) => (shoeUses.get(s) ?? 0) < MAX_SAME_SHOE_LOOKS);
    if (kind === "sneaker") {
      const freshSneakers = fresh(casualPool);
      if (freshSneakers.length) return rot("sneaker", freshSneakers);
      const freshLeather = fresh(formalPool);
      if (freshLeather.length) return rot("dress", freshLeather);
      return rot("sneaker", casualPool);
    }
    // Chinos + lace-up oxfords without a jacket read as a half-suit.
    // Reuse the loafer even past the mix-and-match cap.
    if (kind === "loafer") {
      if (loafers.length) {
        const freshLoafers = fresh(loafers);
        return rot("loafer", freshLoafers.length ? freshLoafers : loafers);
      }
      if (!FORMAL_CONTEXTS.has(context) && casualPool.length) {
        const freshCasual = fresh(casualPool);
        return rot("sneaker", freshCasual.length ? freshCasual : casualPool);
      }
    }
    const preferred =
      kind === "loafer"
        ? [...loafers, ...laceDress]
        : [...laceDress, ...loafers];
    const freshPreferred = fresh(preferred);
    if (freshPreferred.length) {
      return rot(kind === "loafer" ? "loafer" : "dress", freshPreferred);
    }
    // Formal contexts keep closed leather even if the pair is reused — sneakers
    // on Dinner / On stage / a client meeting read as the wrong register.
    if (!FORMAL_CONTEXTS.has(context)) {
      const freshCasual = fresh(casualPool);
      if (freshCasual.length) return rot("sneaker", freshCasual);
    }
    return rot(kind === "loafer" ? "loafer" : "dress", preferred);
  };
  for (const context of contexts) {
    const slot = CAPSULE_RECIPES[context] ?? DEFAULT_CAPSULE_SLOT;
    const pieces: string[] = [];

    // Track whether the look actually wears a TAILORED jacket — a formal context,
    // or a casual one that fell back to a blazer worn open (no casual outerwear in
    // the wardrobe). This drives the top choice below.
    let wearingJacket = false;
    if (slot.layer === "formal") {
      // Formal contexts keep the suit jacket even after the mix-and-match cap —
      // dropping Dinner because Client already used the only blazer twice is
      // how one navy suit collapsed into three identical photos.
      const l =
        rot("formalLayer", freshJackets(formalLayers)) ?? formalLayers[0];
      if (l) {
        pieces.push(l);
        wearingJacket = true;
      }
    } else if (slot.layer === "casual") {
      // Fall back to a formal layer (worn open) so a casual look isn't left
      // thin — better an unstructured blazer than no layer at all.
      let l = rot("casualLayer", freshJackets(casualLayers));
      if (!l) {
        l = rot("casualLayerAlt", freshJackets(formalLayers));
        if (l) wearingJacket = true; // the fallback is a tailored blazer
      }
      if (l) pieces.push(l);
    }

    // Under a tailored jacket a SHIRT is the classic default and a fine knit the
    // variation. Alternate ONLY the loosely-specified jacket looks (recipe top of
    // tee / any) so a blazer is never uniformly a jumper nor uniformly a shirt.
    // An explicit `shirt`, `polo`, or `knit` recipe (Dinner is knit-under-jacket)
    // stays that silhouette.
    let topKind = slot.top;
    const alternatesUnderJacket =
      slot.top !== "shirt" && slot.top !== "polo" && slot.top !== "knit";
    if (wearingJacket && dressShirts.length && alternatesUnderJacket) {
      if (!knits.length) topKind = "shirt";
      else {
        const n = counts.get("jacketTop") ?? 0;
        counts.set("jacketTop", n + 1);
        topKind = n % 2 === 0 ? "shirt" : "knit"; // shirt-first, then alternate
      }
    }

    // For formal / jacket looks prefer a PLAIN knit (argyle & co. read casual).
    const preferPlainKnit =
      topKind === "knit" &&
      (wearingJacket || FORMAL_CONTEXTS.has(context)) &&
      plainKnits.length > 0;
    let top = preferPlainKnit ? rot("plainKnit", plainKnits) : topFor(topKind);
    // One knit can mix-and-match, but the same jumper on 3+ looks reads as a
    // uniform — fall back to a shirt once it has been used twice.
    if (
      top &&
      knits.includes(top) &&
      (knitUses.get(top) ?? 0) >= MAX_SAME_KNIT_LOOKS &&
      slot.top !== "knit"
    ) {
      const shirt = topFor("shirt");
      top = shirt && shirt !== top ? shirt : undefined;
      if (top) topKind = "shirt";
    }
    const topIndex = top ? pieces.push(top) - 1 : -1;

    let bottom: string | undefined;
    const preferDarkBottom = FORMAL_CONTEXTS.has(context);
    if (slot.bottom === "jean" && catJeans.length) {
      bottom = rot("catJean", catJeans);
    } else if (slot.bottom === "jean" || slot.bottom === "chino") {
      const layerInLook = pieces.some(isWarmLayerWithShorts);
      const knitTop = topKind === "knit";
      const chinoPool = catChinos.length
        ? catChinos
        : catOtherTrousers.length
          ? catOtherTrousers
          : catTrousers;
      if (chinoPool.length) {
        bottom = pickBottom("catChino", chinoPool, preferDarkBottom);
      } else if (!layerInLook && !knitTop && catShorts.length) {
        bottom = rot("catShorts", catShorts);
      } else {
        bottom = chinoBasic;
        markOwned(chinoBasic);
      }
    } else {
      // Dress slot: full-length tailored trousers only — never shorts or
      // drawstring joggers under a blazer (reads as a tracksuit).
      const dressPool = catDressTrousers;
      if (dressPool.length) {
        bottom = pickBottom("trousers", dressPool, preferDarkBottom);
      } else {
        bottom = chinoBasic;
        markOwned(chinoBasic);
      }
    }
    if (
      wearingJacket &&
      bottom &&
      (isShortsTitle(bottom) || isDrawstringTitle(bottom))
    ) {
      const tailored =
        catDressTrousers.find((t) => t !== bottom) ??
        catTrousers.find(
          (t) => !isDrawstringTitle(t) && !isShortsTitle(t) && t !== bottom,
        );
      if (tailored) bottom = tailored;
      else {
        bottom = chinoBasic;
        markOwned(chinoBasic);
      }
    }
    const bottomIndex = bottom ? pieces.push(bottom) - 1 : -1;

    // Footwear last — the image prompt derives its footwear directive from it.
    let shoe = pickShoe(context, slot.shoe);
    const shoeIndex = shoe ? pieces.push(shoe) - 1 : -1;
    if (
      !FORMAL_CONTEXTS.has(context) &&
      bottom &&
      shoe &&
      casualComboKeys.has(`${bottom}|${shoe}`)
    ) {
      const keepJean = slot.bottom === "jean" && isJeanTitle(bottom);
      const keepChino = slot.bottom === "chino" && /\bchinos?\b/i.test(bottom);
      if (!keepJean && !keepChino) {
        const otherBottom = [
          ...catTrousers.filter((t) => !isJeanTitle(t)),
          chinoBasic,
        ].find((t) => t !== bottom && !casualComboKeys.has(`${t}|${shoe}`));
        if (otherBottom && bottomIndex >= 0) {
          if (otherBottom === chinoBasic) markOwned(otherBottom);
          pieces[bottomIndex] = otherBottom;
          bottom = otherBottom;
        } else {
          const otherShoe = [...casualPool, ...formalPool].find(
            (s) => s !== shoe && !casualComboKeys.has(`${bottom}|${s}`),
          );
          if (otherShoe && shoeIndex >= 0) {
            pieces[shoeIndex] = otherShoe;
            shoe = otherShoe;
          }
        }
      }
    }

    // Enforce one-accent harmony: if the look carries more than one accent
    // (excluding footwear, whose leather tones read as neutral), swap the
    // near-the-face top for a neutral catalogue alternative when one exists.
    const accentCount = () =>
      pieces.filter((p, idx) => idx !== shoeIndex && !isNeutralPiece(p)).length;
    if (topIndex >= 0 && accentCount() > 1 && !isNeutralPiece(pieces[topIndex])) {
      const [, pool] = poolForTop(topKind);
      const neutralAlt = pool.find(
        (t) => isNeutralPiece(t) && !pieces.includes(t),
      );
      if (neutralAlt) pieces[topIndex] = neutralAlt;
    }

    // The opposite failure — an ALL-neutral look (no accent at all) — reads flat
    // and monochrome (e.g. beige knit over beige trousers, washing out the face).
    // If the top's pool offers a palette accent (deeper / more saturated), swap it
    // in so the look gains one point of depth right at the face.
    if (topIndex >= 0 && accentCount() === 0) {
      const [, pool] = poolForTop(topKind);
      // Least-worn accent first, and never one already at its cap — the
      // fallback must not quietly put the same pink shirt on a third look.
      const accentAlt = pool
        .filter(
          (t) =>
            !isNeutralPiece(t) &&
            !pieces.includes(t) &&
            !(knits.includes(t) && (knitUses.get(t) ?? 0) >= MAX_SAME_KNIT_LOOKS) &&
            !shirtAtCap(t),
        )
        .sort((a, b) => topUsesOf(a) - topUsesOf(b))[0];
      if (accentAlt) pieces[topIndex] = accentAlt;
    }

    // Grey shirt + grey trousers read as one column. Apply after accent swaps
    // so a harmony pass cannot reintroduce the same-grey pair.
    if (
      topIndex >= 0 &&
      bottomIndex >= 0 &&
      capsuleColumnBlends(pieces[topIndex]!, pieces[bottomIndex]!, colorByTitle, palette)
    ) {
      const [, topPool] = poolForTop(topKind);
      const topAlt = topPool.find(
        (t) =>
          !pieces.includes(t) &&
          !capsuleColumnBlends(t, pieces[bottomIndex]!, colorByTitle, palette),
      );
      const lockedBottom =
        (slot.bottom === "chino" && /\bchinos?\b/i.test(pieces[bottomIndex]!)) ||
        (slot.bottom === "jean" && isJeanTitle(pieces[bottomIndex]!));
      if (topAlt) {
        pieces[topIndex] = topAlt;
      } else if (!lockedBottom) {
        const shoeForCombo = shoeIndex >= 0 ? pieces[shoeIndex] : undefined;
        const bottomAlts = [
          ...catOtherTrousers,
          ...catTrousers,
          ...catChinos,
          chinoBasic,
        ];
        const unusedAlt = bottomAlts.find(
          (t) =>
            t !== pieces[bottomIndex] &&
            !capsuleColumnBlends(pieces[topIndex]!, t, colorByTitle, palette) &&
            !(shoeForCombo && casualComboKeys.has(`${t}|${shoeForCombo}`)),
        );
        const bottomAlt =
          unusedAlt ??
          bottomAlts.find(
            (t) =>
              t !== pieces[bottomIndex] &&
              !capsuleColumnBlends(pieces[topIndex]!, t, colorByTitle, palette),
          );
        if (bottomAlt) {
          if (bottomAlt === jeanBasic || bottomAlt === chinoBasic) markOwned(bottomAlt);
          pieces[bottomIndex] = bottomAlt;
        }
      } else {
        const shirtAlt = [...dressShirts, ...anyTop].find(
          (t) =>
            !pieces.includes(t) &&
            !capsuleColumnBlends(t, pieces[bottomIndex]!, colorByTitle, palette),
        );
        if (shirtAlt) pieces[topIndex] = shirtAlt;
      }
    }

    const jacketInLook = pieces.find(isJacketTitle);
    const darkShoe =
      [...formalPool, ...casualPool].find(
        (s) =>
          isDarkAnchorPiece(s, colorByTitle, palette) &&
          !(jacketInLook && jacketClonesShoes(jacketInLook, s, colorByTitle)),
      ) ?? basics.shoes[0];
    const darkBottom =
      [...catOtherTrousers, ...catTrousers].find((t) =>
        isDarkAnchorPiece(t, colorByTitle, palette),
      ) ?? "Navy trousers";
    const harmonized = sanitizeLookHarmony(pieces, colorByTitle, {
      shoes: [...formalPool, ...casualPool],
      bottoms: [
        ...catOtherTrousers,
        ...catTrousers,
        ...catChinos,
        chinoBasic,
      ],
      assumedDarkShoe: darkShoe,
      assumedDarkBottom: darkBottom,
      allowCasualShoeSwap: !FORMAL_CONTEXTS.has(context),
      best: palette,
      keepBottom:
        (slot.bottom === "chino" &&
          pieces.some((p) => /\bchinos?\b/i.test(p))) ||
        (slot.bottom === "jean" && pieces.some((p) => isJeanTitle(p))),
    });
    if (harmonized.join("|") !== pieces.join("|")) {
      pieces.length = 0;
      pieces.push(...harmonized);
      for (const p of harmonized) {
        if (
          basics.casualShoes.includes(p) ||
          basics.shoes.includes(p) ||
          basics.bottoms.includes(p) ||
          p === darkBottom
        ) {
          markOwned(p);
        }
      }
    }

    const cleaned = sanitizeShortsOutfit(pieces, {
      shirts: dressShirts,
      casualShoes: casualPool,
      assumedSneaker: basics.casualShoes[0],
    });
    if (cleaned !== pieces) {
      pieces.length = 0;
      pieces.push(...cleaned);
      for (const p of cleaned) {
        if (basics.casualShoes.includes(p) || basics.bottoms.includes(p)) markOwned(p);
      }
    }

    const topIdxNow = pieces.findIndex(
      (t) =>
        !isJacketTitle(t) &&
        !isShoeTitle(t) &&
        !isAccentOnlyTitle(t) &&
        !isBottomTitle(t),
    );
    const bottomIdxNow = pieces.findIndex((p) => isBottomTitle(p));
    if (
      FORMAL_CONTEXTS.has(context) &&
      topIdxNow >= 0 &&
      bottomIdxNow >= 0 &&
      isDarkAnchorPiece(pieces[topIdxNow]!, colorByTitle, palette) &&
      isDarkAnchorPiece(pieces[bottomIdxNow]!, colorByTitle, palette)
    ) {
      const lighterOk = (t: string) =>
        t !== pieces[topIdxNow] &&
        !pieces.includes(t) &&
        !isDarkAnchorPiece(t, colorByTitle, palette);
      const lighterPool = [...dressShirts, ...plainKnits, ...anyTop];
      // Under the caps first — a swap here must not turn one shirt into a uniform.
      const lighter =
        lighterPool.find((t) => lighterOk(t) && !shirtAtCap(t) && !knitAtCap(t)) ??
        lighterPool.find(lighterOk);
      if (lighter) pieces[topIdxNow] = lighter;
    }
    const winterJacket = pieces.find(
      (p) => isJacketTitle(p) && isWinterLayerTitle(p),
    );
    const summerShirt = pieces.find((p) => isCasualSummerShirtTitle(p));
    if (winterJacket && summerShirt) {
      const altOk = (t: string) => !isCasualSummerShirtTitle(t) && !pieces.includes(t);
      const altShirt =
        dressShirts.find((t) => altOk(t) && !shirtAtCap(t)) ?? dressShirts.find(altOk);
      if (altShirt) {
        const sIdx = pieces.indexOf(summerShirt);
        if (sIdx >= 0) pieces[sIdx] = altShirt;
      }
    }

    if (!pieces.length) continue;
    if (!FORMAL_CONTEXTS.has(context)) {
      const shoeHere = pieces.find(isShoeTitle);
      const topHere = topIndex >= 0 ? pieces[topIndex] : undefined;
      const bIdx = pieces.findIndex((p) => isBottomTitle(p));
      const bottomHere = bIdx >= 0 ? pieces[bIdx] : undefined;
      const reusedCasual =
        Boolean(bottomHere) &&
        (casualBottoms.has(bottomHere!) ||
          Boolean(
            shoeHere && casualComboKeys.has(`${bottomHere}|${shoeHere}`),
          ));
      if (reusedCasual && bIdx >= 0) {
        const keepJean =
          slot.bottom === "jean" && isJeanTitle(pieces[bIdx]!);
        const keepChino =
          slot.bottom === "chino" && /\bchinos?\b/i.test(pieces[bIdx]!);
        const altBottom = keepJean || keepChino
          ? undefined
          : [...catTrousers.filter((t) => !isJeanTitle(t)), chinoBasic].find((t) => {
          if (t === pieces[bIdx]) return false;
          if (casualBottoms.has(t)) return false;
          if (shoeHere && casualComboKeys.has(`${t}|${shoeHere}`)) return false;
          if (
            topHere &&
            capsuleColumnBlends(topHere, t, colorByTitle, palette) &&
            // Assumed jeans have no swatch; denim still reads as a different
            // silhouette from cream / navy catalogue trousers.
            !(
              /\bjeans?\b/i.test(t) &&
              !colorByTitle.has(t)
            )
          ) {
            return false;
          }
          const trial = pieces.map((p, i) => (i === bIdx ? t : p));
          return !seen.has(trial.join("|").toLowerCase());
        });
        if (altBottom) {
          pieces[bIdx] = altBottom;
          if (altBottom === jeanBasic || altBottom === chinoBasic) {
            markOwned(altBottom);
          }
        }
      }
    }
    const shoeAt = pieces.findIndex(isShoeTitle);
    if (shoeAt >= 0) {
      const currentShoe = pieces[shoeAt]!;
      const intendedPool =
        slot.shoe === "sneaker"
          ? casualPool
          : slot.shoe === "loafer"
            ? loafers.length
              ? loafers
              : laceDress
            : [...laceDress, ...loafers];
      const matchesRole =
        slot.shoe === "sneaker"
          ? SNEAKER_RE.test(currentShoe)
          : slot.shoe === "loafer"
            ? isLoaferTitle(currentShoe)
            : !SNEAKER_RE.test(currentShoe) && !isLoaferTitle(currentShoe);
      if (!matchesRole) {
        const shortsHere = pieces.some(isShortsTitle);
        const restore =
          intendedPool.find((s) => {
            if ((shoeUses.get(s) ?? 0) >= MAX_SAME_SHOE_LOOKS) return false;
            if (slot.shoe === "dress" && isLoaferTitle(s)) return false;
            if (shortsHere && isClassicShoeWithShorts(s)) return false;
            return true;
          }) ??
          (shortsHere
            ? casualPool[0]
            : slot.shoe === "dress"
              ? laceDress[0] ?? intendedPool[0]
              : intendedPool[0]);
        if (restore) pieces[shoeAt] = restore;
      }
    }
    const chinoHere = pieces.some((p) => /\bchinos?\b/i.test(p));
    const tailoredHere = pieces.some(
      (p) => isJacketTitle(p) && !CASUAL_OUTERWEAR_RE.test(p),
    );
    const shoeNow = pieces.find(isShoeTitle);
    if (
      chinoHere &&
      !tailoredHere &&
      shoeNow &&
      !isLoaferTitle(shoeNow) &&
      !SNEAKER_RE.test(shoeNow)
    ) {
      const sIdx = pieces.indexOf(shoeNow);
      const casualShoe = loafers[0] ?? casualPool[0];
      if (sIdx >= 0 && casualShoe) pieces[sIdx] = casualShoe;
    }
    const belts = pick(["Accessories"]).filter(isBeltTitle);
    if (
      belts[0] &&
      !pieces.some(isShortsTitle) &&
      !pieces.some(isBeltTitle) &&
      pieces.some(isBottomTitle) &&
      pieces.some((p) => isShoeTitle(p) && !SNEAKER_RE.test(p))
    ) {
      pieces.push(belts[0]!);
    }
    const comboKey = (ps: string[]) => ps.join("|").toLowerCase();
    const tryUnseen = (next: string[]): boolean => {
      if (!next.length || seen.has(comboKey(next))) return false;
      pieces.length = 0;
      pieces.push(...next);
      return true;
    };
    if (seen.has(comboKey(pieces))) {
      const topIdx = pieces.findIndex(
        (t) =>
          !isJacketTitle(t) &&
          !isShoeTitle(t) &&
          !isAccentOnlyTitle(t) &&
          !isBottomTitle(t),
      );
      const bottomIdx = pieces.findIndex((p) => isBottomTitle(p));
      if (
        slot.layer === "formal" &&
        formalLayers[0] &&
        !pieces.some((p) => isJacketTitle(p))
      ) {
        tryUnseen([formalLayers[0]!, ...pieces]);
      }
      if (seen.has(comboKey(pieces)) && topIdx >= 0) {
        const altOk = (t: string) => t !== pieces[topIdx] && !pieces.includes(t);
        // The de-dupe swap was how one shirt reached a third outfit: prefer a
        // shirt still under its cap, fall back to any other shirt.
        const altShirt =
          dressShirts.find((t) => altOk(t) && !shirtAtCap(t)) ?? dressShirts.find(altOk);
        if (altShirt) {
          tryUnseen(pieces.map((p, i) => (i === topIdx ? altShirt : p)));
        }
      }
      if (
        seen.has(comboKey(pieces)) &&
        topIdx >= 0 &&
        (slot.top === "knit" || context === "Dinner") &&
        knits.length
      ) {
        const altKnit =
          knits.find((t) => !pieces.includes(t) && !knitAtCap(t)) ??
          knits.find((t) => !pieces.includes(t)) ??
          knits[0];
        if (altKnit && altKnit !== pieces[topIdx]) {
          tryUnseen(pieces.map((p, i) => (i === topIdx ? altKnit : p)));
        }
      }
      if (seen.has(comboKey(pieces)) && bottomIdx >= 0) {
        const lockedBottom =
          (slot.bottom === "chino" &&
            /\bchinos?\b/i.test(pieces[bottomIdx]!)) ||
          (slot.bottom === "jean" && isJeanTitle(pieces[bottomIdx]!));
        const topForBlend = topIdx >= 0 ? pieces[topIdx] : undefined;
        const altBottom = lockedBottom
          ? undefined
          : [
              ...catDressTrousers,
              ...catChinos,
              ...catTrousers,
            ].find(
              (t) =>
                t !== pieces[bottomIdx] &&
                !pieces.includes(t) &&
                !(
                  topForBlend &&
                  capsuleColumnBlends(topForBlend, t, colorByTitle, palette)
                ),
            );
        if (altBottom) {
          tryUnseen(pieces.map((p, i) => (i === bottomIdx ? altBottom : p)));
        }
      }
      if (
        seen.has(comboKey(pieces)) &&
        topIdx >= 0 &&
        knits.length &&
        ((slot.bottom === "chino" &&
          pieces.some((p) => /\bchinos?\b/i.test(p))) ||
          (slot.bottom === "jean" && pieces.some((p) => isJeanTitle(p))))
      ) {
        const unusedKnit = knits.find(
          (t) =>
            !pieces.includes(t) &&
            (knitUses.get(t) ?? 0) < MAX_SAME_KNIT_LOOKS,
        );
        if (unusedKnit && unusedKnit !== pieces[topIdx]) {
          tryUnseen(pieces.map((p, i) => (i === topIdx ? unusedKnit : p)));
        }
      }
      if (seen.has(comboKey(pieces))) continue;
    }
    // Hard guarantee: no top / bottom column leaves the matrix. Every pass
    // above is best-effort and the dedupe swaps can reintroduce one; here the
    // caps no longer matter — another bottom (denim basic included), then
    // another top, and if the capsule truly has nothing else, no outfit at all
    // rather than grey on grey.
    {
      const tIdx = pieces.findIndex(
        (t) =>
          !isJacketTitle(t) &&
          !isShoeTitle(t) &&
          !isAccentOnlyTitle(t) &&
          !isBottomTitle(t),
      );
      const bIdx = pieces.findIndex((p) => isBottomTitle(p));
      const blendsHere = (top: string, bottom: string) =>
        capsuleColumnBlends(top, bottom, colorByTitle, palette) &&
        // Assumed denim has no swatch and reads as its own texture.
        !(isJeanTitle(bottom) && !colorByTitle.has(bottom));
      if (tIdx >= 0 && bIdx >= 0 && blendsHere(pieces[tIdx]!, pieces[bIdx]!)) {
        const trial = (idx: number, t: string) => pieces.map((p, i) => (i === idx ? t : p));
        const unseenTop = (t: string) =>
          !pieces.includes(t) &&
          !blendsHere(t, pieces[bIdx]!) &&
          !seen.has(comboKey(trial(tIdx, t)));
        const unseenBottom = (t: string) =>
          t !== pieces[bIdx] &&
          !isShortsTitle(t) &&
          !blendsHere(pieces[tIdx]!, t) &&
          !seen.has(comboKey(trial(bIdx, t)));
        // Under a jacket only tailored trousers (never drawstring); a chino or
        // jean recipe keeps its own kind first; a dark assumed basic is the
        // last real option before the outfit is dropped.
        const jacketHere = pieces.some(isJacketTitle);
        const bottomCands = (
          jacketHere
            ? [...catDressTrousers, darkBottom, chinoBasic]
            : slot.bottom === "chino"
              ? [...catChinos, ...catDressTrousers, jeanBasic, chinoBasic, darkBottom]
              : slot.bottom === "jean"
                ? [...catJeans, jeanBasic, ...catChinos, ...catDressTrousers, darkBottom]
                : [...catDressTrousers, ...catChinos, darkBottom, jeanBasic, chinoBasic]
        ).filter((t, i, arr) => t && arr.indexOf(t) === i);
        // A chino / jean recipe tries another top before giving up its bottom.
        const lockedBottom =
          (slot.bottom === "chino" && /\bchinos?\b/i.test(pieces[bIdx]!)) ||
          (slot.bottom === "jean" && isJeanTitle(pieces[bIdx]!));
        const okTopFirst = lockedBottom ? anyTop.find(unseenTop) : undefined;
        if (okTopFirst) {
          pieces[tIdx] = okTopFirst;
        } else {
          const okBottom = bottomCands.find(unseenBottom);
          if (okBottom) {
            if (okBottom === jeanBasic || okBottom === chinoBasic || okBottom === darkBottom) {
              markOwned(okBottom);
            }
            pieces[bIdx] = okBottom;
          } else {
            const okTop = anyTop.find(unseenTop);
            if (okTop) pieces[tIdx] = okTop;
            else continue;
          }
        }
      }
    }
    seen.add(comboKey(pieces));
    const finalBottom = pieces.find((p) => isBottomTitle(p));
    const finalShoe = pieces.find(isShoeTitle);
    if (!FORMAL_CONTEXTS.has(context) && finalBottom && finalShoe) {
      casualComboKeys.add(`${finalBottom}|${finalShoe}`);
      casualBottoms.add(finalBottom);
    }
    for (const p of pieces) {
      if (knits.includes(p)) {
        knitUses.set(p, (knitUses.get(p) ?? 0) + 1);
      }
      if (shirtsAll.includes(p)) {
        shirtUses.set(p, (shirtUses.get(p) ?? 0) + 1);
      }
      if (layers.includes(p)) {
        jacketUses.set(p, (jacketUses.get(p) ?? 0) + 1);
      }
      if (
        catTrousersAll.includes(p) ||
        catTrousers.includes(p) ||
        p === jeanBasic ||
        p === chinoBasic
      ) {
        bottomUses.set(p, (bottomUses.get(p) ?? 0) + 1);
      }
      if (
        formalPool.includes(p) ||
        casualPool.includes(p) ||
        basics.shoes.includes(p) ||
        basics.casualShoes.includes(p)
      ) {
        shoeUses.set(p, (shoeUses.get(p) ?? 0) + 1);
      }
    }
    const ownedHere = pieces.filter((p) => owned.has(p));
    combos.push({
      context,
      pieces,
      ...(ownedHere.length ? { owned: ownedHere } : {}),
    });
  }
  return combos;
}

const TIER_CATEGORIES = ["Outerwear", "Trousers", "Knitwear", "Footwear"];

export function priceTiersFrom(shopping: ShoppingItem[]): PriceTier[] {
  const round5 = (n: number) => Math.round(n / 5) * 5;
  const tiers: PriceTier[] = [];
  for (const cat of TIER_CATEGORIES) {
    const prices = shopping
      .filter((i) => i.category === cat)
      .map((i) => Number(i.priceEur ?? 0))
      .filter((p) => Number.isFinite(p) && p > 0)
      .sort((a, b) => a - b);
    if (!prices.length) continue;
    // Two or more picks in the category: the tiers ARE the picks (cheapest /
    // middle / dearest), so the table never contradicts the list beside it.
    // A single pick keeps the ±band around it.
    // Two picks: the middle tier is their midpoint, never a copy of "best".
    const mid =
      prices.length === 2
        ? round5((prices[0]! + prices[1]!) / 2)
        : prices[Math.floor(prices.length / 2)]!;
    const good = prices.length >= 2 ? prices[0]! : round5(mid * 0.55);
    const best = prices.length >= 2 ? prices[prices.length - 1]! : round5(mid * 2.2);
    tiers.push({
      category: cat,
      good,
      better: mid,
      best,
      note:
        cat === "Footwear"
          ? "Spend up here — good leather outlasts three cheap pairs."
          : cat === "Outerwear"
            ? "Your highest-impact buy; invest if you stretch anywhere."
            : "Mid-tier is the sweet spot for fit and fabric.",
    });
  }
  return tiers;
}

/**
 * Choose the single "invest in this" hero piece. Weights archetype fit ahead of
 * category priority (so a trend-forward layer never becomes the headline), then
 * nudges towards the pricier, more investment-grade end of the qualifying pool
 * so the "invest" copy isn't attached to a €25 fast-fashion tee.
 */
export function pickHero(
  shopping: ShoppingItem[],
  boldness: string,
): ShoppingItem | undefined {
  if (!shopping.length) return undefined;
  const prices = shopping.map((i) => i.priceEur ?? 0);
  const maxPrice = Math.max(1, ...prices);
  const hasTailored = shopping.some(
    (i) =>
      i.category === "Outerwear" && !CASUAL_OUTERWEAR_RE.test(i.title),
  );
  const weight = (i: ShoppingItem) =>
    -styleFitScore(i.title, boldness) * SCORING.hero.fitWeight +
    (CATEGORY_PRIORITY[i.category] ?? 9) -
    ((i.priceEur ?? 0) / maxPrice) * SCORING.hero.priceWeight +
    (hasTailored && CASUAL_OUTERWEAR_RE.test(i.title) ? 3 : 0);
  return [...shopping].sort((a, b) => weight(a) - weight(b))[0];
}
