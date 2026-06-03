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
import { formatMoney } from "@/lib/currency";
import { BODY_TYPE_LABELS, isBodyType } from "@/lib/style-profile";
import { buildExtras, investmentLevel, itemsForLook } from "@/lib/style-extras";

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
 * box aspect (w:h, in points) and re-encoded to JPEG. Cropping is required
 * because pdf-lib cannot clip overflow, and JPEG keeps the PDF small (full-res
 * assets would otherwise bloat the file to tens of megabytes).
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
      .jpeg({ quality: 74 })
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

    str = str
      .replace(/[\u2192\u2794\u279C]/g, "->")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013]/g, "-")
      .replace(/[\u2026]/g, "...");

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

  /** A thumbnail to the left with title + supporting text to the right. */
  imageRow(
    img: PDFImage | null,
    title: string,
    sub: string,
    opts: { meta?: string; thumbW?: number; thumbH?: number } = {},
  ) {
    const thumbW = opts.thumbW ?? 58;
    const thumbH = opts.thumbH ?? 70;
    const gap = 14;
    this.ensure(thumbH + 8);
    const topY = this.y;

    if (img) {
      this.page.drawImage(img, {
        x: MARGIN,
        y: topY - thumbH,
        width: thumbW,
        height: thumbH,
      });
    } else {
      this.page.drawRectangle({
        x: MARGIN,
        y: topY - thumbH,
        width: thumbW,
        height: thumbH,
        color: rgb(0.95, 0.93, 0.89),
      });
    }

    const tx = MARGIN + thumbW + gap;
    const tw = CONTENT_W - thumbW - gap;
    this.text(title, { x: tx, width: tw, size: 11, font: this.bold });
    this.gap(1);
    this.text(sub, { x: tx, width: tw, color: STONE });
    if (opts.meta) {
      this.gap(1);
      this.text(opts.meta, { x: tx, width: tw, size: 8.5, color: STONE });
    }

    if (this.y > topY - thumbH - 8) this.y = topY - thumbH - 8;
  }
}

