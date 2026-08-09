import {
  SUBSEASON_LABELS,
  SUBSEASON_BY_SEASON,
  type SubseasonId,
} from "@/lib/style-profile";

export type Undertone = "warm" | "cool" | "neutral";
export type Contrast = "low" | "medium" | "high";
export type Season = "winter" | "spring" | "summer" | "autumn";

export type PaletteSwatch = { hex: string; name: string };

/** Result of the free colour analysis — shared between the API and the UI. */
export type ColourAnalysisResult = {
  season: Season;
  subseason: SubseasonId;
  subseasonLabel: string;
  undertone: Undertone;
  contrast: Contrast;
  skinTone: string;
  palette: PaletteSwatch[];
  carloNote: string;
};

/**
 * Menswear-plausible 10-swatch palette per 12-subseason colour analysis.
 * Single source of truth for the free `/colours` page AND the report, so the two
 * never diverge. Each palette leads with a light/cream and a deep anchor, then
 * characteristic hues, and closes with 2 versatile "business" neutrals — a deep
 * suit anchor + a mid neutral, kept in the subseason's own temperature so office
 * staples (navy / charcoal / brown / grey) stay on-colour instead of drifting.
 */
export const SUBSEASON_PALETTES: Record<SubseasonId, PaletteSwatch[]> = {
  "deep-winter": [
    { hex: "#0F1114", name: "Black" },
    { hex: "#F4F5F7", name: "Snow" },
    { hex: "#1B2A4A", name: "Navy" },
    { hex: "#6E1330", name: "Burgundy" },
    { hex: "#0E5B4A", name: "Emerald" },
    { hex: "#8A0F3C", name: "Ruby" },
    { hex: "#2C2F36", name: "Charcoal" },
    { hex: "#B9C4CE", name: "Icy grey" },
    { hex: "#565E6B", name: "Steel grey" },
    { hex: "#9AA1A9", name: "Stone grey" },
  ],
  "cool-winter": [
    { hex: "#12233F", name: "Ink navy" },
    { hex: "#F2F4F6", name: "Cool white" },
    { hex: "#4C5563", name: "Slate" },
    { hex: "#8E1E4B", name: "Berry" },
    { hex: "#12483C", name: "Pine" },
    { hex: "#2E6FA6", name: "Cool blue" },
    { hex: "#4A2352", name: "Plum" },
    { hex: "#C7CDD4", name: "Silver" },
    { hex: "#2B2F36", name: "Charcoal" },
    { hex: "#7A828C", name: "Steel grey" },
  ],
  "bright-winter": [
    { hex: "#111318", name: "Black" },
    { hex: "#F5F6F8", name: "White" },
    { hex: "#0E63C4", name: "Cobalt" },
    { hex: "#B01455", name: "Fuchsia" },
    { hex: "#0B7A5E", name: "Emerald" },
    { hex: "#C31230", name: "True red" },
    { hex: "#243043", name: "Navy" },
    { hex: "#C3CBD3", name: "Icy grey" },
    { hex: "#2A2E36", name: "Charcoal" },
    { hex: "#6B7480", name: "Steel grey" },
  ],
  "bright-spring": [
    { hex: "#F6EEDD", name: "Ivory" },
    { hex: "#F06B4C", name: "Coral" },
    { hex: "#1FA79A", name: "Turquoise" },
    { hex: "#F2B33D", name: "Golden" },
    { hex: "#6FA43C", name: "Apple green" },
    { hex: "#243B63", name: "Warm navy" },
    { hex: "#DE4A34", name: "Warm red" },
    { hex: "#C08A4E", name: "Camel" },
    { hex: "#5A3D28", name: "Chocolate" },
    { hex: "#B29A7B", name: "Warm taupe" },
  ],
  "warm-spring": [
    { hex: "#F3E7CE", name: "Cream" },
    { hex: "#C79A5B", name: "Warm tan" },
    { hex: "#7E7A3C", name: "Olive" },
    { hex: "#E79A6B", name: "Peach" },
    { hex: "#8A5A2B", name: "Golden brown" },
    { hex: "#2E8C86", name: "Warm teal" },
    { hex: "#C56A3C", name: "Terracotta" },
    { hex: "#5E7B3A", name: "Warm green" },
    { hex: "#4E3620", name: "Bronze brown" },
    { hex: "#2E3A4E", name: "Warm navy" },
  ],
  "light-spring": [
    { hex: "#F7EFDD", name: "Ivory" },
    { hex: "#D9B27E", name: "Light camel" },
    { hex: "#F1B48C", name: "Peach" },
    { hex: "#8FCFC4", name: "Soft aqua" },
    { hex: "#F2D27E", name: "Butter" },
    { hex: "#EF9A82", name: "Soft coral" },
    { hex: "#A9C58C", name: "Light green" },
    { hex: "#C3AE8E", name: "Warm taupe" },
    { hex: "#6E5240", name: "Cocoa" },
    { hex: "#3A4761", name: "Soft navy" },
  ],
  "light-summer": [
    { hex: "#F3F2F0", name: "Soft white" },
    { hex: "#AEC7DE", name: "Powder blue" },
    { hex: "#E3B4BE", name: "Soft rose" },
    { hex: "#B9A9CE", name: "Lavender" },
    { hex: "#A9D2C1", name: "Cool mint" },
    { hex: "#9AA7B4", name: "Grey-blue" },
    { hex: "#8E9CC0", name: "Periwinkle" },
    { hex: "#5E7591", name: "Soft denim" },
    { hex: "#33425C", name: "Slate navy" },
    { hex: "#727E8C", name: "Storm grey" },
  ],
  "cool-summer": [
    { hex: "#2B3A4E", name: "Navy grey" },
    { hex: "#F1F1EF", name: "Cool white" },
    { hex: "#6E8CA6", name: "Dusty blue" },
    { hex: "#9C6B84", name: "Mauve" },
    { hex: "#3C6E63", name: "Spruce" },
    { hex: "#B5798C", name: "Cool rose" },
    { hex: "#54606E", name: "Slate" },
    { hex: "#6A5A72", name: "Plum grey" },
    { hex: "#3A4048", name: "Charcoal grey" },
    { hex: "#CBD0D4", name: "Pearl grey" },
  ],
  "soft-summer": [
    { hex: "#DAD3C6", name: "Greige" },
    { hex: "#5F8C86", name: "Soft teal" },
    { hex: "#C29AA0", name: "Dusty rose" },
    { hex: "#3E4C63", name: "Muted navy" },
    { hex: "#8A9A78", name: "Sage" },
    { hex: "#A99C8C", name: "Mushroom" },
    { hex: "#7A6577", name: "Soft plum" },
    { hex: "#647A93", name: "Slate blue" },
    { hex: "#464C55", name: "Soft charcoal" },
    { hex: "#AEB3B6", name: "Dove grey" },
  ],
  "soft-autumn": [
    { hex: "#E4D8C2", name: "Oatmeal" },
    { hex: "#8A9166", name: "Sage" },
    { hex: "#BC7A54", name: "Soft rust" },
    { hex: "#B49C7E", name: "Warm taupe" },
    { hex: "#4E8079", name: "Muted teal" },
    { hex: "#C3945B", name: "Camel" },
    { hex: "#736B3E", name: "Olive" },
    { hex: "#A85C46", name: "Soft brick" },
    { hex: "#4A3728", name: "Coffee" },
    { hex: "#8C8375", name: "Warm grey" },
  ],
  "warm-autumn": [
    { hex: "#EFE3C6", name: "Cream" },
    { hex: "#C99A3A", name: "Mustard" },
    { hex: "#A85A2E", name: "Rust" },
    { hex: "#6E6A34", name: "Olive" },
    { hex: "#6E4527", name: "Warm brown" },
    { hex: "#2F5A3C", name: "Forest" },
    { hex: "#B85F3A", name: "Terracotta" },
    { hex: "#2C6E68", name: "Deep teal" },
    { hex: "#2C3542", name: "Warm navy" },
    { hex: "#8C7350", name: "Bronze taupe" },
  ],
  "deep-autumn": [
    { hex: "#3B2A1E", name: "Espresso" },
    { hex: "#6B6B47", name: "Olive" },
    { hex: "#9E5C3C", name: "Rust" },
    { hex: "#B08A5B", name: "Camel" },
    { hex: "#27324A", name: "Deep navy" },
    { hex: "#C9A24B", name: "Mustard" },
    { hex: "#5A3D2B", name: "Chocolate" },
    { hex: "#EFE6D3", name: "Cream" },
    { hex: "#33302B", name: "Warm charcoal" },
    { hex: "#8A7A64", name: "Taupe" },
  ],
};

