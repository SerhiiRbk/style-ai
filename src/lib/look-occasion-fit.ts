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
  "boot",
  "boots",
  "chelsea",
  "chukka",
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
const STRIPE_RE = /\b(stripes?|striped|jacquard)\b/i;
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
  /\b(bow\s+shirts?|pussy\s+bow|tie[-\s]?neck|washed|fluid)\b/i;
const NON_DRESS_SHIRT_RE =
  /\b(t-?shirts?|tees?|tank|polo|henley|slogan)\b/i;
const DRESS_SHOE_RE = /\b(derb(?:y|ies)|oxfords?|brogues?)\b/i;
const RAIN_UTILITY_BOOT_RE =
  /\b(rain\s+boots?|wellingtons?|wellies|gumboots?|galoshes?|rubber\s+(?:ankle\s+)?boots?)\b/i;
const HIKING_UTILITY_BOOT_RE =
  /\b(hiking|trek(?:king)?|trail\s+boots?|mountain\s+boots?|all[-\s]?terrain|rugged|outdoor|motorcycle|combat)\b/i;
const LEATHER_FOOTWEAR_RE =
  /\b(leather|calf(?:skin)?|cordovan|nubuck)\b/i;
const LEATHER_BOOT_RE =
  /\b(chelsea|chukka|derby\s+boots?|brogue\s+boots?)\b/i;

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

const NON_BUTTON_SUBTYPES = new Set([
  "tee",
  "polo",
  "henley",
  "hoodie",
  "sweatshirt",
]);
const DRESS_SHOE_SUBTYPES = new Set(["derbies", "oxfords", "loafers"]);
const CASUAL_SHOE_SUBTYPES = new Set(["sneakers", "sandals"]);

export function isWorkDressShirtTitle(
  title: string,
  subtype?: string | null,
): boolean {
  if (subtype && NON_BUTTON_SUBTYPES.has(subtype)) return false;
  return DRESS_SHIRT_RE.test(title) && !FASHION_SHIRT_RE.test(title);
}

/** Tees / polos / knits filed under Shirts. Typed subtype wins; title is fallback. */
export function isNonButtonShirtTitle(
  title: string,
  subtype?: string | null,
): boolean {
  if (subtype && NON_BUTTON_SUBTYPES.has(subtype)) return true;
  if (subtype === "shirt") return false;
  return NON_DRESS_SHIRT_RE.test(title) ||
    /\b(sweat(?:er|shirt)?|hoodie|jersey|vest\s*tops?|camisole)\b/i.test(title);
}

/** True when this title is too casual for Work / Formal unless the clause asked. */
export function isOccasionCasualTrouserTitle(
  title: string,
  clause?: string | null,
  meta?: {
    fit?: string | null;
    materialFamily?: string | null;
    description?: string | null;
    garmentSubtype?: string | null;
  },
): boolean {
  const asked = clause ?? "";
  const subtype = meta?.garmentSubtype ?? "";
  if (subtype === "shorts" && !SHORTS_RE.test(asked)) return true;
  if (subtype === "jeans" && !JEANS_RE.test(asked)) return true;
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
    garmentSubtype?: string | null;
  },
): boolean {
  const asked = clause ?? "";
  if (meta?.garmentSubtype && NON_BUTTON_SUBTYPES.has(meta.garmentSubtype)) {
    return !NON_DRESS_SHIRT_RE.test(asked);
  }
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
  if (STRIPE_RE.test(hay) && !STRIPE_RE.test(asked)) return true;
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
  subtype?: string | null,
): boolean {
  if (isRainUtilityFootwearTitle(title) && !clauseAsksRainUtility(clause)) {
    return true;
  }
  if (HIKING_UTILITY_BOOT_RE.test(title) && !HIKING_UTILITY_BOOT_RE.test(clause ?? "")) {
    return true;
  }
  if (subtype && CASUAL_SHOE_SUBTYPES.has(subtype)) {
    return !CASUAL_SHOE_RE.test(clause ?? "");
  }
  if (!CASUAL_SHOE_RE.test(title)) return false;
  return !CASUAL_SHOE_RE.test(clause ?? "");
}

