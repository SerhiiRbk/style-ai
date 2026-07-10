"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ReportFeedbackStars } from "@/components/ReportFeedbackReadOnly";
import { reportStatusLabel, tierLabel } from "@/lib/report-labels";
import type { Tier } from "@/lib/report";

type AdminReportSummary = {
  id: string;
  createdAt: string;
  headline: string | null;
  tier: Tier;
  status: "processing" | "ready" | "failed";
  userId: string;
  userEmail: string | null;
  isPublic: boolean;
  feedbackRating: number | null;
  feedbackComment: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({
  status,
}: {
  status: AdminReportSummary["status"];
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
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles}`}
    >
      {status === "processing" && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brass align-middle" />
      )}
      {label}
    </span>
  );
}

export function ReportsAdminPanel() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<AdminReportSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishMsg, setFinishMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/reports?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load reports");
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(query.trim());
    setPage(1);
  }

  async function finishReports() {
    if (finishing) return;
    setFinishing(true);
    setFinishMsg(null);
    try {
      const res = await fetch("/api/admin/finish-reports", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not finish reports");
      const resumed = data.resumed?.length ?? 0;
      setFinishMsg(
        `Scanned ${data.scanned ?? 0}, ${data.incomplete ?? 0} incomplete, resumed ${resumed}.` +
          (data.incomplete > resumed
            ? " Run again to continue the backlog."
            : ""),
      );
      await load();
    } catch (e) {
      setFinishMsg(
        e instanceof Error ? e.message : "Could not finish reports",
      );
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-soft">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Headline or user email…"
            className="w-full rounded-xl border hairline bg-paper px-4 py-2.5 text-sm outline-none focus:border-brass/50"
          />
        </label>
        <button
          type="submit"
          className="rounded-full border border-brass/40 bg-brass/5 px-5 py-2.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
        >
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone">
          {loading ? "Loading…" : `${total} report${total === 1 ? "" : "s"} total`}
        </p>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={finishReports}
            disabled={finishing}
            title="Scan recent reports still missing images and resume generation for the missing ones."
            className="inline-flex items-center gap-2 rounded-full border border-brass/40 bg-brass/5 px-4 py-2 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10 disabled:opacity-50"
          >
            {finishing ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brass/40 border-t-brass" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                <path
                  d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16M4 20v-4h4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {finishing ? "Finishing…" : "Finish incomplete reports"}
          </button>
          {finishMsg && (
            <span className="max-w-xs text-right text-xs text-stone-soft">
              {finishMsg}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && !error && !reports.length ? (
        <p className="mt-8 text-stone">No reports match your search.</p>
      ) : (
        <ul className="mt-6 divide-y hairline rounded-2xl border hairline bg-paper">
          {reports.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-cream/30 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/report/${r.id}`}
                  className="block truncate font-display text-lg text-ink transition-colors hover:text-brass"
                >
                  {r.headline || "Style report"}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone">
                  <span>{formatDate(r.createdAt)}</span>
                  {r.userEmail && (
                    <>
                      <span className="text-stone-soft/60" aria-hidden>
                        ·
                      </span>
                      <span className="truncate">{r.userEmail}</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ReportFeedbackStars rating={r.feedbackRating} />
                  {r.feedbackComment ? (
                    <span
                      className="max-w-md truncate text-xs text-stone-soft"
                      title={r.feedbackComment}
                    >
                      “{r.feedbackComment}”
                    </span>
                  ) : r.feedbackRating != null ? (
                    <span className="text-xs text-stone-soft">No written review</span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-full border hairline bg-cream/40 px-2.5 py-0.5 text-[11px] text-stone">
                  {tierLabel(r.tier)}
                </span>
                {r.isPublic && (
                  <span className="rounded-full border hairline bg-cream/40 px-2.5 py-0.5 text-[11px] text-stone">
                    Public
                  </span>
                )}
                <StatusBadge status={r.status} />
                <Link
                  href={`/report/${r.id}`}
                  className="rounded-full border border-brass/40 bg-brass/5 px-4 py-1.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
                >
                  Open →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border hairline px-4 py-2 text-stone transition-colors hover:text-ink disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-stone">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border hairline px-4 py-2 text-stone transition-colors hover:text-ink disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
