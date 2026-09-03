import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { CatalogTryOnHint } from "@/components/CatalogProductCard";
import { CatalogProductGrid } from "@/components/CatalogProductGrid";
import { CatalogPrefetch } from "@/components/CatalogPrefetch";
import { CompleteLookResult } from "@/components/CompleteLookResult";
import { hasSupabaseAdmin } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { BRAND } from "@/lib/brand";
import {
  CATALOG_PAGE_SIZE,
  getCatalogFilterOptions,
  getCatalogProductCount,
  listCatalogProducts,
  type CatalogBrowseFilters,
} from "@/lib/data/catalog-browse";

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

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
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

function CatalogPager({
  page,
  totalPages,
  prevHref,
  nextHref,
  className,
}: {
  page: number;
  totalPages: number;
  prevHref?: string;
  nextHref?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div
      className={`flex items-center justify-center gap-4 text-sm ${className ?? ""}`}
    >
      {prevHref ? (
        <Link
          href={prevHref}
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
      {nextHref ? (
        <Link
          href={nextHref}
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
  const filters: CatalogBrowseFilters = {
    q,
    category,
    brand,
    subcategory,
    market,
    gender,
  };

  if (!hasSupabaseAdmin) {
    return (
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
    );
  }

  let brands: string[] = [];
  let subcategories: string[] = [];
  let products: Awaited<ReturnType<typeof listCatalogProducts>> = [];
  let total = 0;
  let loadError = false;

  try {
    const [options, count, rows] = await Promise.all([
      getCatalogFilterOptions(),
      getCatalogProductCount(filters),
      listCatalogProducts(filters, page),
    ]);
    brands = options.brands;
    subcategories = options.subcategories;
    total = count;
    products = rows;
  } catch {
    loadError = true;
  }

  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const prevHref = page > 1 ? buildHref(sp, { page: page - 1 }) : undefined;
  const nextHref =
    page < totalPages ? buildHref(sp, { page: page + 1 }) : undefined;

  if (nextHref) {
    after(() => {
      void listCatalogProducts(filters, page + 1);
    });
  }

  return (
    <>
      <CatalogPrefetch prevHref={prevHref} nextHref={nextHref} />
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
        <CompleteLookResult />

        {/* Result meta */}
        <div className="mt-6 flex items-center justify-between text-sm text-stone-soft">
          <span>
            {loadError
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

        <CatalogPager
          page={page}
          totalPages={totalPages}
          prevHref={prevHref}
          nextHref={nextHref}
          className="mt-6"
        />

        {/* Grid */}
        {products.length > 0 && <CatalogProductGrid products={products} />}

        <CatalogPager
          page={page}
          totalPages={totalPages}
          prevHref={prevHref}
          nextHref={nextHref}
          className="mt-12"
        />
      </section>
    </>
  );
}
