"use client";

import { useEffect, useState } from "react";
import type { SubCurrency } from "@/lib/currency";

/** Deterministic default so SSR and first client render match (no hydration mismatch). */
const DEFAULT_CURRENCY: SubCurrency = "USD";

function isSubCurrency(value: unknown): value is SubCurrency {
  return value === "EUR" || value === "USD";
}

/** Quick, network-free guess from the browser timezone (Europe → EUR). */
function guessSubCurrency(): SubCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("Europe/")) return "EUR";
  } catch {
    /* fall through */
  }
  return DEFAULT_CURRENCY;
}

/**
 * Renders a subscription-currency price on the client so the surrounding page
 * can stay statically rendered (the server can't read geo headers without
 * opting the whole route into dynamic rendering).
 */
export function SubCurrencyPrice({
  prices,
}: {
  prices: Record<SubCurrency, string>;
}) {
  const [currency, setCurrency] = useState<SubCurrency>(DEFAULT_CURRENCY);

  useEffect(() => {
    let cancelled = false;

    // Apply an instant timezone guess in a microtask (keeps the SSR/first
    // render deterministic and avoids a synchronous setState in the effect),
    // then confirm via IP geo.
    queueMicrotask(() => {
      if (!cancelled) setCurrency(guessSubCurrency());
    });

    fetch("/api/geo", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && isSubCurrency(data?.subCurrency)) {
          setCurrency(data.subCurrency);
        }
      })
      .catch(() => {
        /* keep the guessed currency */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{prices[currency]}</>;
}
