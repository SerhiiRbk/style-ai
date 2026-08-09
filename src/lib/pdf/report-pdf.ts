import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import { absoluteUrl } from "@/lib/site-url";
import { storagePathFromAssetSrc } from "@/lib/asset-url";
import { downloadAssetBytes } from "@/lib/data/asset-access";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { tierHasCapsule, type StyleReport } from "@/lib/report";
import { formatMoneyPdf } from "@/lib/currency";
import { BODY_TYPE_LABELS, isBodyType } from "@/lib/style-profile";
import { capsuleMatrixImageAt } from "@/lib/demo-report";
import { extrasForReport, investmentLevel, itemsForLook } from "@/lib/style-extras";
import { humanizeProductTitle } from "@/lib/product-title";
import { makeT } from "@/lib/i18n/report";
import {
  buildColoursSwatchSvg,
  COLOURS_SWATCH_ASPECT_RATIO,
} from "@/components/FabricSwatch";

// A4 in points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.12, 0.11, 0.1);
const STONE = rgb(0.43, 0.41, 0.37);
const LINE = rgb(0.83, 0.79, 0.72);
const CREAM = rgb(0.98, 0.969, 0.94);
const SAND = rgb(0.93, 0.915, 0.875);
const BRASS = rgb(0.62, 0.47, 0.26);
const WHITE = rgb(1, 1, 1);
const FOG = rgb(0.88, 0.86, 0.82);

// Embedded Unicode fonts (Noto) cover Latin, Latin-Extended (Czech/Polish/
// Turkish) and Cyrillic (Russian/Ukrainian), so localized reports render their
// prose, prices and names correctly instead of being stripped to "?".
const FONT_DIR = path.join(process.cwd(), "assets/fonts/pdf");
const FONT_FILES = {
  sans: "NotoSans-Regular.ttf",
  sansBold: "NotoSans-Bold.ttf",
  serif: "NotoSerif-Regular.ttf",
  serifBold: "NotoSerif-Bold.ttf",
  serifItalic: "NotoSerif-Italic.ttf",
} as const;

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0.8, 0.8, 0.8);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function loadBytes(src: string): Promise<Uint8Array | null> {
  try {
    const storagePath = storagePathFromAssetSrc(src);
    if (storagePath) {
      return await downloadAssetBytes(storagePath);
    }
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    if (src.startsWith("/")) {
      return new Uint8Array(await readFile(path.join(process.cwd(), "public", src)));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cover-crop source bytes to box aspect (w:h) and re-encode as JPEG for pdf-lib.
 * Returns null if `sharp` is unavailable (e.g. native libvips fails to load in
 * the serverless runtime) so the caller can fall back to a raw embed instead of
 * failing the whole PDF.
 */
async function cropToBoxJpeg(
  bytes: Uint8Array,
  box: { w: number; h: number; px?: number; position?: string },
): Promise<Buffer | null> {
  const px = box.px ?? 260;
  const targetW = px;
  const targetH = Math.round((px * box.h) / box.w);
  const position = box.position ?? "centre";
  let sharp: typeof import("sharp").default;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    return null;
  }
  const resizeOpts = {
    width: targetW,
    height: targetH,
    fit: "cover" as const,
    position,
  };
  const attempts = [
    () =>
      sharp(bytes, { failOn: "none" })
        .rotate()
        .resize(resizeOpts)
        .jpeg({ quality: 78 })
        .toBuffer(),
    () => sharp(bytes).resize(resizeOpts).jpeg({ quality: 78 }).toBuffer(),
  ];
  for (const run of attempts) {
    try {
      return await run();
    } catch {
      // try next pipeline
    }
  }
  return null;
}

/**
 * Average perceived luminance (0 = black … 1 = white) of a normalized region of
 * an image. Used to pick dark vs light cover type over an unpredictable photo.
 * Returns null when sharp is unavailable so the caller can fall back safely.
 */
async function regionLuma(
  bytes: Uint8Array,
  region: { left: number; top: number; width: number; height: number },
): Promise<number | null> {
  let sharp: typeof import("sharp").default;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    return null;
  }
  try {
    const meta = await sharp(bytes, { failOn: "none" }).rotate().metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return null;
    const left = Math.min(W - 1, Math.max(0, Math.round(region.left * W)));
    const top = Math.min(H - 1, Math.max(0, Math.round(region.top * H)));
    const w = Math.max(1, Math.min(W - left, Math.round(region.width * W)));
    const h = Math.max(1, Math.min(H - top, Math.round(region.height * H)));
    const { data, info } = await sharp(bytes, { failOn: "none" })
      .rotate()
      .extract({ left, top, width: w, height: h })
      .resize(16, 16, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum +=
        0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
    }
    return sum / n / 255;
  } catch {
    return null;
  }
}

/**
 * Embed an image from a public path or remote URL, cover-cropped to the target
 * box aspect (w:h) and re-encoded to JPEG. Cropping is required because pdf-lib
 * cannot clip overflow, stretches uncropped bitmaps, and JPEG keeps the PDF small.
 * If cropping is unavailable (sharp missing), fall back to embedding the raw
 * bytes so the PDF still renders — never fail the whole export over one image.
 */
async function embedImage(
  doc: PDFDocument,
  src: string | undefined,
  box: { w: number; h: number; px?: number; position?: string },
): Promise<PDFImage | null> {
  if (!src) return null;
  const bytes = await loadBytes(src);
  if (!bytes) return null;
  const jpeg = await cropToBoxJpeg(bytes, box);
  if (jpeg) {
    try {
      return await doc.embedJpg(jpeg);
    } catch {
      // fall through to raw embed below
    }
  }
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return await doc.embedPng(bytes);
    }
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

/**
 * Rasterise the atelier fabric-card SVG (same language as `/colours` and the
 * web report) to a PNG for pdf-lib. Falls back to null when sharp is missing
 * so the caller can draw a flat swatch instead of failing the whole PDF.
 */
async function embedFabricSwatch(
  doc: PDFDocument,
  hex: string,
  uid: string,
): Promise<PDFImage | null> {
  let sharp: typeof import("sharp").default;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    return null;
  }
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, "") || "swatch";
  // Explicit pixel size so librsvg doesn't render a tiny default canvas —
  // matches the cloth viewBox (132×214) at 2× for crisp print.
  const svg = buildColoursSwatchSvg(hex, safeUid).replace(
    'viewBox="24 18 132 214"',
    'width="264" height="428" viewBox="24 18 132 214"',
  );
  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return await doc.embedPng(png);
  } catch {
    return null;
  }
}

