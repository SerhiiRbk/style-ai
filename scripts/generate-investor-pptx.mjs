#!/usr/bin/env node
/**
 * Generate Valetti investor deck PPTX for Google Slides import.
 * Run: node scripts/generate-investor-pptx.mjs
 * Output: docs/investors/valetti-investor-deck-en.pptx
 */
import PptxGenJS from "pptxgenjs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "docs/investors/valetti-investor-deck-en.pptx");

const C = {
  ink: "15120D",
  inkSoft: "2A251D",
  paper: "FAF6EE",
  cream: "F1E9DA",
  sand: "E7DCC7",
  brass: "A97C3C",
  brassLight: "C2A06A",
  stone: "6C6358",
  white: "FFFFFF",
};

const PROBLEM =
  "78% of adults 30–55 in EU & USA shop without confidence. Stylists: $150–400/session. ChatGPT: text only — no photos, catalog, or try-on.";
const DIFF =
  "Closed pipeline: analysis → look → real catalog → try-on → report. One Style Profile as source of truth — not a generic LLM chat.";

const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9";
pres.author = "Valetti";
pres.company = "Valetti";
pres.subject = "Investor overview — Confidential";
pres.title = "Valetti — Investor Deck";

function img(rel) {
  return path.join(root, "public", rel);
}

function slideNum(slide, n, total = 14) {
  slide.addText(`${n} / ${total}`, {
    x: 9.2,
    y: 5.15,
    w: 0.7,
    h: 0.25,
    fontSize: 8,
    color: C.stone,
    align: "right",
  });
}

function eyebrow(slide, text, dark = false) {
  slide.addText(text.toUpperCase(), {
    x: 0.55,
    y: 0.45,
    w: 8,
    h: 0.3,
    fontSize: 9,
    color: dark ? C.brassLight : C.brass,
    charSpacing: 3,
    bold: true,
  });
}

function title(slide, text, dark = false) {
  slide.addText(text, {
    x: 0.55,
    y: 0.85,
    w: 8.8,
    h: 0.9,
    fontSize: 28,
    color: dark ? C.paper : C.ink,
    fontFace: "Georgia",
  });
}

function body(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x ?? 0.55,
    y: opts.y ?? 1.9,
    w: opts.w ?? 8.8,
    h: opts.h ?? 1.2,
    fontSize: opts.size ?? 13,
    color: opts.color ?? C.stone,
    fontFace: "Calibri",
    valign: "top",
    lineSpacingMultiple: 1.15,
  });
}

function lightBg(slide) {
  slide.background = { color: C.paper };
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.06,
    fill: { color: C.brass },
    line: { color: C.brass },
  });
}

function darkBg(slide) {
  slide.background = { color: C.ink };
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 5.525,
    w: 10,
    h: 0.09,
    fill: { color: C.brass },
    line: { color: C.brass },
  });
}

// ── Slide 1: Cover ──────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBg(s);
  s.addImage({ path: img("images/flatlay-essentials.png"), x: 5.2, y: 0, w: 4.8, h: 5.625, sizing: { type: "cover" } });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 5.5,
    h: 5.625,
    fill: { color: C.ink, transparency: 0 },
    line: { color: C.ink },
  });
  eyebrow(s, "Confidential · Investor deck · 2026", true);
  s.addText("Valetti", {
    x: 0.55,
    y: 1.1,
    w: 4.5,
    h: 0.8,
    fontSize: 44,
    color: C.paper,
    fontFace: "Georgia",
  });
  s.addText("Personal styling you can trust", {
    x: 0.55,
    y: 1.95,
    w: 4.5,
    h: 0.5,
    fontSize: 18,
    color: C.brassLight,
    fontFace: "Georgia",
  });
  body(s, "AI-assisted personal styling atelier · Style Recommendation Engine (SRE) · valetti.fit", {
    y: 2.65,
    w: 4.4,
    size: 11,
    color: C.sand,
  });
  const stats = [
    ["€10–35", "Report price"],
    ["5,000+", "Catalog SKUs"],
    ["EU / USA", "Markets"],
    ["Credits", "Pay-as-you-go"],
  ];
  stats.forEach(([v, l], i) => {
    const x = 0.55 + i * 1.1;
    s.addText(v, { x, y: 4.0, w: 1.0, h: 0.35, fontSize: 14, bold: true, color: C.paper });
    s.addText(l, { x, y: 4.35, w: 1.05, h: 0.3, fontSize: 7, color: C.stone });
  });
  slideNum(s, 1);
}