export function paletteForSubseason(subseason: SubseasonId): PaletteSwatch[] {
  return SUBSEASON_PALETTES[subseason];
}

/** Season → palette via that season's flagship subseason (used when only the base season is known). */
const SEASON_FLAGSHIP: Record<Season, SubseasonId> = {
  winter: "cool-winter",
  spring: "warm-spring",
  summer: "soft-summer",
  autumn: "warm-autumn",
};

export function paletteForSeason(season: Season): PaletteSwatch[] {
  return SUBSEASON_PALETTES[SEASON_FLAGSHIP[season]];
}

export function subseasonLabel(subseason: SubseasonId): string {
  return SUBSEASON_LABELS[subseason];
}

const UNDERTONE_DESC: Record<Undertone, string> = {
  warm: "warm and golden",
  cool: "cool and clear",
  neutral: "balanced, leaning neutral",
};

const CONTRAST_DESC: Record<Contrast, string> = {
  low: "soft, low",
  medium: "moderate",
  high: "strong, high",
};

const SEASON_ADVICE: Record<Season, { wear: string; avoid: string }> = {
  autumn: {
    wear: "rich earth tones — olive, rust, camel and warm browns",
    avoid: "icy pastels, pure black and bright white",
  },
  spring: {
    wear: "warm, clear colours — coral, golden yellow, warm greens and camel",
    avoid: "dark, dusty or muted shades that dull your natural warmth",
  },
  summer: {
    wear: "soft, cool tones — dusty blue, soft rose, sage and slate",
    avoid: "bright orange, tomato red and harsh black",
  },
  winter: {
    wear: "clear, cool and deep colours — true navy, emerald, cool red and crisp white",
    avoid: "muted, dusty or earthy tones that muddy your contrast",
  },
};

