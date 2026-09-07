/**
 * Looks as garments: decomposing a look description into garment slots,
 * scoring catalogue titles against them, the style-fit scoring and the
 * harmony sanitisers (no grey column, no jacket cloning the shoes).
 */
import type { ColorRec } from "@/lib/report";
import { type StyleProfile } from "@/lib/style-profile";

import {
  COLOR_WORDS,
  hueDist,
  isDarkAnchorPiece,
  isLightBottomPiece,
  isMidNeutralPiece,
  normalizeCompoundColors,
  parseHexColor,
  parseHexRgb,
  pieceHsl,
  productColorFamilies,
} from "@/lib/colour-rules";
import {
  CASUAL_FOOTWEAR_RE,
  CASUAL_OUTERWEAR_RE,
  DRAWSTRING_CLAUSE_RE,
  HOUSEHOLD_TEXTILE_RE,
  NON_BLAZER_OUTER_RE,
  SNEAKER_RE,
  TAILORED_TROUSER_TITLE_RE,
  isAccentOnlyTitle,
  isBagTitle,
  isBeltTitle,
  isBottomTitle,
  isCasualSummerShirtTitle,
  isDrawstringTitle,
  isHeavyWinterKnit,
  isJacketTitle,
  isJeanTitle,
  isLoaferTitle,
  isLongSleeveShirtTitle,
  isShoeTitle,
  isShortsTitle,
  isTieTitle,
  lc,
  DRAWSTRING_GARMENTS,
} from "@/lib/garment-title";

/** Lexical cues that a product is trend-forward / statement rather than a staple. */
const TREND_TOKENS = [
  "smock",
  "oversized",
  "boxy",
  "cropped",
  "crop top",
  "baggy",
  "parachute",
  "cargo",
  "printed",
  "print",
  "graphic",
  "logo",
  "slogan",
  "mesh",
  "sheer",
  "distressed",
  "acid wash",
  "tie-dye",
  "tie dye",
  "camo",
  "sequin",
  "metallic",
  "fringe",
  "flared",
  "bootcut",
  "parkour",
  "asymmetric",
  "patchwork",
  "shacket",
  "balloon",
  "wide-leg extreme",
  "runway",
];

/** Lexical cues of a timeless, tailored staple. */
const STAPLE_TOKENS = [
  "blazer",
  "sport coat",
  "sportcoat",
  "suit",
  "tailored",
  "trench",
  "overcoat",
  "topcoat",
  "peacoat",
  "chino",
  "oxford",
  "poplin",
  "merino",
  "cashmere",
  "lambswool",
  "crew neck",
  "crewneck",
  "roll neck",
  "polo shirt",
  "chelsea boot",
  "derby",
  "loafer",
  "cardigan",
  "overshirt",
  "gabardine",
  "flannel",
];

/**
 * Additive ranking nudge (~[-0.2, +0.06]) that aligns catalogue picks with the
 * user's boldness: conservative/moderate wardrobes down-weight trend-forward
 * pieces and favour timeless staples, while statement/experimental wardrobes get
 * a mild boost for directional pieces. Keeps a "Refined Classic" professional
 * from being handed an oversized smock as their hero piece.
 */
