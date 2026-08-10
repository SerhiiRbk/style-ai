import "server-only";
import { embed, embedMany } from "ai";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  formatCatalogProductTitle,
  humanizeProductTitle,
} from "@/lib/product-title";
import {
  applyShoppingReasons,
  reasonIsSafe,
  REASON_VERSION,
} from "@/lib/ai/shopping-reasons";
import { mockShopping, type ShoppingItem } from "@/lib/report";
import { marketForCurrency } from "@/lib/currency";
import {
  CASUAL_FOOTWEAR_RE,
  colorMatchScore,
  decomposeLook,
  garmentTitleMatchScore,
  isBlazerGarment,
  isTailoredBlazerTitle,
  paletteColorHints,
  styleFitScore,
  styleIntentPhrase,
  type LookGarment,
} from "@/lib/style-extras";
import {
  LOOK_RERANK_CANDIDATE_LIMIT,
  rerankLookItemSlots,
  type RerankGarmentSlot,
} from "@/lib/ai/look-item-rerank";
import type { StyleProfile, ReportContent } from "@/lib/style-profile";
import {
  BUDGET_ANY_MAX,
  isPriceInBudget,
  type BudgetPreference,
} from "@/lib/budgets";

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
  color_hex?: string | null;
  formality?: number | null;
  trend_level?: number | null;
  versatility?: number | null;
  price_eur: number | null;
  price_native?: number | null;
  currency?: string | null;
  deeplink: string | null;
  image_url: string | null;
  offer_country?: string | null;
  same_country?: boolean | null;
  similarity?: number;
};

const HEX_RE = /^#?[0-9a-f]{6}$/i;

/**
 * Non-button-down tops that live inside the catalogue's "Shirts" category (tees,
 * tanks, polos, sweatshirts). They out-rank real shirts on the vector query for a
 * muted palette, which left blazer looks with a tee/jumper instead of a shirt —
 * so the buying plan's shirt slot filters these out when real shirts exist.
 */
const NON_BUTTON_SHIRT_RE =
  /\b(t-?shirts?|tees?|tank|vest\s*tops?|camisole|polo|henley|sweat(?:er|shirt)?|hoodie|jersey)\b/i;

/**
 * Swatch colour for a shopping item — the display uses this as a CSS colour, so
 * it must be a hex. Prefer the normalised `color_hex`, fall back to a hex that
 * happens to sit in the raw `color` field, else a neutral placeholder.
 */
function swatchHex(row: { color_hex?: string | null; color?: string | null }): string {
  const hex = row.color_hex?.trim();
  if (hex && HEX_RE.test(hex)) return hex.startsWith("#") ? hex : `#${hex}`;
  const raw = row.color?.trim();
  if (raw && HEX_RE.test(raw)) return raw.startsWith("#") ? raw : `#${raw}`;
  return "#CCCCCC";
}

/** Placeholder / non-shoppable deeplink hosts that must never reach a report. */
const PLACEHOLDER_DEEPLINK =
  /(?:^|\/\/|\.)(?:example\.(?:com|org|net)|localhost|test\.example|placeholder)/i;

