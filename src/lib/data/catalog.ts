import "server-only";
import { embed, embedMany } from "ai";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { mockShopping, type ShoppingItem } from "@/lib/report";
import { marketForCurrency } from "@/lib/currency";
import { colorMatchScore, decomposeLook, garmentTitleMatchScore, paletteColorHints, type LookGarment } from "@/lib/style-extras";
import {
  LOOK_RERANK_CANDIDATE_LIMIT,
  rerankLookItemSlots,
  type RerankGarmentSlot,
} from "@/lib/ai/look-item-rerank";
import type { StyleProfile, ReportContent } from "@/lib/style-profile";

const CATEGORIES = [
  "Outerwear",
  "Knitwear",
  "Shirts",
  "Trousers",
  "Footwear",
  "Accessories",
];

type MatchRow = {
  id: string;
  source: string | null;
  brand: string | null;
  title: string;
  color: string | null;
  price_eur: number | null;
  price_native?: number | null;
  currency?: string | null;
  deeplink: string | null;
  image_url: string | null;
  offer_country?: string | null;
  same_country?: boolean | null;
  similarity?: number;
};

const MIN_VECTOR_SIMILARITY = 0.68;
const MIN_COLOR_MATCH = 0.4;
const MIN_LOOK_PICK_SCORE = 0.42;
/** Bumped when look-matching heuristics change — triggers background refresh. */
export const LOOK_MATCH_VERSION = 3;
// Pull a wider candidate pool so colour re-ranking can pick the right shade
// (e.g. a sky-blue shirt for "soft slate blue") even when it isn't the single
// closest vector hit.
const LOOK_MATCH_COUNT = 14;

type MatchProductsArgs = {
  query_embedding: number[];
  match_count: number;
  filter_category: string;
  max_price: number;
  /** Visitor country (ISO-2) — picks the best per-country offer. */
  country: string;
  /** Visitor display currency — second-priority offer fallback. */
  currency: string;
  /** Coarse EU/US market — only used by the legacy match_products fallback. */
  market: string;
  gender_filter?: string | null;
};

