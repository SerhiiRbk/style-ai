"use client";

import {
  CatalogProductCard,
  type CatalogProduct,
} from "@/components/CatalogProductCard";
import { useDisplayCurrency } from "@/components/CatalogDisplayCurrency";
import { useNavSession } from "@/components/NavSession";

export function CatalogProductGrid({ products }: { products: CatalogProduct[] }) {
  const currency = useDisplayCurrency();
  const { authed } = useNavSession();

  return (
    <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <CatalogProductCard
          key={p.id}
          product={p}
          currency={currency}
          canTryOn={authed}
        />
      ))}
    </div>
  );
}
