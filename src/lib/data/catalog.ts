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
import { catalogGenderAllowed } from "@/lib/catalog-gender";
import { lookStyleQueryHint } from "@/lib/look-style-fit";
import {
  isDressFootwearTitle,
  isSuedeFootwearTitle,
  isWorkDressShirtTitle,
  lookOccasionAppliesToBag,
  lookOccasionAppliesToBelt,
  lookOccasionAppliesToGarment,
  lookOccasionAppliesToShirt,
  lookOccasionAppliesToShoe,
  lookOccasionIsTailored,
  lookOccasionQueryHint,
  prefersSuedeFootwear,
  prefersLeatherFootwear,
  isLeatherUpperFootwear,
  isRainUtilityFootwearTitle,
  clauseAsksLinen,
  workDefaultShirtColor,
  prefersChinoTrousers,
  prefersWoolTrousers,
  isNonDressShirtTitle,
  isNonButtonShirtTitle,
  isWorkFashionShirtTitle,
} from "@/lib/look-occasion-fit";
import { lookOccasionIdFromContext } from "@/lib/look-contexts";
import {
  CASUAL_FOOTWEAR_RE,
  colorFamilyNeedles,
  colorFamilies,
  leatherToneFamily,
  lookColorCue,
  lookAsksTeal,
  HOUSEHOLD_TEXTILE_RE,
  selectLookGarmentSlots,
  resolveLookGarments,
  paletteColorHints,
  styleFitScore,
  styleIntentPhrase,
  isShortsTitle,
  hitsAvoidPalette,
  isWarmYellowNearFace,
  isWarmCreamNearFace,
  isNearFaceShoppingCategory,
  isUnreliableColorBlockKnit,
  bestPaletteFitScore,
  colorMatchScore,
  pickShoppingRolePair,
  wantsPolishedFootwear,
  wantsOutdoorJeans,
  isCasualSummerShirtTitle,
  isJeanTitle,
  isSunglassesTitle,
  isDarkAnchorPiece,
  isDrawstringTitle,
  isLoaferTitle,
  CASUAL_OUTERWEAR_RE,
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
import { LOOK_MATCH_VERSION, LOOK_RERANK_VERSION } from "@/lib/look-match-version";
import {
  completeLookFills,
  composeCompleteLookDescription,
  composeCompleteLookTitle,
  completeLookPalette,
  restoreLockedAnchors,
} from "@/lib/complete-look";
import {
  LIGHT_CUE_RE,
  hasChromaticCue,
  hasSameChromaticFamily,
  hasStrongColorHit,
  isOfficeWorkRow,
  isTrendForward,
  pickBestMatch,
  rankMatchRows,
  rowColorText,
  tagFitScore,
  topRankedCandidates,
  type LookMatchRow,
  type RankedLookMatch,
} from "@/lib/look-match-rank";
import { attachLookItemAlts } from "@/lib/look-item-alts";
import { capsuleWardrobeSlots } from "@/lib/capsule-wardrobe";

export { attrFitScore } from "./catalog-attrfit";
export {
  LOOK_MATCH_VERSION,
  LOOK_RERANK_VERSION,
  lookItemsNeedRefresh,
} from "@/lib/look-match-version";

const CATEGORIES = [
  "Outerwear",
  "Knitwear",
  "Shirts",
  "Trousers",
  "Footwear",
  "Accessories",
];

type MatchRow = LookMatchRow;
type RankedMatch = RankedLookMatch;

const HEX_RE = /^#?[0-9a-f]{6}$/i;

/**
 * Short-sleeve pieces mis-filed under "Knitwear" (e.g. a "Short Sleeve
 * Sweatshirt") read as a t-shirt when layered over a long-sleeve shirt — the
 * cuffs poke out awkwardly. A layering knit needs long sleeves, so the knit slot
 * drops these unless nothing else matches.
 */
export const SHORT_SLEEVE_KNIT_RE =
  /\b(short[- ]?sleeve|sleeveless|t-?shirts?|tees?|tank|vest\s*tops?)\b/i;

/** Roll-neck / turtleneck — worn instead of a shirt, never with one. */
export const TURTLENECK_KNIT_RE =
  /\b(turtlenecks?|turtle\s*necks?|roll[- ]?necks?|rollnecks?|polo\s*necks?)\b/i;

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
function shoppableRows(
  rows: MatchRow[],
  genderFilter?: string | null,
): MatchRow[] {
  return rows.filter(
    (r) =>
      isUsableDeeplink(r.deeplink) &&
      catalogGenderAllowed(r.gender, genderFilter),
  );
}

// Pull a wider candidate pool so colour re-ranking can pick the right shade
// (e.g. a sky-blue shirt for "soft slate blue") even when it isn't the single
// closest vector hit.
const LOOK_MATCH_COUNT = 14;
/** Wider pool for Shop a Look so tailored-blazer + shade filters still leave alts. */
const INSPIRATION_MATCH_COUNT = 28;
/** Floor so a same-family colour pull can beat a high-sim beige neighbour. */
const COLOR_SUPPLEMENT_SIMILARITY = 0.58;
const COLOR_SUPPLEMENT_LIMIT = 10;

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

const PRODUCT_MATCH_COLS =
  "id,source,brand,title,description,color,color_hex,price_eur,deeplink,image_url,gender,formality,trend_level,versatility,garment_subtype,material_family,fit,pattern,season";

/** RPC match rows omit description; Work shirt filters need the copy. */
async function hydrateProductDescriptions(
  rows: MatchRow[],
): Promise<MatchRow[]> {
  const missing = [
    ...new Set(rows.filter((r) => !r.description).map((r) => r.id)),
  ];
  if (!missing.length || !hasSupabaseAdmin) return rows;
  const { data, error } = await createAdminSupabase()
    .from("products")
    .select("id, description")
    .in("id", missing);
  if (error || !data?.length) return rows;
  const byId = new Map(
    data.map((r) => [r.id as string, (r.description as string | null) ?? null]),
  );
  return rows.map((r) =>
    r.description ? r : { ...r, description: byId.get(r.id) ?? null },
  );
}

async function dropCasualWorkShirts(
  garments: LookGarment[],
  matchByKey: Map<string, MatchRow[]>,
  matchKeyFor: (g: LookGarment) => string,
  occasionId?: string | null,
  gender?: string | null,
): Promise<void> {
  if (!lookOccasionIsTailored(occasionId)) return;
  const workGarments = garments.filter((g) =>
    lookOccasionAppliesToGarment(occasionId, g.garment),
  );
  if (!workGarments.length) return;
  const seen = new Set<string>();
  const toHydrate: MatchRow[] = [];
  for (const g of workGarments) {
    for (const row of matchByKey.get(matchKeyFor(g)) ?? []) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      toHydrate.push(row);
    }
  }
  const hydrated = await hydrateProductDescriptions(toHydrate);
  const byId = new Map(hydrated.map((r) => [r.id, r]));
  for (const g of workGarments) {
    const key = matchKeyFor(g);
    const pool = (matchByKey.get(key) ?? []).map((r) => byId.get(r.id) ?? r);
    const office = pool.filter((r) => {
      const title = formatCatalogProductTitle(r.brand, r.title);
      return isOfficeWorkRow(g.garment, title, g.clause, r);
    });
    let next = office.length ? office : pool;
    // Teal / sage work shirts are often relaxed linen. Prefer hue over the
    // office-fit veto when the only office survivors are cream / white.
    if (lookOccasionAppliesToShirt(g.garment)) {
      const cue = lookColorCue(g.color, g.clause);
      if (hasChromaticCue(cue) && !hasStrongColorHit(next, cue)) {
        const colorHits = pool.filter((r) => {
          const title = formatCatalogProductTitle(r.brand, r.title);
          if (isNonDressShirtTitle(title, r.garment_subtype)) return false;
          if (isWorkFashionShirtTitle(title, r.material_family)) return false;
          return hasSameChromaticFamily(cue, r);
        });
        if (colorHits.length) {
          const seen = new Set(colorHits.map((r) => r.id));
          next = [...colorHits, ...next.filter((r) => !seen.has(r.id))];
        }
      }
    }
    matchByKey.set(key, next);
  }
  await supplementWorkLookRows(workGarments, matchByKey, matchKeyFor, gender);
}

