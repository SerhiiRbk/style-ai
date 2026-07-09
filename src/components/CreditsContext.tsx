"use client";

import { createContext, useContext, useEffect } from "react";
import { useNavSession } from "@/components/NavSession";

type CreditsValue = {
  /** Current balance, or null when credits don't apply (demo / not signed in). */
  balance: number | null;
  setBalance: (next: number | null) => void;
};

const CreditsContext = createContext<CreditsValue | null>(null);

/**
 * Shares the signed-in user's live credit balance across the report's try-on
 * controls and the global navbar via NavSession.
 */
export function CreditsProvider({
  initialBalance,
  children,
}: {
  initialBalance: number | null;
  children: React.ReactNode;
}) {
  const { balance, setBalance } = useNavSession();

  useEffect(() => {
    if (initialBalance !== null) {
      setBalance(initialBalance);
    }
  }, [initialBalance, setBalance]);

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
