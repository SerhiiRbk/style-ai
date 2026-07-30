"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Post-checkout banner driven by the ?checkout= query param:
 *  - success / cancel  → card checkout result (credits granted by the webhook).
 *  - crypto_pending     → crypto invoice opened; polls /api/crypto/status until
 *                         the on-chain payment settles and credits are granted.
 * Cleans the URL on mount.
 */
type BannerState =
  | "success"
  | "cancel"
  | "crypto_pending"
  | "crypto_done"
  | "crypto_failed";

const TERMINAL_OK = new Set(["finished"]);
const TERMINAL_BAD = new Set(["failed", "refunded", "expired"]);

export function CheckoutBanner() {
  const [state, setState] = useState<BannerState | null>(null);
  const paymentIdRef = useRef<string | null>(null);

  // Read the checkout result from the URL once, then clean it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const payment = params.get("payment");

    if (checkout === "success" || checkout === "cancel") {
      setState(checkout);
    } else if (checkout === "crypto_pending" && payment) {
      paymentIdRef.current = payment;
      setState("crypto_pending");
    } else {
      return;
    }

    params.delete("checkout");
    params.delete("pack");
    params.delete("payment");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState(null, "", url);
  }, []);

  // While a crypto payment is pending, poll its status until it settles.
  useEffect(() => {
    if (state !== "crypto_pending") return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      const id = paymentIdRef.current;
      if (!id || !active) return;
      try {
        const res = await fetch(
          `/api/crypto/status?id=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (res.ok && active) {
          const data = (await res.json()) as {
            status?: string;
            credited?: boolean;
          };
          if (data.credited || (data.status && TERMINAL_OK.has(data.status))) {
            setState("crypto_done");
            return;
          }
          if (data.status && TERMINAL_BAD.has(data.status)) {
            setState("crypto_failed");
            return;
          }
        }
      } catch {
        // Network hiccup — keep polling.
      }
      if (active) timer = setTimeout(tick, 6000);
    }

    timer = setTimeout(tick, 6000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [state]);

  if (!state) return null;

  const tone =
    state === "success" || state === "crypto_done"
      ? "bg-brass/15"
      : state === "crypto_failed"
        ? "bg-red-50"
        : "bg-cream/60";

  const message: Record<BannerState, string> = {
    success:
      "Payment received — your credits are being added and will appear in your balance within a few seconds.",
    cancel:
      "Checkout canceled — no charge was made. You can pick a pack whenever you're ready.",
    crypto_pending:
      "Crypto payment pending — waiting for on-chain confirmation. This usually takes a few minutes; your credits will be added automatically once it settles. You can leave this page open.",
    crypto_done:
      "Crypto payment confirmed — credits have been added to your account. Refresh to see your updated balance.",
    crypto_failed:
      "Your crypto payment didn't complete (it expired or failed). No credits were added — you can start a new payment whenever you're ready.",
  };

  return (
    <div className={`border-b hairline ${tone}`} role="status" aria-live="polite">
      <div className="container-luxe flex items-center justify-between gap-4 py-4">
        <p className="flex items-center gap-2 text-sm text-ink">
          {state === "crypto_pending" ? (
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
              aria-hidden
            />
          ) : null}
          {message[state]}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {state === "crypto_done" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-ink px-3 py-1.5 text-xs text-paper hover:bg-ink/90"
            >
              Refresh
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setState(null)}
            className="text-xs uppercase tracking-wider text-stone-soft hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