// ── Slide 2: Problem ──────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "01 · Approach");
  title(s, "The styling gap");
  body(s, PROBLEM);
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55,
    y: 3.5,
    w: 8.9,
    h: 1.35,
    fill: { color: C.cream },
    line: { color: C.sand, width: 0.5 },
  });
  s.addText("Differentiator", {
    x: 0.75,
    y: 3.65,
    w: 2,
    h: 0.3,
    fontSize: 10,
    bold: true,
    color: C.brass,
  });
  body(s, DIFF, { y: 3.95, w: 8.5, h: 0.85, size: 12, color: C.inkSoft });
  slideNum(s, 2);
}

// ── Slide 3: Solution loop ─────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBg(s);
  eyebrow(s, "01 · Approach", true);
  title(s, "The Valetti loop", true);
  const steps = [
    "Upload photos",
    "Style Profile",
    "AI looks",
    "Catalog match",
    "Try-on",
    "Purchase",
  ];
  steps.forEach((label, i) => {
    const x = 0.4 + i * 1.55;
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.35,
      y: 2.0,
      w: 0.9,
      h: 0.9,
      fill: { color: i % 2 ? C.brass : C.inkSoft },
      line: { color: C.brassLight, width: 1 },
    });
    s.addText(String(i + 1), {
      x: x + 0.35,
      y: 2.22,
      w: 0.9,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: C.paper,
      align: "center",
    });
    s.addText(label, {
      x: x,
      y: 3.05,
      w: 1.5,
      h: 0.5,
      fontSize: 10,
      color: C.sand,
      align: "center",
    });
    if (i < steps.length - 1) {
      s.addShape(pres.shapes.LINE, {
        x: x + 1.25,
        y: 2.45,
        w: 0.35,
        h: 0,
        line: { color: C.brassLight, width: 1.5 },
      });
    }
  });
  body(s, "Every recommendation is explainable — colour, silhouette, and product rationale.", {
    y: 4.2,
    color: C.sand,
    size: 12,
  });
  slideNum(s, 3);
}

// ── Slide 4: Product + image ───────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "02 · Product");
  title(s, "valetti.fit");
  const cols = [
    ["Acquisition", "Brand face · 6 free credits · EUR + USD"],
    ["Core flow", "Intake → SRE pipeline → report + Shop the Look"],
    ["Monetization", "Credits · packs · affiliate · PDF"],
  ];
  cols.forEach(([h, t], i) => {
    const y = 1.85 + i * 1.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.55,
      y,
      w: 5.2,
      h: 0.95,
      fill: { color: C.cream },
      line: { color: C.sand, width: 0.5 },
    });
    s.addText(h, { x: 0.75, y: y + 0.1, w: 4.8, h: 0.3, fontSize: 13, bold: true, color: C.ink });
    s.addText(t, { x: 0.75, y: y + 0.42, w: 4.8, h: 0.45, fontSize: 10, color: C.stone });
  });
  s.addImage({ path: img("images/carlo-valetti.png"), x: 6.1, y: 1.5, w: 3.35, h: 3.8, sizing: { type: "cover", w: 3.35, h: 3.8 } });
  slideNum(s, 4);
}

// ── Slide 5: Pricing table ─────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "03 · Pricing");
  title(s, "Credit-based · €10–35");
  const rows = [
    [
      { text: "Tier", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Price", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Credits", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Includes", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
    ],
    ["Starter", "€0", "5", "1 look · colour & hair"],
    ["Basic", "€10", "10", "3 looks · shopping · PDF"],
    ["Lookbook", "€20", "20", "4 looks · capsule"],
    ["Premium", "€35", "35", "6 looks · grooming"],
  ];
  s.addTable(rows, {
    x: 0.55,
    y: 1.85,
    w: 8.9,
    colW: [1.2, 1.0, 1.0, 5.7],
    fontSize: 11,
    border: { type: "solid", color: C.sand, pt: 0.5 },
    align: "left",
    valign: "middle",
  });
  s.addChart(pres.charts.BAR, [
    {
      name: "Credits",
      labels: ["Starter", "Basic", "Lookbook", "Premium"],
      values: [5, 10, 20, 35],
    },
  ], {
    x: 0.55,
    y: 3.85,
    w: 4.2,
    h: 1.45,
    showLegend: false,
    showTitle: true,
    title: "Credits per tier",
    chartColors: [C.brass],
    barDir: "col",
    valAxisMaxVal: 40,
  });
  body(s, "1 credit ≈ €1 · 6 free on signup · credits never expire", { y: 5.0, size: 10 });
  slideNum(s, 5);
}

