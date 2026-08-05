import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import type { PaletteSwatch } from "@/lib/colour-palette";
import { VERTICAL_SIZE, type VerticalFormat } from "@/lib/og/formats";

export const OG_SIZE = { width: 1200, height: 630 } as const;

const INK = "#15120d";
const PAPER = "#faf6ee";
const CREAM = "#f1e9da";
const STONE_SOFT = "#938878";
const BRASS_SOFT = "#c2a06a";

type FontSpec = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

let fontsPromise: Promise<FontSpec[]> | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

function loadFonts(): Promise<FontSpec[]> {
  if (!fontsPromise) {
    const dir = path.join(process.cwd(), "assets/fonts");
    fontsPromise = Promise.all([
      readFile(path.join(dir, "Fraunces-SemiBold.ttf")),
      readFile(path.join(dir, "Inter-SemiBold.ttf")),
    ]).then(([serif, sans]) => [
      { name: "Fraunces", data: toArrayBuffer(serif), weight: 600, style: "normal" as const },
      { name: "Inter", data: toArrayBuffer(sans), weight: 600, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}

export type ColoursCardData = {
  subseasonLabel: string;
  palette: PaletteSwatch[];
  undertone?: string;
  contrast?: string;
};

// --- Fabric swatch (pinked edges + weave + sheen) ---------------------------
// Rendered as an inline SVG data URI so next/og (resvg) can rasterise it. Uses
// only shapes/gradients/patterns resvg supports — no feTurbulence.

/** Zig-zag ("pinking shears") outline around a w×h rectangle, tooth depth `t`. */
function pinkedPath(w: number, h: number, t: number): string {
  const innerW = w - 2 * t;
  const innerH = h - 2 * t;
  const nx = Math.max(4, Math.round(innerW / (t * 1.7)));
  const ny = Math.max(5, Math.round(innerH / (t * 1.7)));
  const sx = innerW / nx;
  const sy = innerH / ny;
  const p: string[] = [`M ${t} ${t}`];
  for (let i = 0; i < nx; i++) {
    const x0 = t + i * sx;
    p.push(`L ${x0 + sx / 2} 0`, `L ${x0 + sx} ${t}`);
  }
  for (let i = 0; i < ny; i++) {
    const y0 = t + i * sy;
    p.push(`L ${w} ${y0 + sy / 2}`, `L ${w - t} ${y0 + sy}`);
  }
  for (let i = 0; i < nx; i++) {
    const x0 = w - t - i * sx;
    p.push(`L ${x0 - sx / 2} ${h}`, `L ${x0 - sx} ${h - t}`);
  }
  for (let i = 0; i < ny; i++) {
    const y0 = h - t - i * sy;
    p.push(`L 0 ${y0 - sy / 2}`, `L ${t} ${y0 - sy}`);
  }
  p.push("Z");
  return p.join(" ");
}

export const SWATCH_ASPECT_RATIO = 2 / 3;
export const SWATCH_ROTATIONS = [2, 4, 3, 5, 3, 5, 2, 4] as const;
export const SWATCH_OFFSETS_Y = [0, 8, 2, 9, 0, 7, 2, 8] as const;

export function fabricSwatchDataUri(hex: string, w: number, h: number): string {
  const t = Math.max(4, Math.round(Math.min(w, h) * 0.028));
  const d = pinkedPath(w, h, t);
  let seed = w * 313 + h * 911;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const surfaceFibres = Array.from({ length: 190 }, (_, index) => {
    const x = Math.round(random() * w * 10) / 10;
    const y = Math.round(random() * h * 10) / 10;
    const length = 3 + Math.round(random() * 10);
    const bend = Math.round((random() - 0.5) * 3 * 10) / 10;
    const light = index % 3 === 0;
    return `<path d="M${x} ${y} q${length / 2} ${bend} ${length} ${bend / 2}" stroke="${light ? "#ffffff" : "#000000"}" stroke-opacity="${light ? "0.12" : "0.105"}" stroke-width="${light ? "0.9" : "0.75"}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-tooth-depth="${t}">
<defs>
<clipPath id="clip"><path d="${d}"/></clipPath>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.26"/>
<stop offset="0.34" stop-color="#ffffff" stop-opacity="0.05"/>
<stop offset="0.72" stop-color="#000000" stop-opacity="0.08"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.36"/>
</linearGradient>
<linearGradient id="edgeShade" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#000000" stop-opacity="0.24"/>
<stop offset="0.08" stop-color="#000000" stop-opacity="0"/>
<stop offset="0.88" stop-color="#000000" stop-opacity="0"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
</linearGradient>
<pattern id="warp" width="5" height="5" patternUnits="userSpaceOnUse">
<path d="M1 0V5 M4 0V5" stroke="#ffffff" stroke-opacity="0.038" stroke-width="0.5"/>
</pattern>
<pattern id="weft" width="5" height="5" patternUnits="userSpaceOnUse">
<path d="M0 1H5 M0 4H5" stroke="#000000" stroke-opacity="0.048" stroke-width="0.5"/>
</pattern>
<pattern id="threadHighlights" width="12" height="12" patternUnits="userSpaceOnUse">
<path d="M0 3L3 0 M0 9L9 0 M3 12L12 3 M9 12L12 9" stroke="#ffffff" stroke-opacity="0.085" stroke-width="0.7"/>
<path d="M0 0L12 12 M-3 3L9 15 M3-3L15 9" stroke="#000000" stroke-opacity="0.07" stroke-width="0.6"/>
</pattern>
<pattern id="slubFibres" width="31" height="29" patternUnits="userSpaceOnUse">
<circle cx="3" cy="6" r="0.7" fill="#ffffff" fill-opacity="0.07"/>
<circle cx="18" cy="4" r="0.5" fill="#000000" fill-opacity="0.08"/>
<circle cx="27" cy="13" r="0.65" fill="#ffffff" fill-opacity="0.05"/>
<circle cx="9" cy="19" r="0.55" fill="#000000" fill-opacity="0.07"/>
<circle cx="22" cy="25" r="0.7" fill="#ffffff" fill-opacity="0.055"/>
</pattern>
</defs>
<g clip-path="url(#clip)">
<rect x="0" y="0" width="${w}" height="${h}" fill="${hex}"/>
<rect x="0" y="0" width="${w}" height="${h}" fill="url(#warp)"/>
<rect x="0" y="0" width="${w}" height="${h}" fill="url(#weft)"/>
<rect x="0" y="0" width="${w}" height="${h}" fill="url(#threadHighlights)"/>
<rect x="0" y="0" width="${w}" height="${h}" fill="url(#slubFibres)"/>
<g data-layer="surface-fibres" fill="none">${surfaceFibres}</g>
<rect x="0" y="0" width="${w}" height="${h}" fill="url(#sheen)"/>
<rect x="0" y="0" width="${w}" height="${h}" fill="url(#edgeShade)"/>
</g>
<path d="${d}" fill="none" stroke="#e9ddc9" stroke-opacity="0.24" stroke-width="1"/>
<path d="${d}" fill="none" stroke="#000000" stroke-opacity="0.42" stroke-width="2.2" transform="translate(1.5 2)"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function atelierBackdropDataUri(width: number, height: number): string {
  const sx = width / 1080;
  const sy = height / 1920;
  const p = (x: number, y: number) => `${Math.round(x * sx)} ${Math.round(y * sy)}`;
  const inset = Math.max(9, Math.round(width * 0.018));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<pattern id="clothGrain" width="9" height="9" patternUnits="userSpaceOnUse">
<path d="M0 1H9 M0 5H9" stroke="#ffffff" stroke-opacity="0.022" stroke-width="0.7"/>
<path d="M1 0V9 M5 0V9" stroke="#000000" stroke-opacity="0.18" stroke-width="0.8"/>
<path d="M0 8L8 0 M4 9L9 4" stroke="#b99b6b" stroke-opacity="0.012" stroke-width="0.6"/>
</pattern>
<linearGradient id="baseShade" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#18140e"/>
<stop offset="0.5" stop-color="#0c0a07"/>
<stop offset="1" stop-color="#17130e"/>
</linearGradient>
<radialGradient id="vignette" cx="50%" cy="43%" r="72%">
<stop offset="0" stop-color="#352a1c" stop-opacity="0.12"/>
<stop offset="0.72" stop-color="#000000" stop-opacity="0"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.52"/>
</radialGradient>
</defs>
<rect width="${width}" height="${height}" fill="url(#baseShade)"/>
<rect width="${width}" height="${height}" fill="url(#clothGrain)"/>

<!-- layered suiting cloth panels -->
<path d="M ${p(0, 1300)} L ${p(390, 1120)} L ${p(530, 1920)} L ${p(0, 1920)} Z" fill="#17130e" opacity="0.76"/>
<path d="M ${p(0, 1300)} L ${p(390, 1120)} L ${p(530, 1920)}" fill="none" stroke="#756144" stroke-opacity="0.13" stroke-width="${Math.max(1, width / 700)}"/>
<path d="M ${p(720, 1120)} L ${p(1080, 960)} L ${p(1080, 1920)} L ${p(790, 1920)} Z" fill="#090806" opacity="0.54"/>
<path d="M ${p(720, 1120)} L ${p(1080, 960)} L ${p(1080, 1920)}" fill="none" stroke="#806a49" stroke-opacity="0.14" stroke-width="${Math.max(1, width / 700)}"/>

<!-- tailor's jacket pattern and seam allowance -->
<g fill="none" stroke="#b08d59" stroke-width="${Math.max(0.7, width / 1200)}">
<path d="M ${p(38, 216)} C ${p(126, 184)} ${p(238, 238)} ${p(318, 310)} C ${p(360, 348)} ${p(332, 430)} ${p(306, 487)} C ${p(274, 560)} ${p(284, 654)} ${p(368, 724)}" opacity="0.18"/>
<path d="M ${p(56, 242)} C ${p(138, 218)} ${p(220, 256)} ${p(292, 322)} C ${p(326, 354)} ${p(304, 421)} ${p(282, 474)} C ${p(250, 552)} ${p(262, 632)} ${p(342, 700)}" opacity="0.20" stroke-dasharray="7 6"/>
<path d="M ${p(0, 530)} C ${p(76, 516)} ${p(116, 502)} ${p(147, 489)} C ${p(130, 570)} ${p(84, 624)} ${p(0, 655)}" opacity="0.17"/>
<path d="M ${p(40, 548)} C ${p(89, 538)} ${p(112, 529)} ${p(127, 522)}" opacity="0.20" stroke-dasharray="6 5"/>
<path d="M ${p(752, 88)} C ${p(726, 213)} ${p(721, 311)} ${p(758, 404)} C ${p(792, 492)} ${p(862, 548)} ${p(936, 596)}" opacity="0.14" stroke-dasharray="8 7"/>
<path d="M ${p(823, 66)} V ${p(823, 462)} M ${p(666, 264)} H ${p(1005, 264)}" opacity="0.10"/>
</g>

<!-- construction guides -->
<g fill="none" stroke="#b59059" stroke-width="${Math.max(0.6, width / 1450)}" opacity="0.12">
<path d="M ${p(540, 36)} V ${p(540, 790)} M ${p(345, 165)} H ${p(1018, 165)} M ${p(354, 356)} H ${p(1025, 356)}"/>
<circle cx="${540 * sx}" cy="${320 * sy}" r="${Math.round(205 * sx)}"/>
<circle cx="${806 * sx}" cy="${374 * sy}" r="${Math.round(138 * sx)}"/>
</g>
<rect width="${width}" height="${height}" fill="url(#vignette)"/>
<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="none" stroke="#c2a06a" stroke-opacity="0.62" stroke-width="${Math.max(1, width / 720)}"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Men's atelier jacket form inside a fine brass medallion. */
export function dressFormDataUri(): string {
  // Transparent SVG — gold linework only, no dark mount/plate. Sits directly on
  // the atelier card background so there's no tonal square around the emblem.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="107" height="92" viewBox="0 0 107 92" role="img" aria-labelledby="title desc">
<title id="title">Valetti tailoring emblem</title>
<desc id="desc">A fine antique-gold tailor's mannequin inside a double oval.</desc>
<defs>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#d4ae62"/>
<stop offset=".42" stop-color="#9b7538"/>
<stop offset=".72" stop-color="#d0a656"/>
<stop offset="1" stop-color="#725023"/>
</linearGradient>
<filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
<feGaussianBlur stdDeviation=".42" result="blur"/>
<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<style>
.fine{fill:none;stroke:url(#gold);stroke-width:.56;stroke-linecap:round;stroke-linejoin:round}
.hair{fill:none;stroke:url(#gold);stroke-width:.34;stroke-linecap:round;stroke-linejoin:round}
</style>
</defs>
<g filter="url(#glow)" opacity=".88">
<path class="fine" d="M0 45.25H15.05M0 47.02H15.05M94.1 45.25H107M94.1 47.02H107"/>
<path class="hair" d="M13.65 44.8v2.65M95.45 44.8v2.65"/>
</g>
<g filter="url(#glow)" opacity=".94">
<ellipse class="fine" cx="55.2" cy="44.35" rx="26.2" ry="40.15" stroke-width=".72"/>
<ellipse class="hair" cx="55.2" cy="44.35" rx="22.55" ry="36.85" stroke-width=".44"/>
<path class="hair" d="M55.2 4.2v3.25M55.2 81.2v3.2" opacity=".55"/>
<path class="fine" d="m34.15 39.24 2.05 3.2-2.05 3.2-2.02-3.2z"/>
<path class="hair" d="m34.15 40.5 1.22 1.94-1.22 1.92-1.2-1.92z"/>
<path class="fine" d="m76.25 39.24 2.03 3.2-2.03 3.2-2.03-3.2z"/>
<path class="hair" d="m76.25 40.5 1.2 1.94-1.2 1.92-1.21-1.92z"/>
<path class="fine" d="M52.6 18.63c.1-1.53 1.02-2.47 2.6-2.47s2.5.94 2.6 2.47"/>
<path class="hair" d="M54.25 16.2c-.18-1.05.28-1.72.95-2.16.68.44 1.14 1.11.96 2.16M55.2 13.98v-2.06"/>
<circle cx="55.2" cy="11.36" r=".62" fill="none" stroke="url(#gold)" stroke-width=".4"/>
<path class="fine" d="M52.58 18.62c-.06 1.45-.31 2.9-.79 4.1l-7.32 3.88c.57 5.05 1.1 9.75 1.28 14.11.12 2.89-.4 6.85-1.05 11.2-.55 3.7-.58 6.63-.12 9.31 3.62 1.32 7.13 2 10.62 2 3.5 0 7-.68 10.63-2 .45-2.68.42-5.61-.13-9.31-.65-4.35-1.17-8.31-1.05-11.2.18-4.36.71-9.06 1.28-14.11l-7.33-3.88c-.48-1.2-.72-2.65-.79-4.1"/>
<path class="hair" d="M52.6 18.63c1.73.63 3.47.63 5.2 0M51.8 22.72c2.24 1.17 4.53 1.17 6.8 0"/>
<path class="fine" d="M55.2 23.6v39.58M45.76 40.7h18.88M44.7 51.9h21M48.08 24.66c1.17 4.44 1.74 9.63 1.65 16.04M62.32 24.66c-1.17 4.44-1.74 9.63-1.65 16.04M49.73 40.7c.13 5.43-.67 10.54-1.82 20.92M60.67 40.7c-.13 5.43.67 10.54 1.82 20.92"/>
<path class="hair" d="M47.75 25.15c2.22 1.15 4.68 1.78 7.45 1.78s5.23-.63 7.45-1.78M44.6 61.2c3.49-1.21 7.02-1.81 10.6-1.81 3.59 0 7.12.6 10.62 1.81"/>
<path class="fine" d="M53.95 63.22v17.43M56.45 63.22v17.43" opacity=".78"/>
</g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function SwatchTile({
  hex,
  tileW,
  tileH,
  radius,
  rotation = 0,
  offsetY = 0,
}: {
  hex: string;
  tileW: number;
  tileH: number;
  radius: number;
  rotation?: number;
  offsetY?: number;
}) {
  const inset = Math.round(tileW * 0.085);
  const fw = tileW - 2 * inset;
  const fh = tileH - 2 * inset;
  return (
    <div
      style={{
        display: "flex",
        width: tileW,
        height: tileH,
        borderRadius: radius,
        backgroundColor: "#211b13",
        border: "1px solid rgba(194,160,106,0.30)",
        boxShadow: "0 14px 24px rgba(0,0,0,0.58), 0 3px 5px rgba(0,0,0,0.72)",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${offsetY}px) rotate(${rotation}deg)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fabricSwatchDataUri(hex, fw, fh)} width={fw} height={fh} alt="" />
    </div>
  );
}

export function monogramDataUri(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 700 900">
<defs>
<pattern id="monogramGrain" width="11" height="11" patternUnits="userSpaceOnUse">
<path d="M0 2H11 M0 7H11" stroke="#e2c58f" stroke-opacity="0.09" stroke-width="0.55"/>
<path d="M2 0V11 M8 0V11" stroke="#000000" stroke-opacity="0.16" stroke-width="0.6"/>
</pattern>
</defs>
<path data-layer="serif-v" d="M42 34 H278 V54 C236 58 224 76 242 120 L370 724 L500 120 C518 76 506 58 462 54 V34 H658 V54 C625 60 612 80 595 125 L397 852 H343 L140 125 C123 80 109 61 42 54 Z" fill="#b8955f" fill-opacity="0.105" stroke="#c5a36d" stroke-opacity="0.15" stroke-width="1.1"/>
<path d="M42 34 H278 V54 C236 58 224 76 242 120 L370 724 L500 120 C518 76 506 58 462 54 V34 H658 V54 C625 60 612 80 595 125 L397 852 H343 L140 125 C123 80 109 61 42 54 Z" fill="url(#monogramGrain)" opacity="0.42"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function Watermark({
  size,
  top,
  offsetX,
}: {
  size: number;
  top: number;
  offsetX: number;
}) {
  const height = Math.round(size * (900 / 700));
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateX(${offsetX}px)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={monogramDataUri(size, height)} width={size} height={height} alt="" />
    </div>
  );
}

function AtelierBackdrop({
  width,
  height,
  monogramSize,
  monogramTop,
  monogramOffsetX,
  canvasOffsetX,
  canvasOffsetY,
}: {
  width: number;
  height: number;
  monogramSize: number;
  monogramTop: number;
  monogramOffsetX: number;
  canvasOffsetX: number;
  canvasOffsetY: number;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={atelierBackdropDataUri(width, height)}
        width={width}
        height={height}
        alt=""
        style={{
          position: "absolute",
          left: -canvasOffsetX,
          top: -canvasOffsetY,
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          left: -canvasOffsetX,
          right: -canvasOffsetX,
          top: -canvasOffsetY,
          height,
        }}
      >
        <Watermark size={monogramSize} top={monogramTop} offsetX={monogramOffsetX} />
      </div>
    </>
  );
}

/** Horizontal 1200×630 link-preview card. */
function Card({ subseasonLabel, palette, undertone, contrast }: ColoursCardData) {
  const meta = [undertone, contrast ? `${contrast} contrast` : null]
    .filter(Boolean)
    .join("  ·  ");
  const tileW = 108;
  const tileH = Math.round(tileW / SWATCH_ASPECT_RATIO);
  const gap = 11;
  const paletteRows = [palette.slice(0, 4), palette.slice(4, 8)];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: INK,
        fontFamily: "Inter",
        padding: "52px 62px 46px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AtelierBackdrop
        width={OG_SIZE.width}
        height={OG_SIZE.height}
        monogramSize={330}
        monogramTop={24}
        monogramOffsetX={118}
        canvasOffsetX={62}
        canvasOffsetY={52}
      />

      {/* Masthead */}
      <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
        <span
          style={{
            fontFamily: "Fraunces",
            fontSize: 27,
            letterSpacing: 7,
            color: PAPER,
            textTransform: "uppercase",
          }}
        >
          {BRAND.name}
        </span>
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 12,
            letterSpacing: 4,
            color: BRASS_SOFT,
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          {BRAND.eyebrow}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          position: "relative",
          marginTop: 12,
        }}
      >
        {/* Result */}
        <div
          style={{
            display: "flex",
            width: 500,
            paddingRight: 30,
            flexDirection: "column",
          }}
        >
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 15,
              letterSpacing: 4,
              color: BRASS_SOFT,
              textTransform: "uppercase",
            }}
          >
            My colours
          </span>
          <div
            style={{
              display: "flex",
              width: 160,
              height: 1,
              marginTop: 8,
              backgroundColor: "rgba(194,160,106,0.50)",
            }}
          />
          <span
            style={{
              fontFamily: "Fraunces",
              fontSize: subseasonLabel.length > 13 ? 69 : 78,
              lineHeight: 0.96,
              color: PAPER,
              marginTop: 14,
            }}
          >
            {subseasonLabel}
          </span>
          {meta ? (
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 18,
                letterSpacing: 2,
                color: CREAM,
                textTransform: "capitalize",
                marginTop: 14,
              }}
            >
              {meta}
            </span>
          ) : null}
        </div>

        {/* Palette: two tactile, deliberately uneven rows. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            marginLeft: 14,
            marginTop: 18,
          }}
        >
          {paletteRows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              style={{
                display: "flex",
                height: tileH + 6,
                marginTop: rowIndex === 0 ? 0 : -7,
              }}
            >
              {row.map((sw, i) => {
                const index = rowIndex * 4 + i;
                return (
                  <div
                    key={`${sw.hex}-${index}`}
                    style={{
                      display: "flex",
                      marginRight: i === row.length - 1 ? 0 : gap,
                    }}
                  >
                    <SwatchTile
                      hex={sw.hex}
                      tileW={tileW}
                      tileH={tileH}
                      radius={7}
                      rotation={SWATCH_ROTATIONS[index]}
                      offsetY={SWATCH_OFFSETS_Y[index]}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 17,
          borderTop: "1px solid rgba(250,246,238,0.12)",
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 15,
            letterSpacing: 2,
            color: STONE_SOFT,
            textTransform: "uppercase",
          }}
        >
          Free colour analysis for men
        </span>
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 16,
            letterSpacing: 2,
            color: BRASS_SOFT,
            textTransform: "uppercase",
          }}
        >
          valetti.fit
        </span>
      </div>
    </div>
  );
}

export function verticalLayoutFor(
  format: VerticalFormat,
  width: number,
  height: number,
) {
  const isFeed = format === "feed";
  const s = width / 1080;
  const pad = Math.round((isFeed ? 64 : 84) * s);
  const contentW = width - 2 * pad;
  const tileW = Math.round(contentW * (isFeed ? 0.18 : 0.217));

  return {
    isFeed,
    s,
    pad,
    contentW,
    gap: Math.round((isFeed ? 10 : 18) * s),
    horizontalGap: Math.round((isFeed ? 10 : 12) * s),
    tileW,
    tileH: Math.round(tileW / SWATCH_ASPECT_RATIO),
    monogramSize: Math.round(width * (isFeed ? 0.31 : 0.5)),
    monogramTop: Math.round(height * (isFeed ? 0.015 : 0.025)),
    monogramOffsetX: Math.round((isFeed ? 0 : 74) * s),
    mastheadFontSize: Math.round((isFeed ? 34 : 40) * s),
    eyebrowFontSize: Math.round((isFeed ? 14 : 16) * s),
    centerMasthead: isFeed,
    labelFontSize: Math.round((isFeed ? 18 : 22) * s),
    titleFontSize: Math.round((isFeed ? 88 : 118) * s),
    titleMarginTop: Math.round((isFeed ? 10 : 14) * s),
    metaFontSize: Math.round((isFeed ? 22 : 28) * s),
    metaMarginTop: Math.round((isFeed ? 10 : 18) * s),
    dividerMarginTop: Math.round((isFeed ? 18 : 34) * s),
    dividerMarginBottom: Math.round((isFeed ? 16 : 30) * s),
    emblemMarginTop: Math.round((isFeed ? 44 : 12) * s),
    emblemWidth: Math.round((isFeed ? 90 : 107) * s),
    emblemHeight: Math.round((isFeed ? 77 : 92) * s),
    footerMarginTop: Math.round((isFeed ? 6 : 8) * s),
    footerPaddingTop: Math.round((isFeed ? 8 : 10) * s),
    footerLeftFontSize: Math.round((isFeed ? 16 : 18) * s),
    footerRightFontSize: Math.round((isFeed ? 17 : 19) * s),
  };
}

/** Vertical share asset (Stories / Pinterest / 4:5 feed) — editorial card. */
function VerticalCard({
  data,
  format,
  width,
  height,
}: {
  data: ColoursCardData;
  format: VerticalFormat;
  width: number;
  height: number;
}) {
  const { subseasonLabel, palette, undertone, contrast } = data;
  const meta = [undertone, contrast ? `${contrast} contrast` : null]
    .filter(Boolean)
    .join("  ·  ");
  const layout = verticalLayoutFor(format, width, height);
  const {
    s,
    pad,
    contentW,
    gap,
    horizontalGap,
    tileW,
    tileH,
  } = layout;
  const rule = "1px solid rgba(194,160,106,0.28)";
  const row = (items: PaletteSwatch[], key: string, offset: number) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: offset === 0 ? 0 : -8 * s,
        transform: `translateX(${offset === 0 ? 0 : 8 * s}px)`,
      }}
      key={key}
    >
      {items.map((sw, i) => {
        const index = offset + i;
        return (
          <div
            key={`${sw.hex}-${i}`}
            style={{
              display: "flex",
              marginRight: i === items.length - 1 ? 0 : horizontalGap,
            }}
          >
            <SwatchTile
              hex={sw.hex}
              tileW={tileW}
              tileH={tileH}
              radius={Math.round(12 * s)}
              rotation={SWATCH_ROTATIONS[index]}
              offsetY={SWATCH_OFFSETS_Y[index] * s}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        backgroundColor: INK,
        fontFamily: "Inter",
        padding: pad,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AtelierBackdrop
        width={width}
        height={height}
        monogramSize={layout.monogramSize}
        monogramTop={layout.monogramTop}
        monogramOffsetX={layout.monogramOffsetX}
        canvasOffsetX={pad}
        canvasOffsetY={pad}
      />

      {/* Masthead */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: layout.centerMasthead ? "center" : "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: "Fraunces",
            fontSize: layout.mastheadFontSize,
            letterSpacing: 9 * s,
            color: PAPER,
            textTransform: "uppercase",
          }}
        >
          {BRAND.name}
        </span>
        <span
          style={{
            fontFamily: "Inter",
            fontSize: layout.eyebrowFontSize,
            letterSpacing: 5 * s,
            color: BRASS_SOFT,
            textTransform: "uppercase",
            marginTop: 8 * s,
          }}
        >
          {BRAND.eyebrow}
        </span>
      </div>

      {/* Spacer so the result sits in the lower third, over the watermark. */}
      <div style={{ display: "flex", flex: 1 }} />

      {/* Result */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "Inter",
              fontSize: layout.labelFontSize,
              letterSpacing: 5 * s,
              color: BRASS_SOFT,
              textTransform: "uppercase",
            }}
          >
            My colours
          </span>
          <div
            style={{
              display: "flex",
              flex: 1,
              height: 1,
              marginLeft: 18 * s,
              backgroundColor: "rgba(194,160,106,0.35)",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "Fraunces",
            fontSize: layout.titleFontSize,
            lineHeight: 1,
            color: PAPER,
            marginTop: layout.titleMarginTop,
            width: contentW,
          }}
        >
          {subseasonLabel}
        </span>
        {meta ? (
          <span
            style={{
              fontFamily: "Inter",
              fontSize: layout.metaFontSize,
              letterSpacing: 2 * s,
              color: CREAM,
              textTransform: "capitalize",
              marginTop: layout.metaMarginTop,
            }}
          >
            {meta}
          </span>
        ) : null}

        {/* Ornament divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: layout.dividerMarginTop,
            marginBottom: layout.dividerMarginBottom,
          }}
        >
          <div style={{ display: "flex", flex: 1, height: 1, backgroundColor: "rgba(194,160,106,0.28)" }} />
          <div
            style={{
              display: "flex",
              width: 12 * s,
              height: 12 * s,
              marginLeft: 14 * s,
              marginRight: 14 * s,
              backgroundColor: BRASS_SOFT,
              transform: "rotate(45deg)",
            }}
          />
          <div style={{ display: "flex", flex: 1, height: 1, backgroundColor: "rgba(194,160,106,0.28)" }} />
        </div>

        {/* Swatch grid (4 × 2) */}
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {row(palette.slice(0, 4), "r1", 0)}
          {row(palette.slice(4, 8), "r2", 4)}
        </div>
      </div>

      {/* Dress-form footer ornament */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: layout.emblemMarginTop,
        }}
      >
        <div style={{ display: "flex", flex: 1, height: 1, backgroundColor: "rgba(194,160,106,0.22)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dressFormDataUri()}
          width={layout.emblemWidth}
          height={layout.emblemHeight}
          alt=""
          style={{ marginLeft: 22 * s, marginRight: 22 * s }}
        />
        <div style={{ display: "flex", flex: 1, height: 1, backgroundColor: "rgba(194,160,106,0.22)" }} />
      </div>

      {/* Footer labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: layout.footerMarginTop,
          paddingTop: layout.footerPaddingTop,
          borderTop: rule,
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontSize: layout.footerLeftFontSize,
            letterSpacing: 2 * s,
            color: STONE_SOFT,
            textTransform: "uppercase",
          }}
        >
          Free colour analysis for men
        </span>
        <span
          style={{
            fontFamily: "Inter",
            fontSize: layout.footerRightFontSize,
            letterSpacing: 2 * s,
            color: BRASS_SOFT,
            textTransform: "uppercase",
          }}
        >
          valetti.fit
        </span>
      </div>
    </div>
  );
}

const CARD_CACHE = "public, max-age=3600, s-maxage=86400";

/** Flatten Satori's alpha PNG to a JPEG (Facebook-friendly); fall back to PNG. */
async function toShareResponse(image: ImageResponse): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());
  try {
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(png)
      .flatten({ background: INK })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();
    return new Response(jpeg as BodyInit, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": CARD_CACHE },
    });
  } catch {
    return new Response(png as BodyInit, {
      headers: { "Content-Type": "image/png", "Cache-Control": CARD_CACHE },
    });
  }
}

export async function renderColoursShareCard(
  data: ColoursCardData,
): Promise<Response> {
  const fonts = await loadFonts();
  const image = new ImageResponse(<Card {...data} />, { ...OG_SIZE, fonts });
  return toShareResponse(image);
}

/** Render the vertical colours palette asset for a given format (A4). */
export async function renderColoursShareCardVertical(
  data: ColoursCardData,
  format: VerticalFormat,
): Promise<Response> {
  const fonts = await loadFonts();
  const { width, height } = VERTICAL_SIZE[format];
  const image = new ImageResponse(
    <VerticalCard data={data} format={format} width={width} height={height} />,
    { width, height, fonts },
  );
  return toShareResponse(image);
}
