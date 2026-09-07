/**
 * The colour brain shared by every layer: colour families and shades, hex
 * geometry, leather tones, the avoid-palette gate and the near-face gates,
 * swatch trust. If a rule about a COLOUR exists once, it lives here — the
 * recipes, the capsule and the catalogue matcher all import it.
 */
import { hexToHsl, hueDist } from "@/lib/colour-palette";
export { hexToHsl, hueDist };
import type { ColorRec } from "@/lib/report";
import { isAccentForPalette, paletteRoleForHex } from "@/lib/palette-roles";

import {
  isBlackTieItem,
  isClassicBusinessLeather,
  isFormalOccasion,
  isJeanTitle,
  isTailoredOvercoat,
} from "@/lib/garment-title";
import type {
  AvoidPaletteOpts,
} from "@/lib/garment-title";


/** Classic formal leather family — burgundy sits with brown for belt/shoe harmony. */
export function classicDressLeatherFamily(
  text: string,
  hex?: string | null,
): "black" | "brown" | "burgundy" | null {
  const hay = `${text} ${hex ?? ""}`.toLowerCase();
  if (/burgundy|oxblood|wine|cordovan/.test(hay)) return "burgundy";
  if (/\bblack\b/.test(hay)) return "black";
  if (/brown|cognac|tan|chestnut|espresso|chocolate|mocha/.test(hay)) {
    return "brown";
  }
  return leatherToneFamily(text);
}

export function leatherAnchorTone(text: string): "black" | "brown" | null {
  const classic = classicDressLeatherFamily(text);
  if (classic === "black") return "black";
  if (classic === "brown" || classic === "burgundy") return "brown";
  return leatherToneFamily(text);
}

export const GREY_COLUMN = new Set(["grey", "gray", "greige", "charcoal", "stone", "taupe"]);

