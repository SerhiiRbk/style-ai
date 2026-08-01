/**
 * Budget bands for matching.
 *
 * - {@link OUTFIT_BUDGET_BANDS}: wardrobe-refresh totals (report intake).
 * - {@link ITEM_BUDGET_BANDS}: per-SKU price preference (Shop a Look).
 *
 * Do not reuse outfit bands for per-item matching — a €200–500 outfit band
 * treats a €45 Zara blazer as out of band and ranks the priciest mass-market
 * pieces first.
 */

export type BudgetBand = {
  id: string;
  label: string;
  min: number;
  max: number;
};

/** Outfit / wardrobe-refresh totals — used by the report intake. */
export const OUTFIT_BUDGET_BANDS: BudgetBand[] = [
  { id: "200-500", label: "€200–500", min: 200, max: 500 },
  { id: "400-1200", label: "€400–1200", min: 400, max: 1200 },
  { id: "1000-3000", label: "€1000–3000", min: 1000, max: 3000 },
  { id: "3000+", label: "€3000+", min: 3000, max: 8000 },
];

/** @deprecated Use {@link OUTFIT_BUDGET_BANDS}. Kept for existing imports. */
export const BUDGET_BANDS = OUTFIT_BUDGET_BANDS;

/** Sentinel max price when the shopper opts out of a budget filter. */
export const BUDGET_ANY_MAX = 50_000;

/**
 * Per-piece price bands for Shop a Look (and similar item matchers).
 * Aligned with mass-market → premium catalogue price reality.
 */
export const ITEM_BUDGET_BANDS: BudgetBand[] = [
  { id: "0-50", label: "Up to €50", min: 0, max: 50 },
  { id: "50-150", label: "€50–150", min: 50, max: 150 },
  { id: "150-400", label: "€150–400", min: 150, max: 400 },
  { id: "400+", label: "€400+", min: 400, max: BUDGET_ANY_MAX },
];

/**
 * Soft price preference for matching. `any` means no filter;
 * `range` prefers in-band first, then fills from outside if needed.
 */
export type BudgetPreference =
  | { mode: "any" }
  | { mode: "range"; min: number; max: number; label: string };

function preferenceFromBand(
  id: string | null | undefined,
  bands: BudgetBand[],
): BudgetPreference {
  if (!id || id === "any") return { mode: "any" };
  const band = bands.find((b) => b.id === id);
  if (!band) return { mode: "any" };
  return {
    mode: "range",
    min: band.min,
    max: band.max,
    label: band.label,
  };
}

/** Resolve a Shop a Look / per-item budget band id. */
export function itemBudgetPreferenceFromBandId(
  id: string | null | undefined,
): BudgetPreference {
  return preferenceFromBand(id, ITEM_BUDGET_BANDS);
}

/**
 * @deprecated Outfit-band resolver — prefer {@link itemBudgetPreferenceFromBandId}
 * for Shop a Look. Kept so old outfit band ids don't crash if passed.
 */
export function budgetPreferenceFromBandId(
  id: string | null | undefined,
): BudgetPreference {
  return preferenceFromBand(id, OUTFIT_BUDGET_BANDS);
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
