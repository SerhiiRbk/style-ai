import type { ColorRec } from "@/lib/report";

/**
 * A luxury hue wheel. Renders a soft 24-segment colour ring and plots the
 * user's recommended colours at their true hue position, so they can see where
 * their palette sits on the spectrum. Pure SVG — safe in a server component.
 */

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 128;
const R_IN = 92;
const SEGMENTS = 24;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, l: 0.6 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function polar(radius: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function sectorPath(a0: number, a1: number) {
  const p1 = polar(R_OUT, a0);
  const p2 = polar(R_OUT, a1);
  const p3 = polar(R_IN, a1);
  const p4 = polar(R_IN, a0);
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${R_OUT} ${R_OUT} 0 0 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${R_IN} ${R_IN} 0 0 1 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Open arc (stroke only) used to mark the analogous range. */
function arcPath(radius: number, a0: number, a1: number) {
  const p0 = polar(radius, a0);
  const p1 = polar(radius, a1);
  return [
    `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 0 0 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
  ].join(" ");
}

export function ColorWheel({ best }: { best: ColorRec[] }) {
  const step = 360 / SEGMENTS;
  const MID = (R_OUT + R_IN) / 2;

  // Hero colour = the most saturated of the palette; harmonies are drawn from it.
  const hero = best
    .map((c) => ({ c, ...hexToHsl(c.hex) }))
    .sort((a, b) => b.s - a.s)[0];
  const heroHue = hero?.h ?? 30;
  const heroPos = polar(MID, heroHue);
  const compHue = (heroHue + 180) % 360;
  const compPos = polar(MID, compHue);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[280px]"
      role="img"
      aria-label="Your colour palette on the hue wheel, with complementary and analogous harmonies"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const hue = i * step;
        return (
          <path
            key={i}
            d={sectorPath(i * step, (i + 1) * step)}
            fill={`hsl(${hue} 42% 62%)`}
            opacity={0.85}
          />
        );
      })}

      {/* Analogous range: a band ±28° around the hero hue. */}
      <path
        d={arcPath(R_OUT + 9, heroHue + 28, heroHue - 28)}
        fill="none"
        stroke="#1c1a17"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.55}
      />

      {/* Complementary axis: hero → opposite hue (centre is covered by the disc). */}
      <line
        x1={heroPos.x}
        y1={heroPos.y}
        x2={compPos.x}
        y2={compPos.y}
        stroke="#1c1a17"
        strokeWidth={1.25}
        strokeDasharray="3 4"
        opacity={0.5}
      />

      {best.map((c, i) => {
        const { h } = hexToHsl(c.hex);
        const pos = polar(MID, h);
        return (
          <g key={`${c.name}-${i}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={13}
              fill={c.hex}
              stroke="#FBF8F2"
              strokeWidth={3}
            />
          </g>
        );
      })}

      {/* Highlight the hero swatch and mark its complementary position. */}
      {hero && (
        <circle
          cx={heroPos.x}
          cy={heroPos.y}
          r={17}
          fill="none"
          stroke="#1c1a17"
          strokeWidth={1.5}
        />
      )}
      <circle
        cx={compPos.x}
        cy={compPos.y}
        r={9}
        fill="#FBF8F2"
        stroke="#1c1a17"
        strokeWidth={1.5}
        strokeDasharray="2 2.5"
      />

      <circle
        cx={CX}
        cy={CY}
        r={R_IN - 4}
        fill="#FBF8F2"
        stroke="#E6E0D6"
        strokeWidth={1}
      />
      <text
        x={CX}
        y={CY - 6}
        textAnchor="middle"
        className="fill-[#9a8f80]"
        style={{ fontSize: 11, letterSpacing: 2 }}
      >
        YOUR
      </text>
      <text
        x={CX}
        y={CY + 16}
        textAnchor="middle"
        className="fill-[#1c1a17]"
        style={{ fontSize: 22, fontFamily: "Georgia, serif" }}
      >
        Palette
      </text>
    </svg>
  );
}
