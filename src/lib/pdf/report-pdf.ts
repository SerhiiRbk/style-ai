import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { StyleReport } from "@/lib/report";
import { formatMoney } from "@/lib/currency";
import { BODY_TYPE_LABELS, isBodyType } from "@/lib/style-profile";

// A4 in points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.11, 0.1, 0.09);
const STONE = rgb(0.42, 0.4, 0.36);
const LINE = rgb(0.85, 0.82, 0.77);

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0.8, 0.8, 0.8);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Minimal top-down layout engine over one or more A4 pages. */
class Doc {
  doc!: PDFDocument;
  page!: PDFPage;
  y = 0;
  reg!: PDFFont;
  bold!: PDFFont;
  serif!: PDFFont;

  static async create() {
    const d = new Doc();
    d.doc = await PDFDocument.create();
    d.reg = await d.doc.embedFont(StandardFonts.Helvetica);
    d.bold = await d.doc.embedFont(StandardFonts.HelveticaBold);
    d.serif = await d.doc.embedFont(StandardFonts.TimesRomanBold);
    d.newPage();
    return d;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN) this.newPage();
  }

  /** Word-wrap text and draw it; returns the height consumed. */
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

    for (const paragraph of str.split("\n")) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = "";
      const flush = () => {
        this.ensure(lh);
        this.page.drawText(line, { x, y: this.y, size, font, color });
        this.y -= lh;
        line = "";
      };
      for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) > width && line) flush();
        else line = trial;
      }
      if (line) flush();
      if (!words.length) this.y -= lh; // blank line
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  rule() {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.75,
      color: LINE,
    });
    this.y -= 14;
  }

  heading(eyebrow: string, title: string) {
    this.ensure(48);
    this.gap(8);
    this.text(eyebrow.toUpperCase(), {
      size: 8,
      font: this.bold,
      color: STONE,
      lineGap: 3,
    });
    this.gap(6);
    this.text(title, { size: 18, font: this.serif, lineGap: 6 });
    this.gap(2);
  }

  swatch(hex: string) {
    const size = 9;
    this.ensure(size);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - size + 8,
      width: size,
      height: size,
      color: hexToRgb(hex),
      borderColor: LINE,
      borderWidth: 0.5,
    });
  }
}

/** Build a downloadable, multi-page PDF from a style report. */
export async function buildReportPdf(report: StyleReport): Promise<Uint8Array> {
  const d = await Doc.create();
  const cur = report.profile.currency;

  // Cover / header
  d.text("STYLEAI CONSULTANT", {
    size: 9,
    font: d.bold,
    color: STONE,
    lineGap: 4,
  });
  d.gap(6);
  d.text(report.headline, { size: 26, font: d.serif, lineGap: 8 });
  d.gap(2);
  const when = new Date(report.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  d.text(
    `${report.tier.charAt(0).toUpperCase() + report.tier.slice(1)} report · ` +
      `${report.profile.demographics.city}, ${report.profile.demographics.country} · ${when}`,
    { size: 9.5, color: STONE },
  );
  d.gap(8);
  d.text(report.summary, { size: 11, color: STONE, lineGap: 5 });
  d.gap(6);
  d.rule();

  // Colours
  d.heading("01", "Your colours");
  d.text("Colours that work for you", { size: 11, font: d.bold });
  d.gap(2);
  for (const c of report.colors.best) {
    d.swatch(c.hex);
    d.text(`${c.name} — ${c.why}`, { x: MARGIN + 16, width: CONTENT_W - 16 });
    d.gap(2);
  }
  d.gap(6);
  d.text("Colours to avoid", { size: 11, font: d.bold });
  d.gap(2);
  for (const c of report.colors.avoid) {
    d.swatch(c.hex);
    d.text(`${c.name} — ${c.why}`, { x: MARGIN + 16, width: CONTENT_W - 16 });
    d.gap(2);
  }

  // Hair
  d.heading("02", "Hair");
  for (const h of report.hair.recommend) {
    d.text(`•  ${h.name}`, { size: 11, font: d.bold });
    d.text(h.why, { color: STONE });
    d.gap(3);
  }
  for (const h of report.hair.avoid) {
    d.text(`×  ${h.name}`, { size: 11, font: d.bold, color: STONE });
    d.text(h.why, { color: STONE });
    d.gap(3);
  }

  // Silhouette & fit
  d.heading("03", "Silhouette & fit");
  const bt = report.profile.physical.bodyType;
  const btLabel = isBodyType(bt) ? BODY_TYPE_LABELS[bt] : bt;
  d.text(`Body type: ${btLabel}`, { size: 11, font: d.bold });
  d.text(report.silhouette.fit, { size: 12, font: d.serif, lineGap: 5 });
  d.gap(2);
  for (const r of report.silhouette.rules) {
    d.text(`•  ${r}`, { color: STONE });
    d.gap(1);
  }
  const m = report.profile.physical.measurements;
  if (m && Object.values(m).some((v) => v != null)) {
    d.gap(4);
    const parts = [
      m.shoulderCm && `Shoulders ${m.shoulderCm} cm`,
      m.chestCm && `Chest ${m.chestCm} cm`,
      m.waistCm && `Waist ${m.waistCm} cm`,
      m.hipCm && `Hips ${m.hipCm} cm`,
      m.sleeveCm && `Sleeve ${m.sleeveCm} cm`,
    ].filter(Boolean);
    d.text("Measurements", { size: 9, font: d.bold, color: STONE });
    d.text(parts.join("  ·  "), { color: STONE });
  }

  // Looks
  d.heading("04", "Your looks");
  for (const l of report.looks) {
    d.text(`${l.context} — ${l.title}`, { size: 11, font: d.bold });
    d.text(l.description, { color: STONE });
    d.gap(4);
  }

  // Shopping list
  d.heading("05", "Your shopping list");
  for (const item of report.shopping) {
    d.text(
      `${item.title}  —  ${formatMoney(item.priceEur, cur)}  ·  ${item.retailer}`,
      { size: 11, font: d.bold },
    );
    d.text(item.why, { color: STONE });
    if (item.url && item.url !== "#")
      d.text(item.url, { size: 8.5, color: STONE });
    d.gap(4);
  }

  // Do & don't
  d.heading("06", "Do & don't");
  d.text("Do", { size: 11, font: d.bold });
  for (const x of report.doList) d.text(`•  ${x}`, { color: STONE });
  d.gap(6);
  d.text("Avoid", { size: 11, font: d.bold });
  for (const x of report.dontList) d.text(`×  ${x}`, { color: STONE });

  return d.doc.save();
}