/** Human colour word for a capsule piece so the image prompt is not title-only. */
export function capsuleColorWord(
  title: string,
  hex?: string | null,
  colorName?: string | null,
): string {
  const named = colorName?.trim();
  if (named && !/^#?[0-9a-f]{6}$/i.test(named)) return named.toLowerCase();
  // Catalogue hex often lies (a "navy" windbreaker tagged #CCCCCC). A named
  // colour in the title wins when the swatch is a washed-out grey.
  if (/\bnavy\b/i.test(title)) {
    const parsedNavy = parseHexColor(hex ?? "");
    if (!parsedNavy || hexToHsl(parsedNavy).l > 0.42) return "navy";
  }
  const parsed = parseHexColor(hex ?? "");
  if (parsed) {
    const { h, s, l } = hexToHsl(parsed);
    if (s < 0.12) {
      if (l <= 0.22) return "charcoal";
      if (l <= 0.4) return "dark grey";
      if (l <= 0.62) return "mid grey";
      if (l <= 0.82) return "light grey";
      return "off-white";
    }
    if (h >= 200 && h < 255 && l < 0.38) return "navy";
    // Muted yellow-green hexes are olive, not the avoid-palette word "yellow".
    if (h >= 40 && h < 80 && s < 0.38 && l >= 0.18 && l <= 0.55) return "olive";
    return familyFromHex(parsed) ?? "";
  }
  const fams = colorFamilies(title);
  if (fams.has("grey")) return "grey";
  if (fams.has("blue") && /\bnavy\b/i.test(title)) return "navy";
  const first = [...fams][0];
  return first ?? "";
}

export function pieceLightness(title: string, colorByTitle: Map<string, string>): number | null {
  const hex = parseHexColor(colorByTitle.get(title) ?? "");
  if (hex) return hexToHsl(hex).l;
  if (/\b(charcoal|navy|black|ink)\b/i.test(title)) return 0.2;
  if (/\b(grey|gray|greige|stone|taupe|heather)\b/i.test(title)) return 0.55;
  if (/\b(white|ivory|cream|oat|oatmeal)\b/i.test(title)) return 0.88;
  return null;
}

export function pieceHsl(
  title: string,
  colorByTitle: Map<string, string>,
): { h: number; s: number; l: number } | null {
  const hex = parseHexColor(colorByTitle.get(title) ?? "");
  if (hex) return hexToHsl(hex);
  return null;
}

export function isMidNeutralPiece(
  title: string,
  colorByTitle: Map<string, string>,
  best?: ColorRec[],
): boolean {
  const hsl = pieceHsl(title, colorByTitle);
  const palette = (best ?? []).filter((c) => c.hex);
  if (hsl && palette.length) {
    const hex = parseHexColor(colorByTitle.get(title) ?? "")!;
    const role = paletteRoleForHex(hex, palette);
    return (
      !isAccentForPalette(hex, palette) &&
      role !== "anchor" &&
      hsl.l >= 0.42 &&
      hsl.l <= 0.88
    );
  }
  if (hsl) return hsl.s < 0.18 && hsl.l >= 0.42 && hsl.l <= 0.88;
  return (
    /\b(greige|taupe|mushroom|stone|camel|beige|sand|khaki|oatmeal|heather)\b/i.test(
      title,
    ) ||
    (/\b(grey|gray)\b/i.test(title) && !/\b(charcoal|dark|navy|black)\b/i.test(title))
  );
}

export function isDarkAnchorPiece(
  title: string,
  colorByTitle: Map<string, string>,
  best?: ColorRec[],
): boolean {
  const hsl = pieceHsl(title, colorByTitle);
  // With the report palette, a piece that sits on the palette's dark anchor is
  // one, whatever the fixed lightness cut says (a bright palette's navy at
  // l 0.38 is still its anchor).
  if (hsl && best?.length) {
    const hex = parseHexColor(colorByTitle.get(title) ?? "")!;
    if (paletteRoleForHex(hex, best.filter((c) => c.hex)) === "anchor") return true;
  }
  if (hsl && hsl.l <= 0.36) {
    if (hsl.s < 0.28) return true;
    if (hsl.h < 45 || hsl.h > 330) return true;
    if (hsl.h >= 200 && hsl.h < 260) return true;
    return false;
  }
  return /\b(navy|charcoal|black|ink|espresso|coffee)\b/i.test(title);
}

type Shade = "light" | "mid" | "dark";

/**
 * Colour-word taxonomy: maps each recognised colour token to a hue `family` and,
 * where the word itself implies lightness, a `shade`. Named greys are the key
 * case — "dove/ash/silver" read light, bare "grey/heather" read mid, and
 * "charcoal/slate/asphalt" read dark, so a mid-grey look no longer ranks
 * light-grey and charcoal products as equal matches.
 */
const COLOR_FAMILY: Record<string, { family: string; shade?: Shade }> = {
  // Names the report's own palettes and the catalogue feeds use that scored
  // as "no family" (a neutral 0.5 for every candidate) before the colour audit.
  coral: { family: "pink", shade: "mid" }, salmon: { family: "pink", shade: "light" },
  peach: { family: "pink", shade: "light" }, apricot: { family: "orange", shade: "light" },
  mint: { family: "green", shade: "light" }, aqua: { family: "blue", shade: "light" },
  turquoise: { family: "blue", shade: "mid" }, cobalt: { family: "blue", shade: "mid" },
  periwinkle: { family: "blue", shade: "light" }, cornflower: { family: "blue", shade: "light" },
  denim: { family: "blue", shade: "mid" }, petrol: { family: "blue", shade: "dark" },
  royal: { family: "blue", shade: "mid" }, sapphire: { family: "blue", shade: "dark" },
  azure: { family: "blue", shade: "mid" }, ink: { family: "blue", shade: "dark" },
  steel: { family: "grey", shade: "mid" }, marl: { family: "grey", shade: "mid" },
  ruby: { family: "red", shade: "dark" }, wine: { family: "red", shade: "dark" },
  oxblood: { family: "red", shade: "dark" }, cordovan: { family: "red", shade: "dark" },
  bordeaux: { family: "red", shade: "dark" }, claret: { family: "red", shade: "dark" },
  cherry: { family: "red", shade: "mid" }, crimson: { family: "red", shade: "mid" },
  scarlet: { family: "red", shade: "mid" }, brick: { family: "red", shade: "mid" },
  sienna: { family: "brown", shade: "mid" }, cocoa: { family: "brown", shade: "dark" },
  tobacco: { family: "brown", shade: "mid" }, walnut: { family: "brown", shade: "dark" },
  mahogany: { family: "brown", shade: "dark" }, caramel: { family: "brown", shade: "mid" },
  toffee: { family: "brown", shade: "mid" }, hazel: { family: "brown", shade: "mid" },
  umber: { family: "brown", shade: "dark" }, bronze: { family: "brown", shade: "dark" },
  neutral: { family: "brown", shade: "light" },
  butter: { family: "yellow", shade: "light" }, lemon: { family: "yellow", shade: "light" },
  canary: { family: "yellow", shade: "mid" }, honey: { family: "yellow", shade: "mid" },
  snow: { family: "white", shade: "light" }, chalk: { family: "white", shade: "light" },
  natural: { family: "white", shade: "light" },
  spruce: { family: "green", shade: "dark" }, pine: { family: "green", shade: "dark" },
  jade: { family: "green", shade: "mid" }, moss: { family: "green", shade: "mid" },
  hunter: { family: "green", shade: "dark" },
  violet: { family: "purple", shade: "mid" }, grape: { family: "purple", shade: "dark" },
  eggplant: { family: "purple", shade: "dark" },
  // grey — bare grey/heather imply mid so light and charcoal stop scoring 0.8
  grey: { family: "grey", shade: "mid" },
  gray: { family: "grey", shade: "mid" },
  smoke: { family: "grey", shade: "mid" },
  pewter: { family: "grey", shade: "mid" },
  heather: { family: "grey", shade: "mid" },
  dove: { family: "grey", shade: "light" }, ash: { family: "grey", shade: "light" },
  silver: { family: "grey", shade: "light" }, pearl: { family: "grey", shade: "light" },
  mirrored: { family: "grey", shade: "light" }, mirror: { family: "grey", shade: "light" },
  charcoal: { family: "grey", shade: "dark" }, slate: { family: "grey", shade: "dark" },
  warmgrey: { family: "grey" },
  graphite: { family: "grey", shade: "dark" }, anthracite: { family: "grey", shade: "dark" },
  asphalt: { family: "grey", shade: "dark" }, gunmetal: { family: "grey", shade: "dark" },
  // blue
  blue: { family: "blue" }, sky: { family: "blue", shade: "light" },
  navy: { family: "blue", shade: "dark" }, indigo: { family: "blue", shade: "dark" },
  midnight: { family: "blue", shade: "dark" },
  // compound blues (normalised from "slate blue" etc. before tokenising) — these
  // read as their own muted/light blue, NOT as the dark-grey "slate".
  slateblue: { family: "blue" },   powderblue: { family: "blue", shade: "light" },
  babyblue: { family: "blue", shade: "light" },
  iceblue: { family: "blue", shade: "light" }, steelblue: { family: "blue" },
  // black / white
  black: { family: "black", shade: "dark" },
  white: { family: "white", shade: "light" }, cream: { family: "white", shade: "light" },
  ivory: { family: "white", shade: "light" }, ecru: { family: "white", shade: "light" },
  bone: { family: "white", shade: "light" },
  // brown / neutral warm
  brown: { family: "brown" }, khaki: { family: "brown", shade: "light" },
  taupe: { family: "brown", shade: "light" },
  cognac: { family: "brown" }, mocha: { family: "brown" },
  tan: { family: "brown", shade: "light" }, camel: { family: "brown", shade: "light" },
  beige: { family: "brown", shade: "light" }, sand: { family: "brown", shade: "light" },
  stone: { family: "brown", shade: "light" }, oat: { family: "brown", shade: "light" },
  oatmeal: { family: "brown", shade: "light" },
  buff: { family: "brown", shade: "light" },
  putty: { family: "brown", shade: "light" },
  nude: { family: "brown", shade: "light" }, champagne: { family: "brown", shade: "light" },
  fawn: { family: "brown", shade: "light" },
  greige: { family: "brown", shade: "light" }, mushroom: { family: "brown", shade: "light" },
  chocolate: { family: "brown", shade: "dark" }, chestnut: { family: "brown", shade: "dark" },
  espresso: { family: "brown", shade: "dark" }, coffee: { family: "brown", shade: "dark" },
  green: { family: "green" }, sage: { family: "green", shade: "light" },
  olive: { family: "green", shade: "dark" }, forest: { family: "green", shade: "dark" },
  emerald: { family: "green", shade: "dark" },
  bottle: { family: "green", shade: "dark" },
  // Teal is blue-green. Catalogue teal is rare — fall back to blue / grey
  // (chambray, slate, light blue), not sage or bottle green. No implied
  // shade so muted/soft teal still prefers голубой over navy.
  teal: { family: "blue" },
  chambray: { family: "blue", shade: "light" },
  // red / warm
  red: { family: "red" },   rust: { family: "red" }, terracotta: { family: "red" }, copper: { family: "red" },
  burgundy: { family: "red", shade: "dark" }, maroon: { family: "red", shade: "dark" },
  // pink / rose — dusty rose must land here, not as a bare shade word
  pink: { family: "pink" }, rose: { family: "pink", shade: "light" },
  blush: { family: "pink", shade: "light" }, dustyrose: { family: "pink", shade: "light" },
  oldrose: { family: "pink", shade: "light" }, berry: { family: "pink" },
  fuchsia: { family: "pink" }, magenta: { family: "pink" },
  // other hues
  purple: { family: "purple" }, plum: { family: "purple" },
  softplum: { family: "purple", shade: "light" },
  mauve: { family: "purple", shade: "light" }, aubergine: { family: "purple", shade: "dark" },
  lilac: { family: "purple", shade: "light" }, lavender: { family: "purple", shade: "light" },
  orange: { family: "orange" },
  amber: { family: "orange" }, ochre: { family: "yellow" },
  yellow: { family: "yellow" }, mustard: { family: "yellow" },
  gold: { family: "yellow" }, golden: { family: "yellow" },
  tortoise: { family: "brown" }, havana: { family: "brown" },
};

/** Adjacent hue families used only when the exact family is missing. */
const COLOR_NEIGHBORS: Record<string, readonly string[]> = {
  pink: ["purple"],
  purple: ["pink"],
  white: ["brown"],
  brown: ["white", "grey", "green"],
  grey: ["brown", "blue"],
  green: ["brown"],
  blue: ["grey"],
  orange: ["yellow"],
  yellow: ["orange"],
};

/** Pairs that may neighbour only as light/mid — never chocolate or charcoal. */
const LIGHT_NEIGHBOR_PAIRS = new Set([
  "white-brown",
  "brown-white",
  "brown-grey",
  "grey-brown",
  "brown-green",
  "green-brown",
  "blue-grey",
  "grey-blue",
]);

/** Representative hex for a named token — used when the look has no palette swatch. */
const NAMED_COLOR_HEX: Record<string, string> = {
  rose: "#C29AA0",
  dustyrose: "#C29AA0",
  blush: "#D4A8B0",
  pink: "#D4A0AE",
  lilac: "#B7A4C4",
  lavender: "#B8A4C8",
  mauve: "#9A7A8C",
  plum: "#7A6577",
  softplum: "#7A6577",
  berry: "#8E4A5C",
  coffee: "#3F332B",
  greige: "#DAD3C6",
  mushroom: "#A99C8C",
  taupe: "#B49C7E",
  sage: "#9AA588",
  teal: "#4E8C92",
  khaki: "#9A8B5C",
  stone: "#C2B8A8",
  beige: "#D4C4A8",
  sand: "#D9C7A3",
  oatmeal: "#D8CFB8",
  buff: "#D9C7A3",
  putty: "#C9B8A0",
  nude: "#D8C4A0",
  champagne: "#E3C6A8",
  fawn: "#C9A57A",
  dove: "#C5C1B8",
  olive: "#6B6B47",
  powderblue: "#AEC7DE",
  babyblue: "#AEC7DE",
};

/** Standalone lightness modifiers; override any shade implied by the hue word. */
const SHADE_WORDS: Record<string, Shade> = {
  light: "light", pale: "light", soft: "light", dusty: "light", off: "light",
  muted: "light", baby: "light",
  mid: "mid", medium: "mid", midtone: "mid",
  dark: "dark", deep: "dark",
};

/** Colour words used to qualify a garment query (not garments themselves). */
export const COLOR_WORDS = new Set<string>([
  ...Object.keys(COLOR_FAMILY),
  ...Object.keys(SHADE_WORDS),
]);

/** Collapse known two-word colours into a single token before parsing. */
export function normalizeCompoundColors(text: string): string {
  return text
    .replace(/-/g, " ")
    .replace(/slate\s+blue/g, "slateblue")
    .replace(/powder\s+blue/g, "powderblue")
    .replace(/baby\s+blue/g, "babyblue")
    .replace(/ice\s+blue/g, "iceblue")
    .replace(/steel\s+blue/g, "steelblue")
    .replace(/dusty\s+rose/g, "dustyrose")
    .replace(/old\s+rose/g, "oldrose")
    .replace(/soft\s+plum/g, "softplum")
    .replace(/warm\s+gr[ae]y/g, "warmgrey")
    .replace(/tortoise\s*shell/g, "tortoise")
    .replace(/yellow\s+gold/g, "gold");
}

export function parseHexRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0], 16),
      parseInt(h[1]! + h[1], 16),
      parseInt(h[2]! + h[2], 16),
    ];
  }
  if (h.length === 6 && /^[0-9a-f]+$/i.test(h)) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

