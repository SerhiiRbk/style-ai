/**
 * Shared product-title humanization — the SINGLE source of truth used by both
 * the app (src/lib/product-title.ts re-exports from here) and every catalogue
 * ingest path (feed adapter, scraper JSON import, /api/catalog/import).
 *
 * Feed/scraper titles arrive either abbreviated ("CHCKD SMCK PLLVR") or in full
 * uppercase ("100% LINEN OVERSHIRT WITH POCKETS"). Normalising them at ingest —
 * BEFORE category classification, style tagging and embedding — means the whole
 * pipeline reasons over real words, and the stored title reads cleanly without a
 * display-time pass. The app-side humanizer remains an idempotent safety net.
 */

/** Merchant feed tokens (Zara, Awin, etc.) → readable words. */
const TOKEN_EXPANSIONS = {
  chckd: "checked",
  chk: "check",
  strpd: "striped",
  strp: "stripe",
  smck: "smock",
  pllvr: "pullover",
  plvr: "pullover",
  plv: "pullover",
  swtr: "sweater",
  jckt: "jacket",
  jkt: "jacket",
  blzr: "blazer",
  crdgn: "cardigan",
  crd: "cardigan",
  hdy: "hoodie",
  hddi: "hoodie",
  trsr: "trousers",
  trs: "trousers",
  pnts: "pants",
  jns: "jeans",
  dnm: "denim",
  shrt: "shirt",
  drss: "dress",
  skrt: "skirt",
  ctdy: "corduroy",
  lthr: "leather",
  wln: "wool",
  ctn: "cotton",
  lnm: "linen",
  snkr: "sneaker",
  snkrs: "sneakers",
  bt: "boot",
  bts: "boots",
  crw: "crew",
  vnk: "v-neck",
  ovrshrt: "overshirt",
  qld: "quilted",
  qtd: "quilted",
  pfd: "puffer",
  dwn: "down",
  wsh: "wash",
  stn: "satin",
  vlvt: "velvet",
  rlx: "relaxed",
  slm: "slim",
  reg: "regular",
  wde: "wide",
  strght: "straight",
  tprd: "tapered",
  ankl: "ankle",
  crp: "crop",
  lng: "long",
  sht: "short",
  slv: "sleeve",
  slvs: "sleeves",
  btn: "button",
  db: "double",
  sngl: "single",
  brst: "breasted",
  pkt: "pocket",
  pkts: "pockets",
  cllr: "collar",
  prt: "print",
  flrl: "floral",
  gngm: "gingham",
  plid: "plaid",
  twl: "twill",
  flc: "fleece",
  rbed: "ribbed",
  mlt: "multi",
  lgt: "light",
  drk: "dark",
  nv: "navy",
  bge: "beige",
  gry: "grey",
  khk: "khaki",
  chlsea: "chelsea",
  ovr: "oversized",
  fld: "field",
  hrngbn: "herringbone",
  hr: "high-rise",
  tnk: "tank",
  vst: "vest",
  wbnd: "waistband",
  elstc: "elastic",
  drp: "drop",
  shldr: "shoulder",
  clsc: "classic",
  essntl: "essential",
  basc: "basic",
  strch: "stretch",
  strctd: "structured",
  lndry: "laundry",
  mchn: "machine",
  drbl: "durable",
  wrm: "warm",
  cl: "cool",
  soft: "soft",
  txt: "textured",
  mtlc: "metallic",
  shny: "shiny",
  mt: "matte",
  crnk: "crinkled",
  crshd: "crushed",
  frng: "fringe",
  pltd: "pleated",
  pltds: "pleats",
  rffl: "ruffle",
  bmb: "bomber",
  pch: "patch",
  emb: "embroidered",
  prf: "perf",
  lnd: "linen-blend",
  vsc: "viscose",
  ply: "poly",
  slp: "slip",
  wrap: "wrap",
  tie: "tie",
  zip: "zip",
  fly: "fly",
  fnl: "final",
  sale: "sale",
  // Feed variants surfaced by the 2026-07 catalogue backfill. Sizes (xl/lg/ml)
  // and ambiguous tokens (llc/wd/slr/plt/snps) are deliberately left unexpanded.
  knt: "knit",
  tp: "top",
  pnt: "pant",
  jmpr: "jumper",
  jggr: "jogger",
  swtshrt: "sweatshirt",
  tshrt: "t-shirt",
  jmpswt: "jumpsuit",
  swmswt: "swimsuit",
  lnn: "linen",
  dbl: "double",
  trpl: "triple",
  bltd: "belted",
  brdd: "braided",
  lyr: "layer",
  fntsy: "fantasy",
  crppd: "cropped",
  prntd: "printed",
  strppd: "striped",
  flwrs: "flowers",
  blln: "balloon",
  btwng: "batwing",
  crg: "cargo",
  crds: "cords",
  wstbnd: "waistband",
  ncklcs: "necklace",
  snglss: "sunglasses",
  rng: "ring",
  pk: "pack",
  pck: "pack",
  st: "set",
  // Footwear
  sndls: "sandals",
  sndl: "sandal",
  lfrs: "loafers",
  lfr: "loafer",
  brgs: "brogues",
  brg: "brogue",
  drby: "derby",
  drbs: "derbies",
  mnk: "monk",
  espdrll: "espadrille",
  clg: "clog",
  clgs: "clogs",
  sld: "slide",
  slds: "slides",
  mle: "mule",
  mls: "mules",
  // Bags & accessories
  bg: "bag",
  bgs: "bags",
  hndbg: "handbag",
  crssbdy: "crossbody",
  bckpck: "backpack",
  scrf: "scarf",
  scrvs: "scarves",
  blt: "belt",
  blts: "belts",
  glvs: "gloves",
  glv: "glove",
  bnie: "beanie",
  bnnie: "beanie",
  wllt: "wallet",
  sngls: "sunglasses",
  // Materials & misc
  wl: "wool",
  cshmr: "cashmere",
  mrn: "merino",
  cordry: "corduroy",
  tex: "textured",
};

