import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import type { PaletteSwatch } from "@/lib/colour-palette";

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

function Frame() {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        right: 24,
        bottom: 24,
        border: "1px solid rgba(194,160,106,0.28)",
        borderRadius: 4,
      }}
    />
  );
}

function Watermark() {
  // Vertically centred via flex so the glyph is never clipped by font metrics.
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingRight: 70,
      }}
    >
      <span
        style={{
          fontFamily: "Fraunces",
          fontSize: 470,
          lineHeight: 1,
          color: "rgba(194,160,106,0.08)",
        }}
      >
        V
      </span>
    </div>
  );
}

function Card({ subseasonLabel, palette, undertone, contrast }: ColoursCardData) {
  const meta = [undertone, contrast ? `${contrast} contrast` : null]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        backgroundColor: INK,
        fontFamily: "Inter",
        padding: 72,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Watermark />

      {/* Masthead */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "Fraunces",
            fontSize: 30,
            letterSpacing: 8,
            color: PAPER,
            textTransform: "uppercase",
          }}
        >
          {BRAND.name}
        </span>
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 13,
            letterSpacing: 4,
            color: BRASS_SOFT,
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          {BRAND.eyebrow}
        </span>
      </div>

      {/* Result */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 16,
            letterSpacing: 4,
            color: BRASS_SOFT,
            textTransform: "uppercase",
          }}
        >
          My colours
        </span>
        <span
          style={{
            fontFamily: "Fraunces",
            fontSize: 92,
            lineHeight: 1,
            color: PAPER,
            marginTop: 12,
          }}
        >
          {subseasonLabel}
        </span>
        {meta ? (
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 20,
              letterSpacing: 2,
              color: CREAM,
              textTransform: "capitalize",
              marginTop: 16,
            }}
          >
            {meta}
          </span>
        ) : null}
        <div style={{ display: "flex", marginTop: 40 }}>
          {palette.map((s, i) => (
            <div
              key={`${s.hex}-${i}`}
              style={{
                width: 62,
                height: 62,
                borderRadius: 14,
                backgroundColor: s.hex,
                border: "1px solid rgba(250,246,238,0.18)",
                marginRight: i === palette.length - 1 ? 0 : 16,
              }}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 22,
          borderTop: "1px solid rgba(250,246,238,0.12)",
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

      <Frame />
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
