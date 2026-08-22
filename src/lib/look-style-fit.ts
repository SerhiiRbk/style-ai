/**
 * Catalogue fit for a named Create-a-Look aesthetic.
 *
 * Only high-signal styles have recipes — Riviera / Nordic / Milanese stay
 * brief-only (too many garments are "quiet navy knit"). Atelier is a no-op.
 * Score is a boost, never a hard requirement: untagged titles stay eligible.
 */

export type LookStyleFitInput = {
  title: string;
  garmentSubtype?: string | null;
  pattern?: string | null;
  materialFamily?: string | null;
  fit?: string | null;
  description?: string | null;
};

type StyleRecipe = {
  /** Tokens that belong in the vector query so the pool can see them. */
  queryHint: string;
  /** One line for the look-item reranker. */
  rerankHint: string;
  boost: (hay: string) => boolean;
  veto: (hay: string) => boolean;
};

const RE = {
  mariniere: /\b(marini[eè]re|breton)\b/i,
  caban: /\b(caban|pea[-\s]?coats?)\b/i,
  stripe: /\bstripe[ds]?\b/i,
  suitStripe: /\b(pinstripe|chalk\s*stripe|hairline\s*stripe|banker'?s?\s+stripe)\b/i,
  rollneck: /\b(roll[-\s]?necks?|turtlenecks?|turtle\s+necks?|polo\s+necks?)\b/i,
  trench: /\btrench(es|ed|coat)?\b/i,
  fairIsle: /\bfair[-\s]?isle\b/i,
  shetland: /\bshetland\b/i,
  shawl: /\bshawl[-\s]?collars?\b/i,
  fisherman: /\b(fishermen?'?s?\s+rib|fisherman'?s?\s+rib|submariners?)\b/i,
  oxford: /\boxfords?\b/i,
  poplin: /\bpoplin\b/i,
  worsted: /\bworsted\b/i,
  derby: /\bderb(?:y|ies)\b/i,
  casualShirt:
    /\b(relaxed|oversized|oversize|comfort(?:\s+fit)?|boxy|flowing|loose|viscose|cupro|camp[-\s]?collars?|short[- ]?sleeves?|stand[-\s]?up\s+collars?|mandarin|grandad|band\s+collars?|checks?|checked|plaid|gingham)\b/i,
  camp: /\bcamp[-\s]?collars?\b/i,
  belgian: /\bbelgian\s+loafers?\b/i,
  mesh: /\b(mesh|eyelet|open[-\s]?knit|openwork|crochet)\b/i,
  crochetHeritage: /\b(mesh|eyelet|open[-\s]?knit|openwork|crochet)\b/i,
  safari: /\bsafari\b/i,
  gurkha: /\bgurkha\b/i,
  seersucker: /\bseersucker\b/i,
  sneaker: /\b(sneakers?|trainers?)\b/i,
};

function maritimeStripe(hay: string): boolean {
  if (RE.suitStripe.test(hay)) return false;
  return RE.stripe.test(hay);
}

const RECIPES: Record<string, StyleRecipe> = {
  breton: {
    queryHint: "marinière breton stripe caban pea coat",
    rerankHint:
      "Aesthetic Breton — prefer a marinière stripe or caban; avoid safari, gurkha, seersucker.",
    boost: (h) => RE.mariniere.test(h) || RE.caban.test(h) || maritimeStripe(h),
    veto: (h) => RE.safari.test(h) || RE.gurkha.test(h) || RE.seersucker.test(h),
  },
  rive_gauche: {
    queryHint: "roll-neck turtleneck trench pea coat caban",
    rerankHint:
      "Aesthetic Rive Gauche — prefer a roll-neck, trench or caban; avoid gurkha and sneaker heroes.",
    boost: (h) => RE.rollneck.test(h) || RE.trench.test(h) || RE.caban.test(h),
    veto: (h) => RE.gurkha.test(h) || RE.sneaker.test(h),
  },
  heritage_knit: {
    queryHint: "Fair Isle Shetland shawl-collar fisherman rib",
    rerankHint:
      "Aesthetic Heritage knit — prefer Fair Isle, Shetland or a shawl-collar; avoid mesh/crochet and safari.",
    boost: (h) =>
      RE.fairIsle.test(h) ||
      RE.shetland.test(h) ||
      RE.shawl.test(h) ||
      RE.fisherman.test(h),
    veto: (h) => RE.crochetHeritage.test(h) || RE.safari.test(h),
  },
  city_formal: {
    queryHint: "oxford poplin worsted derby regular slim tailored",
    rerankHint:
      "Aesthetic City formal — prefer oxford, poplin, worsted or derbies in a regular or slim fit; avoid relaxed, viscose, camp-collar, safari, Belgian loafers.",
    boost: (h) =>
      !RE.casualShirt.test(h) &&
      (RE.oxford.test(h) ||
        RE.poplin.test(h) ||
        RE.worsted.test(h) ||
        RE.derby.test(h) ||
        /\b(twill|non[-\s]?iron)\b/i.test(h)),
    veto: (h) =>
      RE.casualShirt.test(h) ||
      RE.camp.test(h) ||
      RE.safari.test(h) ||
      RE.belgian.test(h) ||
      RE.seersucker.test(h),
  },
  open_knit: {
    queryHint: "open-knit crochet mesh eyelet",
    rerankHint:
      "Aesthetic Open knit — prefer mesh, crochet or eyelet; avoid Shetland, Fair Isle, shawl-collar.",
    boost: (h) => RE.mesh.test(h),
    veto: (h) => RE.shetland.test(h) || RE.fairIsle.test(h) || RE.shawl.test(h),
  },
};

function haystack(input: LookStyleFitInput): string {
  return [
    input.title,
    input.garmentSubtype,
    input.pattern,
    input.materialFamily,
    input.fit,
    input.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function recipeFor(styleId: string | null | undefined): StyleRecipe | null {
  if (!styleId) return null;
  return RECIPES[styleId] ?? null;
}

/** True when this style has a catalogue recipe (not Atelier / brief-only). */
export function lookStyleHasFit(styleId: string | null | undefined): boolean {
  return recipeFor(styleId) != null;
}

/** 1 if the product hits a style token, else 0. Atelier / unknown → 0. */
export function lookStyleFitScore(
  styleId: string | null | undefined,
  input: LookStyleFitInput,
): number {
  const recipe = recipeFor(styleId);
  if (!recipe) return 0;
  return recipe.boost(haystack(input)) ? 1 : 0;
}

/**
 * Soft veto: only drop when the pool already has a style hit.
 * A boost token always wins over a veto on the same title.
 */
export function lookStyleIsVeto(
  styleId: string | null | undefined,
  input: LookStyleFitInput,
): boolean {
  const recipe = recipeFor(styleId);
  if (!recipe) return false;
  const hay = haystack(input);
  if (recipe.boost(hay)) return false;
  return recipe.veto(hay);
}

/** Extra embed tokens so vector search can see the style's hero garments. */
export function lookStyleQueryHint(
  styleId: string | null | undefined,
): string | null {
  return recipeFor(styleId)?.queryHint ?? null;
}

/** One-line aesthetic for the look-item reranker. */
export function lookStyleRerankHint(
  styleId: string | null | undefined,
): string | null {
  return recipeFor(styleId)?.rerankHint ?? null;
}

export const LOOK_STYLE_FIT_IDS = Object.keys(RECIPES);