/** Legacy fallback for DBs predating product_offers (migration 0012/0013). */
async function legacyMatchProducts(
  sb: ReturnType<typeof createAdminSupabase>,
  args: {
    query_embedding: number[];
    match_count: number;
    filter_category: string;
    max_price: number;
    market_filter: string;
    gender_filter?: string | null;
  },
): Promise<MatchRow[]> {
  const { data, error } = await sb.rpc("match_products", args);
  if (
    error &&
    args.gender_filter != null &&
    /could not find the function|schema cache/i.test(error.message)
  ) {
    const { gender_filter: _gender, ...legacy } = args;
    void _gender;
    const retry = await sb.rpc("match_products", legacy);
    if (retry.error) throw retry.error;
    return (retry.data ?? []) as MatchRow[];
  }
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

/**
 * Offer-aware catalogue search: every product is eligible (no hard market
 * filter), the best per-country offer is selected for the visitor, and
 * same-country picks are flagged for ranking. Falls back to the older,
 * market-filtered match_products on DBs without the offer-aware RPC.
 */
async function rpcMatchProducts(
  sb: ReturnType<typeof createAdminSupabase>,
  args: MatchProductsArgs,
): Promise<MatchRow[]> {
  const { country, currency, market, ...base } = args;
  const { data, error } = await sb.rpc("match_product_offers", {
    query_embedding: base.query_embedding,
    match_count: base.match_count,
    filter_category: base.filter_category,
    max_price: base.max_price,
    gender_filter: base.gender_filter ?? null,
    p_country: (country || "Global").toUpperCase(),
    p_currency: (currency || "EUR").toUpperCase(),
  });
  if (error && /could not find the function|schema cache/i.test(error.message)) {
    return legacyMatchProducts(sb, {
      query_embedding: base.query_embedding,
      match_count: base.match_count,
      filter_category: base.filter_category,
      max_price: base.max_price,
      market_filter: market,
      gender_filter: base.gender_filter ?? null,
    });
  }
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

/**
 * Premium, category-specific reason for a shopping pick. Two variants per
 * category so the (max 2) items in a category don't read identically, and the
 * copy is grammatical and specific rather than a templated "A outerwear …".
 */
function shoppingReason(
  category: string,
  variant: number,
  profile: StyleProfile,
  goal: string,
): string {
  const season =
    profile.colorSeason.charAt(0).toUpperCase() + profile.colorSeason.slice(1);
  const body = profile.physical.bodyType;
  const v = variant % 2;
  const byCategory: Record<string, [string, string]> = {
    Outerwear: [
      `The highest-impact layer you can own — a clean shape that adds shoulder definition to your ${body} frame and grounds every outfit in your ${season} palette.`,
      `A second outer layer in muted ${season} tones — versatile enough to dress a look up or keep it relaxed, all in service of your goal to ${goal}.`,
    ],
    Knitwear: [
      `A soft mid-layer in your ${season} palette — wears under a jacket or on its own, adding texture without stark contrast.`,
      `An easy knit that layers cleanly and keeps the look modern — the quiet, considered piece behind your goal to ${goal}.`,
    ],
    Shirts: [
      `A refined base layer that sits well under knitwear and overshirts, holding the look together without competing for attention.`,
      `A clean shirt in your palette — equally at home tucked under a blazer or worn open over a tee.`,
    ],
    Trousers: [
      `Tailored through the leg to add a clean line to your ${body} build — a neutral foundation that pairs with everything above.`,
      `A versatile trouser in muted ${season} tones — modern proportions that keep the silhouette sharp, never boxy.`,
    ],
    Footwear: [
      `Warm, considered leather that ties your palette together far better than black — and outlasts cheaper pairs many times over.`,
      `A clean shoe that bridges smart and casual, finishing the look without shouting.`,
    ],
    Accessories: [
      `A quiet finishing touch in your palette — the kind of detail that reads as "polished" without effort.`,
      `One considered accent near your ${season} neutrals — small, but it lifts the whole outfit.`,
    ],
  };
  const pair = byCategory[category];
  if (pair) return pair[v];
  return `A ${season}-palette piece chosen to support your goal to ${goal}.`;
}

/** Map the profile's gender presentation onto the feed's gender vocabulary. */
function genderFilterFor(
  presentation: StyleProfile["demographics"]["genderPresentation"],
): string | null {
  if (presentation === "male") return "men";
  if (presentation === "female") return "women";
  return null; // non-binary → no hard gender filter (unisex + all still match)
}

/**
 * Semantic shopping list: for each category, embed a query built from the
 * profile + best colours and find the closest products via pgvector.
 * Falls back to the curated mock list when AI/catalogue is unavailable.
 */
export async function matchShopping(
  profile: StyleProfile,
  content: ReportContent,
): Promise<ShoppingItem[]> {
  if (!hasAI || !hasSupabaseAdmin) return mockShopping();

  try {
    const sb = createAdminSupabase();
    const palette = content.colors.best.map((c) => c.name).join(", ");
    const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
    const market = marketForCurrency(profile.currency);
    const country = profile.demographics.country;
    const currency = profile.currency;
    const gender = genderFilterFor(profile.demographics.genderPresentation);
    const items: ShoppingItem[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      const query =
        `${category} in ${palette}; ${profile.colorSeason} palette; ` +
        `${profile.goals.join(", ")}; ${profile.physical.bodyType} build`;
      const { embedding } = await embed({ model: env.embedModel, value: query });
      const data = await rpcMatchProducts(sb, {
        query_embedding: embedding,
        match_count: 3,
        filter_category: category,
        max_price: profile.budgetEur.max,
        country,
        currency,
        market,
        gender_filter: gender,
      });
      let added = 0;
      for (const p of (data ?? []) as MatchRow[]) {
        if (seen.has(p.id) || added >= 2) continue; // dedupe + cap per category
        seen.add(p.id);
        added++;
        items.push({
          category,
          title: p.brand ? `${p.brand} ${p.title}` : p.title,
          why: shoppingReason(category, added - 1, profile, goal),
          priceEur: Number(p.price_eur ?? 0),
          priceNative: p.price_native != null ? Number(p.price_native) : undefined,
          currency: p.currency ?? undefined,
          retailer: p.brand ?? p.source ?? "",
          url: p.deeplink ?? "#",
          color: p.color ?? "#CCCCCC",
          image: p.image_url ?? undefined,
          productId: p.id,
        });
      }
    }

    return items.length ? items : mockShopping();
  } catch {
    return mockShopping();
  }
}

type GarmentQueryOpts = {
  lookTitle: string;
  clause: string;
  paletteHints: string;
  colorSeason: string;
  gender: string | null;
};

/** Mirror scripts/feeds/normalize.mjs embedText so vectors align with the catalogue. */
function garmentQueryText(
  garment: string,
  color: string | null,
  category: string,
  opts: GarmentQueryOpts,
): string {
  const colorLabel =
    color ??
    (opts.paletteHints ? opts.paletteHints.split(", ")[0] ?? null : null);
  const garmentPhrase = colorLabel
    ? `${colorLabel} ${garment}`
    : garment;
  return [
    garmentPhrase,
    category,
    colorLabel,
    opts.gender,
    opts.clause,
    `Look: ${opts.lookTitle}`,
    opts.paletteHints ? `Palette: ${opts.paletteHints}` : null,
    `${opts.colorSeason} personal style`,
  ]
    .filter(Boolean)
    .join(". ");
}

type RankedMatch = {
  row: MatchRow;
  colorScore: number;
  garmentScore: number;
  similarPick: boolean;
  score: number;
};

function rankMatchRows(
  rows: MatchRow[],
  color: string | null,
  garment: string,
): RankedMatch[] {
  return rows.map((row) => {
    const sim = row.similarity ?? 0;
    const colorScore = colorMatchScore(color, row.color, row.title);
    const garmentScore = garmentTitleMatchScore(garment, row.title);
    const similarPick =
      sim < MIN_VECTOR_SIMILARITY || colorScore < MIN_COLOR_MATCH;
    const localBoost = row.same_country ? 0.04 : 0;
    return {
      row,
      colorScore,
      garmentScore,
      similarPick,
      score:
        sim * 0.38 +
        colorScore * 0.32 +
        garmentScore * 0.26 +
        localBoost,
    };
  });
}

function pickBestMatch(
  rows: MatchRow[],
  color: string | null,
  garment: string,
): { row: MatchRow; similarPick: boolean } | null {
  if (!rows.length) return null;
  const ranked = rankMatchRows(rows, color, garment).sort(
    (a, b) => b.score - a.score,
  );
  const best = ranked[0];
  if (!best || best.score < MIN_LOOK_PICK_SCORE) return null;
  if (best.garmentScore < 0.5 && best.colorScore < 0.45) return null;
  return { row: best.row, similarPick: best.similarPick };
}

type GarmentMatchSlot = {
  slot: number;
  garment: LookGarment;
  matchKey: string;
  rows: MatchRow[];
};

function topRankedCandidates(
  rows: MatchRow[],
  color: string | null,
  garment: string,
): MatchRow[] {
  return rankMatchRows(rows, color, garment)
    .sort((a, b) => b.score - a.score)
    .slice(0, LOOK_RERANK_CANDIDATE_LIMIT)
    .map((r) => r.row);
}

function toRerankCandidate(row: MatchRow, category: string): RerankGarmentSlot["candidates"][number] {
  return {
    id: row.id,
    brand: row.brand,
    title: row.title,
    color: row.color,
    priceEur: row.price_eur != null ? Number(row.price_eur) : null,
    category,
  };
}

function shoppingItemFromMatch(
  row: MatchRow,
  g: LookGarment,
  profile: StyleProfile,
  goal: string,
  similarPick: boolean,
): ShoppingItem {
  const colorLabel = g.color ? `${g.color} ` : "";
  return {
    category: g.category,
    title: row.brand ? `${row.brand} ${row.title}` : row.title,
    why: similarPick
      ? `Similar ${colorLabel}${g.garment} from the catalogue — same category and tone as this look.`
      : `Matches this look — ${colorLabel}${g.garment} aligned with your ${profile.colorSeason} palette and goal to ${goal}.`,
    priceEur: Number(row.price_eur ?? 0),
    priceNative: row.price_native != null ? Number(row.price_native) : undefined,
    currency: row.currency ?? undefined,
    retailer: row.brand ?? row.source ?? "",
    url: row.deeplink ?? "#",
    color: row.color ?? "#CCCCCC",
    image: row.image_url ?? undefined,
    productId: row.id,
    similarPick,
    matchVersion: LOOK_MATCH_VERSION,
  };
}

async function matchItemsForLook(
  lookTitle: string,
  lookDescription: string,
  paletteHints: string,
  garments: LookGarment[],
  matchByKey: Map<string, MatchRow[]>,
  matchKeyFor: (g: LookGarment) => string,
  profile: StyleProfile,
  goal: string,
): Promise<ShoppingItem[]> {
  const matchSlots: GarmentMatchSlot[] = [];
  const usedCategories = new Set<string>();
  let slot = 0;

  for (const g of garments) {
    if (matchSlots.length >= 6) break;
    if (usedCategories.has(g.category)) continue;
    const matchKey = matchKeyFor(g);
    const rows = topRankedCandidates(matchByKey.get(matchKey) ?? [], g.color, g.garment);
    if (!rows.length) continue;
    usedCategories.add(g.category);
    matchSlots.push({ slot, garment: g, matchKey, rows });
    slot += 1;
  }

  if (!matchSlots.length) return [];

  const rerankSlots: RerankGarmentSlot[] = matchSlots.map((s) => ({
    slot: s.slot,
    category: s.garment.category,
    garment: s.garment.garment,
    color: s.garment.color,
    clause: s.garment.clause,
    candidates: s.rows.map((r) => toRerankCandidate(r, s.garment.category)),
  }));

  const rerankPicks = await rerankLookItemSlots(
    lookTitle,
    lookDescription,
    paletteHints,
    rerankSlots,
  );

  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  if (rerankPicks?.length) {
    const slotByIndex = new Map(matchSlots.map((s) => [s.slot, s]));
    for (const pick of rerankPicks) {
      if (items.length >= 6) break;
      if (pick.candidateIndex < 0) continue;
      const matchSlot = slotByIndex.get(pick.slot);
      if (!matchSlot) continue;
      const row = matchSlot.rows[pick.candidateIndex];
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(
        shoppingItemFromMatch(
          row,
          matchSlot.garment,
          profile,
          goal,
          pick.similarPick,
        ),
      );
    }
    if (items.length) return items;
  }

  for (const matchSlot of matchSlots) {
    if (items.length >= 6) break;
    const picked = pickBestMatch(
      matchByKey.get(matchSlot.matchKey) ?? [],
      matchSlot.garment.color,
      matchSlot.garment.garment,
    );
    if (!picked || seen.has(picked.row.id)) continue;
    seen.add(picked.row.id);
    items.push(
      shoppingItemFromMatch(
        picked.row,
        matchSlot.garment,
        profile,
        goal,
        picked.similarPick,
      ),
    );
  }

  return items;
}

/** Per-look matched products, keyed by the look's index in content.looks. */
export type LookItems = Record<number, ShoppingItem[]>;

/** True when persisted look_items predate colour-aware ranking / similarPick flag. */
export function lookItemsNeedRefresh(items: LookItems | undefined): boolean {
  if (!items || !Object.keys(items).length) return true;
  return Object.values(items)
    .flat()
    .some(
      (i) =>
        i.similarPick === undefined ||
        i.matchVersion !== LOOK_MATCH_VERSION,
    );
}

/**
 * Per-look "Shop the Look": decompose each look into garments and run a vector
 * search per garment so each look gets products that match THAT look.
 *
 * Rate-limit safety: every unique garment query (deduped by category + colour +
 * garment + profile context) is embedded in a SINGLE embedMany batch; the
 * per-query match_products RPC results are cached and reused across looks that
 * share the same garment. Returns {} when AI/catalogue is unavailable or on any
 * error, so the caller falls back to keyword itemsForLook().
 */
export async function matchLookItems(
  profile: StyleProfile,
  content: ReportContent,
): Promise<LookItems> {
  if (!hasAI || !hasSupabaseAdmin) return {};

  try {
    const sb = createAdminSupabase();
    const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
    const market = marketForCurrency(profile.currency);
    const country = profile.demographics.country;
    const currency = profile.currency;
    const gender = genderFilterFor(profile.demographics.genderPresentation);

    const perLook = content.looks.map((l) => {
      const paletteHints = paletteColorHints(
        l.palette ?? [],
        content.colors.best,
      );
      const description = [l.title, l.description].filter(Boolean).join(", ");
      return {
        title: l.title,
        description: l.description ?? "",
        garments: decomposeLook(description),
        paletteHints,
      };
    });

    const keyFor = (
      category: string,
      garment: string,
      color: string | null,
      lookTitle: string,
    ) => `${lookTitle}::${category}::${garment}::${color ?? ""}`;

    type Query = {
      key: string;
      category: string;
      garment: string;
      color: string | null;
      text: string;
    };
    const queryByKey = new Map<string, Query>();
    for (const { title, garments, paletteHints } of perLook) {
      for (const g of garments) {
        const text = garmentQueryText(g.garment, g.color, g.category, {
          lookTitle: title,
          clause: g.clause,
          paletteHints,
          colorSeason: profile.colorSeason,
          gender,
        });
        const key = keyFor(g.category, g.garment, g.color, title);
        if (!queryByKey.has(key))
          queryByKey.set(key, {
            key,
            category: g.category,
            garment: g.garment,
            color: g.color,
            text,
          });
      }
    }
    const queries = [...queryByKey.values()];
    if (!queries.length) return {};

    const { embeddings } = await embedMany({
      model: env.embedModel,
      values: queries.map((q) => q.text),
    });

    const matchByKey = new Map<string, MatchRow[]>();
    await Promise.all(
      queries.map(async (q, i) => {
        const data = await rpcMatchProducts(sb, {
          query_embedding: embeddings[i],
          match_count: LOOK_MATCH_COUNT,
          filter_category: q.category,
          max_price: profile.budgetEur.max,
          country,
          currency,
          market,
          gender_filter: gender,
        });
        matchByKey.set(q.key, (data ?? []) as MatchRow[]);
      }),
    );

    const result: LookItems = {};
    const lookEntries = await Promise.all(
      perLook.map(async ({ title, description, garments, paletteHints }, idx) => {
        const items = await matchItemsForLook(
          title,
          description,
          paletteHints,
          garments,
          matchByKey,
          (g) => keyFor(g.category, g.garment, g.color, title),
          profile,
          goal,
        );
        return { idx, items };
      }),
    );
    for (const { idx, items } of lookEntries) {
      if (items.length) result[idx] = items;
    }

    return result;
  } catch {
    return {};
  }
}

/** Fill missing `image` from catalogue rows when `productId` is present (legacy persisted reports). */
export async function enrichShoppingImages(
  items: ShoppingItem[],
): Promise<ShoppingItem[]> {
  if (!hasSupabaseAdmin || !items.some((i) => i.productId && !i.image)) {
    return items;
  }
  const ids = [
    ...new Set(
      items.filter((i) => i.productId && !i.image).map((i) => i.productId!),
    ),
  ];
  if (!ids.length) return items;

  try {
    const sb = createAdminSupabase();
    const { data } = await sb
      .from("products")
      .select("id, image_url")
      .in("id", ids);
    const byId = new Map(
      ((data ?? []) as { id: string; image_url: string | null }[]).map((p) => [
        p.id,
        p.image_url,
      ]),
    );
    return items.map((i) => {
      if (i.image || !i.productId) return i;
      const url = byId.get(i.productId);
      return url ? { ...i, image: url } : i;
    });
  } catch {
    return items;
  }
}

/** Backfill images for all items in per-look product maps. */
export async function enrichLookItems(items: LookItems): Promise<LookItems> {
  const keys = Object.keys(items);
  if (!keys.length) return items;
  const enriched: LookItems = {};
  await Promise.all(
    keys.map(async (k) => {
      const idx = Number(k);
      enriched[idx] = await enrichShoppingImages(items[idx] ?? []);
    }),
  );
  return enriched;
}
