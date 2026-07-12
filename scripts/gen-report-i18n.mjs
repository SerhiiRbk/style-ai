/**
 * Generate committed report-UI translation dictionaries.
 *
 * Extracts every fixed UI string wrapped in `tr("…")` / `tt("…")` across the
 * report page + components, adds a curated list of finite profile display
 * values, then asks the AI gateway to translate the whole set into each
 * supported language and writes src/lib/i18n/report/<lang>.json.
 *
 * Run:  node --env-file=.env.local scripts/gen-report-i18n.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateObject } from "ai";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "src/lib/i18n/report");

const MODEL = process.env.AI_MODEL_REASONING ?? "anthropic/claude-sonnet-4.5";

// Files whose `tr(...)`/`tt(...)` literals form the UI string set.
const SOURCE_FILES = [
  "src/app/report/[id]/page.tsx",
  "src/components/StyleGuides.tsx",
  "src/components/StyleDetails.tsx",
  "src/components/ReportSectionNav.tsx",
  "src/components/RegenPhotoHint.tsx",
  "src/components/DownloadPdfButton.tsx",
  "src/lib/pdf/report-pdf.ts",
];

// Finite profile display values + a few dynamic strings passed to tr() without a
// literal (e.g. tr(cap(profile.physical.undertone))). Fallback is English, so
// over-including is harmless.
const EXTRA = [
  // undertone / contrast / boldness
  "Warm", "Cool", "Neutral", "Olive",
  "Low", "Medium", "High",
  "Conservative", "Moderate", "Experimental",
  // seasons + subseasons
  "Winter", "Spring", "Summer", "Autumn",
  "Deep Winter", "Cool Winter", "Bright Winter",
  "Bright Spring", "Warm Spring", "Light Spring",
  "Light Summer", "Cool Summer", "Soft Summer",
  "Soft Autumn", "Warm Autumn", "Deep Autumn",
  // body types
  "Rectangle", "Athletic", "Triangle", "Inverted", "Hourglass", "Oval",
  // face shapes (vision output, capitalised)
  "Round", "Square", "Rectangular", "Oblong", "Heart", "Diamond",
  // investment levels
  "Invest", "Core", "Accent",
  // common climate words (lowercase, as stored)
  "temperate", "continental", "mediterranean", "cold", "warm", "humid",
  "tropical", "dry", "oceanic", "subtropical", "arid", "maritime",
  // common shopping categories
  "Tops", "Bottoms", "Outerwear", "Footwear", "Shoes", "Accessories",
  "Trousers", "Knitwear", "Shirts", "Suiting", "Denim", "Tailoring",
  // tier upsell (static title + CTA; body is interpolated so stays English)
  "Want the full lookbook?", "Upgrade to Lookbook",
  "Want the deepest report?", "Upgrade to Premium",
  "Ready for another Premium report?", "Create another Premium report",
  // page.tsx STYLE_TIPS
  "Clean & simple", "Fewer, better pieces beat a crowded wardrobe.",
  "Fit comes first", "Tailoring the shoulders and hem changes everything.",
  "Earthy, warm tones", "Let your palette lead; keep contrast soft.",
  "Grooming is key", "A sharp cut and tidy beard finish the whole look.",
  // StyleDetails PATTERNS
  "Solid", "Fine stripe", "Gingham check", "Tartan",
  // StyleDetails ACCESSORIES (name + note)
  "Field watch", "Cream dial, leather strap",
  "Leather belt", "Match to your shoes",
  "Warm tortoiseshell",
  "Leather holdall", "Cognac, soft-structured weekender",
  "Wool scarf", "Tonal neutral, lightweight",
  "Socks", "Tonal to the trouser, not the shoe",
  "Minimal chain", "One piece, in your metal — never more",
  // StyleDetails SHOES
  "Cream sneakers", "Suede chelsea boots", "Derby shoes",
  // ReportSectionNav labels (rendered via tt(label) from a const array)
  "Overview", "Start", "Colour", "Hair", "Fit", "Looks", "Capsule",
  "Shopping", "Details", "Care", "Do / Don't",
  // PDF chapter titles (passed to chapter("…") which applies tt() at runtime)
  "Your colours", "Hair, beard & eyewear", "Silhouette & fit", "Your looks",
  "Capsule & buying plan", "Your shopping list", "Patterns & finishing details",
  "How to wear it, and make it last", "Do & don't",
];

const LANGS = [
  ["es", "Spanish"],
  ["de", "German"],
  ["fr", "French"],
  ["it", "Italian"],
  ["cs", "Czech"],
  ["ru", "Russian"],
  ["uk", "Ukrainian"],
  ["tr", "Turkish"],
  ["pl", "Polish"],
];

function extractKeys() {
  const keys = new Set();
  const re = /\b(?:tr|tt)\(\s*"((?:[^"\\]|\\.)*)"/g;
  for (const rel of SOURCE_FILES) {
    const src = readFileSync(join(ROOT, rel), "utf8");
    let m;
    while ((m = re.exec(src)) !== null) {
      const raw = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      if (raw.trim()) keys.add(raw);
    }
  }
  for (const e of EXTRA) keys.add(e);
  return [...keys];
}

const schema = z.object({
  translations: z
    .array(z.string())
    .describe("Translations, one per input string, in the SAME order."),
});

async function translateChunk(strings, langName) {
  const numbered = strings.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const { object } = await generateObject({
    model: MODEL,
    schema,
    prompt:
      `You are a professional translator localising the interface of a personal ` +
      `style report into ${langName}.\n` +
      `Translate each numbered UI snippet below into natural, concise, fluent ` +
      `${langName}, matching the refined, encouraging tone of a high-end stylist.\n\n` +
      `Rules:\n` +
      `- Return exactly ${strings.length} translations, in the same order.\n` +
      `- These are UI labels, headings and short sentences — keep them tight.\n` +
      `- Preserve hex codes, numbers, "·" separators, arrows (→), ellipses (…), ` +
      `and leading/trailing spaces exactly.\n` +
      `- Preserve placeholder tokens in curly braces such as {pieces} or {outfits} ` +
      `verbatim — do not translate or remove them.\n` +
      `- Do NOT translate brand or product names.\n` +
      `- Keep "&" and punctuation. Never merge, split, add or drop items.\n\n` +
      `Snippets:\n${numbered}`,
  });
  const out = object.translations ?? [];
  return strings.map((s, i) => (typeof out[i] === "string" && out[i].trim() ? out[i] : s));
}

async function translateAll(keys, langName) {
  const CHUNK = 40;
  const result = {};
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    process.stdout.write(`    ${i + slice.length}/${keys.length}\r`);
    const translated = await translateChunk(slice, langName);
    slice.forEach((s, j) => (result[s] = translated[j] ?? s));
  }
  return result;
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error(
      "No AI gateway credentials (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN) — run with --env-file=.env.local",
    );
    process.exit(1);
  }
  const keys = extractKeys();
  console.log(`Extracted ${keys.length} UI strings.`);
  console.log("Existing dict files:", readdirSync(OUT_DIR).join(", "));

  const FORCE = process.argv.includes("--force");
  for (const [id, name] of LANGS) {
    const path = join(OUT_DIR, `${id}.json`);
    let existing = {};
    if (!FORCE) {
      try {
        existing = JSON.parse(readFileSync(path, "utf8"));
      } catch {
        existing = {};
      }
    }
    const missing = keys.filter((k) => !(k in existing));
    if (!missing.length) {
      console.log(`${name} (${id}): up to date (${keys.length} keys)`);
      continue;
    }
    console.log(`Translating → ${name} (${id}): ${missing.length} new keys`);
    const fresh = await translateAll(missing, name);
    const dict = {};
    for (const k of keys) dict[k] = fresh[k] ?? existing[k] ?? k;
    writeFileSync(path, JSON.stringify(dict, null, 2) + "\n", "utf8");
    console.log(`  wrote ${path} (${Object.keys(dict).length} keys)`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
