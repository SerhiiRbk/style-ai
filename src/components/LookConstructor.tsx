"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { LookGarmentGlyph } from "./LookGarmentGlyph";
import { useCredits } from "./CreditsContext";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import {
  coerceEyewearShape,
  coerceHatType,
  coerceLensColor,
  coerceTieType,
  colorsForSlot,
  colorLabel,
  composeLookDescription,
  isEyewear,
  isSlotEnabled,
  isHat,
  isSunglasses,
  isTie,
  HAT_TYPES,
  hatTypeLabel,
  isTuckable,
  lensColorLabel,
  lensColorsForSlot,
  MAX_ACCESSORY_SLOTS,
  nextAccessorySlot,
  shapeLabel,
  shapesForEyewear,
  slotsEqual,
  slotsFromLook,
  TIE_TYPES,
  tieTypeLabel,
  tuckLabel,
  TUCK_OPTIONS,
  typeLabel,
  typesForSlot,
  type ConstructorSlot,
} from "@/lib/look-constructor";

export type ConstructedLook = {
  image: string;
  imageTq?: string | null;
  title: string;
  description: string;
  palette: string[];
  items: import("@/lib/report").ShoppingItem[];
};

/**
 * Edit a look's garment slots (type + colour) and re-render that look image.
 * Source of truth is the look description, not catalogue SKUs.
 */
