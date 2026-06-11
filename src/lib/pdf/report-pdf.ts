import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { StyleReport } from "@/lib/report";
import { formatMoneyPdf } from "@/lib/currency";
import { BODY_TYPE_LABELS, isBodyType } from "@/lib/style-profile";
import { capsuleMatrixImageAt } from "@/lib/demo-report";
import { buildExtras, investmentLevel, itemsForLook } from "@/lib/style-extras";

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

/**
 * pdf-lib's StandardFonts use WinAnsi (Latin-1) and cannot render Latin-Extended
 * letters such as "č" (CZK "Kč") or "ł" (PLN "zł"). Transliterate the common
 * Central-European letters to ASCII so prices and names render cleanly instead
 * of turning into "?".
 */
const EXT_LATIN: Record<string, string> = {
  č: "c", Č: "C", š: "s", Š: "S", ž: "z", Ž: "Z", ř: "r", Ř: "R",
  ě: "e", Ě: "E", ů: "u", Ů: "U", ť: "t", Ť: "T", ď: "d", Ď: "D",
  ň: "n", Ň: "N", ł: "l", Ł: "L", ą: "a", Ą: "A", ę: "e", Ę: "E",
  ń: "n", Ń: "N", ś: "s", Ś: "S", ż: "z", Ż: "Z", ź: "z", Ź: "Z",
  ć: "c", Ć: "C",
};
const EXT_LATIN_RE = new RegExp(`[${Object.keys(EXT_LATIN).join("")}]`, "g");

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0.8, 0.8, 0.8);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function loadBytes(src: string): Promise<Uint8Array | null> {
  try {
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
 * Embed an image from a public path or remote URL, cover-cropped to the target
 * box aspect (w:h) and re-encoded to JPEG. Cropping is required because pdf-lib
 * cannot clip overflow, and JPEG keeps the PDF small.
 */
async function embedImage(
  doc: PDFDocument,
  src: string | undefined,
  box: { w: number; h: number; px?: number; position?: string },
): Promise<PDFImage | null> {
  if (!src) return null;
  const bytes = await loadBytes(src);
  if (!bytes) return null;
  const px = box.px ?? 260;
  try {
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(bytes)
      .resize({
        width: px,
        height: Math.round((px * box.h) / box.w),
        fit: "cover",
        position: box.position ?? "centre",
      })
      .jpeg({ quality: 78 })
      .toBuffer();
    return await doc.embedJpg(jpeg);
  } catch {
    try {
      if (bytes[0] === 0x89 && bytes[1] === 0x50)
        return await doc.embedPng(bytes);
      return await doc.embedJpg(bytes);
    } catch {
      return null;
    }
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
    d.reg = await d.doc.embedFont(StandardFonts.Helvetica);
    d.bold = await d.doc.embedFont(StandardFonts.HelveticaBold);
    d.serif = await d.doc.embedFont(StandardFonts.TimesRoman);
    d.serifBold = await d.doc.embedFont(StandardFonts.TimesRomanBold);
    d.serifItalic = await d.doc.embedFont(StandardFonts.TimesRomanItalic);
    return d;
  }

  // StandardFonts use WinAnsi — transliterate / strip characters pdf-lib can't encode.
  sanitize(str: string) {
    return str
      .replace(/\u20AC/g, "EUR")
      .replace(/[\u2192\u2794\u279C]/g, "->")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2026]/g, "...")
      .replace(EXT_LATIN_RE, (ch) => EXT_LATIN[ch] ?? ch)
      .replace(/[^\n\r\t\x20-\xFF]/g, "?");
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
  ) {
    let cx = x;
    for (const ch of this.sanitize(str)) {
      this.page.drawText(ch, { x: cx, y, size, font, color });
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

  swatch(hex: string, label: string) {
    const size = 10;
    const lh = 11 + 5;
    const lines = this.wrapLines(label, this.reg, 10, CONTENT_W - 22);
    this.ensure(Math.max(size, lines.length * lh));
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - size - 1,
      width: size,
      height: size,
      color: hexToRgb(hex),
      borderColor: LINE,
      borderWidth: 0.5,
    });
    let yy = top;
    for (const ln of lines) {
      this.page.drawText(ln, {
        x: MARGIN + 20,
        y: yy - 10 + 1,
        size: 10,
        font: this.reg,
        color: INK,
      });
      yy -= lh;
    }
    this.y = Math.min(top - size - 1, yy);
    this.gap(3);
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
  const extras = buildExtras(report);

  const portrait = (src?: string) =>
    embedImage(d.doc, src, { w: 100, h: 125, px: 500, position: "top" });
  const tall = (src?: string) =>
    embedImage(d.doc, src, { w: 100, h: 140, px: 520, position: "top" });
  const product = (src?: string) =>
    embedImage(d.doc, src, { w: 100, h: 115, px: 380, position: "centre" });
  const matrixOutfit = (src?: string) =>
    embedImage(d.doc, src, { w: 100, h: 178, px: 520, position: "top" });

  /* -------------------------------- cover -------------------------------- */
  const coverPage = d.doc.addPage([PAGE_W, PAGE_H]);
  const hero = await embedImage(d.doc, "/images/hero-editorial.png", {
    w: PAGE_W,
    h: PAGE_H,
    px: 1400,
    position: "top",
  });
  if (hero) {
    coverPage.drawImage(hero, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } else {
    coverPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: INK });
  }
  // Legibility scrims top & bottom.
  coverPage.drawRectangle({
    x: 0,
    y: PAGE_H - 150,
    width: PAGE_W,
    height: 150,
    color: INK,
    opacity: 0.32,
  });
  coverPage.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: 320,
    color: INK,
    opacity: 0.55,
  });

  // Masthead.
  d.page = coverPage;
  const mast = "VALETTI";
  const mastW = d.widthTracked(mast, d.serif, 34, 12);
  d.drawTracked(mast, (PAGE_W - mastW) / 2, PAGE_H - 92, 34, d.serif, WHITE, 12);
  const tagline = "THE PERSONAL STYLE EDIT";
  const tagW = d.widthTracked(tagline, d.reg, 8.5, 4.5);
  d.drawTracked(tagline, (PAGE_W - tagW) / 2, PAGE_H - 116, 8.5, d.reg, FOG, 4.5);

  // Headline + meta in the lower band.
  const issueW = d.widthTracked("THE STYLE REPORT", d.bold, 8, 3);
  d.drawTracked("THE STYLE REPORT", MARGIN, 224, 8, d.bold, BRASS, 3);
  void issueW;
  const headLines = d.wrapLines(report.headline, d.serifBold, 31, CONTENT_W);
  let hy = 206;
  for (const ln of headLines) {
    coverPage.drawText(ln, { x: MARGIN, y: hy - 31, size: 31, font: d.serifBold, color: WHITE });
    hy -= 36;
  }
  const when = new Date(report.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const tierName = report.tier.charAt(0).toUpperCase() + report.tier.slice(1);
  d.drawTracked(
    `${tierName.toUpperCase()} EDITION`,
    MARGIN,
    hy - 6,
    8.5,
    d.bold,
    FOG,
    2.6,
  );
  coverPage.drawText(
    `${report.profile.demographics.city}, ${report.profile.demographics.country}  ·  ${when}`,
    { x: MARGIN, y: hy - 26, size: 9.5, font: d.reg, color: FOG },
  );
  coverPage.drawText("Prepared by Carlo Valetti  ·  AI style atelier, Valetti", {
    x: MARGIN,
    y: hy - 42,
    size: 9.5,
    font: d.serifItalic,
    color: FOG,
  });

  /* ----------------------------- opening page ---------------------------- */
  d.newPage();
  d.flowTracked("EDITOR'S NOTE", {
    size: 8.5,
    font: d.bold,
    color: BRASS,
    tracking: 3,
  });
  d.gap(8);
  d.quote(report.summary);
  d.gap(10);
  d.flowTracked(`STYLE ARCHETYPE · ${extras.archetype.name.toUpperCase()}`, {
    size: 9,
    font: d.bold,
    color: INK,
    tracking: 1.6,
  });
  d.gap(4);
  d.text(extras.archetype.line, { color: STONE, lineGap: 5 });
  d.gap(12);
  d.rule();
  d.subhead("Start here — your three highest-impact moves", { keepWith: 15 });
  for (const mv of extras.priorityMoves) {
    d.text(`${mv.n}.  ${mv.title}`, { size: 11.5, font: d.bold });
    d.gap(2);
    d.text(mv.why, { color: STONE, lineGap: 4 });
    d.gap(7);
  }

  /* ------------------------------- colours ------------------------------- */
  d.heading("Chapter 01", "Your colours");
  d.subhead("Colours that work for you", { keepWith: 16 });
  for (const c of report.colors.best) d.swatch(c.hex, `${c.name} — ${c.why}`);
  d.gap(6);
  d.subhead("Colours to avoid", { keepWith: 16 });
  for (const c of report.colors.avoid) d.swatch(c.hex, `${c.name} — ${c.why}`);
  d.gap(6);
  d.subhead("How to combine them", { keepWith: 15 });
  if (extras.pairings.hero)
    d.text(`Hero colour near the face: ${extras.pairings.hero.name}.`, {
      color: STONE,
    });
  d.gap(2);
  for (const combo of extras.pairings.combos) d.bullet(`${combo.name} — ${combo.why}`);
  d.gap(6);
  d.subhead("Metals & hardware", { keepWith: 14 });
  for (const mt of extras.metals.recommend) d.swatch(mt.hex, `${mt.name} — ${mt.why}`);
  d.text(extras.metals.avoidNote, { size: 9, color: STONE });
  d.gap(6);
  d.subhead(`Your colour DNA — ${extras.colorDNA.subseason}`, { keepWith: 14 });
  d.text(`Neutrals: ${extras.colorDNA.neutrals.map((c) => c.name).join(", ")}`, {
    color: STONE,
  });
  d.text(`Best white: ${extras.colorDNA.bestWhite}`, { color: STONE });
  d.text(`Best denim: ${extras.colorDNA.bestDenim}`, { color: STONE });
  d.text(`Metal: ${extras.colorDNA.metal}`, { color: STONE });
  d.text(`Instead of black: ${extras.colorDNA.blackAlt}`, { color: STONE });
  d.text(`Contrast: ${extras.colorDNA.contrastRule}`, { color: STONE });

  /* -------------------------- hair, beard, eyewear ----------------------- */
  d.heading("Chapter 02", "Hair, beard & eyewear");

  const recItems: GalleryItem[] = [];
  for (const h of report.hair.recommend) {
    recItems.push({
      img: await portrait(h.image),
      title: h.name,
      sub: h.why,
      label: "Recommended",
    });
    if (h.imageSide) {
      recItems.push({
        img: await portrait(h.imageSide),
        title: `${h.name} — side view`,
        sub: "Three-quarter angle showing the cut shape.",
        label: "Side",
      });
    }
  }
  if (recItems.length) {
    d.gallerySection("Hairstyles for your face", recItems, {
      cols: 2,
      ratio: 1.25,
    });
  }

  const avoidItems: GalleryItem[] = [];
  for (const h of report.hair.avoid) {
    avoidItems.push({
      img: await portrait(h.image),
      title: h.name,
      sub: h.why,
      label: "Best avoided",
    });
  }
  if (avoidItems.length) {
    d.gallerySection("Best avoided", avoidItems, { cols: 2, ratio: 1.25 });
  }

  d.subhead("Beard, skin & grooming", { keepWith: 28 });
  for (const g of extras.grooming) {
    d.text(g.title, { size: 9.5, font: d.bold });
    d.text(g.detail, { color: STONE });
    d.gap(3);
  }

  if (report.facialHair?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.facialHair) {
      items.push({ img: await portrait(item.image), title: item.name, sub: item.why });
    }
    d.gallerySection("Recommended facial hair", items, { cols: 2, ratio: 1.25 });
  }

  if (report.eyewear?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.eyewear) {
      const kind =
        item.kind === "sun" ? "Sunglasses" : item.kind === "optical" ? "Optical" : "Glasses";
      items.push({
        img: await portrait(item.image),
        title: item.name,
        sub: item.why,
        label: kind,
      });
    }
    d.gallerySection("Eyewear for your face", items, { cols: 2, ratio: 1.25 });
  } else {
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
    d.gallerySection("Eyewear for your face", items, { cols: 2, ratio: 0.72 });
  }
  d.gap(2);
  d.text(`Avoid: ${extras.eyewear.avoid.join("  ·  ")}`, { size: 9, color: STONE });

  if (report.accessories?.length) {
    const items: GalleryItem[] = [];
    for (const item of report.accessories) {
      items.push({ img: await portrait(item.image), title: item.name, sub: item.why });
    }
    d.gallerySection("Accessory styling", items, { cols: 2, ratio: 1.25 });
  }

  /* ---------------------------- silhouette & fit ------------------------- */
  d.heading("Chapter 03", "Silhouette & fit");
  const bt = report.profile.physical.bodyType;
  const btLabel = isBodyType(bt) ? BODY_TYPE_LABELS[bt] : bt;
  d.flowTracked(`BODY TYPE · ${String(btLabel).toUpperCase()}`, {
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
      m.shoulderCm && `Shoulders ${m.shoulderCm} cm`,
      m.chestCm && `Chest ${m.chestCm} cm`,
      m.waistCm && `Waist ${m.waistCm} cm`,
      m.hipCm && `Hips ${m.hipCm} cm`,
      m.sleeveCm && `Sleeve ${m.sleeveCm} cm`,
    ].filter(Boolean);
    d.subhead("Measurements", { keepWith: 14 });
    d.text(parts.join("   ·   "), { color: STONE });
  }
  d.gap(6);
  d.subhead("Fit blueprint — what to tell your tailor", { keepWith: 28 });
  for (const s of extras.fitBlueprint) {
    d.text(`${s.part}: ${s.spec}`, { font: d.bold, size: 9.5 });
    d.text(s.why, { x: MARGIN + 12, width: CONTENT_W - 12, color: STONE });
    d.gap(3);
  }

  /* -------------------------------- looks -------------------------------- */
  d.heading("Chapter 04", "Your looks");
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
      meta: shop ? `Shop a look like this: ${shop}` : undefined,
      label: l.context,
    });
  }
  d.gallery(lookItems, { cols: 2, ratio: 1.4 });

  /* -------------------------- capsule & buying plan ---------------------- */
  d.heading("Chapter 05", "Capsule & buying plan");
  d.text(
    `${extras.capsule.pieces} core pieces unlock roughly ${extras.capsule.outfits} outfits with what you already own. Buy them in three phases:`,
    { color: STONE, lineGap: 5 },
  );
  d.gap(5);
  const phase = async (label: string, items: typeof extras.capsule.now) => {
    if (!items.length) return;
    const cards: GalleryItem[] = [];
    for (const i of items) {
      cards.push({
        img: await product(i.image),
        title: i.title,
        meta: formatMoneyPdf(i.priceEur, cur),
      });
    }
    d.gallerySection(label, cards, { cols: 3, ratio: 1.15 });
    d.gap(3);
  };
  await phase("Buy now", extras.capsule.now);
  await phase("Next", extras.capsule.next);
  await phase("Later", extras.capsule.later);
  d.gap(2);
  const matrixItems: GalleryItem[] = [];
  for (let i = 0; i < extras.matrix.length; i++) {
    const c = extras.matrix[i]!;
    matrixItems.push({
      img: await matrixOutfit(capsuleMatrixImageAt(report, i)),
      title: c.context,
      sub: c.pieces.join("  +  "),
      label: c.context,
    });
  }
  if (matrixItems.length) {
    d.text(
      "The same handful of pieces, recombined into a full week of outfits — so nothing in your wardrobe sits unused.",
      { color: STONE, lineGap: 5 },
    );
    d.gap(4);
    d.gallerySection("Outfit matrix — mix & match", matrixItems, {
      cols: 2,
      ratio: 16 / 9,
    });
  }
  d.gap(4);
  d.subhead("Good / Better / Best — where to spend", { keepWith: 28 });
  for (const t of extras.priceTiers) {
    d.text(`${t.category}`, { size: 9.5, font: d.bold });
    d.text(
      `${formatMoneyPdf(t.good, cur)} / ${formatMoneyPdf(t.better, cur)} / ${formatMoneyPdf(t.best, cur)} — ${t.note}`,
      { color: STONE },
    );
    d.gap(3);
  }

  /* ----------------------------- shopping list --------------------------- */
  d.heading("Chapter 06", "Your shopping list");
  const shopGallery: GalleryItem[] = [];
  for (const item of report.shopping) {
    shopGallery.push({
      img: await product(item.image),
      title: item.title,
      sub: item.why,
      meta: `${item.retailer}  ·  ${formatMoneyPdf(item.priceEur, cur)} · ${investmentLevel(item)}`,
    });
  }
  d.gallery(shopGallery, { cols: 3, ratio: 1.15 });

  /* ------------------------ patterns & finishing ------------------------- */
  d.heading("Chapter 07", "Patterns & finishing details");
  d.subhead("Fabrics & texture", { keepWith: 28 });
  for (const f of extras.fabrics) {
    d.text(f.name, { size: 9.5, font: d.bold });
    d.text(f.why, { color: STONE });
    d.gap(3);
  }
  d.gap(2);
  d.subhead("Patterns", { keepWith: 14 });
  d.text("Solid · Fine stripe · Gingham check · Tartan", { color: STONE });
  d.gap(4);
  d.subhead("Accessories", { keepWith: 14 });
  d.text(
    "Field watch (cream dial) · Leather belt matched to shoes · Warm tortoiseshell sunglasses · One minimal chain",
    { color: STONE, lineGap: 5 },
  );
  d.gap(4);
  d.subhead("Shoe guide", { keepWith: 14 });
  d.text("Cream sneakers · Suede chelsea boots · Derby shoes", { color: STONE });

  /* ----------------------- how to wear, care & scent --------------------- */
  d.heading("Chapter 08", "How to wear it, and make it last");
  d.subhead("How to wear it", { keepWith: 15 });
  for (const s of extras.styling) d.bullet(s);
  d.gap(4);
  d.subhead("Care & longevity", { keepWith: 15 });
  for (const s of extras.care) d.bullet(s);
  d.gap(4);
  d.subhead("Signature scent", { keepWith: 14 });
  d.text(extras.fragrance, { color: STONE, lineGap: 5 });

  /* ------------------------------ do & don't ----------------------------- */
  d.heading("Chapter 09", "Do & don't");
  d.subhead("Do", { keepWith: 15 });
  for (const x of report.doList) d.bullet(x);
  d.gap(6);
  d.subhead("Avoid", { keepWith: 15 });
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
  const sigW = 190;
  const sigH = sigPng ? sigW * (sigPng.height / sigPng.width) : 0;
  const rightEdge = PAGE_W - MARGIN;
  d.ensure(40 + sigH + 40);
  d.gap(22);
  d.rule();
  d.gap(4);
  // Closing line, right-aligned above the signature.
  const closing = d.sanitize("With care for the details,");
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
    d.page.drawImage(sigPng, {
      x: rightEdge - sigW,
      y: d.y - sigH,
      width: sigW,
      height: sigH,
    });
    d.y -= sigH + 4;
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
