"use client";

import { useState } from "react";
import Link from "next/link";
import { DeleteReportButton } from "@/components/DeleteReportButton";
import { useViewMode } from "@/components/ViewModeToggle";
import { reportStatusLabel } from "@/lib/report-labels";

export type ReportsBrowserItem = {
  id: string;
  headline: string;
  date: string;
  thumbUrl: string | null;
  tier: string;
  language: string;
  status: "processing" | "ready" | "failed";
};

const STORAGE_KEY = "reports-view-mode";

export function ReportsBrowser({
  reports,
}: {
  reports: ReportsBrowserItem[];
}) {
  const view = useViewMode(STORAGE_KEY);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const items = reports.filter((r) => !removed.has(r.id));

  function handleDeleted(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-2xl border hairline bg-paper px-6 py-16 text-center">
          <p className="font-display text-2xl">No reports yet</p>
          <p className="mx-auto mt-3 max-w-sm text-stone">
            Create your first style report — it only takes a few minutes.
          </p>
          <div className="mt-8">
            <Link
              href="/start"
              className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
            >
              Create your first report
            </Link>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <div
              key={r.id}
              className="group relative overflow-hidden rounded-2xl border hairline bg-paper transition-colors hover:border-ink/30"
            >
              <div className="absolute right-2 top-2 z-10 rounded-full bg-paper/85 opacity-100 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <DeleteReportButton
                  reportId={r.id}
                  variant="compact"
                  onDeleted={handleDeleted}
                />
              </div>
              <Link href={`/report/${r.id}`} className="block">
                <div className="aspect-[9/16] w-full bg-cream/40">
                  {r.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-display text-lg text-ink">{r.headline}</p>
                  <p className="mt-0.5 text-xs text-stone-soft">{r.date}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border hairline bg-cream/40 px-2.5 py-0.5 text-[11px] text-stone">
                      {r.tier}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y hairline rounded-2xl border hairline bg-paper">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-cream/30 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
            >
              {r.thumbUrl ? (
                <Link
                  href={`/report/${r.id}`}
                  className="relative hidden h-16 w-12 shrink-0 overflow-hidden rounded-lg border hairline bg-cream/40 sm:block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumbUrl}
                    alt=""
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                </Link>
              ) : null}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/report/${r.id}`}
                  className="block truncate font-display text-lg text-ink transition-colors hover:text-ink-soft"
                >
                  {r.headline}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone">
                  <span>{r.date}</span>
                  <span className="text-stone-soft/60" aria-hidden>
                    ·
                  </span>
                  <DeleteReportButton
                    reportId={r.id}
                    variant="compact"
                    onDeleted={handleDeleted}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                <span className="rounded-full border hairline bg-cream/40 px-3 py-1 text-xs text-stone">
                  {r.tier}
                </span>
                <span className="rounded-full border hairline bg-cream/40 px-3 py-1 text-xs text-stone">
                  {r.language}
                </span>
                <StatusBadge status={r.status} />
                <Link
                  href={`/report/${r.id}`}
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

function StatusBadge({
  status,
}: {
  status: "processing" | "ready" | "failed";
}) {
  const label = reportStatusLabel(status);
  const styles =
    status === "processing"
      ? "border-brass/30 bg-brass/10 text-brass"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-ink/10 bg-cream/60 text-ink";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${styles}`}
    >
      {status === "processing" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brass align-middle" />
      )}
      {label}
    </span>
  );
}
