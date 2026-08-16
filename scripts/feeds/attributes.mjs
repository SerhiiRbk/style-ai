/**
 * Typed clothing attributes harvested from feed attrs / title / description.
 * One vocab for ingest, backfill, and server-side look matching. No guessing:
 * filler and unknown tokens → null. Never infer a fiber from a garment noun.
 */

export const ATTR_TYPING_VERSION = 4;

const MATERIAL_FAMILY = [
  "wool",
  "cotton",
  "linen",
  "denim",
  "leather",
  "suede",
  "silk",
  "viscose",
  "corduroy",
  "tweed",
  "velvet",
  "fleece",
  "canvas",
  "technical",
];

/** Higher index = more distinctive when a blend lists several fibers. */
const MATERIAL_PRIORITY = {
  leather: 13,
  suede: 12,
  linen: 11,
  silk: 10,
  wool: 9,
  tweed: 8,
  corduroy: 7,
  velvet: 6,
  denim: 5,
  canvas: 4,
  technical: 3,
  viscose: 2,
  fleece: 1,
  cotton: 0,
};

const MATERIAL_MAP = {
  wool: "wool",
  merino: "wool",
  cashmere: "wool",
  lambswool: "wool",
  worsted: "wool",
  cotton: "cotton",
  linen: "linen",
  denim: "denim",
  jean: "denim",
  leather: "leather",
  lambskin: "leather",
  calfskin: "leather",
  suede: "suede",
  nubuck: "suede",
  silk: "silk",
  viscose: "viscose",
  rayon: "viscose",
  corduroy: "corduroy",
  cord: "corduroy",
  tweed: "tweed",
  velvet: "velvet",
  fleece: "fleece",
  canvas: "canvas",
  technical: "technical",
  nylon: "technical",
  polyester: "technical",
  polyamide: "technical",
  "gore-tex": "technical",
  goretex: "technical",
  // Cellulosic semi-synthetics → viscose family ("cellulose" catches
  // "cellulose diacetate"; "acetate" covers eyewear/lining acetate).
  lyocell: "viscose",
  tencel: "viscose",
  modal: "viscose",
  cupro: "viscose",
  cellulose: "viscose",
  acetate: "viscose",
  // Synthetics → technical. Multi-word keys are longest-matched first, so
  // "ethylene vinyl acetate" resolves to technical, not the "acetate" alias.
  polyurethane: "technical",
  polyethylene: "technical",
  acrylic: "technical",
  acrylonitrile: "technical",
  elastane: "technical",
  spandex: "technical",
  elastomultiester: "technical",
  "ethylene vinyl acetate": "technical",
  // Plant bast fibres → linen family (closest in the vocab).
  hemp: "linen",
  ramie: "linen",
  // NOTE: hardware/trims (brass, steel, zinc, iron, aluminium, zamak, pearl,
  // paper) are intentionally NOT mapped — they are not fabrics, so material_family
  // stays null for jewelry/watches/buckles (honest, contributes 0 to ranking).
};

const FILLER = new Set([
  "combined materials",
  "combined material",
  "mixed materials",
  "various materials",
  "woven",
  "fabric",
  "textile",
  "blend",
  "mixed",
  "various",
  "other",
  "n/a",
  "na",
  "unknown",
]);

const FIT_MAP = {
  slim: "slim",
  skinny: "slim",
  "extra slim": "slim",
  extraslim: "slim",
  tailored: "tailored",
  regular: "regular",
  relaxed: "relaxed",
  oversized: "oversized",
  oversize: "oversized",
  baggy: "oversized",
};

const PATTERN_MAP = {
  solid: "solid",
  plain: "solid",
  "plain design": "solid",
  stripe: "stripe",
  striped: "stripe",
  stripes: "stripe",
  pinstripe: "stripe",
  check: "check",
  checked: "check",
  plaid: "check",
  gingham: "check",
  houndstooth: "houndstooth",
  herringbone: "herringbone",
  floral: "floral",
  paisley: "paisley",
  camo: "camo",
  camouflage: "camo",
  graphic: "graphic",
  textured: "textured",
};

/**
 * Phrase → garment noun. Pocket/style fragments like "cargo" are omitted so
 * they cannot beat a real garment ("Cargo Bermuda Shorts" → shorts).
 */
