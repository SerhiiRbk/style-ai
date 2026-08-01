/**
 * Shared credit/outfit budget bands — used by the report intake and Shop a Look.
 * Prices are EUR caps for matching; display labels stay human-readable.
 */

export type BudgetBand = {
  id: string;
  label: string;
  min: number;
  max: number;
};

export const BUDGET_BANDS: BudgetBand[] = [
  { id: "200-500", label: "€200–500", min: 200, max: 500 },
  { id: "400-1200", label: "€400–1200", min: 400, max: 1200 },
  { id: "1000-3000", label: "€1000–3000", min: 1000, max: 3000 },
  { id: "3000+", label: "€3000+", min: 3000, max: 8000 },
];

/** Sentinel max price when the shopper opts out of a budget filter. */
export const BUDGET_ANY_MAX = 50_000;

/**
 * Shop a Look / matching preference. `any` means no price preference;
 * `range` is a soft preference (in-budget first, fill from outside if needed).
 */
export type BudgetPreference =
  | { mode: "any" }
  | { mode: "range"; min: number; max: number; label: string };

export function budgetPreferenceFromBandId(
  id: string | null | undefined,
): BudgetPreference {
  if (!id || id === "any") return { mode: "any" };
  const band = BUDGET_BANDS.find((b) => b.id === id);
  if (!band) return { mode: "any" };
  return {
    mode: "range",
    min: band.min,
    max: band.max,
    label: band.label,
  };
}

export function isPriceInBudget(
  priceEur: number,
  preference: BudgetPreference,
): boolean {
  if (preference.mode === "any") return true;
  if (!Number.isFinite(priceEur)) return false;
  return priceEur >= preference.min && priceEur <= preference.max;
}

/** Stable cache-key fragment for a preference. */
export function budgetCacheKey(preference: BudgetPreference): string {
  if (preference.mode === "any") return "any";
  return `${preference.min}-${preference.max}`;
}
