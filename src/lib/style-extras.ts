/**
 * Expert "stylist layer": rule-based recommendations derived deterministically
 * from the Style Profile, colour palette and shopping list. Kept pure (no AI
 * dependency) so it works identically in demo and live mode and never breaks
 * the model's structured-output contract.
 */
import type { ColorRec, Look, ShoppingItem, StyleReport } from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";

export type FrameShapeId =
  | "rectangle"
  | "round"
  | "wayfarer"
  | "aviator"
  | "geometric";

export type Metal = { name: string; hex: string; why: string };
export type FrameRec = { shape: FrameShapeId; name: string; why: string };
export type FitSpec = { part: string; spec: string; why: string };
export type ColorCombo = { name: string; hexes: string[]; why: string };
export type GroomingItem = { title: string; detail: string };
export type PriorityMove = { n: string; title: string; why: string };

export type Pairings = {
  base: ColorRec[];
  accent: ColorRec[];
  hero: ColorRec | null;
  combos: ColorCombo[];
};

export type CapsulePlan = {
  pieces: number;
  outfits: number;
  now: ShoppingItem[];
  next: ShoppingItem[];
  later: ShoppingItem[];
};

export type Archetype = { name: string; line: string };

export type ColorDNA = {
  subseason: string;
  neutrals: ColorRec[];
  bestWhite: string;
  bestDenim: string;
  metal: string;
  blackAlt: string;
  contrastRule: string;
};

export type OutfitCombo = { context: string; pieces: string[]; image?: string };

export type PriceTier = {
  category: string;
  good: number;
  better: number;
  best: number;
  note: string;
};

export type StyleExtras = {
  archetype: Archetype;
  priorityMoves: PriorityMove[];
  colorDNA: ColorDNA;
  metals: { recommend: Metal[]; avoidNote: string };
  eyewear: { recommend: FrameRec[]; avoid: string[] };
  fitBlueprint: FitSpec[];
  pairings: Pairings;
  fabrics: { name: string; why: string }[];
  capsule: CapsulePlan;
  matrix: OutfitCombo[];
  priceTiers: PriceTier[];
  grooming: GroomingItem[];
  styling: string[];
  care: string[];
  fragrance: string;
};

/* ---------------------------------- utils --------------------------------- */

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, l: 0.6 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  const d = max - min;
  if (d !== 0) s = d / (1 - Math.abs(2 * l - 1));
  return { h: 0, s, l };
}

const lc = (s: string) => (s || "").toLowerCase();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* --------------------------------- metals --------------------------------- */

function metalsFor(undertone: string): {
  recommend: Metal[];
  avoidNote: string;
} {
  if (lc(undertone) === "cool") {
    return {
      recommend: [
        { name: "Silver", hex: "#C7CCD1", why: "Cool brightness echoes your undertone and keeps metals from looking sallow." },
        { name: "Brushed steel", hex: "#9AA4AD", why: "A muted cool grey for watches and buckles — modern, never flashy." },
        { name: "White gold / platinum", hex: "#E3E4E6", why: "The dressiest cool metal for a watch or a single ring." },
      ],
      avoidNote: "Avoid bright yellow gold near the face — it fights a cool undertone.",
    };
  }
  if (lc(undertone) === "warm") {
    return {
      recommend: [
        { name: "Yellow gold", hex: "#C9A24B", why: "Warm gold harmonises with your undertone and warms the complexion." },
        { name: "Brass / bronze", hex: "#9A7B4F", why: "An understated warm metal for buckles and watch cases." },
        { name: "Cognac leather", hex: "#8A5A33", why: "Treat warm-toned leather as your 'metal' — straps, belts, shoes tie it together." },
      ],
      avoidNote: "Avoid bright chrome / cool silver next to the face — it can read cold against warm skin.",
    };
  }
  return {
    recommend: [
      { name: "Soft gold", hex: "#C2A35C", why: "Neutral undertones carry warm metals beautifully without overpowering." },
      { name: "Steel", hex: "#A2AAB2", why: "Cool steel also works — you can mix metals more freely than most." },
      { name: "Two-tone", hex: "#B8A06A", why: "A two-tone watch is a safe, versatile anchor for a neutral undertone." },
    ],
    avoidNote: "You can wear most metals — just keep the whole outfit to one dominant tone.",
  };
}

