import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/server";
import type { CatalogProduct } from "@/components/CatalogProductCard";

export const CATALOG_PAGE_SIZE = 24;

export type CatalogBrowseFilters = {
  q: string;
  category: string;
  brand: string;
  subcategory: string;
  market: string;
  gender: string;
};

export type CatalogFilterOptions = {
  brands: string[];
  subcategories: string[];
};

const PRODUCT_COLS =
  "id,brand,title,category,color,price_eur,original_price,currency,image_url,deeplink,in_stock";

function applyFilters<Q>(query: Q, filters: CatalogBrowseFilters): Q {
  const q = query as Q & {
    eq: (column: string, value: unknown) => Q;
    or: (filter: string) => Q;
  };
  let next: typeof q = q.eq("hidden", false) as typeof q;
  if (filters.category) next = next.eq("category", filters.category) as typeof q;
  if (filters.brand) next = next.eq("brand", filters.brand) as typeof q;
  if (filters.subcategory) {
    next = next.eq("garment_subtype", filters.subcategory) as typeof q;
  }
  if (filters.market) next = next.eq("market", filters.market) as typeof q;
  if (filters.gender) next = next.eq("gender", filters.gender) as typeof q;
  if (filters.q) {
    const needle = filters.q.replace(/[%(),]/g, "").slice(0, 80);
    if (needle) next = next.or(`title.ilike.%${needle}%,brand.ilike.%${needle}%`) as typeof q;
  }
  return next;
}

async function scanFilterOptions(): Promise<CatalogFilterOptions> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("catalog_filter_options");
  if (!error && data && typeof data === "object") {
    const row = data as {
      brands?: unknown;
      subcategories?: unknown;
    };
    const brands = Array.isArray(row.brands)
      ? row.brands.filter((b): b is string => typeof b === "string" && Boolean(b))
      : [];
    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories.filter(
          (s): s is string => typeof s === "string" && Boolean(s),
        )
      : [];
    if (brands.length || subcategories.length) {
      return { brands, subcategories };
    }
  }

  const brands = new Set<string>();
  const subcategories = new Set<string>();
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data: rows, error: scanErr } = await admin
      .from("products")
      .select("brand,garment_subtype")
      .eq("hidden", false)
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (scanErr) throw scanErr;
    if (!rows?.length) break;
    for (const row of rows) {
      if (typeof row.brand === "string" && row.brand) brands.add(row.brand);
      if (typeof row.garment_subtype === "string" && row.garment_subtype) {
        subcategories.add(row.garment_subtype);
      }
    }
    if (rows.length < size) break;
  }
  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    subcategories: [...subcategories].sort((a, b) => a.localeCompare(b)),
  };
}

export const getCatalogFilterOptions = unstable_cache(
  scanFilterOptions,
  ["catalog-filter-options"],
  { revalidate: 3600 },
);

async function countCatalogProductsUncached(
  filters: CatalogBrowseFilters,
): Promise<number> {
  const admin = createAdminSupabase();
  const { count, error } = await applyFilters(
    admin.from("products").select("id", { count: "exact", head: true }),
    filters,
  );
  if (error) throw error;
  return count ?? 0;
}

export const getCatalogProductCount = unstable_cache(
  countCatalogProductsUncached,
  ["catalog-count"],
  { revalidate: 120 },
);

async function listCatalogProductsUncached(
  filters: CatalogBrowseFilters,
  page: number,
): Promise<CatalogProduct[]> {
  const admin = createAdminSupabase();
  const from = (page - 1) * CATALOG_PAGE_SIZE;
  const to = from + CATALOG_PAGE_SIZE - 1;
  const { data, error } = await applyFilters(
    admin.from("products").select(PRODUCT_COLS),
    filters,
  )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data ?? []) as CatalogProduct[];
}

export const listCatalogProducts = unstable_cache(
  listCatalogProductsUncached,
  ["catalog-products"],
  { revalidate: 60 },
);