function shadeAffinity(a: Shade, b: Shade): number {
  if (a === b) return 1;
  const order: Record<Shade, number> = { light: 0, mid: 1, dark: 2 };
  return Math.abs(order[a] - order[b]) === 1 ? 0.35 : 0.3;
}

/** Neighbour families keep a usable score across light↔mid (greige↔dove grey). */
function neighborShadeScore(a?: Shade, b?: Shade): number {
  if (!a || !b || a === b) return 0.55;
  const order: Record<Shade, number> = { light: 0, mid: 1, dark: 2 };
  return Math.abs(order[a] - order[b]) === 1 ? 0.52 : 0.15;
}

/** Parse free-text colour into the set of hue families + an implied lightness. */
function parseColorTokens(text: string): { families: Set<string>; shade?: Shade } {
  const families = new Set<string>();
  let hueShade: Shade | undefined; // lightness implied by a hue word (e.g. navy → dark)
  let modShade: Shade | undefined; // explicit modifier (e.g. soft/light/deep)
  for (const w of normalizeCompoundColors(text.toLowerCase())
    .split(/\s+/)
    .filter(Boolean)) {
    const fam = COLOR_FAMILY[w];
    if (fam) {
      families.add(fam.family);
      if (fam.shade) hueShade = fam.shade;
    }
    const mod = SHADE_WORDS[w];
    if (mod) modShade = mod;
  }
  // Catalogue often stores only a hex ("#FFFFFF") — infer a family so white
  // does not score as a neutral 0.5 against teal / sage.
  if (!families.size) {
    const hexHit = text.match(/#?[0-9a-f]{6}/i);
    if (hexHit) {
      const hex = parseHexColor(hexHit[0]);
      if (hex) {
        const { s, l } = hexToHsl(hex);
        if (s < 0.08 && l >= 0.88) {
          families.add("white");
          hueShade = "light";
        } else if (s < 0.08 && l <= 0.14) {
          families.add("black");
          hueShade = "dark";
        } else if (s < 0.1) {
          families.add("grey");
          hueShade = l >= 0.6 ? "light" : l <= 0.35 ? "dark" : "mid";
        }
      }
    }
  }
  // An explicit lightness word always wins, regardless of token order, so
  // "soft slate blue" reads light even though "slate" alone implies dark.
  return { families, shade: modShade ?? hueShade };
}

/** Hue families named in free text (product colour, title, or look clause). */
export function colorFamilies(text: string): Set<string> {
  return parseColorTokens(text).families;
}

/** Light / mid / dark token from a look cue or product colour string. */
export function colorShade(
  text: string,
): "light" | "mid" | "dark" | null {
  return parseColorTokens(text).shade ?? null;
}

/** True when the look named teal — fallback is blue/grey, not sage. */
export function lookAsksTeal(text?: string | null): boolean {
  return /\bteal\b/i.test(text ?? "");
}

/** True when the look named plum — fallback is navy/slate, not pastel pink. */
export function lookAsksPlum(text?: string | null): boolean {
  return /\b(softplum|plum|aubergine|eggplant)\b/i.test(text ?? "");
}

/** True when the look named charcoal — not a licence for dark teal/green. */
export function lookAsksCharcoal(text?: string | null): boolean {
  return /\b(charcoal|graphite|anthracite|asphalt|gunmetal)\b/i.test(text ?? "");
}

export function lookColorCue(
  color?: string | null,
  clause?: string | null,
): string | null {
  const named = color?.trim() || "";
  if (named && parseColorTokens(named).families.size) return named;
  const fromClause = clause?.trim() || "";
  if (fromClause && parseColorTokens(fromClause).families.size) return fromClause;
  return named || fromClause || null;
}

/** Belt / shoe / trouser leather family used to keep one tone per outfit. */
export function leatherToneFamily(text: string): "black" | "brown" | null {
  const families = parseColorTokens(text).families;
  if (families.has("black") && !families.has("brown")) return "black";
  if (families.has("brown")) return "brown";
  return null;
}

/**
 * Catalogue search tokens that share a look colour's hue family.
 * Used to pull same-family products into the match pool when vector neighbours
 * crowd them out (dusty rose must still see "pink" / "rose" knits).
 * Skips fused compound keys ("dustyrose") that never appear in feeds.
 */
export function colorFamilyNeedles(queryColor: string | null): string[] {
  const families = parseColorTokens(queryColor ?? "").families;
  if (!families.size) return [];
  const needles = new Set<string>();
  // Named tokens in the cue first — "charcoal" must not fall off the 8-needle cap
  // behind dove/ash/silver.
  for (const w of normalizeCompoundColors((queryColor ?? "").toLowerCase())
    .split(/\s+/)
    .filter(Boolean)) {
    if (COLOR_FAMILY[w] && isSearchableColorToken(w)) needles.add(w);
  }
  for (const [token, meta] of Object.entries(COLOR_FAMILY)) {
    if (!families.has(meta.family)) continue;
    if (!isSearchableColorToken(token)) continue;
    needles.add(token);
  }
  // Catalogue plum is rare — also pull the wearable menswear stand-in.
  if (lookAsksPlum(queryColor)) {
    for (const n of ["navy", "blue", "slate", "indigo"]) needles.add(n);
  }
  return [...needles];
}

/** Natural colour words safe for `ilike` — skip fused compounds like dustyrose. */
function isSearchableColorToken(token: string): boolean {
  if (token.length < 3 || token.length > 14) return false;
  if (!/^[a-z]+$/.test(token)) return false;
  if (token !== "blue" && token.endsWith("blue")) return false;
  if (token !== "rose" && token.endsWith("rose")) return false;
  if (token !== "plum" && token.endsWith("plum")) return false;
  if (token !== "grey" && token.endsWith("grey")) return false;
  return true;
}

export type ColorMatchOpts = {
  queryHex?: string | null;
  productHex?: string | null;
};


export function parseHexColor(raw?: string | null): string | null {
  const m = (raw ?? "").trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

/** Hue family from a swatch when the feed has no colour word. */
export function familyFromHex(raw?: string | null): string | null {
  const hex = parseHexColor(raw);
  if (!hex) return null;
  const { h, s, l } = hexToHsl(hex);
  if (s < 0.08 && l >= 0.88) return "white";
  if (s < 0.08 && l <= 0.14) return "black";
  if (s < 0.1) return "grey";
  // Light rosy reds are pink, not crimson.
  if ((h >= 320 || h < 18) && l >= 0.5 && s <= 0.65) return "pink";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 155) return "green";
  if (h < 255) return "blue";
  if (h < 320) return "purple";
  return "pink";
}

const CHROMATIC_AVOID_RE =
  /yellow|orange|rust|mustard|gold|coral|olive|beige|camel|terracotta|cobalt|icy|fuchsia|magenta|pink|lilac|lavender|violet|purple|cyan|turquoise|electric|royal/;

/**
 * Cool avoid families (a warm palette's list: Cool Cobalt, Icy Pink, Fuchsia).
 * These get their own rule below — the generic hue-and-lightness proximity
 * test would also catch the palette's own deep navy next to cobalt.
 */
const COOL_AVOID_RE =
  /cobalt|icy|fuchsia|magenta|pink|lilac|lavender|violet|purple|cyan|turquoise|electric|royal|cool/;

const WARM_YELLOW_TITLE_RE =
  /\b(yellow|mustard|goldenrod|golden\s+yellow|gold(?:en)?)\b/i;

/** Olive / khaki / lime read as mustard in renders when yellow is avoided. */
const YELLOW_GREEN_TITLE_RE =
  /\b(yellow|mustard|goldenrod|golden\s+yellow|gold(?:en)?|olive|khaki|chartreuse|lime|pistachio|mint|light\s+green|pale\s+green|apple\s+green)\b/i;

export type AvoidSwatch = { name: string; hex?: string };

const UNKNOWN_SWATCH_RE = /^#?c{6}$/i;

const TITLE_COLOR_HEX: Record<string, string> = {
  black: "#111111",
  brown: "#6F4E37",
  cognac: "#8A4B2A",
  tan: "#C69B6D",
  navy: "#28324A",
  burgundy: "#5C1A24",
  charcoal: "#36393B",
  grey: "#8B8B8B",
  gray: "#8B8B8B",
  white: "#FFFFFF",
};

/** Catalogue placeholder when the feed shipped no usable swatch. */
export function isUnknownSwatchHex(hex?: string | null): boolean {
  return !hex || UNKNOWN_SWATCH_RE.test(hex.trim());
}

/** Jet black — title or a near-black hex. Charcoal / navy are not this. */
export function isPureBlackProduct(
  title: string,
  hex?: string | null,
): boolean {
  if (
    /\b(charcoal|graphite|anthracite|navy|slate)\b/i.test(title) &&
    !/\bblack\b/i.test(title)
  ) {
    return false;
  }
  if (/\bblack\b/i.test(title)) return true;
  const parsed = parseHexColor(hex);
  if (!parsed || isUnknownSwatchHex(parsed)) return false;
  const { s, l } = hexToHsl(parsed);
  return l < 0.12 && s < 0.1;
}

const CLASSIC_LEATHER_COLOUR_RE =
  /\b(black|brown|cognac|tan|chestnut|espresso|chocolate|mocha|walnut|oxblood|burgundy|cordovan|bordeaux|wine)\b/i;

/**
 * "Golden brown", light or caramel leather is a warm accent, not the classic
 * dress leather the etiquette exemption protects — it stays subject to the
 * seasonal avoid list (a golden brown derby is an orange clash on a cool
 * palette, whatever the title says). Tan and cognac stay classic.
 */
const CASUAL_LEATHER_WORD_RE =
  /\b(golden|light|pale|caramel|honey|camel|toffee|butterscotch|whisk(?:e)?y|saddle|sand)\b/i;

/**
 * The etiquette exemption covers classic leather COLOURS only — a rust suede
 * loafer or a lime belt is still judged by the seasonal avoid list.
 */
export function isClassicLeatherColour(
  title: string,
  hex?: string | null,
): boolean {
  if (CLASSIC_LEATHER_COLOUR_RE.test(title) && !CASUAL_LEATHER_WORD_RE.test(title)) {
    return true;
  }
  const parsed = parseHexColor(hex);
  if (!parsed || isUnknownSwatchHex(parsed)) return false;
  const { h, s, l } = hexToHsl(parsed);
  if (l < 0.14 && s < 0.12) return true; // near-black
  // Browns are dark AND low-chroma; rust / terracotta sit at the same hue but
  // brighter (s≈0.55+) and stay subject to the seasonal avoid list.
  if (l < 0.4 && s >= 0.12 && s <= 0.5 && h >= 10 && h <= 45) return true; // browns
  if (l < 0.35 && s >= 0.2 && (h >= 340 || h <= 10)) return true; // oxblood / burgundy
  return false;
}

/**
 * Dark indigo denim is a universal neutral — no palette bans it. Black, grey,
 * bleached or white denim is an ordinary garment colour and stays gated.
 */
export function isIndigoDenim(title: string, hex?: string | null): boolean {
  if (!isJeanTitle(title) && !/\bdenim\b/i.test(title)) return false;
  if (/\b(black|grey|gray|charcoal|bleach(?:ed)?|white|ecru|cream|stone|sand)\b/i.test(title)) {
    return false;
  }
  if (/\b(indigo|dark[- ]wash|raw|rinse|selvedge|navy|blue|midnight)\b/i.test(title)) {
    return true;
  }
  const parsed = parseHexColor(hex);
  if (!parsed || isUnknownSwatchHex(parsed)) return false;
  const { h, s, l } = hexToHsl(parsed);
  return h >= 200 && h <= 250 && s >= 0.15 && l <= 0.45;
}

/** Use a real swatch, else a colour word in the title, else the placeholder. */
export function inferSwatchHex(
  title: string,
  hex?: string | null,
): string {
  const parsed = parseHexColor(hex);
  if (parsed && !isUnknownSwatchHex(parsed)) return parsed;
  const words = title.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = TITLE_COLOR_HEX[words[i]!];
    if (hit) return hit;
  }
  // Wider palette vocabulary ("Light Beige Blazer", "Sage overshirt") — a feed
  // with no swatch must not read as neutral grey when the title says beige.
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = NAMED_COLOR_HEX[words[i]!];
    if (hit) return hit;
  }
  return "#CCCCCC";
}