/* -------------------------------- eyewear --------------------------------- */

function eyewearFor(faceShape: string): { recommend: FrameRec[]; avoid: string[] } {
  const f = lc(faceShape);
  if (f.includes("round")) {
    return {
      recommend: [
        { shape: "rectangle", name: "Rectangular", why: "Angular lines add definition and lengthen a round face." },
        { shape: "wayfarer", name: "Wayfarer", why: "Structured top bar sharpens soft features." },
        { shape: "geometric", name: "Geometric", why: "Defined corners counterbalance roundness." },
      ],
      avoid: ["Round frames", "Small rimless"],
    };
  }
  if (f.includes("square")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Soft curves balance a strong, angular jaw." },
        { shape: "aviator", name: "Aviator", why: "Curved bottom edge softens square corners." },
        { shape: "wayfarer", name: "Wayfarer", why: "A friendly all-rounder that takes the edge off." },
      ],
      avoid: ["Sharp rectangular", "Boxy frames"],
    };
  }
  if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Adds width and breaks up a longer face." },
        { shape: "aviator", name: "Aviator", why: "Tall lens fills vertical space and balances proportions." },
        { shape: "geometric", name: "Bold geometric", why: "Deeper frames shorten the appearance of length." },
      ],
      avoid: ["Narrow rectangles", "Very thin frames"],
    };
  }
  if (f.includes("heart") || f.includes("triang")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Adds softness to a wider forehead and narrower chin." },
        { shape: "aviator", name: "Aviator", why: "Bottom-heavy shape balances the upper face." },
        { shape: "wayfarer", name: "Light wayfarer", why: "Keep it light on top to avoid widening the brow." },
      ],
      avoid: ["Heavy top-bar frames", "Embellished cat-eye"],
    };
  }
  // Oval (and default) — most shapes work; play to balance.
  return {
    recommend: [
      { shape: "wayfarer", name: "Wayfarer", why: "Classic balance for an oval face — versatile and modern." },
      { shape: "rectangle", name: "Rectangular", why: "Keeps proportions in check without elongating." },
      { shape: "aviator", name: "Aviator", why: "Adds a relaxed, confident edge while keeping balance." },
    ],
    avoid: ["Oversized round (over-elongates)", "Very narrow frames"],
  };
}

/** Top eyewear picks for premium personalized previews (1–2). */
export function premiumEyewearPicks(profile: StyleProfile): FrameRec[] {
  return eyewearFor(profile.physical.faceShape).recommend.slice(0, 2);
}

/** Named facial-hair styles for premium photo previews (1–2). */
export function facialHairFor(
  profile: StyleProfile,
): { name: string; why: string }[] {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      {
        name: "Clean-shaven",
        why: "Keeps focus on your features and pairs cleanly with structured tailoring.",
      },
      {
        name: "Soft natural brows",
        why: "Well-groomed brows frame the face — the detail that reads as polished.",
      },
    ];
  }

  const f = lc(profile.physical.faceShape);
  if (f.includes("round")) {
    return [
      {
        name: "Short boxed beard",
        why: "A slightly longer chin with tighter cheeks adds length to a round face.",
      },
      {
        name: "Light stubble",
        why: "Even 2–3 mm stubble sharpens the jaw without adding width.",
      },
    ];
  }
  if (f.includes("square")) {
    return [
      {
        name: "Rounded full beard",
        why: "Soft curves along the jaw balance strong, angular bone structure.",
      },
      {
        name: "Classic mustache",
        why: "A neat mustache draws the eye upward and softens a square jawline.",
      },
    ];
  }
  if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    return [
      {
        name: "Full beard with side volume",
        why: "Width on the cheeks breaks up vertical length and balances proportions.",
      },
      {
        name: "Short goatee",
        why: "Concentrated length at the chin adds width without elongating the face.",
      },
    ];
  }
  if (f.includes("heart") || f.includes("triang")) {
    return [
      {
        name: "Medium stubble",
        why: "Even coverage adds weight to a narrower chin and balances a wider forehead.",
      },
      {
        name: "Short beard, clean cheeks",
        why: "Keeps the upper face light while defining the jaw.",
      },
    ];
  }
  return [
    {
      name: "Short even beard",
      why: "A tidy, even line suits an oval face — natural cheek line, clean neckline.",
    },
    {
      name: "Refined stubble",
      why: "Low-maintenance texture that reads modern without overpowering your features.",
    },
  ];
}

