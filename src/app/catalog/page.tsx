import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  CatalogTryOnHint,
  type CatalogProduct,
} from "@/components/CatalogProductCard";
import { CatalogTryOnShell } from "@/components/CatalogTryOnShell";
import { CatalogProductGrid } from "@/components/CatalogProductGrid";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Catalog — shoppable menswear picks · Valetti",
  description:
    "Browse the Valetti catalogue — curated menswear matched to quiet-luxury style. Real products with disclosed affiliate links.",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Valetti catalogue — shoppable menswear picks",
    description:
      "Browse curated menswear matched to quiet-luxury style. Real products with disclosed affiliate links.",
    url: "/catalog",
    type: "website",
    images: [
      {
        url: BRAND.ogImage,
        width: BRAND.ogImageWidth,
        height: BRAND.ogImageHeight,
        alt: "Men's style essentials flat lay — Valetti personal style atelier",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Valetti catalogue — shoppable menswear picks",
    description:
      "Browse curated menswear matched to quiet-luxury style.",
    images: [BRAND.ogImage],
  },
};

const PAGE_SIZE = 24;

const CATEGORIES = [
  "Outerwear",
  "Knitwear",
  "Shirts",
  "Trousers",
  "Footwear",
  "Accessories",
  "Bags",
  "Activewear",
  "Swimwear",
  "Underwear",
  "Grooming",
  "Suits",
  "Dresses",
  "Other",
] as const;

const MARKETS = ["EU", "US"] as const;
const GENDERS = ["men", "women", "unisex"] as const;

type ProductRow = CatalogProduct & {
  source: string | null;
  market: string | null;
  gender: string | null;
};

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Distinct filter options in one scan: every non-hidden brand (all sources)
 * and every populated garment sub-category (from the typed `garment_subtype`). */
async function listFilterOptions(
  admin: ReturnType<typeof createAdminSupabase>,
): Promise<{ brands: string[]; subcategories: string[] }> {
  const brands = new Set<string>();
  const subcategories = new Set<string>();
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from("products")
      .select("brand,garment_subtype")
      .eq("hidden", false)
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (typeof row.brand === "string" && row.brand) brands.add(row.brand);
      if (typeof row.garment_subtype === "string" && row.garment_subtype)
        subcategories.add(row.garment_subtype);
    }
    if (data.length < size) break;
  }
  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    subcategories: [...subcategories].sort((a, b) => a.localeCompare(b)),
  };
}

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function buildHref(base: SP, patch: Record<string, string | number | null>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    const val = first(v);
    if (val) params.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const category = first(sp.category);
  const brand = first(sp.brand);
  const subcategory = first(sp.subcategory);
  const market = first(sp.market);
  const gender = first(sp.gender);
  const page = Math.max(1, parseInt(first(sp.page) || "1", 10) || 1);

  if (!hasSupabaseAdmin) {
    return (
      <Shell>
        <section className="container-luxe py-24 text-center">
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-4 font-display text-4xl">The catalogue is warming up</h1>
          <p className="mx-auto mt-4 max-w-md text-stone">
            The live product catalogue is available once the service is
            configured. Meanwhile, explore a full example report to see how
            recommendations work.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/report/valetti-style-prospect-demo"
              className="inline-flex items-center justify-center rounded-full border border-ink/25 px-5 py-3 text-sm text-ink transition-all hover:bg-ink hover:text-paper"
            >
              Open the example report
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  const admin = createAdminSupabase();

  const { brands, subcategories } = await listFilterOptions(admin);

  let query = admin
    .from("products")
    .select(
      "id,source,brand,title,category,color,price_eur,original_price,currency,image_url,deeplink,market,gender,in_stock",
      { count: "exact" },
    );

  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand", brand);
  if (subcategory) query = query.eq("garment_subtype", subcategory);
  if (market) query = query.eq("market", market);
  if (gender) query = query.eq("gender", gender);
  if (q) query = query.or(`title.ilike.%${q}%,brand.ilike.%${q}%`);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const products = (data ?? []) as ProductRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Shell>
      <section className="border-b hairline bg-cream/40">
        <div className="container-luxe py-16">
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            Browse the catalogue
          </h1>
          <p className="mt-4 max-w-xl text-stone">
            Every product our stylist engine can recommend, pulled from
            partner retailers and refreshed daily. Browse, filter, and find
            pieces in your palette.
          </p>
        </div>
      </section>

      <section className="container-luxe py-10">
        <CatalogTryOnShell tryOnCost={CREDIT_COSTS.tryon}>
        {/* Filters */}
        <form
          method="get"
          className="grid gap-3 rounded-2xl border hairline bg-paper p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search title or brand…"
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm sm:col-span-2 xl:col-span-2"
          />
          <select
            name="category"
            defaultValue={category}
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="subcategory"
            defaultValue={subcategory}
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
          >
            <option value="">All sub-categories</option>
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
          <select
            name="brand"
            defaultValue={brand}
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            name="market"
            defaultValue={market}
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
          >
            <option value="">All regions</option>
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            name="gender"
            defaultValue={gender}
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g[0].toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Apply
          </button>
        </form>

        <CatalogTryOnHint cost={CREDIT_COSTS.tryon} />

        {/* Result meta */}
        <div className="mt-6 flex items-center justify-between text-sm text-stone-soft">
          <span>
            {error
              ? "Couldn't load the catalogue."
              : total === 0
                ? "No products match your filters yet."
                : `${total.toLocaleString("en-US")} product${total === 1 ? "" : "s"}`}
          </span>
          {(q || category || subcategory || brand || market || gender) && (
            <Link href="/catalog" className="text-brass hover:text-ink">
              Clear filters
            </Link>
          )}
        </div>

        {/* Grid */}
        {products.length > 0 && <CatalogProductGrid products={products} />}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-4 text-sm">
            {page > 1 ? (
              <Link
                href={buildHref(sp, { page: page - 1 })}
                className="rounded-full border border-ink/25 px-4 py-2 text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                ← Previous
              </Link>
            ) : (
              <span className="rounded-full border border-line px-4 py-2 text-stone-soft">
                ← Previous
              </span>
            )}
            <span className="text-stone">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildHref(sp, { page: page + 1 })}
                className="rounded-full border border-ink/25 px-4 py-2 text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-full border border-line px-4 py-2 text-stone-soft">
                Next →
              </span>
            )}
          </div>
        )}
        </CatalogTryOnShell>
      </section>
    </Shell>
  );
}
