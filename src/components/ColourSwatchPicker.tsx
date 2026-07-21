"use client";

import Image from "next/image";
import {
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type HairColorId,
  type EyeColorId,
} from "@/lib/style-profile";

export type SwatchOption = {
  id: string;
  label: string;
  /** Photoreal texture for the chip (hair strands / iris). */
  image?: string;
  /** Fallback CSS fill when no image (legacy / detect chip). */
  css?: string;
  /** Chip aspect: hair is taller, eyes are rounder. */
  shape?: "hair" | "eye";
};

/** Cache-bust when regenerating swatch assets (browser/CDN immutable caches). */
const SWATCH_V = "4";

const HAIR_IMAGES: Record<HairColorId, string> = {
  black: `/images/swatches/hair/black.webp?v=${SWATCH_V}`,
  "dark-brown": `/images/swatches/hair/dark-brown.webp?v=${SWATCH_V}`,
  brown: `/images/swatches/hair/brown.webp?v=${SWATCH_V}`,
  "dark-blonde": `/images/swatches/hair/dark-blonde.webp?v=${SWATCH_V}`,
  "light-blonde": `/images/swatches/hair/light-blonde.webp?v=${SWATCH_V}`,
  auburn: `/images/swatches/hair/auburn.webp?v=${SWATCH_V}`,
  "bright-red": `/images/swatches/hair/bright-red.webp?v=${SWATCH_V}`,
  gray: `/images/swatches/hair/gray.webp?v=${SWATCH_V}`,
  other: `/images/swatches/hair/other.webp?v=${SWATCH_V}`,
};

const EYE_IMAGES: Record<EyeColorId, string> = {
  brown: `/images/swatches/eyes/brown.webp?v=${SWATCH_V}`,
  hazel: `/images/swatches/eyes/hazel.webp?v=${SWATCH_V}`,
  amber: `/images/swatches/eyes/amber.webp?v=${SWATCH_V}`,
  green: `/images/swatches/eyes/green.webp?v=${SWATCH_V}`,
  blue: `/images/swatches/eyes/blue.webp?v=${SWATCH_V}`,
  gray: `/images/swatches/eyes/gray.webp?v=${SWATCH_V}`,
  other: `/images/swatches/eyes/other.webp?v=${SWATCH_V}`,
};

/** "From photo" detect chip first, then each labelled hair swatch. */
export const HAIR_SWATCH_OPTIONS: SwatchOption[] = [
  { id: "", label: "From photo", shape: "hair" },
  ...(Object.keys(HAIR_COLOR_LABELS) as HairColorId[]).map((id) => ({
    id,
    label: HAIR_COLOR_LABELS[id],
    image: HAIR_IMAGES[id],
    shape: "hair" as const,
  })),
];

export const EYE_SWATCH_OPTIONS: SwatchOption[] = [
  { id: "", label: "From photo", shape: "eye" },
  ...(Object.keys(EYE_COLOR_LABELS) as EyeColorId[]).map((id) => ({
    id,
    label: EYE_COLOR_LABELS[id],
    image: EYE_IMAGES[id],
    shape: "eye" as const,
  })),
];

/** Kept for any consumers that still import CSS maps. */
export const HAIR_SWATCH_CSS: Record<HairColorId, string> = {
  black: "linear-gradient(145deg,#2b2724,#141210)",
  "dark-brown": "linear-gradient(145deg,#4a2f1d,#2a1810)",
  brown: "linear-gradient(145deg,#7d5132,#553620)",
  "dark-blonde": "linear-gradient(145deg,#c9a06a,#8a6a3e)",
  "light-blonde": "linear-gradient(145deg,#f0e0b8,#d4b87a)",
  auburn: "linear-gradient(145deg,#8a3f24,#5c2414)",
  "bright-red": "linear-gradient(145deg,#c45a28,#9a3518)",
  gray: "linear-gradient(145deg,#dcd9d3,#9b9893)",
  other: "linear-gradient(145deg,#bcb5a9,#8a8275)",
};

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

/**
 * Premium colour picker: vertical hair-texture chips (or circular iris chips)
 * with a quiet "From photo" option — not flat colour dots.
 */
export function ColourSwatchPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SwatchOption[];
}) {
  const detect = options.find((o) => o.id === "");
  const colours = options.filter((o) => o.id !== "");
  const shape = colours[0]?.shape ?? "hair";
  const isHair = shape === "hair";

  return (
    <div className="space-y-3">
      {detect && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-pressed={value === ""}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
            value === ""
              ? "border-brass/50 bg-brass/10 text-ink"
              : "border-line text-stone hover:border-ink/30 hover:text-ink"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              value === "" ? "bg-brass" : "bg-stone-soft"
            }`}
            aria-hidden
          />
          From photo · Auto
        </button>
      )}

      <div className="flex flex-wrap gap-2.5">
        {colours.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={selected}
              title={o.label}
              className={`group flex w-[4.75rem] flex-col items-center gap-1.5 text-center transition-colors sm:w-[5.25rem] ${
                selected ? "text-ink" : "text-stone hover:text-ink"
              }`}
            >
              <span
                className={`relative block w-full overflow-hidden bg-cream/50 transition-all duration-300 ${
                  isHair
                    ? "aspect-[3/4] rounded-xl"
                    : "aspect-square rounded-full"
                } ${
                  selected
                    ? "ring-2 ring-brass ring-offset-2 ring-offset-paper shadow-[0_10px_28px_-14px_rgba(0,0,0,0.45)]"
                    : "ring-1 ring-ink/10 group-hover:ring-ink/25"
                }`}
              >
                {o.image ? (
                  <Image
                    src={o.image}
                    alt=""
                    fill
                    sizes="84px"
                    className="object-cover object-center"
                  />
                ) : (
                  <span
                    className="absolute inset-0"
                    style={o.css ? { background: o.css } : undefined}
                  />
                )}
                {/* Soft vignette so the chip reads as a finish sample, not a photo dump. */}
                <span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/25 via-transparent to-ink/5"
                  aria-hidden
                />
              </span>
              <span
                className={`text-[10px] leading-snug tracking-wide ${
                  selected ? "font-medium text-ink" : "text-stone"
                }`}
              >
                {o.label}
              </span>
              <span
                className={`h-px w-6 transition-opacity duration-300 ${
                  selected
                    ? "bg-brass opacity-100"
                    : "bg-transparent opacity-0"
                }`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