/* ------------------------------ fit blueprint ----------------------------- */

function fitBlueprint(profile: StyleProfile): FitSpec[] {
  const bt = lc(profile.physical.bodyType);
  const m = profile.physical.measurements;
  const specs: FitSpec[] = [];

  // Measurement interpretation (shoulder-to-waist drop).
  if (m?.shoulderCm && m?.waistCm) {
    const drop = m.shoulderCm - m.waistCm;
    const reading =
      drop >= 18
        ? "an athletic V-taper"
        : drop >= 10
          ? "a balanced build"
          : "a straight, even frame";
    specs.push({
      part: "Your proportions",
      spec: `Shoulder ${m.shoulderCm} to waist ${m.waistCm} cm (drop ${drop} cm)`,
      why: `This reads as ${reading} — the cuts below are tuned to it.`,
    });
  }

  const structuredShoulder =
    bt === "rectangle" || bt === "triangle" || bt === "oval";
  specs.push({
    part: "Jacket shoulder",
    spec: structuredShoulder
      ? "Lightly structured, sits exactly at your shoulder bone"
      : "Natural, soft shoulder — no padding",
    why: structuredShoulder
      ? "Adds definition and a clean line to your frame."
      : "You already have width up top; extra padding would exaggerate it.",
  });

  specs.push({
    part: "Jacket length",
    spec: "Hem covers the seat, roughly mid-crotch with arm relaxed",
    why: "Balances torso and legs; too short looks boxy, too long shortens you.",
  });

  const waistSuppression =
    bt === "oval"
      ? "Minimal waist suppression; single-breasted, button open when standing"
      : "Gentle waist suppression for shape without pulling";
  specs.push({
    part: "Jacket waist",
    spec: waistSuppression,
    why:
      bt === "oval"
        ? "Clean vertical lines flatter more than a nipped waist."
        : "Hints at shape while keeping comfort and movement.",
  });

  const rise = bt === "oval" ? "Mid-to-high rise, flat front, no pleats" : "Mid-rise, flat front";
  specs.push({
    part: "Trouser rise",
    spec: rise,
    why: "Sits at the natural waist and lengthens the leg line.",
  });

  const leg =
    bt === "triangle"
      ? "Straight leg, slightly darker than the top"
      : bt === "trapezoid" || bt === "inverted-triangle"
        ? "Straight leg to balance a stronger upper body"
        : "Slim-straight, clean line to the shoe";
  specs.push({
    part: "Trouser leg & break",
    spec: `${leg}; slight break (one soft fold)`,
    why: "A slight break is the most flattering, modern length.",
  });

  if (m?.sleeveCm) {
    specs.push({
      part: "Sleeve",
      spec: `~${m.sleeveCm} cm — show ~1 cm of shirt cuff`,
      why: "A sliver of cuff signals a jacket that actually fits.",
    });
  }

  const h = profile.physical.heightCm;
  if (h) {
    const tall = h >= 185;
    const short = h <= 172;
    specs.push({
      part: `Proportion (${h} cm)`,
      spec: tall
        ? "You can carry a slightly longer jacket and a full break; medium-to-large pattern scale."
        : short
          ? "Keep jackets a touch shorter, no/slight break, small-scale patterns, tonal looks to elongate."
          : "Standard proportions: slight break, medium pattern scale, mid-rise.",
      why: tall
        ? "Your height balances longer lines without looking overwhelmed."
        : short
          ? "Vertical, uninterrupted lines make you read taller."
          : "Classic proportions flatter an average height without tricks.",
    });
  }

  return specs;
}