/** Build a case-insensitive, word-boundary matcher from a token list. */
function tokenMatcher(tokens: string[]): RegExp {
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

/** Oxfords, brogues, derbies and boots — never with shorts. Loafers/sneakers stay. */
export function isClassicShoeWithShorts(title: string): boolean {
  if (/\b(loafer|loafers|sneakers?|trainers?|sandals?|slides?|espadrilles?)\b/i.test(title)) {
    return false;
  }
  return /\b(oxfords?|brogues?|derb(?:y|ies)|chelsea|chukka|boots?|monk\s+straps?|wholecuts?|cap[\s-]?toe)\b/i.test(
    title,
  );
}

/**
 * If the outfit has shorts, drop jackets/knits/hoodies and swap oxfords,
 * brogues, derbies and boots for a casual shoe. Used by the capsule matrix
 * and tests so shorts stay a warm-weather open look.
 */
export function sanitizeShortsOutfit(
  pieces: string[],
  opts?: { shirts?: string[]; casualShoes?: string[]; assumedSneaker?: string },
): string[] {
  if (!pieces.some(isShortsTitle)) return pieces;
  const next = pieces.filter((p) => isShortsTitle(p) || !isWarmLayerWithShorts(p));
  const hasOpenTop = next.some(
    (p) =>
      !isShortsTitle(p) &&
      !isClassicShoeWithShorts(p) &&
      !SNEAKER_RE.test(p) &&
      !isWarmLayerWithShorts(p),
  );
  if (!hasOpenTop) {
    const shirt = (opts?.shirts ?? []).find((t) => !next.includes(t));
    if (shirt) next.unshift(shirt);
  }
  const shoeAt = next.findIndex(isClassicShoeWithShorts);
  if (shoeAt >= 0) {
    const casual =
      (opts?.casualShoes ?? []).find(
        (s) => !isClassicShoeWithShorts(s) && !next.includes(s),
      ) ?? opts?.assumedSneaker;
    if (casual) next[shoeAt] = casual;
  }
  return next;
}

/** Closed layers that read wrong with shorts. An open shirt, polo or tee is not a layer. */
export function isWarmLayerWithShorts(title: string): boolean {
  if (
    /\b(polos?|t-?shirts?|tees?\b|camp[\s-]?collar|oxfords?)\b/i.test(title) &&
    !/\b(sweater|jumper|hoodie|jacket|blazer|cardigan|coat)\b/i.test(title)
  ) {
    return false;
  }
  if (/\bshirts?\b/i.test(title) && !/\b(sweater|jumper|hoodie|jacket|blazer|sweatshirt)\b/i.test(title)) {
    return false;
  }
  return /\b(blazers?|sport\s+coats?|jackets?|coats?|trench|overcoat|parka|bomber|anorak|gilet|hoodie|hooded|sweatshirts?|sweaters?|jumpers?|pullovers?|cardigans?|crewnecks?|roll-?necks?|turtlenecks?|shawl)\b/i.test(
    title,
  );
}

/** True when shoes repeat a chromatic jacket — navy-on-navy formal is allowed. */
export function jacketClonesShoes(
  jacket: string,
  shoe: string,
  colorByTitle: Map<string, string>,
): boolean {
  const j = pieceHsl(jacket, colorByTitle);
  const s = pieceHsl(shoe, colorByTitle);
  if (!j || !s) {
    const jf = productColorFamilies(
      colorByTitle.get(jacket) ?? null,
      jacket,
      colorByTitle.get(jacket),
    );
    const sf = productColorFamilies(
      colorByTitle.get(shoe) ?? null,
      shoe,
      colorByTitle.get(shoe),
    );
    const shared = [...jf].some((f) => sf.has(f) && f !== "grey" && f !== "black");
    const bothDark =
      /\b(navy|charcoal|black|ink)\b/i.test(jacket) &&
      /\b(navy|charcoal|black|ink)\b/i.test(shoe);
    return shared && !bothDark;
  }
  if (j.l <= 0.36 && s.l <= 0.36) return false;
  // True greys are not a chromatic clone; muted teal-on-teal still is.
  if (j.s < 0.12 && s.s < 0.12) return false;
  return hueDist(j.h, s.h) < 30 && Math.abs(j.l - s.l) < 0.28;
}

/** Two large chromatic garments in the same hue — a second hero. */
export function chromaticHeroClash(
  a: string,
  b: string,
  colorByTitle: Map<string, string>,
): boolean {
  if (isAccentOnlyTitle(a) || isAccentOnlyTitle(b)) return false;
  const ha = pieceHsl(a, colorByTitle);
  const hb = pieceHsl(b, colorByTitle);
  if (!ha || !hb) return false;
  // A navy / charcoal suit is one garment. A sage jacket on sage trousers
  // (same mid hex, s≈0.14) is a tracksuit — catch identical swatches first.
  const hexA = parseHexColor(colorByTitle.get(a) ?? "");
  const hexB = parseHexColor(colorByTitle.get(b) ?? "");
  if (hexA && hexB && hexA === hexB && !(ha.l <= 0.32 && hb.l <= 0.32)) {
    return true;
  }
  if (ha.s < 0.1 || hb.s < 0.1) return false;
  if (ha.l <= 0.32 && hb.l <= 0.32) return false;
  return hueDist(ha.h, hb.h) < 30 && Math.abs(ha.l - hb.l) < 0.32;
}

/**
 * One chromatic hero, shoes not cloning the jacket, and a dark anchor when
 * the shirt/knit and trousers are both mid-neutrals.
 */
/** True when trousers and shoes are the same dark hue (navy-on-navy). */
export function trousersCloneShoes(
  bottom: string,
  shoe: string,
  colorByTitle: Map<string, string>,
): boolean {
  const b = pieceHsl(bottom, colorByTitle);
  const s = pieceHsl(shoe, colorByTitle);
  if (b && s) {
    // Cream trousers + white sneakers are a classic casual pair, not a clone.
    // The failure mode is navy-on-navy / charcoal-on-charcoal.
    if (b.l > 0.55 || s.l > 0.55) return false;
    return hueDist(b.h, s.h) < 30 && Math.abs(b.l - s.l) < 0.22;
  }
  return (
    /\b(navy|charcoal|black|ink)\b/i.test(bottom) &&
    /\b(navy|charcoal|black|ink)\b/i.test(shoe)
  );
}

export function sanitizeLookHarmony(
  pieces: string[],
  colorByTitle: Map<string, string>,
  opts?: {
    shoes?: string[];
    bottoms?: string[];
    assumedDarkShoe?: string;
    assumedDarkBottom?: string;
    /** Casual looks may swap a cloned dress shoe for sneakers. */
    allowCasualShoeSwap?: boolean;
    /** Keep the recipe bottom (chino / jean) — put the dark anchor on shoes. */
    keepBottom?: boolean;
    /** Report palette — anchor / mid-neutral judged by swatch role when given. */
    best?: ColorRec[];
  },
): string[] {
  const next = [...pieces];
  const jacket = next.find(isJacketTitle);
  const shoeIdx = next.findIndex(isShoeTitle);
  const bottomIdx = next.findIndex((t) => isBottomTitle(t));
  const bottomIsShorts =
    bottomIdx >= 0 && isShortsTitle(next[bottomIdx]!);
  const topIdx = next.findIndex(
    (t) =>
      !isJacketTitle(t) &&
      !isShoeTitle(t) &&
      !isAccentOnlyTitle(t) &&
      !isBottomTitle(t),
  );

  if (
    jacket &&
    shoeIdx >= 0 &&
    jacketClonesShoes(jacket, next[shoeIdx]!, colorByTitle)
  ) {
    const alt = (opts?.shoes ?? []).find(
      (s) => !next.includes(s) && !jacketClonesShoes(jacket, s, colorByTitle),
    );
    next[shoeIdx] = alt ?? opts?.assumedDarkShoe ?? next[shoeIdx]!;
  }

  if (
    !bottomIsShorts &&
    jacket &&
    bottomIdx >= 0 &&
    chromaticHeroClash(jacket, next[bottomIdx]!, colorByTitle)
  ) {
    const alt = (opts?.bottoms ?? []).find(
      (b) =>
        b !== next[bottomIdx] &&
        !chromaticHeroClash(jacket, b, colorByTitle),
    );
    next[bottomIdx] =
      alt ??
      (opts?.assumedDarkBottom &&
      !chromaticHeroClash(jacket, opts.assumedDarkBottom, colorByTitle)
        ? opts.assumedDarkBottom
        : next[bottomIdx]!);
  } else if (
    !bottomIsShorts &&
    !opts?.keepBottom &&
    topIdx >= 0 &&
    bottomIdx >= 0 &&
    chromaticHeroClash(next[topIdx]!, next[bottomIdx]!, colorByTitle)
  ) {
    const alt = (opts?.bottoms ?? []).find(
      (b) =>
        b !== next[bottomIdx] &&
        !chromaticHeroClash(next[topIdx]!, b, colorByTitle),
    );
    next[bottomIdx] =
      alt ??
      (opts?.assumedDarkBottom &&
      !chromaticHeroClash(next[topIdx]!, opts.assumedDarkBottom, colorByTitle)
        ? opts.assumedDarkBottom
        : next[bottomIdx]!);
  }

  const hasDark = next.some((p) => isDarkAnchorPiece(p, colorByTitle, opts?.best));
  if (
    !hasDark &&
    topIdx >= 0 &&
    bottomIdx >= 0 &&
    isMidNeutralPiece(next[topIdx]!, colorByTitle, opts?.best) &&
    isMidNeutralPiece(next[bottomIdx]!, colorByTitle, opts?.best)
  ) {
    const shoeIsSneaker = shoeIdx >= 0 && SNEAKER_RE.test(next[shoeIdx]!);
    const darkBottom = (opts?.bottoms ?? []).find((b) =>
      isDarkAnchorPiece(b, colorByTitle, opts?.best),
    );
    // Weekend / outdoors sneakers must stay sneakers — put the dark anchor
    // on the trousers instead of swapping in a derby.
    if (bottomIsShorts) {
      // Shorts already forbid a derby — don't "fix" a mid-neutral column with one.
    } else if (opts?.keepBottom && shoeIdx >= 0 && opts?.assumedDarkShoe) {
      next[shoeIdx] = opts.assumedDarkShoe;
    } else if (shoeIsSneaker && darkBottom) {
      next[bottomIdx] = darkBottom;
    } else if (shoeIdx >= 0 && opts?.assumedDarkShoe) {
      next[shoeIdx] = opts.assumedDarkShoe;
    } else if (darkBottom) {
      next[bottomIdx] = darkBottom;
    } else if (opts?.assumedDarkBottom) {
      next[bottomIdx] = opts.assumedDarkBottom;
    }
  }

  if (
    !bottomIsShorts &&
    shoeIdx >= 0 &&
    bottomIdx >= 0 &&
    trousersCloneShoes(next[bottomIdx]!, next[shoeIdx]!, colorByTitle)
  ) {
    const alt = (opts?.shoes ?? []).find(
      (s) =>
        s !== next[shoeIdx] &&
        !trousersCloneShoes(next[bottomIdx]!, s, colorByTitle) &&
        (opts?.allowCasualShoeSwap || !SNEAKER_RE.test(s)),
    );
    if (alt) next[shoeIdx] = alt;
    else if (opts?.allowCasualShoeSwap) {
      const sneaker = (opts?.shoes ?? []).find((s) => SNEAKER_RE.test(s));
      if (sneaker) next[shoeIdx] = sneaker;
    }
  }

  return next;
}

/**
 * Loud, gimmicky cues that read cheap or juvenile *regardless* of how bold the
 * wardrobe is — slogan/graphic tees, ripped denim, tie-dye, sequins. Even a
 * "statement" client is better served by well-cut directional pieces than by
 * novelty prints, so these are demoted for everyone (just less for bold ones).
 */
const GIMMICK_TOKENS = [
  "slogan",
  "graphic",
  "logo",
  "printed",
  "print",
  "ripped",
  "distressed",
  "acid wash",
  "tie-dye",
  "tie dye",
  "sequin",
];

/** Athleisure / loungewear cues that undercut a "polished" or "elevated" brief. */
const ATHLEISURE_RE =
  /\b(joggers?|sweat\s?pants?|track\s?pants?|tracksuit|balloon\s?fit|jogger\s?shorts?|drawstring\s?shorts?)\b/i;

// Compiled once — word-boundary matching avoids false hits like "blueprint"
// (print) or "camomile" (camo) that the old substring `.includes` produced.
const TREND_RE = tokenMatcher(TREND_TOKENS);

const STAPLE_RE = tokenMatcher(STAPLE_TOKENS);

const GIMMICK_RE = tokenMatcher(GIMMICK_TOKENS);

/**
 * All tunable ranking weights in one place so the scoring is easy to reason
 * about and adjust. Positive = better fit for the archetype. `bold` covers the
 * statement/experimental wardrobes; `conservative` and `other` (moderate) cover
 * the polished end. `heroPriceWeight`/`heroFitWeight` scale the hero selection.
 */
export const SCORING = {
  trend: { bold: +0.06, conservative: -0.2, other: -0.12 },
  gimmick: { bold: -0.1, conservative: -0.22, other: -0.14 },
  athleisure: { bold: -0.08, conservative: -0.2, other: -0.12 },
  casualShoe: { conservative: -0.18, other: -0.1 },
  casualOuter: { conservative: -0.18, other: -0.1 },
  staple: { bold: +0.02, other: +0.05 },
  hero: { fitWeight: 10, priceWeight: 1.2 },
} as const;

/** Whether a boldness value is a trend-tolerant (statement/experimental) wardrobe. */
export function isBoldWardrobe(boldness: string): boolean {
  const b = (boldness || "moderate").toLowerCase();
  return b === "statement" || b === "experimental";
}

export function styleFitScore(title: string, boldness: string): number {
  const t = title || "";
  const trend = TREND_RE.test(t);
  const staple = STAPLE_RE.test(t);
  const gimmick = GIMMICK_RE.test(t);
  const casualShoe = CASUAL_FOOTWEAR_RE.test(t);
  // Casual outerwear (field/denim/bomber/puffer/parka/anorak/fleece…) reads wrong
  // as the headline "invest in your hero piece" for a polished, professional
  // wardrobe — a tailored blazer or coat should always outrank it.
  const casualOuter = CASUAL_OUTERWEAR_RE.test(t);
  const athleisure = ATHLEISURE_RE.test(t);
  const b = (boldness || "moderate").toLowerCase();

  // Statement / experimental wardrobes welcome directional design, but even a
  // bold wardrobe should not be *led* by slogan tees, ripped denim or joggers —
  // those read cheap/juvenile rather than "elevated statement". Reward genuine
  // directional pieces; still demote the gimmicky/athleisure ones.
  if (isBoldWardrobe(b)) {
    let s = 0;
    if (trend && !gimmick) s += SCORING.trend.bold;
    if (gimmick) s += SCORING.gimmick.bold;
    if (athleisure) s += SCORING.athleisure.bold;
    if (staple) s += SCORING.staple.bold;
    return s;
  }

  const tier = b === "conservative" ? "conservative" : "other";
  let s = 0;
  if (trend) s += SCORING.trend[tier];
  if (gimmick) s += SCORING.gimmick[tier];
  if (athleisure) s += SCORING.athleisure[tier];
  if (casualShoe) s += SCORING.casualShoe[tier];
  if (casualOuter) s += SCORING.casualOuter[tier];
  if (staple) s += SCORING.staple.other;
  return s;
}

/** Short intent clause appended to catalogue queries so vector search leans on the archetype. */
export function styleIntentPhrase(boldness: string): string {
  switch ((boldness || "moderate").toLowerCase()) {
    case "conservative":
      return "timeless tailored classic staples, understated, quietly expensive, not trend-driven";
    case "experimental":
      return "considered contemporary pieces with a creative edge, well-tailored, no novelty prints";
    case "statement":
      return "elevated directional pieces, refined statement, architectural cuts and rich fabrics — no slogans, graphics or distressed finishes";
    default:
      return "clean modern versatile essentials, not trend-driven";
  }
}

/** One garment parsed out of a look description, mapped to a catalogue category. */
export type LookGarment = {
  category: string;
  garment: string;
  color: string | null;
  /** Source phrase from the look description (for richer catalogue queries). */
  clause: string;
};

/** Garment keyword → catalogue CATEGORY. Mirrors catalog.ts CATEGORIES. */
const GARMENT_CATEGORY: Record<string, string> = {
  blazer: "Outerwear", jacket: "Outerwear", coat: "Outerwear", overcoat: "Outerwear",
  overshirt: "Outerwear", trench: "Outerwear", parka: "Outerwear", bomber: "Outerwear",
  peacoat: "Outerwear", suit: "Outerwear",
  sweater: "Knitwear", hoodie: "Knitwear", vest: "Knitwear", shacket: "Outerwear",
  knit: "Knitwear", crewneck: "Knitwear", jumper: "Knitwear",
  cardigan: "Knitwear", turtleneck: "Knitwear", rollneck: "Knitwear", pullover: "Knitwear",
  // Prose and items write "roll-neck" / "turtle-neck" / "polo neck"; the
  // normaliser turns the hyphen into a space, so the single-word keys above
  // never fired and the Knitwear slot silently vanished from the look.
  "roll neck": "Knitwear", "turtle neck": "Knitwear", "polo neck": "Knitwear",
  "mock neck": "Knitwear", "funnel neck": "Knitwear", "high neck": "Knitwear",
  // Audit of 199 production looks: these were the garments the parser lost.
  sweatshirt: "Knitwear", "quarter zip": "Knitwear", "half zip": "Knitwear",
  "zip neck": "Knitwear", fleece: "Knitwear", "v neck": "Knitwear", vneck: "Knitwear",
  "sweater vest": "Knitwear", "knit vest": "Knitwear",
  gilet: "Outerwear", waistcoat: "Outerwear", "quilted vest": "Outerwear",
  "puffer vest": "Outerwear", "down vest": "Outerwear", topcoat: "Outerwear",
  windbreaker: "Outerwear", anorak: "Outerwear", puffer: "Outerwear",
  harrington: "Outerwear", blouson: "Outerwear", raincoat: "Outerwear",
  trouser: "Trousers", corduroys: "Trousers", cords: "Trousers", joggers: "Trousers",
  flannels: "Trousers",
  "monk straps": "Footwear", monkstraps: "Footwear", espadrilles: "Footwear",
  moccasins: "Footwear", mules: "Footwear", slides: "Footwear", plimsolls: "Footwear",
  bracelet: "Accessories", cufflinks: "Accessories", necklace: "Accessories",
  shirt: "Shirts", oxford: "Shirts", tee: "Shirts", polo: "Shirts", henley: "Shirts",
  trousers: "Trousers", chinos: "Trousers", chino: "Trousers", jeans: "Trousers",
  denim: "Trousers", slacks: "Trousers", pants: "Trousers",
  shorts: "Trousers", short: "Trousers", bermudas: "Trousers", bermuda: "Trousers",
  loafers: "Footwear", loafer: "Footwear", boots: "Footwear", boot: "Footwear", sneakers: "Footwear",
  sneaker: "Footwear", derbies: "Footwear", derby: "Footwear", oxfords: "Footwear", brogues: "Footwear",
  "oxford shoes": "Footwear", "oxford shoe": "Footwear",
  chelsea: "Footwear", chukka: "Footwear",
  hiking: "Footwear", "hiking boots": "Footwear", trail: "Footwear", "trail boots": "Footwear",
  shoes: "Footwear", trainers: "Footwear", sandals: "Footwear", sandal: "Footwear",
  belt: "Accessories", watch: "Accessories", scarf: "Accessories", tie: "Accessories",
  necktie: "Accessories", bowtie: "Accessories", "bow tie": "Accessories",
  bolo: "Accessories", "bolo tie": "Accessories",
  tote: "Accessories", "tote bag": "Accessories",
  messenger: "Accessories", "messenger bag": "Accessories",
  briefcase: "Accessories", satchel: "Accessories",
  backpack: "Accessories", "travel bag": "Accessories",
  "pocket square": "Accessories", pochette: "Accessories", handkerchief: "Accessories",
  neckerchief: "Accessories", "neck scarf": "Accessories", bandana: "Accessories",
  foulard: "Accessories",
  sunglasses: "Accessories", glasses: "Accessories", eyeglasses: "Accessories",
  goggles: "Accessories", "ski goggles": "Accessories",
  hat: "Accessories", cap: "Accessories", beanie: "Accessories",
  fedora: "Accessories", trilby: "Accessories", borsalino: "Accessories",
  boater: "Accessories", bucket: "Accessories", panama: "Accessories",
  "bucket hat": "Accessories", "panama hat": "Accessories",
  "baseball cap": "Accessories", baseball: "Accessories",
  kartuz: "Accessories", kepi: "Accessories", "peaked cap": "Accessories",
  "cowboy hat": "Accessories", cowboy: "Accessories",
  newsboy: "Accessories", "newsboy cap": "Accessories", "flat cap": "Accessories",
  "fisherman beanie": "Accessories", "slouch beanie": "Accessories",
  gloves: "Accessories",
  bag: "Accessories", socks: "Accessories",
};

/** Synonyms used to verify a catalogue title matches the parsed garment. */
const HIGH_NECK_TERMS = [
  "roll neck",
  "roll-neck",
  "rollneck",
  "turtleneck",
  "turtle neck",
  "turtle-neck",
  "polo neck",
  "polo-neck",
  "mock neck",
  "mock-neck",
  "funnel neck",
  "funnel-neck",
  "high neck",
  "high-neck",
];

const GARMENT_TITLE_SYNONYMS: Record<string, string[]> = {
  // No bare "jacket" — knit/zip/sport jackets were scoring as full blazer hits.
  blazer: ["blazer", "sport coat"],
  jacket: ["jacket", "blazer"],
  coat: ["coat", "overcoat"],
  overshirt: ["overshirt", "shacket", "shirt jacket"],
  knit: ["knit", "knitwear", "sweater", "jumper", "pullover"],
  sweater: ["sweater", "jumper", "knit", "pullover", "crewneck"],
  // Roll neck = turtleneck = polo neck; a look asking for one must find any.
  turtleneck: HIGH_NECK_TERMS,
  rollneck: HIGH_NECK_TERMS,
  "roll neck": HIGH_NECK_TERMS,
  "turtle neck": HIGH_NECK_TERMS,
  "polo neck": HIGH_NECK_TERMS,
  "mock neck": HIGH_NECK_TERMS,
  "funnel neck": HIGH_NECK_TERMS,
  "high neck": HIGH_NECK_TERMS,
  crewneck: ["crewneck", "crew neck", "sweater", "knit", "jumper"],
  cardigan: ["cardigan"],
  shirt: ["shirt", "oxford", "button-down", "button down"],
  tee: ["tee", "t-shirt", "tshirt"],
  polo: ["polo"],
  henley: ["henley"],
  trousers: ["trouser", "trousers", "pant", "pants", "slack"],
  chinos: ["chino", "chinos", "trouser", "trousers"],
  chino: ["chino", "chinos", "trouser", "trousers"],
  jeans: ["jean", "jeans", "denim"],
  shorts: ["short", "shorts", "bermuda"],
  bermuda: ["bermuda", "shorts"],
  loafers: ["loafer", "loafers"],
  loafer: ["loafer", "loafers"],
  sneakers: ["sneaker", "sneakers", "trainer", "trainers"],
  sneaker: ["sneaker", "sneakers", "trainer", "trainers"],
  boots: ["boot", "boots"],
  boot: ["boot", "boots"],
  chelsea: ["chelsea", "boot", "boots"],
  derbies: ["derby", "derbies", "oxford", "oxfords"],
  derby: ["derby", "derbies", "oxford", "oxfords"],
  oxfords: ["oxford", "oxfords", "derby", "derbies"],
  brogues: ["brogue", "brogues"],
  belt: ["belt"],
  tote: ["tote", "tote bag"],
  "tote bag": ["tote", "tote bag"],
  messenger: ["messenger", "satchel"],
  "messenger bag": ["messenger", "satchel"],
  briefcase: ["briefcase"],
  satchel: ["satchel", "messenger"],
  backpack: ["backpack", "rucksack"],
  "travel bag": ["travel bag", "weekender", "duffel", "duffle", "holdall"],
  "pocket square": ["pocket square", "pochette", "handkerchief"],
  pochette: ["pochette", "pocket square"],
  handkerchief: ["handkerchief", "pocket square"],
  watch: ["watch"],
  scarf: ["scarf"],
  neckerchief: ["neckerchief", "neck scarf", "neck-scarf", "bandana", "foulard"],
  "neck scarf": ["neck scarf", "neckerchief", "neck-scarf", "bandana", "foulard"],
  bandana: ["bandana", "neckerchief", "neck scarf"],
  foulard: ["foulard", "neckerchief", "neck scarf"],
  tie: ["tie", "necktie", "bow tie", "bowtie", "bolo"],
  necktie: ["tie", "necktie"],
  bowtie: ["bow tie", "bowtie", "tie"],
  bolo: ["bolo", "bolo tie"],
  hat: ["hat", "cap", "beanie", "fedora"],
  cap: ["cap", "hat"],
  beanie: ["beanie", "watch cap"],
  fedora: ["fedora", "hat"],
  sunglasses: ["sunglasses", "sunglass", "goggles"],
  glasses: ["glasses", "eyeglasses", "spectacles"],
  eyeglasses: ["glasses", "eyeglasses", "spectacles"],
  goggles: ["goggles", "ski goggles", "sunglasses"],
};

const GARMENT_KEYS = Object.keys(GARMENT_CATEGORY).sort(
  (a, b) => b.length - a.length,
);

function escapeKey(key: string): string {
  return key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

/**
 * `\bkeys?\b` — and, for a plural key, its singular too ("a tailored trouser")
 * unless the singular is a DIFFERENT garment ("oxfords" → "oxford" is a shirt).
 */
function garmentKeyPattern(key: string): RegExp {
  const base = key.endsWith("s") && key.length > 4 ? key.slice(0, -1) : null;
  const baseSafe =
    base != null &&
    (!GARMENT_CATEGORY[base] || GARMENT_CATEGORY[base] === GARMENT_CATEGORY[key]);
  return new RegExp(`\\b${escapeKey(baseSafe ? base! : key)}s?\\b`);
}

function findGarmentKeyIndex(text: string, key: string, from = 0): number {
  const slice = text.slice(from);
  const match = slice.match(garmentKeyPattern(key));
  if (!match || match.index == null) return -1;
  return from + match.index;
}

/** Map a look's hex palette to the nearest named colours from the report. */
export function paletteColorHints(
  palette: string[],
  bestColors: { name: string; hex: string }[],
): string {
  if (!palette.length || !bestColors.length) return "";
  const names: string[] = [];
  for (const hex of palette) {
    const rgb = parseHexRgb(hex);
    if (!rgb) continue;
    let bestName: string | null = null;
    let bestDist = Infinity;
    for (const c of bestColors) {
      const crgb = parseHexRgb(c.hex);
      if (!crgb) continue;
      const dist =
        (rgb[0] - crgb[0]) ** 2 +
        (rgb[1] - crgb[1]) ** 2 +
        (rgb[2] - crgb[2]) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestName = c.name;
      }
    }
    if (bestName) names.push(bestName);
  }
  return [...new Set(names)].join(", ");
}

/** Map free-text garment labels ("structured blazer") onto synonym keys. */
export function normalizeGarmentKey(garment: string): string {
  const g = garment
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!g) return g;
  if (GARMENT_TITLE_SYNONYMS[g]) return g;
  for (const key of GARMENT_KEYS) {
    if (g === key || g.endsWith(` ${key}`) || g.includes(` ${key} `)) return key;
    if (g.startsWith(`${key} `)) return key;
  }
  return g;
}

