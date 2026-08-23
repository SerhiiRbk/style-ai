import type { ShoppingItem } from "@/lib/report";

/** Alternatives stored on a shop chip — enough to swap, small enough for jsonb. */
export const LOOK_ITEM_ALTERNATIVE_LIMIT = 3;

export function lookItemKey(item: {
  productId?: string;
  title: string;
}): string {
  return item.productId ?? item.title;
}

export function stripLookItemAlts(item: ShoppingItem): ShoppingItem {
  const { alternatives: _alts, ...rest } = item;
  return rest;
}

/**
 * Attach the next unused catalogue neighbours as swap options. Nested
 * alternatives are stripped so jsonb does not grow recursively.
 */
export function attachLookItemAlts(
  winner: ShoppingItem,
  pool: ShoppingItem[],
  usedIds: Set<string>,
): ShoppingItem {
  const winnerId = lookItemKey(winner);
  const alternatives = pool
    .filter((p) => {
      const id = lookItemKey(p);
      return id !== winnerId && !usedIds.has(id);
    })
    .slice(0, LOOK_ITEM_ALTERNATIVE_LIMIT)
    .map(stripLookItemAlts);
  if (!alternatives.length) {
    const { alternatives: _drop, ...rest } = winner;
    return rest;
  }
  return { ...winner, alternatives };
}

/** Promote `next` into the slot and keep the previous pick among the alts. */
export function swapLookItem(
  items: ShoppingItem[],
  fromId: string,
  next: ShoppingItem,
): ShoppingItem[] | null {
  const at = items.findIndex((i) => lookItemKey(i) === fromId);
  if (at < 0) return null;
  const current = items[at]!;
  const nextId = lookItemKey(next);
  if (nextId === fromId) return items;
  const used = new Set(
    items.filter((_, i) => i !== at).map(lookItemKey),
  );
  used.add(nextId);
  const pool = [stripLookItemAlts(current), ...(current.alternatives ?? [])];
  const promoted = attachLookItemAlts(stripLookItemAlts(next), pool, used);
  const out = [...items];
  out[at] = promoted;
  return out;
}
