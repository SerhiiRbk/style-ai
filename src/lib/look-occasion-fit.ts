/**
 * Occasion formality for catalogue matching.
 * Work / formal trousers and shirts must not fall to holiday linen or relaxed
 * fits unless the look clause itself named that fabric or silhouette.
 */

const TAILORED_OCCASIONS = new Set(["work", "formal"]);

const TROUSER_GARMENTS = new Set([
  "trousers",
  "chinos",
  "chino",
  "pants",
  "slacks",
  "shorts",
]);

const SHIRT_GARMENTS = new Set(["shirt", "oxford"]);

const BELT_GARMENTS = new Set(["belt"]);

const SHOE_GARMENTS = new Set([
  "derby",
  "derbies",
  "oxfords",
  "shoe",
  "shoes",
  "loafer",
  "loafers",
  "brogue",
  "brogues",
]);

const BAG_GARMENTS = new Set([
  "bag",
  "messenger",
  "messenger bag",
  "tote",
  "tote bag",
  "briefcase",
  "satchel",
]);

const LINEN_RE = /\blinen\b/i;
const RELAXED_RE = /\brelaxed\b/i;
const CASUAL_SHIRT_FIT_RE =
  /\b(relaxed|oversized|oversize|comfort(?:\s+fit)?|boxy|flowing|loose)\b/i;
const VISCOSE_RE = /\b(viscose|cupro|jersey|modal|satin)\b/i;
const CAMP_COLLAR_RE = /\bcamp[-\s]?collars?\b/i;
const STAND_COLLAR_RE =
  /\b(stand[-\s]?up\s+collars?|standup\s+collars?|mandarin|grandad|band\s+collars?)\b/i;
const SHORT_SLEEVE_RE = /\bshort[- ]?sleeves?\b/i;
const CHECK_RE = /\b(checks?|checked|plaid|gingham)\b/i;
const DENIM_RE = /\bdenim\b/i;
const WESTERN_RE = /\bwestern\b/i;
const DRAWSTRING_RE = /\b(drawstring|elasticated|elastic(?:ated)?\s+waist)\b/i;
const CARGO_RE = /\b(cargo|joggers?|sweat\s?pants?)\b/i;
const SHORTS_RE = /\bshorts?\b|\bbermuda\b/i;
const JEANS_RE = /\bjeans?\b/i;
const TRAVEL_BAG_RE =
  /\b(travel\s+bags?|weekenders?|duffels?|duffles?|holdalls?|cabin\s+bags?|overnight\s+bags?|trolley|suitcase)\b/i;
const CROSSBODY_RE = /\bcrossbod(?:y|ies)\b/i;
const CASUAL_BELT_RE =
  /\b(stretch|active(?:\s+waist)?|elastic|braided|webbing|canvas|d-rings?)\b/i;
const NOT_A_BELT_RE =
  /\b(trousers?|tote|waistcoat|trunks?|swimming)\b/i;
const CASUAL_SHOE_RE =
  /\b(mules?|deck\s+shoes?|boat\s+shoes?|sandals?|sliders?|slides?|clogs?|trainers?)\b/i;
const SUEDE_RE = /\bsuede\b/i;
const DRESS_SHIRT_RE =
  /\b(oxford|poplin|twill|non[-\s]?iron|easy\s+iron|double\s+cuff)\b/i;
const FASHION_SHIRT_RE =
  /\b(bow\s+shirts?|pussy\s+bow|tie[-\s]?neck|washed)\b/i;
const NON_DRESS_SHIRT_RE =
  /\b(t-?shirts?|tees?|tank|polo|henley|slogan)\b/i;
const DRESS_SHOE_RE = /\b(derb(?:y|ies)|oxfords?|brogues?)\b/i;

export function lookOccasionIsTailored(
  occasionId: string | null | undefined,
): boolean {
  return TAILORED_OCCASIONS.has(occasionId ?? "");
}