/**
 * Soft rank nudge when a trousers slot asked for drawstring/elasticated.
 * Positive for matching titles, negative for suit/pressed-crease trousers.
 */
export function silhouetteFitScore(
  clause: string | null | undefined,
  title: string,
  meta?: { description?: string | null },
): number {
  if (!clause || !DRAWSTRING_CLAUSE_RE.test(clause)) return 0;
  if (isDrawstringTitle(title, meta)) return 0.12;
  if (TAILORED_TROUSER_TITLE_RE.test(title)) return -0.08;
  return 0;
}

/** 0–1 whether a catalogue product title mentions the parsed garment type. */
export function garmentTitleMatchScore(garment: string, title: string): number {
  // Feeds use non-breaking / figure dashes ("Roll‑neck"); fold them to "-".
  const hay = title.toLowerCase().replace(/[\u2010-\u2015]/g, "-");
  const key = normalizeGarmentKey(garment);
  if (key === "blazer" || isBlazerGarment(garment)) {
    if (NON_BLAZER_OUTER_RE.test(hay)) return 0;
    if (/\b(blazer|sport\s*coat)\b/.test(hay)) return 1;
    // Bare "jacket" only counts with clear tailored cues — not knit/zip shells.
    if (
      /\bjacket\b/.test(hay) &&
      /\b(tailored|suiting|structured|single[- ]breasted|notch|peak\s*lapel)\b/.test(
        hay,
      )
    ) {
      return 0.7;
    }
    return 0;
  }
  // Home textiles are not apparel — "waffle-knit tea towels" is not knitwear.
  if (
    HOUSEHOLD_TEXTILE_RE.test(hay) &&
    key !== "handkerchief" &&
    key !== "pocket square" &&
    key !== "pochette"
  ) {
    return 0;
  }
  // Travel / weekender / duffel is not a messenger, tote or office bag.
  if (
    key === "messenger" ||
    key === "messenger bag" ||
    key === "briefcase" ||
    key === "satchel" ||
    key === "tote" ||
    key === "tote bag" ||
    key === "bag"
  ) {
    if (
      /\b(travel\s+bags?|weekenders?|duffels?|duffles?|holdalls?|cabin\s+bags?|overnight\s+bags?|trolley|suitcase)\b/.test(
        hay,
      )
    ) {
      return 0;
    }
    if (
      (key === "messenger" || key === "messenger bag") &&
      /\bcrossbod(?:y|ies)\b/.test(hay) &&
      !/\b(messenger|satchel)\b/.test(hay)
    ) {
      return 0;
    }
  }
  // Shorts are not trousers / chinos / slacks.
  if (
    key === "trousers" ||
    key === "chinos" ||
    key === "chino" ||
    key === "pants" ||
    key === "slacks"
  ) {
    if (/\bshorts?\b|\bbermuda\b/.test(hay)) return 0;
  }
  // A "Tie With Pocket Square" set is a necktie, not a square. Same for a
  // cap/hat/belt that happens to mention a square in the title.
  if (key === "pocket square" || key === "pochette" || key === "handkerchief") {
    if (
      /\b(?:neck)?ties?\b|\bbow\s*tie\b|\bbolo\b|\bcaps?\b|\bhats?\b|\bbelts?\b/.test(
        hay,
      )
    ) {
      return 0;
    }
    // A supermarket pack of cotton handkerchiefs is not a linen pocket square.
    if (
      /\b(?:\d+\s*pks?|packs?\s+of|antibacterial|sanitized)\b/i.test(hay)
    ) {
      return 0;
    }
  }
  const terms = GARMENT_TITLE_SYNONYMS[key] ?? [key];
  return terms.some((t) => hay.includes(t)) ? 1 : 0;
}

