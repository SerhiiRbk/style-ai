import {
  hexToHsl,
  palettePersonWithTrust,
  reportPalette,
  type ColorRec,
} from "./colour-palette";
import {
  classifySubseason,
  type Boldness,
  type StyleProfile,
} from "./style-profile";
import { workDefaultShirtColor } from "./look-occasion-fit";

export type LookColorRecipeMood = {
  boldness?: Boldness;
  occasionId?: string;
};

export type LookValueScheme = "light-over-deep" | "deep-over-light";

export type LookColorRecipe = {
  hero: ColorRec;
  bottom: ColorRec;
  neutrals: [ColorRec, ColorRec];
  accent: ColorRec | null;
  scheme: LookValueScheme;
  /** Per-look shoe colour — rotated so a 3-look set is not three warm-grey loafers. */
  shoe: ColorRec;
};

type SwatchRole = "hero" | "anchor" | "light" | "mid";

function roleFor(sw: ColorRec): SwatchRole {
  const { s, l } = hexToHsl(sw.hex);
  if (l <= 0.34 && s < 0.32) return "anchor";
  if (l >= 0.68 && s < 0.22) return "light";
  if (s >= 0.16 && l >= 0.22 && l <= 0.72) return "hero";
  if (l >= 0.55) return "light";
  if (l <= 0.38) return "anchor";
  return "mid";
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Spread chromatics around the hue wheel (max min-distance greedy). */
function spreadHeroes(heroes: ColorRec[]): ColorRec[] {
  if (heroes.length <= 1) return [...heroes];
  const scored = heroes.map((c) => ({ c, hsl: hexToHsl(c.hex) }));
  scored.sort((a, b) => b.hsl.s - a.hsl.s || a.hsl.l - b.hsl.l);
  const ordered: typeof scored = [scored[0]!];
  const rest = scored.slice(1);
  while (rest.length) {
    let bestI = 0;
    let bestMin = -1;
    for (let i = 0; i < rest.length; i++) {
      const minD = Math.min(
        ...ordered.map((o) => hueDist(o.hsl.h, rest[i]!.hsl.h)),
      );
      if (minD > bestMin) {
        bestMin = minD;
        bestI = i;
      }
    }
    ordered.push(rest.splice(bestI, 1)[0]!);
  }
  return ordered.map((x) => x.c);
}

function classify(best: ColorRec[]) {
  const heroes: ColorRec[] = [];
  const anchors: ColorRec[] = [];
  const lights: ColorRec[] = [];
  const mids: ColorRec[] = [];
  for (const sw of best) {
    if (!sw.hex) continue;
    const role = roleFor(sw);
    if (role === "hero") heroes.push(sw);
    else if (role === "anchor") anchors.push(sw);
    else if (role === "light") lights.push(sw);
    else mids.push(sw);
  }
  return { heroes, anchors, lights, mids };
}

function pickShared(
  lights: ColorRec[],
  mids: ColorRec[],
  anchors: ColorRec[],
  heroes: ColorRec[],
): [ColorRec, ColorRec] {
  const light = lights[0] ?? mids[0] ?? heroes[0] ?? anchors[0];
  const mid =
    mids[0] ??
    lights[1] ??
    lights[0] ??
    anchors[0] ??
    heroes[1] ??
    heroes[0] ??
    light;
  if (!light || !mid) {
    const fallback = heroes[0] ?? anchors[0];
    if (!fallback) {
      throw new Error("lookSetColorRecipes: BEST palette is empty");
    }
    return [fallback, fallback];
  }
  return [light, mid];
}

function bottomsPool(
  anchors: ColorRec[],
  lights: ColorRec[],
  mids: ColorRec[],
  shared: [ColorRec, ColorRec],
  preferChroma = false,
): ColorRec[] {
  const out: ColorRec[] = [];
  const seen = new Set<string>();
  const chromatic = [...mids, ...lights].filter((sw) => hexToHsl(sw.hex).s >= 0.14);
  const order = preferChroma
    ? [...chromatic, ...anchors, shared[0], shared[1]]
    : [...anchors, shared[0], ...lights.slice(0, 2), shared[1], ...mids.slice(0, 1)];
  for (const sw of order) {
    const key = sw.hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sw);
  }
  return out.length ? out : [shared[0]];
}

