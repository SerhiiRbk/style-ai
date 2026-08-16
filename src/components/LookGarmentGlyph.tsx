import { useId, type CSSProperties, type ReactNode } from "react";
import {
  colorHex,
  lensColorHex,
  sneakerSoleColor,
  type ConstructorSlot,
} from "@/lib/look-constructor";

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

/** Blend a hex toward a target colour — keeps the chosen colour recognisable. */
function mix(hex: string, target: [number, number, number], amt: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const channels = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  return `#${channels
    .map((c, i) =>
      Math.round(c + (target[i]! - c) * amt)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Hairline detail drawn on top of the garment body — contrasts with the fill. */
function Line({ d, w = 1 }: { d: string; w?: number }) {
  return <path d={d} fill="none" stroke="var(--glyph-detail)" strokeWidth={w} />;
}

/** Outline that sits on the background (bag handles, frames) — uses the contour. */
function Wire({ d, w = 1.3 }: { d: string; w?: number }) {
  return <path d={d} fill="none" strokeWidth={w} />;
}

/** Translucent depth (hat bands, soles, welts) — works over any colour. */
function Shade({ d, o = 0.16 }: { d: string; o?: number }) {
  return <path d={d} fill={`rgba(18,14,10,${o})`} stroke="none" />;
}

/** Translucent sheen for leather / lacquer highlights. */
function Gloss({ d, o = 0.2 }: { d: string; o?: number }) {
  return <path d={d} fill={`rgba(255,251,244,${o})`} stroke="none" />;
}

/** Soft contact shadow so footwear sits on a surface rather than floating. */
function Ground({ cx = 33, cy = 52.4, rx = 23 }: { cx?: number; cy?: number; rx?: number }) {
  return (
    <ellipse cx={cx} cy={cy} rx={rx} ry="1.9" fill="rgba(18,14,10,0.13)" stroke="none" />
  );
}

function GlyphFrame({
  fill,
  mirrorId,
  sheenId,
  children,
}: {
  fill: string;
  mirrorId: string;
  sheenId: string;
  children: ReactNode;
}) {
  // Contour is a deepened version of the garment colour so the silhouette reads
  // on the light card; interior seams flip to whatever contrasts with the fill.
  const contour = mix(fill, [22, 18, 14], 0.46);
  const detail = isLight(fill) ? "rgba(26,22,18,0.5)" : "rgba(255,247,235,0.46)";
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={mirrorId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F6FCFD" />
          <stop offset="48%" stopColor="#8EC4D4" />
          <stop offset="100%" stopColor="#27414F" />
        </linearGradient>
        {/* One light source across the whole glyph; the middle stop is the
            client's exact colour, so the swatch stays true. */}
        <linearGradient
          id={sheenId}
          gradientUnits="userSpaceOnUse"
          x1="12"
          y1="6"
          x2="52"
          y2="58"
        >
          <stop offset="0%" stopColor={mix(fill, [255, 252, 246], 0.24)} />
          <stop offset="50%" stopColor={fill} />
          <stop offset="100%" stopColor={mix(fill, [26, 22, 18], 0.2)} />
        </linearGradient>
      </defs>
      <g
        fill={`url(#${sheenId})`}
        stroke={contour}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ "--glyph-detail": detail } as CSSProperties}
      >
        {children}
      </g>
    </svg>
  );
}

function eyewearLenses(
  shape: string | undefined,
  outlined: boolean,
  lensFill?: string,
): ReactNode {
  const fill = outlined ? "none" : (lensFill ?? undefined);
  const temples = (
    <>
      <Wire d="M6.6 28.6 C9 28.4 11 28.8 12.4 29.6" />
      <Wire d="M57.4 28.6 C55 28.4 53 28.8 51.6 29.6" />
    </>
  );
  const bridge = <Wire d="M28.6 29.4 C30.4 28.4 33.6 28.4 35.4 29.4" />;
  switch (shape) {
    case "round":
      return (
        <>
          {temples}
          {bridge}
          <circle cx="20" cy="32" r="9.4" fill={fill} />
          <circle cx="44" cy="32" r="9.4" fill={fill} />
          <Gloss d="M14.4 27.6 C17 25 21.6 24.6 24.4 26 C20.6 26.4 17 28.4 15.4 31 Z" o={0.22} />
        </>
      );
    case "aviator":
      return (
        <>
          {temples}
          {bridge}
          <path
            d="M11 25.4 C12 21.4 29 21.4 30 27.4 C30 38 24 43 20 43 C16 43 11 38 11 28 Z"
            fill={fill}
          />
          <path
            d="M34 25.4 C35 21.4 52 21.4 53 27.4 C53 38 47 43 44 43 C40 43 34 38 34 28 Z"
            fill={fill}
          />
          <Gloss d="M13.4 25 C17 23.4 24 23.4 27.4 24.6 C22.6 24.8 17 26.6 14.4 29 Z" o={0.22} />
        </>
      );
    case "rectangle":
      return (
        <>
          {temples}
          {bridge}
          <rect x="10" y="24" width="19" height="15" rx="2.4" fill={fill} />
          <rect x="35" y="24" width="19" height="15" rx="2.4" fill={fill} />
          <Gloss d="M11.6 25.4 H26 L14.6 37.4 H11.6 Z" o={0.16} />
        </>
      );
    case "geometric":
      return (
        <>
          {temples}
          {bridge}
          <path d="M11 24 L30 24 L28 40 L13 40 Z" fill={fill} />
          <path d="M34 24 L53 24 L51 40 L36 40 Z" fill={fill} />
        </>
      );
    case "oval":
      return (
        <>
          {temples}
          {bridge}
          <ellipse cx="20" cy="32" rx="11" ry="7.4" fill={fill} />
          <ellipse cx="44" cy="32" rx="11" ry="7.4" fill={fill} />
        </>
      );
    case "sport":
    case "ski":
      return (
        <>
          <path
            d="M6 31 C8 22 22 20 32 24 C42 20 56 22 58 31 C56 40 44 44 32 40 C20 44 8 40 6 31 Z"
            fill={fill}
          />
          <Line d="M32 24 V40" />
          <Gloss d="M9.6 28 C13.6 24.4 22 23 28 25 C21 25.6 13.6 27.6 10.4 31 Z" o={0.2} />
        </>
      );
    case "rimless":
      return (
        <>
          <Wire d="M6 30 H13" />
          <Wire d="M51 30 H58" />
          <Wire d="M29 30 H35" />
          <circle cx="20" cy="32" r="9" fill="none" strokeWidth="1.3" />
          <circle cx="44" cy="32" r="9" fill="none" strokeWidth="1.3" />
        </>
      );
    case "wayfarer":
    default:
      return (
        <>
          {temples}
          {bridge}
          <path d="M9.4 24.6 C15 23 25.6 22.6 31 23.4 L29 41 C22 41.6 14.6 41 11 40 Z" fill={fill} />
          <path d="M33 23.4 C38.4 22.6 49 23 54.6 24.6 L53 40 C49.4 41 42 41.6 35 41 Z" fill={fill} />
          <Gloss d="M11.6 26 C16 24.8 23 24.4 28 24.6 L27.4 27 C22 26.8 15.6 27.4 12 28.6 Z" o={0.22} />
        </>
      );
  }
}

