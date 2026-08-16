"use client";

import { CATALOG_CATEGORIES } from "@/lib/catalog-categories";

const ADMIN_GENDERS = ["men", "women", "unisex", "kids"] as const;

export type CatalogProductDraft = {
  title: string;
  brand: string;
  category: string;
  color: string;
  price: string;
  currency: string;
  imageUrl: string;
  deeplink: string;
  gender: string;
  description: string;
};

const CURRENCIES = ["EUR", "USD", "GBP", "PLN", "SEK", "DKK", "CHF", "NOK", "CZK", "CAD"];

export const EMPTY_DRAFT: CatalogProductDraft = {
  title: "",
  brand: "",
  category: "Outerwear",
  color: "",
  price: "",
  currency: "EUR",
  imageUrl: "",
  deeplink: "",
  gender: "",
  description: "",
};

export function draftFromProduct(p: {
  title: string;
  brand: string | null;
  category: string | null;
  color: string | null;
  original_price?: number | null;
  price_eur: number | null;
  currency?: string | null;
  image_url: string | null;
  deeplink?: string | null;
  gender?: string | null;
  description?: string | null;
}): CatalogProductDraft {
  return {
    title: p.title ?? "",
    brand: p.brand ?? "",
    category: p.category && CATALOG_CATEGORIES.includes(p.category as (typeof CATALOG_CATEGORIES)[number])
      ? p.category
      : "Other",
    color: p.color ?? "",
    price: String(p.original_price ?? p.price_eur ?? ""),
    currency: (p.currency ?? "EUR").toUpperCase(),
    imageUrl: p.image_url ?? "",
    deeplink: p.deeplink ?? "",
    gender: p.gender ?? "",
    description: p.description ?? "",
  };
}

export function payloadFromDraft(d: CatalogProductDraft) {
  return {
    title: d.title.trim(),
    brand: d.brand.trim() || null,
    category: d.category,
    color: d.color.trim() || null,
    price: Number(d.price),
    currency: d.currency,
    imageUrl: d.imageUrl.trim() || null,
    deeplink: d.deeplink.trim(),
    gender: d.gender || null,
    description: d.description.trim() || null,
  };
}

export function CatalogProductEditor({
  mode,
  draft,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  draft: CatalogProductDraft;
  busy: boolean;
  error: string | null;
  onChange: (next: CatalogProductDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  function set<K extends keyof CatalogProductDraft>(key: K, value: CatalogProductDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        aria-modal
        aria-labelledby="catalog-product-editor-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border hairline bg-paper p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="catalog-product-editor-title" className="font-display text-2xl">
              {mode === "create" ? "Add product" : "Edit product"}
            </h3>
            <p className="mt-1 text-sm text-stone">
              Saved items are re-typed and re-embedded so looks and shop-a-look pick them up.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-stone-soft hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          className="mt-5 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="sm:col-span-2 text-sm">
            <span className="text-stone-soft">Title</span>
            <input
              required
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-stone-soft">Brand</span>
            <input
              value={draft.brand}
              onChange={(e) => set("brand", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-stone-soft">Category</span>
            <select
              value={draft.category}
              onChange={(e) => set("category", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            >
              {CATALOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-stone-soft">Colour</span>
            <input
              value={draft.color}
              onChange={(e) => set("color", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-stone-soft">Gender</span>
            <select
              value={draft.gender}
              onChange={(e) => set("gender", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            >
              <option value="">Any / unstated</option>
              {ADMIN_GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-stone-soft">Price</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-stone-soft">Currency</span>
            <select
              value={draft.currency}
              onChange={(e) => set("currency", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2 text-sm">
            <span className="text-stone-soft">Product URL</span>
            <input
              required
              type="url"
              value={draft.deeplink}
              onChange={(e) => set("deeplink", e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>
          <label className="sm:col-span-2 text-sm">
            <span className="text-stone-soft">Image URL</span>
            <input
              type="url"
              value={draft.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>
          <label className="sm:col-span-2 text-sm">
            <span className="text-stone-soft">Description</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              className="mt-1 w-full rounded-lg border hairline bg-cream/30 px-3 py-2"
            />
          </label>

          {error ? <p className="sm:col-span-2 text-sm text-red-700">{error}</p> : null}

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border hairline px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
