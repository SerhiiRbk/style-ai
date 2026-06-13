import {
  inferBodyTypeFromMeasurements,
  type Intake,
  type StyleProfile,
  type ReportContent,
} from "./style-profile";
import { isDemoReportId } from "./demo-report";
import { resolveHairImage } from "./hair-images";
import type { SavedOutfitTryOn } from "./outfit-tryon";

export type Tier = "free" | "basic" | "lookbook" | "premium";

export type ColorRec = { name: string; hex: string; why: string };
/** Max personalized avoid-hair images generated (all tiers). */
export const HAIR_AVOID_GEN_LIMIT = 2;

/** Photorealistic look images generated per report tier. */
export function lookCountForTier(tier: Tier): number {
  switch (tier) {
    case "free":
      return 1;
    case "basic":
      return 3;
    case "lookbook":
      return 4;
    case "premium":
      return 6;
  }
}

/** Whether the tier may enable a public share link. */
export function canShareReport(tier: Tier): boolean {
  return tier !== "free";
}

export type ReportUpsell = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

/** Bottom-of-report CTA — tier upgrade for lower tiers, another report for Premium. */
export function reportUpsellForTier(tier: Tier): ReportUpsell | null {
  switch (tier) {
    case "free":
    case "basic":
      return {
        title: "Want the full lookbook?",
        body:
          `Unlock ${lookCountForTier("lookbook")} photorealistic looks, the capsule wardrobe and week-of-outfits matrix, ` +
          `virtual try-on on your photo, dual-angle hairstyle previews, and a Good · Better · Best buying plan.`,
        ctaLabel: "Upgrade to Lookbook",
        ctaHref: "/pricing",
      };
    case "lookbook":
      return {
        title: "Want the deepest report?",
        body:
          `Upgrade to Premium for ${lookCountForTier("premium")} photorealistic looks, personalized facial-hair and eyewear previews on your photo, ` +
          `and deeper grooming guidance — the most personal report we offer.`,
        ctaLabel: "Upgrade to Premium",
        ctaHref: "/pricing",
      };
    case "premium":
      return {
        title: "Ready for another Premium report?",
        body:
          `Your style evolves — start a new Premium report with updated photos for ${lookCountForTier("premium")} fresh photorealistic looks, ` +
          `personalized facial-hair and eyewear previews, and a capsule built around your current goals.`,
        ctaLabel: "Create another Premium report",
        ctaHref: "/start",
      };
  }
}

/** Max personalized recommend-hair images to generate for a tier (controls API cost). */
export function hairRecommendGenLimit(tier?: Tier): number {
  switch (tier) {
    case "free":
      return 2;
    case "basic":
      return 3;
    case "lookbook":
    case "premium":
      return 4;
    default:
      return 3;
  }
}

/** Clamp AI hair lists to tier generation caps. */
export function clampHairForTier(
  hair: { recommend: HairRec[]; avoid: HairRec[] },
  tier: Tier,
): { recommend: HairRec[]; avoid: HairRec[] } {
  return {
    recommend: hair.recommend.slice(0, hairRecommendGenLimit(tier)),
    avoid: hair.avoid.slice(0, HAIR_AVOID_GEN_LIMIT),
  };
}
/** Max personalized facial-hair previews per premium report. */
export const PREMIUM_FACIAL_HAIR_GEN_LIMIT = 4;
/** Max personalized eyewear previews per premium report (2 optical + 2 sunglasses). */
export const PREMIUM_EYEWEAR_GEN_LIMIT = 4;
/** Accessory styling previews generated per premium add-on purchase. */
export const PREMIUM_ACCESSORY_GEN_LIMIT = 2;

export type HairRec = {
  name: string;
  why: string;
  /** Public static path (demo) or signed URL after read. */
  image?: string;
  /** Side / three-quarter view — Lookbook & Premium recommend only. */
  imageSide?: string;
  /** Private assets bucket path — live reports only. */
  imagePath?: string;
  /** Private assets bucket path for the side-angle preview. */
  imagePathSide?: string;
};

/** Premium personalized facial-hair style preview (beard / mustache). */
export type FacialHairRec = HairRec;

/** Premium personalized eyewear preview on the user's photo. */
export type EyewearRec = HairRec & {
  /** Static fallback shape id when image is still generating. */
  shape?: string;
  kind?: "optical" | "sun";
};

