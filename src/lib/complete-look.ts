import type { ShoppingItem } from "@/lib/report";
import type { LookGarment } from "@/lib/style-extras";
import { lookContextById } from "@/lib/look-contexts";
import {
  lookOccasionIsTailored,
  workDefaultShirtColor,
} from "@/lib/look-occasion-fit";

export const MAX_COMPLETE_LOOK_ANCHORS = 3;

/** Drop empty / non-string ids so the complete-look route typechecks as string[]. */
export function parseCompleteLookProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];
}

export type CompleteLookSlot =
  | "shirt"
  | "knit"
  | "trousers"
  | "footwear"
  | "outerwear"
  | "belt"
  | "bag"
  | "eyewear"
  | `other:${string}`;

const KNOWN_SLOTS = new Set<CompleteLookSlot>([
  "shirt",
  "knit",
  "trousers",
  "footwear",
  "outerwear",
  "belt",
  "bag",
  "eyewear",
]);

const ACCESSORY_NOUNS = [
  "scarf",
  "scarves",
  "gloves",
  "glove",
  "mittens",
  "beanie",
  "cap",
  "hat",
  "tie",
  "socks",
  "sock",
  "cufflinks",
  "suspenders",
  "braces",
  "umbrella",
  "wallet",
  "cardholder",
  "watch",
  "watches",
] as const;

export type CompleteLookConflict = {
  slot: CompleteLookSlot;
  titles: string[];
};

function accessoryNoun(title: string): string {
  const lower = title.toLowerCase();
  for (const noun of ACCESSORY_NOUNS) {
    if (new RegExp(`\\b${noun}\\b`).test(lower)) {
      if (noun === "scarves") return "scarf";
      if (noun === "glove" || noun === "mittens") return "gloves";
      if (noun === "watches") return "watch";
      if (noun === "sock") return "socks";
      return noun;
    }
  }
  const word = lower.match(/\b[a-z]{4,}\b/)?.[0];
  return word || "piece";
}

/** One locked or filled role — two of the same known kind cannot share an outfit. */
export function completeLookSlot(
  item: Pick<ShoppingItem, "category" | "title">,
): CompleteLookSlot {
  const title = item.title.toLowerCase();
  const cat = item.category;
  if (cat === "Shirts") return "shirt";
  if (cat === "Knitwear") return "knit";
  if (cat === "Trousers") return "trousers";
  if (cat === "Footwear") return "footwear";
  if (cat === "Outerwear" || cat === "Suits") return "outerwear";
  if (cat === "Bags") return "bag";
  if (
    /\bbelt\s+bags?\b/.test(title) ||
    /\b(briefcase|messenger|tote|satchel|backpack|crossbody|duffle|weekender)\b/.test(
      title,
    ) ||
    /\bbags?\b/.test(title)
  ) {
    return "bag";
  }
  if (/\bbelts?\b/.test(title)) return "belt";
  if (
    /\b(?:sun)?glasses\b|\beyeglasses\b|\bspectacles\b|\beyewear\b/.test(title)
  ) {
    return "eyewear";
  }
  return `other:${accessoryNoun(item.title)}`;
}

export function findCompleteLookConflict(
  items: Pick<ShoppingItem, "category" | "title">[],
): CompleteLookConflict | null {
  const bySlot = new Map<CompleteLookSlot, string[]>();
  for (const item of items) {
    const slot = completeLookSlot(item);
    if (!KNOWN_SLOTS.has(slot)) continue;
    const titles = bySlot.get(slot) ?? [];
    titles.push(item.title);
    bySlot.set(slot, titles);
  }
  for (const [slot, titles] of bySlot) {
    if (titles.length > 1) return { slot, titles };
  }
  return null;
}

const LAYER_OCCASIONS = new Set([
  "work",
  "formal",
  "dinner",
  "business_social",
  "cultural",
  "wedding_guest",
  "travel",
]);

const BAG_OCCASIONS = new Set([
  "work",
  "formal",
  "business_social",
  "travel",
]);

function hasSlot(
  items: Pick<ShoppingItem, "category" | "title">[],
  slot: CompleteLookSlot,
): boolean {
  return items.some((item) => completeLookSlot(item) === slot);
}

type ColorHintItem = Pick<
  ShoppingItem,
  "category" | "title" | "colorName" | "color"
>;

function leatherColorHint(items: ColorHintItem[]): string | null {
  const shoe = items.find((i) => completeLookSlot(i) === "footwear");
  const belt = items.find((i) => completeLookSlot(i) === "belt");
  const bag = items.find((i) => completeLookSlot(i) === "bag");
  const named =
    shoe?.colorName?.trim() ||
    belt?.colorName?.trim() ||
    bag?.colorName?.trim() ||
    "";
  return named || null;
}

function trouserAnchor(items: ColorHintItem[]): ColorHintItem | undefined {
  return items.find((i) => completeLookSlot(i) === "trousers");
}

/**
 * Empty outfit slots to fill around locked anchors. Core first
 * (base / trousers / shoes), then belt, layer, bag. Shirt + knit can coexist.
 */
