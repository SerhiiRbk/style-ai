/**
 * Colour normalisation for the catalogue.
 *
 * Merchant feeds ship free-text colour names ("BURGANDY MARS", "Anthracite
 * Grey", "Sea green") and rarely a hex swatch. This module converts those names
 * into a canonical hex plus a few derived attributes (family / neutral / warm)
 * so the app can reason about colour programmatically — swatches, palette match,
 * and capsule colour harmony — instead of guessing from a raw string.
 *
 * Pure, dependency-free JS so it can be shared by every ingest script.
 */

/** Canonical fashion-colour name → representative hex. */
export const NAMED_COLORS = {
  // neutrals — white / cream / beige family
  white: "#FFFFFF",
  offwhite: "#F4F1EA",
  "off white": "#F4F1EA",
  cream: "#F3EAD3",
  ivory: "#F5F0E1",
  ecru: "#D8CFB8",
  bone: "#E4DCC8",
  sand: "#D9C7A3",
  beige: "#D8C4A0",
  oatmeal: "#D6C9AE",
  stone: "#CBBFA6",
  taupe: "#B8A78C",
  greige: "#C2B7A3",
  khaki: "#B3A272",
  camel: "#C19A6B",
  tan: "#C69B6D",
  caramel: "#B3733B",
  biscuit: "#D3B183",
  // browns
  brown: "#6F4E37",
  chocolate: "#4A2F23",
  coffee: "#4B3621",
  espresso: "#3B2A20",
  cognac: "#8A4B2A",
  tobacco: "#7A5230",
  chestnut: "#7A4A2B",
  mahogany: "#6A2E1F",
  rust: "#A6421E",
  terracotta: "#B4522F",
  "burnt sienna": "#9C4A2A",
  sienna: "#9C4A2A",
  // greys / black
  black: "#111111",
  charcoal: "#36393B",
  anthracite: "#33373A",
  graphite: "#3D4043",
  slate: "#5A6470",
  grey: "#8B8B8B",
  gray: "#8B8B8B",
  "light grey": "#C3C3C3",
  "dark grey": "#4C4C4C",
  silver: "#BFC1C2",
  // blues
  navy: "#28324A",
  "navy blue": "#28324A",
  midnight: "#20263A",
  indigo: "#334065",
  blue: "#2F4B7C",
  "royal blue": "#2B4C9B",
  cobalt: "#2A4DA6",
  denim: "#4A6A88",
  "sky blue": "#8FB6D6",
  "light blue": "#A7C4DB",
  teal: "#2C6E6A",
  petrol: "#2A5A63",
  turquoise: "#3AA6A0",
  // greens
  green: "#3A6B4E",
  olive: "#6B6B47",
  "olive green": "#6B6B47",
  "brownish green": "#5C5840",
  "khaki green": "#6E6A3E",
  khakigreen: "#6E6A3E",
  forest: "#2E4B33",
  "forest green": "#2E4B33",
  emerald: "#2C7A55",
  sage: "#9AA588",
  "sea green": "#2E8B77",
  mint: "#A7D0BC",
  lime: "#9BB53F",
  moss: "#57632F",
  "moss green": "#57632F",
  // reds / pinks
  red: "#A22E2A",
  crimson: "#9B1C2E",
  burgundy: "#5C1A24",
  bordeaux: "#5A1B26",
  maroon: "#5A1E22",
  wine: "#5B2333",
  brick: "#8E3B2E",
  coral: "#E07856",
  salmon: "#E39A82",
  peach: "#E8A882",
  pink: "#E1A0A8",
  rose: "#C99BA0",
  "dusty pink": "#C99BA0",
  "dusty rose": "#C99BA0",
  blush: "#E4C1BE",
  carmine: "#9B1C2E",
  // oranges / yellows
  orange: "#C56A2C",
  amber: "#C68A2E",
  mustard: "#C9A227",
  gold: "#C1913A",
  ochre: "#C08A34",
  yellow: "#D9BB4A",
  copper: "#B87333",
  wheat: "#D9C7A3",
  // purples
  purple: "#5E4B7B",
  plum: "#5A3A56",
  aubergine: "#3E2A3B",
  lavender: "#B3A6C9",
  lilac: "#C0AED4",
  mauve: "#9C6B84",
  violet: "#5E4B7B",
  "dark violet": "#3E2A3B",
  grape: "#5A3A56",
  orchid: "#B3A6C9",
  hyacinth: "#6E8CA6",
  // extra merchant names seen in the live catalogue
  oyster: "#E7E0D0",
  mink: "#8C7B6B",
  mole: "#7A6E60",
  mushroom: "#B9AC9A",
  pistachio: "#A9C08A",
  butter: "#EAD98A",
  pewter: "#8E8E90",
  chambray: "#8CA3BE",
  cedar: "#7A4A2B",
  paprika: "#A6421E",
  toffee: "#8A5A2B",
  vanilla: "#EDE3C8",
  mocha: "#6F4E37",
  granite: "#6E6E6E",
  onyx: "#1A1A1A",
  tangerine: "#E38A2E",
  mandarine: "#E38A2E",
  evergreen: "#20402E",
  "teal green": "#2C6E6A",
  conker: "#5A2E1E",
  brandy: "#8A4B2A",
  ice: "#DCE6EA",
  chrome: "#C7C9CC",
  "air force": "#5D8AA8",
  buff: "#D9C7A3",
  opaline: "#DDE6E2",
};

