/**
 * Heuristic look-slot ranking — the same function production matching uses
 * before the (cached) Sonnet rerank. Kept free of server-only so the
 * golden-set in look-match-regression.test.ts can run locally.
 */
import { formatCatalogProductTitle } from "@/lib/product-title";
import {
  lookStyleFitScore,
  lookStyleIsVeto,
  type LookStyleFitInput,
} from "@/lib/look-style-fit";
import {
  isOccasionCasualBeltTitle,
  isOccasionCasualShirtTitle,
  isOccasionCasualShoeTitle,
  isOccasionCasualTrouserTitle,
  isOccasionCrossbodyBagTitle,
  isOccasionTravelBagTitle,
  isDressFootwearTitle,
  isRainUtilityFootwearTitle,
  isSuedeFootwearTitle,
  clauseAsksRainUtility,
  prefersLeatherFootwear,
  isLeatherUpperFootwear,
  isWorkDressShirtTitle,
  lookOccasionAppliesToBag,
  lookOccasionAppliesToBelt,
  lookOccasionAppliesToGarment,
  lookOccasionAppliesToShirt,
  lookOccasionAppliesToShoe,
  clauseAsksLinen,
  prefersSuedeFootwear,
  prefersLoaferFootwear,
  isLoaferTitle,
  prefersChinoTrousers,
  prefersWoolTrousers,
  isChinoTitle,
  isNonDressShirtTitle,
  isWorkFashionShirtTitle,
} from "@/lib/look-occasion-fit";
import {
  colorMatchScore,
  colorFamilies,
  colorShade,
  lookColorCue,
  lookAsksTeal,
  lookAsksPlum,
  lookAsksCharcoal,
  productColorFamilies,
  garmentTitleMatchScore,
  isBlazerGarment,
  isDrawstringTitle,
  isTailoredBlazerTitle,
  prefersDrawstringSilhouette,
  silhouetteFitScore,
  styleFitScore,
} from "@/lib/style-extras";
import { attrFitScore, slotAttrs } from "@/lib/data/catalog-attrfit";
import { LOOK_RERANK_CANDIDATE_LIMIT } from "@/lib/ai/look-item-rerank-format";

export type LookMatchRow = {
  id: string;
  source: string | null;
  brand: string | null;
  title: string;
  color: string | null;
  color_hex?: string | null;
  formality?: number | null;
  trend_level?: number | null;
  versatility?: number | null;
  price_eur: number | null;
  price_native?: number | null;
  currency?: string | null;
  deeplink: string | null;
  image_url: string | null;
  offer_country?: string | null;
  same_country?: boolean | null;
  similarity?: number;
  garment_subtype?: string | null;
  material_family?: string | null;
  fit?: string | null;
  pattern?: string | null;
  season?: string | null;
  gender?: string | null;
  description?: string | null;
};

export type LookMatchCandidate = {
  id: string;
  title: string;
  color: string | null;
} & Partial<LookMatchRow>;

export type RankedLookMatch = {
  row: LookMatchRow;
  colorScore: number;
  garmentScore: number;
  similarPick: boolean;
  lookStyleFit: number;
  score: number;
};

const MIN_VECTOR_SIMILARITY = 0.68;
const STRONG_COLOR_MATCH = 0.7;
const MIN_LOOK_PICK_SCORE = 0.42;
const LOOK_STYLE_FIT_WEIGHT = 0.1;
const MIN_COLOR_WHEN_STRONG = 0.45;

const CHROMATIC_FAMILIES = new Set([
  "green",
  "blue",
  "red",
  "pink",
  "purple",
  "orange",
  "yellow",
]);

const STRICT_ACCESSORY_TYPES = new Set([
  "pocket square",
  "pochette",
  "handkerchief",
  "belt",
  "watch",
  "tie",
  "necktie",
  "bowtie",
  "bow tie",
  "scarf",
  "neckerchief",
  "neck scarf",
  "hat",
  "cap",
  "sunglasses",
  "glasses",
  "tote",
  "tote bag",
  "messenger",
  "messenger bag",
  "briefcase",
  "satchel",
  "backpack",
  "bag",
]);