const SUBTYPE_MAP = {
  "shirt jacket": "jacket",
  "suit jacket": "blazer",
  "sport coat": "blazer",
  "double-breasted blazer": "blazer",
  "double breasted blazer": "blazer",
  "bermuda shorts": "shorts",
  "cargo shorts": "shorts",
  overshirt: "overshirt",
  shacket: "overshirt",
  blazer: "blazer",
  jacket: "jacket",
  coat: "coat",
  overcoat: "coat",
  trench: "trench",
  bomber: "bomber",
  parka: "parka",
  shirt: "shirt",
  shorts: "shorts",
  crossbody: "crossbody",
  hoodie: "hoodie",
  sweatshirt: "sweatshirt",
  cardigan: "cardigan",
  sweater: "sweater",
  jumper: "sweater",
  pullover: "sweater",
  crewneck: "sweater",
  turtleneck: "sweater",
  polo: "polo",
  tee: "tee",
  "t-shirt": "tee",
  tshirt: "tee",
  henley: "henley",
  chinos: "chinos",
  chino: "chinos",
  jeans: "jeans",
  trousers: "trousers",
  pants: "trousers",
  loafers: "loafers",
  loafer: "loafers",
  sneakers: "sneakers",
  sneaker: "sneakers",
  trainers: "sneakers",
  boots: "boots",
  boot: "boots",
  derbies: "derbies",
  derby: "derbies",
  "oxford shoes": "oxfords",
  "oxford shoe": "oxfords",
  oxfords: "oxfords",
  sandals: "sandals",
  belt: "belt",
  watch: "watch",
  tie: "tie",
  scarf: "scarf",
  hat: "hat",
  cap: "cap",
  beanie: "beanie",
};

export const GARMENT_SUBTYPES = [...new Set(Object.values(SUBTYPE_MAP))].sort();

const SUBTYPE_KEYS = Object.keys(SUBTYPE_MAP).sort((a, b) => b.length - a.length);
const FIT_KEYS = Object.keys(FIT_MAP).sort((a, b) => b.length - a.length);
const PATTERN_KEYS = Object.keys(PATTERN_MAP).sort((a, b) => b.length - a.length);
const MATERIAL_KEYS = Object.keys(MATERIAL_MAP).sort((a, b) => b.length - a.length);

function asText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeHay(text) {
  return asText(text)
    .toLowerCase()
    .replace(/[_/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstPhraseMatch(hay, keys, map) {
  if (!hay) return null;
  for (const key of keys) {
    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(key)}(?:[^a-z0-9]|$)`, "i");
    if (re.test(hay)) return map[key];
  }
  return null;
}

function isFiller(text) {
  const hay = normalizeHay(text);
  return !hay || FILLER.has(hay);
}

function pickDistinctive(families) {
  let best = null;
  let bestPri = -1;
  for (const fam of families) {
    if (!MATERIAL_FAMILY.includes(fam)) continue;
    const pri = MATERIAL_PRIORITY[fam] ?? -1;
    if (pri > bestPri) {
      best = fam;
      bestPri = pri;
    }
  }
  return best;
}

export function normMaterial(text) {
  if (text == null) return null;
  const raw = asText(text);
  if (!raw || isFiller(raw)) return null;
  const hay = normalizeHay(raw);
  const parts = hay.split(/\s*(?:,|&| and |\+|\/)\s*/).filter(Boolean);
  const found = [];
  for (const part of parts) {
    if (isFiller(part)) continue;
    const fam = firstPhraseMatch(part, MATERIAL_KEYS, MATERIAL_MAP);
    if (fam) found.push(fam);
  }
  if (found.length) return pickDistinctive(found);
  return firstPhraseMatch(hay, MATERIAL_KEYS, MATERIAL_MAP);
}

export function normFit(text) {
  if (text == null) return null;
  const hay = normalizeHay(text);
  if (!hay) return null;
  return firstPhraseMatch(hay, FIT_KEYS, FIT_MAP);
}

export function normPattern(text) {
  if (text == null) return null;
  const hay = normalizeHay(text);
  if (!hay) return null;
  if (/\bpatterned\b/.test(hay) && !firstPhraseMatch(hay, PATTERN_KEYS, PATTERN_MAP)) {
    return null;
  }
  return firstPhraseMatch(hay, PATTERN_KEYS, PATTERN_MAP);
}

export function normSubtype(title) {
  if (title == null) return null;
  const hay = normalizeHay(title);
  if (!hay) return null;
  return firstPhraseMatch(hay, SUBTYPE_KEYS, SUBTYPE_MAP);
}

export function normSeason(attrsSeason) {
  if (attrsSeason == null) return null;
  const hay = normalizeHay(attrsSeason);
  if (!hay) return null;
  if (/\b(all[-\s]?season|year[-\s]?round|ss\/aw|aw\/ss)\b/.test(hay)) {
    return "all_season";
  }
  if (/\b(transitional|resort|pre[-\s]?fall|cruise)\b/.test(hay)) {
    return "transitional";
  }
  if (/\b(aw|fw|a\/w|f\/w|autumn|fall|winter)\b/.test(hay)) return "winter";
  if (/\b(ss|s\/s|spring|summer)\b/.test(hay)) return "summer";
  return null;
}

function firstNonNull(candidates) {
  for (const v of candidates) if (v) return v;
  return null;
}

export function parseProductAttributes(p) {
  const title = p?.title || "";
  const desc = p?.description || "";
  const a = p?.attrs || {};
  return {
    garment_subtype: normSubtype(title) ?? normSubtype(desc),
    material_family: firstNonNull([
      normMaterial(a.material),
      normMaterial(title),
      normMaterial(desc),
    ]),
    fit: firstNonNull([normFit(a.fit), normFit(title), normFit(desc)]),
    pattern: firstNonNull([
      normPattern(a.pattern),
      normPattern(title),
      normPattern(desc),
    ]),
    season: normSeason(a.season),
  };
}
