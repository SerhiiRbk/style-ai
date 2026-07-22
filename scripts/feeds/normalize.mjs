import { CATEGORIES } from "./schema.mjs";

/**
 * Weighted, word-boundary category signals used to classify a product from its
 * TITLE (the reliable signal) with the merchant category only as a weak hint.
 *
 * Weight encodes specificity so a decisive noun beats a generic/material one:
 *   4 = highly specific / disambiguating (polo, t-shirt, swim, suit jacket)
 *   3 = specific garment noun (jumper, chinos, derby, belt)
 *   2 = generic garment noun (jacket, shirt, shoe)
 *   1 = material / weak cue (denim, corduroy)
 *
 * Bags fold into Accessories (the recommendation flow queries Accessories, not
 * Bags) so a bag stays shoppable and consistent with existing data.
 */
const CATEGORY_SIGNALS = [
  // Outerwear — specific nouns beat the material words below.
  { c: "Outerwear", w: 4, re: /\bsuit jackets?\b|\bsuit blazers?\b/i },
  { c: "Outerwear", w: 3, re: /\b(coats?|overcoats?|topcoats?|peacoats?|pea coats?|trench(?:es|coats?)?|parkas?|gilets?|vests?|puffers?|raincoats?|windbreakers?|anoraks?|bombers?|harringtons?|blazers?|sport coats?|overshirts?|shackets?|waistcoats?)\b/i },
  { c: "Outerwear", w: 2, re: /\b(jackets?|jacke|manteau|cappotto|abrigo|chaqueta|giacca)\b/i },
  // Knitwear
  { c: "Knitwear", w: 3, re: /\b(pullovers?|jumpers?|sweaters?|cardigans?|turtlenecks?|rollnecks?|roll necks?|hoodies?|sweatshirts?|maglione)\b/i },
  { c: "Knitwear", w: 2, re: /\b(knit|knitted|crewnecks?|crew necks?|fleece|strick)\b/i },
  // Shirts — polo/tee are more specific than a generic "knitted" adjective.
  { c: "Shirts", w: 4, re: /\b(polos?|t-?shirts?|tees?|henleys?|longsleeves?|long[- ]sleeves?)\b/i },
  { c: "Shirts", w: 2, re: /\b(shirts?|blouses?|tank tops?|tops?|hemd|camicia|chemise|camisa)\b/i },
  // Swimwear — beats "trunks" (Underwear) for swimming trunks.
  { c: "Swimwear", w: 4, re: /\b(swim(?:ming|wear|suits?)?|boardshorts?|board shorts?|bikinis?|badehose|maillot)\b/i },
  // Activewear
  { c: "Activewear", w: 3, re: /\b(activewear|sportswear|tracksuits?|gymwear|rashguards?|base layers?|compression tops?)\b/i },
  // Trousers — garment nouns w3, material/ambiguous w1.
  { c: "Trousers", w: 3, re: /\b(trousers?|chinos?|jeans?|slacks?|leggings?|cargos?|shorts|bermudas?|joggers?|sweatpants?|pantalon|pantaloni)\b/i },
  { c: "Trousers", w: 1, re: /\b(pants?|denim|corduroy|cords|hose)\b/i },
  // Footwear
  { c: "Footwear", w: 3, re: /\b(sneakers?|trainers?|boots?|loafers?|derby|derbies|sandals?|brogues?|espadrilles?|mules?|slippers?|plimsolls?|chukkas?|monk straps?|oxfords?|slides?|sliders?|flip[- ]?flops?|schuh|scarpa|zapato|chaussure)\b/i },
  { c: "Footwear", w: 2, re: /\b(shoes?|chelsea)\b/i },
  // Accessories (bags folded in)
  { c: "Accessories", w: 3, re: /\b(watch(?:es)?|belts?|scarf|scarves|gloves?|sunglasses|wallets?|cufflinks?|pocket squares?|beanies?|umbrellas?|bow ties?|ties?|caps?|hats?|jewel\w*|keyrings?|backpacks?|rucksacks?|totes?|holdalls?|duffels?|duffles?|weekenders?|briefcases?|satchels?|crossbody|bags?)\b/i },
  // Underwear
  { c: "Underwear", w: 3, re: /\b(boxers?|briefs|trunks|socks?|pyjamas?|pajamas?|undershirts?|loungewear|long johns?)\b/i },
  // Grooming
  { c: "Grooming", w: 3, re: /\b(fragrances?|cologne|perfumes?|aftershave|grooming|skincare|moisturisers?|moisturizers?|shampoo|beard oil|pomade|razors?)\b/i },
  // Dresses (the "dress" adjective guard runs first — see mapCategory)
  { c: "Dresses", w: 3, re: /\b(dress(?:es)?|gowns?|skirts?|kleid)\b/i },
  // Suits — a bare "suit"/"tuxedo"; a specific garment noun (trousers, suit
  // jacket) outranks it via higher weight.
  { c: "Suits", w: 2, re: /\b(suits?|tuxedos?|anzug|completo)\b/i },
];