async function supplementWorkLookRows(
  garments: LookGarment[],
  matchByKey: Map<string, MatchRow[]>,
  matchKeyFor: (g: LookGarment) => string,
  gender?: string | null,
): Promise<void> {
  if (!hasSupabaseAdmin) return;
  const sb = createAdminSupabase();
  for (const g of garments) {
    const key = matchKeyFor(g);
    const pool = matchByKey.get(key) ?? [];
    const extra: MatchRow[] = [];
    const cue = lookColorCue(g.color, g.clause);
    if (
      lookOccasionAppliesToGarment("work", g.garment) &&
      !lookOccasionAppliesToShirt(g.garment) &&
      !lookOccasionAppliesToBag(g.garment) &&
      !lookOccasionAppliesToBelt(g.garment) &&
      !lookOccasionAppliesToShoe(g.garment) &&
      colorFamilies(cue ?? "").has("brown")
    ) {
      const hasBrown = pool.some((r) => {
        const fams = colorFamilies(`${r.color ?? ""} ${r.title}`);
        return fams.has("brown") && !fams.has("black");
      });
      if (!hasBrown) {
        const { data } = await sb
          .from("products")
          .select(PRODUCT_MATCH_COLS)
          .eq("category", "Trousers")
          .or("hidden.eq.false,hidden.is.null")
          .or("in_stock.eq.true,in_stock.is.null")
          .or(
            "color.ilike.%brown%,color.ilike.%coffee%,color.ilike.%chocolate%,color.ilike.%camel%,color.ilike.%taupe%,title.ilike.%brown%,title.ilike.%coffee%,title.ilike.%camel%",
          )
          .limit(16);
          extra.push(...((data as MatchRow[]) ?? []));
      }
    }
    if (
      prefersChinoTrousers(g.garment, g.clause) &&
      !prefersWoolTrousers(g.clause)
    ) {
      const lightAsk = LIGHT_CUE_RE.test(cue ?? "");
      let q = sb
        .from("products")
        .select(PRODUCT_MATCH_COLS)
        .eq("category", "Trousers")
        .or("hidden.eq.false,hidden.is.null")
        .or("in_stock.eq.true,in_stock.is.null")
        .ilike("title", "%chino%")
        .not("title", "ilike", "%short%")
        .not("title", "ilike", "%bermuda%")
        .limit(20);
      if (lightAsk) {
        q = q.or(
          "color.ilike.%beige%,color.ilike.%buff%,color.ilike.%ecru%,color.ilike.%stone%,color.ilike.%sand%,color.ilike.%oatmeal%,color.ilike.%khaki%,color.ilike.%putty%,color.ilike.%oyster%,color.ilike.%cream%,color.ilike.%tan%",
        );
      }
      const { data, error } = await q;
      if (error) {
        console.warn("[look-match] chino supplement failed", error.message);
      }
      extra.push(...((data as MatchRow[]) ?? []));
    }
    if (
      lookOccasionAppliesToBag(g.garment) &&
      /\bmessenger\b/.test(`${g.garment} ${g.clause}`)
    ) {
      const hasMessenger = pool.some((r) => {
        const title = formatCatalogProductTitle(r.brand, r.title);
        return (
          /\b(messenger|satchel|briefcase)\b/i.test(title) &&
          !/\bcrossbod/i.test(title)
        );
      });
      if (!hasMessenger) {
        const { data } = await sb
          .from("products")
          .select(PRODUCT_MATCH_COLS)
          .eq("category", "Accessories")
          .or("hidden.eq.false,hidden.is.null")
          .or("in_stock.eq.true,in_stock.is.null")
          .or(
            "title.ilike.%messenger%,title.ilike.%satchel%,title.ilike.%briefcase%",
          )
          .limit(12);
        extra.push(...((data as MatchRow[]) ?? []));
      }
    }
    if (lookOccasionAppliesToShirt(g.garment)) {
      const tealAsk = lookAsksTeal(cue);
      const greenAsk = colorFamilies(cue ?? "").has("green") && !tealAsk;
      if (tealAsk) {
        const tealShirtQuery = () => {
          let q = sb
            .from("products")
            .select(PRODUCT_MATCH_COLS)
            .eq("category", "Shirts")
            .or("hidden.eq.false,hidden.is.null")
            .or("in_stock.eq.true,in_stock.is.null")
            .not("title", "ilike", "%t-shirt%")
            .not("title", "ilike", "%tee%")
            .not("title", "ilike", "%polo%")
            .not("title", "ilike", "%henley%")
            .not("title", "ilike", "%relaxed%");
          if (clauseAsksLinen(g.clause)) {
            q = q.ilike("title", "%linen%");
          }
          return q;
        };
        const { data: officeTeal } = await tealShirtQuery()
          .or(
            "color.ilike.%teal%,color.ilike.%light blue%,color.ilike.%sky%,color.ilike.%chambray%,color.ilike.%pale blue%",
          )
          .or("title.ilike.%regular%,title.ilike.%slim%")
          .not("title", "ilike", "%stand%")
          .limit(16);
        extra.push(...((officeTeal as MatchRow[]) ?? []));
        const { data: coolTeal } = await tealShirtQuery()
          .or(
            "color.ilike.%teal%,color.ilike.%light blue%,color.ilike.%sky%,color.ilike.%chambray%,color.ilike.%pale%,color.ilike.%powder%,color.ilike.%grey%,color.ilike.%gray%",
          )
          .limit(24);
        extra.push(...((coolTeal as MatchRow[]) ?? []));
      }
      if (greenAsk) {
          let q = sb
            .from("products")
            .select(PRODUCT_MATCH_COLS)
            .eq("category", "Shirts")
            .or("hidden.eq.false,hidden.is.null")
            .or("in_stock.eq.true,in_stock.is.null")
            .or(
              "color.ilike.%teal%,color.ilike.%sage%,color.ilike.%green%,color.ilike.%olive%",
            )
            .not("title", "ilike", "%t-shirt%")
            .not("title", "ilike", "%tee%")
            .not("title", "ilike", "%polo%")
            .not("title", "ilike", "%henley%")
            .limit(24);
          if (clauseAsksLinen(g.clause)) {
            q = q.ilike("title", "%linen%");
          }
          const { data } = await q;
          extra.push(...((data as MatchRow[]) ?? []));
      }
      const lightNeutralAsk =
        LIGHT_CUE_RE.test(cue ?? "") &&
        (colorFamilies(cue ?? "").has("brown") ||
          colorFamilies(cue ?? "").has("white"));
      if (lightNeutralAsk) {
        const { data } = await sb
          .from("products")
          .select(PRODUCT_MATCH_COLS)
          .eq("category", "Shirts")
          .or("hidden.eq.false,hidden.is.null")
          .or("in_stock.eq.true,in_stock.is.null")
          .or("title.ilike.%oxford%,title.ilike.%poplin%")
          .or(
            "color.ilike.%beige%,color.ilike.%cream%,color.ilike.%oatmeal%,color.ilike.%ecru%,color.ilike.%ivory%,color.ilike.%sand%",
          )
          .not("title", "ilike", "%t-shirt%")
          .not("title", "ilike", "%polo%")
          .not("title", "ilike", "%henley%")
          .limit(16);
        extra.push(...((data as MatchRow[]) ?? []));
      }
      const hasDress = pool.some((r) =>
        isWorkDressShirtTitle(
          formatCatalogProductTitle(r.brand, r.title),
          r.garment_subtype,
        ),
      );
      if (!hasDress) {
        const { data } = await sb
          .from("products")
          .select(PRODUCT_MATCH_COLS)
          .eq("category", "Shirts")
          .or("hidden.eq.false,hidden.is.null")
          .or("in_stock.eq.true,in_stock.is.null")
          .or(
            "title.ilike.%oxford%,title.ilike.%poplin%,title.ilike.%twill%,title.ilike.%non iron%",
          )
          .limit(16);
        extra.push(...((data as MatchRow[]) ?? []));
      }
    }
    if (lookOccasionAppliesToShoe(g.garment) && prefersSuedeFootwear(g.clause)) {
      const hasDressSuede = pool.some((r) => {
        const title = formatCatalogProductTitle(r.brand, r.title);
        return (
          isSuedeFootwearTitle(title, r.material_family) &&
          isDressFootwearTitle(title, r.garment_subtype, r.material_family)
        );
      });
      if (!hasDressSuede) {
        const { data, error } = await sb
          .from("products")
          .select(PRODUCT_MATCH_COLS)
          .eq("category", "Footwear")
          .or("hidden.eq.false,hidden.is.null")
          .or("in_stock.eq.true,in_stock.is.null")
          .or(
            "and(title.ilike.%suede%,title.ilike.%oxford%),and(title.ilike.%suede%,title.ilike.%derb%)",
          )
          .limit(16);
        if (error) {
          console.warn("[look-match] suede shoe supplement failed", error.message);
        }
        extra.push(...((data as MatchRow[]) ?? []));
      }
    }
    if (
      lookOccasionAppliesToShoe(g.garment) &&
      prefersLeatherFootwear(g.clause) &&
      /\b(boots?|chelsea|chukka)\b/i.test(`${g.garment} ${g.clause}`)
    ) {
      const hasLeatherBoot = pool.some((r) => {
        const title = formatCatalogProductTitle(r.brand, r.title);
        return isLeatherUpperFootwear(title, r.material_family);
      });
      if (!hasLeatherBoot) {
        const { data, error } = await sb
          .from("products")
          .select(PRODUCT_MATCH_COLS)
          .eq("category", "Footwear")
          .or("hidden.eq.false,hidden.is.null")
          .or("in_stock.eq.true,in_stock.is.null")
          .or(
            "title.ilike.%leather boot%,title.ilike.%leather chelsea%,title.ilike.%suede boot%,title.ilike.%chelsea boot%",
          )
          .limit(16);
        if (error) {
          console.warn("[look-match] leather boot supplement failed", error.message);
        }
        extra.push(
          ...((data as MatchRow[]) ?? []).filter((r) => {
            const title = formatCatalogProductTitle(r.brand, r.title);
            return !isRainUtilityFootwearTitle(title);
          }),
        );
      }
    }
    if (!extra.length) continue;
    const seen = new Set(pool.map((r) => r.id));
    const merged = [...pool];
    for (const raw of extra) {
      if (seen.has(raw.id)) continue;
      if (!catalogGenderAllowed(raw.gender, gender ?? null)) continue;
      const title = formatCatalogProductTitle(raw.brand, raw.title);
      const officeOk = isOfficeWorkRow(g.garment, title, g.clause, raw);
      const colorRescue =
        lookOccasionAppliesToShirt(g.garment) &&
        hasChromaticCue(cue) &&
        !isNonDressShirtTitle(title, raw.garment_subtype) &&
        !isWorkFashionShirtTitle(title, raw.material_family) &&
        hasSameChromaticFamily(cue, raw);
      if (!officeOk && !colorRescue) continue;
      seen.add(raw.id);
      merged.push({ ...raw, similarity: COLOR_SUPPLEMENT_SIMILARITY });
    }
    if (
      lookOccasionAppliesToShoe(g.garment) &&
      prefersSuedeFootwear(g.clause)
    ) {
      const dressSuede = merged.filter((r) => {
        const title = formatCatalogProductTitle(r.brand, r.title);
        return (
          isSuedeFootwearTitle(title, r.material_family) &&
          isDressFootwearTitle(title, r.garment_subtype, r.material_family)
        );
      });
      if (dressSuede.length) {
        matchByKey.set(key, dressSuede);
        continue;
      }
    }
    if (merged.length) matchByKey.set(key, merged);
  }
}