/** A deeplink is shoppable only if it's a real, absolute http(s) URL to a live host. */
function isUsableDeeplink(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  if (!u || u === "#") return false;
  if (!/^https?:\/\//i.test(u)) return false;
  return !PLACEHOLDER_DEEPLINK.test(u);
}

/** Drop catalogue rows we can't actually link to (fake/sample deeplinks). */
function shoppableRows(rows: MatchRow[]): MatchRow[] {
  return rows.filter((r) => isUsableDeeplink(r.deeplink));
}

/** Trend-forward wardrobes (statement/experimental) tolerate directional/casual pieces. */
function isTrendForward(boldness: string): boolean {
  const b = (boldness || "moderate").toLowerCase();
  return b === "statement" || b === "experimental";
}

/**
 * Ranking nudge from a product's ingest-time style tags (formality / trend /
 * versatility). Unlike `styleFitScore` (which reads the title), this works for
 * items with weak lexical signals because the tags are computed from category +
 * colour + title at ingest. Small magnitudes — refines, never overrides
 * similarity. No-op when a row has no tags (legacy rows before backfill).
 */
function tagFitScore(row: MatchRow, boldness: string): number {
  const trend = row.trend_level;
  const vers = row.versatility;
  const formality = row.formality;
  if (trend == null && vers == null && formality == null) return 0;

  const b = (boldness || "moderate").toLowerCase();
  const bold = isTrendForward(b);
  const conservative = b === "conservative";
  let s = 0;

  if (trend != null) {
    if (bold) {
      // Directional wardrobes welcome mild trend, but a "3" reads gimmicky.
      s += trend >= 3 ? -0.05 : trend >= 1 ? 0.03 : 0;
    } else {
      s -= (conservative ? 0.06 : 0.03) * trend;
    }
  }
  // Versatile pieces are safer building blocks — valued most by polished profiles.
  if (vers != null) s += (conservative ? 0.03 : 0.02) * vers;
  // Polished wardrobes lean dressier; nudge formality around the mid-point.
  if (formality != null && conservative) s += (formality - 3) * 0.02;

  return s;
}

const MIN_VECTOR_SIMILARITY = 0.68;
const MIN_COLOR_MATCH = 0.4;
const MIN_LOOK_PICK_SCORE = 0.42;
/** Bumped when look-matching heuristics change — triggers background refresh.
 *  v7: re-derive look_items after looks gained a stable `idx` ordering, so
 *  per-look products realign with the rendered look on legacy reports.
 *  v8: mid-grey shade scoring + tailored-blazer filter (drop knit/zip "sport blazers"). */
export const LOOK_MATCH_VERSION = 8;
// Pull a wider candidate pool so colour re-ranking can pick the right shade
// (e.g. a sky-blue shirt for "soft slate blue") even when it isn't the single
// closest vector hit.
const LOOK_MATCH_COUNT = 14;
/** Wider pool for Shop a Look so tailored-blazer + shade filters still leave alts. */
const INSPIRATION_MATCH_COUNT = 28;

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
      const isFootwear = category === "Footwear";
      // Polished profiles: steer footwear queries to dress shoes so sandals/clogs
      // don't dominate the vector pool for warm palettes.
      const footwearBias =
        isFootwear && !isTrendForward(profile.boldness)
          ? " Leather dress shoes: derbies, oxfords, loafers, monk straps or chelsea boots — not sandals, clogs, slides or flip-flops."
          : "";
      // Steer the "Shirts" pool toward proper button-down shirts — the category
      // is dominated by tees/polos, which otherwise win the vector match and end
      // up under blazers in the capsule.
      const shirtBias =
        category === "Shirts"
          ? " Button-down collared shirts: oxford, poplin, linen or flannel shirts — not t-shirts, tees, tank tops, polos or sweatshirts."
          : "";
      const query =
        `${category} in ${palette}; ${profile.colorSeason} palette; ` +
        `${profile.goals.join(", ")}; ${profile.physical.bodyType} build; ` +
        styleIntentPhrase(profile.boldness) +
        footwearBias +
        shirtBias;
      const { embedding } = await embed({ model: env.embedModel, value: query });
      const data = await rpcMatchProducts(sb, {
        query_embedding: embedding,
        // Wider pool so archetype re-ranking (and the footwear hard-filter) has
        // room to demote trend/casual pieces; footwear needs extra headroom.
        match_count: isFootwear ? 24 : 8,
        filter_category: category,
        max_price: profile.budgetEur.max,
        country,
        currency,
        market,
        gender_filter: gender,
      });
      // Re-rank by vector similarity plus how well the piece suits the user's
      // boldness, so a conservative profile isn't handed a trend-forward hero.
      const pool = shoppableRows((data ?? []) as MatchRow[]);
      // Gentle budget nudge for investment categories: when the pool has price
      // spread, edge the pricier (more investment-grade) options ahead so a
      // €1000+ budget isn't only shown €25 fast-fashion. Small magnitude — never
      // enough to override a clearly better-fitting or closer-matching piece.
      const investCategory = category === "Outerwear" || category === "Footwear";
      const poolPrices = pool.map((p) => Number(p.price_eur ?? 0));
      const poolMax = Math.max(1, ...poolPrices);
      const poolMin = Math.min(...(poolPrices.length ? poolPrices : [0]));
      const hasSpread = poolMax - poolMin > 40;
      const priceBias = (p: MatchRow) =>
        investCategory && hasSpread
          ? (Number(p.price_eur ?? 0) / poolMax) * 0.06
          : 0;
      let ranked = pool
        .map((p) => ({
          p,
          title: formatCatalogProductTitle(p.brand, p.title),
          score: 0,
        }))
        .map((r) => ({
          ...r,
          score:
            (r.p.similarity ?? 0) +
            styleFitScore(r.title, profile.boldness) +
            tagFitScore(r.p, profile.boldness) +
            priceBias(r.p),
        }))
        .sort((a, b) => b.score - a.score);

      // Polished/professional wardrobes should never be handed casual
      // warm-weather footwear (sandals, clogs, slides) as a recommended piece —
      // a soft penalty isn't enough, so hard-drop them unless nothing else fits.
      if (category === "Footwear" && !isTrendForward(profile.boldness)) {
        const dress = ranked.filter((r) => !CASUAL_FOOTWEAR_RE.test(r.title));
        if (dress.length) ranked = dress;
      }

      // "Shirts" holds tees/polos too; hard-drop them so the buying plan (and the
      // capsule looks built from it) get a real button-down shirt to wear under a
      // blazer. Falls back to the full pool only if no true shirt was matched.
      if (category === "Shirts") {
        const buttonShirts = ranked.filter(
          (r) => !NON_BUTTON_SHIRT_RE.test(r.title),
        );
        if (buttonShirts.length) ranked = buttonShirts;
      }

      // A report should never surface two pairs of sandals: cap open/casual
      // footwear to a single pair whenever a closed, versatile silhouette also
      // exists in the pool — even for bold wardrobes.
      const footwearHasClosed =
        isFootwear && ranked.some((r) => !CASUAL_FOOTWEAR_RE.test(r.title));

      let added = 0;
      let casualShoes = 0;
      for (const { p, title } of ranked) {
        if (added >= 2) break;
        // Dedup by product id AND by normalized model title, so the same model
        // in two colours can't take both slots (e.g. two "Leather Sandals").
        const titleKey = title.toLowerCase().replace(/\s+/g, " ").trim();
        if (seen.has(p.id) || seen.has(titleKey)) continue;
        if (isFootwear && footwearHasClosed && CASUAL_FOOTWEAR_RE.test(title)) {
          if (casualShoes >= 1) continue; // keep the second slot for variety
        }
        seen.add(p.id);
        seen.add(titleKey);
        if (isFootwear && CASUAL_FOOTWEAR_RE.test(title)) casualShoes++;
        added++;
        items.push({
          category,
          title: formatCatalogProductTitle(p.brand, p.title),
          why: shoppingReason(category, added - 1, profile, goal),
          priceEur: Number(p.price_eur ?? 0),
          priceNative: p.price_native != null ? Number(p.price_native) : undefined,
          currency: p.currency ?? undefined,
          retailer: p.brand ?? p.source ?? "",
          url: p.deeplink ?? "#",
          color: swatchHex(p),
          image: p.image_url ?? undefined,
          productId: p.id,
        });
      }
    }

    // One batched LLM pass rewrites the template "why" copy into item-aware
    // reasons (guarded + never throws; template copy stays on any fallback).
    return items.length ? await applyShoppingReasons(items, profile) : mockShopping();
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
  boldness: string,
): RankedMatch[] {
  const ranked = rows.map((row) => {
    const title = formatCatalogProductTitle(row.brand, row.title);
    const sim = row.similarity ?? 0;
    const colorScore = colorMatchScore(color, row.color, title);
    const garmentScore = garmentTitleMatchScore(garment, title);
    const similarPick =
      sim < MIN_VECTOR_SIMILARITY || colorScore < MIN_COLOR_MATCH;
    const localBoost = row.same_country ? 0.04 : 0;
    const styleFit = styleFitScore(title, boldness);
    const tagFit = tagFitScore(row, boldness);
    return {
      row,
      colorScore,
      garmentScore,
      similarPick,
      score:
        sim * 0.38 +
        colorScore * 0.32 +
        garmentScore * 0.26 +
        localBoost +
        styleFit +
        tagFit,
    };
  });

  // Blazer slots: hard-drop knit/zip/sport shells when a tailored blazer exists
  // in the pool (soft garmentScore alone wasn't enough against high vector hits).
  if (isBlazerGarment(garment)) {
    const tailored = ranked.filter((r) =>
      isTailoredBlazerTitle(formatCatalogProductTitle(r.row.brand, r.row.title)),
    );
    if (tailored.length) return tailored;
  }
  return ranked;
}