function avoidListsBlack(avoid: AvoidSwatch[]): boolean {
  return avoid.some((a) => /\bblack\b/i.test(a.name ?? ""));
}

/** Why a colour gate said no — a rule id a log, a test or an admin screen can name. */
export type ColourVerdict = { ok: true } | { ok: false; rule: string };

const OK: ColourVerdict = { ok: true };
const no = (rule: string): ColourVerdict => ({ ok: false, rule });

/**
 * Does this product colour sit on the client's avoid list? Returns the rule
 * that fired, so the three layers (gate, recipe, catalogue) can be audited
 * with one vocabulary. `hitsAvoidPalette` is the boolean view.
 */
export function avoidPaletteVerdict(
  title: string,
  hex: string | null | undefined,
  avoid: AvoidSwatch[],
  opts?: AvoidPaletteOpts,
): ColourVerdict {
  if (!avoid.length) return OK;
  // Dress codes beat seasonal colour analysis: black tie is black, and black /
  // brown / burgundy dress leather (derbies, oxfords, loafers, belts, the
  // matching briefcase) is business etiquette. The exemption is for classic
  // leather COLOURS on those items only — a rust loafer is still judged below.
  if (isBlackTieItem(title)) return OK;
  if (isClassicBusinessLeather(title, opts) && isClassicLeatherColour(title, hex)) return OK;
  // Dark indigo denim is nobody's avoid colour.
  if (isIndigoDenim(title, hex)) return OK;
  // Formal / wedding: a black or charcoal tailored overcoat tops the look by
  // dress code — the one black outer layer allowed off the face's own colours.
  if (
    isFormalOccasion(opts?.occasionId) &&
    (!opts?.category || opts.category === "Outerwear") &&
    isTailoredOvercoat(title) &&
    isPureBlackProduct(title, hex)
  ) {
    return OK;
  }
  if (avoidListsBlack(avoid) && isPureBlackProduct(title, hex)) return no("black-listed");
  const productHex = parseHexColor(hex);
  const productFam = productColorFamilies(hex ?? null, title, hex);
  for (const a of avoid) {
    const name = (a.name ?? "").toLowerCase();
    if (!CHROMATIC_AVOID_RE.test(name)) continue;
    if (/yellow|mustard|golden/.test(name) && YELLOW_GREEN_TITLE_RE.test(title)) return no("yellow-title");
    if (/olive/.test(name) && /\b(olive|khaki)\b/i.test(title)) return no("olive-title");
    if (/orange/.test(name) && /\borange\b/i.test(title)) return no("orange-title");
    if (/rust/.test(name) && /\brust\b/i.test(title)) return no("rust-title");
    const aHex = parseHexColor(a.hex);
    if (COOL_AVOID_RE.test(name)) {
      // A cool avoid bans its whole chromatic family at any lightness: a light
      // blue knit is the same icy register as Cool Cobalt, only paler. Low
      // chroma (deep navy, teal) and dark tones (burgundy vs Icy Pink) stay.
      if (productHex && aHex) {
        const q = hexToHsl(aHex);
        const p = hexToHsl(productHex);
        const pastelAvoid = q.l >= 0.7;
        if (hueDist(q.h, p.h) < 35 && p.s >= 0.3 && p.l >= 0.35 && (!pastelAvoid || p.l >= 0.5)) {
          return no("cool-family-hex");
        }
      }
      // "pink gold" / "rose gold" is a metallic finish, and a golden hex says so.
      const warmHex = productHex ? (() => { const h = hexToHsl(productHex).h; return h >= 15 && h <= 80; })() : false;
      if (/pink|fuchsia|magenta/.test(name) && /\b(pink|fuchsia|magenta|blush)\b(?![\s-]*gold)/i.test(title) && !warmHex) {
        return no("pink-title");
      }
      if (
        /cobalt|royal|electric/.test(name) &&
        /\b(cobalt|royal\s+blue|electric\s+blue|sky\s+blue|light\s+blue|baby\s+blue|powder\s+blue)\b/i.test(title)
      ) {
        return no("cobalt-title");
      }
      continue;
    }
    if (productHex && aHex) {
      const q = hexToHsl(aHex);
      const p = hexToHsl(productHex);
      // A vivid avoid (Bright Orange, s≈1) does not ban every muted neighbour
      // on the hue wheel: dusty rose at s≈0.19 is a palette swatch, not orange.
      // The product needs a share of the avoid's chroma to be the same colour.
      const minChroma = Math.max(0.16, Math.min(0.3, q.s * 0.35));
      if (q.s >= 0.18 && p.s >= minChroma && hueDist(q.h, p.h) < 28 && Math.abs(q.l - p.l) < 0.28) {
        return no("hue-neighbour-hex");
      }
    }
    const avoidFams = productColorFamilies(a.hex ?? null, a.name, a.hex);
    const warmHit =
      [...avoidFams].some((f) => f === "yellow" || f === "orange") &&
      (productFam.has("yellow") || productFam.has("orange"));
    // Olive #6B6B47 is yellow-family at s≈0.20 — just under the old 0.22 cut
    // — and capsule prompts then literally say "yellow trousers".
    if (warmHit && productHex && hexToHsl(productHex).s >= 0.16) return no("warm-family");
  }
  return OK;
}

