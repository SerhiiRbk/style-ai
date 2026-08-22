import type { Boldness } from "@/lib/style-profile";
import { lookStyleById, lookStyleHasBrief } from "@/lib/look-styles";

/** Seasons `generateExtraLook` can be told to weight the outfit for. */
export type LookBriefSeason = "spring" | "summer" | "autumn" | "winter";

/**
 * Per-`Boldness` guidance woven into the styling brief so the reasoning
 * model's outfit description actually shifts in formality/adventurousness
 * with the client's chosen strictness — not just the palette.
 */
const STRICTNESS: Record<Boldness, string> = {
  conservative: "canonically correct, understated, safe",
  moderate: "modern and balanced",
  experimental: "adventurous — unexpected but wearable combinations",
  statement:
    "high-impact and standout — unusual but wearable colour and texture pairings, a clear focal point, never a quieter office version of the same idea",
};

/**
 * Occasion × strictness extras. Party + Statement must not collapse into
 * office merino and a tote — that reads dull on a night out.
 */
const OCCASION_MOOD: Partial<
  Record<string, Partial<Record<Boldness, string>>>
> = {
  party: {
    conservative:
      "Night-out conservative: sharp after-dark tailoring and one refined detail — not a daytime office knit.",
    moderate:
      "Night-out balanced: evening fabrics and a clear focal piece. No office jumper-and-tote.",
    experimental:
      "Night-out experimental: unexpected evening pairings from the palette — velvet, silk, sharp tailoring. No tote, no standalone office crewneck.",
    statement:
      "PARTY STATEMENT: dress for after dark, not the office. Evening fabrics " +
      "(velvet, silk, satin, sharp tailoring; a silk or fine-cotton shirt; a knit ONLY under a jacket). " +
      "Richer, clearer, higher-chroma heroes and an unexpected colour or texture clash from the palette — " +
      "not a dusty-rose merino crewneck under a blazer with greige trousers. " +
      "No large tote, shopper, backpack or office bag. No daytime crewneck-and-chinos energy. " +
      "Never a shirt-and-trousers office silhouette — every look needs an evening jacket " +
      "or equally strong after-dark layer, not a standalone button-down. " +
      "Do not put a velvet blazer on every look — vary the jacket fabric across the set. " +
      "Each look needs a bold focal garment AND an unusual pairing.",
  },
};

/**
 * Prepend season + strictness guidance onto a styling brief for
 * `generateExtraLook` (pipeline.ts). Pure and deterministic — same inputs
 * always produce the same string, and omitting both `boldness` and `season`
 * leaves `brief` byte-for-byte unchanged. Kept in its own dependency-light
 * module (no "server-only", no AI SDK) so it can be unit-tested directly,
 * unlike the rest of pipeline.ts which requires a live model.
 *
 * NOTE: this only shapes the TEXT brief — never the look IMAGE prompt
 * (`generateLookImage`), which is out of scope by design.
 */
/** Rotate evening jacket fabrics so a 3-look party set is not three velvets. */
const PARTY_JACKET_FABRIC = [
  "Jacket fabric for THIS look: a velvet blazer — the set's evening hero.",
  "Jacket fabric for THIS look: a corduroy sport coat or an unstructured casual blazer. Do NOT use velvet.",
  "Jacket fabric for THIS look: a wool hopsack, tweed or suede blazer. Do NOT use velvet or corduroy.",
] as const;

export function partyJacketFabricDirective(lookIndex: number): string {
  return PARTY_JACKET_FABRIC[((lookIndex % 3) + 3) % 3]!;
}

/** True when the brief's jacket fabric matches the party slot rotation. */
export function partyJacketMatchesSlot(
  description: string,
  lookIndex: number,
): boolean {
  const slot = ((lookIndex % 3) + 3) % 3;
  const velvet = /\bvelvet\b/i.test(description);
  const cord = /\bcorduroy\b/i.test(description);
  if (!hasJacketHost(description)) return false;
  if (slot === 1) return !velvet;
  if (slot === 2) return !velvet && !cord;
  return true;
}