export function lookOccasionAppliesToGarment(
  occasionId: string | null | undefined,
  garment: string,
): boolean {
  if (!lookOccasionIsTailored(occasionId)) return false;
  const key = garment.trim().toLowerCase();
  return (
    TROUSER_GARMENTS.has(key) ||
    SHIRT_GARMENTS.has(key) ||
    BELT_GARMENTS.has(key) ||
    SHOE_GARMENTS.has(key) ||
    BAG_GARMENTS.has(key)
  );
}

export function lookOccasionAppliesToBag(garment: string): boolean {
  return BAG_GARMENTS.has(garment.trim().toLowerCase());
}

export function lookOccasionAppliesToShirt(garment: string): boolean {
  return SHIRT_GARMENTS.has(garment.trim().toLowerCase());
}

export function lookOccasionAppliesToBelt(garment: string): boolean {
  return BELT_GARMENTS.has(garment.trim().toLowerCase());
}

export function lookOccasionAppliesToShoe(garment: string): boolean {
  return SHOE_GARMENTS.has(garment.trim().toLowerCase());
}

export function isWorkDressShirtTitle(title: string): boolean {
  return DRESS_SHIRT_RE.test(title) && !FASHION_SHIRT_RE.test(title);
}

/** True when this title is too casual for Work / Formal unless the clause asked. */
export function isOccasionCasualTrouserTitle(
  title: string,
  clause?: string | null,
  meta?: {
    fit?: string | null;
    materialFamily?: string | null;
    description?: string | null;
  },
): boolean {
  const asked = clause ?? "";
  const hay = [title, meta?.fit, meta?.materialFamily, meta?.description]
    .filter(Boolean)
    .join(" ");
  if (LINEN_RE.test(hay) && !LINEN_RE.test(asked)) return true;
  if (RELAXED_RE.test(hay) && !RELAXED_RE.test(asked)) return true;
  if (CASUAL_SHIRT_FIT_RE.test(hay) && !CASUAL_SHIRT_FIT_RE.test(asked)) {
    return true;
  }
  if (VISCOSE_RE.test(hay) && !VISCOSE_RE.test(asked)) return true;
  if (DRAWSTRING_RE.test(hay) && !DRAWSTRING_RE.test(asked)) return true;
  if (CARGO_RE.test(hay)) return true;
  if (SHORTS_RE.test(hay) && !SHORTS_RE.test(asked)) return true;
  if (JEANS_RE.test(hay) && !JEANS_RE.test(asked)) return true;
  return false;
}

/** True when this shirt is too casual for Work / Formal unless the clause asked. */
export function isOccasionCasualShirtTitle(
  title: string,
  clause?: string | null,
  meta?: {
    fit?: string | null;
    materialFamily?: string | null;
    description?: string | null;
    pattern?: string | null;
  },
): boolean {
  const asked = clause ?? "";
  const hay = [
    title,
    meta?.fit,
    meta?.materialFamily,
    meta?.description,
    meta?.pattern,
  ]
    .filter(Boolean)
    .join(" ");
  if (CASUAL_SHIRT_FIT_RE.test(hay) && !CASUAL_SHIRT_FIT_RE.test(asked)) {
    return true;
  }
  if (LINEN_RE.test(hay) && !LINEN_RE.test(asked)) return true;
  if (VISCOSE_RE.test(hay) && !VISCOSE_RE.test(asked)) return true;
  if (CAMP_COLLAR_RE.test(hay) && !CAMP_COLLAR_RE.test(asked)) return true;
  if (STAND_COLLAR_RE.test(hay) && !STAND_COLLAR_RE.test(asked)) return true;
  if (SHORT_SLEEVE_RE.test(hay) && !SHORT_SLEEVE_RE.test(asked)) return true;
  if (CHECK_RE.test(hay) && !CHECK_RE.test(asked)) return true;
  if (DENIM_RE.test(hay) && !DENIM_RE.test(asked)) return true;
  if (WESTERN_RE.test(hay)) return true;
  if (FASHION_SHIRT_RE.test(hay)) return true;
  if (NON_DRESS_SHIRT_RE.test(hay) && !NON_DRESS_SHIRT_RE.test(asked)) {
    return true;
  }
  return false;
}

