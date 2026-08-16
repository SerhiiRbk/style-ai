import assert from "node:assert/strict";
import test from "node:test";
import { reportPalette, type ColorRec } from "./colour-palette";
import {
  formatLookColorRecipePrompt,
  lookSetColorRecipes,
  type LookColorRecipe,
} from "./look-set-color-recipes";

function best(subseason: Parameters<typeof reportPalette>[0]["subseason"]): ColorRec[] {
  return reportPalette({
    subseason,
    undertone: "neutral",
    contrast: "medium",
  }).best;
}

function hexes(bestColors: ColorRec[]): Set<string> {
  return new Set(bestColors.map((c) => c.hex.toLowerCase()));
}

function assertOnPalette(recipes: LookColorRecipe[], palette: ColorRec[]) {
  const allowed = hexes(palette);
  for (const r of recipes) {
    for (const sw of [r.hero, r.bottom, ...r.neutrals, r.accent].filter(Boolean)) {
      assert.ok(
        allowed.has(sw!.hex.toLowerCase()),
        `${sw!.name} ${sw!.hex} is not in BEST`,
      );
    }
  }
}

test("3-look set: distinct heroes, shared neutrals, all on-palette", () => {
  const palette = best("soft-summer");
  const recipes = lookSetColorRecipes(palette, 3);
  assert.equal(recipes.length, 3);
  const heroes = recipes.map((r) => r.hero.hex.toLowerCase());
  assert.equal(new Set(heroes).size, 3, `heroes should differ: ${heroes.join(",")}`);
  const n0 = recipes[0]!.neutrals.map((n) => n.hex.toLowerCase()).join(",");
  for (const r of recipes) {
    assert.equal(r.neutrals.map((n) => n.hex.toLowerCase()).join(","), n0);
  }
  assertOnPalette(recipes, palette);
});

test("6 and 9 looks stay unique on (hero, bottom) and stay on-palette", () => {
  for (const n of [6, 9]) {
    const palette = best("soft-summer");
    const recipes = lookSetColorRecipes(palette, n);
    assert.equal(recipes.length, n);
    const pairs = recipes.map((r) => `${r.hero.hex}|${r.bottom.hex}`.toLowerCase());
    assert.equal(new Set(pairs).size, n, `duplicate pairs at n=${n}: ${pairs.join(" ; ")}`);
    for (const r of recipes) {
      assert.notEqual(r.hero.hex.toLowerCase(), r.bottom.hex.toLowerCase());
    }
    assertOnPalette(recipes, palette);
  }
});

test("first three heroes are hue-spread, not a single green cluster", () => {
  const recipes = lookSetColorRecipes(best("soft-summer"), 3);
  const names = recipes.map((r) => r.hero.name.toLowerCase());
  const greenish = names.filter((n) => /teal|sage|olive|mint|green/.test(n));
  assert.ok(
    greenish.length <= 1,
    `too many green heroes in first 3: ${names.join(", ")}`,
  );
});

test("recipes work across subseasons at 3/6/9", () => {
  for (const sub of ["cool-winter", "warm-autumn", "light-summer"] as const) {
    for (const n of [3, 6, 9]) {
      const palette = best(sub);
      const recipes = lookSetColorRecipes(palette, n);
      assert.equal(recipes.length, n, `${sub} n=${n}`);
      assertOnPalette(recipes, palette);
      assert.equal(
        new Set(recipes.map((r) => `${r.hero.hex}|${r.bottom.hex}`.toLowerCase())).size,
        n,
        `${sub} n=${n} duplicate pairs`,
      );
    }
  }
});

test("prompt lists hero, bottom and shared neutrals", () => {
  const [recipe] = lookSetColorRecipes(best("soft-summer"), 3);
  assert.ok(recipe);
  const text = formatLookColorRecipePrompt(recipe);
  assert.match(text, new RegExp(recipe.hero.name, "i"));
  assert.match(text, new RegExp(recipe.hero.hex, "i"));
  assert.match(text, new RegExp(recipe.bottom.name, "i"));
  assert.match(text, /shared neutrals/i);
});

test("count 0 returns no recipes", () => {
  assert.deepEqual(lookSetColorRecipes(best("soft-summer"), 0), []);
});