export const LIGHT_CUE_RE =
  /\b(oatmeal|cream|ivory|ecru|beige|sand|stone|oat|bone|light|pale|greige|mushroom|off[-\s]?white)\b/i;
const DARK_CUE_RE =
  /\b(coffee|chocolate|espresso|mocha|navy|charcoal|black|dark|deep|ink)\b/i;

export function isTrendForward(boldness: string): boolean {
  const b = (boldness || "moderate").toLowerCase();
  return b === "statement" || b === "experimental";
}

export function tagFitScore(row: LookMatchRow, boldness: string): number {
  const trend = row.trend_level;
  const vers = row.versatility;
  const formality = row.formality;
  if (trend == null && vers == null && formality == null) return 0;

  const b = (boldness || "moderate").toLowerCase();
  const bold = isTrendForward(b);
  const conservative = b === "conservative";
  let s = 0;

  if (trend != null) {
    if (bold) {
      s += trend >= 3 ? -0.05 : trend >= 1 ? 0.03 : 0;
    } else {
      s -= (conservative ? 0.06 : 0.03) * trend;
    }
  }
  if (vers != null) s += (conservative ? 0.03 : 0.02) * vers;
  if (formality != null && conservative) s += (formality - 3) * 0.02;

  return s;
}

export function hasChromaticCue(cue: string | null): boolean {
  if (!cue) return false;
  const fams = colorFamilies(cue);
  for (const f of fams) if (CHROMATIC_FAMILIES.has(f)) return true;
  return false;
}

export function hasSameChromaticFamily(cue: string | null, row: LookMatchRow): boolean {
  if (!cue) return false;
  const asked = colorFamilies(cue);
  const title = formatCatalogProductTitle(row.brand, row.title);
  const got = colorFamilies(`${row.color ?? ""} ${title}`);
  for (const f of asked) {
    if (CHROMATIC_FAMILIES.has(f) && got.has(f)) return true;
  }
  return false;
}

export function hasStrongColorHit(
  rows: LookMatchRow[],
  cue: string | null,
): boolean {
  if (!cue) return false;
  return rows.some((r) => hasSameChromaticFamily(cue, r));
}

export function isOfficeWorkRow(
  garment: string,
  title: string,
  clause: string | null | undefined,
  row: LookMatchRow,
): boolean {
  if (lookOccasionAppliesToBag(garment)) {
    return (
      !isOccasionTravelBagTitle(title, clause) &&
      !isOccasionCrossbodyBagTitle(title, clause, garment)
    );
  }
  if (lookOccasionAppliesToShirt(garment)) {
    return !isOccasionCasualShirtTitle(title, clause, {
      fit: row.fit,
      materialFamily: row.material_family,
      description: row.description,
      pattern: row.pattern,
      garmentSubtype: row.garment_subtype,
    });
  }
  if (lookOccasionAppliesToBelt(garment)) {
    return !isOccasionCasualBeltTitle(title, clause, {
      description: row.description,
      materialFamily: row.material_family,
    });
  }
  if (lookOccasionAppliesToShoe(garment)) {
    return !isOccasionCasualShoeTitle(title, clause, row.garment_subtype);
  }
  return !isOccasionCasualTrouserTitle(title, clause, {
    fit: row.fit,
    materialFamily: row.material_family,
    description: row.description,
    garmentSubtype: row.garment_subtype,
  });
}

function styleFitInput(row: LookMatchRow, title: string): LookStyleFitInput {
  return {
    title,
    garmentSubtype: row.garment_subtype,
    pattern: row.pattern,
    materialFamily: row.material_family,
    fit: row.fit,
    description: row.description,
  };
}