/** Premium paid add-on — accessory styling preview (scarf / neckwear / tie) on the user's photo. */
export type AccessoryRec = HairRec & {
  kind?: "scarf" | "neckwear" | "tie";
};
export type ShoppingItem = {
  category: string;
  title: string;
  why: string;
  priceEur: number;
  /** Retailer's native sale price in `currency` (when known, from the offer). */
  priceNative?: number;
  /** Currency of the selected per-country offer (e.g. EUR, PLN). */
  currency?: string;
  retailer: string;
  url: string;
  color: string;
  image?: string;
  productId?: string;
  /** Catalogue pick is stylistically close, not a guaranteed photo match. */
  similarPick?: boolean;
  /** Bumped when look-matching logic changes — triggers background refresh. */
  matchVersion?: number;
};
export type Look = {
  context: string;
  title: string;
  description: string;
  palette: string[];
  image: string;
};

export type ReportGenerationState = {
  status: "processing" | "ready" | "failed";
  pending: boolean;
  phase: "report" | "hair" | "grooming" | "images" | "capsule" | null;
};

export type StyleReport = {
  id: string;
  tier: Tier;
  createdAt: string;
  intake: Intake;
  profile: StyleProfile;
  headline: string;
  summary: string;
  colors: { best: ColorRec[]; avoid: ColorRec[] };
  hair: { recommend: HairRec[]; avoid: HairRec[] };
  /** Premium — personalized beard / mustache previews (up to 4). */
  facialHair?: FacialHairRec[];
  /** Premium — personalized glasses previews (2 optical + 2 sunglasses). */
  eyewear?: EyewearRec[];
  /** Premium paid add-on — accessory styling previews (scarves / neckwear / ties). */
  accessories?: AccessoryRec[];
  silhouette: { fit: string; rules: string[] };
  looks: Look[];
  shopping: ShoppingItem[];
  doList: string[];
  dontList: string[];
  /** Signed URLs for the capsule "week of outfits" photos, ordered to match capsuleMatrix(). */
  capsuleImages?: (string | null | undefined)[];
  /** Per-look matched products keyed by look index (Shop the Look). Optional for backward compatibility. */
  lookItems?: Record<number, ShoppingItem[]>;
  /** Owner-only — saved catalogue / outfit try-on renders for this report. */
  outfitTryons?: SavedOutfitTryOn[];
  /** Live reports only — drives the “still generating” banner. */
  generation?: ReportGenerationState;
};

export const climateFor = (country: string): string => {
  const c = country.toLowerCase();
  if (/(spain|italy|greece|portugal)/.test(c)) return "warm mediterranean";
  if (/(uk|ireland|netherlands|belgium)/.test(c)) return "cool maritime";
  if (/(germany|poland|austria|czech|france)/.test(c)) return "temperate";
  if (/(sweden|norway|finland|denmark)/.test(c)) return "cold nordic";
  return "temperate";
};

/** Deterministic mock Style Profile — used in demo mode and as AI fallback. */
export function mockStyleProfile(intake: Intake): StyleProfile {
  return {
    version: "1.0",
    demographics: {
      age: intake.age,
      genderPresentation: intake.genderPresentation,
      city: intake.city,
      country: intake.country,
      climate: climateFor(intake.country),
    },
    physical: {
      skinTone: "warm medium",
      undertone: "warm",
      contrast: "low",
      faceShape: "oval",
      bodyType:
        intake.bodyType ??
        inferBodyTypeFromMeasurements(
          intake.measurements,
          intake.genderPresentation,
        ) ??
        "rectangle",
      heightCm: intake.heightCm,
      weightKg: intake.weightKg,
      measurements: intake.measurements,
    },
    colorSeason: "autumn",
    currency: intake.currency,
    goals: intake.goals,
    boldness: intake.boldness,
    budgetEur: intake.budgetEur,
  };
}

