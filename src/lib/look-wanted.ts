/**
 * Look garments that found no catalogue match. Used in audits and regression
 * fixtures — the shop UI no longer lists empty slots as "No close match yet".
 * Pure; no server imports.
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
 * Blazer / sport coat vs winter coat. `\bcoat\b` matches "sport coat", so a
 * wool-coat pick must not silence a sport-coat chip, and a blazer pick should
 * cover knit blazer and sport coat.
 */
function slotOuterFamily(text: string): "blazer" | "coat" | null {
  const n = normalise(text);
  if (/\bsport\s*coat/.test(n) || n.includes("sportcoat")) return "blazer";
  if (/\bblazer\b/.test(n)) return "blazer";
  if (/\b(over\s*coat|top\s*coat)\b/.test(n) || /\bcoat\b/.test(n)) return "coat";
  return null;
}

function shopCoversLookSlot(shopGarment: string, lookPhrase: string): boolean {
  const shopFam = slotOuterFamily(shopGarment);
  const lookFam = slotOuterFamily(lookPhrase);
  if (shopFam && lookFam && shopFam !== lookFam) return false;
  if (shopFam === "blazer" && lookFam === "blazer") return true;
  return new RegExp(`\\b${escapeRe(shopGarment)}\\b`).test(lookPhrase);
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
    return !covered.some((c) => shopCoversLookSlot(c, g));
  });
}
