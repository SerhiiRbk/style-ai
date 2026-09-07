/**
 * Look garments that found no catalogue match — shown as "No close match yet"
 * chips beside Shop the Look, so an empty hero slot reads as a deliberate gap,
 * not a missing feature. Pure; no server imports.
 */
export type LookSlotLike = { garment: string; color?: string | null };

/** Lower-case, singular-ish words: "Suede Loafers" → "suede loafer". */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/(\w)s\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Structured look items not covered by any matched pick. Matched picks carry
 * the vocabulary noun they filled (`garment`); a pick without it is a legacy
 * match with no slot information, so nothing is reported for that look.
 */
export function wantedLookGarments(
  matched: { garment?: string }[],
  lookItems: LookSlotLike[] | null | undefined,
): LookSlotLike[] {
  if (!lookItems?.length) return [];
  const covered = matched
    .map((it) => normalise(it.garment ?? ""))
    .filter(Boolean);
  // No picks at all — every structured slot is a deliberate gap.
  if (!matched.length) {
    return lookItems.filter((li) => Boolean(normalise(li.garment)));
  }
  // Legacy picks with no slot noun: stay silent rather than flag everything.
  if (!covered.length) return [];
  return lookItems.filter((li) => {
    // The model sometimes files a descriptor with the colour ("light-blue
    // oxford" + "shirt") while the matcher keyed the slot on that descriptor
    // ("oxford") — so test the whole phrase, not the noun alone.
    const g = normalise(`${li.color ?? ""} ${li.garment}`);
    if (!normalise(li.garment)) return false;
    return !covered.some((c) => new RegExp(`\\b${escapeRe(c)}\\b`).test(g));
  });
}