export function LookConstructor({
  setId,
  lookIndex,
  title,
  description,
  disabled,
  onApplied,
  onApplyingChange,
}: {
  setId: string;
  lookIndex: number;
  title: string;
  description: string;
  disabled?: boolean;
  onApplied: (look: ConstructedLook) => void;
  onApplyingChange?: (busy: boolean) => void;
}) {
  const [includeThreeQuarter, setIncludeThreeQuarter] = useState(false);
  const cost =
    CREDIT_COSTS.look_regen +
    (includeThreeQuarter ? CREDIT_COSTS.look_three_quarter : 0);
  const { balance, setBalance } = useCredits();
  const initial = useMemo(
    () => slotsFromLook(title, description),
    [title, description],
  );
  const [slots, setSlots] = useState<ConstructorSlot[]>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSlots(initial);
  }, [initial]);

  const dirty = !slotsEqual(slots, initial);
  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;
  const preview = composeLookDescription(slots);

  if (!initial.length) return null;

  function patch(index: number, next: Partial<ConstructorSlot>) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...next } : s)),
    );
  }

  function addAccessory() {
    const extra = nextAccessorySlot(slots);
    if (!extra) return;
    const accessoryCount = slots.filter((s) => s.category === "Accessories").length;
    if (accessoryCount >= MAX_ACCESSORY_SLOTS) return;
    setSlots((prev) => [...prev, extra]);
    setOpen(slots.length);
  }

  async function apply() {
    if (!dirty || insufficient || disabled || state === "loading") return;
    setState("loading");
    setMsg(null);
    onApplyingChange?.(true);
    try {
      const res = await fetch("/api/look-set/construct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          lookIndex,
          slots,
          includeThreeQuarter,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not apply the look");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      onApplied({
        image: data.image,
        imageTq: data.imageTq ?? null,
        title: data.title,
        description: data.description,
        palette: data.palette ?? [],
        items: data.items ?? [],
      });
      setState("idle");
      setOpen(null);
      setMsg(
        data.threeQuarterFailed
          ? "Look updated. 3/4 view could not be generated — use Generate 3/4 on the look."
          : null,
      );
    } catch {
      setState("error");
      setMsg("Could not apply the look");
    } finally {
      onApplyingChange?.(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-soft">
        Constructor
      </p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot, i) => {
          const active = open === i;
          const enabled = isSlotEnabled(slot);
          return (
            <button
              key={`${slot.category}-${slot.garment}-${i}`}
              type="button"
              onClick={() => {
                const nextOpen = active ? null : i;
                if (
                  nextOpen != null &&
                  slot.category === "Accessories" &&
                  !enabled
                ) {
                  patch(i, { on: true });
                }
                setOpen(nextOpen);
              }}
              disabled={state === "loading" || disabled}
              aria-pressed={active}
              title={`${enabled ? "" : "Off · "}${colorLabel(slot.color)} ${slot.lensColor ? `${lensColorLabel(slot.lensColor)} lens ` : ""}${slot.shape ? `${shapeLabel(slot.shape)} ` : ""}${slot.hatType ? `${hatTypeLabel(slot.hatType)} ` : ""}${slot.tieType ? `${tieTypeLabel(slot.tieType)} ` : ""}${slot.tuck ? `${tuckLabel(slot.tuck)} ` : ""}${typeLabel(slot.category, slot.garment)}`}
              className={`flex w-[4.5rem] flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "border-brass/50 bg-brass/10"
                  : "hairline bg-cream/40 hover:border-ink/20"
              } ${enabled ? "" : "opacity-45"}`}
            >
              <LookGarmentGlyph slot={slot} className="h-12 w-12" />
              <span className="text-[10px] leading-tight text-stone">
                {typeLabel(slot.category, slot.garment)}
              </span>
              {!enabled ? (
                <span className="text-[9px] leading-none text-stone-soft">
                  Off
                </span>
              ) : null}
            </button>
          );
        })}
        {slots.filter((s) => s.category === "Accessories").length <
          MAX_ACCESSORY_SLOTS && nextAccessorySlot(slots) ? (
          <button
            type="button"
            onClick={addAccessory}
            disabled={state === "loading" || disabled}
            className="flex w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line p-2 text-center text-stone transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-[10px] leading-tight">Accessory</span>
          </button>
        ) : null}
      </div>

      {open != null && slots[open] ? (
        <SlotEditor
          slot={slots[open]}
          onType={(garment) => {
            const prev = slots[open];
            let color = prev.color;
            let lensColor = prev.lensColor;
            if (isSunglasses(garment)) {
              if (color === "mirrored") {
                lensColor = "mirrored";
                color = "black";
              } else {
                lensColor = coerceLensColor(lensColor);
              }
            } else {
              lensColor = undefined;
              if (color === "mirrored") color = "black";
            }
            patch(open, {
              garment,
              color,
              ...(prev.category === "Accessories" ? { on: true } : {}),
              ...(isEyewear(garment)
                ? { shape: coerceEyewearShape(garment, prev.shape) }
                : { shape: "" }),
              ...(isTuckable(garment) ? { tuck: prev.tuck } : { tuck: undefined }),
              ...(isTie(garment)
                ? { tieType: coerceTieType(prev.tieType) }
                : { tieType: undefined }),
              ...(isHat(garment)
                ? { hatType: coerceHatType(prev.hatType) }
                : { hatType: undefined }),
              lensColor,
            });
          }}
          onColor={(color) =>
            patch(open, {
              color,
              ...(slots[open].category === "Accessories" ? { on: true } : {}),
            })
          }
          onLensColor={
            isSunglasses(slots[open].garment)
              ? (lensColor) => patch(open, { lensColor, on: true })
              : undefined
          }
          onShape={
            isEyewear(slots[open].garment)
              ? (shape) => patch(open, { shape, on: true })
              : undefined
          }
          onTuck={
            isTuckable(slots[open].garment)
              ? (tuck) => patch(open, { tuck })
              : undefined
          }
          onTieType={
            isTie(slots[open].garment)
              ? (tieType) => patch(open, { tieType, on: true })
              : undefined
          }
          onHatType={
            isHat(slots[open].garment)
              ? (hatType) => patch(open, { hatType, on: true })
              : undefined
          }
          onEnabled={
            slots[open].category === "Accessories"
              ? (on) => patch(open, { on })
              : undefined
          }
        />
      ) : null}

      {dirty ? (
        <p className="mt-3 text-sm text-stone">{preview}</p>
      ) : null}

      <div className="mt-3">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-stone">
          <input
            type="checkbox"
            checked={includeThreeQuarter}
            onChange={(e) => setIncludeThreeQuarter(e.target.checked)}
            disabled={state === "loading" || disabled}
            className="h-3.5 w-3.5 rounded border-line accent-ink"
          />
          Also generate 3/4 view
          <span className="text-stone-soft">
            +{CREDIT_COSTS.look_three_quarter} credit
          </span>
        </label>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={!dirty || state === "loading" || insufficient || disabled}
          title={
            insufficient
              ? "Not enough credits — top up to apply"
              : !dirty
                ? "Change a piece or colour first"
                : undefined
          }
          className="inline-flex min-h-[2.25rem] items-center rounded-full border border-brass/30 bg-brass/5 px-4 py-2 text-sm text-brass transition-colors hover:border-brass/50 hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "loading" ? (
            <LuxeWorkingLabel message={WORKING.construct} tone="brass" />
          ) : (
            <>
              Apply
              <span className="text-stone-soft">
                {" "}
                · {cost} credit{cost === 1 ? "" : "s"} →
              </span>
            </>
          )}
        </button>
        {creditsApply ? (
          <p className="mt-1 text-[11px] text-stone-soft">
            {insufficient ? (
              <>
                Not enough credits ({balance} left).{" "}
                <Link href="/pricing" className="text-brass hover:text-ink">
                  Buy credits
                </Link>
              </>
            ) : dirty ? (
              <>
                Redraws this look
                {includeThreeQuarter ? " + 3/4" : ""} · {balance} credits left
              </>
            ) : (
              <>Change a type or colour, then apply</>
            )}
          </p>
        ) : null}
        {msg ? <p className="mt-1 text-xs text-stone-soft">{msg}</p> : null}
      </div>
    </div>
  );
}