/**
 * Deterministic, on-voice "Carlo says" blurb — no second AI call, so the free
 * run stays a single vision request. Two sentences: what your colouring is,
 * then one wear / one avoid cue.
 */
export function carloNoteFor(opts: {
  season: Season;
  subseasonLabel: string;
  undertone: Undertone;
  contrast: Contrast;
}): string {
  const { season, subseasonLabel: label, undertone, contrast } = opts;
  const advice = SEASON_ADVICE[season];
  return (
    `Your colours sit in ${label} — ${UNDERTONE_DESC[undertone]} with ${CONTRAST_DESC[contrast]} contrast. ` +
    `Lean into ${advice.wear}, and keep ${advice.avoid} away from your face.`
  );
}

const SEASON_TEMP: Record<Season, string> = {
  autumn: "warm and rich",
  spring: "warm and clear",
  summer: "cool and soft",
  winter: "cool and deep",
};

/** Season-level blurb for a shared palette page, where only the subseason is known. */
export function seasonNoteFor(season: Season): string {
  const advice = SEASON_ADVICE[season];
  return (
    `${season[0].toUpperCase()}${season.slice(1)} colouring is ${SEASON_TEMP[season]}. ` +
    `Lean into ${advice.wear}, and keep ${advice.avoid} away from your face.`
  );
}

/** Reverse-map a subseason to its base season. */
export function seasonForSubseason(subseason: SubseasonId): Season {
  const seasons = Object.keys(SUBSEASON_BY_SEASON) as Season[];
  return (
    seasons.find((s) => SUBSEASON_BY_SEASON[s].includes(subseason)) ?? "autumn"
  );
}

/* --------------------- deterministic report palette ---------------------- */

/** A named swatch plus a one-line rationale — the report's colour card shape. */
export type ColorRec = {
  name: string;
  hex: string;
  why: string;
  /** "versatile" marks the office-ready neutral anchors shown as their own group. */
  role?: "versatile";
};

/** How many trailing swatches in each subseason palette are versatile neutrals. */
export const VERSATILE_NEUTRAL_COUNT = 2;

/** Minimal hex → HSL for classifying a swatch's role (neutral / accent / depth). */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  let h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

const UNDERTONE_ADJ: Record<Undertone, string> = {
  warm: "warm",
  cool: "cool",
  neutral: "balanced",
};

/**
 * Deterministic, on-voice rationale for a best-palette swatch. Derived from the
 * swatch's role (neutral / accent) and depth plus the client's undertone and
 * contrast — so the same colouring always yields the same copy (no LLM call).
 */
function whyForBestSwatch(
  swatch: PaletteSwatch,
  opts: {
    undertone: Undertone;
    contrast: Contrast;
    label: string;
    role?: "versatile";
  },
): string {
  const { s, l } = hexToHsl(swatch.hex);
  const u = UNDERTONE_ADJ[opts.undertone];

  if (opts.role === "versatile") {
    return `A versatile, office-ready ${u} neutral tuned to your ${opts.label} colouring — a dependable base for suits and formal looks that adds depth while staying on your palette.`;
  }
  const isAccent = s >= 0.32;
  const isNeutral = s < 0.2;
  const deep = l < 0.3;
  const light = l > 0.72;

  if (isAccent) {
    return `Your accent near the face — ${u} and clear, it lifts your complexion without shouting, sitting squarely in your ${opts.label} range.`;
  }
  if (deep) {
    return `A deep ${u} anchor that grounds an outfit with more depth than black and none of its harshness.`;
  }
  if (light && isNeutral) {
    return `A soft, light ${u} neutral that brightens the face and layers cleanly under everything.`;
  }
  if (isNeutral) {
    return `A versatile ${u} neutral — the quiet base that pairs with every other tone in your ${opts.label} palette.`;
  }
  return `A muted ${u} tone that adds interest at ${opts.contrast} contrast while staying true to your ${opts.label} colouring.`;
}