/** Deterministic tie-break order when two categories score equally. */
const TIEBREAK_ORDER = [
  "Footwear", "Trousers", "Knitwear", "Shirts", "Outerwear", "Suits",
  "Dresses", "Swimwear", "Activewear", "Underwear", "Accessories",
  "Grooming", "Other",
];

/** Drop JSON `null` on optional scraper fields so Zod `.optional()` accepts rows. */
export function sanitizeScraperNulls(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw) };
  for (const [k, v] of Object.entries(r)) {
    if (v === null) delete r[k];
  }
  return r;
}

/**
 * Classify a product into our fixed category enum.
 *
 * Strategy: the TITLE is the reliable signal, so score it with weighted,
 * word-boundary rules; the merchant `rawCategory` only nudges as a weak hint
 * when it already equals one of our enum values. Guardrails handle known traps:
 *  - "dress shirt/shoes/pants/boots" — "dress" is an adjective, not Dresses.
 *  - only the head of the title (before " with …") decides the main garment, so
 *    "shirt with cufflinks" is Shirts, not Accessories.
 */
/**
 * Merchant nav labels (Reserved / Zara / M&S etc.) → our enum. Used when the
 * title is ambiguous ("Cotton top") so we don't drop everything into Other.
 */
const MERCHANT_CATEGORY_ALIASES = {
  "t-shirts": "Shirts",
  "tshirts": "Shirts",
  "polo shirts": "Shirts",
  polos: "Shirts",
  shirts: "Shirts",
  "jumpers, cardigans": "Knitwear",
  jumpers: "Knitwear",
  cardigans: "Knitwear",
  "hoodies, sweatshirts": "Knitwear",
  hoodies: "Knitwear",
  sweatshirts: "Knitwear",
  "coats, jackets": "Outerwear",
  coats: "Outerwear",
  jackets: "Outerwear",
  blazers: "Outerwear",
  trousers: "Trousers",
  jeans: "Trousers",
  shorts: "Trousers",
  "beach shorts": "Swimwear",
  shoes: "Footwear",
  "ties, bow ties": "Accessories",
  "belts, gadgets": "Accessories",
  "bags, toiletry bags": "Accessories",
  "caps, hats, scarves": "Accessories",
  sunglasses: "Accessories",
  socks: "Underwear",
  "boxers, briefs": "Underwear",
  nightwear: "Underwear",
};