/* ----------------------------- colour pairings ---------------------------- */

function colorPairings(best: ColorRec[]): Pairings {
  const withSat = best.map((c) => ({ c, s: hexToHsl(c.hex).s }));
  const base = withSat.filter((x) => x.s < 0.32).map((x) => x.c);
  const accent = withSat.filter((x) => x.s >= 0.32).map((x) => x.c);
  // Guarantee non-empty groups.
  const safeBase = base.length ? base : best.slice(0, Math.min(3, best.length));
  const safeAccent = accent.length ? accent : best.slice(-2);
  const hero = safeAccent[0] ?? best[0] ?? null;

  const combos: ColorCombo[] = [];
  for (const a of safeAccent.slice(0, 2)) {
    const b1 = safeBase[0];
    const b2 = safeBase[1] ?? safeBase[0];
    if (b1)
      combos.push({
        name: `${a.name} + ${b1.name}${b2 && b2 !== b1 ? ` + ${b2.name}` : ""}`,
        hexes: [a.hex, b1.hex, b2?.hex].filter(Boolean) as string[],
        why: `One accent (${a.name}) on a neutral base reads considered, not loud.`,
      });
  }
  if (safeBase.length >= 2)
    combos.push({
      name: `${safeBase[0].name} + ${safeBase[1].name}`,
      hexes: [safeBase[0].hex, safeBase[1].hex],
      why: "An all-neutral pairing is your fail-safe for any occasion.",
    });

  return { base: safeBase, accent: safeAccent, hero, combos: combos.slice(0, 3) };
}

/* -------------------------------- fabrics --------------------------------- */

function fabricsFor(profile: StyleProfile): { name: string; why: string }[] {
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  const list: { name: string; why: string }[] = [
    { name: "Merino wool", why: "Fine, breathable knit that layers cleanly under a jacket." },
    { name: "Brushed cotton / flannel", why: "Soft matte surface adds warmth and depth to shirts and trousers." },
    { name: "Suede & nubuck", why: "Matte texture in warm browns ties your palette together." },
  ];
  if (cold)
    list.push({
      name: "Worsted & tweed wool",
      why: "Holds shape and reads refined in cooler weather.",
    });
  else
    list.push({
      name: "Linen & cotton-linen",
      why: "Breathable and relaxed for warmer days without losing structure.",
    });
  list.push({
    name: "Matte over shiny",
    why: "Keep sheen low — matte fabrics look more expensive on most men.",
  });
  return list;
}

/* ---------------------------- capsule & priority -------------------------- */

const CATEGORY_PRIORITY: Record<string, number> = {
  Outerwear: 0,
  Trousers: 1,
  Footwear: 2,
  Knitwear: 3,
  Shirts: 4,
  Accessories: 5,
};

function capsuleFrom(shopping: ShoppingItem[]): CapsulePlan {
  const count = (cats: string[]) =>
    shopping.filter((i) => cats.includes(i.category)).length;
  // Assume one pair of trousers and one pair of denim already owned → +1 each.
  const tops = count(["Knitwear", "Shirts"]) + 1; // + a layering blazer
  const bottoms = Math.max(1, count(["Trousers"])) + 1; // + owned denim/chinos
  const shoes = Math.max(1, count(["Footwear"]));
  const outfits = Math.min(40, tops * bottoms * shoes);

  const sorted = [...shopping].sort(
    (a, b) =>
      (CATEGORY_PRIORITY[a.category] ?? 9) - (CATEGORY_PRIORITY[b.category] ?? 9),
  );
  return {
    pieces: shopping.length,
    outfits,
    now: sorted.slice(0, 3),
    next: sorted.slice(3, 5),
    later: sorted.slice(5),
  };
}