/** Common merchant typos / synonyms → a dictionary key. */
const COLOR_ALIASES = {
  burgandy: "burgundy",
  burgundywine: "burgundy",
  "off-white": "off white",
  natural: "cream",
  nude: "beige",
  chino: "beige", // "chino" as a colour name (not the garment)
  ecru: "ecru",
  navyblue: "navy blue",
  darknavy: "navy",
  "dark navy": "navy",
  "light stone": "stone",
  "dark olive": "olive",
  "light olive": "olive",
  "brownish-green": "brownish green",
  brownishgreen: "brownish green",
  "olive brown": "brownish green",
  "brown olive": "brownish green",
  "muddy green": "brownish green",
  "dusty green": "sage",
  "pale green": "sage",
  "fresh green": "lime",
  "dark green": "forest green",
  "light green": "sage",
  "dark brown": "chocolate",
  "dusty brown": "tobacco",
  "golden brown": "caramel",
  "light brown": "tan",
  mandarin: "mandarine",
  "mid grey": "grey",
  "grey blue": "slate",
  "blue jeans": "denim",
  "indigo jeans": "indigo",
  "anthracite jeans": "anthracite",
  "dark grey jeans": "dark grey",
  "dusty brown jeans": "tobacco",
  "teal green": "teal green",
  "dark grey": "dark grey",
  "dark gray": "dark grey",
  "light gray": "light grey",
  antracite: "anthracite",
  grigio: "grey",
  marino: "navy",
  marine: "navy",
  bruno: "brown",
  verde: "green",
  ecrù: "ecru",
  airforce: "air force",
  neutral: "beige",
  bluish: "blue",
  greenish: "green",
  greyish: "grey",
  grayish: "grey",
  blues: "blue",
  greys: "grey",
  grays: "grey",
  reddish: "red",
};

/** Marketing/qualifier words to drop when isolating the base colour name. */
const NOISE_WORDS = new Set([
  "mars",
  "wash",
  "washed",
  "effect",
  "melange",
  "mélange",
  "marl",
  "heather",
  "heathered",
  "solid",
  "plain",
  "tone",
  "toned",
  "shade",
  "colour",
  "color",
  "mix",
  "print",
  "printed",
  "pattern",
  "patterned",
  "bright",
  "deep",
  "soft",
  "pale",
  "muted",
  "vintage",
  "faded",
  "medium",
  "mid",
]);

/** Multi-word dictionary keys, longest first, for greedy phrase matching. */
const MULTIWORD_KEYS = Object.keys(NAMED_COLORS)
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length);

/**
 * Dictionary keys that act as wardrobe *neutrals* regardless of their hex hue
 * (menswear beiges/tans/browns/greys/navy behave like a base you can build on).
 */
const NEUTRAL_KEYS = new Set([
  "white", "offwhite", "off white", "cream", "ivory", "ecru", "bone", "sand",
  "beige", "oatmeal", "stone", "taupe", "greige", "khaki", "camel", "tan",
  "brown", "chocolate", "coffee", "espresso", "tobacco", "black", "charcoal",
  "anthracite", "graphite", "slate", "grey", "gray", "light grey", "dark grey",
  "silver", "navy", "navy blue", "midnight",
  "oyster", "mink", "mole", "mushroom", "pewter", "vanilla", "buff", "granite",
]);

/** Generic base-colour words that a more specific word should outrank. */
const GENERIC_COLORS = new Set([
  "grey",
  "gray",
  "blue",
  "green",
  "red",
  "brown",
  "pink",
  "purple",
  "orange",
  "yellow",
  "black",
  "white",
]);

/** True for a well-formed #rgb / #rrggbb string. */
export function isValidHex(hex) {
  return typeof hex === "string" && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex.trim());
}