export function hitsAvoidPalette(
  title: string,
  hex: string | null | undefined,
  avoid: AvoidSwatch[],
  opts?: AvoidPaletteOpts,
): boolean {
  return !avoidPaletteVerdict(title, hex, avoid, opts).ok;
}

/**
 * The near-face heuristics as one verdict: saturated warm yellow at the face,
 * warm cream on a cool client's shirt, a cool pastel on a warm client.
 */
export function nearFaceVerdict(
  hay: string,
  hex: string | null | undefined,
  ctx: { undertone: "warm" | "cool" | "neutral"; role?: string | null },
): ColourVerdict {
  if (isWarmYellowNearFace(hay, hex)) return no("warm-yellow");
  if (ctx.undertone === "cool" && ctx.role === "shirt" && isWarmCreamNearFace(hay, hex)) return no("warm-cream-on-cool");
  if (ctx.undertone === "warm" && isCoolPastelNearFace(hay, hex)) return no("cool-pastel-on-warm");
  return OK;
}

/** Saturated yellow-orange near the face — even when the catalogue says "beige". */
export function isWarmYellowNearFace(
  title: string,
  hex?: string | null,
): boolean {
  if (WARM_YELLOW_TITLE_RE.test(title)) return true;
  const parsed = parseHexColor(hex);
  if (!parsed) return false;
  const hsl = hexToHsl(parsed);
  return hsl.s >= 0.28 && hsl.l <= 0.74 && hsl.h >= 28 && hsl.h < 72;
}