// ── Slide 6: Revenue pie ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBg(s);
  eyebrow(s, "04 · Monetization", true);
  title(s, "Four revenue streams", true);
  s.addChart(pres.charts.PIE, [
    {
      name: "Mix",
      labels: ["Credit packs", "Report tiers", "Affiliate", "B2B"],
      values: [42, 35, 15, 8],
    },
  ], {
    x: 0.4,
    y: 1.75,
    w: 4.5,
    h: 3.2,
    showPercent: true,
    showLegend: true,
    legendPos: "b",
    chartColors: [C.brass, C.brassLight, C.sand, C.stone],
    dataLabelColor: C.paper,
  });
  const bullets = [
    "B2C: credits + tier upsell (€10 → €35)",
    "Micro-transactions: try-on · regen (1 credit)",
    "Affiliate: real product deeplinks — no inventory",
    "B2B: white-label SRE for salons (roadmap)",
  ];
  bullets.forEach((b, i) => {
    s.addText("•  " + b, {
      x: 5.2,
      y: 2.0 + i * 0.55,
      w: 4.4,
      h: 0.5,
      fontSize: 12,
      color: C.sand,
    });
  });
  s.addText("~91% contribution margin on paid reports", {
    x: 5.2,
    y: 4.5,
    w: 4,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: C.brassLight,
  });
  slideNum(s, 6);
}

// ── Slide 7: Unit economics chart ──────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "05 · Unit economics");
  title(s, "Software margins at scale");
  s.addChart(pres.charts.BAR, [
    {
      name: "Price (EUR)",
      labels: ["Basic", "Lookbook", "Premium"],
      values: [10, 20, 35],
    },
    {
      name: "COGS (EUR)",
      labels: ["Basic", "Lookbook", "Premium"],
      values: [0.34, 0.64, 1.08],
    },
  ], {
    x: 0.55,
    y: 1.8,
    w: 5.0,
    h: 2.8,
    barGrouping: "clustered",
    chartColors: [C.brass, C.sand],
    showLegend: true,
    legendPos: "b",
    showTitle: true,
    title: "Price vs COGS",
  });
  const econRows = [
    [
      { text: "Tier", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Price", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "COGS", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Margin", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
    ],
    ["Basic", "€10", "€0.34", "~91%"],
    ["Lookbook", "€20", "€0.64", "~92%"],
    ["Premium", "€35", "€1.08", "~93%"],
  ];
  s.addTable(econRows, {
    x: 5.8,
    y: 1.85,
    w: 3.65,
    colW: [1.0, 0.75, 0.75, 0.75],
    fontSize: 10,
    border: { type: "solid", color: C.sand, pt: 0.5 },
  });
  body(s, "Image generation ≈ 72% of COGS. Starter (€0) = €0.23 loss-leader.", { y: 4.85, size: 10 });
  slideNum(s, 7);
}

// ── Slide 8: Competition ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "06 · Competition");
  title(s, "Market positioning");
  const compRows = [
    [
      { text: "Player", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Price", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Looks", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Catalog", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "VTON", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
      { text: "Pay-go", options: { fill: { color: C.ink }, color: C.paper, bold: true } },
    ],
    ["Valetti", "€10–35", "●", "●", "●", "●"],
    ["Stitch Fix", "€20+", "○", "●", "○", "○"],
    ["Lookiero", "€10/mo", "○", "●", "○", "○"],
    ["ChatGPT", "€20/mo", "○", "○", "○", "○"],
    ["Zalando AI", "Free", "○", "●", "◐", "●"],
  ];
  s.addTable(compRows, {
    x: 0.55,
    y: 1.75,
    w: 8.9,
    colW: [1.8, 1.3, 0.9, 1.1, 0.9, 0.9],
    fontSize: 11,
    border: { type: "solid", color: C.sand, pt: 0.5 },
    align: "center",
  });
  body(s, "White space: full loop at pay-as-you-go €10–35 — no competitor matches end-to-end.", {
    y: 4.5,
    size: 11,
    color: C.inkSoft,
  });
  slideNum(s, 8);
}

