/**
 * Expert "stylist layer": rule-based recommendations derived deterministically
 * from the Style Profile, colour palette and shopping list. Kept pure (no AI
 * dependency) so it works identically in demo and live mode and never breaks
 * the model's structured-output contract.
 */
import type { ColorRec, Look, ShoppingItem, StyleReport } from "@/lib/report";
import {
  classifySubseason,
  SUBSEASON_LABELS,
  type StyleProfile,
} from "@/lib/style-profile";
import { humanizeProductTitle } from "@/lib/product-title";

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
  /** Colour-story section intro, tailored to the actual undertone + contrast. */
  colorStoryIntro: string;
};

export type OutfitCombo = {
  context: string;
  pieces: string[];
  /** Subset of `pieces` that are assumed wardrobe basics, not curated catalogue. */
  owned?: string[];
  image?: string;
};

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
  barberBlueprint: FitSpec[];
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

/** Top eyewear picks for premium personalized previews (2 optical + 2 sunglasses). */
export type PremiumEyewearPick = FrameRec & { kind: "optical" | "sun" };

function sunglassesFor(faceShape: string): FrameRec[] {
  const f = lc(faceShape);
  if (f.includes("round")) {
    return [
      {
        shape: "rectangle",
        name: "Rectangular sunglasses",
        why: "Sharp angles add definition and lengthen a round face in sun.",
      },
      {
        shape: "wayfarer",
        name: "Wayfarer sunglasses",
        why: "Structured top bar sharpens soft features without adding width.",
      },
    ];
  }
  if (f.includes("square")) {
    return [
      {
        shape: "round",
        name: "Round sunglasses",
        why: "Soft curves balance a strong, angular jaw in bright light.",
      },
      {
        shape: "aviator",
        name: "Aviator sunglasses",
        why: "Curved bottom edge softens square corners outdoors.",
      },
    ];
  }
  if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    return [
      {
        shape: "round",
        name: "Round sunglasses",
        why: "Adds width and breaks up a longer face in sun.",
      },
      {
        shape: "geometric",
        name: "Bold geometric sunglasses",
        why: "Deeper frames shorten the appearance of vertical length.",
      },
    ];
  }
  if (f.includes("heart") || f.includes("triang")) {
    return [
      {
        shape: "aviator",
        name: "Aviator sunglasses",
        why: "Bottom-heavy shape balances a wider forehead outdoors.",
      },
      {
        shape: "round",
        name: "Round sunglasses",
        why: "Adds softness to a narrower chin without widening the brow.",
      },
    ];
  }
  return [
    {
      shape: "wayfarer",
      name: "Wayfarer sunglasses",
      why: "Classic balance for an oval face — versatile in sun.",
    },
    {
      shape: "aviator",
      name: "Aviator sunglasses",
      why: "Relaxed edge while keeping proportions balanced outdoors.",
    },
  ];
}

export function premiumEyewearPicks(profile: StyleProfile): PremiumEyewearPick[] {
  const optical = eyewearFor(profile.physical.faceShape).recommend.slice(0, 2);
  const sun = sunglassesFor(profile.physical.faceShape);
  return [
    ...optical.map((f) => ({ ...f, kind: "optical" as const })),
    ...sun.map((f) => ({ ...f, kind: "sun" as const })),
  ];
}

/**
 * Four ADDITIONAL eyewear picks (2 optical + 2 sunglasses) for the one-time
 * paid extra generation — versatile alternates, distinct from the base picks.
 */
export function premiumEyewearExtraPicks(): PremiumEyewearPick[] {
  return [
    {
      shape: "geometric",
      name: "Browline frames",
      why: "A bold upper brow line adds character and structure to optical frames.",
      kind: "optical",
    },
    {
      shape: "round",
      name: "Keyhole round frames",
      why: "A softer round optical with a keyhole bridge for a refined, classic look.",
      kind: "optical",
    },
    {
      shape: "wayfarer",
      name: "Clubmaster sunglasses",
      why: "Half-rim browline sunglasses — a timeless, smart-casual alternative.",
      kind: "sun",
    },
    {
      shape: "aviator",
      name: "Navigator sunglasses",
      why: "A squared aviator shape for a confident, contemporary edge in the sun.",
      kind: "sun",
    },
  ];
}

/* ------------------------------- accessories ------------------------------ */

/** One accessory styling pick for the premium add-on. */
export type AccessoryPick = {
  name: string;
  why: string;
  kind: "scarf" | "neckwear" | "tie";
};

/**
 * Two accessory styling picks (scarf / neckwear / tie) for the premium add-on,
 * tuned to the user's climate and goals. Pure + deterministic, like the other
 * stylist-layer helpers.
 */
export function accessoryPicksFor(profile: StyleProfile): AccessoryPick[] {
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  const goals = profile.goals.map(lc).join(" ");
  const formal =
    /(work|office|business|promotion|professional|formal|interview|leadership|executive|client)/.test(
      goals,
    );
  const gender = lc(profile.demographics.genderPresentation);

  const picks: AccessoryPick[] = [];

  // 1) A scarf tuned to climate — the workhorse accessory.
  picks.push(
    cold
      ? {
          name: "Wool-blend scarf",
          why: "A soft neutral scarf in your palette adds warmth and a finished, considered layer over coats and knitwear.",
          kind: "scarf",
        }
      : {
          name: "Lightweight cotton-silk scarf",
          why: "A featherweight scarf adds an elegant accent at the neck without heat — easy to wear loosely looped.",
          kind: "scarf",
        },
  );

  // 2) A tie for formal goals, otherwise a softer neckwear option.
  if (formal) {
    picks.push({
      name: "Silk grenadine tie",
      why: "A textured, matte tie in your palette reads refined — the detail that elevates a jacket for work.",
      kind: "tie",
    });
  } else if (gender === "female") {
    picks.push({
      name: "Silk neck-scarf",
      why: "A small silk scarf knotted at the neck adds colour and polish to an open collar.",
      kind: "neckwear",
    });
  } else {
    picks.push({
      name: "Silk neckerchief",
      why: "A loosely knotted neckerchief brings quiet personality to an open-collar shirt.",
      kind: "neckwear",
    });
  }

  return picks;
}

/** Two ADDITIONAL accessory picks for the one-time paid "generate 2 more" add-on. */
export function accessoryExtraPicksFor(profile: StyleProfile): AccessoryPick[] {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      {
        name: "Printed silk neck-scarf",
        why: "A bolder print at the neck adds a confident focal point to a plain outfit.",
        kind: "neckwear",
      },
      {
        name: "Twilly scarf",
        why: "A slim silk twilly tied at the collar or bag handle is an easy, elegant accent.",
        kind: "scarf",
      },
    ];
  }
  return [
    {
      name: "Patterned silk scarf",
      why: "A subtle pattern adds depth at the neck while staying within your palette.",
      kind: "scarf",
    },
    {
      name: "Knitted tie",
      why: "A matte knitted tie with a square end reads relaxed-smart — ideal under a blazer.",
      kind: "tie",
    },
  ];
}

/* -------------------------------- headwear -------------------------------- */

/** One headwear styling pick (hat / cap / beanie / bandana). */
export type HeadwearPick = {
  name: string;
  why: string;
  kind: "hat" | "cap" | "beanie" | "bandana";
};

/**
 * Two headwear picks chosen for the user's face shape (brim balances the
 * proportions of the face) and climate (a warmer beanie vs. a lighter cap).
 * Pure + deterministic, like the other stylist-layer helpers.
 */