const WARM_CREAM_TITLE_RE =
  /\b(cream|ivory|ecru|maize|butter|champagne|vanilla)\b/i;

/** Light warm yellow that the saturated-yellow check misses (cream oxfords). */
export function isWarmCreamNearFace(
  title: string,
  hex?: string | null,
): boolean {
  if (WARM_CREAM_TITLE_RE.test(title)) return true;
  const parsed = parseHexColor(hex);
  if (!parsed) return false;
  const { h, s, l } = hexToHsl(parsed);
  return l >= 0.72 && s >= 0.14 && h >= 28 && h < 72;
}

const COOL_PASTEL_TITLE_RE =
  /\b(light\s+blue|sky\s+blue|baby\s+blue|powder\s+blue|ice\s+blue|icy|pastel|lilac|lavender|pale\s+pink|baby\s+pink|light\s+pink|blush|mint)\b/i;

/**
 * Cool pastel next to the face — sky blue, lilac, blush, mint. The mirror of
 * {@link isWarmCreamNearFace}: on a warm palette these drain the complexion
 * the way cream does on a cool one. Deep navy and teal are not pastels.
 */
export function isCoolPastelNearFace(
  title: string,
  hex?: string | null,
): boolean {
  if (COOL_PASTEL_TITLE_RE.test(title)) return true;
  const parsed = parseHexColor(hex);
  if (!parsed || isUnknownSwatchHex(parsed)) return false;
  const { h, s, l } = hexToHsl(parsed);
  if (l < 0.6 || s < 0.15) return false;
  return (h >= 170 && h <= 260) || (h >= 280 && h <= 345);
}

/** The look itself named a cool colour for this garment — the matcher must follow the look. */
export function lookAsksCoolColour(color?: string | null, clause?: string | null): boolean {
  return /\b(blue|sky|powder|pink|blush|lilac|lavender|mint|periwinkle)\b/i.test(
    `${color ?? ""} ${clause ?? ""}`,
  );
}

const OPTIC_WHITE_TITLE_RE = /\b(optic(?:al)?\s+white|bright\s+white|pure\s+white|brilliant\s+white)\b/i;

const SOFT_WHITE_TITLE_RE = /\b(off[-\s]?white|cream|ecru|ivory|oat(?:meal)?|stone|bone|chalk)\b/i;

/**
 * Optic white next to the face — the mirror of {@link isWarmCreamNearFace}
 * for WARM palettes, whose right white is cream or ecru ("never optic white").
 * A soft-white word in the title clears it; a bright, colourless hex flags it.
 */
export function isOpticWhiteNearFace(
  title: string,
  hex?: string | null,
): boolean {
  if (SOFT_WHITE_TITLE_RE.test(title)) return false;
  if (OPTIC_WHITE_TITLE_RE.test(title)) return true;
  const parsed = parseHexColor(hex);
  if (!parsed || isUnknownSwatchHex(parsed)) return false;
  const { s, l } = hexToHsl(parsed);
  return l >= 0.94 && s <= 0.06;
}

/** Families that may legitimately describe one product from two angles. */
const COMPATIBLE_FAMILIES: string[][] = [
  ["white", "grey"],
  ["grey", "black"],
  ["brown", "orange", "yellow"],
  ["red", "pink", "orange"],
  ["blue", "purple"],
  ["green", "blue"],
];

