/**
 * Rasterise Valetti monogram SVGs to PNG (matches src/components/brand/ValettiMonogram.tsx).
 * Usage: node scripts/export-valetti-logo.mjs
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const images = join(root, "public/images");

const exports_ = [
  {
    svg: join(images, "valetti-monogram-filled.svg"),
    png: join(images, "valetti-logo.png"),
    sizes: [512, 1024],
  },
  {
    svg: join(images, "valetti-monogram.svg"),
    png: join(images, "valetti-monogram.png"),
    sizes: [512],
  },
];

for (const { svg, png, sizes } of exports_) {
  const input = readFileSync(svg);
  const base = png.replace(/\.png$/, "");
  for (const size of sizes) {
    const out =
      sizes.length > 1 ? `${base}-${size}.png` : png;
    await sharp(input, { density: Math.max(256, size * 2) })
      .resize(size, size)
      .png()
      .toFile(out);
    console.log("Wrote", out);
  }
}
