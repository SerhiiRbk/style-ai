"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function TrashIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/**
 * Owner-only "delete this report" control with an inline confirm step.
 * `tone` adapts the styling to dark headers vs light list rows.
 * `variant="compact"` — small icon control for list rows (next to the date).
 */
export function DeleteReportButton({
  reportId,
  tone = "light",
  variant = "default",
  redirectTo,
}: {
  reportId: string;
  tone?: "dark" | "light";
  variant?: "default" | "compact";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not delete report");
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete report");
      setBusy(false);
    }
  }

  const base =
    tone === "dark"
      ? "border-paper/25 text-paper/70 hover:bg-paper hover:text-ink"
      : "border-line text-stone hover:border-red-300 hover:bg-red-50 hover:text-red-800";

  if (variant === "compact") {
    if (!confirming) {
      return (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="Delete report"
          aria-label="Delete report"
          className="inline-flex items-center gap-1 rounded-md p-1 text-stone-soft transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <TrashIcon />
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-stone">
        <TrashIcon className="h-3 w-3 text-red-600/80" />
        <span>Delete?</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="rounded border border-red-200 bg-red-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "…" : "Yes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="rounded px-1 py-0.5 text-[10px] text-stone-soft hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
        {error ? <span className="text-red-500">{error}</span> : null}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`rounded-full border px-4 py-2 text-sm transition-colors ${base}`}
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-xs ${tone === "dark" ? "text-paper/70" : "text-stone"}`}
      >
        Delete permanently?
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="rounded-full border border-red-300 bg-red-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-700 disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(false)}
        className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60 ${
          tone === "dark"
            ? "border-paper/25 text-paper/80 hover:bg-paper/10"
            : "border-line text-stone hover:bg-cream/60"
        }`}
      >
        Cancel
      </button>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </div>
  );
}