const FAMILY_DEFAULT_HEX: Record<string, string> = {
  brown: "#6F4E37",
  black: "#111111",
  white: "#FFFFFF",
  grey: "#8B8B8B",
  blue: "#28324A",
  green: "#4E6B4E",
  red: "#8E2A2A",
  pink: "#D4A0AE",
  purple: "#7A6577",
  yellow: "#C9A24B",
  orange: "#B7410E",
};

/**
 * When a title names one colour ("Brown Genuine Leather Oxford") and the stored
 * swatch says another family entirely (#111111), the title wins: the hex is a
 * feed error and the render would otherwise paint brown shoes black. Returns
 * the title's hex, or null when the two agree, are compatible, or the title
 * names no single colour.
 */
export function titleColourOverridesHex(
  title: string,
  hex?: string | null,
  colorName?: string | null,
): string | null {
  const parsed = parseHexColor(hex);
  if (!parsed || isUnknownSwatchHex(parsed)) return null;
  const titleFams = [...colorFamilies(title)];
  const nameFams = colorName ? [...colorFamilies(colorName)] : [];
  const source =
    titleFams.length === 1 ? title : nameFams.length === 1 ? (colorName ?? title) : title;
  const fams = titleFams.length === 1 ? titleFams : nameFams.length === 1 ? nameFams : titleFams;
  if (fams.length !== 1) return null;
  const titleFam = fams[0]!;
  const hexFam = familyFromHex(parsed);
  if (!hexFam) return null;
  const namedShade = colorShade(source);
  const hexL = hexToHsl(parsed).l;
  const shadeClash =
    (namedShade === "light" && hexL < 0.42) || (namedShade === "dark" && hexL > 0.62);
  if (hexFam === titleFam && !shadeClash) return null;
  if (
    hexFam !== titleFam &&
    COMPATIBLE_FAMILIES.some((g) => g.includes(titleFam) && g.includes(hexFam)) &&
    !shadeClash
  ) {
    return null;
  }
  const words = normalizeCompoundColors(source.toLowerCase()).split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    const hit = TITLE_COLOR_HEX[w] ?? NAMED_COLOR_HEX[w];
    if (hit && familyFromHex(hit) !== null && (colorFamilies(w).has(titleFam) || familyFromHex(hit) === titleFam)) {
      return hit;
    }
  }
  return FAMILY_DEFAULT_HEX[titleFam] ?? null;
}

/** Families from title/colour words, or the hex swatch when words are missing. */
export function productColorFamilies(
  color: string | null,
  title: string,
  hex?: string | null,
): Set<string> {
  const fams = colorFamilies(`${color ?? ""} ${title}`);
  if (fams.size) return fams;
  const inferred = familyFromHex(hex ?? parseHexColor(color));
  return inferred ? new Set([inferred]) : fams;
}

function namedColorHex(text: string | null): string | null {
  if (!text) return null;
  const hex = parseHexColor(text);
  if (hex) return hex;
  const words = normalizeCompoundColors(text.toLowerCase()).split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = NAMED_COLOR_HEX[words[i]!];
    if (hit) return hit;
  }
  return null;
}

