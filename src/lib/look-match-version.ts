import { humanizeProductTitle } from "@/lib/product-title";

/**
 * Bump when heuristic ranking changes (colour neighbours, office filters,
 * accessory type locks). That rematches persisted shop lists on open.
 * Sonnet is not re-paid when the top-8 candidate ids are unchanged — see
 * `rerankCacheKey` / `LOOK_RERANK_VERSION`.
 *
 *  v7: re-derive look_items after looks gained a stable `idx` ordering.
 *  v8: mid-grey shade scoring + tailored-blazer filter.
 *  v9: drop short-sleeve knits from the Knitwear slot.
 *  v10: reject shirt+trousers in the same chromatic family.
 *  v11: never substitute a different accessory type.
 *  v12: neighbour-family + hex proximity for dusty rose.
 *  v13: greige, sage, soft plum, mushroom neighbours.
 *  v14: same-hue catalogue pull; drop beige/nude when a pink hit exists.
 *  v15: named-style recipes.
 *  v16: Work / Formal trousers drop linen/relaxed/drawstring unless named.
 *  v17: messenger / tote reject travel bags.
 *  v18: navy wool trousers stay; Work drops shorts/jeans unless named.
 *  v20: knitted tie is a necktie; drop household textiles.
 *  v21: pocket square needs a jacket.
 *  v22: Work shirts drop relaxed/viscose/linen/camp unless named.
 *  v23: Work shirts read description for camp/stand-collar; leather tone lock.
 *  v24: typed subtype/material/fit/pattern; ingest columns over title.
 *  v25: named-colour slots stay empty rather than take a Similar stand-in.
 *  v26: same-family neutrals (grey for charcoal, navy for slate-blue) fill
 *       again; empty only for a different colour family (oatmeal ≠ white).
 *  v27: skip a wrong-colour top hit instead of emptying the slot; work shirts
 *       snap off charcoal; charcoal/greige leather may take dress leather.
 *  v28: walk rerank candidates after a colour miss; 8 shop slots; sport coat
 *       is not a winter coat; navy belt and greige tote may take dress leather.
 *  v29: Work / Formal drop catalogue titles with "sport" (sport coat stays).
 *  v30: overshirt and messenger slots SQL-fill on every occasion, not only Work.
 *  v31: keep named work-shirt pigments (charcoal/navy); charcoal oxfords reject
 *       light blue / light grey; fallback dark grey → navy (unless the jacket
 *       is blue) → white; drop a shop shirt that clashes with the jacket.
 */
export const LOOK_MATCH_VERSION = 31;

/**
 * Bump when the rerank prompt or candidate line format changes — that is the
 * only signal that should force a new Sonnet call for the same top-8.
 * Items written before this field existed are treated as version 1.
 */
export const LOOK_RERANK_VERSION = 1;

const LEGACY_RERANK_VERSION = 1;

export type LookRefreshItem = {
  title: string;
  similarPick?: boolean;
  matchVersion?: number;
  rerankVersion?: number;
};

/**
 * True when persisted look_items predate colour-aware ranking / the similarPick
 * flag, still hold raw feed titles, or were ranked under a stale heuristic or
 * rerank prompt version.
 */
export function lookItemsNeedRefresh(
  items: Record<string, LookRefreshItem[]> | undefined,
): boolean {
  if (!items || !Object.keys(items).length) return true;
  return Object.values(items)
    .flat()
    .some(
      (i) =>
        i.similarPick === undefined ||
        i.matchVersion !== LOOK_MATCH_VERSION ||
        (i.rerankVersion ?? LEGACY_RERANK_VERSION) !== LOOK_RERANK_VERSION ||
        humanizeProductTitle(i.title) !== i.title,
    );
}
