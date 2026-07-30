"use client";

import { useState } from "react";
import Link from "next/link";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";

/**
 * Starts hosted checkout for a credit pack. Posts to /api/checkout and
 * redirects to the returned URL. Sends unauthenticated users to /login
 * (returning to the packages section). Supports card checkout (`enabled`) and,
 * when `cryptoEnabled`, a "Pay with crypto" option via NOWPayments. When neither
 * rail is available it renders a disabled "coming soon" control.
 */
export function BuyCreditsButton({
  packageId,
  featured,
  enabled,
  cryptoEnabled = false,
}: {
  packageId: string;
  featured?: boolean;
  enabled: boolean;
  cryptoEnabled?: boolean;
}) {
  const [loading, setLoading] = useState<null | "card" | "crypto">(null);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [digitalDeliveryAccepted, setDigitalDeliveryAccepted] = useState(false);

  if (!enabled && !cryptoEnabled) {
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

  async function buy(provider: "card" | "crypto") {
    if (!canBuy || loading) return;
    setLoading(provider);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          termsAccepted: true,
          digitalDeliveryConsent: true,
          ...(provider === "crypto" ? { provider: "crypto" } : {}),
        }),
      });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/pricing#packages")}`;
        return;
      }
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
      setLoading(null);
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
      {enabled ? (
        <button
          type="button"
          onClick={() => buy("card")}
          disabled={loading !== null || !canBuy}
          className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm transition-colors disabled:opacity-60 ${
            featured
              ? "bg-brass text-paper hover:bg-brass/90"
              : "border border-paper/30 text-paper hover:bg-paper/10"
          }`}
        >
          {loading === "card" ? (
            <LuxeWorkingLabel message="Opening secure checkout…" tone="paper" />
          ) : (
            "Buy credits"
          )}
        </button>
      ) : null}
      {cryptoEnabled ? (
        <button
          type="button"
          onClick={() => buy("crypto")}
          disabled={loading !== null || !canBuy}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm transition-colors disabled:opacity-60 ${
            !enabled && featured
              ? "bg-brass text-paper hover:bg-brass/90"
              : "border border-paper/30 text-paper hover:bg-paper/10"
          }`}
        >
          {loading === "crypto" ? (
            <LuxeWorkingLabel message="Opening crypto checkout…" tone="paper" />
          ) : (
            "Pay with crypto"
          )}
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