/**
 * Season-level "colours to avoid" — deterministic, defensible picks that fight
 * each season's undertone / chroma. Kept season-level (not per-subseason) since
 * the clash logic is driven by temperature and contrast, not fine subtype.
 */
const SEASON_AVOID: Record<Season, ColorRec[]> = {
  summer: [
    {
      name: "Pure Black",
      hex: "#000000",
      why: "Too stark for soft, cool colouring — it overpowers your features and casts hard shadows on the face.",
    },
    {
      name: "Bright Orange",
      hex: "#FF6B35",
      why: "A hot, warm hue that fights your cool undertone and reads garish beside muted summer tones.",
    },
    {
      name: "Golden Yellow",
      hex: "#F4C430",
      why: "Warm and high-chroma — it drains cool skin and looks brash against your soft palette.",
    },
    {
      name: "Rust",
      hex: "#B7410E",
      why: "An earthy, warm tone that clashes with your cool undertone and dulls your natural freshness.",
    },
  ],
  winter: [
    {
      name: "Rust",
      hex: "#A85A2E",
      why: "Muted and earthy — it muddies the clear, cool contrast that winter colouring wears best.",
    },
    {
      name: "Mustard",
      hex: "#C99A3A",
      why: "Warm and dusty; it fights your cool undertone and flattens your natural clarity.",
    },
    {
      name: "Warm Beige",
      hex: "#C7A26B",
      why: "Too soft and warm — winter colouring needs crisp, cool tones, not muddy neutrals.",
    },
    {
      name: "Olive",
      hex: "#6E6A34",
      why: "A warm, muted green that dulls the sharp contrast your colouring carries best.",
    },
  ],
  spring: [
    {
      name: "Pure Black",
      hex: "#000000",
      why: "Too heavy for warm, bright colouring — it overwhelms your natural glow.",
    },
    {
      name: "Dusty Mauve",
      hex: "#9C6B84",
      why: "Cool and muted; it greys out the warm clarity that lights up your complexion.",
    },
    {
      name: "Charcoal Slate",
      hex: "#54606E",
      why: "A cool, muddy grey that fights your warmth and flattens your bright colouring.",
    },
    {
      name: "Cool Burgundy",
      hex: "#6E1330",
      why: "Deep and cool-muted — it sits heavy against your light, warm palette.",
    },
  ],
  autumn: [
    {
      name: "Pure Black",
      hex: "#000000",
      why: "Too stark for warm, muted colouring — it drains the richness from your skin.",
    },
    {
      name: "Icy Pink",
      hex: "#F2C6D2",
      why: "A cool pastel that clashes with your warm undertone and washes you out.",
    },
    {
      name: "Fuchsia",
      hex: "#B01455",
      why: "Cool and high-chroma; it fights the earthy warmth your colouring wears best.",
    },
    {
      name: "Cool Cobalt",
      hex: "#0E63C4",
      why: "A bright, cool blue that overwhelms your soft, warm palette.",
    },
  ],
};

/** Deterministic "best" colours for a subseason (curated hexes + names + why). */
export function bestColorsForSubseason(
  subseason: SubseasonId,
  opts: { undertone: Undertone; contrast: Contrast },
): ColorRec[] {
  const label = SUBSEASON_LABELS[subseason];
  const swatches = SUBSEASON_PALETTES[subseason];
  // The palette closes with VERSATILE_NEUTRAL_COUNT office-ready anchors; tag
  // them so the report can present them as their own explained group.
  const firstVersatile = swatches.length - VERSATILE_NEUTRAL_COUNT;
  return swatches.map((sw, i) => {
    const role = i >= firstVersatile ? ("versatile" as const) : undefined;
    return {
      name: sw.name,
      hex: sw.hex,
      why: whyForBestSwatch(sw, { ...opts, label, role }),
      ...(role ? { role } : {}),
    };
  });
}

/** Deterministic "avoid" colours for a subseason's base season. */
export function avoidColorsForSubseason(subseason: SubseasonId): ColorRec[] {
  return SEASON_AVOID[seasonForSubseason(subseason)];
}

/**
 * The full deterministic report palette (best + avoid) for a client's colouring.
 * Same subseason + undertone + contrast always produce identical output, so two
 * reports from the same photo can never show different palettes.
 */
export function reportPalette(opts: {
  subseason: SubseasonId;
  undertone: Undertone;
  contrast: Contrast;
}): { best: ColorRec[]; avoid: ColorRec[] } {
  return {
    best: bestColorsForSubseason(opts.subseason, opts),
    avoid: avoidColorsForSubseason(opts.subseason),
  };
}
