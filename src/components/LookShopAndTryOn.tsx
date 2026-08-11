"use client";

import { useMemo, useState } from "react";
import { ShopTheLook } from "./StyleGuides";
import { LookTryOn } from "./LookTryOn";
import type { ShoppingItem } from "@/lib/report";
import type { Currency } from "@/lib/currency";
import type { ReportLanguage } from "@/lib/languages";

/**
 * Per-look "Shop a look like this" + "Try it on me", sharing selection state:
 * every item is included by default, but the user can toggle items off so only
 * the chosen pieces are rendered when they (re)generate the try-on. Capsules do
 * not use this — they try on their fixed combo pieces.
 */
export function LookShopAndTryOn({
  items,
  currency,
  lang,
  canTryOn,
  reportId,
  title,
  description,
  palette,
  lookIndex,
}: {
  items: ShoppingItem[];
  currency: Currency;
  lang?: ReportLanguage;
  canTryOn: boolean;
  reportId: string;
  title: string;
  description: string;
  palette?: string[];
  lookIndex: number;
}) {
  const keyOf = (it: ShoppingItem) => it.productId ?? it.title;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.map(keyOf)),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Only offer selection when there are items AND the user can try on.
  const selectable = canTryOn && items.length > 0;
  const selectedProductIds = useMemo(() => [...selected], [selected]);

  return (
    <>
      <ShopTheLook
        items={items}
        currency={currency}
        lang={lang}
        selectable={selectable}
        selectedIds={selected}
        onToggle={toggle}
      />
      {canTryOn ? (
        <div className="mt-4">
          <LookTryOn
            reportId={reportId}
            title={title}
            description={description}
            palette={palette}
            lookIndex={lookIndex}
            selectedProductIds={items.length ? selectedProductIds : undefined}
            requireSelection={items.length > 0}
          />
        </div>
      ) : null}
    </>
  );
}