/** Deterministic mock report content — used in demo mode and as AI fallback. */
export function mockReportContent(intake: Intake): ReportContent {
  const colors = {
    best: [
      { name: "Olive", hex: "#6B6B47", why: "Echoes your warm undertone and keeps focus on your face without harsh contrast." },
      { name: "Rust", hex: "#9E5C3C", why: "A warm earth tone that adds healthy depth to medium skin." },
      { name: "Cream", hex: "#EFE6D3", why: "Softer than pure white — flatters low-contrast colouring up close." },
      { name: "Deep navy", hex: "#27324A", why: "A reliable neutral that reads modern and professional." },
      { name: "Camel", hex: "#B08A5B", why: "Refined warmth that pairs effortlessly across the wardrobe." },
    ],
    avoid: [
      { name: "Icy pastel", hex: "#CFE3EE", why: "Cool and washed-out against a warm complexion — drains the face." },
      { name: "Pure white", hex: "#FFFFFF", why: "Too stark for low contrast; creates an unflattering hard edge." },
      { name: "Cool magenta", hex: "#B83280", why: "Fights your undertone and pulls attention away from you." },
    ],
  };

  const hair = {
    recommend: [
      {
        name: "Textured crop",
        why: "Adds structure that balances an oval face and reads contemporary.",
        image: "/images/hair/textured-crop.png",
        imageSide: "/images/demo/hair-textured-crop-side.png",
      },
      {
        name: "Short tapered sides",
        why: "Clean, low-maintenance, and quietly sharpens the jawline.",
        image: "/images/hair/tapered-sides.png",
        imageSide: "/images/demo/hair-tapered-sides-side.png",
      },
      {
        name: "Side part with texture",
        why: "Classic proportion for an oval face — polished without feeling stiff.",
        image: "/images/hair/tapered-sides.png",
        imageSide: "/images/demo/hair-side-part-side.png",
      },
      {
        name: "Soft layered medium",
        why: "Adds movement and depth when you want a slightly longer, relaxed look.",
        image: "/images/hair/textured-crop.png",
        imageSide: "/images/demo/hair-soft-layered-side.png",
      },
    ],
    avoid: [
      { name: "Heavy straight fringe", why: "Shortens the face and dates the overall look.", image: "/images/hair/heavy-fringe.png" },
      {
        name: "Buzz cut (too short)",
        why: "Strips away length and texture — reads harsh on an oval face and ages the overall look.",
        image: "/images/demo/hair-buzz-cut-avoid.png",
      },
    ],
  };

  const silhouette = {
    fit: "Tailored, never tight",
    rules: [
      "Structured shoulders to add definition over a rectangular frame.",
      "Mid-rise trousers with a clean break to lengthen the leg.",
      "Layering to create depth and a considered silhouette.",
    ],
  };

  const looks = [
    {
      context: "Work / meetings",
      title: "Quiet authority",
      description: "Navy unstructured blazer, cream knit, charcoal trousers, brown leather derbies.",
      palette: ["#27324A", "#EFE6D3", "#3A3A3A", "#5A3D2B"],
    },
    {
      context: "Smart casual / dinner",
      title: "Relaxed confidence",
      description: "Olive overshirt, cream tee, dark denim, suede chelsea boots.",
      palette: ["#6B6B47", "#EFE6D3", "#1F2733", "#8A6A4A"],
    },
    {
      context: "Weekend",
      title: "Effortless ease",
      description: "Camel crewneck, taupe chinos, cream leather sneakers, field watch.",
      palette: ["#B08A5B", "#9B8C72", "#E8E1D3", "#2A2A2A"],
    },
    {
      context: "Formal / events",
      title: "Polished formal",
      description: "Midnight-navy suit, crisp white shirt (no tie), dark brown oxfords.",
      palette: ["#1F2740", "#F3EEE4", "#3B2A1E", "#C9A24B"],
    },
    {
      context: "Travel / transitional",
      title: "Easy transit",
      description: "Camel overcoat over cream crewneck, taupe trousers, cream leather sneakers.",
      palette: ["#B08A5B", "#EFE6D3", "#9B8C72", "#E8E1D3"],
    },
    {
      context: "Evening out",
      title: "Relaxed polish",
      description: "Rust merino polo, charcoal wool trousers, brown leather loafers, brass watch.",
      palette: ["#9E5C3C", "#3A3A3A", "#5A3D2B", "#B08A5B"],
    },
  ];

  const doList = [
    "Build around warm neutrals — camel, olive, cream, navy.",
    "Keep contrast soft; let your face lead, not your clothes.",
    "Invest first in fit (tailor the shoulders and hem).",
    "Choose brown leather over black to match your palette.",
  ];
  const dontList = [
    "Avoid pure white next to the face — choose cream instead.",
    "Skip icy pastels and cool magenta — they fight your undertone.",
    "Don't over-accessorise; one considered piece beats three.",
    "Avoid boxy, oversized tailoring — it flattens your frame.",
  ];

  return {
    headline: "Warm, modern, and quietly confident",
    summary:
      `Your colouring is warm with low contrast, which means soft earth tones flatter you far more than cool, high-contrast palettes. ` +
      `For a ${intake.age}-year-old in ${intake.city}'s ${climateFor(intake.country)} climate working in ${intake.occupation.toLowerCase()}, ` +
      `the goal is a refined, low-effort wardrobe that reads modern without trying too hard.`,
    colors,
    hair,
    silhouette,
    looks,
    doList,
    dontList,
  };
}