/**
 * Vector search often returns merino/roll-neck neighbours in beige while a
 * same-hue pink knit never enters the 14-row pool. Pull those in by colour
 * word so rank/rerank can actually see them.
 */
async function supplementColorFamilyRows(
  sb: ReturnType<typeof createAdminSupabase>,
  opts: {
    category: string;
    color: string | null;
    maxPrice: number;
    gender: string | null;
  },
  existingIds: Set<string>,
): Promise<MatchRow[]> {
  const needles = colorFamilyNeedles(opts.color)
    .filter((n) => /^[a-z]{3,14}$/.test(n))
    .slice(0, 8);
  if (!needles.length) return [];

  const or = needles
    .map((n) => `color.ilike.%${n}%,title.ilike.%${n}%`)
    .join(",");

  const { data, error } = await sb
    .from("products")
    .select(PRODUCT_MATCH_COLS)
    .eq("category", opts.category)
    .or("hidden.eq.false,hidden.is.null")
    .or("in_stock.eq.true,in_stock.is.null")
    .or(or)
    .limit(COLOR_SUPPLEMENT_LIMIT * 3);
  if (error || !data) return [];

  const extra: MatchRow[] = [];
  for (const raw of data as MatchRow[]) {
    if (existingIds.has(raw.id)) continue;
    if (!catalogGenderAllowed(raw.gender, opts.gender)) continue;
    const price = raw.price_eur != null ? Number(raw.price_eur) : null;
    if (opts.maxPrice && price != null && price > opts.maxPrice) continue;
    const title = formatCatalogProductTitle(raw.brand, raw.title);
    if (
      opts.category === "Shirts" &&
      isNonDressShirtTitle(title, raw.garment_subtype)
    ) {
      continue;
    }
    extra.push({ ...raw, similarity: COLOR_SUPPLEMENT_SIMILARITY });
    if (extra.length >= COLOR_SUPPLEMENT_LIMIT) break;
  }
  return extra;
}

