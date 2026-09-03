import "server-only";
import type { StyleProfile, SubseasonId } from "@/lib/style-profile";
import { neutralMatchProfile } from "@/lib/data/match-profile";
import { seasonForSubseason, type PaletteSwatch } from "@/lib/colour-palette";
import type { LookGarment } from "@/lib/style-extras";
import type { CatalogCategory } from "@/lib/catalog-categories";
import type { Geo } from "@/lib/geo";

/**
 * Anonymous palette-based recommendations (§5). No look photo — the visitor's
 * palette (from colour analysis or the quiz) plus a chosen occasion drives the
 * existing Shop a Look matcher. This module is the thin adapter: it synthesizes
 * a {@link StyleProfile} and a {@link LookGarment} list the matcher understands.
 */

/** Where a palette colour sits, so core pieces stay neutral and tops carry accent. */
type ColorRole = "neutral" | "light" | "accent";

type GarmentTemplate = {
  category: CatalogCategory;
  garment: string;
  role: ColorRole;
};

/**
 * Per-occasion garment templates. `look-contexts.ts` carries no garment mapping
 * (it's prompt metadata), so the menswear breakdown lives here. Occasion ids
 * mirror LOOK_CONTEXTS.
 */
const OCCASION_GARMENTS: Record<string, GarmentTemplate[]> = {
  work: [
    { category: "Outerwear", garment: "tailored blazer", role: "neutral" },
    { category: "Shirts", garment: "dress shirt", role: "light" },
    { category: "Trousers", garment: "tailored trousers", role: "neutral" },
    { category: "Footwear", garment: "derby shoes", role: "neutral" },
  ],
  smart_casual: [
    { category: "Knitwear", garment: "fine-gauge sweater", role: "accent" },
    { category: "Shirts", garment: "oxford shirt", role: "light" },
    { category: "Trousers", garment: "chinos", role: "neutral" },
    { category: "Footwear", garment: "loafers", role: "neutral" },
  ],
  weekend: [
    { category: "Knitwear", garment: "crew-neck sweater", role: "accent" },
    { category: "Shirts", garment: "overshirt", role: "neutral" },
    { category: "Trousers", garment: "jeans", role: "neutral" },
    { category: "Footwear", garment: "sneakers", role: "light" },
  ],
  dinner: [
    { category: "Outerwear", garment: "unstructured blazer", role: "neutral" },
    { category: "Shirts", garment: "shirt", role: "accent" },
    { category: "Trousers", garment: "trousers", role: "neutral" },
    { category: "Footwear", garment: "loafers", role: "neutral" },
  ],
  formal: [
    { category: "Outerwear", garment: "suit jacket", role: "neutral" },
    { category: "Shirts", garment: "dress shirt", role: "light" },
    { category: "Trousers", garment: "suit trousers", role: "neutral" },
    { category: "Footwear", garment: "oxford shoes", role: "neutral" },
  ],
  travel: [
    { category: "Outerwear", garment: "field jacket", role: "neutral" },
    { category: "Knitwear", garment: "merino sweater", role: "accent" },
    { category: "Trousers", garment: "travel chinos", role: "neutral" },
    { category: "Footwear", garment: "sneakers", role: "light" },
  ],
};

export const DEFAULT_OCCASION = "smart_casual";

const NEUTRAL_RE =
  /black|white|snow|ivory|charcoal|grey|gray|slate|navy|ink|stone|oat|beige|tan|camel|brown|taupe|sand|pewter|silver|khaki|cream|smoke/i;
const LIGHT_RE = /white|snow|ivory|icy|silver|cream|light/i;

function pickColor(palette: PaletteSwatch[], role: ColorRole): string | null {
  if (!palette.length) return null;
  const byName = (re: RegExp) => palette.find((s) => re.test(s.name));
  let swatch: PaletteSwatch | undefined;
  if (role === "light") {
    swatch = byName(LIGHT_RE) ?? byName(NEUTRAL_RE) ?? palette[0];
  } else if (role === "neutral") {
    swatch = byName(NEUTRAL_RE) ?? palette[0];
  } else {
    swatch = palette.find((s) => !NEUTRAL_RE.test(s.name)) ?? palette[palette.length - 1];
  }
  return swatch ? swatch.name.toLowerCase() : null;
}

/** Build the matcher's garment list for an occasion, coloured from the palette. */
export function buildAnonLookGarments(
  palette: PaletteSwatch[],
  occasionId: string,
): LookGarment[] {
  const template = OCCASION_GARMENTS[occasionId] ?? OCCASION_GARMENTS[DEFAULT_OCCASION];
  return template.map((t) => {
    const color = pickColor(palette, t.role);
    return {
      category: t.category,
      garment: t.garment,
      color,
      clause: color ? `${color} ${t.garment}` : t.garment,
    };
  });
}

/**
 * Synthesize the minimal profile the matcher reads: male, geo country/currency,
 * season from the subseason, and a boldness axis (§5.2 п. 6 — boldness is a
 * separate toggle, not an occasion).
 */
export function buildAnonProfile(
  subseason: SubseasonId,
  geo: Pick<Geo, "country" | "currency">,
  boldness: StyleProfile["boldness"] = "moderate",
  person?: {
    undertone?: StyleProfile["physical"]["undertone"];
    contrast?: StyleProfile["physical"]["contrast"];
    hairColor?: string | null;
    eyeColor?: string | null;
    skinTone?: string | null;
    skinHex?: string | null;
    hairHex?: string | null;
    eyeHex?: string | null;
    lighting?: StyleProfile["physical"]["lighting"];
  },
): StyleProfile {
  const base = neutralMatchProfile(geo.country ?? "Global");
  return {
    ...base,
    demographics: {
      ...base.demographics,
      genderPresentation: "male",
      country: geo.country ?? "Global",
    },
    physical: {
      ...base.physical,
      undertone: person?.undertone ?? base.physical.undertone,
      contrast: person?.contrast ?? base.physical.contrast,
      hairColor: person?.hairColor ?? base.physical.hairColor,
      eyeColor: person?.eyeColor ?? base.physical.eyeColor,
      skinTone: person?.skinTone ?? base.physical.skinTone,
      skinHex: person?.skinHex ?? undefined,
      hairHex: person?.hairHex ?? undefined,
      eyeHex: person?.eyeHex ?? undefined,
      lighting: person?.lighting ?? base.physical.lighting,
    },
    currency: geo.currency ?? "EUR",
    colorSeason: seasonForSubseason(subseason),
    colorSubseason: subseason,
    boldness,
  };
}
