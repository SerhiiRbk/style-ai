import "server-only";
import { embed, embedMany } from "ai";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { mockShopping, type ShoppingItem } from "@/lib/report";
import { marketForCurrency } from "@/lib/currency";
import { decomposeLook } from "@/lib/style-extras";
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
};

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
      const { data } = await sb.rpc("match_products", {
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
          why:
            `A ${category.toLowerCase()} that fits your ${profile.colorSeason} ` +
            `palette and your goal to ${goal}.`,
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
): Promise<LookItems> {
  if (!hasAI || !hasSupabaseAdmin) return {};

  try {
    const sb = createAdminSupabase();
    const palette = content.colors.best.map((c) => c.name).join(", ");
    const goal = profile.goals[0]?.toLowerCase() ?? "your goals";
    const market = marketForCurrency(profile.currency);
    const gender = genderFilterFor(profile.demographics.genderPresentation);

    const perLook = content.looks.map((l) => decomposeLook(l.description));

    const queryText = (garment: string, color: string | null) =>
      `${color ? `${color} ` : ""}${garment}; ${palette}; ` +
      `${profile.colorSeason} palette; ${profile.physical.bodyType} build`;
    const keyFor = (category: string, text: string) => `${category}::${text}`;

    type Query = { key: string; category: string; garment: string; color: string | null; text: string };
    const queryByKey = new Map<string, Query>();
    for (const garments of perLook) {
      for (const g of garments) {
        const text = queryText(g.garment, g.color);
        const key = keyFor(g.category, text);
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

    const itemsByKey = new Map<string, ShoppingItem[]>();
    await Promise.all(
      queries.map(async (q, i) => {
        const { data } = await sb.rpc("match_products", {
          query_embedding: embeddings[i],
          match_count: 4,
          filter_category: q.category,
          max_price: profile.budgetEur.max,
          market_filter: market,
          gender_filter: gender,
        });
        const items: ShoppingItem[] = ((data ?? []) as MatchRow[]).map((p) => ({
          category: q.category,
          title: p.brand ? `${p.brand} ${p.title}` : p.title,
          why:
            `Picked for this look — a ${q.color ? `${q.color} ` : ""}${q.garment} ` +
            `that fits your ${profile.colorSeason} palette and your goal to ${goal}.`,
          priceEur: Number(p.price_eur ?? 0),
          retailer: p.brand ?? p.source ?? "",
          url: p.deeplink ?? "#",
          color: p.color ?? "#CCCCCC",
          image: p.image_url ?? undefined,
          productId: p.id,
        }));
        itemsByKey.set(q.key, items);
      }),
    );

    const result: LookItems = {};
    perLook.forEach((garments, idx) => {
      const seen = new Set<string>();
      const items: ShoppingItem[] = [];
      for (const g of garments) {
        if (items.length >= 6) break;
        const key = keyFor(g.category, queryText(g.garment, g.color));
        for (const it of itemsByKey.get(key) ?? []) {
          const id = it.productId ?? it.title;
          if (seen.has(id) || items.length >= 6) continue;
          seen.add(id);
          items.push(it);
        }
      }
      if (items.length) result[idx] = items;
    });

    return result;
  } catch {
    return {};
  }
}
