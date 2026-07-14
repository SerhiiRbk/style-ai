"use client";

import { CreditsProvider } from "@/components/CreditsContext";
import { TryOnSelectionProvider } from "@/components/TryOnContext";
import { TryOnTray } from "@/components/TryOnTray";
import { TryOnModelPicker } from "@/components/TryOnModelPicker";
import { DisplayCurrencyProvider } from "@/components/CatalogDisplayCurrency";
import { useNavSession } from "@/components/NavSession";

/** Catalog browse + multi-item try-on (no report link). */
export function CatalogTryOnShell({
  children,
  tryOnCost,
}: {
  children: React.ReactNode;
  tryOnCost: number;
}) {
  const { authed, balance } = useNavSession();

  return (
    <DisplayCurrencyProvider>
      <CreditsProvider initialBalance={authed ? balance : null}>
        <TryOnSelectionProvider>
          {authed ? <TryOnModelPicker /> : null}
          {children}
          <TryOnTray cost={tryOnCost} variant="catalog" />
        </TryOnSelectionProvider>
      </CreditsProvider>
    </DisplayCurrencyProvider>
  );
}