/** Normalise any accepted hex form to #rrggbb (lowercase). */
export function canonicalHex(hex) {
  if (!isValidHex(hex)) return null;
  let h = hex.trim().replace(/^#/, "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

/** Lowercase, treat hyphens as separators, strip punctuation, collapse space. */
function cleanName(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-zà-ÿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a free-text colour name to a canonical dictionary key, or null.
 * Tries: alias table → exact key → multi-word phrase contained in the string →
 * single base-colour word (ignoring marketing noise words).
 */
export function normalizeColorName(raw) {
  const cleaned = cleanName(raw);
  if (!cleaned) return null;
  if (COLOR_ALIASES[cleaned]) return COLOR_ALIASES[cleaned];
  if (NAMED_COLORS[cleaned]) return cleaned;

  for (const key of MULTIWORD_KEYS) {
    if (cleaned.includes(key)) return key;
  }

  const words = cleaned.split(" ").filter((w) => w && !NOISE_WORDS.has(w));
  // A specific colour word (anthracite, taupe, olive…) beats a generic base
  // word (grey, blue, green) — "Anthracite Grey" should resolve to anthracite,
  // not plain grey.
  let generic = null;
  for (const w of words) {
    const key = COLOR_ALIASES[w] ?? (NAMED_COLORS[w] ? w : null);
    if (!key) continue;
    if (GENERIC_COLORS.has(key)) {
      if (!generic) generic = key;
    } else {
      return key;
    }
  }
  return generic;
}

/**
 * Best hex for a raw colour: a valid provided swatch wins; otherwise map the
 * name via the dictionary. Returns null when nothing can be resolved.
 */
export function colorToHex(rawName, providedHex) {
  // A valid swatch wins — either the explicit hex field or a hex sitting in the
  // name field (some feeds put "#6B6B47" straight into `color`).
  const hex = canonicalHex(providedHex) ?? canonicalHex(rawName);
  if (hex) return hex;
  const key = normalizeColorName(rawName);
  return key ? NAMED_COLORS[key] : null;
}

/** Convert #rrggbb → HSL with h in [0,360), s/l in [0,1]. */
export function hexToHsl(hex) {
  const h = canonicalHex(hex);
  if (!h) return null;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / d + 2) * 60;
    else hue = ((r - g) / d + 4) * 60;
  }
  return { h: hue, s, l };
}

/** Coarse colour family from HSL. */
function familyFromHsl({ h, s, l }) {
  if (l < 0.12) return "black";
  if (l > 0.9 && s < 0.15) return "white";
  if (s < 0.14) return "grey";
  if (h < 20 || h >= 345) return "red";
  if (h < 45) return s < 0.5 && l < 0.5 ? "brown" : "orange";
  if (h < 70) return "yellow";
  if (h < 170) return "green";
  if (h < 255) return "blue";
  if (h < 300) return "purple";
  return "pink";
}

/**
 * Derived attributes for a hex: family, neutral (works with almost anything),
 * and warm/cool temperature. Neutrals are low-saturation or the classic
 * menswear neutrals (beige/brown/navy/charcoal) that behave like a base.
 */
export function colorAttrs(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const family = familyFromHsl(hsl);
  const neutralFamily =
    family === "grey" || family === "black" || family === "white" || family === "brown";
  // Light, softly-saturated warm tones (beige, sand, stone, oatmeal, ecru,
  // cream) behave as base neutrals even though their hue reads orange/yellow.
  const paleNeutral = hsl.l > 0.68 && hsl.s < 0.45;
  const neutral =
    neutralFamily || paleNeutral || hsl.s < 0.22 || hsl.l < 0.14 || hsl.l > 0.85;
  // Warm hues: reds/oranges/yellows/browns; cool: greens/blues/purples.
  const warm = hsl.h < 70 || hsl.h >= 330;
  return {
    family,
    neutral,
    warm,
    saturation: Math.round(hsl.s * 100) / 100,
  };
}

/**
 * Full normalisation for one product colour. Returns the canonical hex plus its
 * attributes, or null when the colour can't be resolved (caller keeps the raw
 * name for display and leaves the hex empty).
 */
/** Named keys whose HSL lands near yellow/brown but should read as green in-app. */
const FORCE_GREEN_FAMILY = new Set([
  "olive",
  "olive green",
  "brownish green",
  "khaki green",
  "khakigreen",
  "moss",
  "moss green",
  "sage",
  "forest",
  "forest green",
  "evergreen",
]);

export function normalizeColor(rawName, providedHex) {
  const hex = colorToHex(rawName, providedHex);
  if (!hex) return null;
  const attrs = colorAttrs(hex) ?? {};
  // A recognised neutral name (taupe, camel, navy…) stays neutral even if its
  // hue/saturation would otherwise read as an accent.
  const key = normalizeColorName(rawName);
  const neutral = Boolean(attrs.neutral) || (key ? NEUTRAL_KEYS.has(key) : false);
  const family =
    key && FORCE_GREEN_FAMILY.has(key) ? "green" : attrs.family;
  return { hex, ...attrs, family, neutral };
}
