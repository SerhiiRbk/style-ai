/**
 * Rule-based style tags for a catalogue product.
 *
 * Recommendation scoring used to rely almost entirely on the product *title*
 * plus vector similarity, which is blind to items with weak lexical signals
 * ("Contrast Reversed Seam Jumper" scores 0 for everything). These tags give
 * every product three cheap, structured signals — computed at ingest so the app
 * can rank on data rather than substrings:
 *
 *   formality    1 (beach/sport) … 5 (black-tie / full formal)   | null = n/a
 *   trend_level  0 (timeless) … 3 (loud, of-the-moment)
 *   versatility  0 (hard to place) … 3 (works with almost anything)
 *
 * Pure, dependency-light JS so every ingest script can share it.
 */
import { normalizeColor } from "./color.mjs";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const has = (re, s) => re.test(s);

/** Loud / of-the-moment cues that push trend_level up for any wardrobe. */
const GIMMICK_RE =
  /\b(slogan|graphic|logo|printed|print|ripped|distressed|acid[-\s]?wash|tie[-\s]?dye|sequin|neon|camo|leopard|zebra)\b/i;
/** Directional-but-not-gimmicky cues — mildly trend-forward. */
const TREND_RE =
  /\b(oversized|cropped|baggy|balloon|wide[-\s]?leg|utility|cargo|chunky|platform|puff|parachute|boxy)\b/i;
/** Timeless staples that read versatile and low-trend. */
const STAPLE_RE =
  /\b(classic|tailored|oxford|derby|loafer|chelsea|crew[-\s]?neck|crewneck|merino|cashmere|chino|straight[-\s]?leg|button[-\s]?down|trench|pea[-\s]?coat|overcoat)\b/i;

/** Casual footwear (sandals/slides/clogs) — never formal. */
const CASUAL_FOOTWEAR_RE =
  /\b(sandals?|sndls?|slides?|flip[-\s]?flops?|espadrilles?|clogs?|havaianas|thongs?|pool sliders?)\b/i;
/** Dress footwear — high formality. */
const DRESS_FOOTWEAR_RE =
  /\b(oxfords?|derby|derbies|brogues?|loafers?|monks?|monk straps?|chelsea|dress boots?|leather boots?|whole[-\s]?cuts?)\b/i;
const SNEAKER_RE = /\b(sneakers?|trainers?|plimsolls?|running|court shoes?)\b/i;

/** Casual outerwear that reads down-dressed. */
const CASUAL_OUTERWEAR_RE =
  /\b(field jacket|hood(?:ed|ie)?|bomber|parka|anorak|gilet|puffer|windbreaker|shacket|denim jacket|track(?:suit| jacket)?|cagoule|fleece)\b/i;
/** Tailored outerwear — high formality. */
const TAILORED_OUTERWEAR_RE =
  /\b(blazer|suit jacket|sport coat|overcoat|topcoat|trench|pea[-\s]?coat|wool coat|tailored)\b/i;

const ATHLEISURE_RE =
  /\b(joggers?|sweat\s?pants?|track\s?pants?|tracksuit|leggings?|drawstring)\b/i;

/** Base formality per category before title adjustments. null = not applicable. */
function baseFormality(category, title) {
  const t = title || "";
  switch (category) {
    case "Suits":
      return 5;
    case "Outerwear":
      if (has(TAILORED_OUTERWEAR_RE, t)) return 4;
      if (has(CASUAL_OUTERWEAR_RE, t)) return 2;
      return 3;
    case "Shirts":
      if (/\bpolo\b/i.test(t)) return 3;
      if (/\b(t-?shirt|tee|henley|tank)\b/i.test(t)) return 2;
      return 4; // button shirts
    case "Knitwear":
      if (/\b(hoodie|sweatshirt)\b/i.test(t)) return 2;
      return 3;
    case "Trousers":
      if (has(ATHLEISURE_RE, t) || /\bcargo\b/i.test(t)) return 1;
      if (/\b(jeans?|denim)\b/i.test(t)) return 2;
      if (/\b(wool|suit|dress|tailored|pleated)\b/i.test(t)) return 4;
      if (/\bchinos?\b/i.test(t)) return 3;
      return 3;
    case "Footwear":
      if (has(CASUAL_FOOTWEAR_RE, t)) return 1;
      if (has(DRESS_FOOTWEAR_RE, t)) return 4;
      if (has(SNEAKER_RE, t)) return 2;
      if (/\bboots?\b/i.test(t)) return 3;
      return 3;
    case "Accessories":
      if (/\b(tie|bow tie|cufflink|pocket square)\b/i.test(t)) return 5;
      if (/\b(cap|beanie|bandana|bucket hat)\b/i.test(t)) return 2;
      return 3;
    case "Bags":
      if (/\b(briefcase|attaché|portfolio)\b/i.test(t)) return 4;
      if (/\b(backpack|duffel|duffle|gym)\b/i.test(t)) return 2;
      return 3;
    case "Dresses":
      return 3;
    case "Activewear":
    case "Swimwear":
    case "Underwear":
      return 1;
    default:
      return null; // Grooming / Other — formality not meaningful
  }
}

/** trend_level 0..3 from loud/directional/staple cues. */
function trendLevel(title) {
  const t = title || "";
  let n = 0;
  if (has(GIMMICK_RE, t)) n += 2;
  if (has(TREND_RE, t)) n += 1;
  if (has(STAPLE_RE, t)) n -= 1;
  return clamp(n, 0, 3);
}

/**
 * versatility 0..3 — neutral colour + staple category + low trend read as easy
 * to build a wardrobe around; loud/colourful/niche pieces read harder to place.
 */
function versatility(category, title, trend, neutral) {
  let n = 1;
  if (neutral) n += 1;
  const coreCategory = [
    "Outerwear",
    "Trousers",
    "Knitwear",
    "Shirts",
    "Footwear",
  ].includes(category);
  if (coreCategory && has(STAPLE_RE, title || "")) n += 1;
  if (trend >= 2) n -= 1;
  if (["Swimwear", "Activewear", "Underwear"].includes(category)) n -= 1;
  return clamp(n, 0, 3);
}

/**
 * Compute the three style tags for a canonical product. `formality` is null for
 * categories where it isn't meaningful (grooming, misc).
 */
export function tagsFor(p) {
  const title = p.title ?? "";
  const category = p.category ?? "Other";
  const formality = baseFormality(category, title);
  const trend = trendLevel(title);
  const norm = normalizeColor(p.color, p.colorHex);
  const neutral = norm ? Boolean(norm.neutral) : false;
  const vers = versatility(category, title, trend, neutral);
  return { formality, trend_level: trend, versatility: vers };
}