type GalleryItem = {
  img: PDFImage | null;
  title: string;
  sub?: string;
  meta?: string;
  label?: string;
};

/** Editorial, magazine-style layout engine over one or more A4 pages. */
class Doc {
  doc!: PDFDocument;
  page!: PDFPage;
  y = 0;
  pageNo = 1;
  section = "";
  reg!: PDFFont;
  bold!: PDFFont;
  serif!: PDFFont;
  serifBold!: PDFFont;
  serifItalic!: PDFFont;

  static async create() {
    const d = new Doc();
    d.doc = await PDFDocument.create();
    d.doc.registerFontkit(fontkit);
    const [sans, sansBold, serif, serifBold, serifItalic] = await Promise.all([
      readFile(path.join(FONT_DIR, FONT_FILES.sans)),
      readFile(path.join(FONT_DIR, FONT_FILES.sansBold)),
      readFile(path.join(FONT_DIR, FONT_FILES.serif)),
      readFile(path.join(FONT_DIR, FONT_FILES.serifBold)),
      readFile(path.join(FONT_DIR, FONT_FILES.serifItalic)),
    ]);
    // subset: true keeps only the glyphs actually used, so the embedded fonts
    // add little to the file size while covering every supported language.
    d.reg = await d.doc.embedFont(sans, { subset: true });
    d.bold = await d.doc.embedFont(sansBold, { subset: true });
    d.serif = await d.doc.embedFont(serif, { subset: true });
    d.serifBold = await d.doc.embedFont(serifBold, { subset: true });
    d.serifItalic = await d.doc.embedFont(serifItalic, { subset: true });
    return d;
  }

  // Embedded Noto fonts are full Unicode, so keep real typography (€, curly
  // quotes, en/em dashes, ellipsis, Latin-Extended, Cyrillic). Only normalise
  // arrow glyphs (not present in the serif face) and drop control characters.
  sanitize(str: string) {
    return str
      .replace(/[\u2192\u2794\u279C]/g, "->")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
    this.drawFooter();
    this.pageNo++;
    this.y = PAGE_H - MARGIN - 4;
  }

  private drawFooter() {
    const fy = 38;
    this.page.drawLine({
      start: { x: MARGIN, y: fy + 13 },
      end: { x: PAGE_W - MARGIN, y: fy + 13 },
      thickness: 0.5,
      color: LINE,
    });
    this.drawTracked("VALETTI", MARGIN, fy, 7.5, this.bold, STONE, 2.2);
    if (this.section) {
      const label = this.section.toUpperCase();
      const w = this.widthTracked(label, this.reg, 7.5, 2);
      this.drawTracked(label, (PAGE_W - w) / 2, fy, 7.5, this.reg, STONE, 2);
    }
    const num = String(this.pageNo).padStart(2, "0");
    const nw = this.widthTracked(num, this.bold, 7.5, 2.2);
    this.drawTracked(num, PAGE_W - MARGIN - nw, fy, 7.5, this.bold, BRASS, 2.2);
  }

  ensure(space: number) {
    if (this.y - space < MARGIN + 8) this.newPage();
  }

  /* ----------------------------- text helpers ----------------------------- */

  widthTracked(str: string, font: PDFFont, size: number, tracking: number) {
    const s = this.sanitize(str);
    let w = 0;
    for (const ch of s) w += font.widthOfTextAtSize(ch, size) + tracking;
    return w - (s.length ? tracking : 0);
  }

  /** Draw one line with manual letter-spacing at an absolute position. */
  drawTracked(
    str: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    tracking: number,
    opacity?: number,
  ) {
    let cx = x;
    for (const ch of this.sanitize(str)) {
      this.page.drawText(ch, { x: cx, y, size, font, color, opacity });
      cx += font.widthOfTextAtSize(ch, size) + tracking;
    }
  }

  /** A tracked line in the normal flow (used for eyebrows / small caps). */
  flowTracked(
    str: string,
    opts: {
      size: number;
      font: PDFFont;
      color: ReturnType<typeof rgb>;
      tracking: number;
      lineGap?: number;
      x?: number;
    },
  ) {
    const lineGap = opts.lineGap ?? 4;
    this.ensure(opts.size + lineGap);
    this.drawTracked(
      str,
      opts.x ?? MARGIN,
      this.y - opts.size,
      opts.size,
      opts.font,
      opts.color,
      opts.tracking,
    );
    this.y -= opts.size + lineGap;
  }