async function loadMatchPool(
  sb: ReturnType<typeof createAdminSupabase>,
  args: MatchProductsArgs & { color?: string | null },
): Promise<MatchRow[]> {
  const rows = await rpcMatchProducts(sb, args);
  const extra = await supplementColorFamilyRows(
    sb,
    {
      category: args.filter_category,
      color: args.color ?? null,
      maxPrice: args.max_price,
      gender: args.gender_filter ?? null,
    },
    new Set(rows.map((r) => r.id)),
  );
  return shoppableRows([...rows, ...extra], args.gender_filter);
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
 * Shop the capsule the way looks are shopped: colour + role first, then
 * one catalogue row per slot. Category-nearest-neighbour is the fallback.
 */
async function matchShoppingByRecipe(
  profile: StyleProfile,
  content: ReportContent,
): Promise<ShoppingItem[]> {
  const best = (content.colors.best ?? []).filter((c) => c.hex);
  if (!best.length) return [];
  const avoid = content.colors.avoid ?? [];
  const polished = wantsPolishedFootwear(profile);
  const outdoorJeans = wantsOutdoorJeans(profile);
  const recipe = capsuleWardrobeSlots(best, avoid, {
    outdoorJeans,
    polished,
    cool: profile.physical.undertone === "cool",
  });
  if (!recipe.length) return [];

  const sb = createAdminSupabase();
  const market = marketForCurrency(profile.currency);
  const country = profile.demographics.country;
  const currency = profile.currency;
  const gender = genderFilterFor(profile.demographics.genderPresentation);
  const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
  const avoidText = avoid.map((c) => c.name).filter(Boolean).join(", ");
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  for (const slot of recipe) {
    const query =
      `${slot.query} ${profile.colorSeason} palette.` +
      (avoidText ? ` Never ${avoidText}.` : "");
    const { embedding } = await embed({ model: env.embedModel, value: query });
    const pool = await loadMatchPool(sb, {
      query_embedding: embedding,
      match_count: 12,
      filter_category: slot.category,
      max_price: profile.budgetEur.max,
      country,
      currency,
      market,
      gender_filter: gender,
      color: slot.color.name,
    });
    let ranked = pool
      .map((p) => {
        const title = formatCatalogProductTitle(p.brand, p.title);
        const hex = swatchHex(p);
        const hay = `${title} ${p.color ?? ""}`;
        return {
          p,
          title,
          hex,
          hay,
          score:
            (p.similarity ?? 0) +
            styleFitScore(title, profile.boldness) +
            tagFitScore(p, profile.boldness) +
            colorMatchScore(slot.color.name, hex, title) * 0.4,
        };
      })
      .filter((r) => {
        if (hitsAvoidPalette(r.hay, r.hex, avoid)) return false;
        if (
          isNearFaceShoppingCategory(slot.category) &&
          (isWarmYellowNearFace(r.hay, r.hex) ||
            (profile.physical.undertone === "cool" &&
              slot.role === "shirt" &&
              isWarmCreamNearFace(r.hay, r.hex)))
        ) {
          return false;
        }
        if (slot.category === "Knitwear" && isUnreliableColorBlockKnit(r.title)) {
          return false;
        }
        if (slot.category === "Knitwear" && SHORT_SLEEVE_KNIT_RE.test(r.title)) {
          return false;
        }
        if (slot.category === "Shirts" && isCasualSummerShirtTitle(r.title)) {
          return false;
        }
        if (
          slot.role === "shirt" &&
          /\b(polo|pale\s+green|light\s+green)\b/i.test(r.hay)
        ) {
          return false;
        }
        if (slot.role === "darkTrouser") {
          if (isShortsTitle(r.title) || isDrawstringTitle(r.title)) return false;
          if (!isDarkAnchorPiece(r.title, new Map([[r.title, r.hex]]))) {
            return false;
          }
        }
        if (slot.role === "casualTrouser") {
          if (isShortsTitle(r.title)) return false;
          if (outdoorJeans && !isJeanTitle(r.title)) return false;
        }
        if (
          (slot.role === "dressShoe" || slot.role === "loafer") &&
          /\b(green|olive|yellow|apricot|lime)\b/i.test(r.hay) &&
          /\b(navy|charcoal|grey|gray)\b/i.test(slot.color.name)
        ) {
          return false;
        }
        if (
          (slot.role === "dressShoe" || slot.role === "loafer") &&
          profile.physical.undertone === "cool" &&
          /\b(brown|cognac|tan|camel|tobacco|chocolate)\b/i.test(r.title) &&
          !/\b(grey|gray|navy|charcoal|black|blue)\b/i.test(r.title)
        ) {
          return false;
        }
        if (slot.role === "jacket" && CASUAL_OUTERWEAR_RE.test(r.title)) {
          return false;
        }
        if (slot.role === "casualOuter" && !CASUAL_OUTERWEAR_RE.test(r.title)) {
          return false;
        }
        if (slot.role === "dressShoe") {
          if (
            CASUAL_FOOTWEAR_RE.test(r.title) ||
            SNEAKER_RE_LOCAL.test(r.title) ||
            isLoaferTitle(r.title)
          ) {
            return false;
          }
          if (
            !/\b(derb(?:y|ies)|oxfords?|brogues?|monk\s+straps?|cap-?toe|wholecuts?)\b/i.test(
              r.title,
            ) ||
            /\bshirt\b/i.test(r.title)
          ) {
            return false;
          }
        }
        if (slot.role === "loafer" && !/\bloafers?\b/i.test(r.title)) return false;
        if (slot.role === "sneaker" && !/\b(sneakers?|trainers?)\b/i.test(r.title)) {
          return false;
        }
        if (slot.role === "belt" && !/\bbelts?\b/i.test(r.title)) return false;
        if (
          slot.role === "bag" &&
          !/\b(briefcase|messenger|bag)\b/i.test(r.title)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score);

    const pick = ranked.find((r) => {
      const titleKey = r.title.toLowerCase().replace(/\s+/g, " ").trim();
      return !seen.has(r.p.id) && !seen.has(titleKey);
    });
    if (!pick) continue;
    const titleKey = pick.title.toLowerCase().replace(/\s+/g, " ").trim();
    seen.add(pick.p.id);
    seen.add(titleKey);
    items.push({
      category: slot.category,
      title: pick.title,
      why: shoppingReason(slot.category, items.filter((i) => i.category === slot.category).length, profile, goal),
      priceEur: Number(pick.p.price_eur ?? 0),
      priceNative:
        pick.p.price_native != null ? Number(pick.p.price_native) : undefined,
      currency: pick.p.currency ?? undefined,
      retailer: pick.p.brand ?? pick.p.source ?? "",
      url: pick.p.deeplink ?? "#",
      color: pick.hex,
      ...(pick.p.color?.trim() ? { colorName: pick.p.color.trim() } : {}),
      image: pick.p.image_url ?? undefined,
      productId: pick.p.id,
    });
  }

  return items.length ? await applyShoppingReasons(items, profile) : [];
}

const SNEAKER_RE_LOCAL = /\b(sneakers?|trainers?|plimsolls?|runners?)\b/i;

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
    const recipeItems = await matchShoppingByRecipe(profile, content);
    if (recipeItems.length >= 6) {
      return recipeItems;
    }
    const sb = createAdminSupabase();
    const palette = content.colors.best.map((c) => c.name).join(", ");
    const avoid = content.colors.avoid ?? [];
    const avoidText = avoid.map((c) => c.name).filter(Boolean).join(", ");
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
      const polishedFeet = wantsPolishedFootwear(profile);
      const footwearBias = isFootwear
        ? polishedFeet
          ? " One pair of leather derbies or oxfords, one pair of loafers, and one pair of clean leather sneakers — three different silhouettes, not two of the same shoe, not sandals, clogs, slides or flip-flops."
          : !isTrendForward(profile.boldness)
            ? " Leather dress shoes: derbies, oxfords, loafers, monk straps or chelsea boots — not sandals, clogs, slides or flip-flops."
            : ""
        : "";
      // Steer the "Shirts" pool toward proper button-down shirts — the category
      // is dominated by tees/polos, which otherwise win the vector match and end
      // up under blazers in the capsule.
      const polishedShirt = wantsPolishedFootwear(profile);
      const outdoorJeans = wantsOutdoorJeans(profile);
      const shirtBias =
        category === "Shirts"
          ? polishedShirt
            ? " Long-sleeve oxford or poplin button-down shirts — not short-sleeve, not V-neck, not camp collar, not t-shirts, tees, tank tops or polos."
            : " Button-down collared shirts: oxford, poplin, linen or flannel shirts — not t-shirts, tees, tank tops, polos or sweatshirts."
          : "";
      // Knitwear is a layering piece (worn over a shirt or on its own), so it
      // must be long-sleeve — steer away from short-sleeve sweatshirts/tees.
      const knitBias =
        category === "Knitwear"
          ? ` Long-sleeve knitwear: a plain merino crewneck or fine-gauge roll-neck in ${palette} — jumpers, sweaters, crewnecks, roll-necks or cardigans. Not short-sleeve sweatshirts, t-shirts, tank tops, sleeveless knits or geometric colour-block knits.`
          : "";
      // Trousers under a blazer must be full-length — shorts in this category
      // otherwise win the summer vector and get worn as chopped dress trousers.
      const trousersBias =
        category === "Trousers"
          ? outdoorJeans
            ? " One pair of jeans or denim and one pair of full-length tailored trousers — not two linens, not shorts."
            : " Full-length tailored trousers, wool trousers or chinos — not shorts, bermudas or cropped shorts."
          : "";
      const accessoryBias =
        category === "Accessories"
          ? polishedFeet
            ? " A leather belt that matches dress shoes and a slim briefcase or messenger bag — not sunglasses, not novelty scarves."
            : " A leather belt or a quiet tie — not two pairs of sunglasses."
          : "";
      const query =
        `${category} in ${palette}; ${profile.colorSeason} palette; ` +
        `${profile.goals.join(", ")}; ${profile.physical.bodyType} build; ` +
        styleIntentPhrase(profile.boldness) +
        footwearBias +
        shirtBias +
        knitBias +
        trousersBias +
        accessoryBias +
        (avoidText ? ` Never ${avoidText}.` : "");
      const { embedding } = await embed({ model: env.embedModel, value: query });
      const pool = await loadMatchPool(sb, {
        query_embedding: embedding,
        // Wider pool so archetype re-ranking (and the footwear hard-filter) has
        // room to demote trend/casual pieces; footwear needs extra headroom.
        match_count: isFootwear
          ? 24
          : category === "Knitwear"
            ? 20
            : category === "Trousers" && outdoorJeans
              ? 16
              : 8,
        filter_category: category,
        max_price: profile.budgetEur.max,
        country,
        currency,
        market,
        gender_filter: gender,
      });
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
            priceBias(r.p) +
            (category === "Knitwear"
              ? bestPaletteFitScore(swatchHex(r.p), r.title, content.colors.best) *
                0.2
              : 0) +
            (category === "Trousers" && outdoorJeans && isJeanTitle(r.title)
              ? 0.18
              : 0),
        }))
        .sort((a, b) => b.score - a.score);

      // Polished/professional wardrobes should never be handed casual
      // warm-weather footwear (sandals, clogs, slides) as a recommended piece —
      // a soft penalty isn't enough, so hard-drop them unless nothing else fits.
      if (
        category === "Footwear" &&
        (!isTrendForward(profile.boldness) || polishedFeet)
      ) {
        const dress = ranked.filter((r) => !CASUAL_FOOTWEAR_RE.test(r.title));
        if (dress.length) ranked = dress;
      }

      // "Shirts" holds tees/polos too; hard-drop them so the buying plan (and the
      // capsule looks built from it) get a real button-down shirt to wear under a
      // blazer. Falls back to the full pool only if no true shirt was matched.
      if (category === "Shirts") {
        const buttonShirts = ranked.filter(
          (r) => !isNonButtonShirtTitle(r.title, r.p.garment_subtype),
        );
        if (buttonShirts.length) ranked = buttonShirts;
        if (polishedShirt) {
          const longSleeve = ranked.filter(
            (r) => !isCasualSummerShirtTitle(r.title),
          );
          if (longSleeve.length) ranked = longSleeve;
        }
      }

      // A layering knit must be long-sleeve — hard-drop short-sleeve sweatshirts
      // / tees that slipped into Knitwear (they render as a tee over the shirt).
      // Falls back to the full pool only if no long-sleeve knit was matched.
      ranked = ranked.filter((r) => !HOUSEHOLD_TEXTILE_RE.test(r.title));
      if (category === "Knitwear") {
        const longSleeve = ranked.filter(
          (r) => !SHORT_SLEEVE_KNIT_RE.test(r.title),
        );
        if (longSleeve.length) ranked = longSleeve;
      }

      // Prefer full-length trousers whenever the pool has any — shorts may stay
      // as a fallback only if nothing else matched (capsule matrix still keeps
      // them off jackets).
      if (category === "Accessories" && polishedFeet) {
        const finishing = ranked.filter((r) => !isSunglassesTitle(r.title));
        if (finishing.length) ranked = finishing;
      }
      if (category === "Trousers") {
        const fullLength = ranked.filter((r) => !isShortsTitle(r.title));
        if (fullLength.length) ranked = fullLength;
        if (outdoorJeans) {
          const withJeans = ranked.filter((r) => isJeanTitle(r.title));
          const tailored = ranked.filter((r) => !isJeanTitle(r.title));
          if (withJeans.length && tailored.length) {
            ranked = [withJeans[0]!, ...tailored, ...withJeans.slice(1)];
          }
        }
      }

      // Never put an avoid-palette colour on a report, especially a knit or
      // shirt next to the face. Near-face slots skip rather than fall back.
      const onPalette = ranked.filter((r) => {
        const hex = swatchHex(r.p);
        const colorHay = `${r.title} ${r.p.color ?? ""}`;
        if (hitsAvoidPalette(colorHay, hex, avoid)) return false;
        if (
          isNearFaceShoppingCategory(category) &&
          isWarmYellowNearFace(colorHay, hex)
        ) {
          return false;
        }
        if (category === "Knitwear" && isUnreliableColorBlockKnit(r.title)) {
          return false;
        }
        return true;
      });
      if (onPalette.length) ranked = onPalette;
      else if (isNearFaceShoppingCategory(category)) ranked = [];

      // Outdoors briefs need a real jeans role. The mixed trousers query
      // often returns linen/chinos only — fetch jeans on their own.
      if (
        category === "Trousers" &&
        outdoorJeans &&
        !ranked.some((r) => isJeanTitle(r.title))
      ) {
        const jeanQuery =
          `Men's jeans or five-pocket denim jeans in ${palette}; straight or regular fit jeans — not cargos, not chinos, not shorts, not linen trousers.`;
        const { embedding: jeanEmb } = await embed({
          model: env.embedModel,
          value: jeanQuery,
        });
        const jeanPool = await loadMatchPool(sb, {
          query_embedding: jeanEmb,
          match_count: 12,
          filter_category: "Trousers",
          max_price: profile.budgetEur.max,
          country,
          currency,
          market,
          gender_filter: gender,
        });
        const jeans = jeanPool
          .map((p) => ({
            p,
            title: formatCatalogProductTitle(p.brand, p.title),
            score: (p.similarity ?? 0) + 0.25,
          }))
          .filter(
            (r) =>
              isJeanTitle(r.title) &&
              !hitsAvoidPalette(
                `${r.title} ${r.p.color ?? ""}`,
                swatchHex(r.p),
                avoid,
              ),
          );
        const classic = jeans.filter(
          (r) => !/\b(ripped|distressed|skinny)\b/i.test(r.title),
        );
        const picked = (classic.length ? classic : jeans).slice(0, 2);
        if (picked.length) ranked = [...picked, ...ranked];
      }

      // A capsule needs one dark trouser. After dropping olive / yellow-green
      // the pool can collapse to two sage drawstrings — then dinner is a suit.
      if (category === "Trousers") {
        const darkMap = new Map(
          ranked.map((r) => [r.title, swatchHex(r.p)] as const),
        );
        const hasDark = ranked.some((r) =>
          isDarkAnchorPiece(r.title, darkMap),
        );
        if (!hasDark) {
          const darkQuery =
            `Men's navy or charcoal tailored trousers, wool trousers or dark chinos — full-length, not drawstring, not shorts, not olive, not sage, not yellow.`;
          const { embedding: darkEmb } = await embed({
            model: env.embedModel,
            value: darkQuery,
          });
          const darkPool = await loadMatchPool(sb, {
            query_embedding: darkEmb,
            match_count: 12,
            filter_category: "Trousers",
            max_price: profile.budgetEur.max,
            country,
            currency,
            market,
            gender_filter: gender,
          });
          const darks = darkPool
            .map((p) => ({
              p,
              title: formatCatalogProductTitle(p.brand, p.title),
              score: (p.similarity ?? 0) + 0.3,
            }))
            .filter((r) => {
              const hex = swatchHex(r.p);
              const hay = `${r.title} ${r.p.color ?? ""}`;
              if (hitsAvoidPalette(hay, hex, avoid)) return false;
              return isDarkAnchorPiece(
                r.title,
                new Map([[r.title, hex]]),
              );
            });
          if (darks[0]) ranked = [darks[0], ...ranked];
        }
      }

      // A report should never surface two pairs of sandals: cap open/casual
      // footwear to a single pair whenever a closed, versatile silhouette also
      // exists in the pool — even for bold wardrobes.
      const footwearHasClosed =
        isFootwear && ranked.some((r) => !CASUAL_FOOTWEAR_RE.test(r.title));

      const rolePicks = pickShoppingRolePair(
        category,
        ranked.map((r) => ({
          title: r.title,
          color: swatchHex(r.p),
          priceEur: Number(r.p.price_eur ?? 0),
        })),
        {
          polishedFootwear: polishedFeet,
          polishedShirt,
          outdoorJeans,
        },
      );
      const roleRanked = rolePicks
        .map((pick) => ranked.find((r) => r.title === pick.title))
        .filter((r): r is (typeof ranked)[number] => Boolean(r));
      const toAdd = roleRanked.length ? roleRanked : ranked;

      let added = 0;
      let casualShoes = 0;
      for (const { p, title } of toAdd) {
        if (added >= (isFootwear ? 3 : 2)) break;
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
          ...(p.color?.trim() ? { colorName: p.color.trim() } : {}),
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
  styleId?: string | null;
  occasionId?: string | null;
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
    lookStyleQueryHint(opts.styleId),
    lookOccasionQueryHint(opts.occasionId, garment, opts.clause),
    `${opts.colorSeason} personal style`,
  ]
    .filter(Boolean)
    .join(". ");
}

