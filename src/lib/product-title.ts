/** Merchant feed tokens (Zara, Awin, etc.) → readable words. */
const TOKEN_EXPANSIONS: Record<string, string> = {
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

const BRAND_LABELS: Record<string, string> = {
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

function titleCaseSegment(segment: string): string {
  const lower = segment.toLowerCase();
  if (BRAND_LABELS[lower]) return BRAND_LABELS[lower];
  if (/^\d+$/.test(segment)) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

function titleCaseWord(word: string): string {
  if (word.includes("-")) {
    return word.split("-").map(titleCaseSegment).join("-");
  }
  return titleCaseSegment(word);
}

function expandToken(token: string): string {
  const bare = token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
  const lower = bare.toLowerCase();
  const expanded = TOKEN_EXPANSIONS[lower];
  if (!expanded) return token;
  const prefix = token.slice(0, token.indexOf(bare));
  const suffix = token.slice(token.indexOf(bare) + bare.length);
  return `${prefix}${expanded}${suffix}`;
}

/** Turn feed-style product titles into readable copy for the report UI. */
export function humanizeProductTitle(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const tokens = trimmed.split(" ");
  const out: string[] = [];

  for (const token of tokens) {
    const expanded = expandToken(token);
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === expanded.toLowerCase()) continue;
    out.push(expanded);
  }

  return out.map(titleCaseWord).join(" ");
}

export function formatCatalogProductTitle(
  brand?: string | null,
  title?: string | null,
): string {
  const parts = [brand, title].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  if (!parts.length) return "";
  return humanizeProductTitle(parts.join(" "));
}
