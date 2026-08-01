/**
 * English investor deck content — shared by /investors and docs/investors/*.md
 */

export const INVESTOR_DECK_META = {
  title: "Valetti — Investor overview",
  tagline: "Personal styling you can trust",
  confidential: true,
  year: 2026,
  site: "valetti.fit",
  contact: "founder@valetti.fit",
} as const;

export const INVESTOR_STATS = [
  { value: "€10–35", label: "Paid report price" },
  { value: "10,000+", label: "SKUs in catalog" },
  { value: "EU / USA", label: "Markets · GDPR + CCPA" },
  { value: "Credits", label: "Pay-as-you-go · card & crypto" },
] as const;

export const PROBLEM_SOLUTION = {
  problem:
    "Most men aged 30–55 in the EU and USA shop without a clear personal system. Human stylists cost $150–400 / €150–400 per session; fast fashion is noise without personalization. Generic AI chat gives text — not photos on you, not a live catalog, not try-on.",
  solution:
    "One engine analyses appearance, season, climate, and goals → synthesises personal looks → matches real catalog products → renders photorealistic previews and virtual try-on on the user's photo. Shop a Look turns any inspiration photo into buyable pieces. Every recommendation is explainable.",
  differentiator:
    "Not a generic LLM chat, but a closed pipeline — analysis → look → purchase → try-on — with a single Style Profile as source of truth, plus Shop a Look and a personal Looks gallery.",
} as const;

/** Product journey shown as a visual loop on the page. */
export const PRODUCT_LOOP = [
  { n: "01", label: "Photos", detail: "Portrait + full length" },
  { n: "02", label: "Profile", detail: "Colour · shape · goals" },
  { n: "03", label: "Looks", detail: "Photorealistic outfits" },
  { n: "04", label: "Catalog", detail: "10k+ live SKUs" },
  { n: "05", label: "Try-on", detail: "On your photo" },
  { n: "06", label: "Decide", detail: "Carlo's verdict" },
] as const;

export const PRODUCT_PILLARS = [
  {
    title: "Style reports",
    body: "Tiered reports from Starter to Premium — colour story, hair, photorealistic looks, capsule, shopping list, PDF.",
    href: "/start",
    image: "/images/look-work.png",
    imageAlt: "Photorealistic tailored work look from a Valetti report",
  },
  {
    title: "Catalogue try-on",
    body: "Browse 10,000+ menswear SKUs, build an outfit of up to four pieces, render on your photo — one credit per try-on.",
    href: "/catalog",
    image: "/images/flatlay-essentials.png",
    imageAlt: "Warm-toned menswear essentials flat lay",
  },
  {
    title: "Shop a Look",
    body: "Upload any inspiration photo — Valetti slots garments, finds buyable matches, and try-ons your selection.",
    href: "/shop-a-look",
    image: "/images/look-weekend.png",
    imageAlt: "Weekend look matched from an inspiration photo",
  },
  {
    title: "Looks gallery",
    body: "Every try-on and report image lands in one gallery, with Carlo's verdict saved alongside each render.",
    href: "/gallery",
    image: "/images/look-dinner.png",
    imageAlt: "Dinner look saved in the personal Looks gallery",
  },
] as const;

export const TIERS_TABLE = [
  ["Starter", "€0", "5 credits", "1 look · colour & hair · try-on"],
  ["Basic", "€10", "10 credits", "3 looks · shopping list · PDF"],
  ["Lookbook", "€20", "20 credits", "6 looks · capsule · week matrix"],
  ["Premium", "€35", "35 credits", "9 looks · grooming · accessories"],
] as const;

export const CREDIT_PACKS = [
  ["Single", "€10", "10 + 1 bonus"],
  ["Plus", "€20", "20 + 2 bonus"],
  ["Pro", "€35", "35 + 5 bonus"],
  ["Max", "€79", "80 + 20 bonus"],
] as const;