/** Investment tag for a single shopping item (used as a pill in the UI). */
export function investmentLevel(item: ShoppingItem): "Invest" | "Core" | "Accent" {
  if (["Outerwear", "Footwear"].includes(item.category) || item.priceEur >= 150)
    return "Invest";
  if (["Trousers", "Knitwear", "Shirts"].includes(item.category)) return "Core";
  return "Accent";
}

/* -------------------------------- grooming -------------------------------- */

function groomingFor(profile: StyleProfile): GroomingItem[] {
  const f = lc(profile.physical.faceShape);
  let beard: string;
  if (f.includes("round"))
    beard = "Keep the beard slightly longer at the chin and tighter on the cheeks to lengthen the face.";
  else if (f.includes("square"))
    beard = "Soften the jaw with a rounded, even beard line — avoid sharp corners.";
  else if (f.includes("oblong") || f.includes("long"))
    beard = "Keep length on the sides, shorter at the chin, to add width, not length.";
  else
    beard = "A short, even beard suits you; keep the cheek line natural and the neckline clean.";

  return [
    { title: "Beard shape", detail: beard },
    { title: "Maintenance", detail: "Reshape the neckline weekly; full trim every 3–4 weeks to keep the cut intact." },
    { title: "Skin", detail: "Daily moisturiser and SPF; aim for a healthy matte finish, not shine." },
    { title: "Brows & details", detail: "Tidy stray brow hairs and nostril/ear hair — small things that read as 'polished'." },
    { title: "Styling product", detail: "A matte clay or paste for the textured crop — pea-sized, worked through towel-dry hair." },
  ];
}

/* ------------------------- styling, care, fragrance ----------------------- */

const STYLING_MECHANICS = [
  "Match your belt to your shoes — same tone, same finish.",
  "Roll shirt sleeves to just below the elbow when going jacket-free.",
  "Layer in a ratio: one structured piece, one soft, one anchor (shoe).",
  "Half-tuck or full-tuck with mid-rise trousers to define the waistline.",
  "Keep one point of interest per outfit — let the rest stay quiet.",
];

const CARE_GUIDE = [
  "Buy on cost-per-wear: a €189 blazer worn 100× beats five €40 impulse buys.",
  "Brush suede after each wear and use a cedar shoe tree to hold shape.",
  "Rotate shoes — never wear the same pair two days running.",
  "Budget ~10% of each purchase for tailoring; fit is what people notice.",
];

function fragranceFor(profile: StyleProfile): string {
  const season = lc(profile.colorSeason);
  const bold = lc(profile.boldness);
  const family =
    season === "autumn" || season === "winter"
      ? "warm woody-amber (sandalwood, cedar, vetiver)"
      : "fresh aromatic (citrus, neroli, light woods)";
  const strength =
    bold === "statement" || bold === "experimental"
      ? "you can carry more projection in the evening"
      : "keep it close to the skin for daytime";
  return `A ${family} fragrance suits your colouring; ${strength}.`;
}

/* ----------------------------- priority moves ----------------------------- */

function priorityMoves(
  profile: StyleProfile,
  shopping: ShoppingItem[],
): PriorityMove[] {
  const goal = profile.goals[0]?.toLowerCase() ?? "look more polished";
  const hero =
    [...shopping].sort(
      (a, b) =>
        (CATEGORY_PRIORITY[a.category] ?? 9) -
        (CATEGORY_PRIORITY[b.category] ?? 9),
    )[0]?.title ?? "one excellent jacket";
  return [
    {
      n: "01",
      title: "Fix fit before you buy anything else",
      why: `Tailoring the shoulders and hem of what you own does more for your goal to ${goal} than any new purchase.`,
    },
    {
      n: "02",
      title: "Anchor everything to your palette",
      why: "Build on warm neutrals and one accent near the face; match metals and leather to your undertone.",
    },
    {
      n: "03",
      title: `Invest in your hero piece — ${hero.toLowerCase()}`,
      why: "One high-impact layer raises the perceived quality of everything you already own.",
    },
  ];
}