function merchantCategoryHint(rawCategory) {
  const key = String(rawCategory ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return undefined;
  const exact = CATEGORIES.find((c) => c.toLowerCase() === key);
  if (exact) return exact;
  return MERCHANT_CATEGORY_ALIASES[key];
}

export function mapCategory(rawCategory, title = "") {
  const rawTitle = String(title ?? "");
  // Guard 1: neutralise the "dress" adjective in "dress shirt/shoes/…".
  let deadjectived = rawTitle.replace(
    /\bdress(?=\s+(?:shirts?|shoes?|pants?|trousers?|boots?)\b)/gi,
    " ",
  );
  // Guard 1b: "oxford" means the shoe — except in "oxford (cloth) shirt", where
  // it's a fabric/collar. If the title mentions a shirt, drop "oxford" so it
  // classifies as Shirts, not Footwear.
  if (/\bshirts?\b/i.test(deadjectived)) {
    deadjectived = deadjectived.replace(/\boxfords?\b/gi, " ");
  }
  // Guard 2: the garment is decided by the head before " with " (accessory
  // details like "with tie/hood/pocket square" shouldn't hijack the category).
  const head = deadjectived.split(/\bwith\b/i)[0] || deadjectived;

  const scoreText = (text) => {
    const scores = new Map();
    for (const { c, w, re } of CATEGORY_SIGNALS) {
      if (re.test(text) && (scores.get(c) ?? 0) < w) scores.set(c, w);
    }
    return scores;
  };

  // Prefer the head; fall back to the full (de-adjectived) title if the head
  // carries no signal (e.g. the noun sits after "with").
  let scores = scoreText(head);
  if (scores.size === 0) scores = scoreText(deadjectived);

  const rawExact = merchantCategoryHint(rawCategory);

  // No title signal at all → keep the merchant category (or Other).
  if (scores.size === 0) return rawExact ?? "Other";

  // Winner = highest TITLE score. The merchant category is NOT added to the
  // score (a weak hint must never beat a stronger title noun); it only breaks a
  // genuine tie, after which the deterministic order decides.
  const maxW = Math.max(...scores.values());
  const winners = [...scores.entries()]
    .filter(([, s]) => s === maxW)
    .map(([c]) => c);
  if (winners.length === 1) return winners[0];
  if (rawExact && rawExact !== "Other" && winners.includes(rawExact)) {
    return rawExact;
  }
  return winners.sort(
    (a, b) => TIEBREAK_ORDER.indexOf(a) - TIEBREAK_ORDER.indexOf(b),
  )[0];
}

/** Static FX fallback (override per-run via FX_RATES env as JSON). Rate = units per 1 EUR. */
const DEFAULT_FX = { EUR: 1, GBP: 0.85, USD: 1.08, CAD: 1.47, PLN: 4.3, SEK: 11.3, DKK: 7.46, CHF: 0.96, NOK: 11.5, CZK: 25.0 };

export function toEur(price, currency, ratesEnv) {
  const rates = ratesEnv ? { ...DEFAULT_FX, ...ratesEnv } : DEFAULT_FX;
  const cur = (currency || "EUR").toUpperCase();
  const rate = rates[cur];
  if (!rate || !Number.isFinite(price)) return Number.isFinite(price) ? price : 0;
  return Math.round((price / rate) * 100) / 100;
}

export function parsePrice(raw) {
  if (raw == null) return NaN;
  if (typeof raw === "number") return raw;
  // Handle "1.299,00", "1,299.00", "129.99 GBP", "£129.99"
  const cleaned = String(raw).replace(/[^\d.,]/g, "");
  if (!cleaned) return NaN;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    // comma is the decimal separator
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // dot is decimal (or none) — strip thousands commas
    normalized = cleaned.replace(/,/g, "");
  }
  return parseFloat(normalized);
}

export function parseBool(raw) {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).toLowerCase();
  if (["1", "true", "yes", "y", "in stock", "instock", "available"].includes(s)) return true;
  if (["0", "false", "no", "n", "out of stock", "unavailable"].includes(s)) return false;
  return undefined;
}

/** Coarse availability region from currency when a feed doesn't state one. */
export function inferMarket(currency) {
  const c = String(currency || "").toUpperCase();
  if (c === "USD" || c === "CAD") return "US";
  return "EU";
}