export const REVENUE_STREAMS = [
  { name: "Credit packs", pct: 42, color: "#a97c3c" },
  { name: "Report tiers", pct: 35, color: "#c2a06a" },
  { name: "Affiliate (catalog)", pct: 15, color: "#e7dcc7" },
  { name: "B2B white-label", pct: 8, color: "#6c6358" },
] as const;

const COGS = {
  fixedUsd: 0.052,
  imageUsd: 0.04,
  eurRate: 0.92,
  stripePct: 0.029,
  stripeFixedEur: 0.3,
};

function tierImages(tier: string): number {
  switch (tier) {
    case "Starter":
      return 5;
    case "Basic":
      return 8;
    case "Lookbook":
      return 18;
    case "Premium":
      return 31;
    default:
      return 0;
  }
}

export function tierCogsEur(tier: string): number {
  return (COGS.fixedUsd + tierImages(tier) * COGS.imageUsd) * COGS.eurRate;
}

function tierPrice(tier: string): number {
  switch (tier) {
    case "Starter":
      return 0;
    case "Basic":
      return 10;
    case "Lookbook":
      return 20;
    case "Premium":
      return 35;
    default:
      return 0;
  }
}

export function unitEconomicsRows(): string[][] {
  const rows: string[][] = [
    ["Starter", "€0", "€0.23", "—", "loss-leader", "Activation funnel"],
  ];
  for (const tier of ["Basic", "Lookbook", "Premium"] as const) {
    const price = tierPrice(tier);
    const cogs = tierCogsEur(tier);
    const stripe = price * COGS.stripePct + COGS.stripeFixedEur;
    const contrib = price - cogs - stripe;
    const margin = price > 0 ? `${Math.round((contrib / price) * 100)}%` : "—";
    rows.push([
      tier,
      `€${price}`,
      `€${cogs.toFixed(2)}`,
      `€${stripe.toFixed(2)}`,
      `€${contrib.toFixed(2)}`,
      margin,
    ]);
  }
  return rows;
}

/** Numeric series for the unit-economics bar chart (paid tiers only). */
export function unitEconomicsChartSeries(): {
  tier: string;
  price: number;
  cogs: number;
  marginPct: number;
}[] {
  return (["Basic", "Lookbook", "Premium"] as const).map((tier) => {
    const price = tierPrice(tier);
    const cogs = tierCogsEur(tier);
    const stripe = price * COGS.stripePct + COGS.stripeFixedEur;
    const contrib = price - cogs - stripe;
    return {
      tier,
      price,
      cogs: Number(cogs.toFixed(2)),
      marginPct: Math.round((contrib / price) * 100),
    };
  });
}

export const UNIT_ECON_TAKEAWAY =
  "At €10–35 price and €0.34–1.08 COGS, paid reports deliver ~90–93% contribution margin (after card fees ~2.9% + €0.30). Starter (€0) is a controlled CAC: COGS ~€0.23, recovered via upsell. Credit gating on try-on (€1) protects margin on GPU steps. Crypto checkout (NOWPayments) is a parallel rail — lower fees, no chargebacks. Affiliate commissions are incremental with no COGS.";

export type CompLevel = "full" | "partial" | "none";

export const COMPETITORS: {
  name: string;
  price: string;
  color: CompLevel;
  shape: CompLevel;
  looks: CompLevel;
  catalog: CompLevel;
  vton: CompLevel;
  explain: CompLevel;
  payg: CompLevel;
  markets: CompLevel;
  note: string;
}[] = [
  {
    name: "Valetti",
    price: "€10–35 / report",
    color: "full",
    shape: "full",
    looks: "full",
    catalog: "full",
    vton: "full",
    explain: "full",
    payg: "full",
    markets: "full",
    note: "Full SRE pipeline: analysis → look → catalog → try-on + Shop a Look",
  },
  {
    name: "Stitch Fix",
    price: "€20+ fee + box",
    color: "partial",
    shape: "none",
    looks: "none",
    catalog: "full",
    vton: "none",
    explain: "partial",
    payg: "none",
    markets: "partial",
    note: "Human stylist + algorithm; no photorealistic looks on client",
  },
  {
    name: "Lookiero",
    price: "€10–12 / mo",
    color: "partial",
    shape: "none",
    looks: "none",
    catalog: "full",
    vton: "none",
    explain: "partial",
    payg: "none",
    markets: "full",
    note: "EU personal shopping; curator, not AI appearance analysis",
  },
  {
    name: "ChatGPT / Gemini",
    price: "€20 / mo",
    color: "partial",
    shape: "partial",
    looks: "none",
    catalog: "none",
    vton: "none",
    explain: "partial",
    payg: "none",
    markets: "partial",
    note: "Generic advice; no catalog, VTON, or persistent profile",
  },
  {
    name: "Zalando / ASOS AI",
    price: "Free (retailer)",
    color: "none",
    shape: "none",
    looks: "none",
    catalog: "full",
    vton: "partial",
    explain: "none",
    payg: "full",
    markets: "full",
    note: "In-catalog recommendations only; no personal report",
  },
];