/** Build a downloadable, multi-page PDF from a style report. */
export async function buildReportPdf(report: StyleReport): Promise<Uint8Array> {
  const d = await Doc.create();
  const cur = report.profile.currency;
  const extras = buildExtras(report);

  // Cover banner
  const HERO_H = 188;
  const hero = await embedImage(d.doc, "/images/hero-editorial.png", {
    w: CONTENT_W,
    h: HERO_H,
    px: 1100,
    position: "top",
  });
  if (hero) {
    d.banner(hero, HERO_H);
    d.gap(2);
  }

  // Cover / header
  d.text("VALETTI · AI-ASSISTED PERSONAL STYLING", {
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
  d.gap(2);
  d.text("Prepared by Carlo Valetti · Lead stylist, Valetti", {
    size: 9.5,
    color: STONE,
  });
  d.gap(8);
  d.text(report.summary, { size: 11, color: STONE, lineGap: 5 });
  d.gap(6);
  d.text(`Style archetype: ${extras.archetype.name}`, {
    size: 11,
    font: d.bold,
  });
  d.text(extras.archetype.line, { size: 10, color: STONE });
  d.gap(6);
  d.rule();

  // Start here — 3 highest-impact moves
  d.heading("Start here", "Your three highest-impact moves");
  for (const mv of extras.priorityMoves) {
    d.text(`${mv.n}  ${mv.title}`, { size: 11, font: d.bold });
    d.gap(1);
    d.text(mv.why, { color: STONE });
    d.gap(4);
  }

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
  d.gap(6);
  d.text("How to combine them", { size: 11, font: d.bold });
  d.gap(2);
  if (extras.pairings.hero)
    d.text(`Hero colour near the face: ${extras.pairings.hero.name}.`, {
      color: STONE,
    });
  for (const combo of extras.pairings.combos) {
    d.text(`•  ${combo.name} — ${combo.why}`, { color: STONE });
    d.gap(1);
  }
  d.gap(6);
  d.text("Metals & hardware", { size: 11, font: d.bold });
  d.gap(2);
  for (const mt of extras.metals.recommend) {
    d.swatch(mt.hex);
    d.text(`${mt.name} — ${mt.why}`, { x: MARGIN + 16, width: CONTENT_W - 16 });
    d.gap(2);
  }
  d.text(extras.metals.avoidNote, { size: 9, color: STONE });
  d.gap(6);
  d.text(`Your colour DNA — ${extras.colorDNA.subseason}`, {
    size: 11,
    font: d.bold,
  });
  d.gap(2);
  d.text(`Neutrals: ${extras.colorDNA.neutrals.map((c) => c.name).join(", ")}`, {
    color: STONE,
  });
  d.text(`Best white: ${extras.colorDNA.bestWhite}`, { color: STONE });
  d.text(`Best denim: ${extras.colorDNA.bestDenim}`, { color: STONE });
  d.text(`Metal: ${extras.colorDNA.metal}`, { color: STONE });
  d.text(`Instead of black: ${extras.colorDNA.blackAlt}`, { color: STONE });
  d.text(`Contrast: ${extras.colorDNA.contrastRule}`, { color: STONE });

  // Hair, beard & eyewear
  d.heading("02", "Hair, beard & eyewear");
  for (const h of report.hair.recommend) {
    const img = await embedImage(d.doc, h.image, { w: 58, h: 70 });
    d.imageRow(img, `Recommended — ${h.name}`, h.why);
    d.gap(5);
  }
  for (const h of report.hair.avoid) {
    const img = await embedImage(d.doc, h.image, { w: 58, h: 70 });
    d.imageRow(img, `Avoid — ${h.name}`, h.why);
    d.gap(5);
  }
  d.gap(2);
  d.text("Beard, skin & grooming", { size: 11, font: d.bold });
  d.gap(2);
  for (const g of extras.grooming) {
    d.text(`${g.title} — ${g.detail}`, { color: STONE });
    d.gap(1);
  }
  d.gap(4);
  d.text("Eyewear for your face", { size: 11, font: d.bold });
  d.gap(3);
  if (report.tier === "premium" && report.facialHair?.length) {
    d.text("Recommended facial hair", { size: 11, font: d.bold });
    d.gap(3);
    for (const item of report.facialHair) {
      const img = await embedImage(d.doc, item.image, { w: 58, h: 70 });
      d.imageRow(img, item.name, item.why);
      d.gap(4);
    }
    d.gap(2);
  }
  if (report.tier === "premium" && report.eyewear?.length) {
    d.text("Recommended glasses", { size: 11, font: d.bold });
    d.gap(3);
    for (const item of report.eyewear) {
      const img = await embedImage(d.doc, item.image, { w: 58, h: 70 });
      d.imageRow(img, item.name, item.why);
      d.gap(4);
    }
    d.gap(2);
  } else {
    for (const f of extras.eyewear.recommend) {
      const img = await embedImage(
        d.doc,
        `/images/eyewear/eyewear-${f.shape}.png`,
        { w: 70, h: 52 },
      );
      d.imageRow(img, f.name, f.why, { thumbW: 70, thumbH: 52 });
      d.gap(4);
    }
  }
  d.text(`Avoid: ${extras.eyewear.avoid.join(" · ")}`, {
    size: 9,
    color: STONE,
  });

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
  d.gap(6);
  d.text("Fit blueprint — what to tell your tailor", {
    size: 11,
    font: d.bold,
  });
  d.gap(2);
  for (const s of extras.fitBlueprint) {
    d.text(`${s.part}: ${s.spec}`, { font: d.bold, size: 9.5 });
    d.text(s.why, { x: MARGIN + 12, width: CONTENT_W - 12, color: STONE });
    d.gap(2);
  }

  // Looks
  d.heading("04", "Your looks");
  for (const l of report.looks) {
    const img = await embedImage(d.doc, l.image, {
      w: 58,
      h: 70,
      position: "top",
    });
    const lookIdx = report.looks.indexOf(l);
    const shopItems =
      (lookIdx >= 0 && report.lookItems?.[lookIdx]?.length
        ? report.lookItems[lookIdx]
        : itemsForLook(l, report.shopping)) ?? [];
    const shop = shopItems.map((it) => it.title).join(", ");
    d.imageRow(img, `${l.context} — ${l.title}`, l.description, {
      meta: shop ? `Shop a look like this: ${shop}` : undefined,
    });
    d.gap(5);
  }

  // Capsule & buying plan
  d.heading("05", "Capsule & buying plan");
  d.text(
    `${extras.capsule.pieces} core pieces unlock roughly ${extras.capsule.outfits} outfits with what you already own. Buy them in three phases:`,
    { color: STONE },
  );
  d.gap(4);
  const phase = (label: string, items: typeof extras.capsule.now) => {
    if (!items.length) return;
    d.text(label, { size: 11, font: d.bold });
    for (const i of items)
      d.text(`•  ${i.title}  —  ${formatMoney(i.priceEur, cur)}`, {
        color: STONE,
      });
    d.gap(3);
  };
  phase("Buy now", extras.capsule.now);
  phase("Next", extras.capsule.next);
  phase("Later", extras.capsule.later);
  d.gap(4);
  d.text("Outfit matrix — mix & match", { size: 11, font: d.bold });
  for (const c of extras.matrix) {
    d.text(`•  ${c.context}: ${c.pieces.join(" + ")}`, { color: STONE });
    d.gap(1);
  }
  d.gap(4);
  d.text("Good / Better / Best — where to spend", { size: 11, font: d.bold });
  for (const t of extras.priceTiers) {
    d.text(
      `${t.category}: ${formatMoney(t.good, cur)} / ${formatMoney(t.better, cur)} / ${formatMoney(t.best, cur)} — ${t.note}`,
      { color: STONE },
    );
    d.gap(1);
  }

  // Shopping list
  d.heading("06", "Your shopping list");
  for (const item of report.shopping) {
    const img = await embedImage(d.doc, item.image, { w: 58, h: 70 });
    d.imageRow(
      img,
      `${item.title}  —  ${formatMoney(item.priceEur, cur)}  [${investmentLevel(item)}]`,
      item.why,
      { meta: `${item.retailer}${item.url && item.url !== "#" ? `  ·  ${item.url}` : ""}` },
    );
    d.gap(5);
  }

  // Patterns & finishing details
  d.heading("07", "Patterns & finishing details");
  d.text("Fabrics & texture", { size: 11, font: d.bold });
  d.gap(2);
  for (const f of extras.fabrics) {
    d.text(`${f.name} — ${f.why}`, { color: STONE });
    d.gap(1);
  }
  d.gap(4);
  d.text("Patterns", { size: 11, font: d.bold });
  d.text("Solid · Fine stripe · Gingham check · Tartan", { color: STONE });
  d.gap(4);
  d.text("Accessories", { size: 11, font: d.bold });
  d.text(
    "Field watch (cream dial) · Leather belt matched to shoes · Warm tortoiseshell sunglasses · One minimal chain",
    { color: STONE },
  );
  d.gap(4);
  d.text("Shoe guide", { size: 11, font: d.bold });
  d.text("Cream sneakers · Suede chelsea boots · Derby shoes", { color: STONE });

  // How to wear, care & scent
  d.heading("08", "How to wear it, and make it last");
  d.text("How to wear it", { size: 11, font: d.bold });
  for (const s of extras.styling) d.text(`•  ${s}`, { color: STONE });
  d.gap(4);
  d.text("Care & longevity", { size: 11, font: d.bold });
  for (const s of extras.care) d.text(`•  ${s}`, { color: STONE });
  d.gap(4);
  d.text("Signature scent", { size: 11, font: d.bold });
  d.text(extras.fragrance, { color: STONE });

  // Do & don't
  d.heading("09", "Do & don't");
  d.text("Do", { size: 11, font: d.bold });
  for (const x of report.doList) d.text(`•  ${x}`, { color: STONE });
  d.gap(6);
  d.text("Avoid", { size: 11, font: d.bold });
  for (const x of report.dontList) d.text(`×  ${x}`, { color: STONE });

  return d.doc.save();
}