function extractGarmentFromClause(clause: string): LookGarment | null {
  const normalized = clause
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  const words = normalized.split(/\s+/).filter(Boolean);
  // "knitted tie" contains "knit" as a substring — it is a necktie, not a jumper.
  const skipKnitForTie = /\bties?\b/.test(normalized);
  // Every key that occurs, with where its match ENDS. GARMENT_KEYS is longest-first.
  const hits: { key: string; category: string; end: number }[] = [];
  for (const key of GARMENT_KEYS) {
    if (skipKnitForTie && (key === "knit" || key === "knitted")) continue;
    const m = garmentKeyPattern(key).exec(normalized);
    if (m) hits.push({ key, category: GARMENT_CATEGORY[key]!, end: m.index + m[0].length });
  }
  if (!hits.length) return null;
  // Same category everywhere → the longest key (historic behaviour: "oxford
  // shoes", "pocket square", "roll neck" keep their compound names). Categories
  // disagree → the HEAD noun wins: the key that ends last in the clause, so
  // "short-sleeve knit polo" is a polo and "denim jacket" is a jacket, not the
  // longest word that happened to be a trouser key.
  const categories = new Set(hits.map((h) => h.category));
  const pick =
    categories.size === 1
      ? hits[0]!
      : hits.reduce((best, h) =>
          h.end > best.end || (h.end === best.end && h.key.length > best.key.length)
            ? h
            : best,
        );
  const garment = pick.key;
  const category = pick.category;
  const colors = words.filter((w) => COLOR_WORDS.has(w));
  return {
    category,
    garment,
    color: colors.length ? colors.join(" ") : null,
    clause: clause.trim(),
  };
}

