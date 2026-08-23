"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatOfferPrice, type Currency } from "@/lib/currency";
import { humanizeProductTitle } from "@/lib/product-title";
import { makeT } from "@/lib/i18n/report";
import type { ReportLanguage } from "@/lib/languages";
import type { ShoppingItem } from "@/lib/report";
import { lookItemKey } from "@/lib/look-item-alts";
import { StaticFillImg } from "./StyleGuides";

function Thumb({ item, size = "sm" }: { item: ShoppingItem; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-12 w-12 rounded-lg" : "h-7 w-7 rounded-full";
  return (
    <span className={`relative shrink-0 overflow-hidden bg-sand ${box}`}>
      {item.image ? (
        <StaticFillImg
          src={item.image}
          alt={item.title}
          sizes={size === "md" ? "48px" : "28px"}
        />
      ) : (
        <span className="block h-full w-full" style={{ background: item.color }} />
      )}
    </span>
  );
}

export function LookShopChips({
  items,
  currency,
  lang,
  selectable = false,
  selectedIds,
  onToggle,
  swappable = false,
  onNeedAlternatives,
  onChooseAlternative,
}: {
  items: ShoppingItem[];
  currency: Currency;
  lang?: ReportLanguage;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  swappable?: boolean;
  onNeedAlternatives?: (item: ShoppingItem) => Promise<ShoppingItem[]>;
  onChooseAlternative?: (fromId: string, alt: ShoppingItem) => void | Promise<void>;
}) {
  const tt = makeT(lang);
  if (!items.length) return null;
  const showAlternativesNote =
    items.some((it) => it.similarPick) || items.length < 3;
  return (
    <div className="mt-4 border-t hairline pt-4">
      <div className="text-[11px] uppercase tracking-wider text-stone-soft">
        {tt("Shop a look like this")}
      </div>
      {showAlternativesNote ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-soft">
          {tt(
            "Stylistic alternatives from our catalogue — close in category and colour, not necessarily the exact pieces in the photo.",
          )}
        </p>
      ) : null}
      {selectable ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-soft">
          {tt("Toggle items to choose what’s included when you try this on.")}
        </p>
      ) : null}
      {swappable ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-stone-soft">
          {tt("Tap a piece to pick another from the catalogue.")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => {
          const id = lookItemKey(it);
          const on = !selectable || (selectedIds?.has(id) ?? true);
          return (
            <ShopChip
              key={id}
              item={it}
              on={on}
              selectable={selectable}
              swappable={swappable}
              currency={currency}
              lang={lang}
              onToggle={onToggle}
              onNeedAlternatives={onNeedAlternatives}
              onChooseAlternative={onChooseAlternative}
            />
          );
        })}
      </div>
    </div>
  );
}

function ShopChip({
  item,
  on,
  selectable,
  swappable,
  currency,
  lang,
  onToggle,
  onNeedAlternatives,
  onChooseAlternative,
}: {
  item: ShoppingItem;
  on: boolean;
  selectable: boolean;
  swappable: boolean;
  currency: Currency;
  lang?: ReportLanguage;
  onToggle?: (id: string) => void;
  onNeedAlternatives?: (item: ShoppingItem) => Promise<ShoppingItem[]>;
  onChooseAlternative?: (fromId: string, alt: ShoppingItem) => void | Promise<void>;
}) {
  const tt = makeT(lang);
  const id = lookItemKey(item);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [alts, setAlts] = useState(item.alternatives ?? []);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setAlts(item.alternatives ?? []);
  }, [id, item.alternatives]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || alts.length || !onNeedAlternatives) return;
    let cancelled = false;
    setLoading(true);
    onNeedAlternatives(item)
      .then((next) => {
        if (!cancelled) setAlts(next);
      })
      .catch(() => {
        if (!cancelled) setAlts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Fetch once when the picker opens — parent callbacks are not stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`group flex items-center gap-2 rounded-full border bg-paper py-1 pr-3 transition-colors ${
          selectable ? "pl-2" : "pl-1"
        } ${on ? "border-line hover:border-ink/30" : "border-line/60 opacity-50"}`}
      >
        {selectable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={
              on ? tt("Included in try-on") : tt("Excluded from try-on")
            }
            onClick={() => onToggle?.(id)}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none transition-colors ${
              on
                ? "border-brass/40 bg-brass/10 text-brass"
                : "border-line bg-paper text-transparent"
            }`}
          >
            ✓
          </button>
        ) : null}
        {swappable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            <Thumb item={item} />
            <span className="text-xs text-ink">
              {humanizeProductTitle(item.title)}
            </span>
          </button>
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="flex items-center gap-2"
          >
            <Thumb item={item} />
            <span className="text-xs text-ink">
              {humanizeProductTitle(item.title)}
            </span>
          </a>
        )}
        {item.similarPick ? (
          <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone">
            {tt("Similar")}
          </span>
        ) : null}
        <span className="text-xs text-stone-soft">
          {formatOfferPrice({
            priceEur: item.priceEur,
            displayCurrency: currency,
            offerCurrency: item.currency,
            priceNative: item.priceNative,
          })}
        </span>
      </div>
      {swappable && open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={tt("Choose an alternative")}
          className="absolute left-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border hairline bg-paper p-2 shadow-lg"
        >
          <p className="px-1 pb-1 text-[11px] uppercase tracking-wider text-stone-soft">
            {tt("Choose an alternative")}
          </p>
          <AltRow
            item={item}
            currency={currency}
            current
            shopLabel={tt("Shop this piece")}
          />
          {loading ? (
            <p className="px-1 py-2 text-xs text-stone-soft">
              {tt("Loading alternatives…")}
            </p>
          ) : alts.length ? (
            alts.map((alt) => (
              <AltRow
                key={lookItemKey(alt)}
                item={alt}
                currency={currency}
                useLabel={tt("Use this")}
                busy={busyId === lookItemKey(alt)}
                onUse={async () => {
                  setBusyId(lookItemKey(alt));
                  try {
                    await onChooseAlternative?.(id, alt);
                    setOpen(false);
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            ))
          ) : (
            <p className="px-1 py-2 text-xs text-stone-soft">
              {tt("No alternatives for this piece yet")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AltRow({
  item,
  currency,
  current,
  shopLabel,
  useLabel,
  busy,
  onUse,
}: {
  item: ShoppingItem;
  currency: Currency;
  current?: boolean;
  shopLabel?: string;
  useLabel?: string;
  busy?: boolean;
  onUse?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-1 py-1.5 ${
        current ? "bg-cream/60" : ""
      }`}
    >
      <Thumb item={item} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink">
          {humanizeProductTitle(item.title)}
        </p>
        <p className="text-[11px] text-stone-soft">
          {formatOfferPrice({
            priceEur: item.priceEur,
            displayCurrency: currency,
            offerCurrency: item.currency,
            priceNative: item.priceNative,
          })}
        </p>
      </div>
      {current ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="shrink-0 text-[11px] text-brass underline-offset-2 hover:underline"
        >
          {shopLabel}
        </a>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onUse}
          className="shrink-0 rounded-full border hairline px-2 py-0.5 text-[11px] text-ink disabled:opacity-50"
        >
          {useLabel}
        </button>
      )}
    </div>
  );
}