function hatPaths(hatType?: string): ReactNode {
  switch (hatType) {
    case "baseball":
      return (
        <>
          <path d="M13.6 36.4 C13.6 18.6 47.4 18.6 47.4 36.4 Z" />
          <Line d="M30.5 19.6 V36.2" />
          <Line d="M21.4 21.8 C24.6 26.8 25.6 31.6 25.6 36.2" />
          <Line d="M39.6 21.8 C36.4 26.8 35.4 31.6 35.4 36.2" />
          <circle cx="30.5" cy="19" r="1.5" />
          <Shade d="M13.6 33.4 C21 35.6 40 35.6 47.4 33.4 L47.4 36.4 H13.6 Z" o={0.12} />
          {/* peak drawn last so its contour separates it from the crown */}
          <path d="M40.6 32.4 C49.6 32 57.6 34.6 59.4 38.4 C60 40.4 52.4 41.4 46.6 40.2 C42 39.2 39.6 35.6 40.6 32.4 Z" />
          <Shade d="M40.6 32.4 C49.6 32 57.6 34.6 59.4 38.4 C60 40.4 52.4 41.4 46.6 40.2 C42 39.2 39.6 35.6 40.6 32.4 Z" o={0.16} />
          <Line d="M44 34 C50.6 34.4 55.6 36.6 57.6 39" w={0.85} />
        </>
      );
    case "kartuz":
      return (
        <>
          <path d="M15.4 36.6 C15 21.6 29.6 17.4 39.6 22.4 C45.6 25.4 47.6 31 47.2 36.6 Z" />
          <Line d="M19 27.6 C27 24.4 37 25.4 44.4 30.6" />
          <Shade d="M15.4 33.6 C23 35.8 40 35.8 47.2 33.6 L47.2 36.6 H15.4 Z" o={0.12} />
          <path d="M41 33.6 C48.6 33.2 55.4 35.6 56.8 38.8 C57.2 40.6 50.6 41.2 46 40.2 C42.2 39.4 40.2 36.4 41 33.6 Z" />
          <Shade d="M41 33.6 C48.6 33.2 55.4 35.6 56.8 38.8 C57.2 40.6 50.6 41.2 46 40.2 C42.2 39.4 40.2 36.4 41 33.6 Z" o={0.16} />
        </>
      );
    case "bucket":
      return (
        <>
          <path d="M8.6 33.6 C11.6 42.6 52.4 42.6 55.4 33.6 Z" />
          <Shade d="M8.6 33.6 C11.6 42.6 52.4 42.6 55.4 33.6 Z" o={0.1} />
          <Line d="M11.4 36.4 C18 40.4 46 40.4 52.6 36.4" w={0.85} />
          <path d="M22.6 20.6 C22.6 17.6 41.4 17.6 41.4 20.6 L45.6 33.8 H18.4 Z" />
          <Line d="M22.6 20.6 C22.6 23.4 41.4 23.4 41.4 20.6" />
          <Shade d="M20.4 28.6 H43.6 L45.6 33.8 H18.4 Z" o={0.1} />
        </>
      );
    case "boater":
      return (
        <>
          <ellipse cx="32" cy="36.4" rx="25" ry="5.2" />
          <Shade d="M7 36.4 C7 39.4 57 39.4 57 36.4 C57 39.3 45.8 41.6 32 41.6 C18.2 41.6 7 39.3 7 36.4 Z" o={0.12} />
          <path d="M20.6 36.4 V21 C20.6 18.4 43.4 18.4 43.4 21 V36.4 Z" />
          <Line d="M20.6 21 C20.6 23.6 43.4 23.6 43.4 21" />
          <Shade d="M20.6 29.4 H43.4 V36.2 H20.6 Z" o={0.2} />
          <Line d="M20.6 29.4 H43.4" w={0.85} />
          <Line d="M20.6 35.4 H43.4" w={0.85} />
        </>
      );
    case "kepi":
      return (
        <>
          <path d="M13.6 18.6 C13.6 16.4 46.4 16.4 46.4 18.6 L44 33.4 C44 34.9 16 34.9 16 33.4 Z" />
          <Line d="M13.6 18.6 C13.6 20.9 46.4 20.9 46.4 18.6" />
          <Shade d="M16.6 28.4 C23 30 37 30 43.4 28.4 L44 33.4 C44 34.9 16 34.9 16 33.4 Z" o={0.18} />
          <Line d="M16.6 28.6 C23 30.2 37 30.2 43.4 28.6" w={0.85} />
          <path d="M40.6 31.6 C48.6 31.4 55.6 33.6 57.4 36.8 C58 38.6 51 39.4 46 38.4 C42 37.6 39.6 34.6 40.6 31.6 Z" />
          <Shade d="M40.6 31.6 C48.6 31.4 55.6 33.6 57.4 36.8 C58 38.6 51 39.4 46 38.4 C42 37.6 39.6 34.6 40.6 31.6 Z" o={0.18} />
        </>
      );
    case "peaked":
      return (
        <>
          <path d="M9.6 21.4 C9.6 18.2 50.4 18.2 50.4 21.4 L46 32.4 C46 33.9 14 33.9 14 32.4 Z" />
          <Line d="M9.6 21.4 C9.6 24.6 50.4 24.6 50.4 21.4" />
          <Shade d="M14.8 27.6 C22 29.4 38 29.4 45.2 27.6 L46 32.4 C46 33.9 14 33.9 14 32.4 Z" o={0.22} />
          <Line d="M14.8 27.8 C22 29.6 38 29.6 45.2 27.8" w={0.85} />
          <circle cx="30" cy="30.4" r="2" />
          <path d="M42.6 30.6 C50.6 30.4 58 33 59.8 36.6 C60.4 38.6 52.6 39.6 47 38.4 C42.6 37.4 41.4 33.8 42.6 30.6 Z" />
          <Shade d="M42.6 30.6 C50.6 30.4 58 33 59.8 36.6 C60.4 38.6 52.6 39.6 47 38.4 C42.6 37.4 41.4 33.8 42.6 30.6 Z" o={0.24} />
          <Gloss d="M45.4 32.2 C51.4 32.4 56 34.4 58.2 36.8 C53.6 35 49.4 33.6 45 33.6 Z" o={0.18} />
        </>
      );
    case "fedora":
    case "borsalino":
      return (
        <>
          <ellipse cx="32" cy="34.6" rx="26" ry="6.2" />
          <Shade d="M6 34.6 C6 38 17.6 40.8 32 40.8 C46.4 40.8 58 38 58 34.6 C58 38.1 46.4 40.8 32 40.8 C17.6 40.8 6 38.1 6 34.6 Z" o={0.1} />
          <Line d="M9 33 C16 36.4 48 36.4 55 33" w={0.85} />
          <path d="M19.6 34.6 C19 19.6 25.4 14.4 32 14.4 C38.6 14.4 45 19.6 44.4 34.6 Z" />
          <Line d="M25.6 18.6 C28 22.6 36 22.6 38.4 18.6" />
          <Line d="M32 15 V21.6" />
          <Shade d="M19.8 28.4 C24.6 30.4 39.4 30.4 44.2 28.4 L44.4 34.6 H19.6 Z" o={0.2} />
          <Line d="M19.8 28.6 C24.6 30.6 39.4 30.6 44.2 28.6" w={0.85} />
        </>
      );
    case "trilby":
      return (
        <>
          <ellipse cx="32" cy="34.6" rx="20.6" ry="5.4" />
          <Shade d="M11.4 34.6 C11.4 37.6 20.6 40 32 40 C43.4 40 52.6 37.6 52.6 34.6 C52.6 37.6 43.4 40 32 40 C20.6 40 11.4 37.6 11.4 34.6 Z" o={0.1} />
          <path d="M21.6 34.6 C21 21.6 26.4 16.6 32 16.6 C37.6 16.6 43 21.6 42.4 34.6 Z" />
          <Line d="M26.4 20.4 C28.4 23.6 35.6 23.6 37.6 20.4" />
          <Shade d="M21.8 29 C25.6 30.6 38.4 30.6 42.2 29 L42.4 34.6 H21.6 Z" o={0.2} />
          <Line d="M21.8 29.2 C25.6 30.8 38.4 30.8 42.2 29.2" w={0.85} />
        </>
      );
    case "beanie":
      return (
        <>
          <path d="M16.6 38 C16.6 17.6 47.4 17.6 47.4 38 Z" />
          <Line d="M26 18.6 C24 25 23.4 32 24 37.6" w={0.85} />
          <Line d="M38 18.6 C40 25 40.6 32 40 37.6" w={0.85} />
          <path d="M15.4 37.4 H48.6 C49.4 37.4 49.4 46.6 48.6 46.6 H15.4 C14.6 46.6 14.6 37.4 15.4 37.4 Z" />
          <Shade d="M15.4 37.4 H48.6 C49.4 37.4 49.4 46.6 48.6 46.6 H15.4 C14.6 46.6 14.6 37.4 15.4 37.4 Z" o={0.12} />
          <Line d="M20 38.6 V45.4 M24.6 38.6 V45.4 M29.2 38.6 V45.4 M33.8 38.6 V45.4 M38.4 38.6 V45.4 M43 38.6 V45.4" w={0.8} />
        </>
      );
    case "fisherman":
      return (
        <>
          <path d="M17.6 32.6 C17.6 16.6 46.4 16.6 46.4 32.6 Z" />
          <path d="M16.4 31.6 H47.6 C48.8 31.6 48.8 42 47.6 42 H16.4 C15.2 42 15.2 31.6 16.4 31.6 Z" />
          <Shade d="M16.4 31.6 H47.6 C48.8 31.6 48.8 42 47.6 42 H16.4 C15.2 42 15.2 31.6 16.4 31.6 Z" o={0.13} />
          <Line d="M16 36.8 H48" />
          <Line d="M21 32.6 V41 M27 32.6 V41 M33 32.6 V41 M39 32.6 V41 M45 32.6 V41" w={0.8} />
        </>
      );
    case "slouch":
      return (
        <>
          <path d="M16.6 40.4 C10 20 26.6 9.6 40 14.6 C53.4 19.6 53.4 33 47.4 40.4 Z" />
          <Line d="M24 16.6 C22 24 21.6 33 22.6 40" w={0.85} />
          <Line d="M38 16.4 C41 23.6 42 32 40.6 40" w={0.85} />
          <path d="M16.4 39.6 H47.6 C48.6 39.6 48.6 47.6 47.6 47.6 H16.4 C15.4 47.6 15.4 39.6 16.4 39.6 Z" />
          <Shade d="M16.4 39.6 H47.6 C48.6 39.6 48.6 47.6 47.6 47.6 H16.4 C15.4 47.6 15.4 39.6 16.4 39.6 Z" o={0.12} />
          <Line d="M21 40.6 V46.6 M26 40.6 V46.6 M31 40.6 V46.6 M36 40.6 V46.6 M41 40.6 V46.6" w={0.8} />
        </>
      );
    case "cowboy":
      return (
        <>
          <path d="M4 33.6 C14.6 25 49.4 25 60 33.6 C49.4 41.6 14.6 41.6 4 33.6 Z" />
          <Shade d="M4 33.6 C14.6 41.6 49.4 41.6 60 33.6 C49.4 41.8 14.6 41.8 4 33.6 Z" o={0.12} />
          <Line d="M8.6 33.6 C18.6 29 45.4 29 55.4 33.6" w={0.85} />
          <path d="M22.6 32.6 C22 13.6 26.6 10.6 32 10.6 C37.4 10.6 42 13.6 41.4 32.6 Z" />
          <Line d="M26.6 15.4 C28.6 20.4 35.4 20.4 37.4 15.4" />
          <Line d="M32 11.6 V19" />
          <Shade d="M22.8 26.6 C27 28.4 37 28.4 41.2 26.6 L41.4 32.6 H22.6 Z" o={0.2} />
          <Line d="M22.8 26.8 C27 28.6 37 28.6 41.2 26.8" w={0.85} />
        </>
      );
    case "newsboy":
      return (
        <>
          <path d="M17.6 36 C24 42.6 37 42.6 42.6 39 L40 34.6 Z" />
          <Shade d="M17.6 36 C24 42.6 37 42.6 42.6 39 L40 34.6 Z" o={0.16} />
          <path d="M14 34.6 C12.6 17 51.4 17 50 34.6 L46.6 38.6 H17.4 Z" />
          <circle cx="32" cy="18.4" r="1.6" />
          <Line d="M32 20 V37.6" />
          <Line d="M22.4 21.6 C25 27.6 26 32.6 25.6 37.6" />
          <Line d="M41.6 21.6 C39 27.6 38 32.6 38.4 37.6" />
          <Shade d="M14.6 32.6 C24 35.6 40 35.6 49.4 32.6 L46.6 38.6 H17.4 Z" o={0.12} />
        </>
      );
    case "cap":
    default:
      return (
        <>
          <path d="M14.6 35.6 C14.6 20 47.4 20 47.4 35.6 Z" />
          <Line d="M31 20.6 V35.4" />
          <Line d="M22.4 22.6 C25.4 27.4 26.4 31.6 26.4 35.4" />
          <Line d="M39.6 22.6 C36.6 27.4 35.6 31.6 35.6 35.4" />
          <circle cx="31" cy="20.2" r="1.4" />
          <Shade d="M14.6 32.6 C22 34.8 40 34.8 47.4 32.6 L47.4 35.6 H14.6 Z" o={0.12} />
          <path d="M41.6 32.6 C49.6 32.4 56.6 34.8 58.4 38 C59 39.8 51.6 40.8 46.4 39.8 C42.4 39 40.6 35.8 41.6 32.6 Z" />
          <Shade d="M41.6 32.6 C49.6 32.4 56.6 34.8 58.4 38 C59 39.8 51.6 40.8 46.4 39.8 C42.4 39 40.6 35.8 41.6 32.6 Z" o={0.16} />
        </>
      );
  }
}

