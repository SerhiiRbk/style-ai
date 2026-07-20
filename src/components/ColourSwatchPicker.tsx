"use client";

import {
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type HairColorId,
  type EyeColorId,
} from "@/lib/style-profile";

/** Representative hair swatches (CSS gradients — crisp at any DPI, no assets). */
export const HAIR_SWATCH_CSS: Record<HairColorId, string> = {
  black: "linear-gradient(145deg,#2b2724,#141210)",
  "dark-brown": "linear-gradient(145deg,#4a2f1d,#2a1810)",
  brown: "linear-gradient(145deg,#7d5132,#553620)",
  blonde: "linear-gradient(145deg,#ead09a,#c39e5b)",
  red: "linear-gradient(145deg,#aa5630,#7a3318)",
  gray: "linear-gradient(145deg,#dcd9d3,#9b9893)",
  other: "linear-gradient(145deg,#bcb5a9,#8a8275)",
};

/** Iris swatches with a dark pupil centre, approximating each eye colour. */
export const EYE_SWATCH_CSS: Record<EyeColorId, string> = {
  brown:
    "radial-gradient(circle at 50% 50%,#161210 20%,#5a3a22 24%,#7d5132 60%,#2e1c10 100%)",
  hazel:
    "radial-gradient(circle at 50% 50%,#161210 20%,#6e5a2b 24%,#7d8a4a 58%,#4a3a1f 100%)",
  amber:
    "radial-gradient(circle at 50% 50%,#161210 20%,#9a5e1c 24%,#c98a3a 60%,#6b3f10 100%)",
  green:
    "radial-gradient(circle at 50% 50%,#141310 20%,#3f6a3a 24%,#6b9a5a 58%,#2f4a2c 100%)",
  blue:
    "radial-gradient(circle at 50% 50%,#141310 20%,#3f6f9a 24%,#7aa6c9 58%,#2f4f72 100%)",
  gray:
    "radial-gradient(circle at 50% 50%,#141310 20%,#6a7176 24%,#9aa1a6 58%,#566066 100%)",
  other:
    "radial-gradient(circle at 50% 50%,#161210 20%,#8a8275 24%,#bcb5a9 60%,#6a6256 100%)",
};

export type SwatchOption = { id: string; label: string; css?: string };

/** "From photo" detect chip first, then each labelled swatch. */
export const HAIR_SWATCH_OPTIONS: SwatchOption[] = [
  { id: "", label: "From photo" },
  ...(Object.keys(HAIR_COLOR_LABELS) as HairColorId[]).map((id) => ({
    id,
    label: HAIR_COLOR_LABELS[id],
    css: HAIR_SWATCH_CSS[id],
  })),
];

export const EYE_SWATCH_OPTIONS: SwatchOption[] = [
  { id: "", label: "From photo" },
  ...(Object.keys(EYE_COLOR_LABELS) as EyeColorId[]).map((id) => ({
    id,
    label: EYE_COLOR_LABELS[id],
    css: EYE_SWATCH_CSS[id],
  })),
];

/** Visual swatch picker for hair / eye colour. Empty id ("") = detect-from-photo. */
export function ColourSwatchPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SwatchOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id || "detect"}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            title={o.label}
            className={`flex min-w-[4.75rem] max-w-[5.5rem] flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center transition-colors ${
              selected
                ? "border-ink bg-cream/60"
                : "border-line hover:border-ink/40"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                o.css
                  ? "ring-1 ring-black/10"
                  : "border border-dashed border-stone/50"
              } ${selected ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : ""}`}
              style={o.css ? { background: o.css } : undefined}
            >
              {!o.css && (
                <span className="text-[9px] uppercase tracking-wide text-stone-soft">
                  Auto
                </span>
              )}
            </span>
            <span className="text-[10px] leading-snug text-stone">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
