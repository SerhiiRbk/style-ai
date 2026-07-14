"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { tierLabel } from "@/lib/report-labels";
import {
  GALLERY_KIND_LABEL,
  type GalleryItemKind,
  type GalleryReportGroup,
} from "@/lib/gallery-types";

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
    if (filter === "all") return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((it) => it.kind === filter) }))
      .filter((g) => g.items.length > 0);
  }, [groups, filter]);

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
                  <span className="text-stone-soft/60" aria-hidden>
                    ·
                  </span>
                  <span>{tierLabel(g.tier)}</span>
                </div>
              </div>
              <Link
                href={`/report/${g.id}`}
                className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-brass/40 bg-brass/5 px-4 py-1.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
              >
                <span className="transition-colors group-hover:text-brass">
                  Open report
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
                  <a
                    href={it.src}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-2 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium text-ink opacity-0 shadow-sm transition-opacity hover:bg-paper group-hover:opacity-100"
                    title="Download image"
                  >
                    Download
                  </a>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
