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
  work: {
    conservative:
      "Work conservative: every look is a blazer or a tucked shirt with a tie. " +
      "No Fair Isle, fisherman rib or motif knit as the outer layer.",
    moderate:
      "Work moderate: modern office — a blazer, a tucked shirt, or a plain unpatterned merino. " +
      "No motif knit unless this set is large and this slot allows it.",
    experimental:
      "Work adventurous: unexpected but wearable office — texture and, on selected slots only, " +
      "a closed ornamental knit (Fair Isle, fisherman). Still leather shoes, no tote.",
    statement:
      "Work statement: a clear focal piece — bolder colour or an ornamental knit on selected slots, " +
      "never sloppy, never a tote. A jacket is not required on every look.",
  },
  weekend: {
    conservative:
      "Weekend conservative: neat casual — polo or oxford, chinos, leather sneakers or loafers. No loud graphics.",
    moderate:
      "Weekend balanced: easy layers and one interesting texture, still off-duty.",
    experimental:
      "Weekend adventurous: unexpected colour or a motif knit, still considered.",
    statement:
      "Weekend statement: a bold casual hero — pattern or colour, not a quieter office clone.",
  },
  dinner: {
    conservative:
      "Dinner conservative: a dark jacket or a dark knit under a jacket. Quiet, not flashy.",
    moderate:
      "Dinner balanced: a refined evening layer and a clear but calm focal piece.",
    experimental:
      "Dinner adventurous: unexpected evening texture or colour, still restaurant-appropriate.",
    statement:
      "Dinner statement: a bold evening focal garment — richer colour or fabric, not daytime office.",
  },
  formal: {
    conservative:
      "Formal conservative: a tailored jacket on every look. Classic, no motif knit as the outer layer.",
    moderate:
      "Formal moderate: sharp tailoring with one modern texture.",
    experimental:
      "Formal adventurous: unexpected evening fabric or colour inside formal rules.",
    statement:
      "Formal statement: a dinner jacket or equally strong evening layer — high-impact, never costume.",
  },
  smart_casual: {
    conservative:
      "Smart-casual conservative: oxford or polo, tailored trousers or chinos, no loud knit.",
    moderate:
      "Smart-casual balanced: one relaxed layer, still meeting-adjacent.",
    experimental:
      "Smart-casual adventurous: texture or a motif knit on some looks, still polished.",
    statement:
      "Smart-casual statement: a bold hero piece — colour or pattern — without collapsing into weekend slouch.",
  },
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

export type WorkLookSlot =
  | "blazer"
  | "shirt_tie"
  | "blazer_knit"
  | "plain_knit"
  | "ornamental_knit";

const WORK_OFFICE_CONSERVATIVE = [
  "blazer",
  "shirt_tie",
  "blazer_knit",
] as const satisfies readonly WorkLookSlot[];

const WORK_OFFICE_OPEN = [
  "blazer",
  "shirt_tie",
  "plain_knit",
  "blazer_knit",
] as const satisfies readonly WorkLookSlot[];

const WORK_SLOT_DIRECTIVE: Record<WorkLookSlot, string> = {
  blazer:
    "This look: a tailored blazer or sport coat over a tucked oxford. No Fair Isle or fisherman as the outer layer.",
  shirt_tie:
    "This look: a tucked shirt and a necktie — no jacket required, no closed ornamental knit as the outer layer.",
  blazer_knit:
    "This look: a blazer over a plain merino (V-neck or fine crew under the jacket). No Fair Isle as the outer layer.",
  plain_knit:
    "This look: a plain unpatterned merino or roll-neck as the outer layer — no Fair Isle, no motif. A jacket is optional.",
  ornamental_knit:
    "This look: a closed ornamental knit as the outer layer is allowed — Fair Isle, fisherman rib or similar motif. No necktie on the closed knit. A jacket is not required.",
};

/** How many work looks in the set may wear ornamental knit as the outer layer. */
function ornamentalKnitBudget(looksCount: number, boldness: Boldness): number {
  if (boldness === "conservative") return 0;
  if (boldness === "moderate") return looksCount >= 9 ? 1 : 0;
  return Math.floor(looksCount / 3);
}

function isOrnamentalWorkSlot(
  lookIndex: number,
  looksCount: number,
  ornamentalCount: number,
): boolean {
  if (ornamentalCount <= 0) return false;
  const step = looksCount / ornamentalCount;
  for (let k = 0; k < ornamentalCount; k++) {
    const slot = Math.round(1 + k * step) % looksCount;
    if (slot === lookIndex) return true;
  }
  return false;
}

