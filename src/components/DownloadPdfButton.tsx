"use client";

import { useEffect, useState } from "react";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import { makeT } from "@/lib/i18n/report";
import type { ReportLanguage } from "@/lib/languages";

/**
 * Downloads a report PDF via fetch so we can show a "preparing" indicator while
 * the server generates the file, then dismiss it the moment the download
 * starts. A plain `<a download>` gives no "download started" signal, so the
 * indicator would otherwise hang until a route change that never happens.
 */
export function DownloadPdfButton({
  reportId,
  className,
  children,
  lang,
}: {
  reportId: string;
  className?: string;
  children?: React.ReactNode;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleDownload() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`);
      if (!res.ok) throw new Error(`PDF request failed (${res.status})`);

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] ?? `styleai-report-${reportId}.pdf`;

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
        className={className}
      >
        {children ?? tt("Download PDF")}
      </button>
      {loading ? <PreparingPill message={tt("Preparing your PDF…")} /> : null}
      {error ? <PreparingPill message={error} tone="error" /> : null}
    </>
  );
}

function PreparingPill({
  message,
  tone = "loading",
}: {
  message: string;
  tone?: "loading" | "error";
}) {
  return (
    <>
      {tone === "loading" ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px] overflow-hidden bg-line/30"
          aria-hidden
        >
          <div className="h-full w-full animate-luxe-progress bg-gradient-to-r from-transparent via-brass to-brass-soft" />
        </div>
      ) : null}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[119] flex justify-center px-4">
        <p className="inline-flex items-center gap-2.5 rounded-full border hairline bg-paper/95 px-4 py-2 text-[11px] tracking-wide text-stone shadow-sm backdrop-blur-md animate-rise">
          {tone === "loading" ? <LuxeSpinner size="xs" tone="brass" /> : null}
          {message}
        </p>
      </div>
    </>
  );
}
