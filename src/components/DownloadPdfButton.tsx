"use client";

import { useEffect, useState } from "react";
import { PreparingPill } from "@/components/PreparingPill";
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
        className={className}
      >
        {children ?? tt("Download PDF")}
      </button>
      {loading ? <PreparingPill message={tt("Preparing your PDF…")} /> : null}
      {error ? <PreparingPill message={error} tone="error" /> : null}
    </>
  );
}
