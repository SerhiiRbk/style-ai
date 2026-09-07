"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PreparingPill } from "@/components/PreparingPill";
import { makeT } from "@/lib/i18n/report";
import type { ReportLanguage } from "@/lib/languages";

/** While the PDF is locked, ask /status this often whether every image exists. */
const LOCK_POLL_MS = 10_000;

/**
 * Downloads a report PDF via fetch so we can show a "preparing" indicator while
 * the server generates the file, then dismiss it the moment the download
 * starts. A plain `<a download>` gives no "download started" signal, so the
 * indicator would otherwise hang until a route change that never happens.
 *
 * The PDF is a permanent file, so the button stays locked until the server
 * says every image has rendered (`locked` from the page, then its own poll of
 * `/api/reports/:id/status` → `pdfReady`). A 409 from the PDF route re-locks it.
 */
export function DownloadPdfButton({
  reportId,
  className,
  children,
  lang,
  locked: lockedInitial = false,
}: {
  reportId: string;
  className?: string;
  children?: React.ReactNode;
  lang?: ReportLanguage;
  /** Server-computed "not every image is rendered yet" — disables the button. */
  locked?: boolean;
}) {
  const tt = makeT(lang);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(lockedInitial);
  const [error, setError] = useState<string | null>(null);
  const [lockHint, setLockHint] = useState<string | null>(null);

  // The page re-renders with a fresh `locked` after every banner refresh —
  // adopt it during render (React's "adjust state on prop change" pattern), not
  // in an effect, so there is no extra cascading render.
  const [prevLockedInitial, setPrevLockedInitial] = useState(lockedInitial);
  if (lockedInitial !== prevLockedInitial) {
    setPrevLockedInitial(lockedInitial);
    setLocked(lockedInitial);
  }

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!lockHint) return;
    const t = setTimeout(() => setLockHint(null), 5000);
    return () => clearTimeout(t);
  }, [lockHint]);

  // Locked → poll until the server reports the PDF is ready, then unlock and
  // refresh the page so the freshly rendered sections appear too.
  useEffect(() => {
    if (!locked) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { pdfReady?: boolean };
        if (cancelled || data.pdfReady !== true) return;
        setLocked(false);
        router.refresh();
      } catch {
        /* keep locked; next tick retries */
      }
    }
    const id = window.setInterval(poll, LOCK_POLL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [locked, reportId, router]);

  async function handleDownload() {
    if (loading) return;
    if (locked) {
      setLockHint(tt("PDF unlocks when every image has finished rendering."));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`);
      if (res.status === 409) {
        // The server knows better than our last poll — re-lock and explain.
        setLocked(true);
        setLockHint(
          tt("Your report is still being generated — the PDF unlocks when every image is ready."),
        );
        return;
      }
      if (!res.ok) throw new Error(`PDF request failed (${res.status})`);

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename =
        match?.[1] ??
        `valetti-style-report-${new Date().toISOString().slice(0, 10)}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(tt("Couldn't prepare the PDF. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        aria-busy={loading}
        aria-disabled={locked || undefined}
        title={locked ? tt("PDF unlocks when every image has finished rendering.") : undefined}
        className={className}
      >
        {children ?? tt("Download PDF")}
      </button>
      {loading ? <PreparingPill message={tt("Preparing your PDF…")} /> : null}
      {lockHint ? <PreparingPill message={lockHint} /> : null}
      {error ? <PreparingPill message={error} tone="error" /> : null}
    </>
  );
}