export function rowColorText(row: LookMatchRow): string {
  return `${row.color ?? ""} ${formatCatalogProductTitle(row.brand, row.title)}`;
}

/** Plum with no catalogue hit keeps navy/slate — drop pastel pink when a cool option exists. */
function keepPlumWearable(
  ranked: RankedLookMatch[],
  colorCue: string | null,
): RankedLookMatch[] {
  if (!lookAsksPlum(colorCue) || !ranked.length) return ranked;
  const wearable = ranked.filter((r) => {
    const title = formatCatalogProductTitle(r.row.brand, r.row.title);
    const fams = productColorFamilies(
      r.row.color,
      title,
      r.row.color_hex ?? r.row.color,
    );
    return fams.has("purple") || fams.has("blue") || fams.has("grey");
  });
  return wearable.length ? wearable : ranked;
}

/** Charcoal is dark grey — drop teal/green even when they are also dark. */
function keepCharcoalWearable(
  ranked: RankedLookMatch[],
  colorCue: string | null,
): RankedLookMatch[] {
  if (!lookAsksCharcoal(colorCue) || lookAsksTeal(colorCue) || !ranked.length) {
    return ranked;
  }
  const wearable = ranked.filter((r) => {
    const title = formatCatalogProductTitle(r.row.brand, r.row.title);
    const fams = productColorFamilies(
      r.row.color,
      title,
      r.row.color_hex ?? r.row.color,
    );
    if (fams.has("green") && !fams.has("grey") && !fams.has("black")) {
      return false;
    }
    return fams.has("grey") || fams.has("black") || fams.has("brown");
  });
  return wearable.length ? wearable : ranked;
}

function dropOpposingNeutrals(
  ranked: RankedLookMatch[],
  colorCue: string | null,
): RankedLookMatch[] {
  const asked = colorFamilies(colorCue ?? "");
  if (asked.has("brown")) {
    const brown = ranked.filter((r) => {
      const fams = colorFamilies(rowColorText(r.row));
      return fams.has("brown") && !fams.has("black");
    });
    if (brown.length) {
      ranked = ranked.filter((r) => {
        const fams = colorFamilies(rowColorText(r.row));
        return !(fams.has("black") && !fams.has("brown"));
      });
      if (!asked.has("white")) {
        const withoutCream = ranked.filter((r) => {
          const fams = colorFamilies(rowColorText(r.row));
          return !(fams.has("white") && !fams.has("brown"));
        });
        if (withoutCream.length) ranked = withoutCream;
      }
    }
  }
  if (asked.has("black")) {
    const black = ranked.filter((r) =>
      colorFamilies(rowColorText(r.row)).has("black"),
    );
    if (black.length) {
      ranked = ranked.filter((r) => {
        const fams = colorFamilies(rowColorText(r.row));
        return !(fams.has("brown") && !fams.has("black"));
      });
    }
  }
  return ranked;
}

function hexLightness(hex?: string | null): number | null {
  const m = (hex ?? "").trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1]!;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

function productShadeBucket(row: LookMatchRow): "light" | "mid" | "dark" | null {
  const named = colorShade(rowColorText(row));
  if (named) return named;
  const l = hexLightness(row.color_hex ?? row.color);
  if (l == null) return null;
  if (l >= 0.58) return "light";
  if (l <= 0.4) return "dark";
  return "mid";
}

