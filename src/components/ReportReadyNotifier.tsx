"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNavSession } from "@/components/NavSession";

const POLL_MS = 8_000;
const TOAST_TTL_MS = 12_000;
const STORE_KEY = "valetti:notifiedReports";

type FeedReport = {
  id: string;
  headline: string | null;
  status: "processing" | "ready" | "failed";
  generating: boolean;
};

type Toast = { id: string; headline: string | null };

function loadNotified(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistNotified(set: Set<string>) {
  try {
    // Keep the list bounded so it can't grow without limit.
    const arr = Array.from(set).slice(-200);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Global notifier: polls the signed-in user's reports and shows a toast when a
 * report that was generating in the background finishes. Mounted app-wide so the
 * notice appears even after the user navigates away from the report page.
 */
export function ReportReadyNotifier() {
  const { authed, ready } = useNavSession();
  const router = useRouter();
  const pathname = usePathname();

  const prevGenerating = useRef<Set<string>>(new Set());
  const notified = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    notified.current = loadNotified();
  }, []);

  useEffect(() => {
    if (!ready || !authed) return;
    let cancelled = false;

    async function poll() {
      if (document.visibilityState === "hidden") return;
      let reports: FeedReport[] = [];
      try {
        const res = await fetch("/api/reports/generating", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { reports?: FeedReport[] };
        reports = data.reports ?? [];
      } catch {
        return;
      }
      if (cancelled) return;

      const nowGenerating = new Set(
        reports.filter((r) => r.generating).map((r) => r.id),
      );

      // A report that re-enters generation (retry) should be able to notify again.
      let notifiedChanged = false;
      for (const id of nowGenerating) {
        if (notified.current.delete(id)) notifiedChanged = true;
      }

      const completed: FeedReport[] = [];
      if (!firstLoad.current) {
        for (const id of prevGenerating.current) {
          if (nowGenerating.has(id)) continue;
          const r = reports.find((x) => x.id === id);
          if (r && r.status === "ready" && !r.generating) completed.push(r);
        }
      }

      prevGenerating.current = nowGenerating;
      firstLoad.current = false;

      const fresh = completed.filter((r) => !notified.current.has(r.id));
      if (fresh.length) {
        for (const r of fresh) notified.current.add(r.id);
        notifiedChanged = true;
        // Don't toast for the report the user is already viewing.
        const visible = fresh.filter(
          (r) => pathnameRef.current !== `/report/${r.id}`,
        );
        if (visible.length) {
          setToasts((prev) => [
            ...prev,
            ...visible.map((r) => ({ id: r.id, headline: r.headline })),
          ]);
        }
        // Refresh the current route so list statuses / report images update.
        router.refresh();
      }

      if (notifiedChanged) persistNotified(notified.current);
    }

    const interval = window.setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [ready, authed, router]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[130] flex w-[min(92vw,22rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(() => onDismiss(toast.id), TOAST_TTL_MS);
    return () => window.clearTimeout(id);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto animate-rise overflow-hidden rounded-2xl border hairline bg-paper/95 shadow-lg backdrop-blur-md"
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-ink">Your report is ready</p>
          <p className="mt-0.5 truncate text-sm text-stone">
            {toast.headline || "Your style report has finished generating."}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href={`/report/${toast.id}`}
              onClick={() => onDismiss(toast.id)}
              className="text-sm text-brass transition-colors hover:text-ink"
            >
              Open report →
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-stone-soft transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