/* -------------------------------- archetype ------------------------------- */

function archetypeFor(profile: StyleProfile): Archetype {
  const b = lc(profile.boldness);
  const warm = lc(profile.physical.undertone) === "warm";
  const signature = warm
    ? "a warm, earthy signature"
    : lc(profile.physical.undertone) === "cool"
      ? "a cool, crisp signature"
      : "a balanced, neutral signature";
  const map: Record<string, { name: string; tone: string }> = {
    conservative: { name: "Refined Classic", tone: "timeless, understated, quietly expensive" },
    moderate: { name: "Modern Classic", tone: "clean, current, never trend-chasing" },
    experimental: { name: "Contemporary Eclectic", tone: "considered with a creative edge" },
    statement: { name: "Bold Editorial", tone: "confident, directional, high-impact" },
  };
  const a = map[b] ?? map.moderate;
  return {
    name: a.name,
    line: `${a.tone} — with ${signature}.`,
  };
}

/* -------------------------------- colour DNA ------------------------------ */

function colorDNAFor(profile: StyleProfile, best: ColorRec[]): ColorDNA {
  const season = cap(profile.colorSeason);
  const contrast = lc(profile.physical.contrast);
  const undertone = lc(profile.physical.undertone);
  const prefix =
    contrast === "low"
      ? "Soft"
      : contrast === "high"
        ? "Deep"
        : undertone === "warm"
          ? "Warm"
          : undertone === "cool"
            ? "Cool"
            : "True";

  const neutrals = best
    .filter((c) => hexToHsl(c.hex).s < 0.32)
    .slice(0, 4);

  const bestWhite =
    undertone === "warm"
      ? "Cream / ecru — never optic white"
      : undertone === "cool"
        ? "Soft white"
        : "Off-white";
  const bestDenim =
    undertone === "warm"
      ? "Warm mid-indigo, slightly brown-cast"
      : undertone === "cool"
        ? "Clean blue-grey indigo"
        : "Classic mid-indigo";
  const metal =
    undertone === "warm"
      ? "Yellow gold / brass"
      : undertone === "cool"
        ? "Silver / steel"
        : "Soft gold or steel";
  const blackAlt =
    undertone === "warm"
      ? "Espresso brown or deep olive instead of black"
      : undertone === "cool"
        ? "Charcoal or navy instead of black"
        : "Charcoal instead of black";
  const contrastRule =
    contrast === "low"
      ? "Keep top-to-bottom contrast soft — tonal, layered looks flatter you. Avoid white-next-to-black."
      : contrast === "high"
        ? "You can carry sharp contrast — a crisp light-vs-dark split reads intentional and strong."
        : "Moderate contrast suits you — one clear light/dark step, not a stark jump.";

  return {
    subseason: `${prefix} ${season}`,
    neutrals: neutrals.length ? neutrals : best.slice(0, 3),
    bestWhite,
    bestDenim,
    metal,
    blackAlt,
    contrastRule,
  };
}

/* ------------------------------ capsule matrix ---------------------------- */

const STOP = new Set([
  "the","and","with","over","under","a","an","of","for","in","on","to","blend","leather","merino","minimal","cream","dial","unstructured","wool",
]);