function familiesNeighbor(
  query: Set<string>,
  product: Set<string>,
  qShade?: Shade,
  pShade?: Shade,
): boolean {
  for (const qf of query) {
    const next = COLOR_NEIGHBORS[qf];
    if (!next) continue;
    for (const pf of product) {
      if (!next.includes(pf)) continue;
      // Cream ↔ beige, greige ↔ dove, sage ↔ khaki — never chocolate or charcoal.
      if (LIGHT_NEIGHBOR_PAIRS.has(`${qf}-${pf}`)) {
        if (qShade === "dark" || pShade === "dark") continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Hex proximity for a named look colour vs a catalogue swatch.
 * Rejects far hues and neon jumps (dusty rose must not land on fuchsia).
 */
function hexProximityScore(queryHex: string, productHex: string): number | null {
  const q = hexToHsl(queryHex);
  const p = hexToHsl(productHex);
  const dh = hueDist(q.h, p.h);
  const dl = Math.abs(q.l - p.l);
  if (dh > 32 || dl > 0.2) return null;
  if (p.s > q.s + 0.28) return null;
  const huePart = 1 - dh / 32;
  const lightPart = 1 - dl / 0.2;
  const satPart = 1 - Math.min(Math.abs(q.s - p.s), 0.35) / 0.35;
  return 0.45 + 0.45 * (0.5 * huePart + 0.3 * lightPart + 0.2 * satPart);
}

/**
 * 0–1 colour fit between a look garment colour and a catalogue product. Matches
 * on hue family first, then on lightness: same hue + same lightness scores high,
 * adjacent mid↔light/dark scores soft, opposite lightness (dove vs asphalt)
 * scores low so the picker prefers a true shade match and flags the rest.
 * Neighbouring families (rose↔pink/lilac) score ~0.55 so a missing exact
 * colour can still fill the slot — marked similarPick by the caller.
 */
export function colorMatchScore(
  queryColor: string | null,
  productColor: string | null,
  title: string,
  opts?: ColorMatchOpts,
): number {
  const q = parseColorTokens(queryColor ?? "");
  if (!q.families.size && !q.shade) return 0.5; // no colour cue → neutral
  const p = parseColorTokens(`${productColor ?? ""} ${title}`);
  const queryHex = parseHexColor(opts?.queryHex) ?? namedColorHex(queryColor);
  const productHex =
    parseHexColor(opts?.productHex) ??
    parseHexColor(productColor) ??
    namedColorHex(productColor);
  const hexScore =
    queryHex && productHex ? hexProximityScore(queryHex, productHex) : null;

  let word = 0.1;
  if (!p.families.size) {
    word = 0.5;
  } else {
    let same = false;
    for (const f of q.families) {
      if (p.families.has(f)) {
        same = true;
        break;
      }
    }
    if (same) {
      word = q.shade && p.shade ? shadeAffinity(q.shade, p.shade) : 0.8;
    } else if (familiesNeighbor(q.families, p.families, q.shade, p.shade)) {
      word = neighborShadeScore(q.shade, p.shade);
    }
  }

  if (lookAsksCharcoal(queryColor) && !lookAsksTeal(queryColor)) {
    const inferred =
      p.families.size === 0 ? familyFromHex(productHex ?? productColor) : null;
    const green = p.families.has("green") || inferred === "green";
    const blueNotGrey =
      (p.families.has("blue") || inferred === "blue") &&
      !p.families.has("grey") &&
      !p.families.has("black");
    if (green || blueNotGrey) word = Math.min(word, 0.15);
  }

  if (lookAsksPlum(queryColor)) {
    const inferred =
      p.families.size === 0 ? familyFromHex(productHex ?? productColor) : null;
    const pink =
      (p.families.has("pink") || inferred === "pink") &&
      !p.families.has("purple");
    const cool =
      p.families.has("blue") ||
      p.families.has("grey") ||
      inferred === "blue" ||
      inferred === "grey";
    // Hue-wheel pink is candy, not a plum stand-in. Navy / slate is.
    if (pink) word = Math.min(word, 0.15);
    if (cool) word = Math.max(word, 0.55);
  }

  if (queryHex && productHex) {
    if (hexScore != null) {
      // Empty-family 0.5 must not rescue a far / opposite hex (white vs teal).
      if (!p.families.size && word < 0.45) return hexScore;
      return Math.max(word, hexScore);
    }
    if (!p.families.size && word < 0.45) return 0.12;
    // Only crush a strong same-family word when the swatch is a neon jump
    // (catalogue "pink" that is fuchsia). Soft plum ↔ lilac stays.
    const qH = hexToHsl(queryHex);
    const pH = hexToHsl(productHex);
    if (word >= 0.7 && pH.s > qH.s + 0.28) return 0.35;
    // Same-family "sea green" that is actually pale grey must not beat teal.
    // Teal itself falls back to light blue / grey — do not crush those.
    if (word >= 0.7 && pH.l > qH.l + 0.3) {
      const tealToCool =
        lookAsksTeal(queryColor) &&
        (p.families.has("blue") || p.families.has("grey"));
      if (!tealToCool) return 0.38;
    }
    if (
      pH.s < 0.18 &&
      pH.l > 0.82 &&
      [...q.families].some((f) =>
        ["green", "blue", "red", "pink", "purple", "orange", "yellow"].includes(
          f,
        ),
      )
    ) {
      return Math.min(word, 0.2);
    }
  }
  return word;
}

/** A named look slot may only take a catalogue row at this colour-fit or above. */
export const SLOT_COLOUR_MIN = 0.7;

/**
 * Empty slot beats a wrong colour: a cool-white shirt must not become oatmeal.
 * No colour cue → anything is admitted (the slot has no colour opinion).
 */
export function slotColourAdmitted(
  slotColor: string | null | undefined,
  title: string,
  opts?: { productColor?: string | null; productHex?: string | null; clause?: string | null },
): boolean {
  const cue = lookColorCue(slotColor, opts?.clause);
  if (!cue) return true;
  // No swatch and no colour in the feed: a word in the title ("Cario Grey")
  // is not evidence of colour. The slot stays empty rather than take it.
  if (isUnknownSwatchHex(opts?.productHex) && !opts?.productColor?.trim()) return false;
  return (
    colorMatchScore(cue, opts?.productColor ?? null, title, {
      productHex: opts?.productHex,
    }) >= SLOT_COLOUR_MIN
  );
}

/** Highest colour-fit of a product against the client's BEST swatches (0–1). */
export function bestPaletteFitScore(
  productHex: string | undefined,
  title: string,
  best: ColorRec[],
): number {
  if (!best.length) return 0.5;
  let top = 0;
  for (const b of best) {
    const s = colorMatchScore(b.name, productHex ?? "", title, {
      queryHex: b.hex,
      productHex,
    });
    if (s > top) top = s;
  }
  return top;
}

/** Colour families that read "coloured shoe", never dress leather. */
const CHROMATIC_SHOE_FAMILIES = new Set(["green", "yellow", "orange", "pink", "purple", "red", "blue"]);

/**
 * A dress shoe or loafer in a chromatic colour — green oxfords, lime loafers —
 * is out regardless of the slot colour, unless the slot itself asks for that
 * family. Black / brown / oxblood leather and navy pass; the old filter only
 * fired when the slot was navy or grey, so a brown slot let green oxfords in.
 */
export function shoeColourOffLeather(
  hay: string,
  hex: string | null | undefined,
  slotHex: string | null | undefined,
): boolean {
  if (isClassicLeatherColour(hay, hex)) return false;
  const fams = productColorFamilies(null, hay, hex);
  const chromatic = [...fams].filter((f) => CHROMATIC_SHOE_FAMILIES.has(f));
  if (!chromatic.length) return false;
  if (chromatic.every((f) => f === "blue")) {
    if (/\bnavy\b/i.test(hay)) return false;
    const parsed = parseHexColor(hex);
    if (parsed && hexToHsl(parsed).l <= 0.28) return false; // navy by hex
  }
  // The slot itself asks for this colour — by family, or by the swatch being
  // the same colour (family names diverge: a rust hex reads "orange", the
  // word "rust" reads "red").
  const slotFam = familyFromHex(slotHex);
  if (slotFam && fams.has(slotFam)) return false;
  const p = parseHexColor(hex);
  const q = parseHexColor(slotHex);
  if (p && q) {
    const a = hexToHsl(p);
    const b = hexToHsl(q);
    if (hueDist(a.h, b.h) <= 15 && Math.abs(a.l - b.l) <= 0.15 && Math.abs(a.s - b.s) <= 0.25) return false;
  }
  return true;
}

/** Pink / rose families — valid as a knit or square, not a tailored jacket. */
export const PINK_FAMILY_RE = /\b(mauve|rose|pink|blush|lilac|lavender)\b/i;

export function isPinkFamilyName(name: string): boolean {
  return PINK_FAMILY_RE.test(name);
}

/**
 * A blazer or sport coat in this colour is something a man can actually buy.
 * Dusty-blue and spruce exist; mauve and lilac almost never do.
 */
export function isTailoredJacketSafeName(name: string): boolean {
  if (isPinkFamilyName(name)) return false;
  return !/\b(yellow|mustard|gold)\b/i.test(name);
}

/** Men's overcoat colours: navy, charcoal, camel, stone, greige — never a hero. */
const OVERCOAT_SAFE_RE =
  /\b(navy|charcoal|grey|gray|camel|stone|greige|taupe|ink|midnight|brown)\b/i;

export function isOvercoatSafeName(name: string): boolean {
  return OVERCOAT_SAFE_RE.test(name) && !isPinkFamilyName(name);
}

export function isLightBottomPiece(
  title: string,
  colorByTitle: Map<string, string>,
  best?: ColorRec[],
): boolean {
  if (isDarkAnchorPiece(title, colorByTitle, best)) return false;
  if (
    /\b(cream|ivory|white|off-?white|oat(?:meal)?|sand|beige|stone|khaki|champagne)\b/i.test(
      title,
    )
  ) {
    return true;
  }
  const hsl = pieceHsl(title, colorByTitle);
  return Boolean(hsl && hsl.l >= 0.7);
}