export const ENGINES = [
  {
    code: "CAE",
    title: "Color Analytic Engine",
    subtitle: "Seasonal colour typing and palette — wardrobe foundation.",
    bullets: [
      "Vision: skin tone, undertone, facial contrast",
      "Color season (winter / spring / summer / autumn)",
      "Best & avoid colours with hex codes and rationale",
      "Eye and hair colour in overall harmony",
    ],
  },
  {
    code: "SAE",
    title: "Shape Analytics Engine",
    subtitle: "Face and body proportions — silhouette and fit.",
    bullets: [
      "Face shape → hair and accessories",
      "Body type + measurements",
      "Silhouette rules and proportions",
      "Hair recommend / avoid tied to face shape",
    ],
  },
  {
    code: "FE",
    title: "Fashion Engine",
    subtitle: "Season, trends, climate, lifestyle.",
    bullets: [
      "Climate mapping by country",
      "Seasonality: layers, fabrics, palette",
      "Goals & boldness → formality",
      "RAG style rules (pgvector)",
    ],
  },
  {
    code: "CHE",
    title: "Catalog Host Engine",
    subtitle: "Feed aggregator and scrapers — live catalog.",
    bullets: [
      "Affiliate feeds + brand scrapers (Zara, Massimo Dutti, …)",
      "Normalize · dedupe by source + color_key",
      "Embed → pgvector; skip unchanged re-embed",
      "Import API: POST /api/catalog/import",
    ],
  },
] as const;

export const SRE_FLOW = [
  "User photos + intake",
  "CAE + SAE + FE → Style Profile (JSON)",
  "RAG style rules + SRE → look synthesis",
  "Catalog Host Engine → vector product match",
  "Virtual try-on + Shop a Look + report / PDF",
] as const;

export const STACK_LAYERS = [
  ["Experience", "valetti.fit — Next.js on Vercel"],
  ["Orchestration", "Vision → profile → recommend → match → render"],
  ["AI Gateway", "Gemini / Claude via AI Gateway — vision, reasoning, embeddings, images"],
  ["Data", "Supabase Postgres + pgvector + Storage (EU region)"],
  [
    "Commerce",
    "Credits ledger · Lemon Squeezy / Stripe · NOWPayments crypto · affiliate deeplinks",
  ],
] as const;

export const MOAT = [
  "Proprietary SRE — multi-engine pipeline, not a prompt wrapper",
  "Catalog + embeddings — 10k+ real products, not LLM hallucinations",
  "Explainability — every recommendation includes Carlo's rationale",
  "VTON loop — analysis to try-on on your photo in one product",
  "Shop a Look — inspiration photo → buyable slots → try-on",
  "Unit economics — credit gating on heavy GPU steps; card + crypto rails",
] as const;

export const ROADMAP = [
  "Scale catalog (EU + USA retailers, multi-brand scrapers)",
  "Membership tier + stylist tools",
  "B2B pilots (salons, relocation, corporate white-label)",
  "Mobile app + stylist marketplace",
] as const;

export function compSymbol(level: CompLevel): string {
  if (level === "full") return "●";
  if (level === "partial") return "◐";
  return "○";
}