function pickBestMatch(
  rows: MatchRow[],
  color: string | null,
  garment: string,
  boldness: string,
): { row: MatchRow; similarPick: boolean } | null {
  if (!rows.length) return null;
  const ranked = rankMatchRows(rows, color, garment, boldness).sort(
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
  boldness: string,
): MatchRow[] {
  return rankMatchRows(rows, color, garment, boldness)
    .sort((a, b) => b.score - a.score)
    .slice(0, LOOK_RERANK_CANDIDATE_LIMIT)
    .map((r) => r.row);
}

function toRerankCandidate(row: MatchRow, category: string): RerankGarmentSlot["candidates"][number] {
  return {
    id: row.id,
    brand: row.brand,
    // Humanized so the reranker judges (and writes reasons about) readable
    // titles, not raw feed abbreviations like "CHCKD SMCK PLLVR".
    title: humanizeProductTitle(row.title),
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
  /** Optional reranker-written reason; used only when it passes the safety guard. */
  llmWhy?: string,
  outsideBudget?: boolean,
): ShoppingItem {
  const colorLabel = g.color ? `${g.color} ` : "";
  const title = formatCatalogProductTitle(row.brand, row.title);
  const safeLlmWhy =
    llmWhy && reasonIsSafe(llmWhy, { title, color: row.color })
      ? llmWhy.trim()
      : null;
  return {
    category: g.category,
    title,
    why:
      safeLlmWhy ??
      (similarPick
        ? `Similar ${colorLabel}${g.garment} from the catalogue — same category and tone as this look.`
        : `Matches this look — ${colorLabel}${g.garment} aligned with your ${profile.colorSeason} palette and goal to ${goal}.`),
    ...(safeLlmWhy ? { reasonVersion: REASON_VERSION } : {}),
    priceEur: Number(row.price_eur ?? 0),
    priceNative: row.price_native != null ? Number(row.price_native) : undefined,
    currency: row.currency ?? undefined,
    retailer: row.brand ?? row.source ?? "",
    url: row.deeplink ?? "#",
    color: swatchHex(row),
    ...(row.color?.trim() ? { colorName: row.color.trim() } : {}),
    image: row.image_url ?? undefined,
    productId: row.id,
    similarPick,
    ...(outsideBudget ? { outsideBudget: true } : {}),
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
    const rows = topRankedCandidates(
      matchByKey.get(matchKey) ?? [],
      g.color,
      g.garment,
      profile.boldness,
    );
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
          pick.why,
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
      profile.boldness,
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

/**
 * True when persisted look_items predate colour-aware ranking / the similarPick
 * flag, or still hold a raw feed title from before ingest-time humanization.
 * The raw-title check mirrors isStaleShoppingCopy (report.ts) so a snapshot with
 * humanized shopping but raw look items still self-heals via scheduleMatchRefresh.
 */
export function lookItemsNeedRefresh(items: LookItems | undefined): boolean {
  if (!items || !Object.keys(items).length) return true;
  return Object.values(items)
    .flat()
    .some(
      (i) =>
        i.similarPick === undefined ||
        i.matchVersion !== LOOK_MATCH_VERSION ||
        humanizeProductTitle(i.title) !== i.title,
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
        matchByKey.set(q.key, shoppableRows((data ?? []) as MatchRow[]));
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

/* ----------------------------- Shop a Look ------------------------------ */

/** One detected garment slot with its best catalogue candidates (best first). */
export type InspirationMatchSlot = {
  slot: number;
  category: string;
  garment: string;
  color: string | null;
  candidates: ShoppingItem[];
};

/**
 * Bumped when "Shop a Look" matching logic changes — invalidates the photo-hash
 * result cache independently of LOOK_MATCH_VERSION (which would also force a
 * background re-match of every report). v2: colour-gate alternatives. v3:
 * per-garment accessory slots (belt + sunglasses no longer collapse). v4:
 * carry the catalogue colour name on each candidate. v5: lenient category
 * mapping + vision retry. v6: sanitise noisy query colours (fixes accessories
 * dropping to zero rows) + bridge light neutrals in the alternative gate. v7:
 * detection prompt now catalogues face/neck/head-worn accessories (sunglasses,
 * necklaces, hats) reliably. v8: soft budget preference with outside-band fill.
 * v9: mid-grey shade preference + tailored-blazer filter (no knit/zip sport jackets).
 * v10: soft-fill shade-adjacent tailored alts when a strict colour gate leaves
 * fewer than INSPIRATION_CANDIDATES_PER_SLOT (avoids single-card blazer rows).
 * v11: per-piece item budget bands (not outfit-refresh totals).
 */
export const INSPIRATION_MATCH_VERSION = 11;
/** Catalogue candidates surfaced per detected garment in "Shop a Look". */
const INSPIRATION_CANDIDATES_PER_SLOT = 3;
/**
 * Max distinct garment slots matched from one photo (keeps the vision→embed→rpc
 * fan-out bounded). Sized for a full outfit plus a couple of accessories:
 * outerwear + top + shirt + trousers + footwear, and 2 accessories (e.g. belt,
 * sunglasses) — which live in one category but are distinct pieces.
 */
const INSPIRATION_MAX_SLOTS = 7;
/**
 * Minimum colour score for a preferred NON-primary "Shop a Look" alternative.
 * When the detected garment has a clear colour (e.g. cream trousers), we would
 * rather show colour-consistent options first. 0.5 keeps same-hue + unknown
 * lightness and exact/near shades; adjacent mid↔light (0.35) is soft-filled
 * only when the preferred pool is short. `colorMatchScore`: wrong hue 0.1,
 * opposite shade 0.3, adjacent mid↔light/dark 0.35, unknown shade 0.8, exact 1.
 */
const INSPIRATION_MIN_ALT_COLOR = 0.5;
/**
 * Floor for soft-filling alternatives when the preferred colour gate leaves a
 * short row. Same-hue adjacent/opposite shades (0.3–0.35) can pad; wrong-hue
 * (0.1) still stays out.
 */
const INSPIRATION_SOFT_ALT_COLOR = 0.3;

/**
 * Light neutrals that read as interchangeable to the eye (cream/ivory pair
 * happily with beige/sand/stone/tan), but which the colour taxonomy splits
 * across the "white" and "brown" families — so `colorMatchScore` scores them a
 * wrong-hue 0.1. Used to bridge that gap for alternatives only. Deliberately
 * excludes mid/dark browns (brown, chocolate, espresso, mole, taupe) so we
 * never resurface the "brown trousers for a cream look" problem.
 */
const LIGHT_NEUTRAL_RE =
  /\b(cream|ivory|ecru|bone|oyster|off[-\s]?white|offwhite|natural|tan|camel|beige|sand|stone|oat|oatmeal|khaki|buff|biscuit|linen|greige)\b/i;

function isLightNeutral(text: string | null | undefined): boolean {
  return Boolean(text) && LIGHT_NEUTRAL_RE.test(text as string);
}

/**
 * Reduce a detected colour to a clean query token. Vision sometimes returns
 * descriptive, non-wearable colour strings for accessories (e.g. "gold and dark
 * lens" for sunglasses) that pull the embedding away from the catalogue enough
 * to fall under the RPC's similarity floor — returning zero rows and silently
 * dropping the slot. Keep the primary colour word(s), cut at connectives, and
 * strip non-colour nouns.
 */
const COLOR_QUERY_SPLIT = /\s+(?:and|with|featuring|plus|over|w\/)\s+|\s*[&/,]\s*/i;
const COLOR_NOISE_WORDS = new Set([
  "lens",
  "lenses",
  "frame",
  "frames",
  "case",
  "buckle",
  "detail",
  "details",
  "accent",
  "accents",
  "hardware",
  "trim",
  "tint",
  "tinted",
  "gradient",
  "mirror",
  "mirrored",
  "polarised",
  "polarized",
]);

function sanitizeQueryColor(color: string | null): string | null {
  if (!color) return null;
  const primary = color.toLowerCase().split(COLOR_QUERY_SPLIT)[0]?.trim() ?? "";
  const words = primary
    .split(/\s+/)
    .filter((w) => w && !COLOR_NOISE_WORDS.has(w));
  const capped = words.slice(0, 2).join(" ").trim();
  return capped || null;
}

/**
 * "Shop a Look" matcher: given garments detected in an uploaded outfit photo,
 * return the closest catalogue products per garment, re-ranked for the user's
 * own profile (palette, fit, gender) and an optional soft budget preference.
 * Unlike `matchLookItems` this keeps the top
 * {@link INSPIRATION_CANDIDATES_PER_SLOT} candidates per slot so the UI can let
 * the user choose, with the reranker's pick ordered first.
 *
 * Budget preference is soft: in-band matches come first; when a slot is short,
 * we fill from outside the band and mark those candidates `outsideBudget`.
 *
 * Reuses the exact embedding + `match_product_offers` + rerank stack as the
 * report's per-look matching. Returns [] when AI/catalogue is unavailable.
 */
export async function matchInspirationItems(
  profile: StyleProfile,
  look: { title: string; description: string; palette: string[] },
  garments: LookGarment[],
  budget: BudgetPreference = { mode: "any" },
): Promise<InspirationMatchSlot[]> {
  if (!hasAI || !hasSupabaseAdmin || !garments.length) return [];

  try {
    const sb = createAdminSupabase();
    const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
    const market = marketForCurrency(profile.currency);
    const country = profile.demographics.country;
    const currency = profile.currency;
    const gender = genderFilterFor(profile.demographics.genderPresentation);
    const preferBudget = budget.mode === "range";
    const preferredMax = preferBudget ? budget.max : BUDGET_ANY_MAX;

    // One slot per category (dedupe), bounded — mirrors matchItemsForLook.
    // One slot per main clothing category (an outfit has a single top, bottom,
    // etc.), but ACCESSORIES are deduped per garment — a look legitimately has
    // several (belt, sunglasses, watch), all in the one "Accessories" category,
    // and collapsing them to a single slot drops pieces at random between runs.
    const slots: { slot: number; garment: LookGarment }[] = [];
    const usedCategories = new Set<string>();
    const usedAccessories = new Set<string>();
    for (const g of garments) {
      if (slots.length >= INSPIRATION_MAX_SLOTS) break;
      if (g.category === "Accessories") {
        const key = g.garment.trim().toLowerCase();
        if (!key || usedAccessories.has(key)) continue;
        usedAccessories.add(key);
      } else {
        if (usedCategories.has(g.category)) continue;
        usedCategories.add(g.category);
      }
      slots.push({ slot: slots.length, garment: g });
    }
    if (!slots.length) return [];

    const queries = slots.map(({ garment: g }) =>
      garmentQueryText(g.garment, sanitizeQueryColor(g.color), g.category, {
        lookTitle: look.title,
        clause: g.clause,
        paletteHints: "",
        colorSeason: profile.colorSeason,
        gender,
      }),
    );

    const { embeddings } = await embedMany({
      model: env.embedModel,
      values: queries,
    });

    type Ranked = ReturnType<typeof rankMatchRows>[number];

    async function rankForSlot(
      g: LookGarment,
      embedding: number[],
      maxPrice: number,
    ): Promise<Ranked[]> {
      const rows = await rpcMatchProducts(sb, {
        query_embedding: embedding,
        match_count: INSPIRATION_MATCH_COUNT,
        filter_category: g.category,
        max_price: maxPrice,
        country,
        currency,
        market,
        gender_filter: gender,
      });
      return rankMatchRows(
        shoppableRows(rows),
        g.color,
        g.garment,
        profile.boldness,
      ).sort((a, b) => b.score - a.score);
    }

    // Preferred-band search first; widen to any price when a slot is short.
    const rankedBySlot = await Promise.all(
      slots.map(async ({ garment: g }, i) => {
        const preferred = await rankForSlot(g, embeddings[i], preferredMax);
        if (
          !preferBudget ||
          preferred.length >= INSPIRATION_CANDIDATES_PER_SLOT
        ) {
          return preferred;
        }
        const wide = await rankForSlot(g, embeddings[i], BUDGET_ANY_MAX);
        const seen = new Set(preferred.map((r) => r.row.id));
        const merged = [...preferred];
        for (const r of wide) {
          if (seen.has(r.row.id)) continue;
          seen.add(r.row.id);
          merged.push(r);
        }
        return merged;
      }),
    );

    // One rerank pass over the whole outfit picks the best candidate per slot
    // (and writes the "why" copy), exactly like the report's look matching.
    const rerankInput: RerankGarmentSlot[] = slots
      .map(({ slot, garment: g }, i) => ({
        slot,
        category: g.category,
        garment: g.garment,
        color: g.color,
        clause: g.clause,
        candidates: rankedBySlot[i]
          .slice(0, LOOK_RERANK_CANDIDATE_LIMIT)
          .map((r) => toRerankCandidate(r.row, g.category)),
      }))
      .filter((s) => s.candidates.length > 0);

    const picks = await rerankLookItemSlots(
      look.title,
      look.description,
      "",
      rerankInput,
    );
    const pickBySlot = new Map((picks ?? []).map((p) => [p.slot, p]));

    const result: InspirationMatchSlot[] = [];
    slots.forEach(({ slot, garment: g }, i) => {
      const ranked = rankedBySlot[i];
      if (!ranked.length) return;

      // Order the reranker's pick first (when valid), then the rest by score —
      // but when a budget is set, keep in-band candidates ahead of outside-band
      // ones so the primary pick stays affordable whenever possible.
      const pick = pickBySlot.get(slot);
      const pickedRowId =
        pick && pick.candidateIndex >= 0 && pick.candidateIndex < ranked.length
          ? ranked[pick.candidateIndex].row.id
          : undefined;

      const inBand: Ranked[] = [];
      const outBand: Ranked[] = [];
      for (const r of ranked) {
        const price = Number(r.row.price_eur ?? 0);
        if (isPriceInBudget(price, budget)) inBand.push(r);
        else outBand.push(r);
      }
      let ordered = preferBudget ? [...inBand, ...outBand] : [...ranked];
      if (pickedRowId) {
        const pool = preferBudget && inBand.some((r) => r.row.id === pickedRowId)
          ? inBand
          : ordered;
        const at = ordered.findIndex((r) => r.row.id === pickedRowId);
        // Promote the reranker pick only when it stays in the preferred band
        // (or when there is no band). Otherwise keep the best in-band first.
        if (
          at > 0 &&
          (!preferBudget || pool.some((r) => r.row.id === pickedRowId))
        ) {
          ordered.unshift(ordered.splice(at, 1)[0]);
        }
      }

      // Colour-gate ALTERNATIVES when we know the target colour, so a cream
      // garment doesn't lead with brown. Soft-fill shade-adjacent same-hue
      // options (marked similarPick) when the preferred gate would leave the
      // row with only one card — better than an empty-looking blazer slot.
      // Light neutrals (cream ↔ beige/sand/stone/tan…) bridge white/brown.
      const gateColor = Boolean(g.color);
      const queryLightNeutral = isLightNeutral(g.color);
      const passesPreferredColor = (r: Ranked, idx: number): boolean => {
        if (idx === 0 || !gateColor) return true;
        if (r.colorScore >= INSPIRATION_MIN_ALT_COLOR) return true;
        return (
          queryLightNeutral &&
          isLightNeutral(`${r.row.color ?? ""} ${r.row.title}`)
        );
      };
      const preferred = ordered.filter((r, idx) => passesPreferredColor(r, idx));
      const pool: Ranked[] = [...preferred];
      if (pool.length < INSPIRATION_CANDIDATES_PER_SLOT) {
        const seenIds = new Set(pool.map((r) => r.row.id));
        for (const r of ordered) {
          if (pool.length >= INSPIRATION_CANDIDATES_PER_SLOT) break;
          if (seenIds.has(r.row.id)) continue;
          if (gateColor && r.colorScore < INSPIRATION_SOFT_ALT_COLOR) continue;
          seenIds.add(r.row.id);
          pool.push({ ...r, similarPick: true });
        }
      }

      const candidates: ShoppingItem[] = [];
      const seen = new Set<string>();
      for (const r of pool) {
        if (candidates.length >= INSPIRATION_CANDIDATES_PER_SLOT) break;
        if (seen.has(r.row.id)) continue;
        seen.add(r.row.id);
        const price = Number(r.row.price_eur ?? 0);
        const outside = preferBudget && !isPriceInBudget(price, budget);
        candidates.push(
          shoppingItemFromMatch(
            r.row,
            g,
            profile,
            goal,
            r.similarPick,
            r.row.id === pickedRowId ? pick?.why : undefined,
            outside,
          ),
        );
      }
      if (candidates.length) {
        result.push({
          slot,
          category: g.category,
          garment: g.garment,
          color: g.color,
          candidates,
        });
      }
    });

    return result;
  } catch (err) {
    console.error("[inspiration] catalogue match failed", err);
    return [];
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
