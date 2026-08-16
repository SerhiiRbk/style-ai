import { hexToHsl, reportPalette, type ColorRec } from "./colour-palette";
import { classifySubseason, type StyleProfile } from "./style-profile";

export type LookValueScheme = "light-over-deep" | "deep-over-light";

export type LookColorRecipe = {
  hero: ColorRec;
  bottom: ColorRec;
  neutrals: [ColorRec, ColorRec];
  accent: ColorRec | null;
  scheme: LookValueScheme;
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
): ColorRec[] {
  const out: ColorRec[] = [];
  const seen = new Set<string>();
  for (const sw of [...anchors, shared[0], ...lights.slice(0, 2), shared[1], ...mids.slice(0, 1)]) {
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
): LookColorRecipe[] {
  if (count <= 0 || !best.length) return [];
  const { heroes, anchors, lights, mids } = classify(best);
  const heroPool = spreadHeroes(heroes.length ? heroes : [...anchors, ...mids, ...lights].filter(Boolean));
  if (!heroPool.length) return [];
  const shared = pickShared(lights, mids, anchors, heroPool);
  const preferredBottoms = bottomsPool(anchors, lights, mids, shared);
  const extraBottoms = best.filter(
    (sw) =>
      !preferredBottoms.some((b) => b.hex.toLowerCase() === sw.hex.toLowerCase()),
  );
  const bottoms = [...preferredBottoms, ...extraBottoms];
  const seen = new Set<string>();
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
    recipes.push({
      hero,
      bottom,
      neutrals: shared,
      accent: accent && accent.hex.toLowerCase() !== hero.hex.toLowerCase() ? accent : null,
      scheme,
    });
  }
  return recipes;
}

export function formatLookColorRecipePrompt(recipe: LookColorRecipe): string {
  const swatch = (c: ColorRec) => `${c.name} ${c.hex}`;
  const accent = recipe.accent
    ? `- Accent only (pocket square / knit / small layer — not a second main garment): ${swatch(recipe.accent)}\n`
    : "";
  return (
    `Colour recipe for THIS look (mandatory — do not substitute):\n` +
    `- Hero (nearest the face / main top): ${swatch(recipe.hero)}\n` +
    `- Bottom: ${swatch(recipe.bottom)}\n` +
    `- Shared neutrals (shoes, belt, bag): ${recipe.neutrals.map(swatch).join(", ")}\n` +
    accent +
    `Use ONLY these colours in "palette" and in every garment colour word in the description.\n`
  );
}

export function recipePaletteHexes(recipe: LookColorRecipe): string[] {
  const out: string[] = [recipe.hero.hex, recipe.bottom.hex];
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
  return reportPalette({ subseason, undertone, contrast }).best;
}