// ── Slide 9: SRE Architecture ──────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBg(s);
  eyebrow(s, "07 · Technology", true);
  title(s, "Style Recommendation Engine", true);
  const boxes = [
    { x: 0.5, y: 1.7, w: 1.5, h: 0.65, t: "Photos", fill: C.inkSoft },
    { x: 2.3, y: 1.5, w: 1.4, h: 0.55, t: "CAE", fill: C.brass },
    { x: 2.3, y: 2.15, w: 1.4, h: 0.55, t: "SAE", fill: C.brass },
    { x: 2.3, y: 2.8, w: 1.4, h: 0.55, t: "FE", fill: C.brass },
    { x: 4.1, y: 2.0, w: 1.8, h: 0.9, t: "Style Profile", fill: C.brassLight },
    { x: 6.2, y: 1.7, w: 1.5, h: 0.65, t: "SRE + RAG", fill: C.brass },
    { x: 8.0, y: 1.7, w: 1.4, h: 0.65, t: "Looks", fill: C.inkSoft },
    { x: 6.2, y: 2.85, w: 1.5, h: 0.65, t: "CHE Catalog", fill: C.brass },
    { x: 8.0, y: 2.85, w: 1.4, h: 0.65, t: "Match", fill: C.inkSoft },
    { x: 4.5, y: 4.0, w: 2.2, h: 0.7, t: "Try-on + Report", fill: C.brassLight },
  ];
  for (const b of boxes) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      fill: { color: b.fill },
      line: { color: C.sand, width: 0.5 },
      rectRadius: 0.08,
    });
    s.addText(b.t, {
      x: b.x,
      y: b.y + 0.15,
      w: b.w,
      h: b.h,
      fontSize: 9,
      color: C.paper,
      align: "center",
      bold: true,
    });
  }
  slideNum(s, 9);
}

// ── Slide 10: Engines ──────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "07 · Technology");
  title(s, "Four analytical engines");
  const engines = [
    ["CAE", "Color Analytic Engine", "Season · undertone · palette"],
    ["SAE", "Shape Analytics Engine", "Face · body · silhouette"],
    ["FE", "Fashion Engine", "Climate · season · RAG rules"],
    ["CHE", "Catalog Host Engine", "Feeds · scrapers · pgvector"],
  ];
  engines.forEach(([code, name, sub], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 4.5;
    const y = 1.8 + row * 1.65;
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w: 4.2,
      h: 1.4,
      fill: { color: C.cream },
      line: { color: C.sand, width: 0.5 },
    });
    s.addText(code, {
      x: x + 3.5,
      y: y + 0.1,
      w: 0.55,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: C.brass,
      align: "center",
    });
    s.addText(name, { x: x + 0.2, y: y + 0.15, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: C.ink });
    s.addText(sub, { x: x + 0.2, y: y + 0.55, w: 3.8, h: 0.7, fontSize: 10, color: C.stone });
  });
  slideNum(s, 10);
}

// ── Slide 11: Stack ────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "08 · Infrastructure");
  title(s, "Architecture");
  const stackRows = [
    ["Experience", "valetti.fit — Next.js on Vercel"],
    ["Orchestration", "Vision → profile → recommend → match → render"],
    ["AI Gateway", "Vercel AI SDK — Claude · Gemini · OpenAI embed"],
    ["Data", "Supabase Postgres + pgvector (EU region)"],
    ["Commerce", "Credits ledger · Stripe · affiliate"],
  ];
  stackRows.forEach(([layer, desc], i) => {
    const y = 1.75 + i * 0.65;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.55,
      y,
      w: 2.0,
      h: 0.5,
      fill: { color: C.ink },
      line: { color: C.ink },
    });
    s.addText(layer, {
      x: 0.55,
      y: y + 0.1,
      w: 2.0,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: C.paper,
      align: "center",
    });
    s.addText(desc, { x: 2.7, y: y + 0.08, w: 6.7, h: 0.4, fontSize: 11, color: C.stone });
  });
  slideNum(s, 11);
}

