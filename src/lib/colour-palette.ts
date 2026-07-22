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
 * Menswear-plausible 8-swatch palette per 12-subseason colour analysis.
 * Single source of truth for the free `/colours` page (and, later, the report).
 * Each palette leads with a light/cream and a deep anchor, then characteristic hues.
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