const BRAND_LABELS = {
  zara: "Zara",
  hm: "H&M",
  cos: "COS",
  arket: "Arket",
  mango: "Mango",
  asos: "ASOS",
  uniqlo: "Uniqlo",
  levis: "Levi's",
  "levi's": "Levi's",
  muji: "MUJI",
};

function titleCaseSegment(segment) {
  const lower = segment.toLowerCase();
  if (BRAND_LABELS[lower]) return BRAND_LABELS[lower];
  if (/^\d+$/.test(segment)) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

function titleCaseWord(word) {
  if (word.includes("-")) {
    return word.split("-").map(titleCaseSegment).join("-");
  }
  return titleCaseSegment(word);
}

function expandToken(token) {
  const bare = token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
  const lower = bare.toLowerCase();
  const expanded = TOKEN_EXPANSIONS[lower];
  if (!expanded) return token;
  const prefix = token.slice(0, token.indexOf(bare));
  const suffix = token.slice(token.indexOf(bare) + bare.length);
  return `${prefix}${expanded}${suffix}`;
}

/**
 * Turn a feed-style product title into readable copy. Idempotent: expanded,
 * title-cased text passes through unchanged, so it is safe to re-run (the ingest
 * belt and the app-side call may both touch the same string).
 *
 * @param {string} raw
 * @returns {string}
 */
export function humanizeProductTitle(raw) {
  const trimmed = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const tokens = trimmed.split(" ");
  const out = [];

  for (const token of tokens) {
    const expanded = expandToken(token);
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === expanded.toLowerCase()) continue;
    out.push(expanded);
  }

  return out.map(titleCaseWord).join(" ");
}

/**
 * Humanize a raw title and keep the original alongside it, for the ingest paths
 * that persist both `title` (clean) and `title_raw` (provenance).
 *
 * @param {string} raw
 * @returns {{ title: string, titleRaw: string }}
 */
export function normalizeTitle(raw) {
  const titleRaw = String(raw ?? "").trim();
  return { title: humanizeProductTitle(titleRaw), titleRaw };
}

/**
 * Combine brand + title into readable display copy.
 *
 * @param {string | null | undefined} brand
 * @param {string | null | undefined} title
 * @returns {string}
 */
export function formatCatalogProductTitle(brand, title) {
  const parts = [brand, title].filter(
    (p) => typeof p === "string" && p.trim().length > 0,
  );
  if (!parts.length) return "";
  return humanizeProductTitle(parts.join(" "));
}