/**
 * Work silhouette for this slot. Conservative stays jacket or shirt-and-tie.
 * Adventurous / statement open ornamental knit on a fraction of the set —
 * more slots as the set grows (1/3, 2/6, 3/9).
 */
export function workLookSlot(
  lookIndex: number,
  looksCount: number,
  boldness: Boldness,
): WorkLookSlot {
  const count = Math.max(1, looksCount);
  const i = ((lookIndex % count) + count) % count;
  const ornamentalCount = ornamentalKnitBudget(count, boldness);
  if (isOrnamentalWorkSlot(i, count, ornamentalCount)) {
    return "ornamental_knit";
  }
  const office =
    boldness === "conservative" ? WORK_OFFICE_CONSERVATIVE : WORK_OFFICE_OPEN;
  return office[i % office.length]!;
}

export function workSilhouetteDirective(opts: {
  boldness: Boldness;
  lookIndex: number;
  looksCount?: number;
}): string {
  const looksCount =
    opts.looksCount != null &&
    Number.isInteger(opts.looksCount) &&
    opts.looksCount > 0
      ? opts.looksCount
      : 3;
  return WORK_SLOT_DIRECTIVE[workLookSlot(opts.lookIndex, looksCount, opts.boldness)];
}

/**
 * Variety scales with set size. Empty when the slot or count is missing,
 * or when this is a single extra look.
 */
export function setVarietyDirective(
  lookIndex?: number,
  looksCount?: number,
): string {
  if (
    lookIndex == null ||
    !Number.isInteger(lookIndex) ||
    looksCount == null ||
    !Number.isInteger(looksCount) ||
    looksCount < 3
  ) {
    return "";
  }
  if (looksCount <= 3) {
    return "This is a 3-look set — keep the three silhouettes coherent, not three clones.";
  }
  if (looksCount <= 6) {
    return "This is a 6-look set — each look must be a distinct silhouette from the others, not a colour swap of the same formula.";
  }
  return "This is a 9-look set — range widely across silhouettes; do not clone a neighbour.";
}

export function composeLookBrief(
  brief: string,
  opts: {
    boldness?: Boldness;
    season?: LookBriefSeason;
    occasionId?: string;
    lookIndex?: number;
    looksCount?: number;
    styleId?: string;
  } = {},
): string {
  const { boldness, season, occasionId, lookIndex, styleId, looksCount } = opts;
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
  const workSlotNote =
    occasionId === "work" &&
    boldness &&
    lookIndex != null &&
    Number.isInteger(lookIndex)
      ? `${workSilhouetteDirective({ boldness, lookIndex, looksCount })} `
      : "";
  const varietyNote = (() => {
    const text = setVarietyDirective(lookIndex, looksCount);
    return text ? `${text} ` : "";
  })();
  const workShirtNote =
    occasionId === "work" || occasionId === "formal"
      ? "Work shirt: light-blue oxford if the trousers are light (oatmeal, cream, stone, light grey); " +
        "white oxford if the trousers are dark or brown (coffee, chocolate, navy, charcoal). " +
        "Always tuck the shirt into the trousers. " +
        "Do not put a chromatic hero colour on the shirt. " +
        "Never a tote, shopper or canvas bag in the hand — empty hands, or a slim leather briefcase or messenger if a bag is needed. "
      : "";
  return `${seasonNote}${strictnessNote}${occasionNote}${styleNote}${fabricNote}${workSlotNote}${varietyNote}${workShirtNote}${brief}`;
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
  "Never pair mushroom, greige, taupe or beige trousers with matching greige/beige shoes. " +
  "One chromatic hero per look — jacket or knit or trousers or shoes may be the saturated colour; a second piece in that colour only as belt, tie or pocket square. " +
  "Shoes must not match the jacket unless both are a dark navy or black formal set. " +
  "Never pair two mid-neutrals (greige, mushroom, taupe, stone, camel, beige, mid-grey) without a dark anchor — navy, charcoal, black or dark brown jacket or shoes. " +
  "Never pair a necktie with a closed crewneck, roll-neck or turtleneck — the tie sits on a collared shirt and shows in a V-neck or open cardigan, never on top of a jumper. " +
  "If the look is shorts or bermudas: no blazer, jacket, coat, jumper, sweater, cardigan, hoodie or sweatshirt, and no oxfords, brogues, derbies or boots — loafers, sneakers or sandals only.";

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

const TIE_ITEM_RE = /\b(?:bow\s+)?(?:neck)?ties?\b|\bbolo\b/i;
const KNITTED_TIE_RE = /\bknit(?:ted)?\s+tie\b/i;
const OPEN_KNIT_RE = /\bv[\s-]?necks?\b|\bcardigans?\b/i;
const CLOSED_NECK_RE =
  /\bcrew[\s-]?necks?\b|\broll[\s-]?necks?\b|\bturtlenecks?\b/i;
const JUMPER_RE = /\b(jumpers?|sweaters?|pullovers?|hoodies?|knitwear)\b/i;

function clauseIsTie(part: string): boolean {
  if (KNITTED_TIE_RE.test(part)) return true;
  if (!TIE_ITEM_RE.test(part)) return false;
  return !CLOSED_NECK_RE.test(part) && !JUMPER_RE.test(part);
}

function clauseIsClosedKnit(part: string): boolean {
  if (clauseIsTie(part) || OPEN_KNIT_RE.test(part)) return false;
  return CLOSED_NECK_RE.test(part) || JUMPER_RE.test(part);
}

function rewriteClosedKnitClause(part: string): string {
  let next = part
    .replace(/\bcrew[\s-]?neck(?:ed)?\b/gi, "V-neck")
    .replace(/\broll[\s-]?neck(?:ed)?\b/gi, "V-neck")
    .replace(/\bturtleneck(?:ed)?s?\b/gi, "V-neck");
  if (!/\bv[\s-]?neck/i.test(next)) {
    next = next.replace(
      /\b(hoodies?|sweaters?|pullovers?|knitwear|jumpers?)\b/i,
      "V-neck jumper",
    );
  }
  if (!/worn over the shirt and tie/i.test(next)) {
    next = `${next} worn over the shirt and tie`;
  }
  return next;
}

/**
 * A necktie cannot sit on a closed crewneck or roll-neck. Rewrite that knit
 * to a V-neck worn over the shirt so the image model does not paint the blade
 * on top of the jumper.
 */
export function rewriteClosedKnitWithTie(description: string): string {
  if (!description.trim()) return description;
  const parts = description
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.some(clauseIsTie)) return description;
  return parts
    .map((part) => (clauseIsClosedKnit(part) ? rewriteClosedKnitClause(part) : part))
    .join(", ");
}