const LOOK_IMAGES = [
  "/images/look-work.png",
  "/images/look-dinner.png",
  "/images/look-weekend.png",
  "/images/look-formal.png",
  "/images/look-travel.png",
  "/images/demo/look-evening.png",
];

/** Premium demo grooming previews — generated with AI_MODEL_IMAGE on hero-editorial.png. */
const DEMO_FACIAL_HAIR: FacialHairRec[] = [
  {
    name: "Short even beard",
    why: "A tidy, even line suits an oval face — natural cheek line, clean neckline.",
    image: "/images/demo/facial-hair-short-even-beard.png",
  },
  {
    name: "Refined stubble",
    why: "Low-maintenance texture that reads modern without overpowering your features.",
    image: "/images/demo/facial-hair-refined-stubble.png",
  },
  {
    name: "Classic full beard",
    why: "Even growth with a defined neckline — versatile on an oval face.",
    image: "/images/demo/facial-hair-classic-full-beard.png",
  },
  {
    name: "Van Dyke",
    why: "A neat mustache paired with a small chin patch adds character without bulk.",
    image: "/images/demo/facial-hair-van-dyke.png",
  },
];

const DEMO_EYEWEAR: EyewearRec[] = [
  {
    name: "Wayfarer",
    shape: "wayfarer",
    kind: "optical",
    why: "Classic balance for an oval face — versatile and modern.",
    image: "/images/demo/eyewear-wayfarer-optical.png",
  },
  {
    name: "Rectangular",
    shape: "rectangle",
    kind: "optical",
    why: "Keeps proportions in check without elongating.",
    image: "/images/demo/eyewear-rectangle-optical.png",
  },
  {
    name: "Wayfarer sunglasses",
    shape: "wayfarer",
    kind: "sun",
    why: "Classic balance for an oval face in sun.",
    image: "/images/demo/eyewear-wayfarer-sun.png",
  },
  {
    name: "Aviator sunglasses",
    shape: "aviator",
    kind: "sun",
    why: "Relaxed edge while keeping proportions balanced outdoors.",
    image: "/images/demo/eyewear-aviator-sun.png",
  },
];

const DEMO_ACCESSORIES: AccessoryRec[] = [
  {
    name: "Wool-blend scarf",
    kind: "scarf",
    why: "A soft neutral scarf in your palette adds warmth and a finished, considered layer over coats and knitwear.",
    image: "/images/demo/accessory-scarf.png",
  },
  {
    name: "Silk grenadine tie",
    kind: "tie",
    why: "A textured, matte tie in your palette reads refined — the detail that elevates a jacket for work.",
    image: "/images/demo/accessory-tie.png",
  },
];

const HAIR_DUAL_ANGLE_TIERS: Tier[] = ["lookbook", "premium"];

/** True when top-N hair items still await personalized image generation. */
export function hairGenerationPending(
  hair: {
    recommend: HairRec[];
    avoid: HairRec[];
  },
  tier?: Tier,
): boolean {
  const dualAngle = tier != null && HAIR_DUAL_ANGLE_TIERS.includes(tier);

  const recommendLimit = hairRecommendGenLimit(tier);
  for (const h of hair.recommend.slice(0, recommendLimit)) {
    if (!h.imagePath) return true;
    if (dualAngle && !h.imagePathSide) return true;
  }
  for (const h of hair.avoid.slice(0, HAIR_AVOID_GEN_LIMIT)) {
    if (!h.imagePath) return true;
  }
  return false;
}