type GarmentMatchSlot = {
  slot: number;
  garment: LookGarment;
  matchKey: string;
  rows: MatchRow[];
};

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
    subtype: row.garment_subtype ?? null,
    material: row.material_family ?? null,
    fit: row.fit ?? null,
    pattern: row.pattern ?? null,
  };
}

/** Chromatic hues that read as a uniform when shirt and trousers share them.
 *  Neutrals (grey/brown/black/white) and navy-on-navy (blue) are allowed. */
const CHROMATIC_CLASH_FAMILIES = new Set([
  "green",
  "red",
  "orange",
  "yellow",
  "pink",
  "purple",
]);

function itemColorText(item: {
  colorName?: string;
  title: string;
}): string {
  return `${item.colorName ?? ""} ${item.title}`;
}

function sharedChromaticFamily(aText: string, bText: string): string | null {
  const a = colorFamilies(aText);
  const b = colorFamilies(bText);
  for (const fam of a) {
    if (CHROMATIC_CLASH_FAMILIES.has(fam) && b.has(fam)) return fam;
  }
  return null;
}

function lookAskedForFamilyOnBoth(
  shirt: LookGarment,
  trousers: LookGarment,
  family: string,
): boolean {
  const shirtAsked = colorFamilies(`${shirt.color ?? ""} ${shirt.clause}`);
  const trousersAsked = colorFamilies(
    `${trousers.color ?? ""} ${trousers.clause}`,
  );
  return shirtAsked.has(family) && trousersAsked.has(family);
}

