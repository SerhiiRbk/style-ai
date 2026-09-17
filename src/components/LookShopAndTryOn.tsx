"use client";

import { useEffect, useMemo, useState } from "react";
import { LookShopChips } from "./LookShopChips";
import { LookTryOn } from "./LookTryOn";
import type { ShoppingItem } from "@/lib/report";
import type { Currency } from "@/lib/currency";
import type { ReportLanguage } from "@/lib/languages";
import { lookItemKey } from "@/lib/look-item-alts";

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
  setId,
  title,
  description,
  palette,
  lookIndex,
  resetStoredTryOn = false,
}: {
  items: ShoppingItem[];
  currency: Currency;
  lang?: ReportLanguage;
  canTryOn: boolean;
  /** One of reportId / setId identifies the try-on's context. */
  reportId?: string;
  setId?: string;
  title: string;
  description: string;
  palette?: string[];
  lookIndex: number;
  /** After constructor Apply, drop the previous try-on (it was a different outfit). */
  resetStoredTryOn?: boolean;
}) {
  const keyOf = (it: ShoppingItem) => lookItemKey(it);
  const incomingKey = items.map(keyOf).join("|");
  const [shopItems, setShopItems] = useState(items);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.map(keyOf)),
  );
  useEffect(() => {
    setShopItems(items);
    setSelected(new Set(items.map(keyOf)));
  }, [incomingKey]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const persistShop = async (body: {
    productId: string;
    nextProductId?: string;
  }) => {
    const res = await fetch("/api/look-shop/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId,
        reportId,
        lookIndex,
        ...body,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(err?.error ?? "Could not update the shop item");
    }
    return (await res.json()) as { items: ShoppingItem[] };
  };

  const swappable = Boolean(canTryOn && (setId || reportId));

  // Only offer selection when there are items AND the user can try on.
  const selectable = canTryOn && shopItems.length > 0;
  const selectedProductIds = useMemo(() => [...selected], [selected]);

  return (
    <>
      <LookShopChips
        items={shopItems}
        currency={currency}
        lang={lang}
        selectable={selectable}
        selectedIds={selected}
        onToggle={toggle}
        swappable={swappable}
        onNeedAlternatives={
          swappable
            ? async (item) => {
                if (item.alternatives?.length) return item.alternatives;
                const data = await persistShop({ productId: keyOf(item) });
                setShopItems(data.items);
                return (
                  data.items.find((i) => keyOf(i) === keyOf(item))
                    ?.alternatives ?? []
                );
              }
            : undefined
        }
        onChooseAlternative={
          swappable
            ? async (fromId, alt) => {
                const data = await persistShop({
                  productId: fromId,
                  nextProductId: keyOf(alt),
                });
                setShopItems(data.items);
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(fromId)) {
                    next.delete(fromId);
                    next.add(keyOf(alt));
                  }
                  return next;
                });
              }
            : undefined
        }
      />
      {canTryOn ? (
        <div className="mt-4">
          <LookTryOn
            reportId={reportId}
            setId={setId}
            title={title}
            description={description}
            palette={palette}
            lookIndex={lookIndex}
            selectedProductIds={
              shopItems.length ? selectedProductIds : undefined
            }
            requireSelection={shopItems.length > 0}
            resetStoredTryOn={resetStoredTryOn}
          />
        </div>
      ) : null}
    </>
  );
}