/** True when this belt is too casual / not a belt for Work / Formal. */
export function isOccasionCasualBeltTitle(
  title: string,
  clause?: string | null,
  meta?: { description?: string | null; materialFamily?: string | null },
): boolean {
  const asked = clause ?? "";
  const hay = [title, meta?.description, meta?.materialFamily]
    .filter(Boolean)
    .join(" ");
  if (NOT_A_BELT_RE.test(title)) return true;
  if (CASUAL_BELT_RE.test(hay) && !CASUAL_BELT_RE.test(asked)) return true;
  return false;
}

export function isOccasionCasualShoeTitle(
  title: string,
  clause?: string | null,
): boolean {
  if (!CASUAL_SHOE_RE.test(title)) return false;
  return !CASUAL_SHOE_RE.test(clause ?? "");
}

export function prefersSuedeFootwear(clause?: string | null): boolean {
  return SUEDE_RE.test(clause ?? "");
}

export function isSuedeFootwearTitle(
  title: string,
  materialFamily?: string | null,
): boolean {
  return SUEDE_RE.test(`${title} ${materialFamily ?? ""}`);
}

export function isDressFootwearTitle(title: string): boolean {
  return DRESS_SHOE_RE.test(title);
}

/** True when this title is a travel / weekender bag unless the look asked for one. */
export function isOccasionTravelBagTitle(
  title: string,
  clause?: string | null,
): boolean {
  if (!TRAVEL_BAG_RE.test(title)) return false;
  return !TRAVEL_BAG_RE.test(clause ?? "");
}

/** A crossbody is not a Work messenger unless the look named one. */
export function isOccasionCrossbodyBagTitle(
  title: string,
  clause?: string | null,
  garment?: string | null,
): boolean {
  const askedMessenger = /\bmessenger\b/.test(`${garment ?? ""} ${clause ?? ""}`);
  if (!askedMessenger) return false;
  if (!CROSSBODY_RE.test(title)) return false;
  return !CROSSBODY_RE.test(clause ?? "");
}

export function lookOccasionQueryHint(
  occasionId: string | null | undefined,
  garment?: string | null,
): string | null {
  if (!lookOccasionIsTailored(occasionId)) return null;
  if (lookOccasionAppliesToBag(garment ?? "")) {
    return "leather messenger, satchel or slim briefcase, not travel bag, not weekender, not duffel, not crossbody";
  }
  if (lookOccasionAppliesToShirt(garment ?? "")) {
    return "long-sleeve oxford or poplin dress shirt, regular or slim fit, not short-sleeve, not stand-up collar, not relaxed, not viscose, not linen, not camp-collar";
  }
  if (lookOccasionAppliesToBelt(garment ?? "")) {
    return "slim leather dress belt, not stretch, not braided cotton, not active waist";
  }
  if (lookOccasionAppliesToShoe(garment ?? "")) {
    return "leather or suede dress derby or oxford, not mule, not boat shoe, not sandal";
  }
  return "tailored trousers or cotton chinos, not linen, not relaxed fit, not viscose, not drawstring";
}

export function lookOccasionRerankHint(
  occasionId: string | null | undefined,
): string | null {
  if (!lookOccasionIsTailored(occasionId)) return null;
  return (
    "Occasion is Work / meetings or Formal — prefer tailored or cotton chinos " +
    "and a long-sleeve oxford or poplin shirt (regular or slim). " +
    "Do not pick short-sleeve, stand-up collar, linen, relaxed-fit, viscose, drawstring or cargo unless the look names them. " +
    "A belt should be leather, not stretch or braided cotton. " +
    "A travel bag, weekender or duffel is not an office messenger or briefcase."
  );
}