const CASUAL_TOTE_RE = /\b(totes?|shoppers?)\b/i;

function isTailoredOccasion(occasionId?: string | null): boolean {
  return occasionId === "work" || occasionId === "formal";
}

/** A tote in the hand reads weekend, not Work / meetings or Formal. */
export function stripCasualTote(
  description: string,
  occasionId?: string | null,
): string {
  if (!description.trim() || !isTailoredOccasion(occasionId)) return description;
  if (!CASUAL_TOTE_RE.test(description)) return description;
  return description
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !CASUAL_TOTE_RE.test(part))
    .join(", ");
}

/** Strip handheld props, hostless pocket squares, and work/formal totes. */
export function sanitizeLookDescription(
  description: string,
  occasionId?: string | null,
): string {
  return rewriteClosedKnitWithTie(
    stripCasualTote(
      stripMisplacedPocketSquare(stripHandheldProps(description)),
      occasionId,
    ),
  );
}

/**
 * Mirror of {@link sanitizeLookDescription} for the structured `items` slots:
 * drop handheld props and a pocket square with no jacket in the (already
 * sanitised) description, so items never resurrect a piece the prose dropped.
 * Returns undefined when nothing survives, signalling "no structured slots".
 */
export function sanitizeLookItems<T extends { garment: string }>(
  items: T[] | null | undefined,
  sanitizedDescription: string,
  occasionId?: string | null,
): T[] | undefined {
  if (!items?.length) return undefined;
  const kept = items.filter((item) => {
    const garment = item.garment ?? "";
    if (HANDHELD_PROP_RE.test(garment)) return false;
    if (POCKET_SQUARE_RE.test(garment) && !hasJacketHost(sanitizedDescription)) {
      return false;
    }
    if (isTailoredOccasion(occasionId) && CASUAL_TOTE_RE.test(garment)) {
      return false;
    }
    return true;
  });
  if (!kept.length) return undefined;
  const hasTie =
    kept.some((item) => clauseIsTie(item.garment ?? "")) ||
    sanitizedDescription.split(",").some((part) => clauseIsTie(part.trim()));
  if (!hasTie) return kept;
  return kept.map((item) =>
    clauseIsClosedKnit(item.garment ?? "")
      ? { ...item, garment: "V-neck jumper" }
      : item,
  );
}
