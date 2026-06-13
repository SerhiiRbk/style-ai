"use client";

import { useState } from "react";
import Link from "next/link";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";

/**
 * Starts hosted checkout for a credit pack. Posts to /api/checkout and
 * redirects to the returned URL. Sends unauthenticated users to /login
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [digitalDeliveryAccepted, setDigitalDeliveryAccepted] = useState(false);

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

  const canBuy = termsAccepted && digitalDeliveryAccepted;

  async function buy() {
    if (!canBuy) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          termsAccepted: true,
          digitalDeliveryConsent: true,
        }),
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
    <div className="mt-7 space-y-3">
      <label className="flex cursor-pointer items-start gap-2 text-left text-[11px] leading-relaxed text-paper/80">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-brass)]"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="underline hover:text-paper">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-paper">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-left text-[11px] leading-relaxed text-paper/80">
        <input
          type="checkbox"
          checked={digitalDeliveryAccepted}
          onChange={(e) => setDigitalDeliveryAccepted(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-brass)]"
        />
        <span>
          I request immediate delivery of digital credits and content and
          acknowledge that I lose my 14-day EU withdrawal right once delivery
          begins.
        </span>
      </label>
      <button
        type="button"
        onClick={buy}
        disabled={loading || !canBuy}
        className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm transition-colors disabled:opacity-60 ${
          featured
            ? "bg-brass text-paper hover:bg-brass/90"
            : "border border-paper/30 text-paper hover:bg-paper/10"
        }`}
      >
        {loading ? (
          <LuxeWorkingLabel message="Opening secure checkout…" tone="paper" />
        ) : (
          "Buy credits"
        )}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
