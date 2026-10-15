/**
 * Garment vocabulary: what a catalogue title or a look clause IS — a loafer, a
 * shacket, a pleated trouser, a sports bag. Pure title → boolean predicates and
 * the regexes behind them. No colour, no palette, no profile judgement here.
 */


export const lc = (s: string) => (s || "").toLowerCase();

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Casual, warm-weather footwear that reads wrong for a polished/professional wardrobe. */
export const CASUAL_FOOTWEAR_RE =
  /\b(sandals?|sndls?|slides?|flip[-\s]?flop|espadrilles?|clog|havaianas|thong|pool slider|mules?)\b/i;

/** Shorts / bermudas — not full-length trousers, never under a blazer. */
export const SHORTS_TITLE_RE = /\bshorts\b|\bbermuda\b/i;

export function isShortsTitle(title: string): boolean {
  return SHORTS_TITLE_RE.test(title);
}

/** Trousers / jeans / shorts — not a short-sleeve shirt. */
export function isBottomTitle(title: string): boolean {
  if (isShortsTitle(title)) return true;
  return /\b(trousers?|chinos?|jeans?|slacks?)\b/i.test(title);
}

export function isJacketTitle(title: string): boolean {
  return (
    /\b(blazers?|sport\s+coats?|jackets?|coats?|trench)\b/i.test(title) &&
    !/\b(t-?shirt|tee)\b/i.test(title)
  );
}

export function isShoeTitle(title: string): boolean {
  if (/\bshirts?\b/i.test(title)) return false;
  // Oxford sneakers / trainers are footwear even though the title says "oxford".
  if (/\b(sneakers?|trainers?|plimsolls?|runners?)\b/i.test(title)) return true;
  // "light blue oxford" is a shirt; "oxfords" / "oxford shoes" are footwear.
  if (
    /\boxford\b/i.test(title) &&
    !/\b(oxfords|shoes?|cap-?toe|wholecuts?)\b/i.test(title)
  ) {
    return false;
  }
  return /\b(shoes?|loafers?|derb(?:y|ies)|oxfords?|brogues?|boots?|sandals?|slides?)\b/i.test(
    title,
  );
}

export function isAccentOnlyTitle(title: string): boolean {
  return /\b(belts?|pocket\s+squares?|ties?|scar(?:f|ves)|totes?|briefcases?|bags?|messengers?)\b/i.test(
    title,
  );
}

/** Casual outerwear that reads wrong in a boardroom / client-meeting context. */
export const CASUAL_OUTERWEAR_RE =
  /\b(field jacket|hood(?:ed|ie)?|bomber|parka|anorak|gilet|puffer|windbreaker|shacket|denim jacket|track(?:suit| jacket)?|cagoule|fleece)\b/i;

/**
 * Athleisure "sport" in a catalogue title. The tailored synonym "sport coat"
 * is stripped first so a real sport coat still belongs in work / meetings.
 */
export function isSportFashionTitle(title: string): boolean {
  const hay = title.toLowerCase().replace(/[\u2010-\u2015]/g, "-");
  const withoutCoat = hay.replace(/\bsports?[\s-]*coats?\b/g, " ");
  return /\bsports?\b/.test(withoutCoat);
}

/** Catalogue overshirt / shacket / shirt jacket — not a tailored blazer. */
export function isOvershirtTitle(title: string): boolean {
  return /\b(overshirts?|shackets?|shirt\s+jackets?)\b/i.test(title);
}

/**
 * Soft / athleisure outerwear that must not fill a tailored blazer slot.
 * "Sport coat" stays allowed (classic synonym); "sport blazer" is usually a
 * stretch jersey zip piece and is excluded.
 */
export const NON_BLAZER_OUTER_RE =
  /\b(knit|jersey|fleece|hoodie|zip(?:[- ]?up)?|zipper|track|bomber|softshell|quilt(?:ed)?|puffer|cardigan|sweat(?:shirt|er)?|(?:4[- ]?way\s+)?stretch|performance|sport\s+blazer|travel)\b/i;

/** Kitchen / bath textiles that leak into Knitwear via "waffle-knit tea towels". */
export const HOUSEHOLD_TEXTILE_RE =
  /\b(?:tea[\s-]?towels?|dish[\s-]?towels?|bath[\s-]?towels?|hand[\s-]?towels?|beach[\s-]?towels?|kitchen[\s-]?towels?|face[\s-]?towels?|wash[\s-]?cloths?|flannels?|bedding|duvets?|pillowcases?|napkins?|table[\s-]?cloths?|placemats?)\b/i;

/** True when a catalogue title reads as a tailored blazer (not knit/zip/sport). */
export function isTailoredBlazerTitle(title: string): boolean {
  const hay = title.toLowerCase();
  if (NON_BLAZER_OUTER_RE.test(hay)) return false;
  return /\b(blazer|sport\s*coat)\b/.test(hay);
}

