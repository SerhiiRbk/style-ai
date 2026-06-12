"use client";

import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { MAX_TRYON_ITEMS, useTryOnSelection } from "@/components/TryOnContext";
import { formatProductPrice, type Currency } from "@/lib/currency";

export type CatalogProduct = {
  id: string;
  brand: string | null;
  title: string;
  category: string | null;
  color: string | null;
  price_eur: number | null;
  original_price: number | null;
  currency: string | null;
  image_url: string | null;
  deeplink: string | null;
  in_stock: boolean | null;
};

function hexable(color: string): string {
  if (/^#?[0-9a-f]{3,8}$/i.test(color)) {
    return color.startsWith("#") ? color : `#${color}`;
  }
  return "#D8CDBA";
}

export function CatalogProductCard({
  product,
  currency,
  canTryOn,
}: {
  product: CatalogProduct;
  currency: Currency;
  canTryOn: boolean;
}) {
  const selection = useTryOnSelection();
  const name = product.brand ? `${product.brand} ${product.title}` : product.title;
  const inSet = selection?.isSelected(product.id) ?? false;
  const setFull = Boolean(selection?.full) && !inSet;

  function toggleOutfit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!selection || setFull) return;
    selection.toggle({
      productId: product.id,
      title: name,
      image: product.image_url ?? undefined,
    });
  }

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-paper transition-shadow hover:shadow-[0_24px_48px_-28px_rgba(21,18,13,0.45)] ${
        inSet ? "border-brass ring-2 ring-brass/35" : "hairline"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-cream/40">
        <ProductImage
          src={product.image_url}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {product.in_stock === false && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[10px] text-paper backdrop-blur-sm">
            Out of stock
          </span>
        )}
        {product.category && (
          <span className="absolute right-2 top-2 rounded-full bg-paper/90 px-2 py-1 text-[10px] text-ink backdrop-blur-sm">
            {product.category}
          </span>
        )}
        {canTryOn && selection ? (
          <button
            type="button"
            onClick={toggleOutfit}
            disabled={setFull}
            title={
              setFull
                ? `Outfit set is full (${MAX_TRYON_ITEMS} max)`
                : inSet
                  ? "Remove from outfit"
                  : "Add to outfit try-on"
            }
            className={`absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[11px] backdrop-blur-sm transition-colors ${
              inSet
                ? "bg-brass text-ink"
                : "bg-paper/95 text-ink hover:bg-paper disabled:opacity-50"
            }`}
          >
            {inSet ? "✓ In outfit" : "+ Add to outfit"}
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {product.brand && (
          <div className="text-[11px] uppercase tracking-wider text-stone-soft">
            {product.brand}
          </div>
        )}
        <div className="mt-1 line-clamp-2 text-sm text-ink">{product.title}</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-display text-sm leading-snug sm:text-base">
            {product.price_eur != null
              ? formatProductPrice({
                  priceEur: product.price_eur,
                  displayCurrency: currency,
                  originalPrice: product.original_price,
                  originalCurrency: product.currency,
                })
              : "—"}
          </span>
          {product.color && (
            <span className="flex items-center gap-1.5 text-[11px] text-stone-soft">
              <span
                className="h-3 w-3 rounded-full border border-ink/10"
                style={{ background: hexable(product.color) }}
              />
              {product.color}
            </span>
          )}
        </div>
        {product.deeplink ? (
          <a
            href={product.deeplink}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="mt-3 text-xs text-brass transition-colors hover:text-ink"
          >
            View at retailer →
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function CatalogTryOnHint({
  canTryOn,
  cost,
  balance,
}: {
  canTryOn: boolean;
  cost: number;
  balance: number | null;
}) {
  if (!canTryOn) {
    return (
      <div className="mt-6 rounded-2xl border hairline bg-cream/40 px-4 py-3 text-sm text-stone">
        <Link href="/login" className="text-ink underline decoration-brass/50 underline-offset-2">
          Sign in
        </Link>{" "}
        to try up to {MAX_TRYON_ITEMS} catalogue pieces on your photo ({cost} credit
        {cost === 1 ? "" : "s"} per render). Previews are not saved to a report.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border hairline bg-cream/40 px-4 py-3 text-sm text-stone">
      Select up to {MAX_TRYON_ITEMS} items with{" "}
      <span className="text-ink">+ Add to outfit</span>, then render them together on your
      photo · {cost} credit{cost === 1 ? "" : "s"} per try-on
      {balance != null ? (
        <>
          {" "}
          · <span className="text-ink">{balance}</span> credits left
        </>
      ) : null}
      . Not saved to a report.
    </div>
  );
}
