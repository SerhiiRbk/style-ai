"use client";

import { CreditsProvider } from "@/components/CreditsContext";
import { TryOnSelectionProvider } from "@/components/TryOnContext";
import { TryOnTray } from "@/components/TryOnTray";

/** Catalog browse + multi-item try-on (no report link). */
export function CatalogTryOnShell({
  children,
  initialBalance,
  tryOnCost,
}: {
  children: React.ReactNode;
  initialBalance: number | null;
  tryOnCost: number;
}) {
  return (
    <CreditsProvider initialBalance={initialBalance}>
      <TryOnSelectionProvider>
        {children}
        <TryOnTray cost={tryOnCost} variant="catalog" />
      </TryOnSelectionProvider>
    </CreditsProvider>
  );
}