function decomposeFromWholeText(description: string): LookGarment[] {
  const lower = normalizeCompoundColors(description.toLowerCase());
  const hits: { index: number; garment: LookGarment }[] = [];
  for (const key of GARMENT_KEYS) {
    let from = 0;
    while (from < lower.length) {
      const index = findGarmentKeyIndex(lower, key, from);
      if (index === -1) break;
      const before = lower.slice(Math.max(0, index - 48), index);
      const clause = `${before} ${key}`.trim();
      const parsed = extractGarmentFromClause(clause);
      if (parsed) hits.push({ index, garment: parsed });
      from = index + key.length;
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const out: LookGarment[] = [];
  const seen = new Set<string>();
  for (const { garment } of hits) {
    const dedupeKey = `${garment.category}:${garment.color ?? ""}:${garment.garment}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(garment);
  }
  return out;
}

/**
 * Deterministically split a free-text look description into individual garments,
 * each mapped to a catalogue category with any qualifying colour. Keyword-based
 * (no AI call) so it behaves identically in demo and live mode.
 */
/** True when a split fragment is only colour / shade words ("navy", "dusty rose"). */
function isColourOnlyFragment(fragment: string): boolean {
  const words = fragment
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.every((w) => COLOR_WORDS.has(w) || w === "a" || w === "an");
}

export function decomposeLook(description: string): LookGarment[] {
  const raw = normalizeCompoundColors(description.toLowerCase()).split(
    /,|\s+over\s+|\s+under\s+|\s+beneath\s+|\s+and\s+|\s+with\s+/,
  );
  // "navy and white striped shirt" splits into "navy" | "white striped shirt";
  // a colour-only fragment belongs to the garment that follows it.
  const clauses: string[] = [];
  let carry = "";
  for (const part of raw) {
    const t = part.trim();
    if (!t) continue;
    if (isColourOnlyFragment(t) && !extractGarmentFromClause(t)) {
      carry = carry ? `${carry} ${t}` : t;
      continue;
    }
    clauses.push(carry ? `${carry} ${t}` : t);
    carry = "";
  }
  if (carry) clauses.push(carry);
  const out: LookGarment[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    const parsed = extractGarmentFromClause(clause);
    if (!parsed) continue;
    const dedupeKey = `${parsed.category}:${parsed.color ?? ""}:${parsed.garment}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(parsed);
  }
  if (out.length) return out;
  return decomposeFromWholeText(description);
}

/** One structured garment slot from the reasoning model (lookContentSchema.items). */
export type LookItemSlot = { garment: string; color?: string | null };

/**
 * Convert the reasoning model's structured `items` into LookGarments. Skips the
 * fragile clause-splitting of `decomposeLook` (each item IS one clause) but runs
 * every item through the same keyword vocabulary, so garment/category values
 * stay identical for all downstream filters (isBlazerGarment, accessory types,
 * occasion rules). Items whose garment word is outside the vocabulary are
 * dropped. {@link resolveLookGarments} falls back to decomposeLook when the
 * mapped list is thinner than the prose, so a drifting noun cannot drop a slot.
 */
export function lookGarmentsFromItems(
  items: LookItemSlot[] | null | undefined,
): LookGarment[] {
  if (!items?.length) return [];
  const out: LookGarment[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const garment = (item.garment ?? "").trim();
    if (!garment) continue;
    const color = (item.color ?? "").trim();
    const clause = [color, garment].filter(Boolean).join(" ").toLowerCase();
    const parsed = extractGarmentFromClause(normalizeCompoundColors(clause));
    if (!parsed) continue;
    const dedupeKey = `${parsed.category}:${parsed.color ?? ""}:${parsed.garment}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(parsed);
  }
  return out;
}

/**
 * Prefer structured slots when they cover at least as many garments as the
 * prose parser. A partial list (unknown noun dropped a shoe, etc.) falls back
 * to {@link decomposeLook} so matching is never thinner than today's regex.
 */
export function resolveLookGarments(
  items: LookItemSlot[] | null | undefined,
  description: string,
): LookGarment[] {
  const fromProse = decomposeLook(description);
  const structured = lookGarmentsFromItems(items);
  if (!structured.length) return fromProse;
  if (structured.length < fromProse.length) return fromProse;
  return preferProseFootwear(structured, fromProse);
}

function footwearKind(garment: string): string {
  const g = garment.toLowerCase();
  if (/\bloafers?\b/.test(g)) return "loafers";
  if (/\b(chelsea|chukka|boots?)\b/.test(g)) return "boots";
  if (/\b(derb|oxford|brogue)\b/.test(g)) return "dress";
  if (/\b(sneaker|trainer)\b/.test(g)) return "sneakers";
  return g.trim();
}

/** Constructor overwrites the brief but can leave stale `items` (loafers vs boots). */
function preferProseFootwear(
  structured: LookGarment[],
  prose: LookGarment[],
): LookGarment[] {
  const used = new Set<number>();
  return structured.map((slot) => {
    const proseIdx = prose.findIndex((p, i) => {
      if (used.has(i) || p.category !== slot.category) return false;
      return slotKind(slot) !== slotKind(p);
    });
    if (proseIdx < 0) return slot;
    used.add(proseIdx);
    return prose[proseIdx]!;
  });
}

function slotKind(g: LookGarment): string {
  if (g.category === "Footwear") return footwearKind(g.garment);
  const raw = g.garment.toLowerCase();
  if (/\bblazer\b/.test(raw)) return "blazer";
  if (/\b(jacket|coat|trench)\b/.test(raw)) return "jacket";
  return raw.replace(/^(linen|cotton|wool|suede|leather|woven)\s+/, "").trim();
}

/** Parse a `looks.items` jsonb cell into structured slots (null when absent). */
export function lookItemsFromCell(cell: unknown): LookItemSlot[] | null {
  if (!Array.isArray(cell)) return null;
  const items = cell
    .filter(
      (it): it is { garment: string; color?: string | null } =>
        Boolean(it) &&
        typeof it === "object" &&
        typeof (it as { garment?: unknown }).garment === "string",
    )
    .map((it) => ({
      garment: it.garment,
      color: typeof it.color === "string" ? it.color : null,
    }));
  return items.length ? items : null;
}

/**
 * One slot per clothing category, but several Accessories (belt + tote +
 * pocket square) — collapsing those to a single category drops pieces.
 */
/**
 * A €545 jumper next to €40 chinos, €38 belt and €50 loafers is not "the
 * look" — it is a pricing accident. An item is an outlier when it costs more
 * than three times the median of the other pieces (and at least €120, so a
 * €30 belt does not flag €95 shoes).
 */
export const PRICE_OUTLIER_FACTOR = 3;

export const PRICE_OUTLIER_MIN_EUR = 120;

export function priceOutlierThreshold(otherPrices: number[]): number {
  const valid = otherPrices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (valid.length < 2) return Number.POSITIVE_INFINITY;
  const mid = Math.floor(valid.length / 2);
  const median = valid.length % 2 ? valid[mid]! : (valid[mid - 1]! + valid[mid]!) / 2;
  return Math.max(median * PRICE_OUTLIER_FACTOR, PRICE_OUTLIER_MIN_EUR);
}

export function selectLookGarmentSlots(
  garments: LookGarment[],
  max = 6,
): LookGarment[] {
  const hasJacket = garments.some(
    (g) =>
      g.category === "Outerwear" ||
      /\b(blazers?|sport\s*coats?|jackets?|coats?)\b/.test(g.garment),
  );
  const out: LookGarment[] = [];
  const usedCategories = new Set<string>();
  const usedAccessories = new Set<string>();
  for (const g of garments) {
    if (out.length >= max) break;
    if (
      !hasJacket &&
      (g.garment === "pocket square" ||
        g.garment === "pochette" ||
        g.garment === "handkerchief")
    ) {
      continue;
    }
    if (g.category === "Accessories") {
      const key = g.garment.trim().toLowerCase();
      if (!key || usedAccessories.has(key)) continue;
      usedAccessories.add(key);
    } else if (usedCategories.has(g.category)) {
      continue;
    } else {
      usedCategories.add(g.category);
    }
    out.push(g);
  }
  return out;
}

/** Palette-aware wardrobe staples assumed already owned (clearly labelled in UI). */
export function assumedBasics(profile: StyleProfile): {
  bottoms: string[];
  /** Dress shoes for formal contexts. */
  shoes: string[];
  /** Smart-casual shoes for relaxed contexts. */
  casualShoes: string[];
} {
  const u = lc(profile.physical.undertone);
  const jeans =
    u === "warm"
      ? "Mid-indigo jeans"
      : u === "cool"
        ? "Blue-grey jeans"
        : "Indigo jeans";
  const chinos =
    u === "warm"
      ? "Stone chinos"
      : u === "cool"
        ? "Grey chinos"
        : "Taupe chinos";
  const shoe = u === "cool" ? "Black leather derbies" : "Brown leather derbies";
  const sneaker = u === "cool" ? "White leather sneakers" : "Cream leather sneakers";
  return { bottoms: [jeans, chinos], shoes: [shoe], casualShoes: [sneaker] };
}

export type ShoppingRoleCandidate = {
  title: string;
  color?: string;
  priceEur?: number;
};

/**
 * Pick up to two catalogue items that cover complementary wardrobe roles
 * instead of the two nearest vector neighbours.
 */
export function pickShoppingRolePair(
  category: string,
  candidates: ShoppingRoleCandidate[],
  opts?: {
    polishedFootwear?: boolean;
    polishedShirt?: boolean;
    outdoorJeans?: boolean;
  },
): ShoppingRoleCandidate[] {
  if (!candidates.length) return [];
  const byTitle = new Map(candidates.map((c) => [c.title, c.color ?? ""]));
  const take = (
    preferred: ShoppingRoleCandidate[],
    rest: ShoppingRoleCandidate[],
    limit = 2,
  ): ShoppingRoleCandidate[] => {
    const out: ShoppingRoleCandidate[] = [];
    const seen = new Set<string>();
    for (const c of [...preferred, ...rest]) {
      const key = c.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= limit) break;
    }
    return out;
  };

  if (category === "Accessories") {
    const belts = candidates.filter((c) => isBeltTitle(c.title));
    const bags = candidates.filter((c) => isBagTitle(c.title));
    const ties = candidates.filter((c) => isTieTitle(c.title));
    if (opts?.polishedFootwear) {
      const preferred = [belts[0], bags[0] ?? ties[0]].filter(
        (c): c is ShoppingRoleCandidate => Boolean(c),
      );
      return take(preferred, [...belts, ...bags, ...ties], 2);
    }
    const preferred = [belts[0], ties[0], bags[0]].filter(
      (c): c is ShoppingRoleCandidate => Boolean(c),
    );
    return take(preferred.length ? preferred : candidates, candidates);
  }

  if (category === "Footwear") {
    const closed = candidates.filter((c) => !CASUAL_FOOTWEAR_RE.test(c.title));
    const pool =
      opts?.polishedFootwear && closed.length ? closed : candidates;
    const dress = pool.filter(
      (c) => !CASUAL_FOOTWEAR_RE.test(c.title) && !SNEAKER_RE.test(c.title),
    );
    const sneakers = pool.filter((c) => SNEAKER_RE.test(c.title));
    const loafers = dress.filter((c) => isLoaferTitle(c.title));
    const lace = dress.filter((c) => !isLoaferTitle(c.title));
    const secondLeather = loafers[0] ?? lace[1];
    const preferred = [lace[0] ?? dress[0], secondLeather, sneakers[0]].filter(
      (c): c is ShoppingRoleCandidate => Boolean(c),
    );
    return take(preferred, pool, 3);
  }

  if (category === "Outerwear") {
    const tailored = candidates.filter((c) => !CASUAL_OUTERWEAR_RE.test(c.title));
    const casual = candidates.filter((c) => CASUAL_OUTERWEAR_RE.test(c.title));
    const tailoredPrice = tailored[0]?.priceEur;
    const casualByPrice = [...casual].sort(
      (a, b) => (a.priceEur ?? 9_999) - (b.priceEur ?? 9_999),
    );
    const casualPick =
      tailoredPrice != null
        ? casualByPrice.find((c) => (c.priceEur ?? 0) <= tailoredPrice * 2.2) ??
          casualByPrice[0]
        : casual[0];
    const preferred = [tailored[0], casualPick].filter(
      (c): c is ShoppingRoleCandidate => Boolean(c),
    );
    return take(preferred, candidates);
  }

  if (category === "Trousers") {
    if (opts?.outdoorJeans) {
      const jeans = candidates.filter((c) => isJeanTitle(c.title));
      const tailored = candidates.filter((c) => !isJeanTitle(c.title));
      const dark = tailored.filter((c) => isDarkAnchorPiece(c.title, byTitle));
      const preferred = [jeans[0], dark[0] ?? tailored[0]].filter(
        (c): c is ShoppingRoleCandidate => Boolean(c),
      );
      if (preferred.length) return take(preferred, candidates);
    }
    const dark = candidates.filter((c) => isDarkAnchorPiece(c.title, byTitle));
    const light = candidates.filter((c) => isLightBottomPiece(c.title, byTitle));
    const preferred = [dark[0], light[0]].filter(
      (c): c is ShoppingRoleCandidate => Boolean(c),
    );
    return take(preferred, candidates);
  }

  if (category === "Shirts") {
    const dress = candidates.filter(
      (c) =>
        isLongSleeveShirtTitle(c.title) && !isCasualSummerShirtTitle(c.title),
    );
    if (opts?.polishedShirt && dress.length) return take(dress, []);
    return take(dress.length ? dress : candidates, candidates);
  }

  if (category === "Knitwear") {
    const fine = candidates.filter((c) => !isHeavyWinterKnit(c.title));
    return take(fine.length ? fine : candidates, []);
  }

  return candidates.slice(0, 2);
}

/** True when the target garment is a tailored blazer / sport coat. */
export function isBlazerGarment(garment: string): boolean {
  const key = normalizeGarmentKey(garment);
  return key === "blazer" || /\b(blazer|sport\s*coat)\b/.test(garment.toLowerCase());
}

/** True when the look clause asks for drawstring / elasticated trousers. */
export function prefersDrawstringSilhouette(
  garment: string,
  clause?: string | null,
): boolean {
  if (!clause || !DRAWSTRING_CLAUSE_RE.test(clause)) return false;
  return DRAWSTRING_GARMENTS.has(normalizeGarmentKey(garment));
}