// ── Slide 12: Moat ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBg(s);
  eyebrow(s, "09 · Advantage", true);
  title(s, "Why it's hard to copy", true);
  const moat = [
    "Proprietary SRE — multi-engine, not a prompt wrapper",
    "Real catalog + embeddings — no LLM hallucinations",
    "Explainable recommendations — trust & retention",
    "VTON loop — analysis to try-on in one product",
    "Credit gating — protects GPU unit economics",
  ];
  moat.forEach((m, i) => {
    s.addText("+", {
      x: 0.55,
      y: 1.85 + i * 0.6,
      w: 0.3,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: C.brassLight,
    });
    s.addText(m, {
      x: 0.9,
      y: 1.85 + i * 0.6,
      w: 8,
      h: 0.45,
      fontSize: 13,
      color: C.sand,
    });
  });
  s.addImage({ path: img("images/look-work.png"), x: 6.5, y: 1.6, w: 3.0, h: 3.4, sizing: { type: "cover" } });
  slideNum(s, 12);
}

// ── Slide 13: Roadmap ──────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s);
  eyebrow(s, "09 · Roadmap");
  title(s, "Investment focus");
  const roadmap = [
    "Scale catalog — EU + USA retailers, multi-brand scrapers",
    "Stripe checkout + membership tier",
    "B2B pilots — salons, relocation, corporate",
    "Mobile app + stylist marketplace",
  ];
  roadmap.forEach((r, i) => {
    s.addShape(pres.shapes.OVAL, {
      x: 0.55,
      y: 1.85 + i * 0.75,
      w: 0.35,
      h: 0.35,
      fill: { color: C.brass },
      line: { color: C.brass },
    });
    s.addText(String(i + 1), {
      x: 0.55,
      y: 1.9 + i * 0.75,
      w: 0.35,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: C.paper,
      align: "center",
    });
    s.addText(r, {
      x: 1.05,
      y: 1.82 + i * 0.75,
      w: 8,
      h: 0.45,
      fontSize: 12,
      color: C.inkSoft,
    });
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55,
    y: 4.85,
    w: 8.9,
    h: 0.55,
    fill: { color: C.cream },
    line: { color: C.sand, width: 0.5 },
  });
  s.addText("Live: valetti.fit · 5,000+ SKUs · EU/USA · GDPR + CCPA", {
    x: 0.75,
    y: 4.95,
    w: 8.5,
    h: 0.35,
    fontSize: 11,
    color: C.brass,
    bold: true,
  });
  slideNum(s, 13);
}

// ── Slide 14: Close ────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBg(s);
  s.addText("Valetti", {
    x: 0.55,
    y: 1.8,
    w: 8,
    h: 0.9,
    fontSize: 48,
    color: C.paper,
    fontFace: "Georgia",
  });
  s.addText("Let's build the future of personal styling.", {
    x: 0.55,
    y: 2.75,
    w: 8,
    h: 0.5,
    fontSize: 20,
    color: C.brassLight,
    fontFace: "Georgia",
  });
  body(s, "valetti.fit/investors  ·  founder@valetti.fit", {
    y: 3.6,
    size: 14,
    color: C.sand,
  });
  s.addText("Confidential · 2026 · Brand face · inspired by Carlo Valetti", {
    x: 0.55,
    y: 4.8,
    w: 8,
    h: 0.3,
    fontSize: 9,
    color: C.stone,
  });
  slideNum(s, 14);
}

await pres.writeFile({ fileName: outDocs });
fs.mkdirSync(path.dirname(outPublic), { recursive: true });
fs.copyFileSync(outDocs, outPublic);
console.log(`Written: ${outDocs}`);
console.log(`Public:  ${outPublic} → /investors/valetti-investor-deck-en.pptx`);
console.log("Import to Google Slides: Google Drive → Upload .pptx → Open with Google Slides");