/**
 * Sage shirt + olive trousers (both `green`) looks like a uniform. Re-pick the
 * trousers from the ranked pool unless the look itself named that family on
 * both pieces. Keep the original pair only when every alternative also clashes.
 */
function isLockedProduct(
  productId: string | undefined,
  lockedIds?: Set<string>,
): boolean {
  return Boolean(productId && lockedIds?.has(productId));
}

function resolveShirtTrouserClash(
  items: ShoppingItem[],
  matchSlots: GarmentMatchSlot[],
  matchByKey: Map<string, MatchRow[]>,
  profile: StyleProfile,
  goal: string,
  styleId?: string | null,
  occasionId?: string | null,
  lockedIds?: Set<string>,
): ShoppingItem[] {
  const shirtIdx = items.findIndex((i) => i.category === "Shirts");
  const trouserIdx = items.findIndex((i) => i.category === "Trousers");
  if (shirtIdx < 0 || trouserIdx < 0) return items;

  const shirt = items[shirtIdx];
  const trousers = items[trouserIdx];
  const clash = sharedChromaticFamily(
    itemColorText(shirt),
    itemColorText(trousers),
  );
  if (!clash) return items;

  const shirtSlot = matchSlots.find((s) => s.garment.category === "Shirts");
  const trouserSlot = matchSlots.find((s) => s.garment.category === "Trousers");
  if (shirtSlot && trouserSlot && lookAskedForFamilyOnBoth(shirtSlot.garment, trouserSlot.garment, clash)) {
    return items;
  }

  const rematchSlot = (
    idx: number,
    slot: GarmentMatchSlot,
    keepText: string,
    currentId?: string,
  ): ShoppingItem[] | null => {
    const usedIds = new Set(
      items
        .map((i) => i.productId)
        .filter((id): id is string => Boolean(id) && id !== currentId),
    );
    const alt = rankMatchRows(
      matchByKey.get(slot.matchKey) ?? [],
      slot.garment.color,
      slot.garment.garment,
      profile.boldness,
      slot.garment.clause,
      styleId,
      occasionId,
    )
      .sort((a, b) => b.score - a.score)
      .find((r) => {
        if (usedIds.has(r.row.id)) return false;
        if (r.garmentScore < 0.5 && r.colorScore < 0.45) return false;
        return !sharedChromaticFamily(keepText, rowColorText(r.row));
      });
    if (!alt) return null;
    const next = [...items];
    next[idx] = shoppingItemFromMatch(
      alt.row,
      slot.garment,
      profile,
      goal,
      alt.similarPick,
    );
    return next;
  };

  const trousersLocked = isLockedProduct(trousers.productId, lockedIds);
  const shirtLocked = isLockedProduct(shirt.productId, lockedIds);

  if (!trousersLocked && trouserSlot) {
    return rematchSlot(trouserIdx, trouserSlot, itemColorText(shirt), trousers.productId) ?? items;
  }
  if (!shirtLocked && shirtSlot) {
    return rematchSlot(shirtIdx, shirtSlot, itemColorText(trousers), shirt.productId) ?? items;
  }
  return items;
}

function isLeatherHarmonyItem(item: ShoppingItem): boolean {
  if (item.category === "Footwear") return true;
  if (item.category !== "Accessories") return false;
  return /\b(belts?|bags?|messenger|briefcase|satchel|tote|crossbod)/i.test(
    item.title,
  );
}

function resolveLeatherToneClash(
  items: ShoppingItem[],
  matchSlots: GarmentMatchSlot[],
  matchByKey: Map<string, MatchRow[]>,
  profile: StyleProfile,
  goal: string,
  styleId?: string | null,
  occasionId?: string | null,
  lockedIds?: Set<string>,
): ShoppingItem[] {
  const trouserIdx = items.findIndex((i) => i.category === "Trousers");
  if (trouserIdx < 0) return items;
  const trouserSlot = matchSlots.find((s) => s.garment.category === "Trousers");

  const next = [...items];
  const usedIds = () =>
    new Set(next.map((i) => i.productId).filter((id): id is string => Boolean(id)));

  const pickTone = (
    slot: GarmentMatchSlot,
    want: "black" | "brown",
    skipId?: string,
  ): RankedMatch | undefined => {
    const skip = usedIds();
    if (skipId) skip.delete(skipId);
    return rankMatchRows(
      matchByKey.get(slot.matchKey) ?? [],
      slot.garment.color,
      slot.garment.garment,
      profile.boldness,
      slot.garment.clause,
      styleId,
      occasionId,
    )
      .sort((a, b) => b.score - a.score)
      .find((r) => {
        if (skip.has(r.row.id)) return false;
        if (r.garmentScore < 0.5 && r.colorScore < 0.45) return false;
        return leatherToneFamily(rowColorText(r.row)) === want;
      });
  };

  const trousersLocked = isLockedProduct(next[trouserIdx]?.productId, lockedIds);
  if (
    trouserSlot &&
    !trousersLocked
  ) {
    const askedTrouser = colorFamilies(
      `${trouserSlot.garment.color ?? ""} ${trouserSlot.garment.clause}`,
    );
    if (
      askedTrouser.has("brown") &&
      leatherToneFamily(itemColorText(next[trouserIdx]!)) === "black"
    ) {
      const alt = pickTone(trouserSlot, "brown", next[trouserIdx]!.productId);
      if (alt) {
        next[trouserIdx] = shoppingItemFromMatch(
          alt.row,
          trouserSlot.garment,
          profile,
          goal,
          alt.similarPick,
        );
      }
    }
  }

  const tTone = leatherToneFamily(itemColorText(next[trouserIdx]!));
  if (!tTone) return next;

  for (let i = 0; i < next.length; i++) {
    const item = next[i]!;
    if (i === trouserIdx || !isLeatherHarmonyItem(item)) continue;
    if (isLockedProduct(item.productId, lockedIds)) continue;
    const iTone = leatherToneFamily(itemColorText(item));
    if (!iTone || iTone === tTone) continue;
    const slot = matchSlots.find((s) =>
      s.rows.some((r) => r.id === item.productId),
    );
    if (!slot) continue;
    const alt = pickTone(slot, tTone, item.productId);
    if (!alt) continue;
    next[i] = shoppingItemFromMatch(
      alt.row,
      slot.garment,
      profile,
      goal,
      alt.similarPick,
    );
  }
  return next;
}

/** Load shop rows by product id so try-on can dress the SKUs the user ticked. */
export async function loadShoppingItemsByIds(
  ids: string[],
): Promise<ShoppingItem[]> {
  if (!ids.length || !hasSupabaseAdmin) return [];
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("products")
    .select(`category,${PRODUCT_MATCH_COLS}`)
    .in("id", unique);
  if (error) {
    console.warn("[look-tryon] loadShoppingItemsByIds", error.message);
    return [];
  }
  const byId = new Map(
    ((data ?? []) as Array<MatchRow & { category?: string | null }>).map(
      (row) => [row.id, row],
    ),
  );
  const out: ShoppingItem[] = [];
  for (const id of unique) {
    const row = byId.get(id);
    if (!row) continue;
    out.push({
      category: row.category?.trim() || "Accessories",
      title: formatCatalogProductTitle(row.brand, row.title),
      why: "",
      priceEur: Number(row.price_eur ?? 0),
      retailer: row.brand ?? row.source ?? "",
      url: row.deeplink ?? "#",
      color: swatchHex(row),
      ...(row.color?.trim() ? { colorName: row.color.trim() } : {}),
      image: row.image_url ?? undefined,
      productId: row.id,
    });
  }
  return out;
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
    rerankVersion: LOOK_RERANK_VERSION,
  };
}