export function composeLookBrief(
  brief: string,
  opts: {
    boldness?: Boldness;
    season?: LookBriefSeason;
    occasionId?: string;
    lookIndex?: number;
    styleId?: string;
  } = {},
): string {
  const { boldness, season, occasionId, lookIndex, styleId } = opts;
  const seasonNote = season
    ? `Season: ${season} — adjust fabric weight, layering and outerwear accordingly. `
    : "";
  const strictnessNote = boldness
    ? `Strictness: ${boldness} — ${STRICTNESS[boldness]}. `
    : "";
  const mood =
    occasionId && boldness
      ? OCCASION_MOOD[occasionId]?.[boldness]
      : undefined;
  const occasionNote = mood ? `${mood} ` : "";
  const style = lookStyleById(styleId);
  const styleNote =
    lookStyleHasBrief(styleId) && style?.brief ? `${style.brief} ` : "";
  const fabricNote =
    occasionId === "party" &&
    lookIndex != null &&
    Number.isInteger(lookIndex) &&
    !lookStyleHasBrief(styleId)
      ? `${partyJacketFabricDirective(lookIndex)} `
      : "";
  return `${seasonNote}${strictnessNote}${occasionNote}${styleNote}${fabricNote}${brief}`;
}

/**
 * Look descriptions must name clothes that sit on the body, or one normal bag.
 * Handheld props (wallet, cardholder, phone) get rendered in the hand — they
 * are not menswear and must not appear in the brief.
 */
export const LOOK_WEARABLE_RULE =
  "Wear only garments that sit on the body, plus at most one normal bag " +
  "(tote, backpack, briefcase or messenger). Never name handheld props: " +
  "no wallet, cardholder, billfold, phone, keys, cup or anything held in a hand. " +
  "Name a pocket square only when the look also has a blazer or sport coat " +
  "with a breast pocket. Never put a pocket square on a shirt-only look, " +
  "a jumper, sweater or crewneck, and never in a trouser pocket. " +
  "Shoes must clearly contrast the trousers — different lightness or colour family. " +
  "Never pair mushroom, greige, taupe or beige trousers with matching greige/beige shoes.";

/** Append {@link LOOK_WEARABLE_RULE} to a styling brief. */
export function withWearableLookRule(brief: string): string {
  const trimmed = brief.trim();
  if (!trimmed) return LOOK_WEARABLE_RULE;
  const sep = /[.!?]\s*$/.test(trimmed) ? " " : ". ";
  return `${trimmed}${sep}${LOOK_WEARABLE_RULE}`;
}

const HANDHELD_PROP_RE =
  /\b(card[\s-]?holders?|wallets?|billfolds?|phones?|smartphones?|mobiles?|keys?|key[\s-]?fobs?|coffee cups?|cups?|glasses of)\b/i;

/**
 * Drop comma-separated garment clauses that are handheld props, so a look
 * image is not prompted to put a wallet or phone in the person's hand.
 */
export function stripHandheldProps(description: string): string {
  if (!description.trim()) return "";
  return description
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !HANDHELD_PROP_RE.test(part))
    .join(", ");
}

const POCKET_SQUARE_RE = /\b(pocket[\s-]?squares?|pochettes?)\b/i;
const JACKET_HOST_RE =
  /\b(blazers?|sport\s*coats?|sportcoats?|suit\s+jackets?|dinner\s+jackets?|tuxedo\s+jackets?|tailored\s+jackets?)\b/i;

export function hasJacketHost(description: string): boolean {
  return JACKET_HOST_RE.test(description);
}

/** True when the brief has a jacket breast pocket for a pocket square. */
export function pocketSquareHasHost(description: string): boolean {
  return hasJacketHost(description);
}

/**
 * Drop a pocket square that has nowhere to sit — e.g. named next to a jumper
 * with no blazer, which the image model then tucks into a trouser pocket.
 */
export function stripMisplacedPocketSquare(description: string): string {
  if (!description.trim()) return "";
  if (!POCKET_SQUARE_RE.test(description)) return description;
  if (pocketSquareHasHost(description)) return description;
  return description
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !POCKET_SQUARE_RE.test(part))
    .join(", ");
}

/** Strip handheld props and pocket squares that have no jacket host. */
export function sanitizeLookDescription(description: string): string {
  return stripMisplacedPocketSquare(stripHandheldProps(description));
}