function dropOppositeShade(
  ranked: RankedLookMatch[],
  colorCue: string | null,
): RankedLookMatch[] {
  if (!colorCue || !ranked.length) return ranked;
  const lightAsk = LIGHT_CUE_RE.test(colorCue);
  const darkAsk = DARK_CUE_RE.test(colorCue);
  if (!lightAsk && !darkAsk) return ranked;
  const keep = ranked.filter((r) => {
    const shade = productShadeBucket(r.row);
    if (lightAsk && shade === "dark") return false;
    if (darkAsk && shade === "light") return false;
    if (r.colorScore >= 0.45) return true;
    if (lightAsk && shade === "light") return true;
    if (darkAsk && shade === "dark") {
      if (lookAsksCharcoal(colorCue) && !lookAsksTeal(colorCue)) {
        const title = formatCatalogProductTitle(r.row.brand, r.row.title);
        const fams = productColorFamilies(
          r.row.color,
          title,
          r.row.color_hex ?? r.row.color,
        );
        return fams.has("grey") || fams.has("black") || fams.has("brown");
      }
      return true;
    }
    return false;
  });
  return keep.length ? keep : ranked;
}

export function rankMatchRows(
  rows: LookMatchRow[],
  color: string | null,
  garment: string,
  boldness: string,
  clause?: string | null,
  styleId?: string | null,
  occasionId?: string | null,
): RankedLookMatch[] {
  const slot = slotAttrs(garment, clause);
  const colorCue = lookColorCue(color, clause);
  let ranked = rows.map((row) => {
    const title = formatCatalogProductTitle(row.brand, row.title);
    const sim = row.similarity ?? 0;
    const colorScore = colorMatchScore(colorCue, row.color, title, {
      productHex: row.color_hex,
    });
    const garmentScore = garmentTitleMatchScore(garment, title);
    const similarPick =
      sim < MIN_VECTOR_SIMILARITY || colorScore < STRONG_COLOR_MATCH;
    const localBoost = row.same_country ? 0.04 : 0;
    const styleFit = styleFitScore(title, boldness);
    const lookStyleFit = lookStyleFitScore(styleId, styleFitInput(row, title));
    const tagFit = tagFitScore(row, boldness);
    const attrFit = attrFitScore(row, slot, garmentScore);
    const silhouetteFit = silhouetteFitScore(clause, title, {
      description: row.description,
    });
    return {
      row,
      colorScore,
      garmentScore,
      similarPick,
      lookStyleFit,
      score:
        sim * 0.38 +
        colorScore * 0.32 +
        garmentScore * 0.26 +
        localBoost +
        styleFit +
        lookStyleFit * LOOK_STYLE_FIT_WEIGHT +
        tagFit +
        attrFit +
        silhouetteFit,
    };
  });

  ranked = dropOpposingNeutrals(ranked, colorCue);
  ranked = keepPlumWearable(ranked, colorCue);
  ranked = keepCharcoalWearable(ranked, colorCue);

  if (prefersDrawstringSilhouette(garment, clause)) {
    const drawstring = ranked.filter((r) =>
      isDrawstringTitle(formatCatalogProductTitle(r.row.brand, r.row.title), {
        description: r.row.description,
      }),
    );
    if (drawstring.length) return drawstring;
  }

  if (isBlazerGarment(garment)) {
    const tailored = ranked.filter((r) =>
      isTailoredBlazerTitle(formatCatalogProductTitle(r.row.brand, r.row.title)),
    );
    const pool = tailored.length ? tailored : ranked;
    const KNIT_SUBTYPES = new Set(["hoodie", "sweatshirt", "cardigan", "sweater"]);
    const withoutKnit = pool.filter(
      (r) => !r.row.garment_subtype || !KNIT_SUBTYPES.has(r.row.garment_subtype),
    );
    if (withoutKnit.length) return withoutKnit;
    return pool;
  }

  if (STRICT_ACCESSORY_TYPES.has(garment.trim().toLowerCase())) {
    const typed = ranked.filter((r) => r.garmentScore >= 0.5);
    if (typed.length) {
      ranked = typed;
    } else if (/\bmessenger\b/.test(garment)) {
      const briefcases = ranked.filter((r) =>
        /\bbriefcase\b/i.test(
          formatCatalogProductTitle(r.row.brand, r.row.title),
        ),
      );
      if (briefcases.length) ranked = briefcases;
      else ranked = typed;
    } else {
      ranked = typed;
    }
  }

  if (lookOccasionAppliesToGarment(occasionId, garment)) {
    const beforeOffice = ranked;
    const office = ranked.filter((r) => {
      const title = formatCatalogProductTitle(r.row.brand, r.row.title);
      return isOfficeWorkRow(garment, title, clause, r.row);
    });
    if (office.length) ranked = office;
    if (lookOccasionAppliesToShirt(garment) && colorCue && hasChromaticCue(colorCue)) {
      const familyOk = (r: RankedLookMatch) => {
        const title = formatCatalogProductTitle(r.row.brand, r.row.title);
        if (isNonDressShirtTitle(title, r.row.garment_subtype)) return false;
        if (isWorkFashionShirtTitle(title, r.row.material_family)) return false;
        if (/\bstand(?:[-\s]?up)?\s+collar\b/i.test(title)) return false;
        if (lookAsksTeal(colorCue)) {
          const fams = colorFamilies(rowColorText(r.row));
          return fams.has("blue") || fams.has("grey");
        }
        return hasSameChromaticFamily(colorCue, r.row);
      };
      const officeFamily = ranked.filter(familyOk);
      if (officeFamily.length) ranked = officeFamily;
      else {
        const rescued = beforeOffice.filter(familyOk);
        if (rescued.length) ranked = rescued;
      }
    }
    if (lookOccasionAppliesToShirt(garment) && !clauseAsksLinen(clause)) {
      const dress = ranked.filter((r) =>
        isWorkDressShirtTitle(
          formatCatalogProductTitle(r.row.brand, r.row.title),
          r.row.garment_subtype,
        ),
      );
      if (dress.length) ranked = dress;
    }
    if (lookOccasionAppliesToShirt(garment) && clauseAsksLinen(clause)) {
      const linen = ranked.filter(
        (r) =>
          r.row.material_family === "linen" ||
          /\blinen\b/i.test(
            formatCatalogProductTitle(r.row.brand, r.row.title),
          ),
      );
      if (linen.length) ranked = linen;
    }
    if (
      !lookOccasionAppliesToShirt(garment) &&
      !lookOccasionAppliesToBag(garment) &&
      !lookOccasionAppliesToBelt(garment) &&
      !lookOccasionAppliesToShoe(garment)
    ) {
      const colorOk = dropOpposingNeutrals(ranked, colorCue);
      if (colorOk.length) ranked = colorOk;
      if (prefersChinoTrousers(garment, clause) && !prefersWoolTrousers(clause)) {
        const isChino = (r: RankedLookMatch) =>
          isChinoTitle(
            formatCatalogProductTitle(r.row.brand, r.row.title),
            r.row.garment_subtype,
          );
        const chinos = ranked.filter(isChino);
        if (chinos.length) ranked = chinos;
        else {
          const rescued = beforeOffice.filter(isChino);
          if (rescued.length) ranked = rescued;
          else {
            const notWool = ranked.filter((r) => {
              const title = formatCatalogProductTitle(r.row.brand, r.row.title);
              return (
                r.row.material_family !== "wool" &&
                !/\b(wool|worsted|suit)\b/i.test(title)
              );
            });
            if (notWool.length) ranked = notWool;
          }
        }
      } else if (prefersWoolTrousers(clause)) {
        const wool = ranked.filter(
          (r) =>
            r.row.material_family === "wool" ||
            /\b(wool|worsted)\b/i.test(
              formatCatalogProductTitle(r.row.brand, r.row.title),
            ),
        );
        if (wool.length) ranked = wool;
      }
    }
    if (lookOccasionAppliesToShoe(garment)) {
      if (prefersSuedeFootwear(clause)) {
        const suede = ranked.filter((r) =>
          isSuedeFootwearTitle(
            formatCatalogProductTitle(r.row.brand, r.row.title),
            r.row.material_family,
          ),
        );
        if (suede.length) ranked = suede;
      }
      if (prefersLoaferFootwear(clause)) {
        const loafers = ranked.filter((r) =>
          isLoaferTitle(
            formatCatalogProductTitle(r.row.brand, r.row.title),
            r.row.garment_subtype,
          ),
        );
        if (loafers.length) ranked = loafers;
      } else {
        const dress = ranked.filter((r) =>
          isDressFootwearTitle(
            formatCatalogProductTitle(r.row.brand, r.row.title),
            r.row.garment_subtype,
            r.row.material_family,
          ),
        );
        if (dress.length) ranked = dress;
      }
      if (!clauseAsksRainUtility(clause)) {
        const notRain = ranked.filter(
          (r) =>
            !isRainUtilityFootwearTitle(
              formatCatalogProductTitle(r.row.brand, r.row.title),
            ),
        );
        if (notRain.length) ranked = notRain;
      }
      if (
        prefersLeatherFootwear(clause) &&
        !prefersSuedeFootwear(clause) &&
        /\b(boots?|chelsea|chukka)\b/i.test(`${garment} ${clause ?? ""}`)
      ) {
        const leather = ranked.filter((r) =>
          isLeatherUpperFootwear(
            formatCatalogProductTitle(r.row.brand, r.row.title),
            r.row.material_family,
          ),
        );
        if (leather.length) ranked = leather;
      }
      if (!/\bboots?\b/i.test(clause ?? "")) {
        const noBoots = ranked.filter(
          (r) =>
            r.row.garment_subtype !== "boots" &&
            !/\bboots?\b/i.test(
              formatCatalogProductTitle(r.row.brand, r.row.title),
            ),
        );
        if (noBoots.length) ranked = noBoots;
      }
    }
  }

  if (
    /\b(boots?|chelsea|chukka)\b/i.test(`${garment} ${clause ?? ""}`) &&
    !clauseAsksRainUtility(clause)
  ) {
    const notRain = ranked.filter(
      (r) =>
        !isRainUtilityFootwearTitle(
          formatCatalogProductTitle(r.row.brand, r.row.title),
        ),
    );
    if (notRain.length) ranked = notRain;
  }

  ranked = dropOpposingNeutrals(ranked, colorCue);
  ranked = dropOppositeShade(ranked, colorCue);

  if (lookOccasionAppliesToShirt(garment) && colorCue) {
    if (hasChromaticCue(colorCue)) {
      const same = ranked.filter((r) => hasSameChromaticFamily(colorCue, r.row));
      const close = same.filter((r) => r.colorScore >= MIN_COLOR_WHEN_STRONG);
      if (close.length) ranked = close;
      else if (same.length) ranked = same;
      if (lookAsksTeal(colorCue)) {
        const cool = ranked.filter((r) => {
          const fams = colorFamilies(rowColorText(r.row));
          return fams.has("blue") || fams.has("grey");
        });
        if (cool.length) ranked = cool;
        const notDark = ranked.filter((r) => productShadeBucket(r.row) !== "dark");
        if (notDark.length) ranked = notDark;
      } else if (colorFamilies(colorCue).has("green")) {
        const noBlue = ranked.filter((r) => {
          const fams = colorFamilies(rowColorText(r.row));
          return fams.has("green") && !fams.has("blue");
        });
        if (noBlue.length) ranked = noBlue;
        if (colorShade(colorCue) === "light") {
          const noBrown = ranked.filter((r) => {
            const fams = colorFamilies(rowColorText(r.row));
            return fams.has("green") && !fams.has("brown");
          });
          if (noBrown.length) ranked = noBrown;
        }
      }
    } else {
      const close = ranked.filter((r) => r.colorScore >= MIN_COLOR_WHEN_STRONG);
      if (close.length) ranked = close;
      const asked = colorFamilies(colorCue);
      if (asked.has("brown") || asked.has("white")) {
        const warm = ranked.filter((r) => {
          const fams = colorFamilies(rowColorText(r.row));
          return fams.has("brown") || fams.has("white");
        });
        if (warm.length) ranked = warm;
      }
    }
    const office = ranked.filter((r) => {
      const title = formatCatalogProductTitle(r.row.brand, r.row.title);
      return !isWorkFashionShirtTitle(title, r.row.material_family);
    });
    if (office.length) ranked = office;
  }

  if (colorCue && ranked.some((r) => r.colorScore >= STRONG_COLOR_MATCH)) {
    const close = ranked.filter((r) => r.colorScore >= MIN_COLOR_WHEN_STRONG);
    const typed = ranked.filter((r) => r.garmentScore >= 0.5);
    const typedClose = typed.filter((r) => r.colorScore >= MIN_COLOR_WHEN_STRONG);
    if (typedClose.length) ranked = typedClose;
    else if (typed.length) ranked = typed;
    else if (close.length) ranked = close;
  }

  if (styleId && ranked.some((r) => r.lookStyleFit >= 1)) {
    const kept = ranked.filter((r) => {
      const title = formatCatalogProductTitle(r.row.brand, r.row.title);
      return !lookStyleIsVeto(styleId, styleFitInput(r.row, title));
    });
    if (kept.length) return kept;
  }
  return ranked;
}