export function lookSetColorRecipes(
  best: ColorRec[],
  count: number,
  mood?: LookColorRecipeMood,
): LookColorRecipe[] {
  if (count <= 0 || !best.length) return [];
  const preferChroma =
    mood?.boldness === "statement" || mood?.boldness === "experimental";
  const { heroes, anchors, lights, mids } = classify(best);
  const heroPool = spreadHeroes(heroes.length ? heroes : [...anchors, ...mids, ...lights].filter(Boolean));
  if (!heroPool.length) return [];
  const shared = pickShared(lights, mids, anchors, heroPool);
  const preferredBottoms = bottomsPool(anchors, lights, mids, shared, preferChroma);
  const extraBottoms = best.filter(
    (sw) =>
      !preferredBottoms.some((b) => b.hex.toLowerCase() === sw.hex.toLowerCase()),
  );
  const bottoms = [...preferredBottoms, ...extraBottoms];
  const seen = new Set<string>();
  const usedShoes = new Set<string>();
  const recipes: LookColorRecipe[] = [];

  for (let i = 0; i < count; i++) {
    const hero = heroPool[i % heroPool.length]!;
    let bottom = preferredBottoms[0] ?? bottoms[0]!;
    let found = false;
    const tryOrder = [
      ...preferredBottoms.slice(i % Math.max(preferredBottoms.length, 1)),
      ...preferredBottoms.slice(0, i % Math.max(preferredBottoms.length, 1)),
      ...extraBottoms,
    ];
    for (const cand of tryOrder) {
      if (cand.hex.toLowerCase() === hero.hex.toLowerCase()) continue;
      const key = `${hero.hex}|${cand.hex}`.toLowerCase();
      if (seen.has(key)) continue;
      bottom = cand;
      seen.add(key);
      found = true;
      break;
    }
    if (!found) {
      // Exhausted cartesian pairs — pair with the next unused BEST swatch.
      const fallback = best.find(
        (sw) =>
          sw.hex.toLowerCase() !== hero.hex.toLowerCase() &&
          !seen.has(`${hero.hex}|${sw.hex}`.toLowerCase()),
      );
      if (fallback) {
        bottom = fallback;
        seen.add(`${hero.hex}|${fallback.hex}`.toLowerCase());
      }
    }
    const heroL = hexToHsl(hero.hex).l;
    const bottomL = hexToHsl(bottom.hex).l;
    const scheme: LookValueScheme =
      heroL <= bottomL ? "deep-over-light" : "light-over-deep";
    const accent =
      heroPool[(i + Math.ceil(heroPool.length / 2)) % heroPool.length] ?? null;
    const accentSw =
      accent && accent.hex.toLowerCase() !== hero.hex.toLowerCase()
        ? accent
        : null;
    const shoePool = [...shared, accentSw, hero].filter(
      (c): c is ColorRec => Boolean(c),
    );
    const unused = shoePool.filter(
      (c) => !usedShoes.has(c.hex.toLowerCase()),
    );
    const shoe =
      contrastSwatch(bottom, unused.length ? unused : shoePool) ??
      shared[0] ??
      hero;
    usedShoes.add(shoe.hex.toLowerCase());
    recipes.push({
      hero,
      bottom,
      neutrals: shared,
      accent: accentSw,
      scheme,
      shoe,
    });
  }
  return recipes;
}

const WARM_NEUTRAL_RE =
  /\b(mushroom|greige|taupe|beige|sand|stone|khaki|camel|tan|oat|putty)\b/i;

function isWarmNeutral(c: ColorRec): boolean {
  return WARM_NEUTRAL_RE.test(c.name);
}

