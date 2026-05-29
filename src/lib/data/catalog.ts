import "server-only";
import { embed } from "ai";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { mockShopping, type ShoppingItem } from "@/lib/report";
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
  title: string;
  color: string | null;
  price_eur: number | null;
  deeplink: string | null;
};

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
    const items: ShoppingItem[] = [];

    for (const category of CATEGORIES) {
      const query =
        `${category} in ${palette}; ${profile.colorSeason} palette; ` +
        `${profile.goals.join(", ")}; ${profile.physical.bodyType} build`;
      const { embedding } = await embed({ model: env.embedModel, value: query });
      const { data } = await sb.rpc("match_products", {
        query_embedding: embedding,
        match_count: 2,
        filter_category: category,
        max_price: profile.budgetEur.max,
      });
      for (const p of (data ?? []) as MatchRow[]) {
        items.push({
          category,
          title: p.title,
          why: `Aligns with your ${profile.colorSeason} palette and goal to ${goal}.`,
          priceEur: Number(p.price_eur ?? 0),
          retailer: p.source ?? "",
          url: p.deeplink ?? "#",
          color: p.color ?? "#CCCCCC",
          productId: p.id,
        });
      }
    }

    return items.length ? items : mockShopping();
  } catch {
    return mockShopping();
  }
}
