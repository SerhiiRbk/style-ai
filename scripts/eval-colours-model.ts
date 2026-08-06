/**
 * Colour-model comparison harness. Runs a folder of selfies through the SAME
 * colour-analysis logic used in prod (`analyzeColoursWith`) with two or more
 * models, then reports how often the cheaper candidates agree with the
 * reference model on the axes that drive the palette — undertone and contrast
 * first, then subseason/season. Decide a model swap on these numbers, not on a
 * hunch (see the growth discussion on the /colours vision model).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/eval-colours-model.ts \
 *     [imagesDir] [model1,model2,...]
 *
 * Defaults: imagesDir=data/colours-eval, models=anthropic/claude-sonnet-4.5,google/gemini-2.5-flash
 * The FIRST model is the reference; the rest are compared against it.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeColoursWith } from "../src/lib/ai/colour-analysis-core";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const argDir = process.argv[2] ?? "data/colours-eval";
const argModels = process.argv[3];
const MODELS = (
  argModels ?? "anthropic/claude-sonnet-4.5,google/gemini-2.5-flash"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

type Row = {
  usable: boolean;
  undertone?: string;
  contrast?: string;
  season?: string;
  subseason?: string;
};

async function toDataUrl(file: string): Promise<string> {
  const ext = path.extname(file).toLowerCase();
  const bytes = await readFile(file);
  return `data:${MIME[ext] ?? "image/jpeg"};base64,${bytes.toString("base64")}`;
}

async function analyseOne(dataUrl: string, model: string): Promise<Row> {
  try {
    const res = await analyzeColoursWith(dataUrl, model);
    if (!res.ok) return { usable: false };
    return {
      usable: true,
      undertone: res.result.undertone,
      contrast: res.result.contrast,
      season: res.result.season,
      subseason: res.result.subseason,
    };
  } catch (err) {
    console.error(`  ! ${model} failed:`, (err as Error).message);
    return { usable: false };
  }
}

function pad(s: string, n: number): string {
  return (s + " ".repeat(n)).slice(0, n);
}

async function main() {
  let files: string[];
  try {
    const names = await readdir(argDir);
    files = names
      .filter((n) => IMAGE_EXT.has(path.extname(n).toLowerCase()))
      .sort()
      .map((n) => path.join(argDir, n));
  } catch {
    console.error(
      `No images dir at "${argDir}". Put 20–40 varied real selfies there (jpg/png/webp) and re-run.`,
    );
    process.exit(1);
  }
  if (!files.length) {
    console.error(`No images in "${argDir}".`);
    process.exit(1);
  }

  console.log(`Images: ${files.length}   Models: ${MODELS.join(", ")}`);
  console.log(`Reference: ${MODELS[0]}\n`);

  const ref = MODELS[0];
  // axis → candidate model → { agree, total } (total = photos usable in BOTH)
  const agree: Record<string, Record<string, { agree: number; total: number }>> =
    { undertone: {}, contrast: {}, season: {}, subseason: {} };
  const usableCount: Record<string, number> = {};
  for (const m of MODELS) usableCount[m] = 0;

  for (const file of files) {
    const dataUrl = await toDataUrl(file);
    const byModel: Record<string, Row> = {};
    for (const model of MODELS) {
      byModel[model] = await analyseOne(dataUrl, model);
      if (byModel[model].usable) usableCount[model]++;
    }

    // Per-image line: undertone/contrast/subseason for each model.
    const base = path.basename(file);
    console.log(pad(base, 28));
    for (const model of MODELS) {
      const r = byModel[model];
      const cell = r.usable
        ? `${pad(r.undertone ?? "?", 8)} ${pad(r.contrast ?? "?", 7)} ${r.subseason ?? "?"}`
        : "UNUSABLE";
      console.log(`   ${pad(model, 34)} ${cell}`);
    }

    // Tally agreement vs reference for photos usable in both.
    const r0 = byModel[ref];
    if (r0.usable) {
      for (const model of MODELS.slice(1)) {
        const r = byModel[model];
        if (!r.usable) continue;
        for (const axis of ["undertone", "contrast", "season", "subseason"] as const) {
          agree[axis][model] ??= { agree: 0, total: 0 };
          agree[axis][model].total++;
          if (r[axis] === r0[axis]) agree[axis][model].agree++;
        }
      }
    }
  }

  console.log(`\n${"=".repeat(60)}\nAGREEMENT vs reference (${ref})`);
  console.log("usable rate:");
  for (const m of MODELS) {
    console.log(`   ${pad(m, 34)} ${usableCount[m]}/${files.length}`);
  }
  for (const axis of ["undertone", "contrast", "season", "subseason"] as const) {
    console.log(`\n${axis}:`);
    for (const model of MODELS.slice(1)) {
      const a = agree[axis][model];
      if (!a || a.total === 0) {
        console.log(`   ${pad(model, 34)} n/a`);
        continue;
      }
      const pct = Math.round((a.agree / a.total) * 100);
      console.log(`   ${pad(model, 34)} ${pct}%  (${a.agree}/${a.total})`);
    }
  }
  console.log(
    `\nDecide on undertone + contrast first — they drive the palette. ~90%+ there is a safe swap.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
