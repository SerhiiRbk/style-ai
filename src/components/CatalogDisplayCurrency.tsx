"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Currency } from "@/lib/currency";

const DEFAULT_CURRENCY: Currency = "USD";

const DisplayCurrencyContext = createContext<Currency>(DEFAULT_CURRENCY);

function isCurrency(value: unknown): value is Currency {
  return value === "EUR" || value === "USD" || value === "CZK" || value === "PLN";
}

function guessCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("Europe/Prague")) return "CZK";
    if (tz.startsWith("Europe/Warsaw")) return "PLN";
    if (tz.startsWith("Europe/")) return "EUR";
  } catch {
    /* fall through */
  }
  return DEFAULT_CURRENCY;
}

/** Resolves visitor display currency on the client (keeps catalog shell static). */
export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) setCurrency(guessCurrency());
    });

    fetch("/api/geo", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && isCurrency(data?.currency)) {
          setCurrency(data.currency);
        }
      })
      .catch(() => {
        /* keep guessed currency */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DisplayCurrencyContext.Provider value={currency}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency(): Currency {
  return useContext(DisplayCurrencyContext);
}