/** True when premium facial-hair / eyewear / accessory previews still await generation. */
export function premiumGroomingPending(
  facialHair: FacialHairRec[] | null | undefined,
  eyewear: EyewearRec[] | null | undefined,
  accessories?: AccessoryRec[] | null | undefined,
): boolean {
  const targets = [
    ...(facialHair ?? []).slice(0, PREMIUM_FACIAL_HAIR_GEN_LIMIT),
    ...(eyewear ?? []).slice(0, PREMIUM_EYEWEAR_GEN_LIMIT),
    ...(accessories ?? []).slice(0, PREMIUM_ACCESSORY_GEN_LIMIT),
  ];
  if (targets.length === 0) return false;
  return targets.some((item) => !item.imagePath);
}

function enrichHair(
  hair: { recommend: HairRec[]; avoid: HairRec[] },
  opts?: { isDemo?: boolean; personalizedPending?: boolean; tier?: Tier },
) {
  const isDemo = opts?.isDemo ?? false;
  const personalizedPending = opts?.personalizedPending ?? false;
  const recommendLimit = hairRecommendGenLimit(opts?.tier);
  const avoidLimit = HAIR_AVOID_GEN_LIMIT;

  const withImage = (h: HairRec, index: number, genLimit: number) => {
    if (h.image) return h;
    const inGenBatch = index < genLimit;
    if (!isDemo && inGenBatch && personalizedPending) return h;
    return { ...h, image: resolveHairImage(h.name) };
  };

  return {
    recommend: hair.recommend.map((h, i) => withImage(h, i, recommendLimit)),
    avoid: hair.avoid.map((h, i) => withImage(h, i, avoidLimit)),
  };
}

const MOCK_SHOPPING_TITLES = new Set([
  "Unstructured navy blazer",
  "Camel merino crewneck",
  "Olive overshirt",
  "Charcoal wool-blend trousers",
  "Brown leather derbies",
  "Cream leather sneakers",
  "Tan suede chelsea boots",
  "Field watch, cream dial",
]);

/** True when shopping reasons use the old generic template (pre-v2 copy). */
export function isStaleShoppingCopy(items: ShoppingItem[]): boolean {
  return items.some((i) =>
    /^A \S+ that fits your .+ palette and your goal to/.test(i.why),
  );
}

/** True when items are the curated demo list (persisted fallback), not catalogue matches. */
export function isMockShopping(items: ShoppingItem[]): boolean {
  if (!items.length) return false;
  const titles = items.map((i) => i.title);
  if (titles.length !== MOCK_SHOPPING_TITLES.size) return false;
  return titles.every((t) => MOCK_SHOPPING_TITLES.has(t));
}

/** Deterministic mock shopping list — used in demo mode and as catalogue fallback. */
export function mockShopping(): ShoppingItem[] {
  return [
    { category: "Outerwear", title: "Unstructured navy blazer", why: "The single highest-impact piece — elevates everything it touches.", priceEur: 189, retailer: "COS", url: "https://www.cos.com", color: "#27324A", image: "/images/products/navy-blazer.png" },
    { category: "Knitwear", title: "Camel merino crewneck", why: "Warm neutral that layers over shirts and under the blazer.", priceEur: 95, retailer: "Uniqlo", url: "https://www.uniqlo.com", color: "#B08A5B", image: "/images/products/camel-crewneck.png" },
    { category: "Shirts", title: "Olive overshirt", why: "Bridges casual and smart — a season-spanning workhorse.", priceEur: 79, retailer: "Arket", url: "https://www.arket.com", color: "#6B6B47", image: "/images/products/olive-overshirt.png" },
    { category: "Trousers", title: "Charcoal wool-blend trousers", why: "Mid-rise, clean break — the foundation of the work looks.", priceEur: 110, retailer: "Massimo Dutti", url: "https://www.massimodutti.com", color: "#3A3A3A", image: "/images/products/charcoal-trousers.png" },
    { category: "Footwear", title: "Brown leather derbies", why: "Warm-toned shoes tie the palette together far better than black.", priceEur: 160, retailer: "Loake", url: "https://www.loake.com", color: "#5A3D2B", image: "/images/products/brown-derbies.png" },
    { category: "Footwear", title: "Cream leather sneakers", why: "A warm off-white reads dressier than bright white and stays in your palette year-round.", priceEur: 120, retailer: "CQP", url: "https://www.cqp.se", color: "#E8E1D3", image: "/images/products/cream-sneakers.png" },
    { category: "Footwear", title: "Tan suede chelsea boots", why: "The casual anchor with more weight than a sneaker — carries the warm palette into cooler months.", priceEur: 190, retailer: "Grenson", url: "https://www.grenson.com", color: "#8A6A4A", image: "/images/products/chelsea-boots.png" },
    { category: "Accessories", title: "Field watch, cream dial", why: "Understated warmth on the wrist; avoids flash.", priceEur: 145, retailer: "Timex", url: "https://www.timex.com", color: "#EFE6D3", image: "/images/products/field-watch.png" },
  ];
}

