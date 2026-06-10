"use client";

import { useState } from "react";

/**
 * Starts Stripe Checkout for a credit pack. Posts to /api/stripe/checkout and
 * redirects to the returned hosted URL. Sends unauthenticated users to /login
 * (returning to the packages section). When payments aren't configured yet it
 * renders a disabled "coming soon" control.
 */
export function BuyCreditsButton({
  packageId,
  featured,
  enabled,
}: {
  packageId: string;
  featured?: boolean;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title="Checkout is coming soon"
        className="mt-7 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-paper/25 px-5 py-3 text-sm text-paper/60"
      >
        Checkout coming soon
      </button>
    );
  }

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/pricing#packages")}`;
        return;
      }
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={buy}
        disabled={loading}
        className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm transition-colors disabled:opacity-60 ${
          featured
            ? "bg-brass text-paper hover:bg-brass/90"
            : "border border-paper/30 text-paper hover:bg-paper/10"
        }`}
      >
        {loading ? "Redirecting…" : "Buy credits"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