export const DRAWSTRING_CLAUSE_RE = /\b(drawstring|elasticated|elastic\s+waist)\b/i;

const DRAWSTRING_TITLE_RE =
  /\b(drawstring|elasticated|elastic(?:ated)?\s+waist)\b/i;

export const TAILORED_TROUSER_TITLE_RE =
  /\b(suit\s+trousers|suit\s+pants|pressed\s+crease|dress\s+(?:pants|trousers)|tailored\s+trousers)\b/i;

export const DRAWSTRING_GARMENTS = new Set([
  "trousers",
  "chinos",
  "chino",
  "pants",
  "slacks",
  "shorts",
]);

export function isDrawstringTitle(
  title: string,
  meta?: { description?: string | null },
): boolean {
  return DRAWSTRING_TITLE_RE.test(`${title} ${meta?.description ?? ""}`);
}

export type AvoidPaletteOpts = {
  category?: string;
  role?: string;
  /** Look occasion — formal / wedding guest allow a black tailored overcoat. */
  occasionId?: string | null;
};

/** Garment words that disqualify a title from the dress-leather exemption
 * ("Oxford cloth trousers", "Oxford-weave jacket" are not shoes). */
const NOT_LEATHER_ITEM_RE =
  /\b(shirts?|trousers?|chinos?|jackets?|coats?|blazers?|jumpers?|sweaters?|knits?|tees?|t-?shirts?|polos?|shorts|cloth|weave|overshirts?|hoodies?)\b/i;

/** Structured leather bags share the shoe / belt leather story. */
const STRUCTURED_BAG_RE =
  /\b(briefcases?|messengers?|satchels?|portfolios?|document\s+bags?|attach[eé]s?)\b/i;

/**
 * Black and brown dress leather is business etiquette — not a seasonal ban:
 * derbies, oxfords, brogues, monks, dress boots, loafers, belts and the
 * structured bag that goes with them. Sneakers and garments are not.
 */
export function isClassicBusinessLeather(
  title: string,
  opts?: AvoidPaletteOpts,
): boolean {
  if (opts?.role === "sneaker") return false;
  if (SNEAKER_RE.test(title)) return false;
  if (
    opts?.role === "dressShoe" ||
    opts?.role === "loafer" ||
    opts?.role === "belt" ||
    opts?.role === "bag"
  ) {
    return true;
  }
  if (
    opts?.category &&
    opts.category !== "Footwear" &&
    opts.category !== "Accessories" &&
    opts.category !== "Bags"
  ) {
    return false;
  }
  if (NOT_LEATHER_ITEM_RE.test(title)) return false;
  if (isBeltTitle(title) || isLoaferTitle(title)) return true;
  if (STRUCTURED_BAG_RE.test(title)) return true;
  return /\b(derb(?:y|ies)|oxfords?|brogues?|monk\s+straps?|cap-?toes?|wholecuts?|chelsea\s+boots?|dress\s+boots?)\b/i.test(
    title,
  );
}

/** Occasions where the dress code (not colour analysis) sets the outer layer. */
export function isFormalOccasion(occasionId?: string | null): boolean {
  return /^(formal|wedding_guest|black[_-]?tie|gala)$/i.test(occasionId ?? "");
}

/** Tailored overcoats only — a parka or puffer is not evening dress. */
export function isTailoredOvercoat(title: string): boolean {
  if (/\b(parkas?|puffers?|anoraks?|raincoats?|bombers?|denim|fleece)\b/i.test(title)) return false;
  return /\b(overcoats?|topcoats?|chesterfields?|crombies?|dress\s+coats?|wool\s+coats?|cashmere\s+coats?)\b/i.test(
    title,
  );
}

/** Black tie is a dress code — the tuxedo, bow tie and patent shoes are black by definition. */
export function isBlackTieItem(title: string): boolean {
  return /\b(tuxedos?|dinner\s+jackets?|dinner\s+suits?|bow\s*ties?|cummerbunds?|patent(?:[- ]leather)?)\b/i.test(
    title,
  );
}

export function isNearFaceShoppingCategory(category: string): boolean {
  return category === "Knitwear" || category === "Shirts";
}

/**
 * Multi-colour / geometric knits rarely have a trustworthy swatch — the
 * catalogue hex can say spruce while the garment is mustard. Without a
 * colour word in the title, do not put them next to the face.
 */
export function isUnreliableColorBlockKnit(title: string): boolean {
  if (!/\b(colou?r[- ]?block|geometric)\b/i.test(title)) return false;
  return !/\b(navy|charcoal|slate|grey|gray|blue|mauve|plum|teal|spruce|white|black|olive|sage|burgundy|wine)\b/i.test(
    title,
  );
}