  wrapLines(str: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of this.sanitize(str).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) > width && line) {
          out.push(line);
          line = w;
        } else line = trial;
      }
      if (line) out.push(line);
      if (!words.length) out.push("");
    }
    return out;
  }

  /** Word-wrap text and draw it top-down. */
  text(
    str: string,
    opts: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      lineGap?: number;
      x?: number;
      width?: number;
    } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? this.reg;
    const color = opts.color ?? INK;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_W;
    const lh = size + (opts.lineGap ?? 4);
    for (const ln of this.wrapLines(str, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(ln, { x, y: this.y - size + 1, size, font, color });
      this.y -= lh;
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  rule(color = LINE, thickness = 0.75) {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness,
      color,
    });
    this.y -= 14;
  }

  /** A chapter-opener section header. Every chapter starts on a fresh page. */
  heading(eyebrow: string, title: string) {
    // Set the running section first so the new page's footer shows this chapter.
    this.section = title;
    this.newPage();
    this.gap(10);
    this.flowTracked(eyebrow.toUpperCase(), {
      size: 8.5,
      font: this.bold,
      color: BRASS,
      tracking: 3,
    });
    this.gap(8);
    this.text(title, { size: 24, font: this.serifBold, lineGap: 7 });
    this.gap(9);
    this.rule();
  }

  private subheadBlockHeight(leadingGap = 7) {
    return leadingGap + 9 + 4 + 4;
  }

  /** A small-caps tracked subheading. */
  subhead(str: string, opts?: { keepWith?: number }) {
    const blockH = this.subheadBlockHeight();
    if (opts?.keepWith && this.y - blockH - opts.keepWith < MARGIN + 8) {
      this.newPage();
    }
    this.gap(7);
    this.flowTracked(str.toUpperCase(), {
      size: 9,
      font: this.bold,
      color: INK,
      tracking: 1.6,
    });
    this.gap(4);
  }

  bullet(str: string, color = STONE) {
    const indent = 12;
    const lh = 10.5 + 4;
    const lines = this.wrapLines(str, this.reg, 10.5, CONTENT_W - indent);
    lines.forEach((ln, i) => {
      this.ensure(lh);
      if (i === 0) {
        this.page.drawCircle({
          x: MARGIN + 2.5,
          y: this.y - 4,
          size: 1.5,
          color: BRASS,
        });
      }
      this.page.drawText(ln, {
        x: MARGIN + indent,
        y: this.y - 10.5 + 1,
        size: 10.5,
        font: this.reg,
        color,
      });
      this.y -= lh;
    });
  }

  /** A large italic pull-quote with a brass margin rule. */
  quote(str: string) {
    this.gap(4);
    const size = 15;
    const lineGap = 7;
    const lines = this.wrapLines(str, this.serifItalic, size, CONTENT_W - 22);
    this.ensure(lines.length * (size + lineGap) + 6);
    const top = this.y;
    const blockH = lines.length * (size + lineGap);
    this.page.drawRectangle({
      x: MARGIN,
      y: top - blockH + 4,
      width: 2.5,
      height: blockH - 2,
      color: BRASS,
    });
    let yy = top;
    for (const ln of lines) {
      this.page.drawText(ln, {
        x: MARGIN + 18,
        y: yy - size,
        size,
        font: this.serifItalic,
        color: INK,
      });
      yy -= size + lineGap;
    }
    this.y = yy - 2;
  }

  /**
   * Colour row: fabric-textured swatch (when `img` is provided — same atelier
   * cloth card as `/colours`) or a flat filled square fallback (metals, or when
   * sharp is unavailable).
   */
  swatch(hex: string, label: string, img?: PDFImage | null) {
    const w = img ? 16 : 10;
    const h = img ? Math.round(w / COLOURS_SWATCH_ASPECT_RATIO) : 10;
    const textX = MARGIN + w + 10;
    const lh = 11 + 5;
    const lines = this.wrapLines(label, this.reg, 10, CONTENT_W - (w + 12));
    this.ensure(Math.max(h, lines.length * lh) + 2);
    const top = this.y;
    if (img) {
      this.page.drawImage(img, {
        x: MARGIN,
        y: top - h,
        width: w,
        height: h,
      });
    } else {
      this.page.drawRectangle({
        x: MARGIN,
        y: top - h - 1,
        width: w,
        height: h,
        color: hexToRgb(hex),
        borderColor: LINE,
        borderWidth: 0.5,
      });
    }
    let yy = top;
    for (const ln of lines) {
      this.page.drawText(ln, {
        x: textX,
        y: yy - 10 + 1,
        size: 10,
        font: this.reg,
        color: INK,
      });
      yy -= lh;
    }
    this.y = Math.min(top - h - 1, yy);
    this.gap(img ? 5 : 3);
  }

  /** Full-width banner image, pre-cropped to CONTENT_W x h. */
  banner(img: PDFImage, h: number) {
    this.ensure(h + 8);
    this.page.drawImage(img, {
      x: MARGIN,
      y: this.y - h,
      width: CONTENT_W,
      height: h,
    });
    this.y -= h + 12;
  }

  /* ------------------------------ galleries ------------------------------- */

  private captionHeight(it: GalleryItem, w: number) {
    let h = 0;
    h += this.wrapLines(it.title, this.bold, 9.5, w).length * (9.5 + 3);
    if (it.sub) h += 2 + this.wrapLines(it.sub, this.reg, 8.5, w).length * (8.5 + 2.5);
    if (it.meta) h += 2 + this.wrapLines(it.meta, this.serifItalic, 8, w).length * (8 + 2);
    return h;
  }

  private drawCaption(it: GalleryItem, x: number, top: number, w: number) {
    let yy = top;
    for (const ln of this.wrapLines(it.title, this.bold, 9.5, w)) {
      this.page.drawText(ln, { x, y: yy - 9.5, size: 9.5, font: this.bold, color: INK });
      yy -= 9.5 + 3;
    }
    if (it.sub) {
      yy -= 2;
      for (const ln of this.wrapLines(it.sub, this.reg, 8.5, w)) {
        this.page.drawText(ln, { x, y: yy - 8.5, size: 8.5, font: this.reg, color: STONE });
        yy -= 8.5 + 2.5;
      }
    }
    if (it.meta) {
      yy -= 2;
      for (const ln of this.wrapLines(it.meta, this.serifItalic, 8, w)) {
        this.page.drawText(ln, { x, y: yy - 8, size: 8, font: this.serifItalic, color: BRASS });
        yy -= 8 + 2;
      }
    }
  }

  private galleryMetrics(
    items: GalleryItem[],
    opts: { cols?: number; ratio?: number } = {},
  ) {
    const cols = opts.cols ?? 2;
    const ratio = opts.ratio ?? 1.25;
    const colGap = 16;
    const rowGap = 20;
    const cardW = (CONTENT_W - colGap * (cols - 1)) / cols;
    const imgH = cardW * ratio;
    const firstRow = items.slice(0, cols);
    const capH = Math.max(
      ...firstRow.map((it) => this.captionHeight(it, cardW)),
      0,
    );
    const firstRowH = imgH + 8 + capH + rowGap;
    return { cols, ratio, colGap, rowGap, cardW, imgH, firstRowH };
  }

  /** Subheading plus gallery kept on the same page when possible. */
  gallerySection(
    title: string,
    items: GalleryItem[],
    opts: { cols?: number; ratio?: number } = {},
  ) {
    if (!items.length) return;
    const { firstRowH } = this.galleryMetrics(items, opts);
    if (this.y - this.subheadBlockHeight() - firstRowH < MARGIN + 8) {
      this.newPage();
    }
    this.subhead(title);
    this.gallery(items, opts);
  }

  /** A responsive image grid with captions — the magazine workhorse. */
  gallery(items: GalleryItem[], opts: { cols?: number; ratio?: number } = {}) {
    if (!items.length) return;
    const { cols, ratio, colGap, rowGap, cardW, imgH } = this.galleryMetrics(
      items,
      opts,
    );

    for (let i = 0; i < items.length; i += cols) {
      const row = items.slice(i, i + cols);
      const capH = Math.max(...row.map((it) => this.captionHeight(it, cardW)), 0);
      this.ensure(imgH + capH + rowGap);
      const topY = this.y;
      row.forEach((it, j) => {
        const x = MARGIN + j * (cardW + colGap);
        const iy = topY - imgH;
        if (it.img) {
          this.page.drawImage(it.img, { x, y: iy, width: cardW, height: imgH });
        } else {
          this.page.drawRectangle({ x, y: iy, width: cardW, height: imgH, color: SAND });
        }
        this.page.drawRectangle({
          x,
          y: iy,
          width: cardW,
          height: imgH,
          borderColor: LINE,
          borderWidth: 0.5,
        });
        if (it.label) {
          const labelText = it.label.toUpperCase();
          const padX = 12;
          const labelH = 16;
          const textW = this.widthTracked(labelText, this.bold, 6.5, 1.4);
          const lw = Math.min(cardW, textW + padX);
          this.page.drawRectangle({
            x,
            y: topY - labelH,
            width: lw,
            height: labelH,
            color: CREAM,
          });
          this.drawTracked(
            labelText,
            x + 6,
            topY - 11,
            6.5,
            this.bold,
            BRASS,
            1.4,
          );
        }
        this.drawCaption(it, x, iy - 8, cardW);
      });
      this.y = topY - imgH - 8 - capH - rowGap;
    }
  }
}