export function headwearPicksFor(profile: StyleProfile): HeadwearPick[] {
  const f = lc(profile.physical.faceShape);
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);

  const picks: HeadwearPick[] = [];

  // 1) A brimmed hat tuned to face shape — the brim shapes the proportions.
  if (f.includes("round")) {
    picks.push({
      name: "Structured fedora",
      why: "A defined brim and a higher crown add angles and vertical length that flatter a round face.",
      kind: "hat",
    });
  } else if (f.includes("square")) {
    picks.push({
      name: "Soft-brim felt hat",
      why: "A rounded, softer brim takes the edge off a strong, angular jaw.",
      kind: "hat",
    });
  } else if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    picks.push({
      name: "Wide-brim hat",
      why: "A wider brim adds horizontal balance and visually shortens a longer face.",
      kind: "hat",
    });
  } else if (f.includes("heart") || f.includes("triang")) {
    picks.push({
      name: "Medium-brim trilby",
      why: "A medium brim balances a wider forehead without overwhelming a narrower chin.",
      kind: "hat",
    });
  } else {
    picks.push({
      name: "Classic brimmed hat",
      why: "A balanced brim suits an oval face — versatile and easy to wear in your palette.",
      kind: "hat",
    });
  }

  // 2) A casual cap or beanie tuned to climate.
  picks.push(
    cold
      ? {
          name: "Ribbed wool beanie",
          why: "A fitted beanie in a neutral from your palette adds warmth and a clean, modern casual finish.",
          kind: "beanie",
        }
      : {
          name: "Baseball cap",
          why: "A structured cap in a palette neutral is the easy, versatile casual option for warmer days.",
          kind: "cap",
        },
  );

  return picks;
}

/** Two ADDITIONAL headwear picks for the one-time paid "generate 2 more" add-on. */
export function headwearExtraPicksFor(profile: StyleProfile): HeadwearPick[] {
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  return [
    cold
      ? {
          name: "Wool flat cap",
          why: "A wool flat cap reads smart-casual and pairs cleanly with overcoats and knitwear.",
          kind: "cap",
        }
      : {
          name: "Bucket hat",
          why: "A relaxed bucket hat in a palette neutral is an easy warm-weather cover-up.",
          kind: "hat",
        },
    {
      name: "Bandana",
      why: "A folded bandana in your palette adds a confident accent — worn as a headband or knotted at the neck.",
      kind: "bandana",
    },
  ];
}

