import { CATEGORIES } from "./schema.mjs";

/**
 * Map a free-text merchant category (and the product title as a fallback) onto
 * our fixed category enum using keyword rules. Extend KEYWORDS as needed.
 */
// Order matters: the first matching rule wins. Keep garments and Accessories
// above the more specialised buckets so existing classifications stay stable;
// the trailing buckets mostly rescue items that used to fall through to "Other".
const KEYWORDS = [
  ["Outerwear", ["coat", "jacket", "blazer", "overshirt", "parka", "trench", "gilet", "puffer", "peacoat", "pea coat", "raincoat", "windbreaker", "anorak", "bomber", "harrington", "mantel", "jacke", "manteau", "cappotto", "abrigo", "chaqueta", "giacca"]],
  ["Knitwear", ["knit", "jumper", "sweater", "cardigan", "pullover", "hoodie", "sweatshirt", "turtleneck", "rollneck", "roll neck", "crewneck", "fleece", "strick", "maglione", "pull"]],
  ["Shirts", ["shirt", "tee", "t-shirt", "polo", "blouse", "henley", "top", "hemd", "oberteil", "camicia", "chemise", "camisa"]],
  ["Swimwear", ["swim", "swimwear", "swimsuit", "board short", "boardshort", "bikini", "badehose", "maillot"]],
  ["Activewear", ["activewear", "sportswear", "tracksuit", "gymwear", "rashguard", "base layer", "compression top"]],
  ["Trousers", ["trouser", "pant", "chino", "jean", "denim", "short", "legging", "slacks", "cargo", "corduroy", "cords", "hose", "pantalon", "pantaloni"]],
  ["Footwear", ["shoe", "sneaker", "trainer", "boot", "loafer", "derby", "sandal", "brogue", "chelsea", "espadrille", "mule", "slipper", "plimsoll", "chukka", "monk strap", "schuh", "scarpa", "zapato", "chaussure"]],
  ["Accessories", ["watch", "belt", "bag", "scarf", "hat", "cap", "glove", "sunglass", "wallet", "tie", "jewel", "cufflink", "pocket square", "beanie", "umbrella", "keyring", "accessoire"]],
  ["Bags", ["backpack", "rucksack", "tote", "holdall", "duffel", "duffle", "weekender", "briefcase", "messenger", "satchel", "crossbody"]],
  ["Underwear", ["underwear", "boxer", "briefs", "trunks", "sock", "socks", "loungewear", "pyjama", "pajama", "undershirt", "long john"]],
  ["Grooming", ["fragrance", "cologne", "perfume", "aftershave", "grooming", "skincare", "moisturiser", "moisturizer", "shampoo", "beard oil", "pomade", "razor"]],
  ["Dresses", ["dress", "gown", "kleid", "skirt", "rock"]],
  ["Suits", ["suit", "tuxedo", "anzug", "completo"]],
];

export function mapCategory(rawCategory, title = "") {
  const hay = `${rawCategory ?? ""} ${title ?? ""}`.toLowerCase();
  for (const [cat, words] of KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return cat;
  }
  // Allow exact passthrough if the feed already uses our enum.
  const exact = CATEGORIES.find((c) => c.toLowerCase() === String(rawCategory).toLowerCase());
  return exact ?? "Other";
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
