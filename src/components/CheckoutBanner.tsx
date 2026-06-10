"use client";

import { useEffect, useState } from "react";

/**
 * Shows a success/cancel banner after returning from Stripe Checkout (driven by
 * the ?checkout= query param) and cleans the URL. Credits are granted server-side
 * by the webhook, so success copy notes a short delay before the balance updates.
 */
export function CheckoutBanner() {
  const [state, setState] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success" || checkout === "cancel") {
      setState(checkout);
      params.delete("checkout");
      params.delete("pack");
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : "");
      window.history.replaceState(null, "", url);
    }
  }, []);

  if (!state) return null;

  const success = state === "success";
  return (
    <div
      className={`border-b hairline ${success ? "bg-brass/15" : "bg-cream/60"}`}
      role="status"
    >
      <div className="container-luxe flex items-center justify-between gap-4 py-4">
        <p className="text-sm text-ink">
          {success
            ? "Payment received — your credits are being added and will appear in your balance within a few seconds."
            : "Checkout canceled — no charge was made. You can pick a pack whenever you're ready."}
        </p>
        <button
          type="button"
          onClick={() => setState(null)}
          className="shrink-0 text-xs uppercase tracking-wider text-stone-soft hover:text-ink"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