/** Named facial-hair styles for premium photo previews (up to 4). */
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
      {
        name: "Defined brow arch",
        why: "A subtle arch lifts the eye area and adds structure without heaviness.",
      },
      {
        name: "Polished neckline",
        why: "Clean jaw and neck line keep the silhouette sharp under open collars.",
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
      {
        name: "Goatee, clean cheeks",
        why: "Vertical length at the chin elongates a round face without widening the sides.",
      },
      {
        name: "Tapered full beard",
        why: "Length at the chin with trimmed cheeks adds definition while staying balanced.",
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
      {
        name: "Medium stubble",
        why: "Even coverage softens sharp corners without hiding bone structure.",
      },
      {
        name: "Short rounded beard",
        why: "A rounded neckline and cheek line takes the edge off a square jaw.",
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
      {
        name: "Wide sideburns + stubble",
        why: "Horizontal emphasis at the temples adds width to a longer face.",
      },
      {
        name: "Chevron mustache",
        why: "A bold upper-lip line draws attention horizontally across the face.",
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
      {
        name: "Anchor beard",
        why: "Focused length along the chin adds weight where the face is narrowest.",
      },
      {
        name: "Light goatee",
        why: "Minimal chin definition without adding bulk to the upper face.",
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
    {
      name: "Classic full beard",
      why: "Even growth with a defined neckline — versatile on an oval face.",
    },
    {
      name: "Van Dyke",
      why: "A neat mustache paired with a small chin patch adds character without bulk.",
    },
  ];
}

/** Two ADDITIONAL facial-hair picks for the one-time paid "generate 2 more" add-on. */
export function facialHairExtraFor(
  profile: StyleProfile,
): { name: string; why: string }[] {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      {
        name: "Soft natural finish",
        why: "A fresh, even complexion with minimal product — the polished baseline.",
      },
      {
        name: "Defined jawline contour",
        why: "Subtle contour along the jaw sharpens the profile under open collars.",
      },
    ];
  }
  return [
    {
      name: "Heavy stubble",
      why: "A fuller 5–7 mm stubble adds depth and a rugged, modern edge.",
    },
    {
      name: "Long statement beard",
      why: "A longer, well-shaped beard makes a confident, characterful statement.",
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

/* ------------------------------ barber blueprint -------------------------- */

/**
 * A concise, hand-to-your-barber cut brief keyed to the client's face shape and
 * hair colour — the grooming counterpart to the fit blueprint. Rule-based and
 * deterministic so it reads consistently and translates cleanly.
 */
function barberBlueprint(profile: StyleProfile): FitSpec[] {
  const f = lc(profile.physical.faceShape);
  const specs: FitSpec[] = [];

  const round = f.includes("round");
  const square = f.includes("square");
  const long = f.includes("oblong") || f.includes("rectang") || f.includes("long");
  const heart = f.includes("heart") || f.includes("triang");
  const diamond = f.includes("diamond");

  const shapeLabel = round
    ? "round"
    : square
      ? "square"
      : long
        ? "longer"
        : heart
          ? "heart-shaped"
          : diamond
            ? "diamond"
            : "oval";
  specs.push({
    part: "Face shape",
    spec: `Your face reads as ${shapeLabel} — the cut below is tuned to it.`,
    why: "A haircut's job is to balance your proportions, not fight them.",
  });

  // Length on top — the main lever for balancing face length/width.
  specs.push({
    part: "Length on top",
    spec: round
      ? "Keep good height on top; ask for length to style up and back."
      : long
        ? "Keep the top moderate — avoid piling on height."
        : heart
          ? "Medium length on top with soft movement, nothing too tall."
          : square
            ? "Short-to-medium with texture; a little height works well."
            : "Medium length with natural movement — most shapes suit you.",
    why: round
      ? "Vertical volume lengthens a round face and adds structure."
      : long
        ? "Too much height stretches an already-long face."
        : heart
          ? "Soft volume avoids widening the upper face further."
          : square
            ? "Texture keeps a strong jaw from looking heavy."
            : "Balanced length flatters oval proportions without tricks.",
  });

  // Sides / fade.
  specs.push({
    part: "Sides & fade",
    spec: round
      ? "Tight/short sides — a high taper or fade to slim the face."
      : long
        ? "Leave a little more length on the sides; low-to-mid taper."
        : heart
          ? "Keep some weight at the sides; avoid very tight fades."
          : "Clean mid taper — versatile and easy to maintain.",
    why: round
      ? "Short sides narrow the face and sharpen the jaw."
      : long
        ? "Side volume adds width and shortens a long face."
        : heart
          ? "Width lower down balances a wider forehead."
          : "A mid taper suits most shapes and grows out cleanly.",
  });

  // Fringe / parting / hairline.
  specs.push({
    part: "Fringe & parting",
    spec: long || heart
      ? "Consider a soft fringe or forward-textured front."
      : "A defined side part or natural push-back both work.",
    why: long || heart
      ? "A fringe shortens the forehead and softens the top third."
      : "A clean part adds polish and structure to your look.",
  });

  // Beard / neckline — pairs with the grooming section.
  specs.push({
    part: "Beard & neckline",
    spec: round
      ? "A slightly longer, squared beard elongates the face; keep cheek lines crisp."
      : square
        ? "Keep the beard neat and rounded at the base to soften the jaw."
        : long
          ? "Fuller on the cheeks, shorter at the chin to add width."
          : heart
            ? "A little more beard at the jaw balances a narrower chin."
            : "A tidy, even beard or clean shave both suit your balance.",
    why: "Facial hair reshapes the lower face — use it to balance the top.",
  });

  // Colour care note when the client reports grey/silver hair.
  const hair = lc(profile.physical.hairColor ?? "");
  if (hair.includes("grey") || hair.includes("gray") || hair.includes("silver") || hair.includes("salt")) {
    specs.push({
      part: "Colour & upkeep",
      spec: "Embrace the grey — ask for a clean, sharp shape and use a silver/purple shampoo weekly.",
      why: "Well-cut grey reads distinguished; a toning shampoo keeps it bright, not yellow.",
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

function capsuleFrom(shopping: ShoppingItem[], profile: StyleProfile): CapsulePlan {
  const count = (cats: string[]) =>
    shopping.filter((i) => cats.includes(i.category)).length;

  // Build the outfit count from the *real* curated catalogue. Empty slots are
  // filled with the same assumed wardrobe basics the matrix uses (2 bottoms,
  // 1 shoe) — never silently padded with extra catalogue items.
  const basics = assumedBasics(profile);
  const realTops = count(["Knitwear", "Shirts"]);
  const topsN = realTops + (count(["Outerwear"]) > 0 ? 1 : 0); // + a layer option
  const realBottoms = count(["Trousers"]);
  const bottomsN = realBottoms > 0 ? realBottoms : basics.bottoms.length;
  const realShoes = count(["Footwear"]);
  const shoesN = realShoes > 0 ? realShoes : basics.shoes.length;
  const outfits = topsN > 0 ? Math.min(40, topsN * bottomsN * shoesN) : 0;

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

/* --------------------------- style-fit heuristics ------------------------- */

/** Lexical cues that a product is trend-forward / statement rather than a staple. */
const TREND_TOKENS = [
  "smock",
  "oversized",
  "boxy",
  "cropped",
  "crop top",
  "baggy",
  "parachute",
  "cargo",
  "printed",
  "print",
  "graphic",
  "logo",
  "slogan",
  "mesh",
  "sheer",
  "distressed",
  "acid wash",
  "tie-dye",
  "tie dye",
  "camo",
  "sequin",
  "metallic",
  "fringe",
  "flared",
  "bootcut",
  "parkour",
  "asymmetric",
  "patchwork",
  "shacket",
  "balloon",
  "wide-leg extreme",
  "runway",
];
/** Lexical cues of a timeless, tailored staple. */
const STAPLE_TOKENS = [
  "blazer",
  "sport coat",
  "sportcoat",
  "suit",
  "tailored",
  "trench",
  "overcoat",
  "topcoat",
  "peacoat",
  "chino",
  "oxford",
  "poplin",
  "merino",
  "cashmere",
  "lambswool",
  "crew neck",
  "crewneck",
  "roll neck",
  "polo shirt",
  "chelsea boot",
  "derby",
  "loafer",
  "cardigan",
  "overshirt",
  "gabardine",
  "flannel",
];

/**
 * Additive ranking nudge (~[-0.2, +0.06]) that aligns catalogue picks with the
 * user's boldness: conservative/moderate wardrobes down-weight trend-forward
 * pieces and favour timeless staples, while statement/experimental wardrobes get
 * a mild boost for directional pieces. Keeps a "Refined Classic" professional
 * from being handed an oversized smock as their hero piece.
 */
/** Build a case-insensitive, word-boundary matcher from a token list. */
function tokenMatcher(tokens: string[]): RegExp {
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

/** Casual, warm-weather footwear that reads wrong for a polished/professional wardrobe. */
export const CASUAL_FOOTWEAR_RE =
  /\b(sandal|sndls?|slides?|flip[-\s]?flop|espadrille|clog|havaianas|thong|pool slider)\b/i;
/** Casual outerwear that reads wrong in a boardroom / client-meeting context. */
const CASUAL_OUTERWEAR_RE =
  /\b(field jacket|hood(?:ed|ie)?|bomber|parka|anorak|gilet|puffer|windbreaker|shacket|denim jacket|track(?:suit| jacket)?|cagoule|fleece)\b/i;
/**
 * Soft / athleisure outerwear that must not fill a tailored blazer slot.
 * "Sport coat" stays allowed (classic synonym); "sport blazer" is usually a
 * stretch jersey zip piece and is excluded.
 */
export const NON_BLAZER_OUTER_RE =
  /\b(knit|jersey|fleece|hoodie|zip(?:[- ]?up)?|zipper|track|bomber|softshell|quilt(?:ed)?|puffer|cardigan|sweat(?:shirt|er)?|(?:4[- ]?way\s+)?stretch|performance|sport\s+blazer|travel)\b/i;
/**
 * Loud, gimmicky cues that read cheap or juvenile *regardless* of how bold the
 * wardrobe is — slogan/graphic tees, ripped denim, tie-dye, sequins. Even a
 * "statement" client is better served by well-cut directional pieces than by
 * novelty prints, so these are demoted for everyone (just less for bold ones).
 */
const GIMMICK_TOKENS = [
  "slogan",
  "graphic",
  "logo",
  "printed",
  "print",
  "ripped",
  "distressed",
  "acid wash",
  "tie-dye",
  "tie dye",
  "sequin",
];
/** Athleisure / loungewear cues that undercut a "polished" or "elevated" brief. */
const ATHLEISURE_RE =
  /\b(joggers?|sweat\s?pants?|track\s?pants?|tracksuit|balloon\s?fit|jogger\s?shorts?|drawstring\s?shorts?)\b/i;

// Compiled once — word-boundary matching avoids false hits like "blueprint"
// (print) or "camomile" (camo) that the old substring `.includes` produced.
const TREND_RE = tokenMatcher(TREND_TOKENS);
const STAPLE_RE = tokenMatcher(STAPLE_TOKENS);
const GIMMICK_RE = tokenMatcher(GIMMICK_TOKENS);

/**
 * All tunable ranking weights in one place so the scoring is easy to reason
 * about and adjust. Positive = better fit for the archetype. `bold` covers the
 * statement/experimental wardrobes; `conservative` and `other` (moderate) cover
 * the polished end. `heroPriceWeight`/`heroFitWeight` scale the hero selection.
 */
export const SCORING = {
  trend: { bold: +0.06, conservative: -0.2, other: -0.12 },
  gimmick: { bold: -0.1, conservative: -0.22, other: -0.14 },
  athleisure: { bold: -0.08, conservative: -0.2, other: -0.12 },
  casualShoe: { conservative: -0.18, other: -0.1 },
  casualOuter: { conservative: -0.18, other: -0.1 },
  staple: { bold: +0.02, other: +0.05 },
  hero: { fitWeight: 10, priceWeight: 1.2 },
} as const;

/** Whether a boldness value is a trend-tolerant (statement/experimental) wardrobe. */
export function isBoldWardrobe(boldness: string): boolean {
  const b = (boldness || "moderate").toLowerCase();
  return b === "statement" || b === "experimental";
}

export function styleFitScore(title: string, boldness: string): number {
  const t = title || "";
  const trend = TREND_RE.test(t);
  const staple = STAPLE_RE.test(t);
  const gimmick = GIMMICK_RE.test(t);
  const casualShoe = CASUAL_FOOTWEAR_RE.test(t);
  // Casual outerwear (field/denim/bomber/puffer/parka/anorak/fleece…) reads wrong
  // as the headline "invest in your hero piece" for a polished, professional
  // wardrobe — a tailored blazer or coat should always outrank it.
  const casualOuter = CASUAL_OUTERWEAR_RE.test(t);
  const athleisure = ATHLEISURE_RE.test(t);
  const b = (boldness || "moderate").toLowerCase();

  // Statement / experimental wardrobes welcome directional design, but even a
  // bold wardrobe should not be *led* by slogan tees, ripped denim or joggers —
  // those read cheap/juvenile rather than "elevated statement". Reward genuine
  // directional pieces; still demote the gimmicky/athleisure ones.
  if (isBoldWardrobe(b)) {
    let s = 0;
    if (trend && !gimmick) s += SCORING.trend.bold;
    if (gimmick) s += SCORING.gimmick.bold;
    if (athleisure) s += SCORING.athleisure.bold;
    if (staple) s += SCORING.staple.bold;
    return s;
  }

  const tier = b === "conservative" ? "conservative" : "other";
  let s = 0;
  if (trend) s += SCORING.trend[tier];
  if (gimmick) s += SCORING.gimmick[tier];
  if (athleisure) s += SCORING.athleisure[tier];
  if (casualShoe) s += SCORING.casualShoe[tier];
  if (casualOuter) s += SCORING.casualOuter[tier];
  if (staple) s += SCORING.staple.other;
  return s;
}

/** Short intent clause appended to catalogue queries so vector search leans on the archetype. */
export function styleIntentPhrase(boldness: string): string {
  switch ((boldness || "moderate").toLowerCase()) {
    case "conservative":
      return "timeless tailored classic staples, understated, quietly expensive, not trend-driven";
    case "experimental":
      return "considered contemporary pieces with a creative edge, well-tailored, no novelty prints";
    case "statement":
      return "elevated directional pieces, refined statement, architectural cuts and rich fabrics — no slogans, graphics or distressed finishes";
    default:
      return "clean modern versatile essentials, not trend-driven";
  }
}

/* ----------------------------- priority moves ----------------------------- */

function priorityMoves(
  profile: StyleProfile,
  shopping: ShoppingItem[],
): PriorityMove[] {
  const goal = profile.goals[0]?.toLowerCase() ?? "look more polished";
  const heroItem = pickHero(shopping, profile.boldness);
  const hero = heroItem?.title ?? "one excellent jacket";
  // Undertone-aware so a cool Soft Summer isn't told to build on "warm neutrals"
  // with gold metals. Names the primary metal from the same source as the
  // Colour DNA section (metalsFor) to keep the report internally consistent.
  const undertone = lc(profile.physical.undertone);
  const neutralsWord =
    undertone === "warm" ? "warm" : undertone === "cool" ? "cool" : "muted";
  const metal = metalsFor(profile.physical.undertone).recommend[0]?.name.toLowerCase();
  const metalPhrase = metal ? `metals (${metal})` : "metals";
  return [
    {
      n: "01",
      title: "Fix fit before you buy anything else",
      why: `Tailoring the shoulders and hem of what you own does more for your goal to ${goal} than any new purchase.`,
    },
    {
      n: "02",
      title: "Anchor everything to your palette",
      why: `Build on ${neutralsWord} neutrals and one accent near the face; match ${metalPhrase} and leather to your undertone.`,
    },
    {
      n: "03",
      title: `Invest in your hero piece — ${humanizeProductTitle(hero)}`,
      // Prefer the investment-framed LLM reason written specifically for the
      // hero (ai/shopping-reasons); the category template remains the fallback.
      // The fit-framed per-item `why` is NOT reused here — wrong frame for an
      // "invest" headline, and it already appears on the shopping card.
      why: heroItem?.heroWhy ?? heroWhy(heroItem?.category),
    },
  ];
}

/**
 * Choose the single "invest in this" hero piece. Weights archetype fit ahead of
 * category priority (so a trend-forward layer never becomes the headline), then
 * nudges towards the pricier, more investment-grade end of the qualifying pool
 * so the "invest" copy isn't attached to a €25 fast-fashion tee.
 */
export function pickHero(
  shopping: ShoppingItem[],
  boldness: string,
): ShoppingItem | undefined {
  if (!shopping.length) return undefined;
  const prices = shopping.map((i) => i.priceEur ?? 0);
  const maxPrice = Math.max(1, ...prices);
  const weight = (i: ShoppingItem) =>
    -styleFitScore(i.title, boldness) * SCORING.hero.fitWeight +
    (CATEGORY_PRIORITY[i.category] ?? 9) -
    ((i.priceEur ?? 0) / maxPrice) * SCORING.hero.priceWeight;
  return [...shopping].sort((a, b) => weight(a) - weight(b))[0];
}

/** Category-aware rationale for the hero piece (not every hero is a "layer"). */
function heroWhy(category?: string): string {
  switch (category) {
    case "Footwear":
      return "One excellent pair of shoes anchors every outfit and outlasts three cheap pairs.";
    case "Trousers":
      return "A precisely-cut pair of trousers is the quiet foundation every look is built on.";
    case "Knitwear":
    case "Shirts":
      return "One beautifully-made piece worn near the face lifts the perceived quality of everything else.";
    case "Accessories":
      return "The right finishing piece is what makes an outfit look considered rather than thrown together.";
    default:
      return "One high-impact layer raises the perceived quality of everything you already own.";
  }
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
  const contrast = lc(profile.physical.contrast) as "low" | "medium" | "high";
  const undertone = lc(profile.physical.undertone) as
    | "warm"
    | "cool"
    | "neutral";

  // Real 12-subseason classification (stored on the profile when available),
  // falling back to a fresh classification from the profile's signals.
  const subId =
    profile.colorSubseason ??
    classifySubseason({
      season: profile.colorSeason,
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
    });
  const subseason = SUBSEASON_LABELS[subId];

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

  const undertoneWord =
    undertone === "warm" ? "warm" : undertone === "cool" ? "cool" : "balanced";
  const wheelLine =
    "Here's where your palette sits on the wheel — and exactly why each tone works.";
  const colorStoryIntro =
    (contrast === "low"
      ? `Soft, ${undertoneWord} neutrals flatter your low-contrast colouring.`
      : contrast === "high"
        ? `Crisp, ${undertoneWord} tones let you carry your high-contrast colouring with intent.`
        : `${cap(undertoneWord)} neutrals with one clear light-to-dark step suit your medium-contrast colouring.`) +
    ` ${wheelLine}`;

  return {
    subseason,
    neutrals: neutrals.length ? neutrals : best.slice(0, 3),
    bestWhite,
    bestDenim,
    metal,
    blackAlt,
    contrastRule,
    colorStoryIntro,
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
  const garments = decomposeLook(`${look.title}, ${look.description}`);
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
export type LookGarment = {
  category: string;
  garment: string;
  color: string | null;
  /** Source phrase from the look description (for richer catalogue queries). */
  clause: string;
};

/** Garment keyword → catalogue CATEGORY. Mirrors catalog.ts CATEGORIES. */
const GARMENT_CATEGORY: Record<string, string> = {
  blazer: "Outerwear", jacket: "Outerwear", coat: "Outerwear", overcoat: "Outerwear",
  overshirt: "Outerwear", trench: "Outerwear", parka: "Outerwear", bomber: "Outerwear",
  peacoat: "Outerwear", suit: "Outerwear",
  sweater: "Knitwear", hoodie: "Knitwear", vest: "Knitwear", shacket: "Outerwear",
  knit: "Knitwear", crewneck: "Knitwear", jumper: "Knitwear",
  cardigan: "Knitwear", turtleneck: "Knitwear", rollneck: "Knitwear", pullover: "Knitwear",
  shirt: "Shirts", oxford: "Shirts", tee: "Shirts", polo: "Shirts", henley: "Shirts",
  trousers: "Trousers", chinos: "Trousers", chino: "Trousers", jeans: "Trousers",
  denim: "Trousers", slacks: "Trousers", pants: "Trousers",
  loafers: "Footwear", loafer: "Footwear", boots: "Footwear", boot: "Footwear", sneakers: "Footwear",
  sneaker: "Footwear", derbies: "Footwear", derby: "Footwear", oxfords: "Footwear", brogues: "Footwear",
  chelsea: "Footwear", shoes: "Footwear", trainers: "Footwear", sandals: "Footwear",
  belt: "Accessories", watch: "Accessories", scarf: "Accessories", tie: "Accessories",
  sunglasses: "Accessories", hat: "Accessories", cap: "Accessories", gloves: "Accessories",
  bag: "Accessories", socks: "Accessories",
};

type Shade = "light" | "mid" | "dark";

/**
 * Colour-word taxonomy: maps each recognised colour token to a hue `family` and,
 * where the word itself implies lightness, a `shade`. Named greys are the key
 * case — "dove/ash/silver" read light, bare "grey/heather" read mid, and
 * "charcoal/slate/asphalt" read dark, so a mid-grey look no longer ranks
 * light-grey and charcoal products as equal matches.
 */
const COLOR_FAMILY: Record<string, { family: string; shade?: Shade }> = {
  // grey — bare grey/heather imply mid so light and charcoal stop scoring 0.8
  grey: { family: "grey", shade: "mid" },
  gray: { family: "grey", shade: "mid" },
  smoke: { family: "grey", shade: "mid" },
  pewter: { family: "grey", shade: "mid" },
  heather: { family: "grey", shade: "mid" },
  dove: { family: "grey", shade: "light" }, ash: { family: "grey", shade: "light" },
  silver: { family: "grey", shade: "light" }, pearl: { family: "grey", shade: "light" },
  charcoal: { family: "grey", shade: "dark" }, slate: { family: "grey", shade: "dark" },
  graphite: { family: "grey", shade: "dark" }, anthracite: { family: "grey", shade: "dark" },
  asphalt: { family: "grey", shade: "dark" }, gunmetal: { family: "grey", shade: "dark" },
  // blue
  blue: { family: "blue" }, sky: { family: "blue", shade: "light" },
  navy: { family: "blue", shade: "dark" }, indigo: { family: "blue", shade: "dark" },
  midnight: { family: "blue", shade: "dark" }, teal: { family: "blue" },
  // compound blues (normalised from "slate blue" etc. before tokenising) — these
  // read as their own muted/light blue, NOT as the dark-grey "slate".
  slateblue: { family: "blue" }, powderblue: { family: "blue", shade: "light" },
  iceblue: { family: "blue", shade: "light" }, steelblue: { family: "blue" },
  // black / white
  black: { family: "black", shade: "dark" },
  white: { family: "white", shade: "light" }, cream: { family: "white", shade: "light" },
  ivory: { family: "white", shade: "light" }, ecru: { family: "white", shade: "light" },
  bone: { family: "white", shade: "light" },
  // brown / neutral warm
  brown: { family: "brown" }, khaki: { family: "brown" }, taupe: { family: "brown" },
  cognac: { family: "brown" }, mocha: { family: "brown" },
  tan: { family: "brown", shade: "light" }, camel: { family: "brown", shade: "light" },
  beige: { family: "brown", shade: "light" }, sand: { family: "brown", shade: "light" },
  stone: { family: "brown", shade: "light" }, oat: { family: "brown", shade: "light" },
  oatmeal: { family: "brown", shade: "light" },
  chocolate: { family: "brown", shade: "dark" }, chestnut: { family: "brown", shade: "dark" },
  espresso: { family: "brown", shade: "dark" },
  // green
  green: { family: "green" }, sage: { family: "green", shade: "light" },
  olive: { family: "green", shade: "dark" }, forest: { family: "green", shade: "dark" },
  emerald: { family: "green", shade: "dark" },
  // red / warm
  red: { family: "red" },   rust: { family: "red" }, terracotta: { family: "red" }, copper: { family: "red" },
  burgundy: { family: "red", shade: "dark" }, maroon: { family: "red", shade: "dark" },
  // other hues
  pink: { family: "pink" }, purple: { family: "purple" }, orange: { family: "orange" },
  amber: { family: "orange" }, ochre: { family: "yellow" },
  yellow: { family: "yellow" }, mustard: { family: "yellow" },
};

/** Synonyms used to verify a catalogue title matches the parsed garment. */
const GARMENT_TITLE_SYNONYMS: Record<string, string[]> = {
  // No bare "jacket" — knit/zip/sport jackets were scoring as full blazer hits.
  blazer: ["blazer", "sport coat"],
  jacket: ["jacket", "blazer"],
  coat: ["coat", "overcoat"],
  overshirt: ["overshirt", "shacket", "shirt jacket"],
  knit: ["knit", "knitwear", "sweater", "jumper", "pullover"],
  sweater: ["sweater", "jumper", "knit", "pullover", "crewneck"],
  crewneck: ["crewneck", "crew neck", "sweater", "knit", "jumper"],
  cardigan: ["cardigan"],
  shirt: ["shirt", "oxford", "button-down", "button down"],
  tee: ["tee", "t-shirt", "tshirt"],
  polo: ["polo"],
  henley: ["henley"],
  trousers: ["trouser", "trousers", "pant", "pants", "slack"],
  chinos: ["chino", "chinos", "trouser", "trousers"],
  chino: ["chino", "chinos", "trouser", "trousers"],
  jeans: ["jean", "jeans", "denim"],
  loafers: ["loafer", "loafers"],
  loafer: ["loafer", "loafers"],
  sneakers: ["sneaker", "sneakers", "trainer", "trainers"],
  sneaker: ["sneaker", "sneakers", "trainer", "trainers"],
  boots: ["boot", "boots"],
  boot: ["boot", "boots"],
  chelsea: ["chelsea", "boot", "boots"],
  derbies: ["derby", "derbies"],
  derby: ["derby", "derbies"],
  oxfords: ["oxford", "oxfords"],
  brogues: ["brogue", "brogues"],
  belt: ["belt"],
  watch: ["watch"],
  scarf: ["scarf"],
  tie: ["tie"],
  sunglasses: ["sunglasses", "sunglass"],
};

/** Standalone lightness modifiers; override any shade implied by the hue word. */
const SHADE_WORDS: Record<string, Shade> = {
  light: "light", pale: "light", soft: "light", dusty: "light", off: "light",
  mid: "mid", medium: "mid", midtone: "mid",
  dark: "dark", deep: "dark",
};

/** Colour words used to qualify a garment query (not garments themselves). */
const COLOR_WORDS = new Set<string>([
  ...Object.keys(COLOR_FAMILY),
  ...Object.keys(SHADE_WORDS),
]);

const GARMENT_KEYS = Object.keys(GARMENT_CATEGORY).sort(
  (a, b) => b.length - a.length,
);

/** Collapse known two-word colours into a single token before parsing. */
function normalizeCompoundColors(text: string): string {
  return text
    .replace(/-/g, " ")
    .replace(/slate\s+blue/g, "slateblue")
    .replace(/powder\s+blue/g, "powderblue")
    .replace(/ice\s+blue/g, "iceblue")
    .replace(/steel\s+blue/g, "steelblue");
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0], 16),
      parseInt(h[1]! + h[1], 16),
      parseInt(h[2]! + h[2], 16),
    ];
  }
  if (h.length === 6 && /^[0-9a-f]+$/i.test(h)) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

/** Map a look's hex palette to the nearest named colours from the report. */
export function paletteColorHints(
  palette: string[],
  bestColors: { name: string; hex: string }[],
): string {
  if (!palette.length || !bestColors.length) return "";
  const names: string[] = [];
  for (const hex of palette) {
    const rgb = parseHexRgb(hex);
    if (!rgb) continue;
    let bestName: string | null = null;
    let bestDist = Infinity;
    for (const c of bestColors) {
      const crgb = parseHexRgb(c.hex);
      if (!crgb) continue;
      const dist =
        (rgb[0] - crgb[0]) ** 2 +
        (rgb[1] - crgb[1]) ** 2 +
        (rgb[2] - crgb[2]) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestName = c.name;
      }
    }
    if (bestName) names.push(bestName);
  }
  return [...new Set(names)].join(", ");
}

/** Map free-text garment labels ("structured blazer") onto synonym keys. */
function normalizeGarmentKey(garment: string): string {
  const g = garment
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!g) return g;
  if (GARMENT_TITLE_SYNONYMS[g]) return g;
  for (const key of GARMENT_KEYS) {
    if (g === key || g.endsWith(` ${key}`) || g.includes(` ${key} `)) return key;
    if (g.startsWith(`${key} `)) return key;
  }
  return g;
}

/** True when the target garment is a tailored blazer / sport coat. */
export function isBlazerGarment(garment: string): boolean {
  const key = normalizeGarmentKey(garment);
  return key === "blazer" || /\b(blazer|sport\s*coat)\b/.test(garment.toLowerCase());
}

/** True when a catalogue title reads as a tailored blazer (not knit/zip/sport). */
export function isTailoredBlazerTitle(title: string): boolean {
  const hay = title.toLowerCase();
  if (NON_BLAZER_OUTER_RE.test(hay)) return false;
  return /\b(blazer|sport\s*coat)\b/.test(hay);
}

/** 0–1 whether a catalogue product title mentions the parsed garment type. */
export function garmentTitleMatchScore(garment: string, title: string): number {
  const hay = title.toLowerCase();
  const key = normalizeGarmentKey(garment);
  if (key === "blazer" || isBlazerGarment(garment)) {
    if (NON_BLAZER_OUTER_RE.test(hay)) return 0;
    if (/\b(blazer|sport\s*coat)\b/.test(hay)) return 1;
    // Bare "jacket" only counts with clear tailored cues — not knit/zip shells.
    if (
      /\bjacket\b/.test(hay) &&
      /\b(tailored|suiting|structured|single[- ]breasted|notch|peak\s*lapel)\b/.test(
        hay,
      )
    ) {
      return 0.7;
    }
    return 0;
  }
  const terms = GARMENT_TITLE_SYNONYMS[key] ?? [key];
  return terms.some((t) => hay.includes(t)) ? 1 : 0;
}

/** Same-hue shade affinity: exact 1, adjacent mid↔light/dark 0.35, opposite 0.3. */
function shadeAffinity(a: Shade, b: Shade): number {
  if (a === b) return 1;
  const order: Record<Shade, number> = { light: 0, mid: 1, dark: 2 };
  return Math.abs(order[a] - order[b]) === 1 ? 0.35 : 0.3;
}

/** Parse free-text colour into the set of hue families + an implied lightness. */
function parseColorTokens(text: string): { families: Set<string>; shade?: Shade } {
  const families = new Set<string>();
  let hueShade: Shade | undefined; // lightness implied by a hue word (e.g. navy → dark)
  let modShade: Shade | undefined; // explicit modifier (e.g. soft/light/deep)
  for (const w of normalizeCompoundColors(text.toLowerCase())
    .split(/\s+/)
    .filter(Boolean)) {
    const fam = COLOR_FAMILY[w];
    if (fam) {
      families.add(fam.family);
      if (fam.shade) hueShade = fam.shade;
    }
    const mod = SHADE_WORDS[w];
    if (mod) modShade = mod;
  }
  // An explicit lightness word always wins, regardless of token order, so
  // "soft slate blue" reads light even though "slate" alone implies dark.
  return { families, shade: modShade ?? hueShade };
}

/**
 * 0–1 colour fit between a look garment colour and a catalogue product. Matches
 * on hue family first, then on lightness: same hue + same lightness scores high,
 * adjacent mid↔light/dark scores soft, opposite lightness (dove vs asphalt)
 * scores low so the picker prefers a true shade match and flags the rest.
 */
export function colorMatchScore(
  queryColor: string | null,
  productColor: string | null,
  title: string,
): number {
  const q = parseColorTokens(queryColor ?? "");
  if (!q.families.size && !q.shade) return 0.5; // no colour cue → neutral
  const p = parseColorTokens(`${productColor ?? ""} ${title}`);
  if (!p.families.size) return 0.5; // product colour unknown → neutral

  let hueMatch = false;
  for (const f of q.families) {
    if (p.families.has(f)) {
      hueMatch = true;
      break;
    }
  }
  if (!hueMatch) return 0.1; // wrong hue family

  // Same hue family — discriminate by lightness when both sides express it.
  if (q.shade && p.shade) return shadeAffinity(q.shade, p.shade);
  return 0.8; // hue matches; lightness unknown on one side
}

function extractGarmentFromClause(clause: string): LookGarment | null {
  const normalized = clause
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
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
  if (!garment || !category) return null;
  const colors = words.filter((w) => COLOR_WORDS.has(w));
  return {
    category,
    garment,
    color: colors.length ? colors.join(" ") : null,
    clause: clause.trim(),
  };
}

function decomposeFromWholeText(description: string): LookGarment[] {
  const lower = normalizeCompoundColors(description.toLowerCase());
  const hits: { index: number; garment: LookGarment }[] = [];
  for (const key of GARMENT_KEYS) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(key, from);
      if (index === -1) break;
      const before = lower.slice(Math.max(0, index - 48), index);
      const clause = `${before} ${key}`.trim();
      const parsed = extractGarmentFromClause(clause);
      if (parsed) hits.push({ index, garment: parsed });
      from = index + key.length;
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const out: LookGarment[] = [];
  const seen = new Set<string>();
  for (const { garment } of hits) {
    const dedupeKey = `${garment.category}:${garment.color ?? ""}:${garment.garment}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(garment);
  }
  return out;
}

/**
 * Deterministically split a free-text look description into individual garments,
 * each mapped to a catalogue category with any qualifying colour. Keyword-based
 * (no AI call) so it behaves identically in demo and live mode.
 */
export function decomposeLook(description: string): LookGarment[] {
  const clauses = normalizeCompoundColors(description.toLowerCase()).split(
    /,|\s+over\s+|\s+and\s+|\s+with\s+/,
  );
  const out: LookGarment[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    const parsed = extractGarmentFromClause(clause);
    if (!parsed) continue;
    const dedupeKey = `${parsed.category}:${parsed.color ?? ""}:${parsed.garment}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(parsed);
  }
  if (out.length) return out;
  return decomposeFromWholeText(description);
}

/** Palette-aware wardrobe staples assumed already owned (clearly labelled in UI). */
function assumedBasics(profile: StyleProfile): {
  bottoms: string[];
  /** Dress shoes for formal contexts. */
  shoes: string[];
  /** Smart-casual shoes for relaxed contexts. */
  casualShoes: string[];
} {
  const u = lc(profile.physical.undertone);
  const jeans =
    u === "warm"
      ? "Mid-indigo jeans"
      : u === "cool"
        ? "Blue-grey jeans"
        : "Indigo jeans";
  const chinos =
    u === "warm"
      ? "Stone chinos"
      : u === "cool"
        ? "Grey chinos"
        : "Taupe chinos";
  const shoe = u === "cool" ? "Black leather derbies" : "Brown leather derbies";
  const sneaker = u === "cool" ? "White leather sneakers" : "Cream leather sneakers";
  return { bottoms: [jeans, chinos], shoes: [shoe], casualShoes: [sneaker] };
}

/** Smart-casual footwear that suits relaxed contexts (not boardrooms). */
const SNEAKER_RE = /\b(sneakers?|trainers?|plimsolls?|runners?)\b/i;

/** Contexts that call for dress shoes rather than casual/warm-weather footwear. */
export const FORMAL_CONTEXTS = new Set([
  "Boardroom",
  "Client meeting",
  "Dinner",
  "Date night",
  "On stage",
  "Evening event",
]);

/**
 * Optional lifestyle tags (from intake) → the outfit contexts they call for.
 * Keyed by lower-cased label. Empty lifestyle contributes nothing, so a report
 * with no lifestyle selected behaves exactly as before.
 */
const LIFESTYLE_CONTEXTS: Record<string, string[]> = {
  "office & remote": ["Boardroom", "Client meeting", "Smart casual"],
  "travels often": ["Travel day", "Smart casual"],
  "active / outdoors": ["Outdoors", "Weekend"],
  "public speaking": ["On stage", "Client meeting"],
  "creator / blog": ["On camera", "Smart casual"],
  parenting: ["Everyday", "Weekend"],
  "old money": ["Country weekend", "Smart casual", "Dinner"],
  socialite: ["Evening event", "Date night", "Dinner"],
};

/**
 * Outfit contexts for the client. Lifestyle tags (optional) take priority, then
 * goals + boldness, then a sensible default mix to guarantee enough contexts.
 */
function contextsForGoals(profile: StyleProfile): string[] {
  const hay = `${profile.goals.join(" ")} ${profile.boldness}`.toLowerCase();
  const out: string[] = [];
  const add = (...cs: string[]) => {
    for (const c of cs) if (!out.includes(c)) out.push(c);
  };
  // Lifestyle first — most personal signal. Empty ⇒ no effect (unchanged).
  for (const l of profile.lifestyle ?? []) {
    const cs = LIFESTYLE_CONTEXTS[l.trim().toLowerCase()];
    if (cs) add(...cs);
  }
  if (/work|profession|office|career|business|promot|lead|manage|interview/.test(hay))
    add("Boardroom", "Client meeting");
  if (/confiden|date|dating|social|attract|impress|romance/.test(hay))
    add("Dinner", "Date night");
  if (/casual|weekend|comfort|relax|everyday|natural|simple/.test(hay))
    add("Weekend", "Travel day");
  if (/versatile|capsule|minimal|polished|elevate/.test(hay))
    add("Smart casual", "Everyday");
  // Always have at least six contexts available.
  add("Smart casual", "Weekend", "Client meeting", "Dinner", "Travel day", "Everyday");
  return out;
}

/** A context-specific outfit recipe: which layer / top / bottom / shoe to use. */
type OutfitSlot = {
  layer: "formal" | "casual" | "none";
  top: "shirt" | "knit" | "polo" | "tee" | "any";
  bottom: "dress" | "chino" | "jean";
  shoe: "dress" | "sneaker";
};

/**
 * Per-context recipes give every capsule look a distinct silhouette. Formal
 * contexts always land on dress shoes; casual ones differentiate between a
 * smart-casual (chinos + loafers) and a relaxed (jeans + sneakers) register.
 */
const CAPSULE_RECIPES: Record<string, OutfitSlot> = {
  Boardroom: { layer: "formal", top: "shirt", bottom: "dress", shoe: "dress" },
  "Client meeting": { layer: "none", top: "knit", bottom: "dress", shoe: "dress" },
  Dinner: { layer: "formal", top: "knit", bottom: "dress", shoe: "dress" },
  "Date night": { layer: "none", top: "shirt", bottom: "dress", shoe: "dress" },
  "Smart casual": { layer: "none", top: "knit", bottom: "chino", shoe: "dress" },
  Everyday: { layer: "none", top: "shirt", bottom: "chino", shoe: "sneaker" },
  Weekend: { layer: "casual", top: "polo", bottom: "jean", shoe: "sneaker" },
  "Travel day": { layer: "casual", top: "tee", bottom: "chino", shoe: "sneaker" },
  // Lifestyle-driven contexts (distinct silhouettes so images differ).
  Outdoors: { layer: "casual", top: "tee", bottom: "chino", shoe: "sneaker" },
  "On stage": { layer: "formal", top: "knit", bottom: "dress", shoe: "dress" },
  "On camera": { layer: "none", top: "knit", bottom: "chino", shoe: "dress" },
  "Country weekend": { layer: "casual", top: "knit", bottom: "chino", shoe: "dress" },
  "Evening event": { layer: "formal", top: "shirt", bottom: "dress", shoe: "dress" },
};
const DEFAULT_CAPSULE_SLOT: OutfitSlot = {
  layer: "none",
  top: "any",
  bottom: "chino",
  shoe: "sneaker",
};

/**
 * Mix-and-match outfit matrix built ONLY from the curated catalogue (`shopping`).
 * When a slot has no catalogue item (e.g. no trousers / shoes), it is filled with
 * clearly-labelled assumed wardrobe basics rather than fabricated catalogue picks.
 * Contexts are tied to the client's goals. Deterministic so the generated capsule
 * images (ordered to match this output) stay aligned.
 */
export function capsuleMatrix(
  shopping: ShoppingItem[],
  profile: StyleProfile,
): OutfitCombo[] {
  const pick = (cats: string[]) =>
    shopping.filter((i) => cats.includes(i.category)).map((i) => i.title);
  const basics = assumedBasics(profile);
  const owned = new Set<string>();

  const layers = pick(["Outerwear"]);
  const knits = pick(["Knitwear"]);
  const shirtsAll = pick(["Shirts"]);
  const anyTop = [...knits, ...shirtsAll];
  if (!anyTop.length && !layers.length) return [];

  const tees = shirtsAll.filter((t) => /\b(t-?shirt|tee)\b/i.test(t));
  const dressShirts = shirtsAll.filter((t) => !/\b(t-?shirt|tee)\b/i.test(t));
  const polos = anyTop.filter((t) => /polo/i.test(t));

  const formalLayers = layers.filter((l) => !CASUAL_OUTERWEAR_RE.test(l));
  const casualLayers = layers.filter((l) => CASUAL_OUTERWEAR_RE.test(l));

  const catTrousers = pick(["Trousers"]);
  // Prefer real catalogue chinos/jeans for those slots before falling back to
  // assumed basics, so purchasable trousers aren't crowded out by virtual ones.
  const catJeans = catTrousers.filter((t) => /\b(jeans?|denim)\b/i.test(t));
  const catChinos = catTrousers.filter((t) => /\bchinos?\b/i.test(t));
  const catOtherTrousers = catTrousers.filter(
    (t) => !/\b(jeans?|denim|chinos?)\b/i.test(t),
  );
  const jeanBasic = basics.bottoms[0];
  const chinoBasic = basics.bottoms[1] ?? basics.bottoms[0];

  // Split footwear by formality. Formal contexts get dress shoes only (never
  // sandals/clogs); casual contexts prefer sneakers. Each falls back to a
  // clearly-labelled assumed basic when the catalogue lacks a fitting pair.
  const shoes = (() => {
    const s = pick(["Footwear"]);
    return s.length ? s : basics.shoes;
  })();
  const dressShoes = shoes.filter(
    (s) => !CASUAL_FOOTWEAR_RE.test(s) && !SNEAKER_RE.test(s),
  );
  const formalPool = dressShoes.length ? dressShoes : basics.shoes;
  if (!dressShoes.length) basics.shoes.forEach((s) => owned.add(s));
  const sneakers = shoes.filter((s) => SNEAKER_RE.test(s));
  const casualPool = sneakers.length ? sneakers : basics.casualShoes;
  if (!sneakers.length) basics.casualShoes.forEach((s) => owned.add(s));

  // Round-robin picker so consecutive looks don't repeat the same piece.
  const counts = new Map<string, number>();
  const rot = (key: string, arr: string[]): string | undefined => {
    const clean = arr.filter(Boolean);
    if (!clean.length) return undefined;
    const n = counts.get(key) ?? 0;
    counts.set(key, n + 1);
    return clean[n % clean.length];
  };
  const poolForTop = (kind: OutfitSlot["top"]): [string, string[]] => {
    switch (kind) {
      case "shirt":
        return ["shirt", dressShirts.length ? dressShirts : anyTop];
      case "knit":
        return ["knit", knits.length ? knits : anyTop];
      case "polo":
        return ["polo", polos.length ? polos : knits.length ? knits : anyTop];
      case "tee":
        return ["tee", tees.length ? tees : anyTop];
      default:
        return ["any", anyTop];
    }
  };
  const topFor = (kind: OutfitSlot["top"]): string | undefined => {
    const [key, pool] = poolForTop(kind);
    return rot(key, pool);
  };

  // Colour harmony: build a title → swatch map so a look keeps at most one
  // accent piece (neutrals form the base). Unknown/non-hex colours are treated
  // as neutral so nothing is dropped when colour data is missing.
  const colorByTitle = new Map<string, string>();
  for (const i of shopping) if (i.title && i.color) colorByTitle.set(i.title, i.color);
  const isNeutralPiece = (title?: string): boolean => {
    if (!title) return true;
    const hex = colorByTitle.get(title);
    if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.trim())) return true;
    return hexToHsl(hex).s < 0.3;
  };

  // Each context maps to a distinct silhouette so, e.g., Smart casual (knit +
  // chinos + loafers) never collapses into Weekend (jacket + polo + jeans +
  // sneakers). Deterministic — capsule images are ordered to match.
  const contexts = contextsForGoals(profile).slice(0, 6);
  const combos: OutfitCombo[] = [];
  const seen = new Set<string>();
  for (const context of contexts) {
    const slot = CAPSULE_RECIPES[context] ?? DEFAULT_CAPSULE_SLOT;
    const pieces: string[] = [];

    if (slot.layer === "formal") {
      const l = rot("formalLayer", formalLayers);
      if (l) pieces.push(l);
    } else if (slot.layer === "casual") {
      // Fall back to a formal layer (worn open) so a casual look isn't left
      // thin — better an unstructured blazer than no layer at all.
      const l =
        rot("casualLayer", casualLayers) ?? rot("casualLayerAlt", formalLayers);
      if (l) pieces.push(l);
    }

    const top = topFor(slot.top);
    const topIndex = top ? pieces.push(top) - 1 : -1;

    let bottom: string | undefined;
    if (slot.bottom === "jean") {
      bottom = catJeans.length ? rot("catJean", catJeans) : jeanBasic;
      if (!catJeans.length) owned.add(jeanBasic);
    } else if (slot.bottom === "chino") {
      bottom = catChinos.length ? rot("catChino", catChinos) : chinoBasic;
      if (!catChinos.length) owned.add(chinoBasic);
    } else {
      // Dress slot: prefer real tailored trousers (non-jean/chino), then any
      // catalogue trouser, then an assumed chino.
      const dressPool = catOtherTrousers.length ? catOtherTrousers : catTrousers;
      bottom = dressPool.length ? rot("trousers", dressPool) : chinoBasic;
      if (!dressPool.length) owned.add(chinoBasic);
    }
    if (bottom) pieces.push(bottom);

    // Footwear last — the image prompt derives its footwear directive from it.
    const shoe =
      slot.shoe === "dress" ? rot("dress", formalPool) : rot("sneaker", casualPool);
    const shoeIndex = shoe ? pieces.push(shoe) - 1 : -1;

    // Enforce one-accent harmony: if the look carries more than one accent
    // (excluding footwear, whose leather tones read as neutral), swap the
    // near-the-face top for a neutral catalogue alternative when one exists.
    const accentCount = () =>
      pieces.filter((p, idx) => idx !== shoeIndex && !isNeutralPiece(p)).length;
    if (topIndex >= 0 && accentCount() > 1 && !isNeutralPiece(pieces[topIndex])) {
      const [, pool] = poolForTop(slot.top);
      const neutralAlt = pool.find(
        (t) => isNeutralPiece(t) && !pieces.includes(t),
      );
      if (neutralAlt) pieces[topIndex] = neutralAlt;
    }

    const key = pieces.join("|").toLowerCase();
    if (!pieces.length || seen.has(key)) continue;
    seen.add(key);
    const ownedHere = pieces.filter((p) => owned.has(p));
    combos.push({
      context,
      pieces,
      ...(ownedHere.length ? { owned: ownedHere } : {}),
    });
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

/**
 * Render-time extras for a report. Prefers a pre-translated stored snapshot
 * (non-English reports) and otherwise computes them live in English.
 */
export function extrasForReport(report: StyleReport): StyleExtras {
  return report.extras ?? buildExtras(report);
}

export function buildExtras(report: StyleReport): StyleExtras {
  const { profile } = report;
  return {
    archetype: archetypeFor(profile),
    priorityMoves: priorityMoves(profile, report.shopping),
    colorDNA: colorDNAFor(profile, report.colors.best),
    metals: metalsFor(profile.physical.undertone),
    eyewear: eyewearFor(profile.physical.faceShape),
    fitBlueprint: fitBlueprint(profile),
    barberBlueprint: barberBlueprint(profile),
    pairings: colorPairings(report.colors.best),
    fabrics: fabricsFor(profile),
    capsule: capsuleFrom(report.shopping, profile),
    matrix: capsuleMatrix(report.shopping, profile),
    priceTiers: priceTiersFrom(report.shopping),
    grooming: groomingFor(profile),
    styling: STYLING_MECHANICS,
    care: CARE_GUIDE,
    fragrance: fragranceFor(profile),
  };
}
