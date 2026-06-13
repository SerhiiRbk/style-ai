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
  { value: "5,000+", label: "SKUs in catalog" },
  { value: "EU / USA", label: "Markets · GDPR + CCPA" },
  { value: "Credits", label: "Pay-as-you-go" },
] as const;

export const PROBLEM_SOLUTION = {
  problem:
    "78% of men and women aged 30–55 in the EU and USA spend hours shopping without confidence in the outcome. Human stylists cost $150–400 / €150–400 per session; fast fashion is chaos without personalization. ChatGPT gives text — not photos, not a catalog, not try-on.",
  solution:
    "One engine analyses appearance, season, climate, and trends → synthesises personal looks → matches real products → renders photorealistic previews and virtual try-on on the user's photo. Every recommendation is explainable.",
  differentiator:
    "Not a generic LLM chat, but a closed pipeline — analysis → look → purchase → try-on — with a single Style Profile as source of truth.",
} as const;

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
  { name: "Credit packs", pct: 42 },
  { name: "Report tiers", pct: 35 },
  { name: "Affiliate (catalog)", pct: 15 },
  { name: "B2B white-label", pct: 8 },
] as const;

const COGS = { fixedUsd: 0.052, imageUsd: 0.04, eurRate: 0.92, stripePct: 0.029, stripeFixedEur: 0.3 };

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

export const UNIT_ECON_TAKEAWAY =
  "At €10–35 price and €0.34–1.08 COGS, paid reports deliver ~90–93% contribution margin (after Stripe 2.9% + €0.30). Starter (€0) is a controlled CAC: COGS ~€0.23, recovered via upsell to Basic/Lookbook. Credit gating on try-on (€1) protects margin on GPU steps. Affiliate commissions are incremental revenue with no COGS.";

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
    note: "Full SRE pipeline: analysis → look → catalog → try-on",
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
      "Affiliate feeds + brand scrapers (Zara, …)",
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
  "Virtual try-on + report / PDF delivery",
] as const;

export const STACK_LAYERS = [
  ["Experience", "valetti.fit — Next.js on Vercel"],
  ["Orchestration", "Vision → profile → recommend → match → render"],
  ["AI Gateway", "Vercel AI SDK — vision, reasoning, embeddings, images"],
  ["Data", "Supabase Postgres + pgvector + Storage (EU region)"],
  ["Commerce", "Credits ledger + Stripe + affiliate deeplinks"],
] as const;

export const MOAT = [
  "Proprietary SRE — multi-engine pipeline, not a prompt wrapper",
  "Catalog + embeddings — real products, not LLM hallucinations",
  "Explainability — every recommendation includes rationale",
  "VTON loop — analysis to try-on on your photo in one product",
  "Unit economics — credit gating on heavy GPU steps",
] as const;

export const ROADMAP = [
  "Scale catalog (EU + USA retailers, multi-brand scrapers)",
  "Stripe checkout + membership tier",
  "B2B pilots (salons, relocation, corporate)",
  "Mobile app + stylist marketplace",
] as const;

export function compSymbol(level: CompLevel): string {
  if (level === "full") return "●";
  if (level === "partial") return "◐";
  return "○";
}