export function pickBestMatch(
  rows: LookMatchRow[],
  color: string | null,
  garment: string,
  boldness: string,
  clause?: string | null,
  styleId?: string | null,
  occasionId?: string | null,
): { row: LookMatchRow; similarPick: boolean } | null {
  if (!rows.length) return null;
  const ranked = rankMatchRows(
    rows,
    color,
    garment,
    boldness,
    clause,
    styleId,
    occasionId,
  ).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < MIN_LOOK_PICK_SCORE) return null;
  if (best.garmentScore < 0.5 && best.colorScore < 0.45) return null;
  return { row: best.row, similarPick: best.similarPick };
}

export function topRankedCandidates(
  rows: LookMatchRow[],
  color: string | null,
  garment: string,
  boldness: string,
  clause?: string | null,
  styleId?: string | null,
  occasionId?: string | null,
): LookMatchRow[] {
  return rankMatchRows(rows, color, garment, boldness, clause, styleId, occasionId)
    .sort((a, b) => b.score - a.score)
    .slice(0, LOOK_RERANK_CANDIDATE_LIMIT)
    .map((r) => r.row);
}

function asRow(c: LookMatchCandidate): LookMatchRow {
  return {
    id: c.id,
    source: c.source ?? "fixture",
    brand: c.brand ?? null,
    title: c.title,
    color: c.color,
    color_hex: c.color_hex ?? null,
    formality: c.formality ?? null,
    trend_level: c.trend_level ?? null,
    versatility: c.versatility ?? null,
    price_eur: c.price_eur ?? 0,
    price_native: c.price_native ?? null,
    currency: c.currency ?? null,
    deeplink: c.deeplink ?? "https://shop.example/p",
    image_url: c.image_url ?? null,
    offer_country: c.offer_country ?? null,
    same_country: c.same_country ?? true,
    similarity: c.similarity ?? 0.84,
    garment_subtype: c.garment_subtype ?? null,
    material_family: c.material_family ?? null,
    fit: c.fit ?? null,
    pattern: c.pattern ?? null,
    season: c.season ?? null,
    gender: c.gender ?? null,
    description: c.description ?? null,
  };
}

export function rankLookSlot(
  pool: LookMatchCandidate[],
  slot: { garment: string; color?: string | null; clause?: string | null },
  opts?: {
    boldness?: string;
    styleId?: string | null;
    occasionId?: string | null;
  },
): LookMatchCandidate[] {
  return topRankedCandidates(
    pool.map(asRow),
    slot.color ?? null,
    slot.garment,
    opts?.boldness ?? "moderate",
    slot.clause,
    opts?.styleId,
    opts?.occasionId,
  );
}