export function completeLookFills(
  anchors: ColorHintItem[],
  occasionId: string | null,
): LookGarment[] {
  const tailored = lookOccasionIsTailored(occasionId);
  const leather = leatherColorHint(anchors);
  const trousers = trouserAnchor(anchors);
  const trouserColor = trousers?.colorName?.trim() || null;
  const fills: LookGarment[] = [];

  const push = (
    category: string,
    garment: string,
    color: string | null,
    clause: string,
  ) => {
    fills.push({ category, garment, color, clause });
  };

  if (!hasSlot(anchors, "shirt") && !hasSlot(anchors, "knit")) {
    const shirtColor = tailored
      ? workDefaultShirtColor(trouserColor, trousers?.color)
      : null;
    const garment = tailored ? "oxford" : "shirt";
    push(
      "Shirts",
      garment,
      shirtColor,
      [shirtColor, tailored ? "tucked oxford shirt" : "shirt"].filter(Boolean).join(" "),
    );
  }

  if (!hasSlot(anchors, "trousers")) {
    const garment = tailored && occasionId === "formal" ? "trousers" : "chinos";
    push("Trousers", garment, trouserColor, garment);
  }

  if (!hasSlot(anchors, "footwear")) {
    const garment =
      occasionId === "formal"
        ? "oxfords"
        : tailored
          ? "leather shoes"
          : "loafers";
    push(
      "Footwear",
      garment,
      leather,
      [leather, tailored ? "leather dress shoes" : "loafers"]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (!hasSlot(anchors, "belt")) {
    push(
      "Accessories",
      "belt",
      leather,
      [leather, "leather belt"].filter(Boolean).join(" "),
    );
  }

  if (!hasSlot(anchors, "outerwear") && LAYER_OCCASIONS.has(occasionId ?? "")) {
    const garment = tailored ? "blazer" : "jacket";
    push("Outerwear", garment, null, tailored ? "tailored blazer" : "jacket");
  }

  if (!hasSlot(anchors, "bag") && BAG_OCCASIONS.has(occasionId ?? "")) {
    const garment = tailored ? "briefcase" : "tote";
    push(
      "Accessories",
      garment,
      leather,
      [leather, garment].filter(Boolean).join(" "),
    );
  }

  return fills.slice(0, Math.max(0, 6 - anchors.length));
}

/** Caption from the pieces actually in the shop — not the planned fill clauses. */
export function composeCompleteLookDescription(items: ShoppingItem[]): string {
  return orderCompleteLookItems(items)
    .map((item) => {
      const color = item.colorName?.trim();
      const noun = shortNoun(item);
      return color ? `${color} ${noun}` : noun;
    })
    .join(", ");
}

function shortNoun(item: Pick<ShoppingItem, "category" | "title">): string {
  const slot = completeLookSlot(item);
  const title = item.title.toLowerCase();
  if (slot === "shirt") return /\boxford\b/.test(title) ? "oxford shirt" : "shirt";
  if (slot === "knit") return "knit";
  if (slot === "trousers") return /\bchino/.test(title) ? "chinos" : "trousers";
  if (slot === "footwear") {
    if (/\bloafer/.test(title)) return "loafers";
    if (/\bboot/.test(title)) return "boots";
    return "shoes";
  }
  if (slot === "outerwear") return /\bblazer/.test(title) ? "blazer" : "jacket";
  if (slot === "belt") return "belt";
  if (slot === "bag") {
    if (/\bbriefcase/.test(title)) return "briefcase";
    if (/\btote/.test(title)) return "tote";
    return "bag";
  }
  return item.title;
}

export function composeCompleteLookTitle(
  occasionId: string | null,
  anchors: Pick<ShoppingItem, "title">[],
): string {
  const occasion = lookContextById(occasionId ?? "")?.label ?? "Look";
  if (!anchors.length) return occasion;
  return `${occasion} · completed`;
}

const SLOT_ORDER: CompleteLookSlot[] = [
  "outerwear",
  "shirt",
  "knit",
  "trousers",
  "belt",
  "footwear",
  "bag",
  "eyewear",
];

export function orderCompleteLookItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    const sa = completeLookSlot(a);
    const sb = completeLookSlot(b);
    const ia = SLOT_ORDER.indexOf(sa);
    const ib = SLOT_ORDER.indexOf(sb);
    const ra = ia === -1 ? 80 : ia;
    const rb = ib === -1 ? 80 : ib;
    return ra - rb;
  });
}

/** After rematch / leather clash, put locked SKUs back and drop slot clones. */
export function restoreLockedAnchors(
  locked: ShoppingItem[],
  next: ShoppingItem[],
): ShoppingItem[] {
  const lockedIds = new Set(
    locked.map((i) => i.productId).filter((id): id is string => Boolean(id)),
  );
  const lockedSlots = new Set(locked.map((i) => completeLookSlot(i)));
  const rest = next.filter((item) => {
    if (item.productId && lockedIds.has(item.productId)) return false;
    if (lockedSlots.has(completeLookSlot(item))) return false;
    return true;
  });
  return orderCompleteLookItems([...locked, ...rest]).slice(0, 6);
}

/** A match that only echoed the locked picks must not be served from cache. */
export function completeLookHasFills(
  items: { length: number },
  lockedProductIds: { length: number },
): boolean {
  return items.length > lockedProductIds.length;
}

export function completeLookPalette(items: ShoppingItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const hex = item.color?.trim();
    if (!hex || hex === "#CCCCCC" || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= 5) break;
  }
  return out;
}