/** Currencies that map 1:1 to a single country (EUR is shared → no mapping). */
const CURRENCY_COUNTRY = {
  GBP: "GB", PLN: "PL", CZK: "CZ", SEK: "SE", DKK: "DK", NOK: "NO",
  CHF: "CH", USD: "US", CAD: "CA", HUF: "HU", RON: "RO", BGN: "BG",
};

/** Canonical offer-country token: "Global" (region-generic) or ISO-2 uppercase. */
export function normalizeCountry(c) {
  const s = String(c ?? "").trim();
  if (!s || s.toLowerCase() === "global") return "Global";
  return s.toUpperCase();
}

/**
 * Country of an offer: explicit feed value → currency-derived (for non-EUR) →
 * per-source default → "Global" (region-generic, e.g. a EUR feed without a
 * country).
 */
export function inferCountry(explicit, currency, defaultCountry) {
  const e = String(explicit ?? "").trim();
  if (e.toLowerCase() === "global") return "Global";
  if (/^[A-Za-z]{2}$/.test(e)) return e.toUpperCase();
  const cc = CURRENCY_COUNTRY[String(currency ?? "").toUpperCase()];
  if (cc) return cc;
  const d = String(defaultCountry ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(d)) return d.toUpperCase();
  return "Global";
}

/**
 * Stable identity for a product ACROSS feeds/countries. Used to merge the same
 * physical item (sold in many countries) into one `products` row with many
 * `product_offers`. EAN/GTIN is best; otherwise brand+mpn(+colour); last resort
 * is the legacy per-source identity.
 */
export function productKey(p) {
  const ck = p.color_key ?? colorKey(p.color, p.colorHex);
  const ean = String(p.ean ?? "").replace(/[^0-9a-z]/gi, "").trim();
  if (ean) return `ean:${ean}`;
  const brand = String(p.brand ?? "").trim().toLowerCase();
  const mpn = String(p.mpn ?? p.sku ?? "").trim().toLowerCase();
  if (brand && mpn) return `bm:${brand}:${mpn}:${ck}`;
  const ext = p.externalId ?? p.external_id ?? "";
  return `se:${p.source ?? ""}:${ext}:${ck}`;
}

export function inferGender(...values) {
  const hay = values.join(" ").toLowerCase();
  if (/\b(women|woman|female|womens|ladies|damen|femme|donna|mujer)\b/.test(hay)) return "women";
  if (/\b(men|man|male|mens|herren|homme|uomo|hombre)\b/.test(hay)) return "men";
  if (/\b(kid|kids|child|children|boy|girl|kinder)\b/.test(hay)) return "kids";
  if (/\bunisex\b/.test(hay)) return "unisex";
  return undefined;
}

/** Embedding text used for semantic matching. */
export function embedText(p) {
  return [p.brand, p.title, p.category, p.color, p.gender, p.description]
    .filter(Boolean)
    .join(". ");
}

/** Normalised colour slug used in the catalogue variant key. */
export function colorKey(color, colorHex) {
  return (color ?? colorHex ?? "").toString().trim().toLowerCase();
}

/** Upsert / dedup key: parent SKU + colour (same id, different colours stay). */
export function productVariantKey(p) {
  const ext = p.externalId ?? p.external_id;
  const ck = p.color_key ?? colorKey(p.color, p.colorHex);
  return `${p.source}::${ext}::${ck}`;
}

/**
 * Collapse duplicate rows that share the same (source, externalId, colour).
 * Last occurrence wins — e.g. repeated size rows for one colour variant.
 */
export function dedupeProducts(products) {
  const seen = new Map();
  let duplicatesRemoved = 0;
  for (const p of products) {
    const key = productVariantKey(p);
    if (seen.has(key)) duplicatesRemoved++;
    seen.set(key, p);
  }
  return { products: [...seen.values()], duplicatesRemoved };
}
