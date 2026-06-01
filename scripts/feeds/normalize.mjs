import { CATEGORIES } from "./schema.mjs";

/**
 * Map a free-text merchant category (and the product title as a fallback) onto
 * our fixed category enum using keyword rules. Extend KEYWORDS as needed.
 */
const KEYWORDS = [
  ["Outerwear", ["coat", "jacket", "blazer", "overshirt", "parka", "trench", "gilet", "mantel", "jacke"]],
  ["Knitwear", ["knit", "jumper", "sweater", "cardigan", "pullover", "hoodie", "sweatshirt", "strick"]],
  ["Shirts", ["shirt", "tee", "t-shirt", "polo", "blouse", "top", "hemd", "oberteil"]],
  ["Trousers", ["trouser", "pant", "chino", "jean", "denim", "short", "legging", "hose"]],
  ["Footwear", ["shoe", "sneaker", "trainer", "boot", "loafer", "derby", "sandal", "schuh"]],
  ["Accessories", ["watch", "belt", "bag", "scarf", "hat", "cap", "glove", "sunglass", "wallet", "tie", "jewel", "accessoire"]],
  ["Dresses", ["dress", "gown", "kleid", "skirt", "rock"]],
  ["Suits", ["suit", "tuxedo", "anzug"]],
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
