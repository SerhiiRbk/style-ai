"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { CATALOG_CATEGORIES } from "@/lib/catalog-categories";
import { GARMENT_SUBTYPES } from "../../scripts/feeds/attributes.mjs";
import {
  CatalogProductEditor,
  EMPTY_DRAFT,
  draftFromProduct,
  payloadFromDraft,
  type CatalogProductDraft,
} from "@/components/CatalogProductEditor";

type Product = {
  id: string;
  source: string | null;
  brand: string | null;
  title: string;
  category: string | null;
  color: string | null;
  price_eur: number | null;
  original_price?: number | null;
  currency?: string | null;
  image_url: string | null;
  deeplink?: string | null;
  gender?: string | null;
  description?: string | null;
  source_type: string | null;
  hidden: boolean | null;
  garment_subtype?: string | null;
};

export function CatalogAdminPanel() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [subtype, setSubtype] = useState("");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<null | { mode: "create" | "edit"; id?: string }>(
    null,
  );
  const [draft, setDraft] = useState<CatalogProductDraft>(EMPTY_DRAFT);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (subtype) params.set("subtype", subtype);
      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load products");
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [q, category, subtype, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeCategory(id: string, next: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update category");
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, category: next } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update category");
      void load();
    } finally {
      setPendingId(null);
    }
  }

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditorError(null);
    setEditor({ mode: "create" });
  }

  function openEdit(p: Product) {
    setDraft(draftFromProduct(p));
    setEditorError(null);
    setEditor({ mode: "edit", id: p.id });
  }

  async function saveEditor() {
    if (!editor) return;
    setSaving(true);
    setEditorError(null);
    try {
      const payload = payloadFromDraft(draft);
      const res = await fetch(
        editor.mode === "create"
          ? "/api/admin/products"
          : `/api/admin/products/${editor.id}`,
        {
          method: editor.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save product");
      setEditor(null);
      if (editor.mode === "create") setPage(1);
      void load();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete “${title}” from the catalogue?`)) return;
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Manage products</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone">
            Add or edit catalogue items. Saves re-type attributes and refresh the
            search embedding so matching picks up the change.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper"
        >
          Add product
        </button>
      </div>

      <form
        className="mt-6 grid gap-3 rounded-2xl border hairline bg-paper p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or brand…"
          className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATALOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={subtype}
          onChange={(e) => {
            setSubtype(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border hairline bg-cream/30 px-3 py-2 text-sm"
        >
          <option value="">All subtypes</option>
          <option value="untagged">Untagged</option>
          {GARMENT_SUBTYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper sm:col-span-4 sm:justify-self-start"
        >
          Search
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-stone-soft">
        <span>
          {loading
            ? "Loading…"
            : `${total.toLocaleString("en-US")} product${total === 1 ? "" : "s"}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border hairline px-3 py-1 disabled:opacity-40"
            >
              ←
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border hairline px-3 py-1 disabled:opacity-40"
            >
              →
            </button>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border hairline bg-paper">
        <div className="hidden border-b hairline bg-cream/40 px-4 py-2 text-[11px] uppercase tracking-wider text-stone-soft sm:grid sm:grid-cols-[minmax(0,1fr)_10rem_8rem_5rem] sm:gap-4">
          <span>Product</span>
          <span>Category</span>
          <span>Source</span>
          <span />
        </div>
        <ul className="divide-y hairline">
          {products.map((p) => {
            const name = p.brand ? `${p.brand} ${p.title}` : p.title;
            const busy = pendingId === p.id;
            return (
              <li
                key={p.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_5rem] sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-cream/50">
                    <ProductImage
                      src={p.image_url}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{p.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-soft">
                      {p.brand ? <span>{p.brand}</span> : null}
                      {p.garment_subtype ? <span>{p.garment_subtype}</span> : null}
                      {p.color ? <span>{p.color}</span> : null}
                      {p.price_eur != null ? (
                        <span>€{p.price_eur.toFixed(2)}</span>
                      ) : null}
                      {p.hidden ? (
                        <span className="text-red-600">hidden</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <select
                  value={p.category ?? "Other"}
                  disabled={busy}
                  onChange={(e) => void changeCategory(p.id, e.target.value)}
                  className="w-full rounded-lg border hairline bg-cream/30 px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {CATALOG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="truncate text-xs text-stone-soft">
                  {p.source ?? "—"}
                  {p.source_type ? (
                    <span className="block text-[10px]">{p.source_type}</span>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEdit(p)}
                    className="rounded-md px-2 py-1 text-xs text-stone hover:bg-cream/60 hover:text-ink disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title="Delete from catalogue"
                    aria-label={`Delete ${name}`}
                    onClick={() => void remove(p.id, p.title)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-soft transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {!loading && products.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-stone">
            No products match your filters.
          </p>
        ) : null}
      </div>

      {editor ? (
        <CatalogProductEditor
          mode={editor.mode}
          draft={draft}
          busy={saving}
          error={editorError}
          onChange={setDraft}
          onClose={() => setEditor(null)}
          onSubmit={() => void saveEditor()}
        />
      ) : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