/** Build a downloadable, magazine-style PDF from a style report. */
export async function buildReportPdf(report: StyleReport): Promise<Uint8Array> {
  const d = await Doc.create();
  const cur = report.profile.currency;
  const extras = extrasForReport(report);
  const includeCapsule = tierHasCapsule(report.tier);
  const tt = makeT(report.language);

  /** Sequential chapter numbering so skipped sections never leave gaps. */
  let chapterNo = 0;
  const chapter = (title: string) =>
    d.heading(`${tt("Chapter")} ${String(++chapterNo).padStart(2, "0")}`, tt(title));

  /** AI headshots (hair, grooming, eyewear) — 4:5 portrait, keep embed + gallery in sync. */
  const PORTRAIT_RATIO = 5 / 4;
  const portrait = (src?: string) =>
    embedImage(d.doc, src, { w: 4, h: 5, px: 500, position: "top" });
  /** AI look / capsule photos are generated at 9:16 — keep embed + gallery ratio in sync. */
  const LOOK_RATIO = 16 / 9;
  const tall = (src?: string) =>
    embedImage(d.doc, src, { w: 9, h: 16, px: 520, position: "top" });
  const product = (src?: string) =>
    embedImage(d.doc, src, { w: 100, h: 115, px: 380, position: "centre" });
  const matrixOutfit = (src?: string) =>
    embedImage(d.doc, src, { w: 9, h: 16, px: 520, position: "top" });

  /* -------------------------------- cover -------------------------------- */
  const coverPage = d.doc.addPage([PAGE_W, PAGE_H]);
  // Bespoke per-report cover when generated; otherwise the default editorial hero.
  const coverSrc = report.coverImage || "/images/hero-editorial.png";
  const coverBytes = await loadBytes(coverSrc);

  // Full-bleed cover photo. The bespoke cover is composed with the subject to the
  // right and clean, light negative space (left column, top, bottom) for text —
  // so this is a bright editorial cover with DARK type, no darkening scrims.
  const heroBox = { w: PAGE_W, h: PAGE_H, px: 1600, position: "top" as const };
  let heroBuf: Buffer | null = coverBytes ? await cropToBoxJpeg(coverBytes, heroBox) : null;
  let hero: PDFImage | null = null;
  if (heroBuf) {
    try {
      hero = await d.doc.embedJpg(heroBuf);
    } catch {
      hero = null;
      heroBuf = null;
    }
  }
  if (!hero) {
    hero =
      (await embedImage(d.doc, coverSrc, heroBox)) ??
      (report.coverImage
        ? await embedImage(d.doc, "/images/hero-editorial.png", heroBox)
        : null);
  }
  if (hero) {
    coverPage.drawImage(hero, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } else {
    coverPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  }

  d.page = coverPage;

  // No scrims. Type is dark on the light photo; each text zone samples the photo
  // behind it and flips to light only if that zone is unexpectedly dark, so the
  // cover reads whatever the render's brightness.
  const zoneColors = async (region: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) => {
    const lum = coverBytes ? await regionLuma(coverBytes, region) : null;
    const light = (lum ?? 1) > 0.52;
    return { strong: light ? INK : WHITE, soft: light ? STONE : FOG };
  };
  const topC = await zoneColors({ left: 0.05, top: 0.0, width: 0.9, height: 0.13 });
  const leftC = await zoneColors({ left: 0.0, top: 0.28, width: 0.34, height: 0.34 });
  const botC = await zoneColors({ left: 0.0, top: 0.7, width: 0.55, height: 0.3 });
  const roundC = await zoneColors({ left: 0.66, top: 0.14, width: 0.32, height: 0.2 });

  const emblemBytes = await loadBytes("/images/valetti-emblem.png");
  let emblem: PDFImage | null = null;
  try {
    if (emblemBytes) emblem = await d.doc.embedPng(emblemBytes);
  } catch {
    emblem = null;
  }

  // Masthead — a large wordmark tracked to fill the measure, in the clear space
  // above the subject.
  const mast = "VALETTI";
  let mSize = 60;
  let mNat = d.widthTracked(mast, d.serif, mSize, 0);
  while (mNat > CONTENT_W && mSize > 34) {
    mSize -= 1;
    mNat = d.widthTracked(mast, d.serif, mSize, 0);
  }
  const mTrack = mast.length > 1 ? (CONTENT_W - mNat) / (mast.length - 1) : 0;
  const mBaseline = PAGE_H - 84;
  d.drawTracked(mast, MARGIN, mBaseline, mSize, d.serif, WHITE, mTrack, 0.7);
  d.drawTracked(tt("THE PERSONAL STYLE EDIT"), MARGIN, mBaseline - 26, 8, d.bold, topC.soft, 4.5);
  const coverMonth = new Date(report.createdAt)
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    .toUpperCase();
  d.drawTracked(coverMonth, MARGIN, mBaseline - 42, 8, d.bold, BRASS, 4.5);

  // Left-column cover lines — two teasers with a brass rule between, dark on the
  // clean left of the photo. Both are true of every report (colour + tailoring).
  const seasonRaw =
    report.profile.colorSubseason ?? report.profile.colorSeason ?? "";
  const seasonLabel = seasonRaw
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const LCOL_W = 172;
  let ty = 650;
  const drawTeaser = (title: string, body: string) => {
    for (const ln of d.wrapLines(tt(title.toUpperCase()), d.bold, 13.5, LCOL_W)) {
      d.drawTracked(ln, MARGIN, ty, 13.5, d.bold, WHITE, 1.2);
      ty -= 18;
    }
    ty -= 5;
    for (const ln of d.wrapLines(tt(body), d.reg, 11, LCOL_W)) {
      coverPage.drawText(ln, { x: MARGIN, y: ty, size: 11, font: d.reg, color: leftC.soft });
      ty -= 15.5;
    }
  };
  drawTeaser(
    "Colour confidence",
    seasonLabel
      ? `How to wear your ${seasonLabel} palette with quiet impact.`
      : "How to wear your palette with quiet impact.",
  );
  ty -= 12;
  coverPage.drawRectangle({ x: MARGIN, y: ty, width: 42, height: 1.2, color: BRASS });
  ty -= 26;
  drawTeaser(
    "Tailoring that works",
    "Modern cuts, timeless proportions, real results.",
  );

  // Byline roundel, upper-right over the clean wall.
  const R = 46;
  const bcx = PAGE_W - MARGIN - R + 6;
  const bcy = PAGE_H - 224;
  coverPage.drawEllipse({ x: bcx, y: bcy, xScale: R, yScale: R, borderColor: BRASS, borderWidth: 0.9 });
  const centerAt = (
    s: string,
    y: number,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    track: number,
  ) => {
    const w = d.widthTracked(s, font, size, track);
    d.drawTracked(s, bcx - w / 2, y, size, font, color, track);
  };
  centerAt(tt("CARLO"), bcy + 11, 8.5, d.bold, roundC.strong, 2.5);
  centerAt(tt("VALETTI"), bcy + 0.5, 8.5, d.bold, roundC.strong, 2.5);
  let ry = bcy - 11;
  for (const ln of d.wrapLines(tt("On timeless style and personal expression"), d.serifItalic, 6.5, R * 1.5)) {
    const w = d.serifItalic.widthOfTextAtSize(ln, 6.5);
    coverPage.drawText(ln, { x: bcx - w / 2, y: ry - 6.5, size: 6.5, font: d.serifItalic, color: roundC.soft });
    ry -= 9;
  }

  // Headline block, bottom-left on the clean floor. Dark type, no scrim.
  const tierName = report.tier.charAt(0).toUpperCase() + report.tier.slice(1);
  d.drawTracked(tt("THE STYLE REPORT"), MARGIN, 250, 8, d.bold, BRASS, 3);
  const headSize = 30;
  const headLines = d.wrapLines(report.headline, d.serifBold, headSize, CONTENT_W * 0.86);
  let hy = 232;
  for (const ln of headLines) {
    coverPage.drawText(ln, { x: MARGIN, y: hy - headSize, size: headSize, font: d.serifBold, color: WHITE });
    hy -= 34;
  }
  d.drawTracked(`${tierName.toUpperCase()}  ${tt("EDITION")}`, MARGIN, hy - 6, 8.5, d.bold, BRASS, 2.6);
  const when = new Date(report.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  coverPage.drawText(
    `${[report.profile.demographics.city, report.profile.demographics.country]
      .filter(Boolean)
      .join(", ")}  ·  ${when}`,
    { x: MARGIN, y: hy - 24, size: 9.5, font: d.reg, color: botC.soft },
  );

  // Footer maker's-mark: emblem + atelier line.
  const footY = 44;
  let atelierX = MARGIN;
  if (emblem) {
    const eh = 30;
    const ew = eh * (emblem.width / emblem.height);
    coverPage.drawImage(emblem, { x: MARGIN, y: footY - 9, width: ew, height: eh });
    atelierX = MARGIN + ew + 12;
  }
  d.drawTracked(tt("VALETTI STYLE ATELIER"), atelierX, footY + 10, 7.5, d.bold, BRASS, 2.4);
  coverPage.drawText(tt("Clarity. Character. Confidence."), {
    x: atelierX,
    y: footY - 3,
    size: 9,
    font: d.serifItalic,
    color: botC.soft,
  });

  /* ----------------------------- opening page ---------------------------- */
  d.newPage();
  // Centred emblem crest to open the editorial.
  if (emblem) {
    const eh = 42;
    const ew = eh * (emblem.width / emblem.height);
    d.page.drawImage(emblem, {
      x: (PAGE_W - ew) / 2,
      y: d.y - eh,
      width: ew,
      height: eh,
    });
    d.y -= eh + 16;
  }
  d.flowTracked(tt("EDITOR'S NOTE"), {
    size: 8.5,
    font: d.bold,
    color: BRASS,
    tracking: 3,
  });
  d.gap(8);
  d.quote(report.summary);
  d.gap(10);
  d.flowTracked(`${tt("STYLE ARCHETYPE")} · ${extras.archetype.name.toUpperCase()}`, {
    size: 9,
    font: d.bold,
    color: INK,
    tracking: 1.6,
  });
  d.gap(4);
  d.text(extras.archetype.line, { color: STONE, lineGap: 5 });
  d.gap(12);
  d.rule();
  d.subhead(tt("Start here — your three highest-impact moves"), { keepWith: 15 });
  for (const mv of extras.priorityMoves) {
    d.text(`${mv.n}.  ${mv.title}`, { size: 11.5, font: d.bold });
    d.gap(2);
    d.text(mv.why, { color: STONE, lineGap: 4 });
    d.gap(7);
  }

  /* ------------------------------- colours ------------------------------- */
  chapter("Your colours");
  const coreBest = report.colors.best.filter((c) => c.role !== "versatile");
  const officeNeutrals = report.colors.best.filter((c) => c.role === "versatile");
  d.subhead(tt("Colours that work for you"), { keepWith: 16 });
  for (let i = 0; i < coreBest.length; i++) {
    const c = coreBest[i]!;
    const img = await embedFabricSwatch(d.doc, c.hex, `pdfb${i}`);
    d.swatch(c.hex, `${c.name} — ${c.why}`, img);
  }
  if (officeNeutrals.length) {
    d.gap(6);
    d.subhead(tt("Office-ready neutrals"), { keepWith: 20 });
    d.text(
      tt(
        "Versatile dark and neutral tones for suits and formal outfits, chosen in your temperature — they add depth while staying on your palette.",
      ),
      { size: 9.5, color: STONE, lineGap: 3.5 },
    );
    d.gap(4);
    for (let i = 0; i < officeNeutrals.length; i++) {
      const c = officeNeutrals[i]!;
      const img = await embedFabricSwatch(d.doc, c.hex, `pdfn${i}`);
      d.swatch(c.hex, `${c.name} — ${c.why}`, img);
    }
  }
  d.gap(6);
  d.subhead(tt("Colours to avoid"), { keepWith: 16 });
  for (let i = 0; i < report.colors.avoid.length; i++) {
    const c = report.colors.avoid[i]!;
    const img = await embedFabricSwatch(d.doc, c.hex, `pdfa${i}`);
    d.swatch(c.hex, `${c.name} — ${c.why}`, img);
  }
  d.gap(6);
  d.subhead(tt("How to combine them"), { keepWith: 15 });
  if (extras.pairings.hero)
    d.text(`${tt("Hero colour near the face:")} ${extras.pairings.hero.name}.`, {
      color: STONE,
    });
  d.gap(2);
  for (const combo of extras.pairings.combos) d.bullet(`${combo.name} — ${combo.why}`);
  d.gap(6);
  d.subhead(tt("Metals & hardware"), { keepWith: 14 });
  for (const mt of extras.metals.recommend) d.swatch(mt.hex, `${mt.name} — ${mt.why}`);
  d.text(extras.metals.avoidNote, { size: 9, color: STONE });
  d.gap(6);

  if (report.tier === "lookbook" || report.tier === "premium") {
    const watch = extras.watchGuide;
    d.subhead(tt("Watches"), { keepWith: 20 });
    d.text(watch.intro, { size: 9.5, color: STONE, lineGap: 3.5 });
    d.gap(4);
    const watchImg = report.watchImage
      ? await embedImage(d.doc, report.watchImage, { w: 4, h: 3, px: 700 })
      : null;
    if (watchImg) d.banner(watchImg, Math.round((CONTENT_W * 3) / 4));
    for (const v of watch.variants) {
      d.text(`${v.type} — ${v.context}`, { size: 11, font: d.bold, lineGap: 2 });
      if (v.shape) d.text(`${tt("Shape")}: ${v.shape}`, { size: 8.5, color: STONE });
      d.swatch(v.caseHex, `${tt("Case")}: ${v.caseMetal}`);
      d.swatch(v.dialHex, `${tt("Dial")}: ${v.dial}`);
      d.swatch(v.strapHex, `${tt("Strap")}: ${v.strap}`);
      d.text(v.why, { size: 9, color: STONE, lineGap: 3 });
      d.gap(5);
    }
    if (watch.shapeNote) {
      d.text(watch.shapeNote, { size: 9, color: STONE, lineGap: 3.5 });
      d.gap(2);
    }
    d.text(watch.cuffNote, { size: 9, color: STONE, lineGap: 3.5 });
    d.gap(2);
    d.text(watch.avoidNote, { size: 9, color: STONE, lineGap: 3.5 });
    d.gap(6);
  }

  d.subhead(`${tt("Your colour DNA")} — ${extras.colorDNA.subseason}`, { keepWith: 14 });
  d.text(`${tt("Neutrals:")} ${extras.colorDNA.neutrals.map((c) => c.name).join(", ")}`, {
    color: STONE,
  });
  d.text(`${tt("Best white:")} ${extras.colorDNA.bestWhite}`, { color: STONE });
  d.text(`${tt("Best denim:")} ${extras.colorDNA.bestDenim}`, { color: STONE });
  d.text(`${tt("Metal:")} ${extras.colorDNA.metal}`, { color: STONE });
  d.text(`${tt("Instead of black:")} ${extras.colorDNA.blackAlt}`, { color: STONE });
  d.text(`${tt("Contrast:")} ${extras.colorDNA.contrastRule}`, { color: STONE });

  /* -------------------------- hair, beard, eyewear ----------------------- */
  chapter("Hair, beard & eyewear");

  const recItems: GalleryItem[] = [];
  for (const h of report.hair.recommend) {
    recItems.push({
      img: await portrait(h.image),
      title: h.name,
      sub: h.why,
      label: tt("Recommended"),
    });
    if (h.imageSide) {
      recItems.push({
        img: await portrait(h.imageSide),
        title: `${h.name} — ${tt("side view")}`,
        sub: tt("Three-quarter angle showing the cut shape."),
        label: tt("Side"),
      });
    }
  }
  if (recItems.length) {
    d.gallerySection(tt("Hairstyles for your face"), recItems, {
      cols: 2,
      ratio: PORTRAIT_RATIO,
    });
  }

  const avoidItems: GalleryItem[] = [];
  for (const h of report.hair.avoid) {
    avoidItems.push({
      img: await portrait(h.image),
      title: h.name,
      sub: h.why,
      label: tt("Best avoided"),
    });
  }
  if (avoidItems.length) {
    d.gallerySection(tt("Best avoided"), avoidItems, {
      cols: 2,
      ratio: PORTRAIT_RATIO,
    });
  }

  d.subhead(tt("Beard, skin & grooming"), { keepWith: 28 });
  for (const g of extras.grooming) {
    d.text(g.title, { size: 9.5, font: d.bold });
    d.text(g.detail, { color: STONE });
    d.gap(3);
  }

  if (extras.barberBlueprint?.length) {
    d.gap(6);
    d.subhead(tt("Barber blueprint — what to tell your barber"), { keepWith: 28 });
    for (const s of extras.barberBlueprint) {
      d.text(`${s.part}: ${s.spec}`, { font: d.bold, size: 9.5 });
      d.text(s.why, { x: MARGIN + 12, width: CONTENT_W - 12, color: STONE });
      d.gap(3);
    }
  }

  if (report.facialHair?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.facialHair) {
      items.push({ img: await portrait(item.image), title: item.name, sub: item.why });
    }
    d.gallerySection(tt("Recommended facial hair"), items, {
      cols: 2,
      ratio: PORTRAIT_RATIO,
    });
  }

  if (report.eyewear?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.eyewear) {
      const kind =
        item.kind === "sun"
          ? tt("Sunglasses")
          : item.kind === "optical"
            ? tt("Optical")
            : tt("Glasses");
      items.push({
        img: await portrait(item.image),
        title: item.name,
        sub: item.why,
        label: kind,
      });
    }
    d.gallerySection(tt("Eyewear for your face"), items, {
      cols: 2,
      ratio: PORTRAIT_RATIO,
    });
  } else if (report.tier !== "premium") {
    // Static shape guide is a non-premium fallback; Premium always ships
    // personalized eyewear previews instead (see pricing matrix).
    const items: GalleryItem[] = [];
    for (const f of extras.eyewear.recommend) {
      items.push({
        img: await embedImage(d.doc, `/images/eyewear/eyewear-${f.shape}.png`, {
          w: 100,
          h: 72,
          px: 420,
          position: "centre",
        }),
        title: f.name,
        sub: f.why,
      });
    }
    d.gallerySection(tt("Eyewear for your face"), items, { cols: 2, ratio: 0.72 });
    d.gap(2);
    d.text(`${tt("Avoid:")} ${extras.eyewear.avoid.join("  ·  ")}`, { size: 9, color: STONE });
  }

  if (report.accessories?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.accessories) {
      items.push({ img: await portrait(item.image), title: item.name, sub: item.why });
    }
    d.gallerySection(tt("Accessory styling"), items, {
      cols: 2,
      ratio: PORTRAIT_RATIO,
    });
  }

  if (report.headwear?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.headwear) {
      items.push({ img: await portrait(item.image), title: item.name, sub: item.why });
    }
    d.gallerySection(tt("Headwear"), items, {
      cols: 2,
      ratio: PORTRAIT_RATIO,
    });
  }

  /* ---------------------------- silhouette & fit ------------------------- */
  chapter("Silhouette & fit");
  const bt = report.profile.physical.bodyType;
  const btLabel = isBodyType(bt) ? BODY_TYPE_LABELS[bt] : bt;
  d.flowTracked(`${tt("BODY TYPE")} · ${tt(String(btLabel)).toUpperCase()}`, {
    size: 8.5,
    font: d.bold,
    color: BRASS,
    tracking: 2,
  });
  d.gap(4);
  d.text(report.silhouette.fit, { size: 13, font: d.serifItalic, lineGap: 6 });
  d.gap(4);
  for (const r of report.silhouette.rules) d.bullet(r);
  const m = report.profile.physical.measurements;
  if (m && Object.values(m).some((v) => v != null)) {
    d.gap(5);
    const parts = [
      m.shoulderCm && `${tt("Shoulders")} ${m.shoulderCm} ${tt("cm")}`,
      m.chestCm && `${tt("Chest")} ${m.chestCm} ${tt("cm")}`,
      m.waistCm && `${tt("Waist")} ${m.waistCm} ${tt("cm")}`,
      m.hipCm && `${tt("Hips")} ${m.hipCm} ${tt("cm")}`,
      m.sleeveCm && `${tt("Sleeve")} ${m.sleeveCm} ${tt("cm")}`,
    ].filter(Boolean);
    d.subhead(tt("Measurements"), { keepWith: 14 });
    d.text(parts.join("   ·   "), { color: STONE });
  }
  d.gap(6);
  d.subhead(tt("Fit blueprint — what to tell your tailor"), { keepWith: 28 });
  for (const s of extras.fitBlueprint) {
    d.text(`${s.part}: ${s.spec}`, { font: d.bold, size: 9.5 });
    d.text(s.why, { x: MARGIN + 12, width: CONTENT_W - 12, color: STONE });
    d.gap(3);
  }

  /* -------------------------------- looks -------------------------------- */
  chapter("Your looks");
  const lookItems: GalleryItem[] = [];
  for (let i = 0; i < report.looks.length; i++) {
    const l = report.looks[i]!;
    const shopItems =
      (report.lookItems?.[i]?.length
        ? report.lookItems[i]
        : itemsForLook(l, report.shopping)) ?? [];
    const shop = shopItems.map((it) => it.title).join(", ");
    lookItems.push({
      img: await tall(l.image),
      title: `${l.context} — ${l.title}`,
      sub: l.description,
      meta: shop ? `${tt("Shop a look like this:")} ${shop}` : undefined,
      label: l.context,
    });
    // The "on you" render (from the user's own photo) sits beside its look, so
    // the two land side by side in the 2-col grid. Only when one was generated.
    if (l.tryOnImage) {
      lookItems.push({
        img: await tall(l.tryOnImage),
        title: tt(`${l.title} — on you`),
        sub: tt("This look rendered on your photo."),
        label: tt("On you"),
      });
    }
  }
  d.gallery(lookItems, { cols: 2, ratio: LOOK_RATIO });

  /* -------------------------- capsule & buying plan ---------------------- */
  // Lookbook & Premium only — the wardrobe system is not part of a Basic report.
  if (includeCapsule) {
    chapter("Capsule & buying plan");
    d.text(
      tt(
        "{pieces} core pieces unlock roughly {outfits} outfits with what you already own. Buy them in three phases:",
      )
        .replace("{pieces}", String(extras.capsule.pieces))
        .replace("{outfits}", String(extras.capsule.outfits)),
      { color: STONE, lineGap: 5 },
    );
    d.gap(5);
    const phase = async (label: string, items: typeof extras.capsule.now) => {
      if (!items.length) return;
      const cards: GalleryItem[] = [];
      for (const i of items) {
        cards.push({
          img: await product(i.image),
          title: humanizeProductTitle(i.title),
          meta: formatMoneyPdf(i.priceEur, cur),
        });
      }
      d.gallerySection(label, cards, { cols: 3, ratio: 1.15 });
      d.gap(3);
    };
    await phase(tt("Buy now"), extras.capsule.now);
    await phase(tt("Next"), extras.capsule.next);
    await phase(tt("Later"), extras.capsule.later);
    d.gap(2);
    const matrixItems: GalleryItem[] = [];
    for (let i = 0; i < extras.matrix.length; i++) {
      const c = extras.matrix[i]!;
      matrixItems.push({
        img: await matrixOutfit(capsuleMatrixImageAt(report, i)),
        title: c.context,
        sub: c.pieces.map(humanizeProductTitle).join("  +  "),
        label: c.context,
      });
    }
    if (matrixItems.length) {
      d.text(
        tt(
          "The same handful of pieces, recombined into a full week of outfits — so nothing in your wardrobe sits unused.",
        ),
        { color: STONE, lineGap: 5 },
      );
      d.gap(4);
      const matrixWithPhotos = matrixItems.filter((it) => it.img);
      if (matrixWithPhotos.length) {
        d.gallerySection(tt("Outfit matrix — mix & match"), matrixWithPhotos, {
          cols: 2,
          ratio: LOOK_RATIO,
        });
      } else {
        d.subhead(tt("Outfit matrix — mix & match"));
        for (const c of extras.matrix) {
          d.text(`${c.context}`, { font: d.bold, size: 9.5 });
          d.text(c.pieces.map(humanizeProductTitle).join("  +  "), { color: STONE });
          d.gap(3);
        }
      }
    }
    d.gap(4);
    d.subhead(tt("Good / Better / Best — where to spend"), { keepWith: 28 });
    for (const t of extras.priceTiers) {
      d.text(`${t.category}`, { size: 9.5, font: d.bold });
      d.text(
        `${formatMoneyPdf(t.good, cur)} / ${formatMoneyPdf(t.better, cur)} / ${formatMoneyPdf(t.best, cur)} — ${t.note}`,
        { color: STONE },
      );
      d.gap(3);
    }
  }

  /* ----------------------------- shopping list --------------------------- */
  chapter("Your shopping list");
  const shopGallery: GalleryItem[] = [];
  for (const item of report.shopping) {
    shopGallery.push({
      img: await product(item.image),
      title: humanizeProductTitle(item.title),
      sub: item.why,
      meta: `${item.retailer}  ·  ${formatMoneyPdf(item.priceEur, cur)} · ${tt(investmentLevel(item))}`,
    });
  }
  d.gallery(shopGallery, { cols: 3, ratio: 1.15 });

  /* ------------------------ patterns & finishing ------------------------- */
  chapter("Patterns & finishing details");
  d.subhead(tt("Fabrics & texture"), { keepWith: 28 });
  for (const f of extras.fabrics) {
    d.text(f.name, { size: 9.5, font: d.bold });
    d.text(f.why, { color: STONE });
    d.gap(3);
  }
  d.gap(2);
  d.subhead(tt("Patterns"), { keepWith: 14 });
  d.text(tt("Solid · Fine stripe · Gingham check · Tartan"), { color: STONE });
  d.gap(4);
  d.subhead(tt("Accessories"), { keepWith: 14 });
  d.text(
    tt(
      "Field watch (cream dial) · Leather belt matched to shoes · Warm tortoiseshell sunglasses · One minimal chain",
    ),
    { color: STONE, lineGap: 5 },
  );
  d.gap(4);
  d.subhead(tt("Shoe guide"), { keepWith: 14 });
  d.text(tt("Cream sneakers · Suede chelsea boots · Derby shoes"), { color: STONE });

  /* ----------------------- how to wear, care & scent --------------------- */
  chapter("How to wear it, and make it last");
  d.subhead(tt("How to wear it"), { keepWith: 15 });
  for (const s of extras.styling) d.bullet(s);
  d.gap(4);
  d.subhead(tt("Care & longevity"), { keepWith: 15 });
  for (const s of extras.care) d.bullet(s);
  d.gap(4);
  d.subhead(tt("Signature scent"), { keepWith: 14 });
  d.text(extras.fragrance, { color: STONE, lineGap: 5 });

  /* ------------------------------ do & don't ----------------------------- */
  chapter("Do & don't");
  d.subhead(tt("Do"), { keepWith: 15 });
  for (const x of report.doList) d.bullet(x);
  d.gap(6);
  d.subhead(tt("Avoid"), { keepWith: 15 });
  for (const x of report.dontList) {
    const lh = 10.5 + 4;
    const lines = d.wrapLines(x, d.reg, 10.5, CONTENT_W - 12);
    lines.forEach((ln, i) => {
      d.ensure(lh);
      if (i === 0) {
        d.drawTracked("x", MARGIN + 1, d.y - 10.5 + 1, 9, d.bold, BRASS, 0);
      }
      d.page.drawText(ln, { x: MARGIN + 12, y: d.y - 10.5 + 1, size: 10.5, font: d.reg, color: STONE });
      d.y -= lh;
    });
  }

  /* ------------------------------- sign-off ------------------------------ */
  const sigBytes = await loadBytes("/images/signature-carlo-valetti.png");
  let sigPng: PDFImage | null = null;
  try {
    if (sigBytes) sigPng = await d.doc.embedPng(sigBytes);
  } catch {
    sigPng = null;
  }
  // QR code linking to the live report, drawn on the left opposite the signature.
  let qrPng: PDFImage | null = null;
  try {
    const qrBuf = await QRCode.toBuffer(absoluteUrl(`/report/${report.id}`), {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#1F1C1A", light: "#FAF7F0" },
    });
    qrPng = await d.doc.embedPng(qrBuf);
  } catch {
    qrPng = null;
  }
  const sigW = 190;
  const sigH = sigPng ? sigW * (sigPng.height / sigPng.width) : 0;
  const rightEdge = PAGE_W - MARGIN;
  d.ensure(40 + Math.max(sigH, 88 + 12) + 40);
  d.gap(22);
  d.rule();
  d.gap(4);
  // Closing line, right-aligned above the signature.
  const closing = d.sanitize(tt("With care for the details,"));
  const cw = d.serifItalic.widthOfTextAtSize(closing, 12);
  d.ensure(12 + 8);
  d.page.drawText(closing, {
    x: rightEdge - cw,
    y: d.y - 12,
    size: 12,
    font: d.serifItalic,
    color: STONE,
  });
  d.y -= 12 + 8;
  if (sigPng) {
    const sigTop = d.y;
    d.page.drawImage(sigPng, {
      x: rightEdge - sigW,
      y: sigTop - sigH,
      width: sigW,
      height: sigH,
    });
    // QR on the left, vertically centred on the signature.
    if (qrPng) {
      const q = 88;
      const qy = sigTop - sigH / 2 - q / 2;
      d.page.drawImage(qrPng, { x: MARGIN, y: qy, width: q, height: q });
      d.page.drawText(d.sanitize(tt("Scan to view online")), {
        x: MARGIN,
        y: qy - 11,
        size: 7.5,
        font: d.reg,
        color: STONE,
      });
    }
    d.y -= sigH + 4;
  } else if (qrPng) {
    const q = 88;
    d.page.drawImage(qrPng, { x: MARGIN, y: d.y - q, width: q, height: q });
    d.page.drawText(d.sanitize(tt("Scan to view online")), {
      x: MARGIN,
      y: d.y - q - 11,
      size: 7.5,
      font: d.reg,
      color: STONE,
    });
  }
  d.page.drawLine({
    start: { x: rightEdge - 150, y: d.y },
    end: { x: rightEdge, y: d.y },
    thickness: 0.75,
    color: LINE,
  });
  d.gap(11);
  const sigName = "CARLO VALETTI";
  const nw = d.widthTracked(sigName, d.bold, 9, 2);
  d.ensure(9 + 4);
  d.drawTracked(sigName, rightEdge - nw, d.y - 9, 9, d.bold, INK, 2);
  d.y -= 9 + 4;

  return d.doc.save();
}
