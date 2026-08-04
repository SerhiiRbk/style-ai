import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import type { ShareCardData } from "@/lib/og/report-share-card-data";
import { VERTICAL_SIZE, type VerticalFormat } from "@/lib/og/formats";

/** Standard 1.91:1 social card — matches the width/height in report metadata. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const INK = "#15120d";
const INK_SOFT = "#2a251d";
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

/** Load and memoize the brand fonts (serif display + sans labels). */
function loadFonts(): Promise<FontSpec[]> {
  if (!fontsPromise) {
    const dir = path.join(process.cwd(), "assets/fonts");
    fontsPromise = Promise.all([
      readFile(path.join(dir, "Fraunces-SemiBold.ttf")),
      readFile(path.join(dir, "Inter-SemiBold.ttf")),
    ]).then(([serif, sans]) => [
      { name: "Fraunces", data: toArrayBuffer(serif), weight: 600, style: "normal" },
      { name: "Inter", data: toArrayBuffer(sans), weight: 600, style: "normal" },
    ]);
  }
  return fontsPromise;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontFamily: "Fraunces",
          fontSize: compact ? 28 : 34,
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
  );
}

function Swatches({ palette }: { palette: string[] }) {
  return (
    <div style={{ display: "flex" }}>
      {palette.map((hex, i) => (
        <div
          key={`${hex}-${i}`}
          style={{
            width: 48,
            height: 48,
            borderRadius: 48,
            backgroundColor: hex,
            border: "1px solid rgba(250,246,238,0.18)",
            marginRight: 14,
          }}
        />
      ))}
    </div>
  );
}

function Frame() {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        right: 24,
        bottom: 24,
        border: `1px solid ${"rgba(194,160,106,0.28)"}`,
        borderRadius: 4,
      }}
    />
  );
}

/** Personalized two-column card: content + hero look photo with a watermark. */
function PersonalizedCard(data: ShareCardData) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: INK,
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {/* Left — content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: data.heroDataUrl ? 730 : 1200,
          height: "100%",
          padding: 64,
        }}
      >
        <Wordmark />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 16,
              letterSpacing: 3,
              color: BRASS_SOFT,
              textTransform: "uppercase",
            }}
          >
            {[data.seasonLabel, data.undertone, data.contrast]
              .filter(Boolean)
              .join("  ·  ")}
          </span>
          <span
            style={{
              fontFamily: "Fraunces",
              fontSize: 56,
              lineHeight: 1.05,
              color: PAPER,
              marginTop: 18,
              maxWidth: 600,
            }}
          >
            {data.headline}
          </span>
          {data.archetype ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
              <span
                style={{
                  fontFamily: "Inter",
                  fontSize: 12,
                  letterSpacing: 3,
                  color: STONE_SOFT,
                  textTransform: "uppercase",
                }}
              >
                Style archetype
              </span>
              <span
                style={{
                  fontFamily: "Fraunces",
                  fontSize: 28,
                  color: CREAM,
                  marginTop: 4,
                }}
              >
                {data.archetype}
              </span>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {data.palette.length ? <Swatches palette={data.palette} /> : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 22,
              paddingTop: 20,
              borderTop: "1px solid rgba(250,246,238,0.12)",
            }}
          >
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 14,
                letterSpacing: 2,
                color: STONE_SOFT,
                textTransform: "uppercase",
              }}
            >
              Your colour palette
            </span>
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 15,
                letterSpacing: 2,
                color: BRASS_SOFT,
                textTransform: "uppercase",
              }}
            >
              valetti.fit
            </span>
          </div>
        </div>
      </div>

      {/* Right — hero photo */}
      {data.heroDataUrl ? (
        <div style={{ display: "flex", width: 470, height: "100%", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.heroDataUrl}
            alt=""
            width={470}
            height={630}
            style={{
              width: 470,
              height: 630,
              objectFit: "cover",
              // Anchor to the top so a full-length portrait keeps the head in
              // frame (center-crop was cutting off the face).
              objectPosition: "center top",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 180,
              height: "100%",
              backgroundImage: `linear-gradient(to right, ${INK}, rgba(21,18,13,0))`,
            }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 30,
              right: 30,
              fontFamily: "Fraunces",
              fontSize: 22,
              letterSpacing: 6,
              color: "rgba(250,246,238,0.82)",
              textTransform: "uppercase",
            }}
          >
            {BRAND.name}
          </span>
        </div>
      ) : null}

      <Frame />
    </div>
  );
}

/** Branded fallback when a report isn't shareable — no personal data, still on-brand. */
function BrandCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundImage: `linear-gradient(135deg, ${INK}, ${INK_SOFT})`,
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      <span
        style={{
          fontFamily: "Fraunces",
          fontSize: 68,
          letterSpacing: 12,
          color: PAPER,
          textTransform: "uppercase",
        }}
      >
        {BRAND.name}
      </span>
      <span
        style={{
          fontFamily: "Inter",
          fontSize: 18,
          letterSpacing: 5,
          color: BRASS_SOFT,
          textTransform: "uppercase",
          marginTop: 16,
        }}
      >
        {BRAND.eyebrow}
      </span>
      <span
        style={{
          fontFamily: "Fraunces",
          fontSize: 26,
          color: CREAM,
          marginTop: 40,
        }}
      >
        See what genuinely suits you — and why.
      </span>
      <Frame />
    </div>
  );
}

