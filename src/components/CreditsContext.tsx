"use client";

import { createContext, useContext, useState } from "react";

type CreditsValue = {
  /** Current balance, or null when credits don't apply (demo / not signed in). */
  balance: number | null;
  setBalance: (next: number | null) => void;
};

const CreditsContext = createContext<CreditsValue | null>(null);

/**
 * Shares the signed-in user's live credit balance across the report's try-on
 * controls, so spending in one place updates the cost UI everywhere at once.
 */
export function CreditsProvider({
  initialBalance,
  children,
}: {
  initialBalance: number | null;
  children: React.ReactNode;
}) {
  const [balance, setBalance] = useState<number | null>(initialBalance);
  return (
    <CreditsContext.Provider value={{ balance, setBalance }}>
      {children}
    </CreditsContext.Provider>
  );
}

/**
 * Read/update the shared credit balance. Returns a null balance + no-op setter
 * when used outside a provider (e.g. the demo report), so callers never crash.
 */
export function useCredits(): CreditsValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) return { balance: null, setBalance: () => {} };
  return ctx;
}