/** Significant lowercase keywords from a product title. */
function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Shopping items that appear in a look's description ("shop the look"). */
export function itemsForLook(look: Look, shopping: ShoppingItem[]): ShoppingItem[] {
  const garments = decomposeLook(look.description);
  if (garments.length) {
    const seen = new Set<string>();
    const items: ShoppingItem[] = [];
    for (const g of garments) {
      if (items.length >= 6) break;
      const candidates = shopping.filter((it) => it.category === g.category);
      if (!candidates.length) continue;
      const ranked = [...candidates].sort(
        (a, b) =>
          colorMatchScore(g.color, b.color, b.title) -
          colorMatchScore(g.color, a.color, a.title),
      );
      const best = ranked[0];
      const id = best.productId ?? best.title;
      if (seen.has(id)) continue;
      seen.add(id);
      const score = colorMatchScore(g.color, best.color, best.title);
      items.push({
        ...best,
        similarPick: score < 0.45,
        why:
          score >= 0.45
            ? best.why
            : `A similar ${g.garment} from your capsule — close in category and tone.`,
      });
    }
    if (items.length) return items;
  }
  const desc = look.description.toLowerCase();
  return shopping
    .filter((it) => keywords(it.title).some((k) => desc.includes(k)))
    .slice(0, 4)
    .map((it) => ({ ...it, similarPick: true }));
}

/* ----------------------------- look decomposition ------------------------- */

/** One garment parsed out of a look description, mapped to a catalogue category. */
export type LookGarment = { category: string; garment: string; color: string | null };

/** Garment keyword → catalogue CATEGORY. Mirrors catalog.ts CATEGORIES. */
const GARMENT_CATEGORY: Record<string, string> = {
  blazer: "Outerwear", jacket: "Outerwear", coat: "Outerwear", overcoat: "Outerwear",
  overshirt: "Outerwear", trench: "Outerwear", parka: "Outerwear", bomber: "Outerwear",
  peacoat: "Outerwear", suit: "Outerwear",
  knit: "Knitwear", sweater: "Knitwear", crewneck: "Knitwear", jumper: "Knitwear",
  cardigan: "Knitwear", turtleneck: "Knitwear", rollneck: "Knitwear", pullover: "Knitwear",
  shirt: "Shirts", oxford: "Shirts", tee: "Shirts", polo: "Shirts", henley: "Shirts",
  trousers: "Trousers", chinos: "Trousers", chino: "Trousers", jeans: "Trousers",
  denim: "Trousers", slacks: "Trousers", pants: "Trousers",
  loafers: "Footwear", boots: "Footwear", boot: "Footwear", sneakers: "Footwear",
  derbies: "Footwear", derby: "Footwear", oxfords: "Footwear", brogues: "Footwear",
  chelsea: "Footwear", shoes: "Footwear", trainers: "Footwear", sandals: "Footwear",
  belt: "Accessories", watch: "Accessories", scarf: "Accessories", tie: "Accessories",
  sunglasses: "Accessories", hat: "Accessories", cap: "Accessories", gloves: "Accessories",
  bag: "Accessories", socks: "Accessories",
};

/** Colour words used to qualify a garment query (not garments themselves). */
const COLOR_WORDS = new Set([
  "navy", "cream", "charcoal", "grey", "gray", "black", "white", "brown", "tan",
  "camel", "olive", "beige", "khaki", "burgundy", "rust", "ecru", "stone", "taupe",
  "sand", "indigo", "blue", "green", "red", "pink", "purple", "yellow", "orange",
  "maroon", "mustard", "forest", "sage", "cognac", "chocolate", "ivory", "midnight",
  "dark", "light", "mid", "off", "dusty",
]);

const GARMENT_KEYS = Object.keys(GARMENT_CATEGORY).sort(
  (a, b) => b.length - a.length,
);

/** 0–1 overlap between a look garment colour and catalogue title/colour fields. */
export function colorMatchScore(
  queryColor: string | null,
  productColor: string | null,
  title: string,
): number {
  const tokens = (queryColor ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => COLOR_WORDS.has(w));
  if (!tokens.length) return 0.5;
  const hay = `${productColor ?? ""} ${title}`.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits++;
    else if (t === "grey" && hay.includes("gray")) hits++;
    else if (t === "gray" && hay.includes("grey")) hits++;
  }
  return hits / tokens.length;
}

/**
 * Deterministically split a free-text look description into individual garments,
 * each mapped to a catalogue category with any qualifying colour. Keyword-based
 * (no AI call) so it behaves identically in demo and live mode.
 */
