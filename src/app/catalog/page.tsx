import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProductImage } from "@/components/ProductImage";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getGeo } from "@/lib/geo";
import { formatMoney, type Currency } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Catalog — shoppable menswear picks · Valetti",
  description:
    "Browse the Valetti catalogue — curated menswear matched to quiet-luxury, European style. Real products with disclosed affiliate links.",
  alternates: { canonical: "/catalog" },
};

export const dynamic = "force-dynamic";

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

type ProductRow = {
  id: string;
  source: string | null;
  brand: string | null;
  title: string;
  category: string | null;
  color: string | null;
  price_eur: number | null;
  image_url: string | null;
  deeplink: string | null;
  market: string | null;
  gender: string | null;
  in_stock: boolean | null;
};

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

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
  const market = first(sp.market);
  const gender = first(sp.gender);
  const inStockOnly = first(sp.instock) === "1";
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
              href="/report/demo"
              className="inline-flex items-center justify-center rounded-full border border-ink/25 px-5 py-3 text-sm text-ink transition-all hover:bg-ink hover:text-paper"
            >
              Open the example report
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  const { currency } = await getGeo();
  const sb = createAdminSupabase();

  let query = sb
    .from("products")
    .select(
      "id,source,brand,title,category,color,price_eur,image_url,deeplink,market,gender,in_stock",
      { count: "exact" },
    );

  if (category) query = query.eq("category", category);
  if (market) query = query.eq("market", market);
  if (gender) query = query.eq("gender", gender);
  if (inStockOnly) query = query.eq("in_stock", true);
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
        {/* Filters */}
        <form
          method="get"
          className="grid gap-3 rounded-2xl border hairline bg-paper p-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search title or brand…"
            className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm lg:col-span-2"
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
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-stone">
              <input
                type="checkbox"
                name="instock"
                value="1"
                defaultChecked={inStockOnly}
                className="h-4 w-4 accent-ink"
              />
              In stock
            </label>
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-ink-soft"
            >
              Apply
            </button>
          </div>
        </form>

        {/* Result meta */}
        <div className="mt-6 flex items-center justify-between text-sm text-stone-soft">
          <span>
            {error
              ? "Couldn't load the catalogue."
              : total === 0
                ? "No products match your filters yet."
                : `${total.toLocaleString("en-US")} product${total === 1 ? "" : "s"}`}
          </span>
          {(q || category || market || gender || inStockOnly) && (
            <Link href="/catalog" className="text-brass hover:text-ink">
              Clear filters
            </Link>
          )}
        </div>

        {/* Grid */}
        {products.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} currency={currency} />
            ))}
          </div>
        )}

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
      </section>
    </Shell>
  );
}

function ProductCard({
  p,
  currency,
}: {
  p: ProductRow;
  currency: Currency;
}) {
  const name = p.brand ? `${p.brand} ${p.title}` : p.title;
  return (
    <a
      href={p.deeplink ?? "#"}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border hairline bg-paper transition-shadow hover:shadow-[0_24px_48px_-28px_rgba(21,18,13,0.45)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-cream/40">
        <ProductImage
          src={p.image_url}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {p.in_stock === false && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[10px] text-paper backdrop-blur-sm">
            Out of stock
          </span>
        )}
        {p.category && (
          <span className="absolute right-2 top-2 rounded-full bg-paper/90 px-2 py-1 text-[10px] text-ink backdrop-blur-sm">
            {p.category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {p.brand && (
          <div className="text-[11px] uppercase tracking-wider text-stone-soft">
            {p.brand}
          </div>
        )}
        <div className="mt-1 line-clamp-2 text-sm text-ink">{p.title}</div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-base">
            {p.price_eur != null ? formatMoney(p.price_eur, currency) : "—"}
          </span>
          {p.color && (
            <span className="flex items-center gap-1.5 text-[11px] text-stone-soft">
              <span
                className="h-3 w-3 rounded-full border border-ink/10"
                style={{ background: hexable(p.color) }}
              />
              {p.color}
            </span>
          )}
        </div>
        <span className="mt-3 text-xs text-brass transition-colors group-hover:text-ink">
          View at retailer →
        </span>
      </div>
    </a>
  );
}

/** Use the colour name directly if it looks like a CSS colour, else a swatch. */
function hexable(color: string): string {
  if (/^#?[0-9a-f]{3,8}$/i.test(color)) {
    return color.startsWith("#") ? color : `#${color}`;
  }
  return "#D8CDBA";
}
