"use client";

import { BODY_TYPE_LABELS as LABELS, type BodyTypeId } from "@/lib/style-profile";

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
  return (
    <svg
      viewBox="0 0 100 150"
      className={`transition-colors ${className} ${
        active ? "text-ink" : "text-stone-soft"
      }`}
      aria-hidden
    >
      <circle
        cx={CX}
        cy={18}
        r={9}
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        d={bodyPath(SHAPES[id])}
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={active ? 0.92 : 1}
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
    <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
      {ids.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`flex flex-col items-center rounded-xl border p-3 transition-colors ${
              active
                ? "border-ink bg-cream/60"
                : "border-line hover:border-ink/40"
            }`}
          >
            <Silhouette id={id} active={active} />
            <span
              className={`mt-1 text-xs ${active ? "text-ink" : "text-stone-soft"}`}
            >
              {LABELS[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