export function decomposeLook(description: string): LookGarment[] {
  const clauses = description
    .toLowerCase()
    .split(/,|\s+over\s+|\s+and\s+|\s+with\s+/);
  const out: LookGarment[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    const normalized = clause
      .replace(/-/g, " ")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;
    const words = normalized.split(/\s+/).filter(Boolean);
    let garment: string | null = null;
    let category: string | null = null;
    for (const key of GARMENT_KEYS) {
      if (normalized.includes(key)) {
        garment = key;
        category = GARMENT_CATEGORY[key];
        break;
      }
    }
    if (!garment || !category) continue;
    const colors = words.filter((w) => COLOR_WORDS.has(w));
    const color = colors.length ? colors.join(" ") : null;
    const dedupeKey = `${category}:${color ?? ""}:${garment}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ category, garment, color });
  }
  return out;
}

export function capsuleMatrix(shopping: ShoppingItem[]): OutfitCombo[] {
  const pick = (cats: string[]) =>
    shopping.filter((i) => cats.includes(i.category)).map((i) => i.title);
  const layers = pick(["Outerwear"]);
  const tops = [...pick(["Knitwear", "Shirts"])];
  const bottoms = [...pick(["Trousers"]), "Dark indigo denim", "Taupe chinos"];
  const shoes = pick(["Footwear"]);
  const t = (layers[0] ? [layers[0], ...tops] : tops).slice(0, 3);
  const s = shoes.length ? shoes : ["Brown derbies"];

  const contexts = [
    "Boardroom",
    "Client lunch",
    "Smart casual",
    "Weekend",
    "Dinner",
    "Travel day",
  ];
  const combos: OutfitCombo[] = [];
  let ci = 0;
  for (let i = 0; i < t.length && combos.length < 6; i++) {
    for (let j = 0; j < bottoms.length && combos.length < 6; j++) {
      const top = t[i];
      const bottom = bottoms[(i + j) % bottoms.length];
      const shoe = s[(i + j) % s.length];
      combos.push({
        context: contexts[ci % contexts.length],
        pieces: [top, bottom, shoe],
      });
      ci++;
    }
  }
  return combos;
}

/* ------------------------------- price tiers ------------------------------ */

const TIER_CATEGORIES = ["Outerwear", "Trousers", "Knitwear", "Footwear"];

function priceTiersFrom(shopping: ShoppingItem[]): PriceTier[] {
  const round5 = (n: number) => Math.round(n / 5) * 5;
  const tiers: PriceTier[] = [];
  for (const cat of TIER_CATEGORIES) {
    const item = shopping.find((i) => i.category === cat);
    if (!item) continue;
    tiers.push({
      category: cat,
      good: round5(item.priceEur * 0.55),
      better: item.priceEur,
      best: round5(item.priceEur * 2.2),
      note:
        cat === "Footwear"
          ? "Spend up here — good leather outlasts three cheap pairs."
          : cat === "Outerwear"
            ? "Your highest-impact buy; invest if you stretch anywhere."
            : "Mid-tier is the sweet spot for fit and fabric.",
    });
  }
  return tiers;
}

/* --------------------------------- build ---------------------------------- */

export function buildExtras(report: StyleReport): StyleExtras {
  const { profile } = report;
  return {
    archetype: archetypeFor(profile),
    priorityMoves: priorityMoves(profile, report.shopping),
    colorDNA: colorDNAFor(profile, report.colors.best),
    metals: metalsFor(profile.physical.undertone),
    eyewear: eyewearFor(profile.physical.faceShape),
    fitBlueprint: fitBlueprint(profile),
    pairings: colorPairings(report.colors.best),
    fabrics: fabricsFor(profile),
    capsule: capsuleFrom(report.shopping),
    matrix: capsuleMatrix(report.shopping),
    priceTiers: priceTiersFrom(report.shopping),
    grooming: groomingFor(profile),
    styling: STYLING_MECHANICS,
    care: CARE_GUIDE,
    fragrance: fragranceFor(profile),
  };
}
