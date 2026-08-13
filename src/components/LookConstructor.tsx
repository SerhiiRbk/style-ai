"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LookGarmentGlyph } from "./LookGarmentGlyph";
import { useCredits } from "./CreditsContext";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import {
  colorsForSlot,
  colorLabel,
  composeLookDescription,
  slotsEqual,
  slotsFromLook,
  typeLabel,
  typesForSlot,
  type ConstructorSlot,
} from "@/lib/look-constructor";

export type ConstructedLook = {
  image: string;
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
  const cost = CREDIT_COSTS.look_regen;
  const { balance, setBalance } = useCredits();
  const initial = useMemo(
    () => slotsFromLook(title, description),
    [title, description],
  );
  const [slots, setSlots] = useState<ConstructorSlot[]>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

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

  async function apply() {
    if (!dirty || insufficient || disabled || state === "loading") return;
    setState("loading");
    setMsg(null);
    onApplyingChange?.(true);
    try {
      const res = await fetch("/api/look-set/construct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, lookIndex, slots }),
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
        title: data.title,
        description: data.description,
        palette: data.palette ?? [],
        items: data.items ?? [],
      });
      setState("idle");
      setOpen(null);
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
          return (
            <button
              key={`${slot.category}-${i}`}
              type="button"
              onClick={() => setOpen(active ? null : i)}
              disabled={state === "loading" || disabled}
              aria-pressed={active}
              title={`${colorLabel(slot.color)} ${typeLabel(slot.category, slot.garment)}`}
              className={`flex w-[4.5rem] flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "border-brass/50 bg-brass/10"
                  : "hairline bg-cream/40 hover:border-ink/20"
              }`}
            >
              <LookGarmentGlyph slot={slot} className="h-12 w-12" />
              <span className="text-[10px] leading-tight text-stone">
                {typeLabel(slot.category, slot.garment)}
              </span>
            </button>
          );
        })}
      </div>

      {open != null && slots[open] ? (
        <SlotEditor
          slot={slots[open]}
          onType={(garment) => patch(open, { garment })}
          onColor={(color) => patch(open, { color })}
        />
      ) : null}

      {dirty ? (
        <p className="mt-3 text-sm text-stone">{preview}</p>
      ) : null}

      <div className="mt-3">
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
                · {cost} credits →
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
              <>Redraws this look · {balance} credits left</>
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

function SlotEditor({
  slot,
  onType,
  onColor,
}: {
  slot: ConstructorSlot;
  onType: (garment: string) => void;
  onColor: (color: string) => void;
}) {
  const types = typesForSlot(slot.category, slot.garment);
  const colors = colorsForSlot(slot.color);

  return (
    <div className="mt-3 rounded-2xl border hairline bg-cream/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-stone-soft">
        {slot.category}
      </p>
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
      <div className="mt-3 flex flex-wrap gap-2">
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
              style={{ backgroundColor: c.hex }}
            >
              <span className="sr-only">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
