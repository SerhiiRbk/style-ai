"use client";

import { useState } from "react";
import Link from "next/link";
import { DeleteSetButton } from "@/components/DeleteSetButton";
import { ReportImageGenerating } from "@/components/luxe/ReportImageGenerating";
import { LookGeneratingRefresh } from "@/components/LookGeneratingRefresh";
import {
  ViewModeToggle,
  useViewMode,
} from "@/components/ViewModeToggle";

export type LooksBrowserItem = {
  id: string;
  /** Display name (set name, falling back to the occasion label). */
  name: string;
  /** Occasion label, shown as a small tag. */
  occasion: string;
  /** Pre-formatted date string (formatted server-side for stable SSR). */
  date: string;
  /** Signed thumbnail URL, or null when the set has no rendered look yet. */
  thumbUrl: string | null;
  /** True while the set's looks are still being generated. */
  generating: boolean;
  /** False for report-mirrored sets — deleting would only bounce back on refresh. */
  canDelete?: boolean;
};

const STORAGE_KEY = "looks-view-mode";

export function LooksBrowser({ sets }: { sets: LooksBrowserItem[] }) {
  const view = useViewMode(STORAGE_KEY);
  // Deleted sets are tracked as ids to hide, so the visible list is derived
  // from the server-provided `sets` prop (no state sync effect needed).
  const [removed, setRemoved] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const items = sets.filter((s) => !removed.has(s.id));
  const anyGenerating = items.some((s) => s.generating);

  function handleDeleted(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  return (
    <>
      <LookGeneratingRefresh active={anyGenerating} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-brass">My Style</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Looks</h1>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle storageKey={STORAGE_KEY} />
          <Link
            href="/create-look"
            className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            New look
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border hairline bg-cream/40 p-10 text-center">
          <p className="text-stone">You haven&apos;t created any looks yet.</p>
          <Link
            href="/create-look"
            className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Create your first look
          </Link>
        </div>
      ) : view === "grid" ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <div
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border hairline bg-paper transition-colors hover:border-ink/30"
            >
              {s.canDelete !== false ? (
                <div className="absolute right-2 top-2 z-10 rounded-full bg-paper/85 opacity-100 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <DeleteSetButton
                    setId={s.id}
                    variant="compact"
                    onDeleted={handleDeleted}
                  />
                </div>
              ) : null}
              <Link href={`/looks/${s.id}`} prefetch={false} className="block">
                <div className="aspect-[9/16] w-full bg-cream/40">
                  {s.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.thumbUrl}
                      alt={s.occasion}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : s.generating ? (
                    <ReportImageGenerating
                      label="Generating look"
                      detail="Styling this look on your photo"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-display text-lg text-ink">{s.name}</p>
                  <p className="mt-0.5 text-xs text-stone-soft">{s.date}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-8 divide-y hairline rounded-2xl border hairline bg-paper">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-cream/30 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
            >
              <Link
                href={`/looks/${s.id}`}
                prefetch={false}
                className="relative hidden h-16 w-12 shrink-0 overflow-hidden rounded-lg border hairline bg-cream/40 sm:block"
              >
                {s.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.thumbUrl}
                    alt=""
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                ) : s.generating ? (
                  <ReportImageGenerating label="Generating look" detail="" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/looks/${s.id}`}
                  prefetch={false}
                  className="block truncate font-display text-lg text-ink transition-colors hover:text-ink-soft"
                >
                  {s.name}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone">
                  <span>{s.date}</span>
                  {s.canDelete !== false ? (
                    <>
                      <span className="text-stone-soft/60" aria-hidden>
                        ·
                      </span>
                      <DeleteSetButton
                        setId={s.id}
                        variant="compact"
                        onDeleted={handleDeleted}
                      />
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                <span className="rounded-full border hairline bg-cream/40 px-3 py-1 text-xs text-stone">
                  {s.occasion}
                </span>
                <Link
                  href={`/looks/${s.id}`}
                  prefetch={false}
                  className="group inline-flex items-center justify-center gap-1 rounded-full border border-brass/40 bg-brass/5 px-5 py-2 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
                >
                  <span className="transition-colors group-hover:text-brass">
                    Open
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
