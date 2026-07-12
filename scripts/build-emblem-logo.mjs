/**
 * Build the Valetti emblem logo + favicons from the ornate gold "V" artwork.
 *
 * Source: public/images/valetti-emblem-source.png (gold V on a cream parchment
 * background). We (1) remove the parchment via a corner flood-fill so the emblem
 * sits cleanly on any page, trim it, and export a transparent PNG for the header;
 * and (2) export opaque square tiles (original cream backdrop) for the favicon,
 * Apple touch icon, PWA manifest and schema.org logo.
 *
 * Run:  node scripts/build-emblem-logo.mjs
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES = join(ROOT, "public/images");
const APP = join(ROOT, "src/app");
const SRC = join(IMAGES, "valetti-emblem-source.png");

/** Colour distance (Euclidean, RGB). */
function dist(r, g, b, R, G, B) {
  return Math.sqrt((r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2);
}

async function buildTransparent() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  // Background colour = average of the four corners (the cream parchment).
  const corners = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + (W - 1)) * 4];
  let R = 0;
  let G = 0;
  let B = 0;
  for (const c of corners) {
    R += data[c];
    G += data[c + 1];
    B += data[c + 2];
  }
  R /= 4;
  G /= 4;
  B /= 4;

  // Remove *all* parchment — both the outer field and the negative space
  // enclosed by the scrollwork — with a global test. Cream is light and nearly
  // desaturated; the gold (saturated) and the near-black letter (dark) are far
  // from it, so a colour-distance + low-saturation test keeps the artwork intact
  // while clearing every cream pixel regardless of connectivity.
  const HARD = 60; // <= this distance from cream (and low sat) → background
  const SOFT = 110; // feather band up to here
  const MAX_SAT = 46; // only treat low-saturation pixels as cream (protect gold)

  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const d = dist(r, g, b, R, G, B);
    if (sat <= MAX_SAT && d <= HARD) {
      data[i + 3] = 0;
    } else if (sat <= MAX_SAT && d < SOFT) {
      // Soft edge / anti-aliased fringe between cream and gold.
      data[i + 3] = Math.round(((d - HARD) / (SOFT - HARD)) * 255);
    }
  }

  // Tight-crop to the emblem, then export the header logo.
  const full = sharp(data, { raw: { width: W, height: H, channels: 4 } });
  const trimmed = await full
    .png()
    .toBuffer()
    .then((buf) => sharp(buf).trim({ threshold: 10 }).toBuffer());

  await sharp(trimmed).png().toFile(join(IMAGES, "valetti-emblem.png"));
  return trimmed;
}

async function buildTiles() {
  // Opaque square tiles keep the original cream backdrop so the dark V stays
  // legible at any size (a dark tile would swallow the near-black letter).
  const tile = (size, out) =>
    sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .flatten({ background: "#efe7d6" })
      .png()
      .toFile(out);

  await tile(1024, join(IMAGES, "valetti-logo-1024.png"));
  await tile(512, join(IMAGES, "valetti-logo-512.png"));
  await tile(512, join(APP, "icon.png"));
  await tile(180, join(APP, "apple-icon.png"));

  // Multi-resolution favicon.ico — browsers auto-request /favicon.ico, so this
  // must be the new emblem (otherwise a stale default icon wins over icon.png).
  const icoSizes = [16, 32, 48, 64];
  const pngs = await Promise.all(
    icoSizes.map((s) =>
      sharp(SRC)
        .resize(s, s, { fit: "cover" })
        .flatten({ background: "#efe7d6" })
        .png()
        .toBuffer(),
    ),
  );
  await writeFile(join(APP, "favicon.ico"), await pngToIco(pngs));
}

const transparentBuf = await buildTransparent();
const meta = await sharp(transparentBuf).metadata();
await buildTiles();
console.log(
  `Done. Transparent emblem ${meta.width}x${meta.height}; tiles + favicons written.`,
);