/** Smart-casual footwear that suits relaxed contexts (not boardrooms). */
export const SNEAKER_RE = /\b(sneakers?|trainers?|plimsolls?|runners?)\b/i;

export function isBeltTitle(title: string): boolean {
  return /\bbelts?\b/i.test(title);
}

export function isBagTitle(title: string): boolean {
  return /\b(briefcase|messenger|satchel|tote|bags?)\b/i.test(title);
}

/** Backpacks and rucksacks — bags for the sports-bag filter, not for the leather accessory pair. */
export function isBackpackTitle(title: string): boolean {
  return /\b(backpacks?|rucksacks?|knapsacks?|daypacks?)\b/i.test(title);
}

export function isTieTitle(title: string): boolean {
  return /\b(ties?|grenadine)\b/i.test(title);
}

export function isSunglassesTitle(title: string): boolean {
  return /\b(sun)?glasses\b|\bsunglasses\b/i.test(title);
}

/** Short-sleeve / V-neck / camp — not the professional shirt role. */
export function isCasualSummerShirtTitle(title: string): boolean {
  return /\b(short[- ]sleeves?|v-?neck|camp[- ]collar|stand-up\s+collar)\b/i.test(
    title,
  );
}

export function isLongSleeveShirtTitle(title: string): boolean {
  if (isCasualSummerShirtTitle(title)) return false;
  if (/\b(t-?shirts?|tees?)\b/i.test(title)) return false;
  return /\b(oxford|poplin|long[- ]sleeves?|button[- ]downs?|shirts?)\b/i.test(
    title,
  );
}

export function isLoaferTitle(title: string): boolean {
  return /\bloafers?\b/i.test(title);
}

/**
 * Dress-shoe titles whose construction reads casual — suede, nubuck, crepe or
 * chunky soles, chukkas and desert boots. Fine with chinos, not the boardroom
 * pair. Title-only; the catalogue row check lives in the matcher.
 */
export function isCasualDressShoeTitle(title: string): boolean {
  return CASUAL_DRESS_SHOE_RE.test(title);
}

export const CASUAL_DRESS_SHOE_RE =
  /\b(suede|nubuck|crepe|chukkas?|desert\s+boots?|(?:thick|chunky|platform|lug|commando|track|cleated)[\s-]*(?:soles?|outsoles?))\b/i;

/**
 * Trouser cuts that add volume at the hip and thigh — pleats, wide legs,
 * balloon / barrel shapes. The report's own advice for a triangle or oval
 * build says the opposite, so the shopping list must not contradict it.
 */
export const VOLUME_TROUSER_RE =
  /\b(pleat(?:ed|s)?|wide[-\s]?leg|balloon|barrel|baggy|palazzo|parachute)\b/i;

/** Oversized / boxy tops widen the shoulder line the wrong way on a triangle, oval or rectangle build. */
export const VOLUME_TOP_RE = /\b(oversized?|boxy|drop[-\s]?shoulders?|balloon[-\s]?sleeves?)\b/i;

export function silhouetteRejectsTrousers(
  bodyType: string | null | undefined,
  title: string,
): boolean {
  return (bodyType === "triangle" || bodyType === "oval") && VOLUME_TROUSER_RE.test(title);
}

export function silhouetteRejectsTop(
  bodyType: string | null | undefined,
  title: string,
): boolean {
  return (
    (bodyType === "triangle" || bodyType === "oval" || bodyType === "rectangle") &&
    VOLUME_TOP_RE.test(title)
  );
}

/** Gym, hiking and travel bags — a "55 l" backpack is not a work bag, whatever the embedding says. */
export const SPORTS_BAG_RE =
  /\b(\d{2,3}\s?(?:l|litres?|liters?)|sports?|gym|hiking|trekking|duffels?|duffles?|running|cycling|weekenders?)\b/i;

export function isSportsBagTitle(title: string): boolean {
  return SPORTS_BAG_RE.test(title);
}

/** The look itself asked for a sports / travel bag, so the filter stands down. */
export function lookAsksSportsBag(clause?: string | null): boolean {
  return (
    !!clause &&
    /\b(gym|sports?|hiking|trekking|duffels?|duffles?|weekenders?|travel\s+bags?)\b/i.test(
      clause,
    )
  );
}

export function isJeanTitle(title: string): boolean {
  if (/\b(chinos?|cargos?)\b/i.test(title)) return false;
  if (/\bjeans?\b/i.test(title)) return true;
  return /\bdenim\s+(trousers|pants|joggers)\b/i.test(title);
}

export function isWinterLayerTitle(title: string): boolean {
  return /\b(tweed|winter|autumn|fall|pea\s*coats?|overcoats?|heavy)\b/i.test(
    title,
  );
}

export function isHeavyWinterKnit(title: string): boolean {
  return /\b(elbow\s+patches?|winter(?:time)?|chunky|cowichan|arn\b)\b/i.test(
    title,
  );
}
