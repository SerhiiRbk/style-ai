// Read-only audit of catalogue categorisation quality.
//
//   node --env-file=.env.local scripts/audit-categories.mjs [--limit N] [--show M]
//
// Prints the current category distribution and flags rows whose TITLE strongly
// signals a different category than the one stored — a preview of how many rows
// an improved, score-based classifier would move. Makes no writes.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const valArg = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
const showPerBucket = valArg("--show", 12);

const sb = createClient(url, key, { auth: { persistSession: false } });

/**
 * Weighted, word-boundary category signals. Specific garment nouns (pullover,
 * blazer, derby) outweigh generic ones (top, shoe, bag) so an early generic
 * match can't beat a decisive specific one. Weight 3 = specific, 2 = medium,
 * 1 = generic/ambiguous.
 */
const SIGNALS = {
  Outerwear: [
    ["coat", 3], ["overcoat", 3], ["topcoat", 3], ["peacoat", 3], ["pea coat", 3],
    ["trench", 3], ["parka", 3], ["gilet", 3], ["puffer", 3], ["raincoat", 3],
    ["windbreaker", 3], ["anorak", 3], ["bomber", 3], ["harrington", 3],
    ["blazer", 3], ["overshirt", 2], ["shacket", 2], ["jacket", 2],
  ],
  Knitwear: [
    ["pullover", 3], ["jumper", 3], ["sweater", 3], ["cardigan", 3], ["knit", 3],
    ["turtleneck", 3], ["rollneck", 3], ["roll neck", 3], ["hoodie", 3],
    ["sweatshirt", 3], ["crewneck", 2], ["crew neck", 2], ["fleece", 2],
  ],
  Shirts: [
    ["t-shirt", 3], ["tshirt", 3], ["tee", 3], ["polo", 3], ["henley", 3],
    ["blouse", 3], ["tank top", 3], ["oxford shirt", 3], ["shirt", 2], ["top", 1],
  ],
  Trousers: [
    ["trouser", 3], ["trousers", 3], ["chino", 3], ["chinos", 3], ["jean", 3],
    ["jeans", 3], ["slacks", 3], ["legging", 3], ["leggings", 3], ["cargo", 3],
    ["corduroy", 3], ["cords", 2], ["shorts", 3], ["denim", 2], ["pant", 2],
    ["pants", 2],
  ],
  Footwear: [
    ["sneaker", 3], ["sneakers", 3], ["trainer", 3], ["trainers", 3], ["boot", 3],
    ["boots", 3], ["loafer", 3], ["loafers", 3], ["derby", 3], ["derbies", 3],
    ["sandal", 3], ["sandals", 3], ["brogue", 3], ["brogues", 3], ["espadrille", 3],
    ["mule", 3], ["mules", 3], ["slipper", 3], ["plimsoll", 3], ["chukka", 3],
    ["monk strap", 3], ["chelsea", 2], ["shoe", 2], ["shoes", 2],
  ],
  Accessories: [
    ["watch", 3], ["belt", 3], ["scarf", 3], ["glove", 3], ["gloves", 3],
    ["sunglasses", 3], ["sunglass", 3], ["wallet", 3], ["cufflink", 3],
    ["cufflinks", 3], ["pocket square", 3], ["beanie", 3], ["umbrella", 3],
    ["tie", 3], ["bow tie", 3], ["cap", 2], ["hat", 2],
  ],
  Bags: [
    ["backpack", 3], ["rucksack", 3], ["tote", 3], ["holdall", 3], ["duffel", 3],
    ["duffle", 3], ["weekender", 3], ["briefcase", 3], ["messenger bag", 3],
    ["satchel", 3], ["crossbody", 3], ["bag", 2],
  ],
  Suits: [["tuxedo", 3], ["suit", 3]],
  Dresses: [["dress", 3], ["gown", 3], ["skirt", 3]],
  Grooming: [
    ["fragrance", 3], ["cologne", 3], ["perfume", 3], ["aftershave", 3],
    ["skincare", 3], ["moisturiser", 3], ["moisturizer", 3], ["shampoo", 3],
    ["beard oil", 3], ["pomade", 3], ["razor", 3],
  ],
  Underwear: [
    ["boxer", 3], ["boxers", 3], ["briefs", 3], ["trunks", 3], ["sock", 3],
    ["socks", 3], ["pyjama", 3], ["pajama", 3], ["undershirt", 3], ["loungewear", 2],
  ],
  Swimwear: [["swim", 3], ["swimsuit", 3], ["bikini", 3], ["boardshort", 3], ["board short", 3]],
  Activewear: [["activewear", 3], ["tracksuit", 3], ["gymwear", 3], ["rashguard", 3], ["base layer", 3]],
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const COMPILED = Object.entries(SIGNALS).map(([cat, toks]) => ({
  cat,
  rules: toks.map(([w, wt]) => ({ re: new RegExp(`\\b${escape(w)}\\b`, "i"), wt })),
}));

/** Score every category from the text; return sorted [cat, score] desc. */
function scoreCategories(text) {
  const t = text || "";
  const scores = [];
  for (const { cat, rules } of COMPILED) {
    let best = 0;
    for (const { re, wt } of rules) if (wt > best && re.test(t)) best = wt;
    if (best > 0) scores.push([cat, best]);
  }
  return scores.sort((a, b) => b[1] - a[1]);
}

const PAGE = 1000;
let cursor = null;
let total = 0;
const dist = new Map();
const moves = new Map(); // "Stored → Suggested" → [{title, brand}]
let flagged = 0;

for (;;) {
  let q = sb
    .from("products")
    .select("id, title, brand, category, description")
    .order("id", { ascending: true })
    .limit(PAGE);
  if (cursor) q = q.gt("id", cursor);
  const { data, error } = await q;
  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  cursor = data[data.length - 1].id;

  for (const row of data) {
    total++;
    dist.set(row.category, (dist.get(row.category) ?? 0) + 1);

    // Title is the strong signal; description is a weak tie-breaker only.
    const titleScores = scoreCategories(row.title);
    const top = titleScores[0];
    if (!top) continue;
    const [suggested, topWt] = top;
    if (suggested === row.category) continue;

    // Flag only decisive disagreements: the title carries a SPECIFIC (wt 3)
    // signal for another category, and NO equal/stronger signal for the stored
    // one — i.e. the stored category isn't supported by the title at all.
    const storedWt = titleScores.find(([c]) => c === row.category)?.[1] ?? 0;
    if (topWt >= 3 && topWt > storedWt) {
      flagged++;
      const key = `${row.category} → ${suggested}`;
      if (!moves.has(key)) moves.set(key, []);
      moves.get(key).push({ title: row.title, brand: row.brand });
    }
  }
}

console.log(`\n=== Catalogue: ${total} products ===\n`);
console.log("Current category distribution:");
for (const [cat, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(cat).padEnd(13)} ${String(n).padStart(5)}`);
}

console.log(`\nSuspected mislabels (title signals another category): ${flagged}\n`);
const byCount = [...moves.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [key, rows] of byCount) {
  console.log(`  ${key.padEnd(28)} ${rows.length}`);
  for (const r of rows.slice(0, showPerBucket)) {
    console.log(`      • ${r.brand ? `[${r.brand}] ` : ""}${r.title}`);
  }
  if (rows.length > showPerBucket) console.log(`      … +${rows.length - showPerBucket} more`);
}
console.log("");
