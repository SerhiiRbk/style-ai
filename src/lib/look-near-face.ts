import { hexToHsl, type ColorRec } from "@/lib/colour-palette";
import { colorFamilies, lookGarmentsFromItems, type LookItemSlot } from "@/lib/style-extras";

const OUTER_RE =
  /\b(blazer|jackets?|coats?|overcoats?|topcoats?|peacoats?|trench|parkas?|gilets?|bombers?|overshirts?|shackets?|cardigans?|suits?)\b/i;
const KNIT_RE =
  /\b(jumpers?|sweaters?|knitwear|knit|crewnecks?|roll ?necks?|turtlenecks?|hoodies?|sweatshirts?|pullovers?)\b/i;
const TOP_RE = /\b(shirts?|t-?shirts?|tees?|polos?|henleys?|tops?)\b/i;

/** The structured item that frames the face: outer layer, else knit, else shirt. */
export function nearFaceItem(items: LookItemSlot[] | null | undefined): LookItemSlot | null {
  if (!items?.length) return null;
  const pick = (re: RegExp) => items.find((it) => re.test(it.garment));
  return pick(OUTER_RE) ?? pick(KNIT_RE) ?? pick(TOP_RE) ?? null;
}

/**
 * Resolve an item's colour words to a BEST-palette swatch: exact name inside
 * the colour string first, then a shared colour family. Null when the words
 * name nothing in the palette (the caller falls back to the deepest swatch).
 */
export function swatchForColorWords(
  color: string | null | undefined,
  best: ColorRec[],
): ColorRec | null {
  const words = (color ?? "").toLowerCase().trim();
  if (!words) return null;
  const exact = best.find((sw) => sw.hex && words.includes(sw.name.toLowerCase()));
  if (exact) return exact;
  const fams = colorFamilies(words);
  if (!fams.size) return null;
  const candidates = best.filter((sw) => {
    if (!sw.hex) return false;
    const f = colorFamilies(sw.name);
    for (const x of f) if (fams.has(x)) return true;
    return false;
  });
  if (!candidates.length) return null;
  // Prefer the deeper swatch of the family — depth is what near-face contrast wants.
  return candidates.sort((a, b) => hexToHsl(a.hex).l - hexToHsl(b.hex).l)[0]!;
}

/**
 * Near-face swatch from the look's structured items — replaces the old
 * "palette[i] aligned to description order" guess, which `snapPaletteToBest`
 * silently broke by de-duplicating the palette.
 */
export function nearFaceSwatchFromItems(
  items: LookItemSlot[] | null | undefined,
  best: ColorRec[],
): ColorRec | null {
  const garments = lookGarmentsFromItems(items);
  const structured = garments.length
    ? nearFaceItem(garments.map((g) => ({ garment: g.garment, color: g.clause })))
    : nearFaceItem(items);
  if (!structured) return null;
  return swatchForColorWords(structured.color, best);
}