export function prefersSuedeFootwear(clause?: string | null): boolean {
  return SUEDE_RE.test(clause ?? "");
}

export function prefersLeatherFootwear(clause?: string | null): boolean {
  return LEATHER_FOOTWEAR_RE.test(clause ?? "") || LEATHER_BOOT_RE.test(clause ?? "");
}

/** Smooth leather upper — not suede, unless the title also says leather. */
export function isLeatherUpperFootwear(
  title: string,
  materialFamily?: string | null,
): boolean {
  if (isRainUtilityFootwearTitle(title)) return false;
  if (materialFamily === "suede" && !LEATHER_FOOTWEAR_RE.test(title)) return false;
  return materialFamily === "leather" || LEATHER_FOOTWEAR_RE.test(title);
}

export function isRainUtilityFootwearTitle(title: string): boolean {
  return RAIN_UTILITY_BOOT_RE.test(title);
}

export function clauseAsksRainUtility(clause?: string | null): boolean {
  return RAIN_UTILITY_BOOT_RE.test(clause ?? "");
}

export function prefersLoaferFootwear(clause?: string | null): boolean {
  return /\bloafers?\b/i.test(clause ?? "");
}

export function isLoaferTitle(
  title: string,
  subtype?: string | null,
): boolean {
  if (subtype === "loafers") return true;
  if (subtype && DRESS_SHOE_SUBTYPES.has(subtype)) return false;
  return /\bloafers?\b/i.test(title);
}

export function clauseAsksLinen(clause?: string | null): boolean {
  return LINEN_RE.test(clause ?? "");
}

const CHINO_RE = /\bchinos?\b/i;
const WOOL_TROUSER_RE = /\b(wool|worsted|suit)\b/i;

export function prefersChinoTrousers(
  garment?: string | null,
  clause?: string | null,
): boolean {
  return CHINO_RE.test(`${garment ?? ""} ${clause ?? ""}`);
}

export function prefersWoolTrousers(clause?: string | null): boolean {
  return WOOL_TROUSER_RE.test(clause ?? "");
}

export function isChinoTitle(
  title: string,
  subtype?: string | null,
): boolean {
  if (subtype === "chinos") return true;
  if (subtype === "jeans" || subtype === "shorts") return false;
  return CHINO_RE.test(title);
}

export function isNonDressShirtTitle(
  title: string,
  subtype?: string | null,
): boolean {
  return isNonButtonShirtTitle(title, subtype);
}

/** Fluid / viscose / lyocell fashion shirts — not a Work dress shirt. */
export function isWorkFashionShirtTitle(
  title: string,
  materialFamily?: string | null,
): boolean {
  return (
    FASHION_SHIRT_RE.test(title) ||
    materialFamily === "viscose"
  );
}

export function isSuedeFootwearTitle(
  title: string,
  materialFamily?: string | null,
): boolean {
  if (materialFamily === "suede") return true;
  return SUEDE_RE.test(title);
}

