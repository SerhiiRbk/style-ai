// Generate one text-to-image prompt per product in the Supabase catalogue.
//
// This produces ONLY prompt strings — it never calls an image-generation model.
// Output: data/catalog-image-prompts.json (overwritten each run; idempotent).
//
//   node scripts/gen-catalog-prompts.mjs
//   # or, if you prefer Node's own env loader:
//   node --env-file=.env.local scripts/gen-catalog-prompts.mjs
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── Minimal .env.local loader ────────────────────────────────────────────────
// dotenv is not a dependency, so parse the file ourselves (only fills vars that
// are not already present in the environment, so --env-file still wins).
async function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  const text = await readFile(path, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

await loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "✗ Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local (or the environment).",
  );
  console.error(
    `   NEXT_PUBLIC_SUPABASE_URL: ${url ? "present" : "MISSING"} · ` +
      `SUPABASE_SERVICE_ROLE_KEY: ${key ? "present" : "MISSING"}`,
  );
  process.exit(1);
}

// ── House style ───────────────────────────────────────────────────────────────
// Every prompt is a single coherent paragraph in the same quiet-luxury, European
// smart-casual register so the whole catalogue looks cohesive.
const HOUSE_STYLE =
  "Clean e-commerce editorial studio packshot of a single {SUBJECT}, no model and no human, " +
  "no face, the product centered and fully in frame with generous negative space. " +
  "Neutral seamless light-stone / off-white background, soft diffused studio lighting with a " +
  "subtle natural shadow grounding the object, high detail on fabric texture and true-to-life " +
  "colour accuracy ({COLOR}). {CATEGORY_DIRECTION} Quiet-luxury, European smart-casual aesthetic " +
  "matching the Valetti brand: understated, refined, calm. Portrait 3:4 aspect ratio (vertical), " +
  "shot for a ~600x800 catalogue card. {DETAILS}" +
  "Negative prompt: no text, no captions, no logos or branding, no watermark, no clutter, " +
  "no busy or patterned background, no props beyond the garment, no human model, no mannequin face, " +
  "no harsh reflections, no oversaturation.";

// Map a free-text category onto (a) the noun used as the subject and (b) a short
// staging direction tuned to that product type.
function categoryProfile(categoryRaw) {
  const c = (categoryRaw || "").toLowerCase();
  if (/(shoe|sneaker|boot|loafer|footwear|trainer|derby|oxford)/.test(c)) {
    return {
      subject: "pair of shoes",
      direction:
        "Footwear shown as a clean pair at a flattering three-quarter angle, slightly elevated, " +
        "laces and sole detail crisp.",
    };
  }
  if (/(bag|belt|wallet|scarf|hat|cap|sunglasses|watch|jewel|accessor|tie|glove|sock)/.test(c)) {
    return {
      subject: "accessory",
      direction:
        "Accessory laid flat or resting on a simple neutral surface, arranged neatly to show its " +
        "shape, hardware and material.",
    };
  }
  if (/(trouser|pant|jean|chino|short|skirt|legging)/.test(c)) {
    return {
      subject: "pair of trousers",
      direction:
        "Bottoms styled as a flat-lay or softly folded to show the cut, drape and waistband cleanly.",
    };
  }
  if (/(coat|jacket|blazer|outerwear|parka|trench|overcoat)/.test(c)) {
    return {
      subject: "outerwear piece",
      direction:
        "Outerwear presented on an invisible/ghost-mannequin form so the silhouette, lapels and " +
        "drape read clearly, buttons and collar tidy.",
    };
  }
  if (/(knit|sweater|jumper|cardigan|hoodie|sweatshirt)/.test(c)) {
    return {
      subject: "knitwear piece",
      direction:
        "Knitwear shown on an invisible/ghost-mannequin form or softly folded, highlighting the " +
        "weave, ribbing and texture.",
    };
  }
  if (/(shirt|tee|t-shirt|top|polo|blouse|dress)/.test(c)) {
    return {
      subject: "garment",
      direction:
        "Top presented on an invisible/ghost-mannequin form so the collar, shoulders and drape read " +
        "clearly, fabric neatly steamed.",
    };
  }
  return {
    subject: "fashion item",
    direction:
      "Item presented cleanly on an invisible/ghost-mannequin form or flat-lay, whichever best shows " +
      "its construction and material.",
  };
}

function clean(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

function buildPrompt(p) {
  const { subject, direction } = categoryProfile(p.category);
  const title = clean(p.title) || subject;
  const brand = clean(p.brand);
  const color = clean(p.color);
  const gender = clean(p.gender);
  const description = clean(p.description);
  const category = clean(p.category);

  // The concrete subject line: brand + title gives the model the actual product.
  const subjectPhrase = [brand, title].filter(Boolean).join(" ") || subject;

  const colorText = color
    ? `the colour is ${color} and must be reproduced faithfully`
    : "colour taken from the product itself, reproduced faithfully";

  // Optional extra detail sentence assembled from whatever fields are present.
  const detailBits = [];
  if (category) detailBits.push(`Product category: ${category}.`);
  if (gender) detailBits.push(`Intended for ${gender} wear.`);
  if (description) {
    const d = description.length > 240 ? description.slice(0, 237) + "…" : description;
    detailBits.push(`Key features: ${d}.`);
  }
  const details = detailBits.length ? detailBits.join(" ") + " " : "";

  return HOUSE_STYLE.replace("{SUBJECT}", subjectPhrase)
    .replace("{COLOR}", colorText)
    .replace("{CATEGORY_DIRECTION}", direction)
    .replace("{DETAILS}", details);
}

function slug(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Fetch all products (paginated) ─────────────────────────────────────────────
const sb = createClient(url, key, { auth: { persistSession: false } });

const COLUMNS =
  "id, source, external_id, brand, title, category, color, gender, description, price_eur, market";
const PAGE = 1000;
const all = [];

for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from("products")
    .select(COLUMNS)
    .order("created_at", { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error(`✗ Supabase query failed: ${error.message}`);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < PAGE) break;
}

if (all.length === 0) {
  console.error(
    "✗ The products table returned 0 rows. Nothing to generate. " +
      "Seed the catalogue first (npm run seed:catalog or import:feed).",
  );
  process.exit(1);
}

// ── Compose output ──────────────────────────────────────────────────────────────
let missingColor = 0;
let missingDescription = 0;

const out = all.map((p) => {
  if (!clean(p.color)) missingColor++;
  if (!clean(p.description)) missingDescription++;
  const ext = p.external_id || slug(p.title) || p.id;
  return {
    id: p.id,
    source: p.source ?? null,
    external_id: p.external_id ?? null,
    title: p.title ?? null,
    category: p.category ?? null,
    color: p.color ?? null,
    gender: p.gender ?? null,
    aspect_ratio: "3:4",
    suggested_filename: `${slug(p.source) || "src"}_${slug(ext)}.png`,
    prompt: buildPrompt(p),
  };
});

const outPath = new URL("../data/catalog-image-prompts.json", import.meta.url);
await writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(`✓ Wrote ${out.length} image-generation prompts to data/catalog-image-prompts.json`);
console.log(
  `  Products with missing colour: ${missingColor} · missing description: ${missingDescription}`,
);
