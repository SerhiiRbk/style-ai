"use client";

import { useCallback, useState } from "react";

export function ShareReportButton({
  reportId,
  initialIsPublic,
}: {
  reportId: string;
  initialIsPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/report/${reportId}`
      : `/report/${reportId}`;

  const setSharing = useCallback(
    async (next: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports/${reportId}/share`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: next }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "Could not update sharing");
        }
        const payload = (await res.json()) as { isPublic: boolean };
        setIsPublic(payload.isPublic);
        if (payload.isPublic) setOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update sharing");
      } finally {
        setBusy(false);
      }
    },
    [reportId],
  );

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (isPublic) {
            setOpen((v) => !v);
          } else {
            void setSharing(true);
          }
        }}
        className={`rounded-full border px-5 py-2 text-sm transition-colors disabled:opacity-60 ${
          isPublic
            ? "border-brass-soft/60 bg-brass-soft/10 text-paper hover:bg-brass-soft/20"
            : "border-paper/25 text-paper/90 hover:bg-paper hover:text-ink"
        }`}
      >
        {busy ? "Updating…" : isPublic ? "Shared" : "Share my report"}
      </button>

      {open && isPublic ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl border border-paper/15 bg-ink-soft p-4 text-left shadow-xl">
          <p className="text-sm text-paper/80">
            Anyone with this link can view your report. They cannot edit it or
            use try-on.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 truncate rounded-lg border border-paper/15 bg-ink px-3 py-2 text-xs text-paper/90"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="shrink-0 rounded-lg border border-paper/20 px-3 py-2 text-xs text-paper transition-colors hover:bg-paper/10"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void setSharing(false)}
            className="mt-3 text-xs text-paper/50 underline-offset-2 transition-colors hover:text-paper hover:underline disabled:opacity-60"
          >
            Stop sharing
          </button>
          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        </div>
      ) : null}

      {!open && error ? (
        <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