/** Assemble a full StyleReport from a profile + content + shopping (real or mock). */
export function assembleReport(opts: {
  intake: Intake;
  tier: Tier;
  profile: StyleProfile;
  content: ReportContent;
  shopping: ShoppingItem[];
  lookImages?: (string | null | undefined)[];
  capsuleImages?: (string | null | undefined)[];
  lookItems?: Record<number, ShoppingItem[]>;
  outfitTryons?: SavedOutfitTryOn[];
  generation?: ReportGenerationState;
  personalizedHairPending?: boolean;
  facialHair?: FacialHairRec[];
  eyewear?: EyewearRec[];
  accessories?: AccessoryRec[];
  id?: string;
  createdAt?: string;
}): StyleReport {
  const isDemo = opts.id != null && isDemoReportId(opts.id);
  const hairContent = clampHairForTier(opts.content.hair, opts.tier);
  const looks: Look[] = opts.content.looks.map((l, i) => ({
    ...l,
    image:
      opts.lookImages?.[i] ??
      (isDemo ? LOOK_IMAGES[i % LOOK_IMAGES.length] : ""),
  }));
  return {
    id: opts.id ?? Math.random().toString(36).slice(2, 10),
    tier: opts.tier,
    createdAt: opts.createdAt ?? new Date().toISOString(),
    intake: opts.intake,
    profile: opts.profile,
    headline: opts.content.headline,
    summary: opts.content.summary,
    colors: opts.content.colors,
    hair: enrichHair(hairContent, {
      isDemo,
      tier: opts.tier,
      personalizedPending: opts.personalizedHairPending,
    }),
    facialHair: opts.facialHair,
    eyewear: opts.eyewear,
    accessories: opts.accessories,
    silhouette: opts.content.silhouette,
    looks,
    shopping: opts.shopping,
    doList: opts.content.doList,
    dontList: opts.content.dontList,
    capsuleImages: opts.capsuleImages,
    lookItems: opts.lookItems,
    outfitTryons: opts.outfitTryons,
    generation: opts.generation,
  };
}

/** Full deterministic mock report (demo mode + fallback). */
export function generateReport(
  intake: Intake,
  tier: Tier,
  id?: string,
): StyleReport {
  const isDemo = id != null && isDemoReportId(id);
  return assembleReport({
    id,
    intake,
    tier,
    profile: mockStyleProfile(intake),
    content: mockReportContent(intake),
    shopping: mockShopping(),
    facialHair: isDemo && tier === "premium" ? DEMO_FACIAL_HAIR : undefined,
    eyewear: isDemo && tier === "premium" ? DEMO_EYEWEAR : undefined,
    accessories: isDemo && tier === "premium" ? DEMO_ACCESSORIES : undefined,
  });
}

export const demoIntake: Intake = {
  age: 42,
  genderPresentation: "male",
  city: "Berlin",
  country: "Germany",
  currency: "EUR",
  heightCm: 182,
  occupation: "Software / IT",
  lifestyle: ["Office & remote", "Travels often"],
  goals: ["Look more professional", "Look modern but natural"],
  boldness: "moderate",
  budgetEur: { min: 400, max: 1200 },
  measurements: {
    shoulderCm: 112,
    chestCm: 104,
    waistCm: 90,
    hipCm: 102,
    sleeveCm: 86,
  },
  notes: "Recently relocated, wants to look appropriate for the local scene.",
};
