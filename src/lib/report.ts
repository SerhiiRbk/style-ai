import {
  inferBodyTypeFromMeasurements,
  type Intake,
  type StyleProfile,
  type ReportContent,
} from "./style-profile";

export type Tier = "free" | "basic" | "lookbook" | "premium";

export type ColorRec = { name: string; hex: string; why: string };
export type HairRec = { name: string; why: string; image?: string };
export type ShoppingItem = {
  category: string;
  title: string;
  why: string;
  priceEur: number;
  retailer: string;
  url: string;
  color: string;
  image?: string;
  productId?: string;
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
  phase: "report" | "images" | "capsule" | null;
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
  silhouette: { fit: string; rules: string[] };
  looks: Look[];
  shopping: ShoppingItem[];
  doList: string[];
  dontList: string[];
  /** Signed URLs for the capsule "week of outfits" photos, ordered to match capsuleMatrix(). */
  capsuleImages?: (string | null | undefined)[];
  /** Per-look matched products keyed by look index (Shop the Look). Optional for backward compatibility. */
  lookItems?: Record<number, ShoppingItem[]>;
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
      { name: "Textured crop", why: "Adds structure that balances an oval face and reads contemporary.", image: "/images/hair/textured-crop.png" },
      { name: "Short tapered sides", why: "Clean, low-maintenance, and quietly sharpens the jawline.", image: "/images/hair/tapered-sides.png" },
    ],
    avoid: [
      { name: "Heavy straight fringe", why: "Shortens the face and dates the overall look.", image: "/images/hair/heavy-fringe.png" },
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
];

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
  generation?: ReportGenerationState;
  id?: string;
  createdAt?: string;
}): StyleReport {
  const looks: Look[] = opts.content.looks.map((l, i) => ({
    ...l,
    image: opts.lookImages?.[i] ?? LOOK_IMAGES[i % LOOK_IMAGES.length],
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
    hair: opts.content.hair,
    silhouette: opts.content.silhouette,
    looks,
    shopping: opts.shopping,
    doList: opts.content.doList,
    dontList: opts.content.dontList,
    capsuleImages: opts.capsuleImages,
    lookItems: opts.lookItems,
    generation: opts.generation,
  };
}

/** Full deterministic mock report (demo mode + fallback). */
export function generateReport(intake: Intake, tier: Tier): StyleReport {
  return assembleReport({
    intake,
    tier,
    profile: mockStyleProfile(intake),
    content: mockReportContent(intake),
    shopping: mockShopping(),
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
