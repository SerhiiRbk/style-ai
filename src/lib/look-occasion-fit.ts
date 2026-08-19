/**
 * Occasion formality for catalogue matching.
 * Work / formal trousers must not fall to holiday linen or relaxed fits
 * unless the look clause itself named that fabric or silhouette.
 */

const TAILORED_OCCASIONS = new Set(["work", "formal"]);

const TROUSER_GARMENTS = new Set([
  "trousers",
  "chinos",
  "chino",
  "pants",
  "slacks",
  "shorts",
]);

const LINEN_RE = /\blinen\b/i;
const RELAXED_RE = /\brelaxed\b/i;
const DRAWSTRING_RE = /\b(drawstring|elasticated|elastic(?:ated)?\s+waist)\b/i;
const CARGO_RE = /\b(cargo|joggers?|sweat\s?pants?)\b/i;

export function lookOccasionIsTailored(
  occasionId: string | null | undefined,
): boolean {
  return TAILORED_OCCASIONS.has(occasionId ?? "");
}

export function lookOccasionAppliesToGarment(
  occasionId: string | null | undefined,
  garment: string,
): boolean {
  if (!lookOccasionIsTailored(occasionId)) return false;
  return TROUSER_GARMENTS.has(garment.trim().toLowerCase());
}

/** True when this title is too casual for Work / Formal unless the clause asked. */
export function isOccasionCasualTrouserTitle(
  title: string,
  clause?: string | null,
): boolean {
  const asked = clause ?? "";
  if (LINEN_RE.test(title) && !LINEN_RE.test(asked)) return true;
  if (RELAXED_RE.test(title) && !RELAXED_RE.test(asked)) return true;
  if (DRAWSTRING_RE.test(title) && !DRAWSTRING_RE.test(asked)) return true;
  if (CARGO_RE.test(title)) return true;
  return false;
}

export function lookOccasionQueryHint(
  occasionId: string | null | undefined,
): string | null {
  if (!lookOccasionIsTailored(occasionId)) return null;
  return "tailored trousers or cotton chinos, not linen, not relaxed fit, not drawstring";
}

export function lookOccasionRerankHint(
  occasionId: string | null | undefined,
): string | null {
  if (!lookOccasionIsTailored(occasionId)) return null;
  return (
    "Occasion is Work / meetings or Formal — prefer tailored or cotton chinos. " +
    "Do not pick linen, relaxed-fit, drawstring or cargo trousers unless the look names them."
  );
}
