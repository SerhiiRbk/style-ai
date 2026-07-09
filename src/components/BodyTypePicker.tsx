"use client";

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

type Shape = { s: number; w: number; h: number };

/** Half-widths (from centre) at shoulder / waist / hip for each body type. */
const SHAPES: Record<BodyTypeId, Shape> = {
  rectangle: { s: 24, w: 23, h: 24 },
  // Athletic: shoulders moderately wider than hips, defined waist.
  trapezoid: { s: 28, w: 21, h: 23 },
  triangle: { s: 19, w: 23, h: 31 },
  // Inverted: shoulders dramatically dominate notably narrow hips.
  "inverted-triangle": { s: 32, w: 20, h: 15 },
  hourglass: { s: 28, w: 15, h: 28 },
  oval: { s: 22, w: 31, h: 23 },
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

const CX = 50;
const Y_SHOULDER = 44;
const Y_WAIST = 86;
const Y_HIP = 106;
const Y_BOTTOM = 134;

function bodyPath({ s, w, h }: Shape): string {
  return [
    `M ${CX - 4} 32`,
    `L ${CX - s} ${Y_SHOULDER}`,
    `C ${CX - s} ${Y_SHOULDER + 14}, ${CX - w} ${Y_WAIST - 14}, ${CX - w} ${Y_WAIST}`,
    `C ${CX - w} ${Y_WAIST + 9}, ${CX - h} ${Y_HIP - 9}, ${CX - h} ${Y_HIP}`,
    `L ${CX - h * 0.82} ${Y_BOTTOM}`,
    `L ${CX + h * 0.82} ${Y_BOTTOM}`,
    `L ${CX + h} ${Y_HIP}`,
    `C ${CX + h} ${Y_HIP - 9}, ${CX + w} ${Y_WAIST + 9}, ${CX + w} ${Y_WAIST}`,
    `C ${CX + w} ${Y_WAIST - 14}, ${CX + s} ${Y_SHOULDER + 14}, ${CX + s} ${Y_SHOULDER}`,
    `L ${CX + 4} 32`,
    "Z",
  ].join(" ");
}

function Silhouette({
  id,
  active,
  className = "h-24 w-full",
}: {
  id: BodyTypeId;
  active: boolean;
  className?: string;
}) {
  const gradientId = `bt-fill-${id}`;
  return (
    <svg
      viewBox="0 0 100 150"
      className={`transition-colors duration-300 ${className} ${
        active ? "text-brass" : "text-stone-soft"
      }`}
      aria-hidden
    >
      {active && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0.08} />
          </linearGradient>
        </defs>
      )}
      <circle
        cx={CX}
        cy={18}
        r={9}
        fill={active ? `url(#${gradientId})` : "none"}
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.6}
        strokeLinejoin="round"
      />
      <path
        d={bodyPath(SHAPES[id])}
        fill={active ? `url(#${gradientId})` : "none"}
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
      <Silhouette id={id} active className={className} />
      <span className="mt-1 text-xs text-stone">{LABELS[id]}</span>
    </div>
  );
}

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
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ids.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`group relative flex flex-col items-center overflow-hidden rounded-2xl border px-3 pb-4 pt-5 text-center transition-all duration-300 ${
              active
                ? "border-brass bg-cream/70 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]"
                : "border-line hover:border-ink/30 hover:bg-cream/30"
            }`}
          >
            <span
              className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-300 ${
                active
                  ? "bg-gradient-to-r from-transparent via-brass to-transparent opacity-100"
                  : "opacity-0"
              }`}
            />
            <div
              className={`flex h-24 w-full items-end justify-center rounded-xl transition-colors duration-300 ${
                active ? "bg-paper/60" : "bg-transparent group-hover:bg-paper/40"
              }`}
            >
              <Silhouette id={id} active={active} className="h-24 w-auto" />
            </div>
            <span
              className={`mt-3 font-display text-[15px] leading-none transition-colors duration-300 ${
                active ? "text-ink" : "text-stone"
              }`}
            >
              {LABELS[id]}
            </span>
            <span
              className={`mt-1.5 text-[10px] leading-snug tracking-wide transition-colors duration-300 ${
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
