import "server-only";
import { embed } from "ai";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { mockShopping, type ShoppingItem } from "@/lib/report";
import { marketForCurrency } from "@/lib/currency";
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