/** Pick a shoe/contrast colour that won't melt into the trousers. */
export function contrastSwatch(
  from: ColorRec,
  candidates: (ColorRec | null | undefined)[],
): ColorRec | null {
  const fromHsl = hexToHsl(from.hex);
  let best: ColorRec | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (!c?.hex) continue;
    if (c.hex.toLowerCase() === from.hex.toLowerCase()) continue;
    const hsl = hexToHsl(c.hex);
    let score = Math.abs(hsl.l - fromHsl.l) + hueDist(fromHsl.h, hsl.h) / 360;
    if (isWarmNeutral(from) && isWarmNeutral(c)) score -= 0.45;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function formatLookColorRecipePrompt(
  recipe: LookColorRecipe,
  mood?: LookColorRecipeMood,
): string {
  const swatch = (c: ColorRec) => `${c.name} ${c.hex}`;
  const isParty = mood?.occasionId === "party";
  const isStatement =
    mood?.boldness === "statement" || mood?.boldness === "experimental";
  const accent = recipe.accent
    ? isParty
      ? `- Accent (pocket square only with a blazer, scarf, or jewellery — never a tote): ${swatch(recipe.accent)}\n`
      : `- Accent only (belt, scarf, bag or a small layer — not a second main garment). ` +
        `Name a pocket square only if this look also has a blazer — never on a ` +
        `shirt-only look or a jumper: ${swatch(recipe.accent)}\n`
    : "";
  const heroLine = isParty && isStatement
    ? `- Hero (nearest the face): ${swatch(recipe.hero)} — an evening statement piece ` +
      `(velvet jacket, silk shirt or rich colour), not a standalone office crewneck.\n`
    : `- Hero (nearest the face / main top): ${swatch(recipe.hero)}\n`;
  const shoe =
    recipe.shoe ??
    contrastSwatch(recipe.bottom, [
      ...recipe.neutrals,
      recipe.accent,
      recipe.hero,
    ]) ??
    recipe.neutrals[0];
  const belt =
    recipe.neutrals.find(
      (n) => n.hex.toLowerCase() !== shoe.hex.toLowerCase(),
    ) ?? recipe.neutrals[0];
  const isWork =
    mood?.occasionId === "work" || mood?.occasionId === "formal";
  const shirtColor = isWork
    ? workDefaultShirtColor(recipe.bottom.name, recipe.bottom.hex)
    : null;
  const shirtLine = shirtColor
    ? shirtColor === "white"
      ? `- Shirt: white oxford or poplin — trousers are dark / brown. Do not put the hero colour on the shirt.\n`
      : `- Shirt: light blue oxford or poplin — trousers are light. Do not put the hero colour on the shirt.\n`
    : "";
  const neutralsLine = isParty
    ? `- Shoes: ${swatch(shoe)} — MUST contrast the trousers (different lightness or family; ` +
      `never greige/mushroom/taupe shoes with greige/mushroom/taupe trousers). No tote.\n` +
      `- Belt: ${swatch(belt)}\n`
    : `- Shoes: ${swatch(shoe)} — this look's pair, not the same grey as every other look. ` +
      `Must contrast the trousers (not the same greige/mushroom/taupe family).\n` +
      `- Shared neutrals (belt, bag): ${recipe.neutrals.map(swatch).join(", ")}\n`;
  return (
    `Colour recipe for THIS look (mandatory — do not substitute):\n` +
    heroLine +
    `- Bottom: ${swatch(recipe.bottom)}\n` +
    shirtLine +
    neutralsLine +
    accent +
    `Use ONLY these colours in "palette" and in every garment colour word in the description.` +
    (shirtColor
      ? ` The shirt colour above is the one exception — white or light blue is required for work.\n`
      : `\n`)
  );
}

export function recipePaletteHexes(recipe: LookColorRecipe): string[] {
  const out: string[] = [recipe.hero.hex, recipe.bottom.hex, recipe.shoe.hex];
  for (const n of recipe.neutrals) out.push(n.hex);
  if (recipe.accent) out.push(recipe.accent.hex);
  const seen = new Set<string>();
  return out.filter((h) => {
    const k = h.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function bestSwatchesForProfile(profile: StyleProfile): ColorRec[] {
  const undertone = profile.physical.undertone;
  const contrast = profile.physical.contrast;
  const subseason =
    profile.colorSubseason ??
    classifySubseason({
      season: profile.colorSeason,
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
    });
  return reportPalette({
    subseason,
    ...palettePersonWithTrust({
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
      skinTone: profile.physical.skinTone,
      skinHex: profile.physical.skinHex,
      hairHex: profile.physical.hairHex,
      eyeHex: profile.physical.eyeHex,
      lighting: profile.physical.lighting,
    }),
  }).best;
}