function pathsFor(
  garment: string,
  category: string,
  shape?: string,
  tieType?: string,
  lensFill?: string,
  hatType?: string,
  soleFill?: string,
  blazerType?: string,
): ReactNode {
  switch (garment) {
    case "blazer":
      return blazerType === "double" ? (
        <>
          <path d="M17 12 L32 17 L47 12 L52 21 L51 56 H13 L12 21 Z" />
          <Line d="M17 12 L27 31 L32 17 L37 31 L47 12" w={1.05} />
          <Line d="M25 24 V56 M39 24 V56" />
          <Line d="M16 40 H25 M39 40 H48" />
          <circle cx="28" cy="34" r="1.15" />
          <circle cx="36" cy="34" r="1.15" />
          <circle cx="28" cy="43" r="1.15" />
          <circle cx="36" cy="43" r="1.15" />
          <Gloss d="M17 12 L27 31 L23 33 L14 20 Z" o={0.12} />
        </>
      ) : (
        <>
          <path d="M17 12 L32 17 L47 12 L52 21 L51 56 H13 L12 21 Z" />
          <Line d="M17 12 L26 30 L32 17 L38 30 L47 12" w={1.05} />
          <Line d="M32 17 V56" />
          <Line d="M16 41 H26" />
          <circle cx="35" cy="34" r="1.15" />
          <circle cx="35" cy="42" r="1.15" />
          <Gloss d="M17 12 L26 30 L22.6 32 L13.6 20 Z" o={0.12} />
        </>
      );
    case "jacket":
      return (
        <>
          <path d="M15 15 L32 19 L49 15 L53 24 L51 52 C51 56 13 56 13 52 L11 24 Z" />
          <Line d="M32 19 V52" />
          <Line d="M19 15 L24 27 M45 15 L40 27" />
          <Line d="M15 48 H49" />
          <Shade d="M15 48 H49 L51 52 C51 56 13 56 13 52 Z" o={0.12} />
        </>
      );
    case "coat":
    case "trench":
      return (
        <>
          <path d="M15 10 L32 15 L49 10 L54 19 L52 58 H12 L10 19 Z" />
          <Line d="M32 15 V58" />
          <Line d="M20 10 V22 M44 10 V22" />
          <Line d="M18 34 H46" />
          <Line d="M31 34 V40" />
          <circle cx="26" cy="27" r="1.1" />
          <circle cx="38" cy="27" r="1.1" />
        </>
      );
    case "overshirt":
      return (
        <>
          <path d="M17 14 L32 19 L47 14 L51 23 L49 54 H15 L13 23 Z" />
          <Line d="M32 19 V54" />
          <Line d="M18 30 H28 V39 H18 Z" />
          <Line d="M36 30 H46 V39 H36 Z" />
          <circle cx="35" cy="28" r="1.05" />
          <circle cx="35" cy="45" r="1.05" />
        </>
      );
    case "bomber":
      return (
        <>
          <path d="M16 20 C16 13 48 13 48 20 L53 27 L51 48 C51 53 13 53 13 48 L11 27 Z" />
          <Line d="M16 20 H48" />
          <Line d="M14 47 H50" />
          <Line d="M32 20 V47" />
          <Shade d="M16 15.4 C24 13.4 40 13.4 48 15.4 V20 H16 Z" o={0.14} />
          <Shade d="M14 47 H50 L51 48 C51 53 13 53 13 48 Z" o={0.14} />
        </>
      );
    case "crewneck":
      return (
        <>
          <path d="M19 17 C19 12 45 12 45 17 L50 24 L48 54 H16 L14 24 Z" />
          <Line d="M26 16 C28 24 36 24 38 16" />
          <Line d="M16 50 H48" />
          <Shade d="M16 50 H48 L48 54 H16 Z" o={0.12} />
        </>
      );
    case "cardigan":
      return (
        <>
          <path d="M17 14 L32 24 L47 14 L51 23 L49 56 H15 L13 23 Z" />
          <Line d="M32 24 L25 56 M32 24 L39 56" />
          <circle cx="29" cy="32" r="1.1" />
          <circle cx="28" cy="40" r="1.1" />
          <circle cx="27" cy="48" r="1.1" />
        </>
      );
    case "turtleneck":
      return (
        <>
          <path d="M23 8 H41 V18 C41 13 23 13 23 18 Z" />
          <Shade d="M23 8 H41 V18 C41 13 23 13 23 18 Z" o={0.13} />
          <path d="M17 18 L47 18 L51 25 L49 56 H15 L13 25 Z" />
          <Line d="M23 13 H41" />
        </>
      );
    case "polo":
      return (
        <>
          <path d="M18 15 L32 22 L46 15 L51 23 L49 54 H15 L13 23 Z" />
          <Line d="M27 15 L32 25 L37 15" />
          <Line d="M32 22 V34" />
          <Line d="M18 15 H27 M37 15 H46" />
          <circle cx="30.6" cy="28" r="0.95" />
        </>
      );
    case "tee":
      return (
        <>
          <path d="M25.6 13.6 H38.4 L52.4 20.6 L47 30.4 L43.4 27.4 V54.4 H20.6 V27.4 L17 30.4 L11.6 20.6 Z" />
          <Line d="M25.6 13.6 C27.8 19.8 36.2 19.8 38.4 13.6" />
          <Line d="M20.6 50.6 H43.4" />
          <Shade d="M11.6 20.6 L17 30.4 L20.6 27.4 V22 Z" o={0.1} />
          <Shade d="M52.4 20.6 L47 30.4 L43.4 27.4 V22 Z" o={0.1} />
        </>
      );
    case "henley":
      return (
        <>
          <path d="M17 14 L47 14 L51 22 L49 56 H15 L13 22 Z" />
          <Line d="M32 14 V36" />
          <circle cx="32" cy="20" r="1.2" />
          <circle cx="32" cy="27" r="1.2" />
          <Line d="M26 14 C28 20 36 20 38 14" />
        </>
      );
    case "oxford":
    case "shirt":
      return (
        <>
          <path d="M16 12 L32 20 L48 12 L52 21 L50 56 H14 L12 21 Z" />
          <Line d="M16 12 L26 14 L32 24 L38 14 L48 12" w={1.05} />
          <Line d="M32 20 V56" />
          <Line d="M14 48 H22 M42 48 H50" />
          <circle cx="34.6" cy="30" r="0.95" />
          <circle cx="34.6" cy="40" r="0.95" />
        </>
      );
    case "jeans":
      return (
        <>
          <path d="M21 8 H43 L46 20 L42 58 H33 L32 28 L31 58 H22 L18 20 Z" />
          <Line d="M23 16 H41" />
          <Line d="M24 8 V16 M40 8 V16" />
          <Line d="M32 20 V28" />
          <Line d="M22 36 L31 38 M33 38 L42 36" w={0.85} />
          <Line d="M25 17.6 L27.6 22 M39 17.6 L36.4 22" w={0.85} />
        </>
      );
    case "chinos":
    case "trousers":
      return (
        <>
          <path d="M21 8 H43 L46 18 L43 58 H34 L32 26 L30 58 H21 L18 18 Z" />
          <Line d="M23 14 H41" />
          <Line d="M32 14 V26" />
          <Line d="M26 8 V14 M38 8 V14" />
          <Line d="M26.6 28 L24.6 56" w={0.8} />
          <Line d="M37.6 28 L39.4 56" w={0.8} />
        </>
      );
    case "shorts":
      return (
        <>
          <path d="M20 10 H44 L47 20 L44 44 H34 L32 26 L30 44 H20 L17 20 Z" />
          <Line d="M22 16 H42" />
          <Line d="M32 16 V26" />
          <Line d="M25 10 V16 M39 10 V16" />
          <Line d="M20.6 41.4 H30 M34 41.4 H43.4" />
          <Shade d="M20.2 41.4 H30 L30 44 H20 Z" o={0.12} />
          <Shade d="M34 41.4 H43.8 L44 44 H34 Z" o={0.12} />
        </>
      );
    case "loafers":
      return (
        <>
          <Ground />
          <path d="M11 43 C10.2 34 13.6 28.4 20.6 27.2 C26.2 26.2 29.6 29 33.6 31.6 C39.2 35 45.6 37.2 51.6 38.4 C55.2 39.1 57.2 40.3 57.2 42.4 L57.2 43 Z" />
          <Gloss d="M14.6 33.4 C16.4 29.6 20 27.8 24.6 28.4 C19.6 29.6 16.6 32.4 15.6 36.4 Z" o={0.18} />
          <Line d="M15.2 31.6 V42.6" />
          <path d="M24.4 30.6 C28 32.8 31.6 34.6 35.8 36 L34.8 39.4 C30.4 38 26.6 36 23.2 33.8 Z" />
          <Shade d="M24.4 30.6 C28 32.8 31.6 34.6 35.8 36 L34.8 39.4 C30.4 38 26.6 36 23.2 33.8 Z" o={0.16} />
          <Line d="M28.4 34.4 H32.6" w={1.25} />
          <Line d="M38.4 36.8 C44 38.4 50 40.4 55.6 41.6" />
          <path d="M10.2 43 H56.4 C59.4 43 59.4 47.4 55.6 47.6 L13.6 48.2 C10 48.2 8.8 45.2 10.2 43 Z" />
          <Shade d="M10.2 43 H56.4 C59.4 43 59.4 47.4 55.6 47.6 L13.6 48.2 C10 48.2 8.8 45.2 10.2 43 Z" o={0.15} />
          <Shade d="M10.2 43 H21.6 L21 48.1 L13.6 48.2 C10 48.2 8.8 45.2 10.2 43 Z" o={0.14} />
          <Line d="M11.6 45.2 H55.6" w={0.85} />
        </>
      );
    case "sneakers":
      return (
        <>
          <Ground />
          <path d="M11 42 C10.6 34.2 15 29.2 22.6 28.2 C28 27.4 31.4 29.8 35.4 32.4 C41 35.8 47.4 37.8 53.4 38.8 C56.2 39.2 57.2 40.2 57.2 42 Z" />
          <Shade d="M18 38.6 C24 34.4 30 33.4 36 35 L36.6 38 C30.6 36.8 25 38 19.6 41.4 Z" o={0.13} />
          <Line d="M13.6 31.4 V41.6" />
          <Line d="M23.6 30 L27.4 36 M27.6 31.6 L31.4 37.4 M31.6 33.4 L35.4 38.6" w={0.85} />
          <circle cx="25.4" cy="33.4" r="0.8" />
          <circle cx="29.4" cy="35.2" r="0.8" />
          <circle cx="33.4" cy="37" r="0.8" />
          <Line d="M45.4 37.6 C48.6 39 51.6 40 55.4 40.8" />
          <path
            d="M10 41.6 H56 C59.2 41.6 59.2 47 55.4 47.4 L13.6 48 C9.6 48 8.6 44.4 10 41.6 Z"
            fill={soleFill ?? "#F3EDE0"}
          />
          <Line d="M11 44.6 H55.6" w={0.85} />
        </>
      );
    case "boots":
      return (
        <>
          <Ground rx={22} />
          <path d="M19.4 12.6 C19.4 10.4 39.6 10.4 39.6 12.6 L40.6 30.6 C46 32.6 51.6 35 56 38 C58.6 39.6 58.2 43 55 43 L14 43 C11.4 43 11 39.4 12.6 37.6 L18.6 30.6 Z" />
          <Line d="M19.4 12.6 C19.4 14.8 39.6 14.8 39.6 12.6" />
          <path d="M19.4 13.4 C16.2 13.4 15.6 17.4 18.8 18.2 L19.4 14.4 Z" />
          <Shade d="M20.6 15.4 H26.6 L27 30.4 H20.4 Z" o={0.17} />
          <Line d="M20.6 15.4 V30.4 M26.8 15.4 V30.4" w={0.85} />
          <Gloss d="M31 32.4 C38 34 45.6 37 51 40.4 L50 41.6 C44.6 38.4 37.6 35.6 30.6 34.2 Z" o={0.14} />
          <path d="M13.4 43 H56 C58.8 43 58.8 47.4 55.4 47.6 L15.4 48.2 C12 48.2 11.2 45 13.4 43 Z" />
          <Shade d="M13.4 43 H56 C58.8 43 58.8 47.4 55.4 47.6 L15.4 48.2 C12 48.2 11.2 45 13.4 43 Z" o={0.15} />
          <Shade d="M13.4 43 H25 L24.4 48.1 L15.4 48.2 C12 48.2 11.2 45 13.4 43 Z" o={0.16} />
        </>
      );
    case "hiking":
      return (
        <>
          <Ground rx={23} />
          <path d="M18.6 13.6 C18.6 11 41.4 11 41.4 13.6 L42.4 30 C48 32.2 53.6 35 58 38.4 C60.4 40.2 60 43.6 56.6 43.6 L13 43.6 C10.2 43.6 9.8 39.8 11.6 38 L17.6 30 Z" />
          <path d="M18.4 12.6 C18.4 9.4 41.6 9.4 41.6 12.6 L42 16.6 C42 19 18 19 18 16.6 Z" />
          <Shade d="M18.4 12.6 C18.4 9.4 41.6 9.4 41.6 12.6 L42 16.6 C42 19 18 19 18 16.6 Z" o={0.14} />
          <Line d="M22 22.6 L38 26 M22.4 27.4 L38.4 30.6" w={0.85} />
          <circle cx="21.4" cy="21.6" r="0.85" />
          <circle cx="38.4" cy="24.6" r="0.85" />
          <circle cx="21.8" cy="26.6" r="0.85" />
          <circle cx="38.8" cy="29.6" r="0.85" />
          <Shade d="M46 34 C51 36.4 55.6 39.4 58 41.4 L58 43.6 H45 Z" o={0.14} />
          <path d="M12 43.6 H57.4 C60 43.6 60 48 56.6 48.2 L14 48.8 C10.6 48.8 10 45.6 12 43.6 Z" />
          <Shade d="M12 43.6 H57.4 C60 43.6 60 48 56.6 48.2 L14 48.8 C10.6 48.8 10 45.6 12 43.6 Z" o={0.17} />
          <Line d="M15 48.6 L17.6 46 L20.4 48.6 L23.2 46 L26 48.6 L28.8 46 L31.6 48.6 L34.4 46 L37.2 48.6 L40 46 L42.8 48.6 L45.6 46 L48.4 48.6 L51.2 46 L54 48.6" w={0.8} />
        </>
      );
    case "derbies":
      return (
        <>
          <Ground />
          <path d="M11 43 C10.4 34.4 14 29.2 21 28 C26.6 27 30.2 29.4 34.2 32 C39.8 35.4 46.2 37.6 52.2 38.8 C55.8 39.4 57.2 40.6 57.2 42.6 L57.2 43 Z" />
          <Gloss d="M14.6 34 C16.4 30.4 19.6 28.6 24 28.6 C19.4 30 16.4 32.8 15.6 36.6 Z" o={0.18} />
          <Line d="M15.2 31.6 V42.6" />
          <Line d="M22.4 28.6 C24.4 32.8 27.4 36.2 31.4 38.8" />
          <Line d="M28.6 28.8 C29.8 32.6 32.2 35.8 35.8 38.2" />
          <circle cx="24.6" cy="31.8" r="0.85" />
          <circle cx="26.4" cy="34.8" r="0.85" />
          <circle cx="28.4" cy="37.4" r="0.85" />
          <circle cx="30" cy="31.4" r="0.85" />
          <circle cx="31.8" cy="34.2" r="0.85" />
          <circle cx="33.8" cy="36.8" r="0.85" />
          <Line d="M24.6 31.8 L31.8 34.2 M30 31.4 L26.4 34.8" w={0.8} />
          <Line d="M46.6 38 C48.8 39.6 50.2 41.2 50.8 43" />
          <path d="M10.2 43 H56.4 C59.4 43 59.4 47.4 55.6 47.6 L13.6 48.2 C10 48.2 8.8 45.2 10.2 43 Z" />
          <Shade d="M10.2 43 H56.4 C59.4 43 59.4 47.4 55.6 47.6 L13.6 48.2 C10 48.2 8.8 45.2 10.2 43 Z" o={0.15} />
          <Shade d="M10.2 43 H22.6 L22 48.1 L13.6 48.2 C10 48.2 8.8 45.2 10.2 43 Z" o={0.15} />
          <Line d="M11.6 45.2 H55.6" w={0.85} />
        </>
      );
    case "sandals":
      return (
        <>
          <Ground rx={22} />
          <path d="M19.6 40.6 C25.6 33.6 33 30.6 40.6 31.6 L41.6 35.4 C35 34.6 28.6 37.4 23.6 42.6 Z" />
          <path d="M39.6 32 C45 33.4 49.6 36.4 53 40.4 L50 42.6 C47 39 43 36.6 38.6 35.6 Z" />
          <Shade d="M39.6 32 C45 33.4 49.6 36.4 53 40.4 L50 42.6 C47 39 43 36.6 38.6 35.6 Z" o={0.12} />
          <rect x="20.6" y="38.6" width="4.6" height="4.4" rx="1" />
          <path d="M10.6 41.6 C12.6 38.4 26.6 36.4 40.6 38.6 L54 41 C58 41.8 58.6 46.4 54.6 46.6 L15 47.2 C10.6 47.2 9 44 10.6 41.6 Z" />
          <Shade d="M10.6 41.6 C12.6 38.4 26.6 36.4 40.6 38.6 L54 41 C58 41.8 58.6 46.4 54.6 46.6 L15 47.2 C10.6 47.2 9 44 10.6 41.6 Z" o={0.14} />
          <Line d="M11.6 44 C24 42.4 42 43 56 44" w={0.85} />
        </>
      );
    case "belt":
      return (
        <>
          <path d="M6 29 H45 V39 H6 Z" />
          <Gloss d="M6 29.6 H45 V32 H6 Z" o={0.16} />
          <Line d="M14 29 V39 M22 29 V39 M30 29 V39" w={0.85} />
          <path d="M45 24.6 H56 C57.6 24.6 58.6 25.6 58.6 27 V41 C58.6 42.4 57.6 43.4 56 43.4 H45 Z" />
          <Line d="M48.4 28.4 H55 V39.6 H48.4 Z" w={1.05} />
          <Line d="M45 34 H48.6" w={1.2} />
        </>
      );
    case "watch":
      return (
        <>
          <path d="M27 7 H37 L36 18 H28 Z" />
          <path d="M28 46 H36 L37 57 H27 Z" />
          <Line d="M27.6 11 H36.4 M27.4 14.4 H36.6 M27.6 50 H36.4 M27.4 53.4 H36.6" w={0.8} />
          <circle cx="32" cy="32" r="11.4" />
          <Line d="M32 24 A8 8 0 1 1 31.98 24" w={1.05} />
          <Gloss d="M24.6 25 C27 22.6 31.6 21.4 35 22.4 C30 22.8 26.4 25 24.6 27.6 Z" o={0.22} />
          <Line d="M32 32 V26.4 M32 32 L36.4 34.4" w={0.9} />
          <circle cx="32" cy="32" r="0.9" />
          <path d="M43.4 30 H45.4 V34 H43.4 Z" />
        </>
      );
    case "tie":
      if (tieType === "bolo") {
        return (
          <>
            <Wire d="M26.4 16 C27.2 28 27.6 42 26.8 56" w={1.35} />
            <Wire d="M37.6 16 C36.8 28 36.4 42 37.2 56" w={1.35} />
            <path d="M24.6 18.4 C24.6 13.6 39.4 13.6 39.4 18.4 C39.4 24.8 32 28.4 32 28.4 C32 28.4 24.6 24.8 24.6 18.4 Z" />
            <Shade d="M26 20.4 C27.6 24.6 32 26.8 32 26.8 C32 26.8 36.4 24.6 38 20.4 C36 23.6 32 25.6 32 25.6 C32 25.6 28 23.6 26 20.4 Z" o={0.16} />
            <Gloss d="M27.2 16.4 C29.4 15.2 34.6 15.2 36.8 16.4 C33.6 16.8 30.4 17.2 27.6 18.2 Z" o={0.2} />
            <circle cx="32" cy="19.6" r="1.6" />
            <path d="M24.8 54.4 L26.8 59.2 L28.8 54.6 Z" />
            <path d="M35.2 54.6 L37.2 59.2 L39.2 54.4 Z" />
          </>
        );
      }
      if (tieType === "bow") {
        return (
          <>
            <path d="M7 25 C7 23.6 26 28.4 26.6 30.4 L26.6 37.6 C26 39.6 7 44.4 7 43 Z" />
            <path d="M37.4 30.4 C38 28.4 57 23.6 57 25 L57 43 C57 44.4 38 39.6 37.4 37.6 Z" />
            <rect x="26.4" y="27.6" width="11.2" height="12.8" rx="1.6" />
            <Shade d="M26.4 27.6 H37.6 V40.4 H26.4 Z" o={0.14} />
            <Gloss d="M10 27.4 C15.6 28.6 22 30.6 24.6 31.8 L24.6 33.6 C21 32 15 29.6 10 28.6 Z" o={0.16} />
          </>
        );
      }
      if (tieType === "knitted") {
        return (
          <>
            <path d="M27 7 H37 L35 16 L39 52 H25 L29 16 Z" />
            <Line d="M29 22 H35 M28.6 28 H35.4 M28 34 H36 M27.4 40 H36.6 M27 46 H37" w={0.8} />
            <Line d="M32 16 V52" w={0.8} />
            <Shade d="M25 49 H39 L39 52 H25 Z" o={0.14} />
          </>
        );
      }
      if (tieType === "skinny") {
        return (
          <>
            <path d="M29 7 H35 L33.4 16 L36 53 L32 58 L28 53 L30.6 16 Z" />
            <Line d="M32 16 V26" w={0.8} />
            <Gloss d="M29.4 8 H31.6 L29.6 20 L28.8 20 Z" o={0.16} />
          </>
        );
      }
      return (
        <>
          <path d="M27 7 H37 L34 16 L41 51 L32 59 L23 51 L30 16 Z" />
          <Line d="M32 16 V30" />
          <Gloss d="M28 8 H30.6 L27.4 22 L26.4 22 Z" o={0.16} />
          <Shade d="M32 16 L34 16 L41 51 L32 59 Z" o={0.1} />
        </>
      );
    case "scarf":
      return (
        <>
          <path d="M17.6 32 C17.6 12.6 46.4 12.6 46.4 32 L46.4 36 C46.4 21 17.6 21 17.6 36 Z" />
          <path d="M18.4 31 H28 L26.8 48.6 H19.6 Z" />
          <path d="M36 31 H45.6 L44.6 52.6 H37.2 Z" />
          <Shade d="M36 31 H45.6 L45.4 35 H36 Z" o={0.12} />
          <Line d="M20.2 36 H27.2 M19.9 41 H27" w={0.85} />
          <Line d="M37.6 38 H45 M37.4 43 H44.8" w={0.85} />
          <Wire d="M20.2 48.6 V52.4 M23.2 48.6 V52.4 M26.2 48.6 V52.4" w={0.95} />
          <Wire d="M38 52.6 V56.4 M41 52.6 V56.4 M44 52.6 V56.4" w={0.95} />
        </>
      );
    case "neckerchief":
      return (
        <>
          <path d="M20.4 16.6 L32 11.6 L43.6 16.6 L38.4 24.6 H25.6 Z" />
          <path d="M25.6 23.6 C25.6 20.4 38.4 20.4 38.4 23.6 C38.4 28.6 32 31.6 32 31.6 C32 31.6 25.6 28.6 25.6 23.6 Z" />
          <Shade d="M25.6 23.6 C25.6 20.4 38.4 20.4 38.4 23.6 C38.4 26.4 34.6 29.2 32 30.4 C29.4 29.2 25.6 26.4 25.6 23.6 Z" o={0.14} />
          <path d="M23.6 28.4 L18.4 52.6 L27.2 49.6 L29.6 30.6 Z" />
          <path d="M34.4 30.6 L36.8 49.6 L45.6 52.6 L40.4 28.4 Z" />
          <Line d="M21.4 40 H26.4 M36.6 40 H41.6" w={0.8} />
          <Gloss d="M23.6 15.6 L32 12.4 L36.4 14.4 L32 17.6 Z" o={0.16} />
        </>
      );
    case "tote":
    case "tote bag":
      return (
        <>
          <Wire d="M22 22 C22 12 27.4 9.6 32 9.6 C36.6 9.6 42 12 42 22" w={1.5} />
          <path d="M15.6 21.6 H48.4 L45.4 56 H18.6 Z" />
          <Line d="M19 30 H45" />
          <Shade d="M15.6 21.6 H48.4 L48 26.4 H16 Z" o={0.13} />
          <Gloss d="M18.4 27.6 H24 L22 54 H18.6 Z" o={0.12} />
        </>
      );
    case "pocket square":
    case "pochette":
      return (
        <>
          <path d="M13.6 26.6 L32 15.6 L50.4 26.6 L50.4 49 H13.6 Z" />
          <Line d="M13.6 26.6 L32 20 L50.4 26.6" />
          <path d="M24 21.4 L32 15.6 L40 21.4 L32 25.4 Z" />
          <Shade d="M24 21.4 L32 15.6 L40 21.4 L32 25.4 Z" o={0.14} />
          <Line d="M19.4 34 H44.6 M19.4 40 H38" w={0.85} />
        </>
      );
    case "hat":
      return hatPaths(hatType);
    case "sunglasses":
      return eyewearLenses(shape, false, lensFill);
    case "glasses":
      return eyewearLenses(shape, true);
    default:
      if (category === "Outerwear") return pathsFor("blazer", category);
      if (category === "Knitwear") return pathsFor("crewneck", category);
      if (category === "Shirts") return pathsFor("shirt", category);
      if (category === "Trousers") return pathsFor("trousers", category);
      if (category === "Footwear") return pathsFor("loafers", category);
      return <circle cx="32" cy="32" r="16" />;
  }
}

export function LookGarmentGlyph({
  slot,
  className = "",
}: {
  slot: ConstructorSlot;
  className?: string;
}) {
  const fill = colorHex(slot.color === "mirrored" ? "black" : slot.color);
  const uid = useId().replace(/:/g, "");
  const mirrorId = `${uid}-mirror`;
  const sheenId = `${uid}-sheen`;
  const lensFill =
    slot.garment === "sunglasses"
      ? slot.lensColor === "mirrored" || slot.color === "mirrored"
        ? `url(#${mirrorId})`
        : lensColorHex(slot.lensColor || "grey")
      : undefined;
  return (
    <span className={`block ${className}`}>
      <GlyphFrame fill={fill} mirrorId={mirrorId} sheenId={sheenId}>
        {pathsFor(
          slot.garment,
          slot.category,
          slot.shape,
          slot.tieType,
          lensFill,
          slot.hatType,
          slot.garment === "sneakers"
            ? sneakerSoleColor(slot.color) === "cream"
              ? "#E8DCC8"
              : "#F4F1EA"
            : undefined,
          slot.blazerType,
        )}
      </GlyphFrame>
    </span>
  );
}