function swatchStyle(id: string, hex: string): CSSProperties {
  if (id === "mirrored") {
    return {
      backgroundImage: "linear-gradient(135deg, #E8F2F6, #7EB8C9, #2A4A5C)",
    };
  }
  if (id === "tortoise") {
    return {
      backgroundImage:
        "linear-gradient(135deg, #3E2412 0%, #C4A46A 35%, #5C3317 60%, #1A1008 100%)",
    };
  }
  if (id === "gold") {
    return {
      backgroundImage: "linear-gradient(135deg, #F5E6A8, #C9A227, #8A7014)",
    };
  }
  if (id === "silver") {
    return {
      backgroundImage: "linear-gradient(135deg, #F4F4F4, #C0C4C8, #7A7E84)",
    };
  }
  return { backgroundColor: hex };
}

function SlotEditor({
  slot,
  onType,
  onColor,
  onLensColor,
  onShape,
  onTuck,
  onTieType,
  onHatType,
  onEnabled,
}: {
  slot: ConstructorSlot;
  onType: (garment: string) => void;
  onColor: (color: string) => void;
  onLensColor?: (lensColor: string) => void;
  onShape?: (shape: string) => void;
  onTuck?: (tuck: "in" | "out") => void;
  onTieType?: (tieType: string) => void;
  onHatType?: (hatType: string) => void;
  onEnabled?: (on: boolean) => void;
}) {
  const types = typesForSlot(slot.category, slot.garment);
  const colors = colorsForSlot(slot.color, slot.garment);
  const lenses = onLensColor ? lensColorsForSlot(slot.lensColor) : [];
  const enabled = isSlotEnabled(slot);

  return (
    <div className="mt-3 rounded-2xl border hairline bg-cream/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-stone-soft">
          {slot.category}
        </p>
        {onEnabled ? (
          <button
            type="button"
            onClick={() => onEnabled(!enabled)}
            aria-pressed={enabled}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              enabled
                ? "bg-ink text-paper"
                : "border border-line text-stone hover:border-ink/30 hover:text-ink"
            }`}
          >
            {enabled ? "On look" : "Off"}
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {types.map((t) => {
          const selected = t.id === slot.garment;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onType(t.id)}
              aria-pressed={selected}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selected
                  ? "bg-ink text-paper"
                  : "border border-line text-stone hover:border-ink/30 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {onTuck ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-soft">
            Hem
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TUCK_OPTIONS.map((t) => {
              const selected = t.id === slot.tuck;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTuck(t.id as "in" | "out")}
                  aria-pressed={selected}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selected
                      ? "bg-ink text-paper"
                      : "border border-line text-stone hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {onTieType ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-soft">
            Tie
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TIE_TYPES.map((t) => {
              const selected = t.id === slot.tieType;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTieType(t.id)}
                  aria-pressed={selected}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selected
                      ? "bg-ink text-paper"
                      : "border border-line text-stone hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {onHatType ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-soft">
            Hat
          </p>
          <div className="flex flex-wrap gap-1.5">
            {HAT_TYPES.map((t) => {
              const selected = t.id === slot.hatType;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onHatType(t.id)}
                  aria-pressed={selected}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selected
                      ? "bg-ink text-paper"
                      : "border border-line text-stone hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {onShape ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-soft">
            Shape
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shapesForEyewear(slot.garment).map((s) => {
              const selected = s.id === slot.shape;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onShape(s.id)}
                  aria-pressed={selected}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selected
                      ? "bg-ink text-paper"
                      : "border border-line text-stone hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-soft">
          {isEyewear(slot.garment) ? "Frame" : "Colour"}
        </p>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => {
            const selected = c.id === slot.color;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onColor(c.id)}
                aria-pressed={selected}
                title={c.label}
                className={`h-7 w-7 rounded-full border transition-shadow ${
                  selected
                    ? "border-ink ring-2 ring-brass ring-offset-2 ring-offset-paper"
                    : "border-black/10 hover:border-ink/30"
                }`}
                style={swatchStyle(c.id, c.hex)}
              >
                <span className="sr-only">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {onLensColor ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-soft">
            Lenses
          </p>
          <div className="flex flex-wrap gap-2">
            {lenses.map((c) => {
              const selected = c.id === slot.lensColor;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onLensColor(c.id)}
                  aria-pressed={selected}
                  title={c.label}
                  className={`h-7 w-7 rounded-full border transition-shadow ${
                    selected
                      ? "border-ink ring-2 ring-brass ring-offset-2 ring-offset-paper"
                      : "border-black/10 hover:border-ink/30"
                  }`}
                  style={swatchStyle(c.id, c.hex)}
                >
                  <span className="sr-only">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

