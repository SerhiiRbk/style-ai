"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { ProductImage } from "@/components/ProductImage";
import { ShareImageButton } from "@/components/ShareImageButton";
import { DownloadIconButton } from "@/components/DownloadIconButton";
import { tierLabel } from "@/lib/report-labels";
import {
  GALLERY_KIND_LABEL,
  type GalleryItem,
  type GalleryItemKind,
  type GalleryReportGroup,
} from "@/lib/gallery-types";
import type { TryOnVerdict } from "@/lib/ai/tryon-opinion";

const VERDICT_STYLE: Record<TryOnVerdict, { dot: string; label: string }> = {
  great: { dot: "bg-emerald-500", label: "Strong match" },
  good: { dot: "bg-brass", label: "Works for you" },
  caution: { dot: "bg-amber-500", label: "Wearable, with a caveat" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Filter = "all" | GalleryItemKind;

/** Client-side type filter over the server-aggregated "My looks" gallery. */
export function GalleryView({ groups }: { groups: GalleryReportGroup[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openOpinion, setOpenOpinion] = useState<GalleryItem | null>(null);
  // Which tile's action menu is expanded on mobile (id from GalleryItem).
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  async function deleteTryon(tryonId: string) {
    if (deleting) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this try-on image? This cannot be undone.")
    ) {
      return;
    }
    setDeleting(tryonId);
    try {
      const res = await fetch("/api/tryon", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tryonId }),
      });
      if (res.ok) {
        setRemoved((prev) => new Set(prev).add(tryonId));
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(null);
    }
  }

  // Which kinds actually exist, in a stable display order.
  const kindOrder: GalleryItemKind[] = [
    "look",
    "capsule",
    "cover",
    "hair",
    "grooming",
    "eyewear",
    "accessories",
    "headwear",
    "tryon",
  ];
  const availableKinds = useMemo(() => {
    const present = new Set<GalleryItemKind>();
    for (const g of groups) for (const it of g.items) present.add(it.kind);
    return kindOrder.filter((k) => present.has(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const visibleGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            (filter === "all" || it.kind === filter) &&
            !(it.tryonId && removed.has(it.tryonId)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, filter, removed]);

  const chipClass = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors ${
      active
        ? "border-brass bg-brass/10 text-ink"
        : "border-line bg-paper text-stone hover:border-brass/50 hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={chipClass(filter === "all")}
        >
          All
        </button>
        {availableKinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={chipClass(filter === k)}
          >
            {GALLERY_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {visibleGroups.map((g) => (
          <section key={g.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl text-ink">
                  {g.headline || "Style report"}
                </h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone">
                  <span>{formatDate(g.createdAt)}</span>
                  {g.tier ? (
                    <>
                      <span className="text-stone-soft/60" aria-hidden>
                        ·
                      </span>
                      <span>{tierLabel(g.tier)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <Link
                href={g.href}
                className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-brass/40 bg-brass/5 px-4 py-1.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
              >
                <span className="transition-colors group-hover:text-brass">
                  {g.linkLabel}
                </span>
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((it) => (
                <figure
                  key={it.id}
                  className="group relative overflow-hidden rounded-xl border hairline bg-cream/40"
                >
                  <div className="relative aspect-[3/4]">
                    <ReportZoomImage
                      src={it.src}
                      alt={it.label}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-paper backdrop-blur-sm">
                    {GALLERY_KIND_LABEL[it.kind]}
                  </span>
                  <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
                    {/* Mobile: one button that expands the actions vertically. */}
                    <button
                      type="button"
                      aria-label={
                        openMenu === it.id ? "Hide actions" : "Show actions"
                      }
                      aria-expanded={openMenu === it.id}
                      onClick={() =>
                        setOpenMenu((cur) => (cur === it.id ? null : it.id))
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/45 text-paper shadow-sm ring-1 ring-paper/25 backdrop-blur-md transition-colors hover:bg-ink/70 sm:hidden"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                      </svg>
                    </button>

                    {/* Actions: vertical stack. Desktop reveals on hover; mobile
                        is toggled by the button above. */}
                    <div
                      className={`flex-col items-end gap-1.5 ${
                        openMenu === it.id ? "flex" : "hidden"
                      } sm:flex sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100`}
                    >
                      {it.opinion ? (
                        <span className="group/tip relative inline-flex">
                          <button
                            type="button"
                            aria-label="Carlo's verdict"
                            title="See Carlo's verdict for this try-on"
                            onClick={() => setOpenOpinion(it)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/35 font-display text-sm leading-none text-paper shadow-sm ring-1 ring-paper/25 backdrop-blur-md transition-colors hover:bg-brass hover:text-ink"
                          >
                            V
                          </button>
                          <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100">
                            Carlo&apos;s verdict
                          </span>
                        </span>
                      ) : null}
                      <DownloadIconButton href={`${it.src}&dl=1`} />
                      <ShareImageButton src={it.src} title={it.label} />
                      {it.tryonId ? (
                        <span className="group/tip relative inline-flex">
                          <button
                            type="button"
                            aria-label="Delete try-on"
                            disabled={deleting === it.tryonId}
                            onClick={() => deleteTryon(it.tryonId!)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/35 text-paper shadow-sm ring-1 ring-paper/25 backdrop-blur-md transition-colors hover:bg-red-600/80 disabled:opacity-50"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                              aria-hidden
                            >
                              <path d="M4 7h16" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M6 7l1 13h10l1-13" />
                              <path d="M9 7V4h6v3" />
                            </svg>
                          </button>
                          <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100">
                            Delete try-on
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>

      {openOpinion?.opinion ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Carlo's verdict"
          onClick={() => setOpenOpinion(null)}
        >
          <div
            className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border hairline bg-paper shadow-2xl sm:max-h-[min(90dvh,720px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto overscroll-contain p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${VERDICT_STYLE[openOpinion.opinion.verdict].dot}`}
                  aria-hidden
                />
                <span className="text-xs uppercase tracking-wider text-stone">
                  Carlo · {VERDICT_STYLE[openOpinion.opinion.verdict].label}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpenOpinion(null)}
                className="-mt-1 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone transition-colors hover:bg-cream hover:text-ink"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <h3 className="mt-3 font-display text-lg leading-snug text-ink">
              {openOpinion.opinion.headline}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone">
              {openOpinion.opinion.body}
            </p>

            {openOpinion.opinion.pairWith.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wider text-stone-soft">
                  Pair with
                </p>
                <ul className="mt-1.5 space-y-1">
                  {openOpinion.opinion.pairWith.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink">
                      <span className="text-brass" aria-hidden>
                        ·
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {openOpinion.garments && openOpinion.garments.length > 0 ? (
              <div className="mt-5 border-t hairline pt-4">
                <p className="text-[11px] uppercase tracking-wider text-stone-soft">
                  Tried on
                </p>
                <ul className="mt-2 space-y-2">
                  {openOpinion.garments.map((g, i) => {
                    const inner = (
                      <>
                        <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border hairline bg-cream/40">
                          <ProductImage
                            src={g.imageUrl ?? null}
                            alt={g.title}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">
                            {g.title}
                          </span>
                          {g.category ? (
                            <span className="block text-xs text-stone">
                              {g.category}
                            </span>
                          ) : null}
                        </span>
                        {g.deeplink ? (
                          <span
                            className="shrink-0 self-center text-xs text-brass"
                            aria-hidden
                          >
                            View →
                          </span>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={i}>
                        {g.deeplink ? (
                          <a
                            href={g.deeplink}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-cream/60"
                          >
                            {inner}
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 p-1">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
