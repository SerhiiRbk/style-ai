"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, ButtonLink } from "./Button";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import type { ReportGenerationState } from "@/lib/report";

const POLL_MS = 5_000;
const READY_TOAST_MS = 15_000;
const START_EVENT = "valetti:report-generation-started";

type GeneratingResponse = {
  pending: boolean;
  reportId?: string;
  state?: ReportGenerationState;
};

type ReportGenerationNavContextValue = {
  authed: boolean;
  pending: boolean;
  reportId: string | null;
};

const ReportGenerationNavContext =
  createContext<ReportGenerationNavContextValue | null>(null);

function useReportGenerationNav() {
  const ctx = useContext(ReportGenerationNavContext);
  if (!ctx) {
    throw new Error("CreateReportButton must be used within ReportGenerationNavProvider");
  }
  return ctx;
}

export function ReportGenerationNavProvider({
  authed,
  initialPending = null,
  children,
}: {
  authed: boolean;
  initialPending: { reportId: string; pending: boolean } | null;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(initialPending?.pending ?? false);
  const [reportId, setReportId] = useState<string | null>(
    initialPending?.reportId ?? null,
  );
  const [readyNotice, setReadyNotice] = useState<{
    reportId: string;
  } | null>(null);
  const wasPendingRef = useRef(pending);
  const reportIdRef = useRef<string | null>(reportId);

  useEffect(() => {
    reportIdRef.current = reportId;
  }, [reportId]);

  useEffect(() => {
    wasPendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!readyNotice) return;
    const id = window.setTimeout(() => setReadyNotice(null), READY_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [readyNotice]);

  useEffect(() => {
    if (!authed) {
      setPending(false);
      setReportId(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/reports/generating", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as GeneratingResponse;

        const trackingId = reportIdRef.current;
        const wasPending = wasPendingRef.current;
        const nextPending = Boolean(data.pending && data.reportId);
        const nextId = nextPending ? (data.reportId ?? null) : null;

        if (wasPending && !nextPending && trackingId) {
          const statusRes = await fetch(`/api/reports/${trackingId}/status`, {
            cache: "no-store",
          });
          if (statusRes.ok && !cancelled) {
            const status = (await statusRes.json()) as ReportGenerationState;
            if (status.status === "ready" && !status.pending) {
              setReadyNotice({ reportId: trackingId });
            }
          }
        }

        if (cancelled) return;
        wasPendingRef.current = nextPending;
        setPending(nextPending);
        setReportId(nextId);
      } catch {
        /* keep last known state */
      }
    }

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [authed]);

  useEffect(() => {
    function onStarted(e: Event) {
      const detail = (e as CustomEvent<{ reportId?: string }>).detail;
      if (!detail?.reportId) return;
      wasPendingRef.current = true;
      setPending(true);
      setReportId(detail.reportId);
      setReadyNotice(null);
    }

    window.addEventListener(START_EVENT, onStarted);
    return () => window.removeEventListener(START_EVENT, onStarted);
  }, []);

  return (
    <ReportGenerationNavContext.Provider value={{ authed, pending, reportId }}>
      {children}
      {readyNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[60] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border hairline bg-paper px-5 py-4 shadow-[0_12px_40px_rgba(21,18,13,0.14)]"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass">
              ✓
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-ink">Your report is ready</p>
              <p className="mt-1 text-stone">
                Generation finished — open it to review your colours, looks, and
                shopping list.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={`/report/${readyNotice.reportId}`}
                  className="text-sm font-medium text-brass underline-offset-2 hover:underline"
                  onClick={() => setReadyNotice(null)}
                >
                  View report
                </Link>
                <button
                  type="button"
                  className="text-xs text-stone transition-colors hover:text-ink"
                  onClick={() => setReadyNotice(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ReportGenerationNavContext.Provider>
  );
}

export function notifyReportGenerationStarted(reportId: string) {
  window.dispatchEvent(
    new CustomEvent(START_EVENT, { detail: { reportId } }),
  );
}

export function CreateReportButton({
  className = "",
  compact = false,
  label,
  onNavigate,
}: {
  className?: string;
  compact?: boolean;
  /** Override button copy (compact mode defaults to “Create report”). */
  label?: string;
  onNavigate?: () => void;
}) {
  const { authed, pending } = useReportGenerationNav();
  const copy = label ?? (compact ? "Create report" : undefined);

  if (authed && pending) {
    return (
      <Button
        type="button"
        disabled
        aria-disabled
        aria-busy="true"
        className={`!cursor-not-allowed !opacity-70 ${className}`}
      >
        <LuxeSpinner size="xs" tone="paper" className="shrink-0" />
        Report generating
      </Button>
    );
  }

  if (compact || copy) {
    return (
      <ButtonLink href="/start" className={className} onClick={onNavigate}>
        {copy ?? "Create report"}
      </ButtonLink>
    );
  }

  return (
    <ButtonLink href="/start" className={className} onClick={onNavigate}>
      <span className="xl:hidden">Create report</span>
      <span className="hidden xl:inline">Create my report</span>
    </ButtonLink>
  );
}
