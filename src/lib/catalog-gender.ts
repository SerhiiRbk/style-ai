/** Feed values that mean "no stated gender" — treat as matching any filter. */
const UNSTATED_GENDERS = new Set(["", "any", "unstated", "unisex"]);

/**
 * Whether a catalogue product may fill a gendered search.
 * Men / women filters still exclude the opposite sex and kids; null, empty,
 * "any", "unstated" and "unisex" stay eligible (admin "Any / unstated").
 */
export function catalogGenderAllowed(
  productGender: string | null | undefined,
  filter: string | null | undefined,
): boolean {
  if (!filter) return true;
  const g = (productGender ?? "").trim().toLowerCase();
  if (UNSTATED_GENDERS.has(g)) return true;
  return g === filter.trim().toLowerCase();
}