function withLookItemAlternatives(
  items: ShoppingItem[],
  matchSlots: GarmentMatchSlot[],
  profile: StyleProfile,
  goal: string,
): ShoppingItem[] {
  const used = new Set(
    items.map((i) => i.productId).filter((id): id is string => Boolean(id)),
  );
  return items.map((item) => {
    const slot =
      matchSlots.find(
        (s) =>
          s.garment.category === item.category &&
          s.rows.some((r) => r.id === item.productId),
      ) ?? matchSlots.find((s) => s.garment.category === item.category);
    if (!slot) return item;
    const pool = slot.rows.map((row) =>
      shoppingItemFromMatch(row, slot.garment, profile, goal, true),
    );
    return attachLookItemAlts(item, pool, used);
  });
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
  styleId?: string | null,
  occasionId?: string | null,
): Promise<ShoppingItem[]> {
  const matchSlots: GarmentMatchSlot[] = [];
  let slot = 0;
  await dropCasualWorkShirts(
    garments,
    matchByKey,
    matchKeyFor,
    occasionId,
    genderFilterFor(profile.demographics.genderPresentation),
  );

  for (const g of selectLookGarmentSlots(garments, 6)) {
    const matchKey = matchKeyFor(g);
    // Knitwear is a layering piece — drop short-sleeve knits/sweatshirts so a
    // short-sleeve knit never gets layered over a long-sleeve shirt (mirrors
    // matchShopping). Falls back to the full pool if that would empty it.
    {
      const pool = matchByKey.get(matchKey) ?? [];
      const apparel = pool.filter((r) => !HOUSEHOLD_TEXTILE_RE.test(r.title));
      if (apparel.length && apparel.length !== pool.length) {
        matchByKey.set(matchKey, apparel);
      }
    }
    if (g.category === "Knitwear") {
      const pool = matchByKey.get(matchKey) ?? [];
      const longSleeve = pool.filter((r) => !SHORT_SLEEVE_KNIT_RE.test(r.title));
      if (longSleeve.length && longSleeve.length !== pool.length) {
        matchByKey.set(matchKey, longSleeve);
      }
    }
    const rows = topRankedCandidates(
      matchByKey.get(matchKey) ?? [],
      g.color,
      g.garment,
      profile.boldness,
      g.clause,
      styleId,
      occasionId,
    );
    if (!rows.length) continue;
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
    styleId,
    occasionId,
  );

  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  if (rerankPicks?.length) {
    const slotByIndex = new Map(matchSlots.map((s) => [s.slot, s]));
    const filled = new Set<number>();
    for (const pick of rerankPicks) {
      if (items.length >= 6) break;
      if (pick.candidateIndex < 0) continue;
      const matchSlot = slotByIndex.get(pick.slot);
      if (!matchSlot) continue;
      const row = matchSlot.rows[pick.candidateIndex];
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      filled.add(pick.slot);
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
    for (const matchSlot of matchSlots) {
      if (items.length >= 6) break;
      if (filled.has(matchSlot.slot)) continue;
      const picked = pickBestMatch(
        matchByKey.get(matchSlot.matchKey) ?? [],
        matchSlot.garment.color,
        matchSlot.garment.garment,
        profile.boldness,
        matchSlot.garment.clause,
        styleId,
        occasionId,
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
    if (items.length) {
      return withLookItemAlternatives(
        resolveLeatherToneClash(
          resolveShirtTrouserClash(
            items,
            matchSlots,
            matchByKey,
            profile,
            goal,
            styleId,
            occasionId,
          ),
          matchSlots,
          matchByKey,
          profile,
          goal,
          styleId,
          occasionId,
        ),
        matchSlots,
        profile,
        goal,
      );
    }
  }

  for (const matchSlot of matchSlots) {
    if (items.length >= 6) break;
    const picked = pickBestMatch(
      matchByKey.get(matchSlot.matchKey) ?? [],
      matchSlot.garment.color,
      matchSlot.garment.garment,
      profile.boldness,
      matchSlot.garment.clause,
      styleId,
      occasionId,
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

  return withLookItemAlternatives(
    resolveLeatherToneClash(
      resolveShirtTrouserClash(
        items,
        matchSlots,
        matchByKey,
        profile,
        goal,
        styleId,
        occasionId,
      ),
      matchSlots,
      matchByKey,
      profile,
      goal,
      styleId,
      occasionId,
    ),
    matchSlots,
    profile,
    goal,
  );
}

/** Per-look matched products, keyed by the look's index in content.looks. */
export type LookItems = Record<number, ShoppingItem[]>;

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
  opts?: { styleId?: string | null },
): Promise<LookItems> {
  if (!hasAI || !hasSupabaseAdmin) return {};

  try {
    const sb = createAdminSupabase();
    const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
    const market = marketForCurrency(profile.currency);
    const country = profile.demographics.country;
    const currency = profile.currency;
    const gender = genderFilterFor(profile.demographics.genderPresentation);
    const styleId = opts?.styleId ?? null;

    const perLook = content.looks.map((l) => {
      const paletteHints = paletteColorHints(
        l.palette ?? [],
        content.colors.best,
      );
      const description = [l.title, l.description].filter(Boolean).join(", ");
      const occasionId = lookOccasionIdFromContext(l.context);
      // Structured slots win when they cover the look; a thinner list (dropped
      // unknown noun) falls back to prose. Legacy looks have no items → same
      // decomposeLook path as before — no LOOK_MATCH_VERSION bump.
      const garments = resolveLookGarments(l.items, description);
      if (lookOccasionIsTailored(occasionId)) {
        const trousers = garments.find((g) => g.category === "Trousers");
        for (const g of garments) {
          if (!lookOccasionAppliesToShirt(g.garment)) continue;
          if (lookColorCue(g.color, g.clause)) continue;
          const shirt = workDefaultShirtColor(trousers?.color);
          g.color = shirt;
          g.clause = `${shirt} ${g.clause}`.trim();
        }
      }
      return {
        title: l.title,
        description: l.description ?? "",
        garments,
        paletteHints,
        occasionId,
      };
    });

    const keyFor = (
      category: string,
      garment: string,
      color: string | null,
      lookTitle: string,
      occasionId?: string | null,
    ) =>
      `${lookTitle}::${category}::${garment}::${color ?? ""}::${styleId ?? ""}::${occasionId ?? ""}`;

    type Query = {
      key: string;
      category: string;
      garment: string;
      color: string | null;
      text: string;
    };
    const queryByKey = new Map<string, Query>();
    for (const { title, garments, paletteHints, occasionId } of perLook) {
      for (const g of garments) {
        const text = garmentQueryText(g.garment, g.color, g.category, {
          lookTitle: title,
          clause: g.clause,
          paletteHints,
          colorSeason: profile.colorSeason,
          gender,
          styleId,
          occasionId,
        });
        const key = keyFor(g.category, g.garment, g.color, title, occasionId);
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
        const data = await loadMatchPool(sb, {
          query_embedding: embeddings[i],
          match_count: LOOK_MATCH_COUNT,
          filter_category: q.category,
          max_price: profile.budgetEur.max,
          country,
          currency,
          market,
          gender_filter: gender,
          color: q.color,
        });
        matchByKey.set(q.key, data);
      }),
    );

    const result: LookItems = {};
    const lookEntries = await Promise.all(
      perLook.map(async ({ title, description, garments, paletteHints, occasionId }, idx) => {
        const items = await matchItemsForLook(
          title,
          description,
          paletteHints,
          garments,
          matchByKey,
          (g) => keyFor(g.category, g.garment, g.color, title, occasionId),
          profile,
          goal,
          styleId,
          occasionId,
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

/**
 * Fill empty outfit slots around 1–3 locked catalogue anchors. Anchors are
 * never substituted. Additive — does not change LOOK_MATCH_VERSION.
 */
export async function matchLookAroundAnchors(
  profile: StyleProfile,
  opts: {
    anchors: ShoppingItem[];
    occasionId?: string | null;
    styleId?: string | null;
  },
): Promise<{
  items: ShoppingItem[];
  title: string;
  description: string;
  palette: string[];
}> {
  const anchors = opts.anchors;
  const occasionId = opts.occasionId ?? "smart_casual";
  const styleId = opts.styleId ?? null;
  const fills = completeLookFills(anchors, occasionId);
  const title = composeCompleteLookTitle(occasionId, anchors);
  const empty = {
    items: restoreLockedAnchors(anchors, anchors),
    title,
    description: composeCompleteLookDescription(anchors),
    palette: completeLookPalette(anchors),
  };
  if (!fills.length || !hasAI || !hasSupabaseAdmin) return empty;

  try {
    const sb = createAdminSupabase();
    const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
    const market = marketForCurrency(profile.currency);
    const country = profile.demographics.country;
    const currency = profile.currency;
    const gender = genderFilterFor(profile.demographics.genderPresentation);
    const paletteHints = paletteColorHints([], []);

    const garments = fills.map((g) => ({ ...g }));
    const description = composeCompleteLookDescription(anchors);

    const keyFor = (g: LookGarment) =>
      `${title}::${g.category}::${g.garment}::${g.color ?? ""}::${styleId ?? ""}::${occasionId}`;

    const queries = garments.map((g) => ({
      key: keyFor(g),
      category: g.category,
      garment: g.garment,
      color: g.color,
      text: garmentQueryText(g.garment, g.color, g.category, {
        lookTitle: title,
        clause: g.clause,
        paletteHints,
        colorSeason: profile.colorSeason,
        gender,
        styleId,
        occasionId,
      }),
    }));

    const { embeddings } = await embedMany({
      model: env.embedModel,
      values: queries.map((q) => q.text),
    });

    const matchByKey = new Map<string, MatchRow[]>();
    const poolConcurrency = 2;
    for (let i = 0; i < queries.length; i += poolConcurrency) {
      const batch = queries.slice(i, i + poolConcurrency);
      await Promise.all(
        batch.map(async (q, offset) => {
          const idx = i + offset;
          try {
            const data = await loadMatchPool(sb, {
              query_embedding: embeddings[idx],
              match_count: LOOK_MATCH_COUNT,
              filter_category: q.category,
              max_price: profile.budgetEur.max,
              country,
              currency,
              market,
              gender_filter: gender,
              color: q.color,
            });
            matchByKey.set(q.key, data);
          } catch (err) {
            console.error(
              "[complete-look] pool failed",
              q.category,
              q.garment,
              err,
            );
            matchByKey.set(q.key, []);
          }
        }),
      );
    }

    const lockedIds = new Set(
      anchors
        .map((a) => a.productId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    for (const [key, rows] of matchByKey) {
      matchByKey.set(
        key,
        rows.filter((r) => !lockedIds.has(r.id)),
      );
    }

    const filled = await matchItemsForLook(
      title,
      description,
      paletteHints,
      garments,
      matchByKey,
      keyFor,
      profile,
      goal,
      styleId,
      occasionId,
    );
    const matchSlots: GarmentMatchSlot[] = garments.map((g, slot) => ({
      slot,
      garment: g,
      matchKey: keyFor(g),
      rows: matchByKey.get(keyFor(g)) ?? [],
    }));
    const merged = restoreLockedAnchors(anchors, filled);
    const items = restoreLockedAnchors(
      anchors,
      resolveLeatherToneClash(
        resolveShirtTrouserClash(
          merged,
          matchSlots,
          matchByKey,
          profile,
          goal,
          styleId,
          occasionId,
          lockedIds,
        ),
        matchSlots,
        matchByKey,
        profile,
        goal,
        styleId,
        occasionId,
        lockedIds,
      ),
    );
    return {
      items,
      title,
      description: composeCompleteLookDescription(items),
      palette: completeLookPalette(items),
    };
  } catch (err) {
    console.error("[complete-look] match failed", err);
    return empty;
  }
}

function garmentFromShoppingItem(item: ShoppingItem): LookGarment {
  const title = item.title.toLowerCase();
  let garment = "piece";
  if (item.category === "Shirts") {
    garment = /\boxford\b/.test(title) ? "oxford" : "shirt";
  } else if (item.category === "Trousers") {
    garment = /\bchino/.test(title)
      ? "chinos"
      : /\bshorts?\b/.test(title)
        ? "shorts"
        : "trousers";
  } else if (item.category === "Footwear") {
    garment = /\bloafer/.test(title)
      ? "loafers"
      : /\bboot/.test(title)
        ? "boots"
        : "shoes";
  } else if (item.category === "Knitwear") {
    garment = "knit";
  } else if (item.category === "Outerwear") {
    garment = /\bblazer/.test(title) ? "blazer" : "jacket";
  } else if (/\bbelt/.test(title)) {
    garment = "belt";
  } else if (/pocket square|pochette/.test(title)) {
    garment = "pocket square";
  } else if (/\bmessenger/.test(title)) {
    garment = "messenger";
  } else if (/\bbriefcase/.test(title)) {
    garment = "briefcase";
  } else if (/\btote/.test(title)) {
    garment = "tote";
  } else {
    garment = "bag";
  }
  return {
    category: item.category,
    garment,
    color: item.colorName ?? null,
    clause: item.title,
  };
}

/**
 * Same-slot neighbours for a persisted shop chip that was stored without
 * alternatives. Heuristic only — no Sonnet.
 */
export async function findLookItemAlternatives(
  profile: StyleProfile,
  look: {
    title: string;
    description: string;
    context?: string;
    palette?: string[];
    items?: { garment: string; color?: string | null }[] | null;
  },
  item: ShoppingItem,
  opts?: { styleId?: string | null; occasionId?: string | null },
): Promise<ShoppingItem[]> {
  if (!hasAI || !hasSupabaseAdmin) return [];
  try {
    const sb = createAdminSupabase();
    const description = [look.title, look.description].filter(Boolean).join(", ");
    const occasionId =
      opts?.occasionId ?? lookOccasionIdFromContext(look.context);
    const styleId = opts?.styleId ?? null;
    const garments = resolveLookGarments(look.items, description);
    const g =
      garments.find((x) => x.category === item.category) ??
      garmentFromShoppingItem(item);
    const gender = genderFilterFor(profile.demographics.genderPresentation);
    const paletteHints = paletteColorHints(look.palette ?? [], []);
    const { embedding } = await embed({
      model: env.embedModel,
      value: garmentQueryText(g.garment, g.color, g.category, {
        lookTitle: look.title,
        clause: g.clause,
        paletteHints,
        colorSeason: profile.colorSeason,
        gender,
        styleId,
        occasionId,
      }),
    });
    const rows = await loadMatchPool(sb, {
      query_embedding: embedding,
      match_count: LOOK_MATCH_COUNT,
      filter_category: g.category,
      max_price: profile.budgetEur.max,
      country: profile.demographics.country,
      currency: profile.currency,
      market: marketForCurrency(profile.currency),
      gender_filter: gender,
      color: g.color,
    });
    const ranked = topRankedCandidates(
      rows,
      g.color,
      g.garment,
      profile.boldness,
      g.clause,
      styleId,
      occasionId,
    );
    const used = new Set(item.productId ? [item.productId] : []);
    const pool = ranked.map((row) =>
      shoppingItemFromMatch(row, g, profile, "your goals", true),
    );
    return attachLookItemAlts(item, pool, used).alternatives ?? [];
  } catch (err) {
    console.error("[look-item-alts] findLookItemAlternatives", err);
    return [];
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
 * result cache independently of LOOK_MATCH_VERSION (heuristic rematch of shop
 * lists; Sonnet rerank is skipped when top-8 ids are unchanged). v2: colour-gate alternatives. v3:
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
  /\b(cream|ivory|ecru|bone|oyster|off[-\s]?white|offwhite|natural|tan|camel|beige|sand|stone|oat|oatmeal|khaki|buff|biscuit|linen|greige|mushroom|taupe)\b/i;

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

    // One slot per clothing category; several Accessories (belt + tote + square).
    const slots = selectLookGarmentSlots(garments, INSPIRATION_MAX_SLOTS).map(
      (garment, slot) => ({ slot, garment }),
    );
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
      const rows = await loadMatchPool(sb, {
        query_embedding: embedding,
        match_count: INSPIRATION_MATCH_COUNT,
        filter_category: g.category,
        max_price: maxPrice,
        country,
        currency,
        market,
        gender_filter: gender,
        color: g.color,
      });
      return rankMatchRows(
        rows,
        g.color,
        g.garment,
        profile.boldness,
        g.clause,
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
      const ordered = preferBudget ? [...inBand, ...outBand] : [...ranked];
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
