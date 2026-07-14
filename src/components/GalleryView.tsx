"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { ShareLookButton } from "@/components/ShareLookButton";
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
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="group/tip relative">
                      <a
                        href={`${it.src}&dl=1`}
                        download
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Download full resolution"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/35 text-paper shadow-sm ring-1 ring-paper/25 backdrop-blur-md transition-colors hover:bg-ink/60"
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
                          <path d="M12 3v12" />
                          <path d="m7 11 5 5 5-5" />
                          <path d="M5 21h14" />
                        </svg>
                      </a>
                      <span className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100">
                        Download full resolution
                      </span>
                    </span>
                    {it.kind === "look" && g.canShare ? (
                      <ShareLookButton
                        reportId={g.id}
                        lookIndex={Number(it.id.split(":")[2])}
                      />
                    ) : null}
                  </div>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
