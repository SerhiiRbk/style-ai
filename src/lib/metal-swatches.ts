/**
 * Static SVG swatches for the report "Metals & hardware" section.
 * Filenames match `public/images/metals/` and `valetti-metals-manifest.md`.
 * Keys are the exact `Metal.name` strings from `metalsFor()` in style-extras.
 */

const METAL_DIR = "/images/metals";

/** Recommend chips — keyed by metal display name. */
export const METAL_SWATCH_SRC: Record<string, string> = {
  Silver: `${METAL_DIR}/valetti-silver.svg`,
  "Brushed steel": `${METAL_DIR}/valetti-brushed-steel.svg`,
  "White gold / platinum": `${METAL_DIR}/valetti-white-gold-platinum.svg`,
  "Yellow gold": `${METAL_DIR}/valetti-yellow-gold.svg`,
  "Brass / bronze": `${METAL_DIR}/valetti-brass-bronze.svg`,
  "Cognac leather": `${METAL_DIR}/valetti-cognac-leather.svg`,
  "Soft gold": `${METAL_DIR}/valetti-soft-gold.svg`,
  Steel: `${METAL_DIR}/valetti-steel.svg`,
  "Two-tone": `${METAL_DIR}/valetti-two-tone.svg`,
};

const AVOID_YELLOW_GOLD = `${METAL_DIR}/valetti-avoid-bright-yellow-gold-v2.svg`;
const AVOID_COOL_CHROME = `${METAL_DIR}/valetti-avoid-cool-chrome-v2.svg`;

export function metalSwatchSrc(name: string): string | undefined {
  return METAL_SWATCH_SRC[name];
}

/**
 * Avoid icon from the recommend set (language-stable). Cool palettes warn off
 * yellow gold; warm palettes warn off cool chrome; neutral has no hard avoid.
 */
export function metalAvoidSwatchSrc(
  recommendNames: readonly string[],
): string | undefined {
  if (recommendNames.includes("Silver")) return AVOID_YELLOW_GOLD;
  if (recommendNames.includes("Yellow gold")) return AVOID_COOL_CHROME;
  return undefined;
}
