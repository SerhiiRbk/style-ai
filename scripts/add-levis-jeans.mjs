/**
 * One-off: add Levi's light-blue jeans to the catalogue with embedding + image prompt.
 * Run: node --env-file=.env.local scripts/add-levis-jeans.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { embedAndUpsert } from "./feeds/upsert.mjs";
import { toEur, inferMarket } from "./feeds/normalize.mjs";

const SOURCE = "manual:levis";
const EXTERNAL_ID = "LEV-501-LBL";

const product = {
  source: SOURCE,
  externalId: EXTERNAL_ID,
  sku: EXTERNAL_ID,
  brand: "Levi's",
  title: "501 Original Fit Jeans",
  description:
    "Classic five-pocket denim jeans in a light blue wash. Straight original fit, button fly, signature red tab.",
  category: "Trousers",
  gender: "men",
  color: "Light Blue",
  price: 110,
  currency: "USD",
  priceEur: toEur(110, "USD"),
  market: inferMarket("USD"),
  imageUrl: "https://picsum.photos/seed/lev-501-lbl/600/800",
  deeplink: "https://www.levi.com/GB/en_GB/clothing/men/jeans/c/levi_clothing_men_jeans",
  inStock: true,
  attrs: { merchant: "Levi's", style: "501 Original Fit" },
};

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

function categoryProfile(categoryRaw) {
  const c = (categoryRaw || "").toLowerCase();
  if (/(trouser|pant|jean|chino|short|skirt|legging)/.test(c))
    return {
      direction:
        "Bottoms styled as a flat-lay or softly folded to show the cut, drape and waistband cleanly.",
    };
  return {
    direction:
      "Item presented cleanly on an invisible/ghost-mannequin form or flat-lay, whichever best shows its construction and material.",
  };
}

function clean(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

function slug(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildPrompt(p) {
  const { direction } = categoryProfile(p.category);
  const subjectPhrase = [clean(p.brand), clean(p.title)].filter(Boolean).join(" ");
  const colorText = p.color
    ? `the colour is ${p.color} and must be reproduced faithfully`
    : "colour taken from the product itself, reproduced faithfully";
  const details = [
    `Product category: ${p.category}.`,
    `Intended for ${p.gender} wear.`,
    `Key features: ${clean(p.description)}.`,
  ].join(" ") + " ";
  return HOUSE_STYLE.replace("{SUBJECT}", subjectPhrase)
    .replace("{COLOR}", colorText)
    .replace("{CATEGORY_DIRECTION}", direction)
    .replace("{DETAILS}", details);
}

const model = process.env.AI_EMBED_MODEL || "openai/text-embedding-3-small";
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("Missing AI_GATEWAY_API_KEY");
  process.exit(1);
}

console.log("Upserting product with embedding…");
await embedAndUpsert([product], { model, sourceType: "manual" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data: row, error } = await sb
  .from("products")
  .select("id, title, source, external_id, price_eur, color")
  .eq("source", SOURCE)
  .eq("external_id", EXTERNAL_ID)
  .single();
if (error) throw error;

const promptEntry = {
  id: row.id,
  source: SOURCE,
  external_id: EXTERNAL_ID,
  title: product.title,
  category: product.category,
  color: product.color,
  gender: product.gender,
  aspect_ratio: "3:4",
  suggested_filename: `${slug(SOURCE)}_${slug(EXTERNAL_ID)}.png`,
  prompt: buildPrompt(product),
};

const promptsPath = new URL("../data/catalog-image-prompts.json", import.meta.url);
const all = JSON.parse(await readFile(promptsPath, "utf8"));
const idx = all.findIndex((x) => x.id === row.id || (x.source === SOURCE && x.external_id === EXTERNAL_ID));
if (idx >= 0) all[idx] = promptEntry;
else all.push(promptEntry);
await writeFile(promptsPath, JSON.stringify(all, null, 2) + "\n", "utf8");

console.log("\n✓ Product added:");
console.log(JSON.stringify(row, null, 2));
console.log("\n✓ Prompt appended to data/catalog-image-prompts.json");
console.log("\n--- Image prompt ---\n");
console.log(promptEntry.prompt);
console.log("\nSuggested file: public/images/catalog/" + promptEntry.suggested_filename);
