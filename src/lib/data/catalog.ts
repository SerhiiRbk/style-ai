import "server-only";
import { embed, embedMany } from "ai";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { mockShopping, type ShoppingItem } from "@/lib/report";
import { marketForCurrency } from "@/lib/currency";
import { colorMatchScore, decomposeLook } from "@/lib/style-extras";
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
  deeplink: string | null;
  image_url: string | null;
  similarity?: number;
};

const MIN_VECTOR_SIMILARITY = 0.68;
const MIN_COLOR_MATCH = 0.4;
const LOOK_MATCH_COUNT = 8;

type MatchProductsArgs = {
  query_embedding: number[];
  match_count: number;
  filter_category: string;
  max_price: number;
  market_filter: string;
  gender_filter?: string | null;
};

/** RPC wrapper — older DBs lack `gender_filter` on match_products (migration 0005). */
async function rpcMatchProducts(
  sb: ReturnType<typeof createAdminSupabase>,
  args: MatchProductsArgs,
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
        market_filter: market,
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

function garmentQueryText(
  garment: string,
  color: string | null,
  category: string,
  lookPalette?: string,
): string {
  const parts = [
    color,
    garment,
    category.toLowerCase(),
    lookPalette ? `palette ${lookPalette}` : null,
  ].filter(Boolean);
  return parts.join("; ");
}

type RankedMatch = {
  row: MatchRow;
  colorScore: number;
  similarPick: boolean;
  score: number;
};

function rankMatchRows(rows: MatchRow[], color: string | null): RankedMatch[] {
  return rows.map((row) => {
    const sim = row.similarity ?? 0;
    const colorScore = colorMatchScore(color, row.color, row.title);
    const similarPick =
      sim < MIN_VECTOR_SIMILARITY || colorScore < MIN_COLOR_MATCH;
    return {
      row,
      colorScore,
      similarPick,
      score: sim * 0.55 + colorScore * 0.45,
    };
  });
}

function pickBestMatch(
  rows: MatchRow[],
  color: string | null,
): { row: MatchRow; similarPick: boolean } | null {
  if (!rows.length) return null;
  const ranked = rankMatchRows(rows, color).sort((a, b) => b.score - a.score);
  return { row: ranked[0].row, similarPick: ranked[0].similarPick };
}

/** Per-look matched products, keyed by the look's index in content.looks. */
export type LookItems = Record<number, ShoppingItem[]>;

/** True when persisted look_items predate colour-aware ranking / similarPick flag. */
export function lookItemsNeedRefresh(items: LookItems | undefined): boolean {
  if (!items || !Object.keys(items).length) return true;
  return Object.values(items)
    .flat()
    .some((i) => i.similarPick === undefined);
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
    const gender = genderFilterFor(profile.demographics.genderPresentation);

    const perLook = content.looks.map((l) => ({
      garments: decomposeLook(l.description),
      palette: l.palette?.length
        ? l.palette.join(", ")
        : content.colors.best.map((c) => c.name).join(", "),
    }));

    const keyFor = (category: string, garment: string, color: string | null, palette: string) =>
      `${category}::${garment}::${color ?? ""}::${palette}`;

    type Query = {
      key: string;
      category: string;
      garment: string;
      color: string | null;
      text: string;
    };
    const queryByKey = new Map<string, Query>();
    for (const { garments, palette } of perLook) {
      for (const g of garments) {
        const text = garmentQueryText(g.garment, g.color, g.category, palette);
        const key = keyFor(g.category, g.garment, g.color, palette);
        if (!queryByKey.has(key))
          queryByKey.set(key, { key, category: g.category, garment: g.garment, color: g.color, text });
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
          market_filter: market,
          gender_filter: gender,
        });
        matchByKey.set(q.key, (data ?? []) as MatchRow[]);
      }),
    );

    const result: LookItems = {};
    perLook.forEach(({ garments, palette }, idx) => {
      const seen = new Set<string>();
      const usedCategories = new Set<string>();
      const items: ShoppingItem[] = [];
      for (const g of garments) {
        if (items.length >= 6) break;
        if (usedCategories.has(g.category)) continue;
        const key = keyFor(g.category, g.garment, g.color, palette);
        const picked = pickBestMatch(matchByKey.get(key) ?? [], g.color);
        if (!picked) continue;
        const p = picked.row;
        const id = p.id;
        if (seen.has(id)) continue;
        seen.add(id);
        usedCategories.add(g.category);
        const colorLabel = g.color ? `${g.color} ` : "";
        items.push({
          category: g.category,
          title: p.brand ? `${p.brand} ${p.title}` : p.title,
          why: picked.similarPick
            ? `Similar ${colorLabel}${g.garment} from the catalogue — same category and tone as this look.`
            : `Matches this look — ${colorLabel}${g.garment} aligned with your ${profile.colorSeason} palette and goal to ${goal}.`,
          priceEur: Number(p.price_eur ?? 0),
          retailer: p.brand ?? p.source ?? "",
          url: p.deeplink ?? "#",
          color: p.color ?? "#CCCCCC",
          image: p.image_url ?? undefined,
          productId: p.id,
          similarPick: picked.similarPick,
        });
      }
      if (items.length) result[idx] = items;
    });

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
