/**
 * Build the social share images for Valetti.
 *
 * Composites a crisp typographic overlay (brand wordmark + tagline) over the
 * generated atelier photos of Carlo Valetti. Run after regenerating the bases:
 *
 *   node scripts/build-og.mjs
 *
 * Outputs:
 *   public/images/og-valetti.png   1200x630   (optional typographic card; not used for site OG)
 *   public/images/og-square.png    1080x1080  (Instagram / LinkedIn post)
 *
 * Site-wide OG / Twitter link previews use public/images/flatlay-essentials.png (see BRAND.ogImage).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const INK = "#15120D";
const PAPER = "#FBF8F2";
const BRASS = "#9E7B45";
const BRASS_SOFT = "#C9A86A";
const STONE = "#57534E";
const CREAM = "239,230,211"; // rgb of --cream
const INK_RGB = "21,18,13"; // rgb of --ink

/* ── Landscape link card (1200x630): subject right, light scrim left ──────── */
async function buildLandscape() {
  const W = 1200;
  const H = 630;
  const base = path.join(root, "public/images/og-base.png");
  const out = path.join(root, "public/images/og-valetti.png");

  const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="rgba(${CREAM},0.94)"/>
      <stop offset="42%" stop-color="rgba(${CREAM},0.62)"/>
      <stop offset="66%" stop-color="rgba(${CREAM},0)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="74" y="236" fill="${BRASS}" font-size="22" font-weight="700"
          letter-spacing="5">PERSONAL STYLE ATELIER</text>
    <text x="70" y="346" fill="${INK}" font-size="110" font-weight="600"
          font-family="Georgia, 'Times New Roman', serif"
          letter-spacing="-1">Valetti</text>
    <text x="74" y="410" fill="${STONE}" font-size="33" font-style="italic"
          font-family="Georgia, 'Times New Roman', serif">Find your own style.</text>
    <text x="74" y="468" fill="${STONE}" font-size="21"
          letter-spacing="0.5">AI-assisted personal styling · with Carlo Valetti</text>
  </g>
</svg>`;

  const bg = await sharp(base)
    .resize(W, H, { fit: "cover", position: "right" })
    .toBuffer();
  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(out);
  report(out);
}

/* ── Square post (1080x1080): full-bleed photo, dark scrim + text at bottom ─ */
async function buildSquare() {
  const S = 1080;
  const base = path.join(root, "public/images/carlo-square.png");
  const out = path.join(root, "public/images/og-square.png");

  const svg = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="48%" stop-color="rgba(${INK_RGB},0)"/>
      <stop offset="78%" stop-color="rgba(${INK_RGB},0.72)"/>
      <stop offset="100%" stop-color="rgba(${INK_RGB},0.92)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${S}" height="${S}" fill="url(#scrim)"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="80" y="838" fill="${BRASS_SOFT}" font-size="24" font-weight="700"
          letter-spacing="6">PERSONAL STYLE ATELIER</text>
    <text x="76" y="952" fill="${PAPER}" font-size="120" font-weight="600"
          font-family="Georgia, 'Times New Roman', serif"
          letter-spacing="-1">Valetti</text>
    <text x="80" y="1004" fill="rgba(${CREAM},0.85)" font-size="26"
          font-style="italic"
          font-family="Georgia, 'Times New Roman', serif">Find your own style — not the latest trend.</text>
    <text x="80" y="1046" fill="rgba(${CREAM},0.6)" font-size="20"
          letter-spacing="0.5">AI-assisted personal styling · with Carlo Valetti</text>
  </g>
</svg>`;

  const bg = await sharp(base)
    .resize(S, S, { fit: "cover", position: "north" })
    .toBuffer();
  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(out);
  report(out);
}

function report(out) {
  const bytes = readFileSync(out).length;
  console.log("Wrote", path.relative(root, out), "·", (bytes / 1024).toFixed(0) + " KB");
}

await buildLandscape();
await buildSquare();