export function isDressFootwearTitle(
  title: string,
  subtype?: string | null,
  materialFamily?: string | null,
): boolean {
  if (isRainUtilityFootwearTitle(title)) return false;
  if (HIKING_UTILITY_BOOT_RE.test(title)) return false;
  if (subtype && DRESS_SHOE_SUBTYPES.has(subtype)) return true;
  if (subtype && CASUAL_SHOE_SUBTYPES.has(subtype)) return false;
  if (DRESS_SHOE_RE.test(title) || LEATHER_BOOT_RE.test(title)) return true;
  const isBoot = subtype === "boots" || /\bboots?\b/i.test(title);
  if (!isBoot) return false;
  return (
    materialFamily === "leather" ||
    materialFamily === "suede" ||
    LEATHER_FOOTWEAR_RE.test(title) ||
    SUEDE_RE.test(title)
  );
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

const DARK_TROUSER_RE =
  /\b(coffee|chocolate|espresso|mocha|brown|navy|charcoal|black|ink|midnight|dark|deep|olive|forest|camel|tan|khaki|taupe|cognac|rust|chestnut|walnut|tobacco)\b/i;
const LIGHT_TROUSER_RE =
  /\b(oatmeal|cream|ivory|ecru|white|beige|sand|stone|oat|bone|champagne|light|pale|greige|mushroom|off[-\s]?white)\b/i;

/**
 * Business default shirt: light blue on light trousers, white on dark / brown
 * (coffee, chocolate, navy, charcoal…). Hex lightness breaks ties.
 */
export function workDefaultShirtColor(
  trouserColor?: string | null,
  trouserHex?: string | null,
): "white" | "light blue" {
  const named = (trouserColor ?? "").trim();
  if (named && DARK_TROUSER_RE.test(named)) return "white";
  if (named && LIGHT_TROUSER_RE.test(named)) return "light blue";
  const hex = (trouserHex ?? "").trim().match(/^#?[0-9a-f]{6}$/i);
  if (hex) {
    const h = hex[0]!.replace(/^#/, "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    return l <= 0.48 ? "white" : "light blue";
  }
  return "light blue";
}

export function lookOccasionQueryHint(
  occasionId: string | null | undefined,
  garment?: string | null,
  clause?: string | null,
): string | null {
  if (!lookOccasionIsTailored(occasionId)) return null;
  if (lookOccasionAppliesToBag(garment ?? "")) {
    return "leather messenger, satchel or slim briefcase, not travel bag, not weekender, not duffel, not crossbody";
  }
  if (lookOccasionAppliesToShirt(garment ?? "")) {
    if (clauseAsksLinen(clause)) {
      return "long-sleeve linen or cotton dress shirt, regular or slim fit, not short-sleeve, not stand-up collar, not camp-collar, not t-shirt";
    }
    return "long-sleeve oxford or poplin dress shirt, regular or slim fit, not short-sleeve, not stand-up collar, not relaxed, not viscose, not linen, not camp-collar";
  }
  if (lookOccasionAppliesToBelt(garment ?? "")) {
    return "slim leather dress belt, not stretch, not braided cotton, not active waist";
  }
  if (lookOccasionAppliesToShoe(garment ?? "")) {
    if (prefersLoaferFootwear(clause)) {
      return "leather or suede loafers, not derby, not oxford, not mule, not boat shoe, not sandal";
    }
    if (/\b(boots?|chelsea|chukka)\b/i.test(`${garment ?? ""} ${clause ?? ""}`)) {
      return "leather or suede chelsea, chukka or lace-up boots, not rain boots, not wellingtons, not rubber, not hiking";
    }
    return "leather or suede dress derby or oxford, not mule, not boat shoe, not sandal";
  }
  if (prefersChinoTrousers(garment, clause) && !prefersWoolTrousers(clause)) {
    return "cotton chinos, not wool, not suit trousers, not relaxed fit, not drawstring";
  }
  if (clauseAsksLinen(clause)) {
    return "tailored trousers or cotton or linen chinos, not relaxed fit, not viscose, not drawstring";
  }
  return "tailored trousers or cotton chinos, not linen, not relaxed fit, not viscose, not drawstring";
}

export function lookOccasionRerankHint(
  occasionId: string | null | undefined,
): string | null {
  if (!lookOccasionIsTailored(occasionId)) return null;
  return (
    "Occasion is Work / meetings or Formal. Trust candidate subtype / material / fit: " +
    "prefer shirt+cotton/linen (regular or slim) and chinos or tailored trousers. " +
    "Skip tee/polo, relaxed, viscose, drawstring and cargo unless the look names them. " +
    "Belt material should be leather. A travel bag is not a messenger."
  );
}
