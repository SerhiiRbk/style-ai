/**
 * Generate demo-report shoe + watch boards from the same guides the sample
 * report renders, then save to public/images/demo/.
 *
 *   node --env-file=.env.local --import tsx scripts/gen-demo-finishing.ts
 *   node --env-file=.env.local --import tsx scripts/gen-demo-finishing.ts --force
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateText } from "ai";
import { generateReport, demoIntake } from "../src/lib/report";
import { extrasForReport } from "../src/lib/style-extras";

const modelImage =
  process.env.AI_MODEL_IMAGE ?? "google/gemini-3.1-flash-image";
const force = process.argv.includes("--force");

if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public/images/demo");
mkdirSync(outDir, { recursive: true });

const NO_TEXT_RULE =
  " Output a clean photographic image only — absolutely no text, letters, " +
  "words, captions, labels, headings, watermarks, logos, numbers, arrows or " +
  "graphic overlays anywhere in the frame.";

const report = generateReport(demoIntake, "premium", "valetti-style-prospect-demo");
const extras = extrasForReport(report);

function shoePrompt() {
  const variants = extras.shoeGuide.variants;
  const lines = variants.map((v, i) => {
    const hex = v.colorHex?.trim() ? ` (${v.colorHex.trim()})` : "";
    const finish = v.finish?.trim() ? ` in ${v.finish.trim()}` : "";
    return `${i + 1}. ${v.style} (${v.role})${finish} — leather/material colour MUST be ${v.color}${hex}.`;
  });
  const recommendsBlack = variants.some((v) => /\bblack\b/i.test(v.color));
  const colourFidelity =
    `Each pair's colour is FIXED by the list above — render exactly that leather/material ` +
    `colour (use the hex when given). Do NOT invent shoe colours and do NOT tint the shoes ` +
    `with any surrounding or wardrobe palette. ` +
    (recommendsBlack
      ? ""
      : `None of these shoes are black — do NOT default dress oxfords/derbies to pure black ` +
        `or near-black. `);

  return (
    `A clean, editorial product-photography sheet of ${variants.length} pairs of men's ` +
    `shoes on a plain, neutral off-white / greige surface (smooth plaster or fine linen), ` +
    `gentle daylight, soft shadows, high-end catalogue quality, sharp focus. Tall / portrait ` +
    `composition. Lay it out as a grid of EXACTLY ${variants.length} rows and EXACTLY 2 ` +
    `columns (${variants.length}×2) — total ${variants.length * 2} shoe photographs, ` +
    `one pair per row:\n` +
    `  • LEFT column = view (a): the pair standing upright on its soles, toes pointing toward ` +
    `the bottom of the frame (front three-quarter view);\n` +
    `  • RIGHT column = view (b): a clean side profile of the SAME pair.\n` +
    `Each pair appears on exactly ONE row and nowhere else. Do NOT duplicate, repeat or add ` +
    `extra columns/copies of any pair — only two images per pair (front + side). Use these exact ` +
    `same two angles for every row and keep the two views of a pair identical in style and ` +
    `colour. Each pair is a DIFFERENT style AND colour, described below:\n` +
    `${lines.join("\n")}\n` +
    colourFidelity +
    `Formal-shoe rule: any oxfords or derbies MUST be a classic formal leather ` +
    `(black, dark brown or burgundy) exactly as named above — NEVER navy, blue, slate ` +
    `or any coloured leather on an oxford/derby. Every OTHER pair must be rendered in ` +
    `exactly the leather/material colour named for it above — those named colours are all ` +
    `realistic footwear leathers, so reproduce them faithfully (a named navy loafer stays navy, ` +
    `a named cognac moccasin stays cognac). Regardless of the names, never render ANY shoe in a ` +
    `novelty or non-leather colour — no pink, coral, peach, lilac, lavender, mint, lime, yellow, ` +
    `turquoise, cyan or neon / fluorescent tones anywhere in the sheet. ` +
    `Trainer-sole rule: any trainer / sneaker with a coloured upper must have a clean ` +
    `CONTRASTING midsole and outsole — white, cream, gum or pale grey — not a fully ` +
    `monochrome shoe where the sole matches the upper, UNLESS the whole trainer is ` +
    `white / off-white or black (where a tonal sole is natural). ` +
    `Render generic, unbranded shoes — NO brand names, NO logos, NO text of any kind on ` +
    `the shoes, soles or background. Classic, refined menswear silhouettes. ` +
    `The pairs must clearly differ in style and colour exactly as described. ` +
    `CRITICAL colour lock for the penny loafers: they are RUST / terracotta leather ` +
    `(hex #9E5C3C) — a reddish-earth brown, NOT tan, NOT cognac, NOT chocolate. ` +
    `Keep the suede tassel loafers a lighter cognac so the two loafer rows stay distinct. ` +
    NO_TEXT_RULE
  );
}

function watchPrompt() {
  const variants = extras.watchGuide.variants;
  const palette = report.colors.best.map((c) => c.name).filter(Boolean);
  const lines = variants.map(
    (v, i) =>
      `${i + 1}. ${v.type} (${v.context}), ${v.shape ?? "round"} case: ` +
      `${v.caseMetal} case, ${v.dial} dial, ${v.strap} strap.`,
  );
  return (
    `A clean, top-down editorial flat-lay product photograph of ${variants.length} ` +
    `distinct men's wristwatches arranged in a neat row on a soft warm-neutral surface ` +
    `(smooth plaster / fine linen), gentle daylight, soft shadows, high-end catalogue ` +
    `quality, sharp focus. Each watch is a DIFFERENT type / style, described below — make ` +
    `their design language clearly distinct (a dress watch, a field/pilot/dive/sport or ` +
    `smartwatch, etc. as specified):\n${lines.join("\n")}\n` +
    `Case shapes: prefer round cases unless a variant is explicitly rectangular or square. ` +
    `Render generic, unbranded watches — NO brand names, NO logos, NO numerals or text ` +
    `of any kind on the dials, cases, straps or background. ` +
    (palette.length ? `Overall colour harmony: ${palette.join(", ")}. ` : "") +
    `The watches must clearly differ in type, case metal, dial colour and strap as described. ` +
    NO_TEXT_RULE
  );
}

async function generateBoard(prompt: string) {
  const result = await generateText({
    model: modelImage,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });
  const file = result.files?.find((f) => f.mediaType?.startsWith("image/"));
  if (!file) {
    throw new Error(
      `no image in response (${result.files?.length ?? 0} files, text=${String(result.text || "").slice(0, 160)})`,
    );
  }
  return Buffer.from(file.uint8Array);
}

async function writeIfNeeded(label: string, filename: string, prompt: string) {
  const outPath = join(outDir, filename);
  if (!force && existsSync(outPath)) {
    console.log(`  skip ${label} — exists`);
    return;
  }
  console.log(`  generating ${label}…`);
  const bytes = await generateBoard(prompt);
  writeFileSync(outPath, bytes);
  console.log(`  ✓ /images/demo/${filename} (${bytes.length} bytes)`);
}

console.log("Demo finishing kit");
console.log("Model:", modelImage);
console.log("\nFootwear:");
for (const v of extras.shoeGuide.variants) {
  console.log(
    `  • ${v.role}: ${v.style} — ${v.color} ${v.colorHex}${v.finish ? ` (${v.finish})` : ""}`,
  );
}
console.log("\nWatches:");
for (const v of extras.watchGuide.variants) {
  console.log(
    `  • ${v.context}: ${v.type} — ${v.caseMetal} / ${v.dial} / ${v.strap}`,
  );
}
console.log("");

async function main() {
  await writeIfNeeded("shoe board", "shoe-board.png", shoePrompt());
  await writeIfNeeded("watch board", "watch-board.png", watchPrompt());
  console.log("\nDone");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
