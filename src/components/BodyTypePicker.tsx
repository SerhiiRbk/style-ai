"use client";

import Image from "next/image";
import { BODY_TYPE_LABELS as LABELS, type BodyTypeId } from "@/lib/style-profile";

/** Plain-language cue for each body type, shown under the label in the picker. */
const BODY_TYPE_DESC: Record<BodyTypeId, string> = {
  rectangle: "Shoulders, waist & hips in line",
  trapezoid: "Broad shoulders, trim waist",
  triangle: "Hips wider than shoulders",
  "inverted-triangle": "Shoulders wider than hips",
  hourglass: "Balanced shoulders & hips, defined waist",
  oval: "Fuller through the midsection",
};

/** Cache-bust when regenerating silhouette assets. */
const BODY_V = "5";

const BODY_IMAGES: Record<BodyTypeId, string> = {
  rectangle: `/images/swatches/body/rectangle.webp?v=${BODY_V}`,
  trapezoid: `/images/swatches/body/trapezoid.webp?v=${BODY_V}`,
  triangle: `/images/swatches/body/triangle.webp?v=${BODY_V}`,
  "inverted-triangle": `/images/swatches/body/inverted-triangle.webp?v=${BODY_V}`,
  hourglass: `/images/swatches/body/hourglass.webp?v=${BODY_V}`,
  oval: `/images/swatches/body/oval.webp?v=${BODY_V}`,
};

const SETS: Record<string, BodyTypeId[]> = {
  male: ["rectangle", "trapezoid", "triangle", "inverted-triangle", "oval"],
  female: ["hourglass", "rectangle", "triangle", "inverted-triangle", "oval"],
  "non-binary": [
    "rectangle",
    "triangle",
    "inverted-triangle",
    "hourglass",
    "oval",
  ],
};

/** Read-only silhouette + label, for displaying a chosen body type in reports. */
export function BodyTypeFigure({
  id,
  className = "h-28 w-20",
}: {
  id: BodyTypeId;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center text-ink">
      <div
        className={`relative overflow-hidden rounded-xl border border-line/80 bg-[#F7F3EC] ${className}`}
      >
        <Image
          src={BODY_IMAGES[id]}
          alt=""
          fill
          sizes="80px"
          className="object-contain object-top p-0.5"
        />
      </div>
      <span className="mt-1.5 text-[11px] tracking-wide text-stone">
        {LABELS[id]}
      </span>
    </div>
  );
}

/**
 * Premium body-type picker: tall lookbook chips with solid ink silhouettes
 * (same visual language as hair/eye colour swatches).
 */
export function BodyTypePicker({
  gender,
  value,
  onChange,
}: {
  gender: string;
  value: BodyTypeId | "";
  onChange: (v: BodyTypeId) => void;
}) {
  const ids = SETS[gender] ?? SETS.male;
  return (
    <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ids.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            title={`${LABELS[id]} — ${BODY_TYPE_DESC[id]}`}
            className="group flex w-full min-w-0 flex-col items-center gap-2"
          >
            <span
              className={`relative block aspect-[3/5] w-full overflow-hidden rounded-xl border bg-[#F7F3EC] transition-all duration-300 ${
                active
                  ? "border-brass shadow-[0_10px_28px_-14px_rgba(0,0,0,0.45)] ring-2 ring-brass/35"
                  : "border-line/80 hover:border-ink/30"
              }`}
            >
              <Image
                src={BODY_IMAGES[id]}
                alt=""
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 140px"
                className="object-contain object-top p-1.5 transition-transform duration-300 group-hover:scale-[1.02] sm:p-2"
              />
              {active && (
                <span
                  className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-brass to-transparent"
                  aria-hidden
                />
              )}
            </span>
            <span
              className={`font-display text-[14px] leading-none tracking-wide transition-colors sm:text-[15px] ${
                active ? "text-ink" : "text-stone"
              }`}
            >
              {LABELS[id]}
            </span>
            <span
              className={`min-h-[2.25rem] px-0.5 text-center text-[11px] leading-snug tracking-wide transition-colors ${
                active ? "text-stone" : "text-stone-soft"
              }`}
            >
              {BODY_TYPE_DESC[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