/**
 * Vertical composition (A4) — a new layout, not a resize: hero across the top,
 * palette and caption stacked below. Used for both 9:16 (Stories/Reels/TikTok)
 * and 2:3 (Pinterest); the caller picks the canvas size.
 */
function VerticalCard({
  data,
  width,
  height,
}: {
  data: ShareCardData;
  width: number;
  height: number;
}) {
  const heroHeight = data.heroDataUrl ? Math.round(height * 0.6) : 0;
  const meta = [data.seasonLabel, data.undertone, data.contrast]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        backgroundColor: INK,
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {data.heroDataUrl ? (
        <div style={{ display: "flex", width, height: heroHeight, position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.heroDataUrl}
            alt=""
            width={width}
            height={heroHeight}
            style={{ width, height: heroHeight, objectFit: "cover", objectPosition: "center top" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 240,
              backgroundImage: `linear-gradient(to bottom, rgba(21,18,13,0), ${INK})`,
            }}
          />
        </div>
      ) : null}

      {/* Lower panel */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexGrow: 1,
          padding: 72,
        }}
      >
        <Wordmark />

        <div style={{ display: "flex", flexDirection: "column" }}>
          {meta ? (
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 20,
                letterSpacing: 3,
                color: BRASS_SOFT,
                textTransform: "uppercase",
              }}
            >
              {meta}
            </span>
          ) : null}
          <span
            style={{
              fontFamily: "Fraunces",
              fontSize: 68,
              lineHeight: 1.05,
              color: PAPER,
              marginTop: 20,
            }}
          >
            {data.headline}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {data.palette.length ? <Swatches palette={data.palette} /> : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 28,
              paddingTop: 24,
              borderTop: "1px solid rgba(250,246,238,0.12)",
            }}
          >
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 18,
                letterSpacing: 2,
                color: STONE_SOFT,
                textTransform: "uppercase",
              }}
            >
              Your colour palette
            </span>
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 19,
                letterSpacing: 2,
                color: BRASS_SOFT,
                textTransform: "uppercase",
              }}
            >
              valetti.fit
            </span>
          </div>
        </div>
      </div>

      <Frame />
    </div>
  );
}

/** Vertical branded fallback (private/unshareable report). */
function VerticalBrandCard({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width,
        height,
        backgroundImage: `linear-gradient(160deg, ${INK}, ${INK_SOFT})`,
        fontFamily: "Inter",
        position: "relative",
        padding: 72,
      }}
    >
      <span
        style={{
          fontFamily: "Fraunces",
          fontSize: 84,
          letterSpacing: 14,
          color: PAPER,
          textTransform: "uppercase",
        }}
      >
        {BRAND.name}
      </span>
      <span
        style={{
          fontFamily: "Inter",
          fontSize: 22,
          letterSpacing: 5,
          color: BRASS_SOFT,
          textTransform: "uppercase",
          marginTop: 18,
        }}
      >
        {BRAND.eyebrow}
      </span>
      <span
        style={{
          fontFamily: "Fraunces",
          fontSize: 34,
          color: CREAM,
          marginTop: 48,
          textAlign: "center",
        }}
      >
        See what genuinely suits you — and why.
      </span>
      <Frame />
    </div>
  );
}

const CARD_CACHE = "public, max-age=3600, s-maxage=86400";

/**
 * Satori renders PNGs with an alpha channel, which Facebook's scraper often
 * rejects ("could not be processed as an image"). Re-encode to a flattened
 * JPEG — Facebook's preferred format — falling back to the original PNG bytes
 * if sharp is unavailable (still a valid image everywhere else).
 */
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

/** Render the branded report share card (personalized when data is present). */
export async function renderReportShareCard(
  data: ShareCardData | null,
): Promise<Response> {
  const fonts = await loadFonts();
  const image = new ImageResponse(
    data ? <PersonalizedCard {...data} /> : <BrandCard />,
    { ...OG_SIZE, fonts },
  );
  return toShareResponse(image);
}

/** Render the vertical report share asset for a given format (A4). */
export async function renderReportShareCardVertical(
  data: ShareCardData | null,
  format: VerticalFormat,
): Promise<Response> {
  const fonts = await loadFonts();
  const { width, height } = VERTICAL_SIZE[format];
  const image = new ImageResponse(
    data ? (
      <VerticalCard data={data} width={width} height={height} />
    ) : (
      <VerticalBrandCard width={width} height={height} />
    ),
    { width, height, fonts },
  );
  return toShareResponse(image);
}
